export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return corsResponse();
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON payload" }, 400);
    }

    const candidate = payload.candidate || {};
    const rounds = Array.isArray(payload.rounds) ? payload.rounds : [];
    const required = ["候选人编号", "测评时间", "是否值得推荐", "推荐公司", "适合岗位"];
    const missing = required.filter((key) => !candidate[key]);
    if (missing.length) return json({ error: `Missing fields: ${missing.join(", ")}` }, 400);
    if (rounds.length !== 12) return json({ error: "Exactly 12 round records are required" }, 400);

    const invalidRound = rounds.find((round) => !round["候选人编号"] || !round["游戏名称"] || !round["回合编号"]);
    if (invalidRound) return json({ error: "Every round record requires candidate ID, game name, and round number" }, 400);

    const candidateFields = pick(candidate, CANDIDATE_FIELDS);
    const roundRecords = rounds.map((round) => ({ fields: pick(round, ROUND_FIELDS) }));

    const token = await getTenantAccessToken(env);
    const candidateUrl = recordsUrl(env.FEISHU_APP_TOKEN, env.FEISHU_CANDIDATE_TABLE_ID);
    const candidateResponse = await fetch(candidateUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({ fields: candidateFields })
    });

    const candidateResult = await candidateResponse.json();
    if (!candidateResponse.ok || candidateResult.code) return json({ error: candidateResult }, 502);

    const roundUrl = `${recordsUrl(env.FEISHU_APP_TOKEN, env.FEISHU_ROUND_TABLE_ID)}/batch_create`;
    const roundResponse = await fetch(roundUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({ records: roundRecords })
    });
    const roundResult = await roundResponse.json();
    if (!roundResponse.ok || roundResult.code) {
      return json({
        error: roundResult,
        partial: true,
        candidateRecordId: candidateResult.data?.record?.record_id
      }, 502);
    }

    return json({
      ok: true,
      candidateRecord: candidateResult.data?.record,
      roundRecords: roundResult.data?.records || []
    });
  }
};

const CANDIDATE_FIELDS = [
  "候选人编号",
  "测评时间",
  "是否值得推荐",
  "推荐公司",
  "适合岗位",
  "AI Sense 身份",
  "AI Sense 分数",
  "稳定性",
  "风险底线",
  "模型边界",
  "任务拆解",
  "验证意识",
  "Agent 工作流",
  "严格结论",
  "关键证据",
  "来源"
];

const ROUND_FIELDS = [
  "候选人编号",
  "游戏名称",
  "能力维度",
  "回合编号",
  "场景名称",
  "题目类型",
  "候选人选择",
  "正确答案",
  "回合得分",
  "是否高风险题",
  "是否触发风险",
  "行为证据"
];

function pick(fields, allowed) {
  return Object.fromEntries(allowed.filter((key) => fields[key] !== undefined).map((key) => [key, fields[key]]));
}

function recordsUrl(appToken, tableId) {
  return `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`;
}

async function getTenantAccessToken(env) {
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      app_id: env.FEISHU_APP_ID,
      app_secret: env.FEISHU_APP_SECRET
    })
  });
  const data = await response.json();
  if (!response.ok || data.code) throw new Error("Failed to get Feishu tenant_access_token");
  return data.tenant_access_token;
}

function corsResponse() {
  return new Response(null, { headers: corsHeaders() });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://yolanda126-hub.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
