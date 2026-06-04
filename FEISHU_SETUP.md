# Feishu Bitable Recruiter Backend

The AI Sense website submits completed assessments to Feishu through a secure
serverless proxy. Never put a Feishu App Secret in `feishu-config.js`, GitHub
Pages, or any committed file.

## Current Bitable

- URL: https://fcnz6if8b609.feishu.cn/base/OOklbLHAga688OsWFKdcNPdQn4g?table=tblYdrdS1ejfx3gZ&view=vewkNNdZOc
- App token: `OOklbLHAga688OsWFKdcNPdQn4g`
- Candidate result table ID: `tblYdrdS1ejfx3gZ`

## Table Architecture

### 候选人结果表

One row per completed assessment:

`候选人编号`, `测评时间`, `是否值得推荐`, `推荐公司`, `适合岗位`,
`AI Sense 身份`, `AI Sense 分数`, `稳定性`, `风险底线`, `模型边界`,
`任务拆解`, `验证意识`, `Agent 工作流`, `严格结论`, `关键证据`, `来源`

### 游戏回合明细表

Twelve rows per completed assessment:

`候选人编号`, `游戏名称`, `能力维度`, `回合编号`, `场景名称`, `题目类型`,
`候选人选择`, `正确答案`, `回合得分`, `是否高风险题`, `是否触发风险`,
`行为证据`

### 公司与岗位规则表

Recruiter-maintained reference rules:

`规则名称`, `主能力维度`, `最低总分`, `最低单项分`, `最低稳定性`,
`必须通过风险底线`, `推荐公司`, `适合岗位`, `备注`

## Feishu App Permissions

Create a Feishu custom app and enable Bitable permissions that allow the app to
view, edit, and manage the target Bitable. The app identity must also have edit
permission on the Bitable document itself.

Feishu API references:

- Create table: https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table/create
- Create field: https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-field/create
- Create record: https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/create
- Batch create records: https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/batch_create

## Initialize The Tables

After the Feishu app is authorized, run the idempotent setup script:

```bash
FEISHU_APP_ID="your_app_id" \
FEISHU_APP_SECRET="your_app_secret" \
FEISHU_APP_TOKEN="OOklbLHAga688OsWFKdcNPdQn4g" \
FEISHU_CANDIDATE_TABLE_ID="tblYdrdS1ejfx3gZ" \
node scripts/setup-feishu.mjs
```

The script adds missing candidate columns, creates the two additional tables, and
prints their table IDs.

## Deploy The Secure Proxy

Deploy `feishu-worker.example.js` as a Cloudflare Worker or equivalent serverless
proxy. Configure:

```txt
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret
FEISHU_APP_TOKEN=OOklbLHAga688OsWFKdcNPdQn4g
FEISHU_CANDIDATE_TABLE_ID=tblYdrdS1ejfx3gZ
FEISHU_ROUND_TABLE_ID=the_round_table_id_printed_by_the_setup_script
```

Store `FEISHU_APP_SECRET` as a secret, not as a plaintext variable. Cloudflare
Workers secret documentation:
https://developers.cloudflare.com/workers/configuration/secrets/

After deployment, set the public endpoint in `feishu-config.js`:

```js
window.AI_SENSE_FEISHU_ENDPOINT = "https://ai-sense-feishu.yolandawang126.workers.dev";
window.AI_SENSE_FEISHU_AUTO_SUBMIT = true;
```

Commit and push the config change. GitHub Pages will auto-publish it.

## Recommended Feishu Views

- `强推荐候选人`: `是否值得推荐 = 强推荐`
- `可推荐待复核`: `是否值得推荐 = 可推荐`
- `风险底线未通过`: `风险底线 = 未通过`
- `Agent 人才池`: `适合岗位` contains `Agent`
- `模型评测人才池`: `适合岗位` contains `模型评测`
- `本周新增`: `测评时间` is within the current week
