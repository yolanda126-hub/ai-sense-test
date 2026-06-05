const TEXT = 1;
const NUMBER = 2;
const ATTACHMENT = 17;

export const CANDIDATE_FIELDS = [
  text("候选人编号"),
  text("测评时间"),
  text("是否值得推荐"),
  text("推荐公司"),
  text("适合岗位"),
  text("AI Sense 身份"),
  number("AI Sense 分数"),
  number("稳定性"),
  text("风险底线"),
  number("模型边界"),
  number("任务拆解"),
  number("验证意识"),
  number("Agent 工作流"),
  text("严格结论"),
  text("关键证据"),
  attachment("简历附件"),
  text("来源")
];

export const ROUND_FIELDS = [
  text("候选人编号"),
  text("游戏名称"),
  text("能力维度"),
  number("回合编号"),
  text("场景名称"),
  text("题目类型"),
  text("候选人选择"),
  text("正确答案"),
  number("回合得分"),
  text("是否高风险题"),
  text("是否触发风险"),
  text("行为证据")
];

export const RULE_FIELDS = [
  text("规则名称"),
  text("主能力维度"),
  number("最低总分"),
  number("最低单项分"),
  number("最低稳定性"),
  text("必须通过风险底线"),
  text("推荐公司"),
  text("适合岗位"),
  text("备注")
];

function text(fieldName) {
  return { field_name: fieldName, type: TEXT };
}

function number(fieldName) {
  return { field_name: fieldName, type: NUMBER };
}

function attachment(fieldName) {
  return { field_name: fieldName, type: ATTACHMENT };
}

async function main() {
  const appId = requireEnv("FEISHU_APP_ID");
  const appSecret = requireEnv("FEISHU_APP_SECRET");
  const appToken = requireEnv("FEISHU_APP_TOKEN");
  const candidateTableId = requireEnv("FEISHU_CANDIDATE_TABLE_ID");
  const token = await getTenantAccessToken(appId, appSecret);

  await ensureFields(token, appToken, candidateTableId, CANDIDATE_FIELDS);
  const roundTableId = await ensureTable(token, appToken, "游戏回合明细表", ROUND_FIELDS);
  const ruleTableId = await ensureTable(token, appToken, "公司与岗位规则表", RULE_FIELDS);

  console.log(JSON.stringify({
    FEISHU_CANDIDATE_TABLE_ID: candidateTableId,
    FEISHU_ROUND_TABLE_ID: roundTableId,
    FEISHU_RULE_TABLE_ID: ruleTableId
  }, null, 2));
}

async function getTenantAccessToken(appId, appSecret) {
  const result = await api("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });
  return result.tenant_access_token;
}

async function ensureTable(token, appToken, tableName, fields) {
  const tables = await listAll(token, `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables`);
  const existing = tables.find((table) => table.name === tableName);
  if (existing) {
    await ensureFields(token, appToken, existing.table_id, fields);
    return existing.table_id;
  }

  const result = await api(`https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ table: { name: tableName } })
  });
  const tableId = result.data.table_id;
  await ensureFields(token, appToken, tableId, fields);
  return tableId;
}

async function ensureFields(token, appToken, tableId, fields) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`;
  const existing = await listAll(token, url);
  const existingNames = new Set(existing.map((field) => field.field_name));
  for (const field of fields) {
    if (existingNames.has(field.field_name)) continue;
    await api(url, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(field)
    });
  }
}

async function listAll(token, url) {
  const result = await api(url, { headers: authHeaders(token) });
  return result.data?.items || [];
}

async function api(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok || result.code) {
    throw new Error(`${url} failed: ${JSON.stringify(result)}`);
  }
  return result;
}

function authHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json; charset=utf-8"
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
