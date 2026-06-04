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

test("buildFeishuPayload returns one candidate and twelve round results", async () => {
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
  assert.equal(payload.rounds.length, 12);
  assert.equal(payload.rounds[0]["游戏名称"], "边界雷达");
  assert.equal(payload.rounds[0]["候选人选择"], "候选人选择");
});

