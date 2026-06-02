const state = {
  step: 0,
  axes: { E: 0, I: 0, N: 0, S: 0, T: 0, F: 0, J: 0, P: 0 },
  scores: { model: 0, product: 0, business: 0, research: 0, agent: 0, infra: 0, content: 0, enterprise: 0 },
  calibration: [],
  completed: {},
  activeWorkshop: null,
  workshopStep: 0,
  workshopAnswers: [],
  activeTimer: null,
  taskMeta: {}
};

const $ = (id) => document.getElementById(id);
const RESULT_STORAGE_KEY = "aiSense.latestResult.v1";
const RESULT_HISTORY_KEY = "aiSense.resultHistory.v1";
const FEISHU_ENDPOINT = window.AI_SENSE_FEISHU_ENDPOINT || "";
const FEISHU_AUTO_SUBMIT = window.AI_SENSE_FEISHU_AUTO_SUBMIT !== false;

const calibrationTasks = [
  {
    title: "能量来源",
    q: "遇到一个新 AI 工具，你第一反应是？",
    options: [
      ["拉朋友一起试，边玩边讨论它能做什么", ["E", "P"], { product: 5, content: 4 }],
      ["自己先拆功能边界，记录它适合和不适合的任务", ["I", "T"], { model: 5, research: 4 }]
    ]
  },
  {
    title: "判断方式",
    q: "一个 AI demo 看起来很惊艳，你更想确认？",
    options: [
      ["它是否真的解决了一个高频、真实、愿意付费的问题", ["S", "J"], { business: 5, enterprise: 4 }],
      ["它背后的能力能不能迁移到更多场景", ["N", "P"], { product: 5, agent: 4 }]
    ]
  },
  {
    title: "信任来源",
    q: "团队争论 AI 输出是否可信，你更在意？",
    options: [
      ["有没有评测集、失败样例、引用证据和上线门槛", ["T", "J"], { model: 5, research: 5 }],
      ["用户是否愿意继续用，是否感到被理解和帮助", ["F", "P"], { product: 4, content: 4 }]
    ]
  },
  {
    title: "行动节奏",
    q: "只给 48 小时做一个 AI 原型，你会先？",
    options: [
      ["定目标、拆链路、标出最大风险，再动手", ["I", "J"], { infra: 4, enterprise: 4 }],
      ["先做出能玩的版本，用反馈快速改方向", ["E", "P"], { product: 5, agent: 4 }]
    ]
  }
];

const avatars = {
  explorer: ["灵感原型师", "善于把新模型变成可体验的产品原型。", ["反应快", "会试错", "有传播感"]],
  architect: ["系统架构师", "能把模型、数据、工程和成本放在一张图里。", ["结构感", "可复利", "能取舍"]],
  scientist: ["模型侦察员", "对模型边界、失败样例和评测口径很敏感。", ["评测感", "证据链", "边界意识"]],
  operator: ["落地操盘手", "擅长把 AI 能力放进真实业务流程。", ["客户感", "ROI", "交付意识"]]
};

const badgeCatalog = [
  {
    id: "MODEL_RADAR",
    code: "RADAR",
    name: "模型雷达",
    axis: "model",
    className: "scientist",
    tagline: "你总能先看见模型能力的边界和风险。",
    share: "我测出了「模型雷达」AI Sense 身份：看模型不只看热闹，更看评测、证据和边界。"
  },
  {
    id: "AGENT_DIRECTOR",
    code: "AGENT",
    name: "Agent 导演",
    axis: "product",
    className: "explorer",
    tagline: "你擅长把不稳定的智能体调成可用的任务流程。",
    share: "我测出了「Agent 导演」AI Sense 身份：会把会聊天的 AI 变成能完成任务的产品。"
  },
  {
    id: "PRODUCT_SPARK",
    code: "SPARK",
    name: "原型火花",
    axis: "product",
    className: "explorer",
    tagline: "你对用户手感、体验闭环和产品惊喜点很敏感。",
    share: "我测出了「原型火花」AI Sense 身份：看到新模型，会先想到怎么做成有人想用的东西。"
  },
  {
    id: "BUSINESS_ENGINE",
    code: "ENGINE",
    name: "落地引擎",
    axis: "business",
    className: "operator",
    tagline: "你会追问谁付钱、替代哪段流程、ROI 怎么成立。",
    share: "我测出了「落地引擎」AI Sense 身份：关心 AI 怎么真正进入业务、产生收入。"
  },
  {
    id: "INFRA_FORGE",
    code: "FORGE",
    name: "基建锻造师",
    axis: "model",
    className: "architect",
    tagline: "你关注推理成本、部署约束和可规模化的工程底座。",
    share: "我测出了「基建锻造师」AI Sense 身份：AI 不只要聪明，还要稳定、便宜、跑得动。"
  },
  {
    id: "STRATEGY_MAPPER",
    code: "MAP",
    name: "战场绘图师",
    axis: "business",
    className: "architect",
    tagline: "你能把技术、产品、客户和公司战场放在同一张地图里。",
    share: "我测出了「战场绘图师」AI Sense 身份：看 AI 公司，会同时看技术、产品和商业闭环。"
  },
  {
    id: "CONTENT_ALCHEMY",
    code: "MEDIA",
    name: "多模态炼金师",
    axis: "product",
    className: "explorer",
    tagline: "你对创作、表达、传播和多模态体验更敏锐。",
    share: "我测出了「多模态炼金师」AI Sense 身份：AI 在我这儿首先是新的表达方式。"
  },
  {
    id: "ENTERPRISE_KEY",
    code: "KEY",
    name: "企业钥匙",
    axis: "business",
    className: "operator",
    tagline: "你能看见企业采购、交付、合规和复购的关键节点。",
    share: "我测出了「企业钥匙」AI Sense 身份：懂一点 AI，也懂一点把 AI 卖进真实流程。"
  },
  {
    id: "OBSERVER",
    code: "WAIT",
    name: "AI 见习玩家",
    axis: "none",
    className: "operator",
    tagline: "你的 AI Sense 正在升级中，下一次可能会刷出新的身份。",
    share: "我测出了「AI 见习玩家」身份：AI Sense 正在升级中，下一次再冲更高阶勋章。"
  }
];

