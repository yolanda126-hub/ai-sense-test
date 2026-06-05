import assert from "node:assert/strict";
import test from "node:test";
import { CANDIDATE_FIELDS, ROUND_FIELDS, RULE_FIELDS } from "../scripts/setup-feishu.mjs";

test("Feishu schema includes every candidate field written by the proxy", () => {
  const names = CANDIDATE_FIELDS.map((field) => field.field_name);
  for (const required of ["候选人编号", "测评时间", "是否值得推荐", "推荐公司", "适合岗位", "AI Sense 分数", "风险底线", "简历附件"]) {
    assert.equal(names.includes(required), true, `missing ${required}`);
  }
  assert.equal(CANDIDATE_FIELDS.find((field) => field.field_name === "简历附件")?.type, 17);
});

test("Feishu schema defines twelve-round evidence and matching rules", () => {
  const roundNames = ROUND_FIELDS.map((field) => field.field_name);
  const ruleNames = RULE_FIELDS.map((field) => field.field_name);
  assert.equal(roundNames.includes("候选人选择"), true);
  assert.equal(roundNames.includes("是否触发风险"), true);
  assert.equal(ruleNames.includes("推荐公司"), true);
  assert.equal(ruleNames.includes("适合岗位"), true);
});
