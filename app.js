const $ = (id) => document.getElementById(id);
const RESULT_STORAGE_KEY = "aiSense.latestResult.v2";
const RESULT_HISTORY_KEY = "aiSense.resultHistory.v2";
const FEISHU_ENDPOINT = window.AI_SENSE_FEISHU_ENDPOINT || "";
const FEISHU_AUTO_SUBMIT = window.AI_SENSE_FEISHU_AUTO_SUBMIT !== false;

const state = {
  stage: 0,
  scores: { boundary: 0, prompt: 0, verification: 0, workflow: 0 },
  answers: {},
  selections: []
};

const dimensions = {
  boundary: { name: "模型边界", short: "边界", description: "知道哪些任务可交给 AI，哪些必须保留人工责任。" },
  prompt: { name: "任务拆解", short: "拆解", description: "能把模糊需求转成目标、标准、约束和输出格式。" },
  verification: { name: "验证意识", short: "查错", description: "会检查证据、事实和结论，不被流畅表达迷惑。" },
  workflow: { name: "Agent 工作流", short: "流程", description: "能设计可靠、可复核、可接管的 AI 任务链路。" }
};

const games = [
  {
    id: "boundary",
    code: "BOUNDARY",
    title: "边界雷达",
    question: "哪些任务可以直接交给 AI，哪些需要人审，哪些不应让 AI 直接决定？",
    instruction: "依次点击每张任务卡，为它选择最合适的处理方式。",
    type: "classify",
    categories: ["可交给 AI", "需要人审", "不应直接决定"],
    cards: [
      ["总结一篇公开新闻", "可交给 AI"],
      ["生成客服回复草稿", "需要人审"],
      ["判断候选人是否有心理疾病", "不应直接决定"],
      ["从会议记录中提取待办", "可交给 AI"],
      ["决定员工是否应该被淘汰", "不应直接决定"],
      ["生成合同风险提示", "需要人审"]
    ]
  },
  {
    id: "prompt",
    code: "PROMPT",
    title: "Prompt 装配台",
    question: "任务是：让 AI 判断一名候选人是否适合 AI 产品岗位。",
    instruction: "从零件中选出最重要的 4 个，装成一个可靠的任务说明。",
    type: "select",
    limit: 4,
    correct: ["明确目标", "提供候选人背景", "给出判断标准", "规定输出格式"],
    options: ["明确目标", "提供候选人背景", "给出判断标准", "规定输出格式", "要求像顶级专家", "语气必须激动", "越短越好", "直接给录用结论"]
  },
  {
    id: "verification",
    code: "VERIFY",
    title: "幻觉排雷",
    question: "这段 AI 分析看起来很专业，但里面藏着 3 个不可靠的结论。",
    instruction: "点击你认为有问题的句子。",
    type: "select",
    limit: 3,
    correct: ["候选人负责过大模型训练。", "候选人非常适合算法研究岗。", "候选人一定能适应创业公司。"],
    options: [
      "候选人曾参与 AI 产品调研。",
      "候选人负责过大模型训练。",
      "候选人非常适合算法研究岗。",
      "候选人有较强的用户访谈经验。",
      "候选人一定能适应创业公司。",
      "建议进一步验证其技术深度。"
    ]
  },
  {
    id: "workflow",
    code: "AGENT",
    title: "Agent 路线规划",
    question: "目标：从 50 份简历中筛出 10 名有 AI Sense 的候选人。",
    instruction: "按你认为可靠的执行顺序，依次点击 5 个步骤。",
    type: "order",
    correct: ["定义评分维度", "结构化提取简历信息", "AI 初筛并记录理由", "人工复核边界案例", "输出推荐名单与证据"],
    options: ["定义评分维度", "直接让 AI 给最终名单", "结构化提取简历信息", "AI 初筛并记录理由", "只看学校与公司", "人工复核边界案例", "输出推荐名单与证据"]
  }
];