const workshops = {
  model: {
    title: "模型观测塔",
    kicker: "探索点 1 / Model Radar",
    evidence: ["观察模型能力边界", "识别评测噪声", "判断模型是否真的能用"],
    questions: [
      { type: "noise", title: "噪声扫描", q: "找出 3 个会污染 AI 判断的噪声块。" },
      ["一个新模型刷屏了，你最先想验证什么？", [
        ["它在哪些真实任务上稳定超过现有方案，失败边界在哪里", "你先看能力边界和替代价值，这是强模型直觉。", { model: 18, research: 12, enterprise: 4 }, ["I", "T"]],
        ["它的 demo 是否足够惊艳，适不适合做传播素材", "传播感有用，但不能证明模型真的可用。", { content: 9, product: 5 }, ["E", "F"]],
        ["它参数多大、榜单第几、发布会声量如何", "这些是线索，但不是场景判断。", { model: 5, business: 4 }, ["S", "P"]]
      ]],
      ["你看到一个模型回答又快又自信，但偶尔编细节。你会怎么判断？", [
        ["把事实性、推理、格式遵循分开测，并记录高置信错误", "你能抓住“自信地错”这个关键风险。", { model: 16, research: 10, enterprise: 6 }, ["T", "J"]],
        ["既然大部分时候答得顺，就先上线再说", "速度和流畅度不能覆盖事实风险。", { product: 5, business: 4 }, ["E", "P"]],
        ["让它回答更多问题，看看总体感觉是否稳定", "多试有帮助，但需要明确分类和记录方法。", { model: 8, product: 4 }, ["S", "F"]]
      ]],
      ["同一个 prompt，A 模型更聪明但不稳定，B 模型没那么强但输出稳定。你会怎么选？", [
        ["按任务风险分层：创意探索用 A，标准流程用 B，并保留回退策略", "你能把模型能力和任务风险匹配起来。", { model: 14, infra: 10, business: 6 }, ["N", "J"]],
        ["选 A，聪明才是第一位", "高能力不等于适合所有产品场景。", { model: 8, content: 4 }, ["N", "P"]],
        ["选 B，稳定就够了", "稳定重要，但可能错过高价值任务。", { enterprise: 7, business: 4 }, ["S", "J"]]
      ]],
      ["你要判断一个模型是否适合做“AI 同事”，最该看哪组信号？", [
        ["长任务保持、工具调用成功率、失败恢复、成本和可观察日志", "这是更接近真实 AI 应用的判断维度。", { model: 16, agent: 8, infra: 8 }, ["T", "J"]],
        ["聊天是否自然，语气是否像真人", "自然很重要，但不足以判断能不能工作。", { content: 8, product: 5 }, ["F", "P"]],
        ["它能不能回答冷门知识问题", "知识面只是能力的一部分。", { research: 6, model: 4 }, ["I", "S"]]
      ]]
    ]
  },
  product: {
    title: "Agent 控制舱",
    kicker: "探索点 2 / Agent Trial",
    evidence: ["判断 AI 产品机会", "设计 Agent 任务闭环", "识别体验和留存问题"],
    questions: [
      { type: "reaction", title: "信号反应", q: "等芯片变绿，再立刻点击。" },
      ["你看到一个 AI 产品 demo 很酷，怎么判断它是不是好产品？", [
        ["看它是否缩短了一个真实任务链路，并让用户愿意反复回来", "你把酷 demo 转成了任务和留存判断。", { product: 18, business: 8, agent: 5 }, ["N", "T"]],
        ["看界面是否高级、动效是否惊艳", "这会影响第一印象，但不是产品成立的核心。", { content: 8, product: 5 }, ["F", "P"]],
        ["看它用了哪个大模型，模型越强产品越强", "模型是底座，不等于产品价值。", { model: 6, infra: 4 }, ["S", "T"]]
      ]],
      ["一个 Agent 经常完成 80%，最后一步失败。你会先补什么？", [
        ["任务状态、失败检测、回退路径和用户接管按钮", "你知道 Agent 产品必须设计失败恢复。", { agent: 18, product: 10, enterprise: 6 }, ["J", "T"]],
        ["让它多说几句解释，显得更聪明", "解释不能替代完成任务。", { content: 6, product: 4 }, ["F", "P"]],
        ["换更强模型，先不改产品链路", "可能有用，但没有解决流程可靠性。", { model: 7, infra: 5 }, ["N", "P"]]
      ]],
      ["AI 功能上线后，很多人试了一次就不用了。你最先看什么？", [
        ["首次成功率、二次使用场景、失败日志和用户是否真的省时间", "你能从热闹试用切到留存问题。", { product: 16, business: 8, agent: 6 }, ["T", "J"]],
        ["继续加新功能，让产品看起来更丰富", "功能多不等于核心价值强。", { content: 6, product: 5 }, ["E", "P"]],
        ["扩大投放，先让更多人知道", "获客不能解决留存。", { business: 6, content: 4 }, ["E", "F"]]
      ]],
      { type: "memory", title: "上下文记忆", q: "记住闪现的 4 个 token，随后选出正确顺序。" },
      ["你要给一个 AI 产品设计“让人愿意分享”的结果页，最重要是什么？", [
        ["身份感强、表达短、能截图、还能让用户觉得像自己", "你抓住了传播型结果页的核心。", { product: 14, content: 12, business: 4 }, ["E", "F"]],
        ["展示尽可能多的技术细节", "技术细节适合后台，不一定适合分享。", { model: 5, research: 4 }, ["I", "T"]],
        ["把所有分数都展示出来，显得客观", "分数太多会削弱传播。", { product: 5, enterprise: 3 }, ["S", "J"]]
      ]]
    ]
  },
  business: {
    title: "商业罗盘站",
    kicker: "探索点 3 / Market Compass",
    evidence: ["判断 AI 公司质量", "识别商业闭环", "匹配候选人与公司类型"],
    questions: [
      { type: "anomaly", title: "指标异常", q: "在指标面板里，点出最危险的异常信号。" },
      ["一家 AI 公司增长很快，你最想确认哪件事？", [
        ["增长来自真实复购和任务刚需，还是来自新鲜感和补贴", "你能区分短期热度和长期需求。", { business: 18, enterprise: 8, product: 5 }, ["T", "J"]],
        ["品牌声量是不是最大，社交媒体有没有刷屏", "声量是线索，但不是商业质量。", { content: 8, business: 4 }, ["E", "F"]],
        ["创始人是否足够明星化", "明星效应不能替代公司基本面。", { business: 4, content: 4 }, ["S", "P"]]
      ]],
      ["一个 AI 公司说自己有技术壁垒，你最想看什么证据？", [
        ["独有数据/评测闭环、成本曲线、客户迁移成本和迭代速度", "这是更完整的壁垒判断。", { business: 14, model: 10, infra: 8 }, ["N", "T"]],
        ["他们用了最先进的大模型", "模型先进不等于公司有壁垒。", { model: 6, research: 4 }, ["I", "P"]],
        ["他们官网看起来很专业", "包装不能证明壁垒。", { content: 4, business: 3 }, ["F", "S"]]
      ]],
      ["你要判断一个候选人适合去哪类 AI 公司，最可靠的依据是？", [
        ["看他在模型、产品、商业题里的稳定行为模式，而不是一句自我介绍", "你知道匹配要看行为证据。", { business: 12, product: 8, enterprise: 8 }, ["T", "J"]],
        ["看他最想去哪家公司", "意愿重要，但不足以判断适配。", { content: 4, business: 4 }, ["F", "P"]],
        ["看他有没有大厂背景", "背景是参考，不是 AI Sense 本身。", { enterprise: 5, business: 3 }, ["S", "J"]]
      ]],
      ["一家 AI 应用公司收入不错，但毛利低、交付重，你怎么判断？", [
        ["看交付是否能产品化，边际成本是否随客户增加而下降", "你抓住了 AI 应用公司的规模化关键。", { business: 16, enterprise: 10, product: 6 }, ["N", "J"]],
        ["有收入就说明方向很好", "收入重要，但要看质量和可复制性。", { business: 7, enterprise: 4 }, ["S", "P"]],
        ["毛利低就完全不看", "早期低毛利可能能改善，不能一刀切。", { business: 5, model: 3 }, ["T", "P"]]
      ]]
    ]
  }
};

