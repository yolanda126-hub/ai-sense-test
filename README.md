# AI Sense Test

一个像素风 AI Sense 测试小游戏，用于候选人外部展示与招聘方内部画像参考。

## 功能

- 4 道 MBTI 风格短题生成像素角色
- 3 个 AI 探索点测试模型评测、Agent 产品、商业判断
- 候选人获得可传播的 AI Sense 身份勋章
- 招聘方后台查看严格指标、公司匹配和行为证据
- 结果页包含 AI Sense 简历投递入口
- 响应式布局，适配电脑和平板/手机

## 本地预览

```bash
python3 -m http.server 4173
```

然后访问：

- 候选人页面：http://localhost:4173/
- 招聘方后台：http://localhost:4173/?recruiter=1

## 发布到 GitHub Pages

本项目包含 `.github/workflows/pages.yml`。推送到 GitHub 公开仓库的 `main` 分支后，可在仓库的 `Settings -> Pages` 中选择 `GitHub Actions` 作为发布来源。

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
