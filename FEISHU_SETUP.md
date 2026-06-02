# Feishu Bitable Setup

This project is ready to submit AI Sense results to Feishu through a secure proxy.
Do not put Feishu app secrets in `feishu-config.js` or any GitHub Pages file.

## Current Bitable

- URL: https://fcnz6if8b609.feishu.cn/base/OOklbLHAga688OsWFKdcNPdQn4g?table=tblYdrdS1ejfx3gZ&view=vewkNNdZOc
- App token: `OOklbLHAga688OsWFKdcNPdQn4g`
- Table ID: `tblYdrdS1ejfx3gZ`

## Required Fields

The table already has the three public recruiting fields:

- `是否值得推荐`
- `推荐公司`
- `适合岗位`

The web app also sends optional context fields when the proxy accepts them:

- `候选人编号`
- `测评时间`
- `AI Sense 身份`
- `AI Sense 分数`
- `总分`
- `推荐等级`
- `岗位方向`
- `公司池`
- `严格结论`
- `候选人画像`
- `关键证据`
- `提交来源`

## Secure Proxy Env Vars

Deploy `feishu-worker.example.js` as a Cloudflare Worker or equivalent serverless proxy, then set:

```txt
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret
FEISHU_APP_TOKEN=OOklbLHAga688OsWFKdcNPdQn4g
FEISHU_TABLE_ID=tblYdrdS1ejfx3gZ
```

After deployment, set the public endpoint in `feishu-config.js`:

```js
window.AI_SENSE_FEISHU_ENDPOINT = "https://your-worker-url";
window.AI_SENSE_FEISHU_AUTO_SUBMIT = true;
```

Then commit and push the config change. GitHub Pages will auto-publish it.