const badges = [
  { id: "GENERALIST", code: "FULL", name: "AI 全栈探索者", dimension: "all", tagline: "你不只会用 AI，还能在边界、拆解、验证和流程之间保持平衡。" },
  { id: "RADAR", code: "RADAR", name: "模型雷达", dimension: "boundary", tagline: "你知道 AI 什么时候值得信，也知道什么时候必须停下来。" },
  { id: "ARCHITECT", code: "PROMPT", name: "任务架构师", dimension: "prompt", tagline: "你擅长把模糊问题拆成 AI 真正能执行的任务。" },
  { id: "AUDITOR", code: "CHECK", name: "真相审计员", dimension: "verification", tagline: "你不会被流畅答案带走，总会回到事实和证据。" },
  { id: "COMMANDER", code: "AGENT", name: "Agent 指挥官", dimension: "workflow", tagline: "你会把 AI 放进可靠的工作流，而不是只让它聊得漂亮。" },
  { id: "OBSERVER", code: "LEVEL", name: "AI 观察员", dimension: "none", tagline: "你的 AI Sense 已经启动，下一步是把直觉变成更稳定的方法。" }
];

const careerMap = {
  boundary: { roles: "模型评测 / AI QA / 风险治理", companies: "模型公司、评测平台、AI 安全团队" },
  prompt: { roles: "AI 产品经理 / 解决方案 / Prompt 设计", companies: "AI 应用公司、企业服务、行业解决方案团队" },
  verification: { roles: "模型评测 / 数据策略 / AI 研究运营", companies: "大模型公司、数据智能、研究型 AI 公司" },
  workflow: { roles: "Agent 产品经理 / 自动化方案 / AI 交付", companies: "Agent 公司、企业 AI、流程自动化团队" }
};

function show(id) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  $(id).classList.add("active");
}

function reset() {
  state.stage = 0;
  state.scores = { boundary: 0, prompt: 0, verification: 0, workflow: 0 };
  state.answers = {};
  state.selections = [];
}

function start() {
  reset();
  show("game");
  renderGame();
}

function renderGame() {
  const game = games[state.stage];
  state.selections = [];
  $("hudStage").textContent = game.title;
  $("hudProgress").textContent = `${state.stage} / 4`;
  $("gameKicker").textContent = `关卡 ${state.stage + 1} / 4`;
  $("gameTitle").textContent = game.title;
  $("gameCode").textContent = game.code;
  $("gameQuestion").textContent = game.question;
  $("gameInstruction").textContent = game.instruction;
  $("gameFeedback").textContent = "完成操作后提交。";
  $("gameFeedback").className = "";
  $("gameBar").style.width = `${(state.stage / games.length) * 100}%`;
  $("submitGameBtn").disabled = false;
  const area = $("gameArea");
  area.innerHTML = "";
  if (game.type === "classify") renderClassify(game, area);
  if (game.type === "select") renderSelect(game, area);
  if (game.type === "order") renderOrder(game, area);
}

function renderClassify(game, area) {
  const grid = document.createElement("div");
  grid.className = "classify-grid";
  game.cards.forEach(([text]) => {
    const card = document.createElement("div");
    card.className = "task-card";
    card.innerHTML = `<strong>${text}</strong><div class="category-buttons"></div>`;
    game.categories.forEach((category) => {
      const button = document.createElement("button");
      button.textContent = category;
      button.onclick = () => {
        card.querySelectorAll("button").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
        const existing = state.selections.find((item) => item.text === text);
        if (existing) existing.choice = category;
        else state.selections.push({ text, choice: category });
      };
      card.querySelector(".category-buttons").appendChild(button);
    });
    grid.appendChild(card);
  });
  area.appendChild(grid);
}

function renderSelect(game, area) {
  const grid = document.createElement("div");
  grid.className = game.id === "verification" ? "statement-grid" : "component-grid";
  game.options.forEach((text) => {
    const button = document.createElement("button");
    button.className = game.id === "verification" ? "statement-card" : "component-card";
    button.innerHTML = `<span>${game.id === "verification" ? "分析片段" : "PROMPT 零件"}</span><strong>${text}</strong>`;
    button.onclick = () => toggleSelection(button, text, game.limit);
    grid.appendChild(button);
  });
  area.appendChild(grid);
}

function renderOrder(game, area) {
  const layout = document.createElement("div");
  layout.className = "workflow-layout";
  layout.innerHTML = `<div class="workflow-pool"></div><div class="workflow-route"><p>你的执行路线</p><ol id="routeList"></ol></div>`;
  game.options.forEach((text) => {
    const button = document.createElement("button");
    button.className = "workflow-step";
    button.textContent = text;
    button.onclick = () => {
      if (button.classList.contains("selected") || state.selections.length >= 5) return;
      button.classList.add("selected");
      state.selections.push(text);
      renderRoute();
    };
    layout.querySelector(".workflow-pool").appendChild(button);
  });
  area.appendChild(layout);
}

