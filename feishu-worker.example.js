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

    if (payload.resume) return handleResumeUpload(payload.resume, env);

    const candidate = payload.candidate || {};
    const rounds = Array.isArray(payload.rounds) ? payload.rounds : [];
    const required = ["候选人编号", "测评时间", "是否值得推荐", "推荐公司", "适合岗位"];
    const missing = required.filter((key) => !candidate[key]);
    if (missing.length) return json({ error: `Missing fields: ${missing.join(", ")}` }, 400);
    if (rounds.length !== 14) return json({ error: "Exactly 14 round records are required" }, 400);

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
  "简历附件",
  "来源"
];

const MAX_RESUME_BYTES = 20 * 1024 * 1024;
const RESUME_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt"]);

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

async function handleResumeUpload(resume, env) {
  const validationError = validateResume(resume);
  if (validationError) return json({ error: validationError }, 400);

  try {
    const bytes = base64ToBytes(resume.dataBase64);
    if (!bytes.byteLength || bytes.byteLength !== resume.size) return json({ error: "Resume file size does not match payload" }, 400);

    const token = await getTenantAccessToken(env);
    const fileToken = await uploadBitableAttachment(token, env.FEISHU_APP_TOKEN, {
      bytes,
      fileName: resume.fileName,
      mimeType: resume.mimeType || "application/octet-stream"
    });
    await ensureAttachmentField(token, env.FEISHU_APP_TOKEN, env.FEISHU_CANDIDATE_TABLE_ID);

    const updateUrl = `${recordsUrl(env.FEISHU_APP_TOKEN, env.FEISHU_CANDIDATE_TABLE_ID)}/${resume.candidateRecordId}`;
    const updateResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        fields: {
          "简历附件": [{ file_token: fileToken }]
        }
      })
    });
    const updateResult = await updateResponse.json();
    if (!updateResponse.ok || updateResult.code) return json({ error: updateResult }, 502);

    return json({
      ok: true,
      fileToken,
      candidateRecord: updateResult.data?.record
    });
  } catch (error) {
    return json({ error: error.message || "Failed to upload resume" }, 502);
  }
}

function validateResume(resume) {
  if (!resume || typeof resume !== "object") return "Missing resume payload";
  if (!resume.candidateRecordId) return "Missing candidate record ID";
  if (!resume.fileName || typeof resume.fileName !== "string") return "Missing resume file name";
  if (!Number.isInteger(resume.size) || resume.size <= 0) return "Invalid resume file size";
  if (resume.size > MAX_RESUME_BYTES) return "Resume file must be 20 MB or smaller";
  if (!resume.dataBase64 || typeof resume.dataBase64 !== "string") return "Missing resume file data";
  const extension = resume.fileName.split(".").pop()?.toLowerCase();
  if (!RESUME_EXTENSIONS.has(extension)) return "Unsupported resume file type";
  return "";
}

async function uploadBitableAttachment(token, appToken, file) {
  const form = new FormData();
  form.append("file_name", file.fileName);
  form.append("parent_type", "bitable_file");
  form.append("parent_node", appToken);
  form.append("size", String(file.bytes.byteLength));
  form.append("file", new Blob([file.bytes], { type: file.mimeType }), file.fileName);

  const response = await fetch("https://open.feishu.cn/open-apis/drive/v1/medias/upload_all", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
    body: form
  });
  const result = await response.json();
  const fileToken = result.data?.file_token || result.data?.file?.file_token;
  if (!response.ok || result.code || !fileToken) throw new Error("Failed to upload resume attachment");
  return fileToken;
}

async function ensureAttachmentField(token, appToken, tableId) {
  const fieldsUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`;
  const listResponse = await fetch(fieldsUrl, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
  const listResult = await listResponse.json();
  if (!listResponse.ok || listResult.code) throw new Error("Failed to list Feishu fields");
  const fields = listResult.data?.items || [];
  if (fields.some((field) => field.field_name === "简历附件")) return;

  const createResponse = await fetch(fieldsUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({ field_name: "简历附件", type: 17 })
  });
  const createResult = await createResponse.json();
  if (!createResponse.ok || createResult.code) throw new Error("Failed to create resume attachment field");
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
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
