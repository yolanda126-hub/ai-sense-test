import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

async function loadApp() {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const context = vm.createContext({
    console,
    structuredClone,
    setTimeout() {},
    window: {
      AI_SENSE_FEISHU_ENDPOINT: "",
      AI_SENSE_FEISHU_AUTO_SUBMIT: true,
      location: { search: "" }
    },
    document: {
      addEventListener() {},
      getElementById() {
        return {};
      },
      querySelectorAll() {
        return [];
      }
    }
  });
  vm.runInContext(source, context);
  return context;
}

test("buildFeishuPayload returns one candidate and fourteen round results", async () => {
  const context = await loadApp();
  const state = vm.runInContext("state", context);
  const games = vm.runInContext("games", context);

  state.scores = { boundary: 90, prompt: 80, verification: 85, workflow: 88 };
  state.roundScores = {
    boundary: [100, 75, 95],
    prompt: [75, 80, 85],
    verification: [100, 75, 80],
    workflow: [84, 88, 92]
  };
  state.answers = {
    boundary: ["a", "b", "c"],
    prompt: ["a", "b", "c"],
    verification: ["a", "b", "c"],
    workflow: ["a", "b", "c"]
  };
  state.roundResults = games.flatMap((game) =>
    game.rounds.map((round, index) => ({
      gameId: game.id,
      gameName: game.title,
      dimension: game.id,
      roundNumber: index + 1,
      scenario: round.question,
      type: round.type,
      selections: ["候选人选择"],
      correctAnswer: ["正确答案"],
      score: 80,
      isCritical: Boolean(round.critical?.length),
      riskTriggered: false,
      evidence: "行为证据"
    }))
  );

  const snapshot = vm.runInContext("snapshotState()", context);
  const payload = vm.runInContext("buildFeishuPayload", context)(snapshot);

  assert.equal(payload.source, "ai-sense-test");
  assert.equal(payload.candidate["候选人编号"], snapshot.id);
  assert.equal(vm.runInContext("totalRounds()", context), 14);
  assert.equal(payload.rounds.length, 14);
  assert.equal(payload.rounds[0]["游戏名称"], "边界雷达");
  assert.equal(payload.rounds[0]["候选人选择"], "候选人选择");
});

test("scoreSpeedRound rewards fast correct taps and penalizes risky taps", async () => {
  const context = await loadApp();
  const scoreSpeedRound = vm.runInContext("scoreSpeedRound", context);
  const round = {
    targets: ["总结公开材料", "提取会议待办", "改写普通文案"],
    traps: ["决定患者是否停药", "判断候选人心理疾病"]
  };

  assert.equal(scoreSpeedRound(round, [
    { text: "总结公开材料", reactionMs: 520 },
    { text: "提取会议待办", reactionMs: 760 },
    { text: "改写普通文案", reactionMs: 980 }
  ]).score, 100);

  const risky = scoreSpeedRound(round, [
    { text: "总结公开材料", reactionMs: 520 },
    { text: "决定患者是否停药", reactionMs: 620 }
  ]);
  assert.equal(risky.riskTriggered, true);
  assert.ok(risky.score < 60);
});

test("scoreFlashRound checks remembered evidence without rewarding hallucinated details", async () => {
  const context = await loadApp();
  const scoreFlashRound = vm.runInContext("scoreFlashRound", context);
  const round = {
    correct: ["上线前做过 A/B 测试", "引用了用户访谈原文", "没有提到模型训练经验"],
    traps: ["负责过大模型训练", "已经证明商业模式跑通"]
  };

  assert.equal(scoreFlashRound(round, [
    "上线前做过 A/B 测试",
    "引用了用户访谈原文",
    "没有提到模型训练经验"
  ]).score, 100);

  const hallucinated = scoreFlashRound(round, [
    "上线前做过 A/B 测试",
    "负责过大模型训练",
    "已经证明商业模式跑通"
  ]);
  assert.equal(hallucinated.riskTriggered, true);
  assert.equal(hallucinated.score, 20);
});

test("buildResumePayload attaches a selected resume to the Feishu candidate record", async () => {
  const context = await loadApp();
  const payload = vm.runInContext("buildResumePayload", context)(
    { id: "AIS-123", feishuCandidateRecordId: "rec-1" },
    { name: "resume.pdf", type: "application/pdf", size: 1234 },
    "base64-file"
  );

  assert.equal(payload.source, "ai-sense-test");
  assert.equal(payload.resume.candidateId, "AIS-123");
  assert.equal(payload.resume.candidateRecordId, "rec-1");
  assert.equal(payload.resume.fileName, "resume.pdf");
  assert.equal(payload.resume.dataBase64, "base64-file");
});

test("validateResumeFile blocks unsupported or oversized files", async () => {
  const context = await loadApp();
  const validateResumeFile = vm.runInContext("validateResumeFile", context);
  assert.equal(validateResumeFile({ name: "resume.pdf", size: 1024 }), "");
  assert.match(validateResumeFile({ name: "resume.png", size: 1024 }), /仅支持/);
  assert.match(validateResumeFile({ name: "resume.pdf", size: 20 * 1024 * 1024 + 1 }), /20MB/);
});