const companies = [
  ["深势科技", ["research", "model"]], ["水木分子", ["research", "model"]], ["中科紫东太初", ["model", "research"]],
  ["百图生科", ["research", "model"]], ["无问芯穹", ["infra", "model"]], ["中科寒武纪", ["infra", "model"]],
  ["MINMAX", ["model", "product"]], ["kimi", ["model", "product"]], ["智谱", ["model", "enterprise"]],
  ["百川智能", ["model", "agent"]], ["面壁智能", ["model", "agent"]], ["衔远科技", ["product", "agent"]],
  ["字节", ["product", "content"]], ["红棉小冰", ["content", "product"]], ["好未来", ["product", "enterprise"]],
  ["第四范式", ["enterprise", "business"]], ["法信数智", ["enterprise", "business"]], ["九章云极", ["enterprise", "infra"]],
  ["地平线", ["infra", "enterprise"]], ["度小满", ["enterprise", "business"]], ["小米", ["product", "enterprise"]]
].map(([name, tags]) => ({ name, tags }));

function show(id) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  $(id).classList.add("active");
}

function addScore(score) {
  Object.entries(score).forEach(([key, value]) => {
    state.scores[key] = (state.scores[key] || 0) + value;
  });
}

function addAxes(axes) {
  axes.forEach((axis) => {
    state.axes[axis] += 1;
  });
}

function reset() {
  if (state.activeTimer) clearTimeout(state.activeTimer);
  state.step = 0;
  state.axes = { E: 0, I: 0, N: 0, S: 0, T: 0, F: 0, J: 0, P: 0 };
  state.scores = { model: 0, product: 0, business: 0, research: 0, agent: 0, infra: 0, content: 0, enterprise: 0 };
  state.calibration = [];
  state.completed = {};
  state.activeWorkshop = null;
  state.workshopStep = 0;
  state.workshopAnswers = [];
  state.taskMeta = {};
}