function renderRoute() {
  $("routeList").innerHTML = state.selections.map((text) => `<li>${text}</li>`).join("");
}

function toggleSelection(button, text, limit) {
  const index = state.selections.indexOf(text);
  if (index >= 0) {
    state.selections.splice(index, 1);
    button.classList.remove("selected");
    return;
  }
  if (state.selections.length >= limit) return;
  state.selections.push(text);
  button.classList.add("selected");
}

function submitGame() {
  const game = games[state.stage];
  let score = 0;
  let evidence = "";
  if (game.type === "classify") {
    if (state.selections.length < game.cards.length) return feedback("请先为每张任务卡完成分类。", false);
    const correct = game.cards.filter(([text, answer]) => state.selections.find((item) => item.text === text)?.choice === answer).length;
    score = Math.round((correct / game.cards.length) * 100);
    evidence = `正确分类 ${correct}/${game.cards.length}`;
  } else if (game.type === "select") {
    if (state.selections.length < game.limit) return feedback(`请选择 ${game.limit} 项后再提交。`, false);
    const correct = state.selections.filter((item) => game.correct.includes(item)).length;
    score = Math.round((correct / game.correct.length) * 100);
    evidence = `命中关键项 ${correct}/${game.correct.length}：${state.selections.join("、")}`;
  } else {
    if (state.selections.length < 5) return feedback("请先完成 5 步执行路线。", false);
    const positionHits = state.selections.filter((item, index) => item === game.correct[index]).length;
    const contentHits = state.selections.filter((item) => game.correct.includes(item)).length;
    score = Math.round((positionHits * 12 + contentHits * 8));
    evidence = `步骤命中 ${contentHits}/5，顺序命中 ${positionHits}/5：${state.selections.join(" → ")}`;
  }
  state.scores[game.id] = Math.min(100, score);
  state.answers[game.id] = evidence;
  feedback(score >= 80 ? "判断很稳，这一关证明了你的能力。" : score >= 60 ? "有不错的直觉，但还有一个关键点可以更严谨。" : "这一关暴露了一个值得继续训练的盲区。", true);
  $("submitGameBtn").disabled = true;
  setTimeout(() => {
    state.stage += 1;
    if (state.stage >= games.length) renderResults();
    else renderGame();
  }, 700);
}

function feedback(text, ok) {
  $("gameFeedback").textContent = text;
  $("gameFeedback").className = ok ? "ok" : "warn";
}

function metrics() {
  const values = Object.values(state.scores);
  const total = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const min = Math.min(...values);
  const top = Object.entries(state.scores).sort((a, b) => b[1] - a[1])[0][0];
  return { total, min, top };
}

function recommendationStatus() {
  const m = metrics();
  if (m.total >= 80 && m.min >= 60) return { level: "YES", title: "强推荐进入候选池", reason: "四项 AI Sense 能力稳定，没有明显短板。" };
  if (m.total >= 68 && m.min >= 45) return { level: "CAUTION", title: "可推荐，建议二面验证", reason: "已经形成 AI Sense 优势，但仍有一个环节需要验证。" };
  return { level: "NO", title: "暂不推荐进入候选池", reason: "当前行为证据不足，AI 能力还没有稳定形成闭环。" };
}

function resolveBadge() {
  const m = metrics();
  if (m.total < 55) return badges.find((badge) => badge.id === "OBSERVER");
  const values = Object.values(state.scores);
  if (m.total >= 82 && Math.max(...values) - Math.min(...values) <= 25) return badges.find((badge) => badge.id === "GENERALIST");
  return badges.find((badge) => badge.dimension === m.top);
}

function careerRecommendation() {
  const status = recommendationStatus();
  if (status.level === "NO") return { roles: "暂不推荐岗位匹配", companies: "暂不推荐公司匹配" };
  if (resolveBadge().id === "GENERALIST") {
    return { roles: "AI 产品经理 / Agent 产品经理 / AI 解决方案", companies: "综合型 AI 公司、Agent 公司、企业 AI 团队" };
  }
  return careerMap[metrics().top];
}

