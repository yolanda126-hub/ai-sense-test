export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return corsResponse();
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const payload = await request.json();
    const fields = payload.fields || {};
    const required = ["是否值得推荐", "推荐公司", "适合岗位"];
    const missing = required.filter((key) => !fields[key]);
    if (missing.length) return json({ error: `Missing fields: ${missing.join(", ")}` }, 400);
    const coreFields = Object.fromEntries(required.map((key) => [key, fields[key]]));

    const token = await getTenantAccessToken(env);
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${env.FEISHU_APP_TOKEN}/tables/${env.FEISHU_TABLE_ID}/records`;
    const feishuResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({ fields: coreFields })
    });

    const result = await feishuResponse.json();
    if (!feishuResponse.ok || result.code) return json({ error: result }, 502);
    return json({ ok: true, record: result.data && result.data.record });
  }
};

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
