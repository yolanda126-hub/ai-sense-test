const $ = (id) => document.getElementById(id);
const RESULT_STORAGE_KEY = "aiSense.latestResult.v3";
const RESULT_HISTORY_KEY = "aiSense.resultHistory.v3";
const FEISHU_ENDPOINT = window.AI_SENSE_FEISHU_ENDPOINT || "";
const FEISHU_AUTO_SUBMIT = window.AI_SENSE_FEISHU_AUTO_SUBMIT !== false;
const MAX_RESUME_BYTES = 20 * 1024 * 1024;
const RESUME_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt"]);

let latestResultSnapshot = null;
let feishuSubmitPromise = null;

const state = {
  stage: 0,
  round: 0,
  scores: { boundary: 0, prompt: 0, verification: 0, workflow: 0 },
  roundScores: { boundary: [], prompt: [], verification: [], workflow: [] },
  answers: { boundary: [], prompt: [], verification: [], workflow: [] },
  roundResults: [],
  selections: [],
  riskFailures: []
};

const dimensions = {
  boundary: { name: "模型边界", description: "知道哪些任务可交给 AI，哪些必须保留人工责任。" },
  prompt: { name: "任务拆解", description: "能把模糊需求转成目标、标准、约束和输出格式。" },
  verification: { name: "验证意识", description: "会检查证据、事实和结论，不被流畅表达迷惑。" },
  workflow: { name: "Agent 工作流", description: "能设计可靠、可复核、可接管的 AI 任务链路。" }
};