function recommendationLabel(level) {
  if (level === "YES") return "强推荐";
  if (level === "CAUTION") return "可推荐";
  return "不推荐";
}

function buildFeishuRecord() {
  const badge = resolveBadge();
  const status = recommendationStatus();
  const career = careerRecommendation();
  const m = metrics();
  return {
    "是否值得推荐": recommendationLabel(status.level),
    "推荐公司": career.companies,
    "适合岗位": career.roles,
    "AI Sense 身份": badge.name,
    "AI Sense 分数": m.total,
    "模型边界": state.scores.boundary,
    "任务拆解": state.scores.prompt,
    "验证意识": state.scores.verification,
    "Agent 工作流": state.scores.workflow,
    "严格结论": status.reason,
    "关键证据": Object.entries(state.answers).map(([key, value]) => `${dimensions[key].name}: ${value}`).join("\n")
  };
}

function snapshotState() {
  return {
    id: `AIS-${Date.now().toString(36).toUpperCase()}`,
    savedAt: new Date().toISOString(),
    scores: { ...state.scores },
    answers: { ...state.answers },
    feishuRecord: buildFeishuRecord()
  };
}

function saveResultSnapshot() {
  const snapshot = snapshotState();
  try {
    const history = JSON.parse(localStorage.getItem(RESULT_HISTORY_KEY) || "[]");
    localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(snapshot));
    localStorage.setItem(RESULT_HISTORY_KEY, JSON.stringify([snapshot, ...history].slice(0, 20)));
  } catch {
    // The in-memory result still works when local storage is unavailable.
  }
  return snapshot;
}

function restoreSnapshot(snapshot) {
  if (!snapshot?.scores || !snapshot?.answers) return false;
  state.scores = { ...state.scores, ...snapshot.scores };
  state.answers = { ...snapshot.answers };
  state.stage = games.length;
  return true;
}

function loadLatestStoredResult() {
  try {
    return restoreSnapshot(JSON.parse(localStorage.getItem(RESULT_STORAGE_KEY) || "null"));
  } catch {
    return false;
  }
}

async function submitFeishuRecord(snapshot) {
  const note = $("feishuSyncNote");
  const record = { ...snapshot.feishuRecord, "候选人编号": snapshot.id, "测评时间": snapshot.savedAt };
  if (!FEISHU_ENDPOINT) {
    note.textContent = "测试结果已生成。投递简历后，我们会结合结果一起查看。";
    return;
  }
  note.textContent = "测试结果正在同步。";
  try {
    const response = await fetch(FEISHU_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: record, source: "ai-sense-test" })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    note.textContent = "测试结果已同步。";
  } catch {
    note.textContent = "测试结果已生成，同步稍后重试。";
  }
}

function renderResults() {
  const snapshot = saveResultSnapshot();
  const badge = resolveBadge();
  const status = recommendationStatus();
  const m = metrics();
  $("hudStage").textContent = "已完成";
  $("hudBadge").textContent = badge.name;
  $("hudProgress").textContent = "4 / 4";
  $("gameBar").style.width = "100%";
  $("finalMedal").textContent = badge.code;
  $("resultTitle").textContent = `我是「${badge.name}」`;
  $("resultTagline").textContent = badge.tagline;
  $("publicStats").innerHTML = `<span>AI Sense ${m.total}</span><span>${m.total >= 80 ? "高阶通关" : m.total >= 60 ? "进阶通关" : "完成挑战"}</span>`;
  $("shareText").textContent = `我在 4 个小游戏里测出了「${badge.name}」AI Sense 身份：${badge.tagline}`;
  renderAdmin();
  show("result");
  if (FEISHU_AUTO_SUBMIT) submitFeishuRecord(snapshot);
}

