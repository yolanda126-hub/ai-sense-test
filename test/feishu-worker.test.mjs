import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function loadWorker() {
  const source = await readFile(new URL("../feishu-worker.example.js", import.meta.url), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

function request(body) {
  return new Request("https://worker.example.test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

const env = {
  FEISHU_APP_ID: "app-id",
  FEISHU_APP_SECRET: "app-secret",
  FEISHU_APP_TOKEN: "app-token",
  FEISHU_CANDIDATE_TABLE_ID: "candidate-table",
  FEISHU_ROUND_TABLE_ID: "round-table"
};

test("worker rejects payloads without twelve round records", async () => {
  const { default: worker } = await loadWorker();
  const response = await worker.fetch(request({
    candidate: {
      "候选人编号": "AIS-123",
      "测评时间": "2026-06-04T00:00:00.000Z",
      "是否值得推荐": "强推荐",
      "推荐公司": "Agent 公司",
      "适合岗位": "Agent 产品经理"
    },
    rounds: []
  }), env);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /12/);
});

test("worker creates one whitelisted candidate record and twelve round records", async () => {
  const { default: worker } = await loadWorker();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: options?.body ? JSON.parse(options.body) : null });
    if (String(url).includes("tenant_access_token")) {
      return Response.json({ code: 0, tenant_access_token: "token" });
    }
    if (String(url).endsWith("/records")) {
      return Response.json({ code: 0, data: { record: { record_id: "rec-1" } } });
    }
    return Response.json({ code: 0, data: { records: [] } });
  };

  try {
    const candidate = {
      "候选人编号": "AIS-123",
      "测评时间": "2026-06-04T00:00:00.000Z",
      "是否值得推荐": "强推荐",
      "推荐公司": "Agent 公司",
      "适合岗位": "Agent 产品经理",
      "不允许字段": "不应写入"
    };
    const rounds = Array.from({ length: 12 }, (_, index) => ({
      "候选人编号": "AIS-123",
      "游戏名称": "边界雷达",
      "能力维度": "模型边界",
      "回合编号": index + 1,
      "场景名称": `场景 ${index + 1}`,
      "题目类型": "classify",
      "候选人选择": "选择",
      "正确答案": "答案",
      "回合得分": 100,
      "是否高风险题": "否",
      "是否触发风险": "否",
      "行为证据": "证据",
      "不允许字段": "不应写入"
    }));

    const response = await worker.fetch(request({ candidate, rounds, source: "ai-sense-test" }), env);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 3);
    assert.equal(calls[1].url.includes("/candidate-table/records"), true);
    assert.equal(calls[2].url.includes("/round-table/records/batch_create"), true);
    assert.equal(calls[1].body.fields["不允许字段"], undefined);
    assert.equal(calls[2].body.records.length, 12);
    assert.equal(calls[2].body.records[0].fields["不允许字段"], undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("worker uploads a resume and attaches it to the existing candidate record", async () => {
  const { default: worker } = await loadWorker();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), method: options?.method, body: options?.body });
    if (String(url).includes("tenant_access_token")) {
      return Response.json({ code: 0, tenant_access_token: "token" });
    }
    if (String(url).includes("/drive/v1/medias/upload_all")) {
      assert.equal(options.body instanceof FormData, true);
      return Response.json({ code: 0, data: { file_token: "file-token-1" } });
    }
    if (String(url).endsWith("/fields") && options?.method !== "POST") {
      return Response.json({ code: 0, data: { items: [] } });
    }
    if (String(url).endsWith("/fields") && options?.method === "POST") {
      return Response.json({ code: 0, data: { field: { field_name: "简历附件" } } });
    }
    return Response.json({ code: 0, data: { record: { record_id: "rec-1" } } });
  };

  try {
    const response = await worker.fetch(request({
      resume: {
        candidateRecordId: "rec-1",
        fileName: "resume.pdf",
        mimeType: "application/pdf",
        size: 5,
        dataBase64: Buffer.from("hello").toString("base64")
      }
    }), env);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 5);
    assert.equal(calls[1].url.includes("/drive/v1/medias/upload_all"), true);
    assert.equal(calls[2].url.endsWith("/candidate-table/fields"), true);
    assert.equal(calls[3].method, "POST");
    assert.deepEqual(JSON.parse(calls[3].body), { field_name: "简历附件", type: 17 });
    assert.equal(calls[4].method, "PUT");
    assert.equal(calls[4].url.endsWith("/candidate-table/records/rec-1"), true);
    assert.deepEqual(JSON.parse(calls[4].body).fields["简历附件"], [{ file_token: "file-token-1" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("worker rejects oversized resume uploads", async () => {
  const { default: worker } = await loadWorker();
  const response = await worker.fetch(request({
    resume: {
      candidateRecordId: "rec-1",
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      size: 20 * 1024 * 1024 + 1,
      dataBase64: "AA=="
    }
  }), env);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /20 MB/);
});
