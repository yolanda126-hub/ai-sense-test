# AI Sense Test

一个像素风 AI Sense 测试小游戏，用于候选人外部展示与招聘方内部画像参考。

## 功能

- 4 个精简游戏，每关 3 个短回合，共记录 12 个行为样本
- 测试模型边界、任务拆解、验证意识和 Agent 工作流
- 候选人获得可传播的 AI Sense 身份勋章
- 招聘方后台查看稳定性、高风险底线、严格推荐结论、岗位方向和行为证据
- 结果页包含 AI Sense 简历投递入口
- 完成测试后可将结果提交到飞书多维表格代理
- 响应式布局，适配电脑和平板/手机

## 本地预览

```bash
python3 -m http.server 4173
```

然后访问：

- 候选人页面：http://localhost:4173/
- 招聘方后台：http://localhost:4173/?recruiter=1

## 发布到 GitHub Pages

推送到 GitHub 公开仓库的 `main` 分支后，可在仓库的 `Settings -> Pages` 中选择 `Deploy from a branch`，分支选择 `main`，目录选择 `/root`。

发布完成后，公开地址通常是：

```text
https://<你的 GitHub 用户名>.github.io/<仓库名>/
```

## 招聘方后台入口

公开页面后，在地址后追加：

```text
?recruiter=1
```

例如：

```text
https://<你的 GitHub 用户名>.github.io/<仓库名>/?recruiter=1
```

## 飞书表格接入

飞书多维表格建议至少建立以下字段：

- 是否值得推荐
- 推荐公司
- 适合岗位

为了便于后续复盘，也建议一起建立：

- 候选人编号
- 测评时间
- AI Sense 身份
- AI Sense 分数
- 稳定性
- 风险底线
- 模型边界
- 任务拆解
- 验证意识
- Agent 工作流
- 严格结论
- 关键证据

公开网页里不要直接放飞书 App Secret。正式招聘后台采用三张飞书多维表格：候选人结果表、游戏回合明细表、公司与岗位规则表。网站通过服务端代理或 Cloudflare Worker 写入一条候选人结果和 12 条回合证据，示例见 `feishu-worker.example.js`，完整配置见 `FEISHU_SETUP.md`。

飞书应用授权后，可以用一次性脚本自动补齐表结构：

```bash
FEISHU_APP_ID="..." FEISHU_APP_SECRET="..." \
FEISHU_APP_TOKEN="..." FEISHU_CANDIDATE_TABLE_ID="..." \
node scripts/setup-feishu.mjs
```

代理部署好后，把它的公开 POST 地址填入 `feishu-config.js`：

```js
window.AI_SENSE_FEISHU_ENDPOINT = "https://你的代理地址";
```

候选人完成测试后，页面会自动提交一条记录，核心三列会按以下规则生成：

- 是否值得推荐：强推荐 / 可推荐 / 不推荐
- 推荐公司：达到推荐线时按最高能力方向生成公司类型；未达线时不推荐公司
- 适合岗位：按模型边界、任务拆解、验证意识、Agent 工作流生成岗位方向