function renderAdmin() {
  const badge = resolveBadge();
  const status = recommendationStatus();
  const career = careerRecommendation();
  const m = metrics();
  $("adminSource").textContent = "数据来源：候选人在 4 个精简游戏中的实际操作，而不是自我评价。";
  $("adminVerdict").className = `verdict ${status.level.toLowerCase()}`;
  $("adminVerdict").innerHTML = `<strong>${status.title}</strong><span>${status.reason}</span><em>严格线：平均分 ≥ 80，且单项不得低于 60。</em>`;
  $("metricGrid").innerHTML = Object.entries(state.scores)
    .map(([key, value]) => `<div><span>${dimensions[key].name}</span><strong>${value}</strong><em>${dimensions[key].description}</em></div>`)
    .concat([`<div><span>AI Sense 总分</span><strong>${m.total}</strong><em>四项能力平均分</em></div>`])
    .join("");
  $("companyMatches").innerHTML = `<div class="company"><strong>${career.roles}</strong><span>${career.companies}</span><i><b style="width:${m.total}%"></b></i><em>主优势：${dimensions[m.top].name}</em></div>`;
  const record = buildFeishuRecord();
  $("feishuFields").innerHTML = ["是否值得推荐", "推荐公司", "适合岗位"]
    .map((key) => `<div><span>${key}</span><strong>${record[key]}</strong></div>`)
    .join("");
  $("badgeCatalog").innerHTML = badges.map((item) => `<div class="${item.id === badge.id ? "active" : ""}"><strong>${item.name}</strong><span>${item.dimension === "all" ? "四项均衡高分" : item.dimension === "none" ? "总分不足 55" : `${dimensions[item.dimension].name}最高分`}</span></div>`).join("");
  $("adminEvidence").innerHTML = games.map((game) => `<div class="evidence-row"><strong>${game.title}</strong><span>${state.answers[game.id] || "暂无记录"}</span></div>`).join("");
}

function renderPendingAdmin() {
  $("adminSource").textContent = "暂无完整记录：请先让候选人在本浏览器完成 4 个小游戏。";
  $("adminVerdict").className = "verdict caution";
  $("adminVerdict").innerHTML = "<strong>等待候选人完成测试</strong><span>完成后将生成严格筛选结论。</span><em>进度要求：4 / 4 个游戏完成。</em>";
  $("metricGrid").innerHTML = Object.values(dimensions).map((item) => `<div><span>${item.name}</span><strong>待测</strong><em>${item.description}</em></div>`).join("");
  $("companyMatches").innerHTML = `<div class="no-match">暂无岗位与公司推荐。</div>`;
  $("feishuFields").innerHTML = ["是否值得推荐", "推荐公司", "适合岗位"].map((key) => `<div><span>${key}</span><strong>等待完整测试</strong></div>`).join("");
  $("badgeCatalog").innerHTML = badges.map((item) => `<div><strong>${item.name}</strong><span>${item.tagline}</span></div>`).join("");
  $("adminEvidence").innerHTML = `<div class="evidence-row"><strong>暂无行为证据</strong><span>完成游戏后自动记录。</span></div>`;
}

function openRecruiterView() {
  if (state.stage < games.length) loadLatestStoredResult();
  if (state.stage >= games.length) renderAdmin();
  else renderPendingAdmin();
  $("openRecruiterTopBtn").classList.add("hidden");
  show("recruiter");
}

function setupResumeUpload() {
  const input = $("resumeFile");
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    $("resumeNote").textContent = `已选择：${file.name}。点击下方按钮后，请在邮件中附上这份简历。`;
    const body = encodeURIComponent(`你好，我完成了 AI Sense 测试。\n\n我的身份：${resolveBadge().name}\n简历附件：${file.name}`);
    $("resumeMailLink").href = `mailto:talent@example.com?subject=AI%20Sense%20简历投递&body=${body}`;
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const isRecruiterMode = new URLSearchParams(window.location.search).get("recruiter") === "1";
  if (isRecruiterMode) document.body.classList.add("recruiter-mode");
  $("startBtn").onclick = start;
  $("submitGameBtn").onclick = submitGame;
  $("restartBtn").onclick = start;
  $("openRecruiterBtn").onclick = openRecruiterView;
  $("openRecruiterTopBtn").onclick = openRecruiterView;
  $("backResultBtn").onclick = () => {
    $("openRecruiterTopBtn").classList.remove("hidden");
    show(state.stage >= games.length ? "result" : "home");
  };
  $("copyShareBtn").onclick = async () => {
    await navigator.clipboard.writeText($("shareText").textContent);
    $("copyShareBtn").textContent = "已复制";
    setTimeout(() => ($("copyShareBtn").textContent = "复制分享文案"), 1200);
  };
  setupResumeUpload();
  if (isRecruiterMode) openRecruiterView();
});