function snapshotState() {
  return {
    id: `AIS-${Date.now().toString(36).toUpperCase()}`,
    savedAt: new Date().toISOString(),
    axes: { ...state.axes },
    scores: { ...state.scores },
    calibration: state.calibration.map((item) => ({ ...item })),
    completed: Object.fromEntries(Object.entries(state.completed).map(([key, answers]) => [key, [...answers]])),
    feishuRecord: buildFeishuRecord()
  };
}

function restoreSnapshot(snapshot) {
  if (!snapshot || !snapshot.completed || Object.keys(snapshot.completed).length !== 3) return false;
  state.axes = { E: 0, I: 0, N: 0, S: 0, T: 0, F: 0, J: 0, P: 0, ...(snapshot.axes || {}) };
  state.scores = { model: 0, product: 0, business: 0, research: 0, agent: 0, infra: 0, content: 0, enterprise: 0, ...(snapshot.scores || {}) };
  state.calibration = Array.isArray(snapshot.calibration) ? snapshot.calibration : [];
  state.completed = snapshot.completed;
  state.step = calibrationTasks.length;
  state.activeWorkshop = null;
  state.workshopStep = 0;
  state.workshopAnswers = [];
  state.taskMeta = {};
  return true;
}

function readStoredResults() {
  try {
    return JSON.parse(localStorage.getItem(RESULT_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveResultSnapshot() {
  const snapshot = snapshotState();
  try {
    const history = [snapshot, ...readStoredResults().filter((item) => item.id !== snapshot.id)].slice(0, 20);
    localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(snapshot));
    localStorage.setItem(RESULT_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Local storage may be unavailable in private browsing; the in-memory result still works.
  }
  return snapshot;
}

function recommendationLabel(level) {
  if (level === "YES") return "值得推荐";
  if (level === "CAUTION") return "谨慎推荐";
  return "不推荐";
}

function roleRecommendations() {
  const s = state.scores;
  const roleScores = [
    ["AI 产品经理 / Agent 产品经理", s.product + s.agent * 1.2],
    ["模型评测 / AI 测评研究", s.model + s.research * 1.2],
    ["AI 商业分析 / 战略研究", s.business + s.enterprise * 0.8],
    ["企业 AI 解决方案 / 售前交付", s.enterprise + s.business * 0.8],
    ["多模态内容产品 / AI 创作运营", s.content + s.product * 0.5],
    ["AI 基础设施 / 推理工程 / 平台产品", s.infra + s.model * 0.5]
  ];
  return roleScores
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score > 0)
    .slice(0, 3)
    .map(([role]) => role);
}

function buildFeishuRecord() {
  const badge = resolveBadge();
  const status = recommendationStatus();
  const m = metrics();
  const matches = companyMatches();
  const recommended = recommendationLabel(status.level);
  const companiesText = status.level === "NO" ? "不推荐匹配公司" : matches.map((item) => `${item.name}(${item.fit}%)`).join("、");
  const roles = status.level === "NO" ? ["暂不推荐岗位匹配"] : roleRecommendations();
  return {
    "是否值得推荐": recommended,
    "推荐公司": companiesText || "暂无明确公司匹配",
    "适合岗位": roles.join("、"),
    "候选人编号": "",
    "测评时间": new Date().toISOString(),
    "AI Sense 身份": badge.name,
    "身份代码": badge.code,
    "筛选原因": status.reason,
    "总分": m.total,
    "校准均分": m.calibrationAvg,
    "方向聚焦": `${m.focus}%`,
    "严谨度": `${m.rigor}%`,
    "模型轴": m.model,
    "产品轴": m.product,
    "商业轴": m.business,
    "行为证据": Object.entries(state.completed).map(([key, answers]) => `${workshops[key].title}: ${answers.join(" / ")}`).join("\n")
  };
}

async function submitFeishuRecord(snapshot) {
  const note = $("feishuSyncNote");
  if (!note) return;
  const record = { ...(snapshot.feishuRecord || buildFeishuRecord()), "候选人编号": snapshot.id, "测评时间": snapshot.savedAt };
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

function loadLatestStoredResult() {
  try {
    const latest = JSON.parse(localStorage.getItem(RESULT_STORAGE_KEY) || "null");
    return restoreSnapshot(latest) ? latest : null;
  } catch {
    return null;
  }
}

function startCalibration() {
  reset();
  show("calibration");
  renderCalibration();
  updateHud();
}

function renderCalibration() {
  const item = calibrationTasks[state.step];
  $("quizStep").textContent = `${String(state.step + 1).padStart(2, "0")} / 04`;
  $("quizBar").style.width = `${(state.step / calibrationTasks.length) * 100}%`;
  $("questionTitle").textContent = `${item.title}：${item.q}`;
  $("questionBody").innerHTML = "";
  item.options.forEach(([text, axes, score]) => {
    $("questionBody").appendChild(optionButton(text, () => finishCalibration(text, axes, score, 76)));
  });
}

function finishCalibration(label, axes, score, quality) {
  addAxes(axes);
  addScore(score);
  state.calibration.push({ label, quality });
  state.step += 1;
  if (state.activeTimer) clearTimeout(state.activeTimer);
  state.activeTimer = null;
  if (state.step >= calibrationTasks.length) {
    $("quizBar").style.width = "100%";
    renderAvatar();
  } else {
    renderCalibration();
  }
}

function renderReaction(finish = finishCalibration, targetId = "questionBody") {
  $(targetId).innerHTML = `<div class="sense-task"><button class="signal" id="signal">WAIT</button><button class="primary" id="ready">准备</button><p id="note">点击准备，等芯片变绿再点。</p></div>`;
  $("ready").onclick = () => {
    $("ready").disabled = true;
    $("ready").textContent = "盯住芯片";
    state.taskMeta.ready = false;
    state.activeTimer = setTimeout(() => {
      state.taskMeta.ready = true;
      state.taskMeta.startedAt = performance.now();
      $("signal").classList.add("go");
      $("signal").textContent = "GO";
      $("note").textContent = "现在点！";
    }, 800 + Math.random() * 1300);
  };
  $("signal").onclick = () => {
    if (!state.taskMeta.ready) return finish("信号反应：抢跑", ["E", "P"], { content: 6, product: 4 }, 35);
    const ms = Math.round(performance.now() - state.taskMeta.startedAt);
    const quality = Math.max(45, Math.min(98, 110 - Math.round(ms / 10)));
    finish(`信号反应：${ms}ms`, ms < 560 ? ["E", "P"] : ["I", "J"], ms < 560 ? { product: 12, agent: 8, content: 6 } : { research: 8, enterprise: 6 }, quality);
  };
}

function renderNoise(finish = finishCalibration, targetId = "questionBody") {
  const data = [["引用缺失", 1], ["稳定复现", 0], ["样本太少", 1], ["用户原话", 0], ["只看均分", 1], ["置信区间", 0], ["失败样例", 0], ["数据版本", 0], ["上线回滚", 0], ["评测口径", 0], ["缓存命中", 0], ["人工标注", 0]].sort(() => Math.random() - 0.5);
  state.taskMeta.hit = 0;
  state.taskMeta.miss = 0;
  const grid = document.createElement("div");
  grid.className = "chip-grid";
  data.forEach(([text, isNoise]) => {
    const btn = document.createElement("button");
    btn.className = "scan-chip";
    btn.textContent = text;
    btn.onclick = () => {
      if (btn.classList.contains("picked")) return;
      btn.classList.add("picked", isNoise ? "ok" : "bad");
      state.taskMeta.hit += isNoise ? 1 : 0;
      state.taskMeta.miss += isNoise ? 0 : 1;
      if (state.taskMeta.hit >= 3 || state.taskMeta.hit + state.taskMeta.miss >= 5) {
        const quality = Math.max(30, state.taskMeta.hit * 32 - state.taskMeta.miss * 18);
        finish(`噪声扫描：${state.taskMeta.hit}/3`, quality >= 76 ? ["N", "T"] : ["S", "F"], quality >= 76 ? { model: 12, research: 10, infra: 4 } : { product: 6, content: 4 }, quality);
      }
    };
    grid.appendChild(btn);
  });
  $(targetId).appendChild(grid);
}

function renderMemory(finish = finishCalibration, targetId = "questionBody") {
  const target = ["RAG", "EVAL", "CACHE", "GUARD"];
  const choices = [target.join(" → "), "RAG → CACHE → EVAL → GUARD", "EVAL → RAG → GUARD → CACHE"].sort(() => Math.random() - 0.5);
  const box = document.createElement("div");
  box.className = "memory";
  box.textContent = target.join("  ");
  $(targetId).appendChild(box);
  state.activeTimer = setTimeout(() => {
    box.textContent = "选择刚才的 token 顺序";
    choices.forEach((choice) => {
      const btn = optionButton(choice, () => {
        const ok = choice === target.join(" → ");
        finish(`上下文记忆：${ok ? "正确" : "偏移"}`, ok ? ["I", "J"] : ["E", "P"], ok ? { agent: 10, infra: 8, model: 6 } : { content: 6, product: 4 }, ok ? 90 : 45);
      });
      $(targetId).appendChild(btn);
    });
  }, 1500);
}

function renderAnomaly(finish = finishCalibration, targetId = "questionBody") {
  const data = [["回答速度", "0.8s", 0], ["引用准确率", "52%", 1], ["首轮完成率", "81%", 0], ["Token 成本", "下降 18%", 0], ["人工接管率", "9%", 0], ["满意度", "4.3/5", 0]];
  const grid = document.createElement("div");
  grid.className = "metric-grid";
  data.forEach(([name, value, danger]) => {
    const btn = document.createElement("button");
    btn.className = "metric-card";
    btn.innerHTML = `<span>${name}</span><strong>${value}</strong>`;
    btn.onclick = () => finish(`异常指标：${name}`, danger ? ["T", "J"] : ["F", "P"], danger ? { model: 12, enterprise: 10, business: 6 } : { product: 6, content: 4 }, danger ? 92 : 42);
    grid.appendChild(btn);
  });
  $(targetId).appendChild(grid);
}

function optionButton(text, onClick) {
  const btn = document.createElement("button");
  btn.className = "option";
  btn.textContent = text;
  btn.onclick = onClick;
  return btn;
}

function getMbti() {
  return [
    state.axes.E >= state.axes.I ? "E" : "I",
    state.axes.N >= state.axes.S ? "N" : "S",
    state.axes.T >= state.axes.F ? "T" : "F",
    state.axes.J >= state.axes.P ? "J" : "P"
  ].join("");
}

function chooseAvatar() {
  const m = metrics();
  if (m.model >= m.product && m.model >= m.business) return avatars.scientist;
  if (m.product >= m.business) return avatars.explorer;
  if (m.business >= m.model) return avatars.operator;
  return avatars.architect;
}

function avatarClass() {
  const m = metrics();
  if (m.model >= m.product && m.model >= m.business) return "scientist";
  if (m.product >= m.business) return "explorer";
  return "operator";
}

function renderAvatar() {
  const [name, bio, traits] = chooseAvatar();
  const cls = avatarClass();
  $("avatarName").textContent = name;
  $("avatarBio").textContent = bio;
  $("avatarTraits").innerHTML = traits.map((t) => `<span>${t}</span>`).join("");
  setAvatar("avatarSprite", cls);
  setAvatar("miniAvatar", cls);
  updateHud();
  show("avatar");
}

function setAvatar(id, cls) {
  const el = $(id);
  const small = el.classList.contains("small");
  el.className = `avatar-sprite ${small ? "small " : ""}${cls}`;
}

function enterMap() {
  const [name, bio] = chooseAvatar();
  $("playerName").textContent = name;
  $("playerBio").textContent = bio;
  $("walker").className = `walker ${avatarClass()}`;
  moveWalker("start", true);
  updateMap();
  show("map");
}

const walkerTargets = { start: [14, 76], model: [27, 34], product: [72, 42], business: [51, 76] };

function moveWalker(key, instant = false) {
  const [x, y] = walkerTargets[key];
  $("walker").style.left = `${x}%`;
  $("walker").style.top = `${y}%`;
  $("walker").classList.toggle("walking", !instant);
  if (!instant) setTimeout(() => $("walker").classList.remove("walking"), 720);
}

function walkToWorkshop(key) {
  moveWalker(key);
  setTimeout(() => openWorkshop(key), 760);
}

function openWorkshop(key) {
  state.activeWorkshop = key;
  state.workshopStep = 0;
  state.workshopAnswers = [];
  renderWorkshopQuestion();
  show("workshop");
}

function renderWorkshopQuestion() {
  const workshop = workshops[state.activeWorkshop];
  const question = workshop.questions[state.workshopStep];
  $("workshopKicker").textContent = workshop.kicker;
  $("workshopTitle").textContent = `${workshop.title} · ${state.workshopStep + 1} / ${workshop.questions.length}`;
  $("missionEvidence").innerHTML = workshop.evidence.map((e) => `<span>${e}</span>`).join("");
  $("missionOptions").innerHTML = "";
  $("missionFeedback").textContent = "完成本探索点全部题目后，会点亮一块勋章碎片。";
  if (!Array.isArray(question)) {
    $("missionBrief").textContent = `${question.title}：${question.q}`;
    const finish = (label, axes, score) => answerWorkshop({ text: label, feedback: `${question.title}已记录。`, score, axes });
    if (question.type === "reaction") renderReaction(finish, "missionOptions");
    if (question.type === "noise") renderNoise(finish, "missionOptions");
    if (question.type === "memory") renderMemory(finish, "missionOptions");
    if (question.type === "anomaly") renderAnomaly(finish, "missionOptions");
    return;
  }
  const [brief, options] = question;
  $("missionBrief").textContent = brief;
  options.forEach(([text, feedback, score, axes]) => {
    $("missionOptions").appendChild(optionButton(text, () => answerWorkshop({ text, feedback, score, axes })));
  });
}

function answerWorkshop(option) {
  if (state.activeTimer) clearTimeout(state.activeTimer);
  state.activeTimer = null;
  addScore(option.score);
  addAxes(option.axes);
  state.workshopAnswers.push(option.text);
  const workshop = workshops[state.activeWorkshop];
  const done = state.workshopStep >= workshop.questions.length - 1;
  $("missionFeedback").innerHTML = `<strong>${option.feedback}</strong><br>${done ? "探索点已点亮。" : "进入下一题。"}`;
  setTimeout(() => {
    if (done) {
      state.completed[state.activeWorkshop] = [...state.workshopAnswers];
      updateMap();
      if (Object.keys(state.completed).length === 3) renderResults();
      else show("map");
    } else {
      state.workshopStep += 1;
      renderWorkshopQuestion();
    }
  }, 520);
}

function updateMap() {
  ["model", "product", "business"].forEach((key) => {
    const done = Boolean(state.completed[key]);
    $(`${key}State`).textContent = done ? "已点亮" : "进入";
    $(`${key}Status`).textContent = done ? "已点亮" : "待解锁";
    document.querySelector(`.workshop.${key}`).classList.toggle("done", done);
  });
  updateHud();
}

function updateHud() {
  const completed = Object.keys(state.completed).length;
  $("hudRole").textContent = state.step || completed ? chooseAvatar()[0] : "未生成";
  $("hudBadge").textContent = completed === 3 ? `${resolveBadge().name}` : "未获得";
  $("hudProgress").textContent = `${completed} / 3`;
}

function metrics() {
  const model = state.scores.model + state.scores.research + state.scores.infra;
  const product = state.scores.product + state.scores.agent + state.scores.content;
  const business = state.scores.business + state.scores.enterprise;
  const total = model + product + business;
  const calibrationAvg = Math.round(state.calibration.reduce((sum, item) => sum + item.quality, 0) / Math.max(1, state.calibration.length));
  const top = Math.max(model, product, business);
  const second = [model, product, business].sort((a, b) => b - a)[1] || 0;
  const focus = Math.round((top / Math.max(1, total)) * 100);
  const consistency = Math.round((top / Math.max(1, top + second)) * 100);
  const rigor = Math.round(((state.scores.model + state.scores.research + state.scores.enterprise) / Math.max(1, total)) * 100);
  return { model, product, business, total, calibrationAvg, focus, consistency, rigor };
}

function recommendationStatus() {
  const m = metrics();
  if (m.total < 210 || m.calibrationAvg < 60 || m.rigor < 30) {
    return { level: "NO", title: "不推荐进入候选池", reason: "AI Sense 证据不足：总分、校准质量或严谨度未达最低线。", threshold: "最低线：总分 ≥ 210，校准均分 ≥ 60，严谨度 ≥ 30。" };
  }
  if (m.total < 280 || m.calibrationAvg < 72 || m.focus < 42) {
    return { level: "CAUTION", title: "谨慎推荐，需要二面验证", reason: "有局部亮点，但稳定性或方向聚焦不足。", threshold: "强推荐线：总分 ≥ 280，校准均分 ≥ 72，方向聚焦 ≥ 42。" };
  }
  return { level: "YES", title: "推荐进入候选池", reason: "AI Sense 信号稳定，且至少在一个方向形成清晰优势。", threshold: "已达到强推荐线。" };
}

function resolveBadge() {
  const status = recommendationStatus();
  if (status.level === "NO") return badgeCatalog.find((b) => b.id === "OBSERVER");
  const m = metrics();
  const s = state.scores;
  if (m.model >= m.product && m.model >= m.business) {
    if (s.infra >= s.research && s.infra >= s.model * 0.45) return badgeCatalog.find((b) => b.id === "INFRA_FORGE");
    return badgeCatalog.find((b) => b.id === "MODEL_RADAR");
  }
  if (m.product >= m.business) {
    if (s.agent >= s.content && s.agent >= 35) return badgeCatalog.find((b) => b.id === "AGENT_DIRECTOR");
    if (s.content >= 28) return badgeCatalog.find((b) => b.id === "CONTENT_ALCHEMY");
    return badgeCatalog.find((b) => b.id === "PRODUCT_SPARK");
  }
  if (s.enterprise >= s.business) return badgeCatalog.find((b) => b.id === "ENTERPRISE_KEY");
  if (m.business >= 90 && m.model >= 80) return badgeCatalog.find((b) => b.id === "STRATEGY_MAPPER");
  return badgeCatalog.find((b) => b.id === "BUSINESS_ENGINE");
}

function companyMatches() {
  const status = recommendationStatus();
  if (status.level === "NO") return [];
  const m = metrics();
  const max = Math.max(m.model, m.product, m.business, 1);
  const tagScore = (tag) => ({
    model: state.scores.model + state.scores.research,
    research: state.scores.research + state.scores.model * 0.6,
    infra: state.scores.infra + state.scores.model * 0.4,
    product: state.scores.product + state.scores.agent * 0.5,
    agent: state.scores.agent + state.scores.product * 0.5,
    content: state.scores.content + state.scores.product * 0.4,
    enterprise: state.scores.enterprise + state.scores.business * 0.5,
    business: state.scores.business + state.scores.enterprise * 0.4
  })[tag] || 0;
  return companies.map((company) => {
    const raw = company.tags.reduce((sum, tag) => sum + tagScore(tag), 0) / company.tags.length;
    const fit = Math.round(Math.min(96, (raw / max) * 78 + (status.level === "YES" ? 18 : 8)));
    return { ...company, fit };
  }).filter((company) => company.fit >= (status.level === "YES" ? 68 : 78)).sort((a, b) => b.fit - a.fit).slice(0, status.level === "YES" ? 6 : 3);
}

function renderResults() {
  const snapshot = saveResultSnapshot();
  const badge = resolveBadge();
  const status = recommendationStatus();
  const m = metrics();
  $("finalMedal").textContent = badge.code;
  $("resultTitle").textContent = `我是「${badge.name}」型 AI 人`;
  $("resultTagline").textContent = badge.tagline;
  $("publicStats").innerHTML = `<span>AI Sense ${Math.min(99, Math.round(m.total / 4))}</span><span>${publicRank(status.level)}</span>`;
  $("shareText").textContent = badge.share;
  renderAdmin(badge, status, m);
  updateHud();
  show("result");
  if (FEISHU_AUTO_SUBMIT) submitFeishuRecord(snapshot);
}

function publicRank(level) {
  if (level === "YES") return "高阶通关";
  if (level === "CAUTION") return "进阶通关";
  return "新手通关";
}

function renderAdmin(badge, status, m) {
  const latest = readStoredResults()[0];
  const savedAt = latest ? new Date(latest.savedAt).toLocaleString("zh-CN", { hour12: false }) : "当前会话";
  $("adminSource").textContent = latest
    ? `数据来源：本机最新测试记录 ${latest.id}，保存于 ${savedAt}。静态网页暂不跨设备汇总。`
    : "数据来源：当前测试会话。静态网页暂不跨设备汇总。";
  $("adminVerdict").className = `verdict ${status.level.toLowerCase()}`;
  $("adminVerdict").innerHTML = `<strong>${status.title}</strong><span>${status.reason}</span><em>${status.threshold}</em>`;
  const rows = [
    ["总分", m.total, "≥ 210"],
    ["校准均分", m.calibrationAvg, "≥ 60"],
    ["方向聚焦", `${m.focus}%`, "≥ 42%"],
    ["严谨度", `${m.rigor}%`, "≥ 30%"],
    ["模型轴", m.model, "-"],
    ["产品轴", m.product, "-"],
    ["商业轴", m.business, "-"]
  ];
  $("metricGrid").innerHTML = rows.map(([k, v, line]) => `<div><span>${k}</span><strong>${v}</strong><em>门槛 ${line}</em></div>`).join("");
  const matches = companyMatches();
  $("companyMatches").innerHTML = matches.length
    ? matches.map((c) => `<div class="company"><strong>${c.name}</strong><span>${c.tags.map(tagName).join(" / ")}</span><i><b style="width:${c.fit}%"></b></i><em>${c.fit}%</em></div>`).join("")
    : `<div class="no-match">不推荐公司：当前分数未达到候选池最低线。</div>`;
  const feishuRecord = buildFeishuRecord();
  $("feishuFields").innerHTML = ["是否值得推荐", "推荐公司", "适合岗位"]
    .map((key) => `<div><span>${key}</span><strong>${feishuRecord[key]}</strong></div>`)
    .join("");
  $("badgeCatalog").innerHTML = badgeCatalog.map((item) => `<div class="${item.id === badge.id ? "active" : ""}"><strong>${item.name}</strong><span>${item.tagline}</span></div>`).join("");
  $("adminEvidence").innerHTML = Object.entries(state.completed).map(([key, answers]) => `<div class="evidence-row"><strong>${workshops[key].title}</strong><span>${answers.map((a, i) => `Q${i + 1} ${a}`).join(" / ")}</span></div>`).join("");
}

function renderPendingAdmin() {
  $("adminSource").textContent = "暂无完整记录：请先让候选人在本浏览器完成一次测试，或接入表单/数据库做集中收集。";
  $("adminVerdict").className = "verdict caution";
  $("adminVerdict").innerHTML = "<strong>等待候选人完成测试</strong><span>当前还没有完整结果。候选人完成 4 道角色题和 3 个探索点后，这里会生成筛选结论。</span><em>进度要求：3 / 3 个探索点完成。</em>";
  $("metricGrid").innerHTML = [
    ["当前进度", `${Object.keys(state.completed).length} / 3`, "完成后生成"],
    ["角色题", `${state.calibration.length} / 4`, "完成后生成"],
    ["身份勋章", "未生成", "完成后生成"]
  ].map(([k, v, line]) => `<div><span>${k}</span><strong>${v}</strong><em>${line}</em></div>`).join("");
  $("companyMatches").innerHTML = `<div class="no-match">暂无公司推荐：等待完整测试结果。</div>`;
  $("feishuFields").innerHTML = `<div><span>是否值得推荐</span><strong>等待完整测试</strong></div><div><span>推荐公司</span><strong>等待完整测试</strong></div><div><span>适合岗位</span><strong>等待完整测试</strong></div>`;
  $("badgeCatalog").innerHTML = badgeCatalog.map((item) => `<div><strong>${item.name}</strong><span>${item.tagline}</span></div>`).join("");
  $("adminEvidence").innerHTML = `<div class="evidence-row"><strong>暂无行为证据</strong><span>完成探索点后自动记录每题选择。</span></div>`;
}

function openRecruiterView() {
  if (Object.keys(state.completed).length !== 3) loadLatestStoredResult();
  if (Object.keys(state.completed).length === 3) {
    renderAdmin(resolveBadge(), recommendationStatus(), metrics());
    $("backResultBtn").textContent = "返回身份卡";
  } else {
    renderPendingAdmin();
    $("backResultBtn").textContent = "返回测试";
  }
  show("recruiter");
}

function tagName(tag) {
  return { model: "模型", research: "研究", infra: "基建", product: "产品", agent: "Agent", content: "多模态", enterprise: "企业", business: "商业" }[tag] || tag;
}

function medalCode() {
  return resolveBadge().name;
}

function setupResumeUpload() {
  const input = $("resumeFile");
  const note = $("resumeNote");
  const link = $("resumeMailLink");
  if (!input || !note || !link) return;
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) {
      note.textContent = "支持 PDF / Word。静态演示版会先记录文件名，正式发布时可接入飞书表单或招聘邮箱。";
      return;
    }
    const size = file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "未知大小";
    note.textContent = `已选择：${file.name}（${size}）。点击下方按钮后，请在邮件里附上这份简历。`;
    const subject = encodeURIComponent("AI Sense 简历投递");
    const body = encodeURIComponent(`你好，我完成了 AI Sense 测试，想投递简历。\n\n我的身份：${medalCode()}\n简历附件：${file.name}\n\n请在发送邮件前手动附上简历文件。`);
    link.href = `mailto:talent@example.com?subject=${subject}&body=${body}`;
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const isRecruiterMode = params.get("recruiter") === "1";
  if (isRecruiterMode) document.body.classList.add("recruiter-mode");
  setupResumeUpload();
  $("startBtn").onclick = startCalibration;
  $("enterMapBtn").onclick = enterMap;
  $("backMapBtn").onclick = () => {
    updateMap();
    show("map");
  };
  document.querySelectorAll(".workshop").forEach((btn) => {
    btn.onclick = () => walkToWorkshop(btn.dataset.workshop);
  });
  $("restartBtn").onclick = startCalibration;
  $("openRecruiterBtn").onclick = openRecruiterView;
  $("openRecruiterTopBtn").onclick = openRecruiterView;
  $("backResultBtn").onclick = () => {
    if (Object.keys(state.completed).length === 3) show("result");
    else show("home");
  };
  $("copyShareBtn").onclick = async () => {
    await navigator.clipboard.writeText($("shareText").textContent);
    $("copyShareBtn").textContent = "已复制";
    setTimeout(() => ($("copyShareBtn").textContent = "复制分享文案"), 1200);
  };
  if (isRecruiterMode) openRecruiterView();
});
