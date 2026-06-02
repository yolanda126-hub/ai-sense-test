# AI Sense Test

一个像素风 AI Sense 测试小游戏，用于候选人外部展示与招聘方内部画像参考。

## 功能

- 4 道 MBTI 风格短题生成像素角色
- 3 个 AI 探索点测试模型评测、Agent 产品、商业判断
- 候选人获得可传播的 AI Sense 身份勋章
- 招聘方后台查看严格指标、公司匹配、飞书入表字段和行为证据
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
- 身份代码
- 筛选原因
- 总分
- 校准均分
- 方向聚焦
- 严谨度
- 模型轴
- 产品轴
- 商业轴
- 行为证据

公开网页里不要直接放飞书 App Secret。推荐用一个服务端代理或 Cloudflare Worker 调飞书多维表格 API，示例见 `feishu-worker.example.js`。代理部署好后，把它的公开 POST 地址填入 `feishu-config.js`：

```js
window.AI_SENSE_FEISHU_ENDPOINT = "https://你的代理地址";
```

候选人完成测试后，页面会自动提交一条记录，核心三列会按以下规则生成：

- 是否值得推荐：值得推荐 / 谨慎推荐 / 不推荐
- 推荐公司：达到推荐线时给出匹配公司和适配度；未达线时不推荐公司
- 适合岗位：按模型、产品、商业、企业、内容、基建分数生成岗位方向