const games = [
  {
    id: "boundary",
    code: "BOUNDARY",
    title: "边界雷达",
    categories: ["可交给 AI", "需要人审", "不应直接决定"],
    rounds: [
      {
        question: "日常工作里，哪些任务适合交给 AI？",
        instruction: "为每张任务卡选择最合适的处理方式。",
        type: "classify",
        cards: [
          ["总结一篇公开新闻", "可交给 AI"],
          ["生成客服回复草稿", "需要人审"],
          ["从会议记录中提取待办", "可交给 AI"],
          ["生成合同风险提示", "需要人审"]
        ]
      },
      {
        question: "专业工作里，AI 应该承担到哪一步？",
        instruction: "判断哪些任务需要专业人员复核。",
        type: "classify",
        cards: [
          ["根据代码报错生成排查建议", "需要人审"],
          ["为公开商品描述生成初稿", "可交给 AI"],
          ["根据财务数据生成投资建议", "需要人审"],
          ["自动整理公开行业资料", "可交给 AI"]
        ]
      },
      {
        question: "高风险决策里，哪些责任不能交给 AI？",
        instruction: "这一回合会检查你的风险底线。",
        type: "classify",
        cards: [
          ["判断候选人是否有心理疾病", "不应直接决定"],
          ["决定员工是否应该被淘汰", "不应直接决定"],
          ["根据症状决定患者是否停药", "不应直接决定"],
          ["为招聘面试生成问题草稿", "需要人审"]
        ],
        critical: ["判断候选人是否有心理疾病", "决定员工是否应该被淘汰", "根据症状决定患者是否停药"]
      }
    ]
  },
  {
    id: "prompt",
    code: "PROMPT",
    title: "Prompt 装配台",
    rounds: [
      {
        question: "任务：让 AI 判断一名候选人是否适合 AI 产品岗位。",
        instruction: "选出最重要的 4 个任务零件。",
        type: "select",
        limit: 4,
        correct: ["明确目标", "提供候选人背景", "给出判断标准", "规定输出格式"],
        options: ["明确目标", "提供候选人背景", "给出判断标准", "规定输出格式", "要求像顶级专家", "语气必须激动", "越短越好", "直接给录用结论"]
      },
      {
        question: "任务：让 AI 从 200 条用户反馈中找出产品问题。",
        instruction: "选出最重要的 4 个任务零件。",
        type: "select",
        limit: 4,
        correct: ["说明反馈来源", "定义问题分类", "要求引用原文", "输出优先级"],
        options: ["说明反馈来源", "定义问题分类", "要求引用原文", "输出优先级", "只找负面反馈", "模仿产品经理语气", "不要解释", "直接给最终结论"]
      },
      {
        question: "任务：让 AI 生成一份可上线的客服知识库回答。",
        instruction: "选出最重要的 4 个任务零件。",
        type: "select",
        limit: 4,
        correct: ["提供知识库原文", "限定不可编造", "定义适用用户", "规定无法回答时的处理"],
        options: ["提供知识库原文", "限定不可编造", "定义适用用户", "规定无法回答时的处理", "要求文风活泼", "尽量显得自信", "禁止说不知道", "回答越长越好"]
      }
    ]
  },
  {
    id: "verification",
    code: "VERIFY",
    title: "幻觉排雷",
    rounds: [
      {
        question: "候选人分析里藏着 3 个不可靠的结论。",
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
        question: "公司研究报告里藏着 3 个证据跳跃。",
        instruction: "点击你认为不能由现有信息推出的句子。",
        type: "select",
        limit: 3,
        correct: ["该公司已经成为行业第一。", "用户增长证明其商业模式已经跑通。", "团队一定拥有独家模型能力。"],
        options: [
          "该公司最近三个月用户增长较快。",
          "该公司已经成为行业第一。",
          "用户增长证明其商业模式已经跑通。",
          "报告尚未提供续费率数据。",
          "团队一定拥有独家模型能力。",
          "建议补充客户留存与毛利数据。"
        ]
      },
      {
        question: "医疗建议里藏着 3 个危险结论。",
        instruction: "这一回合会检查你的风险底线。",
        type: "select",
        limit: 3,
        correct: ["该患者可以立刻停药。", "这些症状证明患者没有严重疾病。", "无需再咨询医生。"],
        options: [
          "患者描述了近期的头晕症状。",
          "该患者可以立刻停药。",
          "这些症状证明患者没有严重疾病。",
          "建议记录症状发生时间。",
          "无需再咨询医生。",
          "需要由专业医生进一步判断。"
        ],
        critical: ["该患者可以立刻停药。", "无需再咨询医生。"]
      }
    ]
  },
  {
    id: "workflow",
    code: "AGENT",
    title: "Agent 路线规划",
    rounds: [
      {
        question: "目标：从 50 份简历中筛出 10 名有 AI Sense 的候选人。",
        instruction: "按可靠的执行顺序，依次点击 5 个步骤。",
        type: "order",
        correct: ["定义评分维度", "结构化提取简历信息", "AI 初筛并记录理由", "人工复核边界案例", "输出推荐名单与证据"],
        options: ["定义评分维度", "直接让 AI 给最终名单", "结构化提取简历信息", "AI 初筛并记录理由", "只看学校与公司", "人工复核边界案例", "输出推荐名单与证据"]
      },
      {
        question: "目标：让 AI 处理客户咨询，但不能编造产品能力。",
        instruction: "按可靠的执行顺序，依次点击 5 个步骤。",
        type: "order",
        correct: ["接入可信知识库", "识别用户问题类型", "生成带引用的回答", "低置信度转人工", "记录失败问题并更新知识库"],
        options: ["接入可信知识库", "识别用户问题类型", "生成带引用的回答", "低置信度转人工", "记录失败问题并更新知识库", "要求 AI 永远回答", "隐藏无法回答的问题"]
      },
      {
        question: "目标：用 AI 完成一份行业研究初稿。",
        instruction: "按可靠的执行顺序，依次点击 5 个步骤。",
        type: "order",
        correct: ["定义研究问题", "收集可信来源", "AI 提取与归纳", "核验关键事实和引用", "输出结论与不确定性"],
        options: ["定义研究问题", "收集可信来源", "AI 提取与归纳", "核验关键事实和引用", "输出结论与不确定性", "只使用一篇热门文章", "删除所有不确定表述"]
      }
    ]
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
  state.round = 0;
  state.scores = { boundary: 0, prompt: 0, verification: 0, workflow: 0 };
  state.roundScores = { boundary: [], prompt: [], verification: [], workflow: [] };
  state.answers = { boundary: [], prompt: [], verification: [], workflow: [] };
  state.roundResults = [];
  state.selections = [];
  state.riskFailures = [];
}

function start() {
  reset();
  show("game");
  renderGame();
}

function currentGame() {
  return games[state.stage];
}

function currentRound() {
  return currentGame().rounds[state.round];
}

function completedRounds() {
  return state.stage * 3 + state.round;
}

function renderGame() {
  const game = currentGame();
  const round = currentRound();
  state.selections = [];
  $("hudStage").textContent = game.title;
  $("hudProgress").textContent = `${state.stage} / 4`;
  $("gameKicker").textContent = `关卡 ${state.stage + 1} / 4 · 回合 ${state.round + 1} / 3`;
  $("gameTitle").textContent = game.title;
  $("gameCode").textContent = game.code;
  $("gameQuestion").textContent = round.question;
  $("gameInstruction").textContent = round.instruction;
  $("gameFeedback").textContent = "完成操作后提交。";
  $("gameFeedback").className = "";
  $("gameBar").style.width = `${(completedRounds() / 12) * 100}%`;
  $("submitGameBtn").disabled = false;
  const area = $("gameArea");
  area.innerHTML = "";
  if (round.type === "classify") renderClassify(game, round, area);
  if (round.type === "select") renderSelect(game, round, area);
  if (round.type === "order") renderOrder(round, area);
}

function renderClassify(game, round, area) {
  const grid = document.createElement("div");
  grid.className = "classify-grid";
  round.cards.forEach(([text]) => {
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

function renderSelect(game, round, area) {
  const grid = document.createElement("div");
  grid.className = game.id === "verification" ? "statement-grid" : "component-grid";
  round.options.forEach((text) => {
    const button = document.createElement("button");
    button.className = game.id === "verification" ? "statement-card" : "component-card";
    button.innerHTML = `<span>${game.id === "verification" ? "分析片段" : "PROMPT 零件"}</span><strong>${text}</strong>`;
    button.onclick = () => toggleSelection(button, text, round.limit);
    grid.appendChild(button);
  });
  area.appendChild(grid);
}

function renderOrder(round, area) {
  const layout = document.createElement("div");
  layout.className = "workflow-layout";
  layout.innerHTML = `<div class="workflow-pool"></div><div class="workflow-route"><p>你的执行路线</p><ol id="routeList"></ol></div>`;
  round.options.forEach((text) => {
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
  const game = currentGame();
  const round = currentRound();
  let score = 0;
  let evidence = "";
  let criticalMisses = [];
  let correctAnswer = [];
  let candidateSelection = [];

  if (round.type === "classify") {
    if (state.selections.length < round.cards.length) return feedback("请先为每张任务卡完成分类。", false);
    const correct = round.cards.filter(([text, answer]) => state.selections.find((item) => item.text === text)?.choice === answer).length;
    score = Math.round((correct / round.cards.length) * 100);
    evidence = `正确分类 ${correct}/${round.cards.length}`;
    candidateSelection = state.selections.map((item) => `${item.text} → ${item.choice}`);
    correctAnswer = round.cards.map(([text, answer]) => `${text} → ${answer}`);
    criticalMisses = (round.critical || []).filter((text) => {
      const answer = round.cards.find(([cardText]) => cardText === text)?.[1];
      return state.selections.find((item) => item.text === text)?.choice !== answer;
    });
  } else if (round.type === "select") {
    if (state.selections.length < round.limit) return feedback(`请选择 ${round.limit} 项后再提交。`, false);
    const correct = state.selections.filter((item) => round.correct.includes(item)).length;
    score = Math.round((correct / round.correct.length) * 100);
    evidence = `命中关键项 ${correct}/${round.correct.length}：${state.selections.join("、")}`;
    candidateSelection = [...state.selections];
    correctAnswer = [...round.correct];
    criticalMisses = (round.critical || []).filter((text) => !state.selections.includes(text));
  } else {
    if (state.selections.length < 5) return feedback("请先完成 5 步执行路线。", false);
    const positionHits = state.selections.filter((item, index) => item === round.correct[index]).length;
    const contentHits = state.selections.filter((item) => round.correct.includes(item)).length;
    score = Math.round(positionHits * 12 + contentHits * 8);
    evidence = `步骤命中 ${contentHits}/5，顺序命中 ${positionHits}/5：${state.selections.join(" → ")}`;
    candidateSelection = [...state.selections];
    correctAnswer = [...round.correct];
  }

  if (criticalMisses.length) {
    state.riskFailures.push(`${game.title}回合${state.round + 1}：${criticalMisses.join("、")}`);
  }
  score = Math.min(100, score);
  state.roundScores[game.id].push(score);
  state.answers[game.id].push(`回合${state.round + 1} ${evidence}`);
  state.roundResults.push({
    gameId: game.id,
    gameName: game.title,
    dimension: game.id,
    roundNumber: state.round + 1,
    scenario: round.question,
    type: round.type,
    selections: candidateSelection,
    correctAnswer,
    score,
    isCritical: Boolean(round.critical?.length),
    riskTriggered: criticalMisses.length > 0,
    evidence
  });
  state.scores[game.id] = average(state.roundScores[game.id]);

  feedback(score >= 80 ? "判断很稳，进入下一回合。" : score >= 60 ? "有不错的直觉，再看一个不同场景。" : "这里暴露了一个值得继续训练的盲区。", true);
  $("submitGameBtn").disabled = true;
  setTimeout(advanceGame, 650);
}

function advanceGame() {
  if (state.round < 2) {
    state.round += 1;
    renderGame();
    return;
  }
  state.stage += 1;
  state.round = 0;
  if (state.stage >= games.length) renderResults();
  else renderGame();
}

function feedback(text, ok) {
  $("gameFeedback").textContent = text;
  $("gameFeedback").className = ok ? "ok" : "warn";
}

function average(values) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
}

function metrics() {
  const values = Object.values(state.scores);
  const total = average(values);
  const min = Math.min(...values);
  const top = Object.entries(state.scores).sort((a, b) => b[1] - a[1])[0][0];
  const ranges = Object.values(state.roundScores).map((scores) => scores.length ? Math.max(...scores) - Math.min(...scores) : 100);
  const stability = Math.max(0, 100 - average(ranges));
  const riskPass = state.riskFailures.length === 0;
  return { total, min, top, stability, riskPass };
}

function recommendationStatus() {
  const m = metrics();
  if (!m.riskPass) {
    return { level: "NO", title: "暂不推荐进入候选池", reason: "高风险任务底线未通过，需要重点验证其 AI 使用边界。" };
  }
  if (m.total >= 85 && m.min >= 70 && m.stability >= 75) {
    return { level: "YES", title: "强推荐进入候选池", reason: "12 个行为样本表现稳定，四项 AI Sense 能力没有明显短板。" };
  }
  if (m.total >= 70 && m.min >= 50 && m.stability >= 55) {
    return { level: "CAUTION", title: "可推荐，建议二面验证", reason: "已经形成 AI Sense 优势，但稳定性或单项能力仍需验证。" };
  }
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
    "稳定性": m.stability,
    "风险底线": m.riskPass ? "通过" : "未通过",
    "模型边界": state.scores.boundary,
    "任务拆解": state.scores.prompt,
    "验证意识": state.scores.verification,
    "Agent 工作流": state.scores.workflow,
    "严格结论": status.reason,
    "关键证据": evidenceText()
  };
}

function buildFeishuPayload(snapshot) {
  return {
    source: "ai-sense-test",
    candidate: {
      ...snapshot.feishuRecord,
      "候选人编号": snapshot.id,
      "测评时间": snapshot.savedAt,
      "来源": "AI Sense 测试"
    },
    rounds: snapshot.roundResults.map((result) => ({
      "候选人编号": snapshot.id,
      "游戏名称": result.gameName,
      "能力维度": dimensions[result.dimension]?.name || result.dimension,
      "回合编号": result.roundNumber,
      "场景名称": result.scenario,
      "题目类型": result.type,
      "候选人选择": result.selections.join(result.type === "order" ? " → " : "\n"),
      "正确答案": result.correctAnswer.join(result.type === "order" ? " → " : "\n"),
      "回合得分": result.score,
      "是否高风险题": result.isCritical ? "是" : "否",
      "是否触发风险": result.riskTriggered ? "是" : "否",
      "行为证据": result.evidence
    }))
  };
}

function buildResumePayload(snapshot, file, dataBase64) {
  return {
    source: "ai-sense-test",
    resume: {
      candidateId: snapshot.id,
      candidateRecordId: snapshot.feishuCandidateRecordId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      dataBase64
    }
  };
}

function evidenceText() {
  return games.map((game) => `${game.title}: ${state.answers[game.id].join(" / ")}`).join("\n");
}

function snapshotState() {
  return {
    id: `AIS-${Date.now().toString(36).toUpperCase()}`,
    savedAt: new Date().toISOString(),
    scores: { ...state.scores },
    roundScores: structuredClone(state.roundScores),
    answers: structuredClone(state.answers),
    roundResults: structuredClone(state.roundResults),
    riskFailures: [...state.riskFailures],
    feishuRecord: buildFeishuRecord()
  };
}

function saveResultSnapshot() {
  const snapshot = snapshotState();
  latestResultSnapshot = snapshot;
  persistResultSnapshot(snapshot);
  return snapshot;
}

function persistResultSnapshot(snapshot) {
  try {
    const history = JSON.parse(localStorage.getItem(RESULT_HISTORY_KEY) || "[]");
    const nextHistory = [snapshot, ...history.filter((item) => item.id !== snapshot.id)].slice(0, 20);
    localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(snapshot));
    localStorage.setItem(RESULT_HISTORY_KEY, JSON.stringify(nextHistory));
  } catch {
    // The in-memory result still works when local storage is unavailable.
  }
}

function restoreSnapshot(snapshot) {
  if (!snapshot?.scores || !snapshot?.answers || !snapshot?.roundScores) return false;
  state.scores = { ...state.scores, ...snapshot.scores };
  state.roundScores = { ...state.roundScores, ...snapshot.roundScores };
  state.answers = { ...state.answers, ...snapshot.answers };
  state.roundResults = Array.isArray(snapshot.roundResults) ? structuredClone(snapshot.roundResults) : [];
  state.riskFailures = Array.isArray(snapshot.riskFailures) ? snapshot.riskFailures : [];
  state.stage = games.length;
  state.round = 0;
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
  if (!FEISHU_ENDPOINT) {
    note.textContent = "测试结果已生成。投递简历后，我们会结合结果一起查看。";
    return false;
  }
  note.textContent = "测试结果正在同步。";
  try {
    const response = await fetch(FEISHU_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildFeishuPayload(snapshot))
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    snapshot.feishuCandidateRecordId = data.candidateRecord?.record_id || data.candidateRecordId || "";
    latestResultSnapshot = snapshot;
    persistResultSnapshot(snapshot);
    note.textContent = "测试结果已同步。";
    return Boolean(snapshot.feishuCandidateRecordId);
  } catch {
    note.textContent = "测试结果已生成，同步稍后重试。";
    return false;
  }
}

function renderResults() {
  const snapshot = saveResultSnapshot();
  const badge = resolveBadge();
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
  feishuSubmitPromise = FEISHU_AUTO_SUBMIT ? submitFeishuRecord(snapshot) : Promise.resolve(false);
}

function renderAdmin() {
  const badge = resolveBadge();
  const status = recommendationStatus();
  const career = careerRecommendation();
  const m = metrics();
  $("adminSource").textContent = "数据来源：候选人在 4 个游戏、12 个短回合中的实际操作，而不是自我评价。";
  $("adminVerdict").className = `verdict ${status.level.toLowerCase()}`;
  $("adminVerdict").innerHTML = `<strong>${status.title}</strong><span>${status.reason}</span><em>强推荐线：平均分 ≥ 85，单项 ≥ 70，稳定性 ≥ 75，风险底线通过。</em>`;
  $("metricGrid").innerHTML = Object.entries(state.scores)
    .map(([key, value]) => `<div><span>${dimensions[key].name}</span><strong>${value}</strong><em>三回合：${state.roundScores[key].join(" / ")}</em></div>`)
    .concat([
      `<div><span>稳定性</span><strong>${m.stability}</strong><em>同类场景表现是否一致</em></div>`,
      `<div><span>风险底线</span><strong>${m.riskPass ? "通过" : "未通过"}</strong><em>${m.riskPass ? "未出现高风险误判" : state.riskFailures.join("；")}</em></div>`,
      `<div><span>AI Sense 总分</span><strong>${m.total}</strong><em>四项能力平均分</em></div>`
    ])
    .join("");
  $("companyMatches").innerHTML = `<div class="company"><strong>${career.roles}</strong><span>${career.companies}</span><i><b style="width:${m.total}%"></b></i><em>主优势：${dimensions[m.top].name}</em></div>`;
  const record = buildFeishuRecord();
  $("feishuFields").innerHTML = ["是否值得推荐", "推荐公司", "适合岗位"]
    .map((key) => `<div><span>${key}</span><strong>${record[key]}</strong></div>`)
    .join("");
  $("badgeCatalog").innerHTML = badges.map((item) => `<div class="${item.id === badge.id ? "active" : ""}"><strong>${item.name}</strong><span>${item.dimension === "all" ? "四项均衡高分" : item.dimension === "none" ? "总分不足 55" : `${dimensions[item.dimension].name}最高分`}</span></div>`).join("");
  $("adminEvidence").innerHTML = games.map((game) => `<div class="evidence-row"><strong>${game.title}</strong><span>${state.answers[game.id].join("<br>") || "暂无记录"}</span></div>`).join("");
}

function renderPendingAdmin() {
  $("adminSource").textContent = "暂无完整记录：请先让候选人在本浏览器完成 4 个游戏、12 个短回合。";
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
  const button = $("uploadResumeBtn");
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const error = validateResumeFile(file);
    $("resumeNote").textContent = error || `已选择：${file.name}。点击按钮即可上传到飞书表格。`;
    button.disabled = Boolean(error);
  };
  button.onclick = uploadSelectedResume;
}

function validateResumeFile(file) {
  if (!file) return "请先选择一份简历。";
  if (file.size <= 0) return "这份文件是空的，请重新选择。";
  if (file.size > MAX_RESUME_BYTES) return "文件超过 20MB，请压缩后再上传。";
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!RESUME_EXTENSIONS.has(extension)) return "仅支持 PDF / Word / TXT 简历。";
  return "";
}

async function uploadSelectedResume() {
  const file = $("resumeFile").files?.[0];
  const button = $("uploadResumeBtn");
  const note = $("resumeNote");
  const validationError = validateResumeFile(file);
  if (validationError) {
    note.textContent = validationError;
    return;
  }
  if (!FEISHU_ENDPOINT) {
    note.textContent = "当前没有配置飞书提交接口，暂时无法上传简历。";
    return;
  }

  button.disabled = true;
  note.textContent = "正在确认你的测评结果。";
  try {
    const snapshot = await ensureFeishuCandidateRecord();
    note.textContent = "正在上传简历到飞书。";
    const dataBase64 = await fileToBase64(file);
    const response = await fetch(FEISHU_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildResumePayload(snapshot, file, dataBase64))
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    note.textContent = "简历已上传，我们会结合你的 AI Sense 结果一起查看。";
    button.textContent = "已上传";
  } catch {
    note.textContent = "简历暂时没有上传成功，请稍后重试。";
    button.disabled = false;
  }
}

async function ensureFeishuCandidateRecord() {
  if (!latestResultSnapshot) {
    loadLatestStoredResult();
    try {
      latestResultSnapshot = JSON.parse(localStorage.getItem(RESULT_STORAGE_KEY) || "null");
    } catch {
      latestResultSnapshot = null;
    }
  }
  if (!latestResultSnapshot) throw new Error("Missing latest result");
  if (latestResultSnapshot.feishuCandidateRecordId) return latestResultSnapshot;
  if (feishuSubmitPromise) await feishuSubmitPromise;
  if (latestResultSnapshot.feishuCandidateRecordId) return latestResultSnapshot;
  const synced = await submitFeishuRecord(latestResultSnapshot);
  if (!synced || !latestResultSnapshot.feishuCandidateRecordId) throw new Error("Missing Feishu record ID");
  return latestResultSnapshot;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
