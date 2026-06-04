# Feishu Recruiter Backend Design

## Goal

Move the formal recruiter backend from the public AI Sense website into Feishu
Bitable. The website remains the candidate assessment and a local debugging view;
Feishu becomes the private source of truth for screening, review, and follow-up.

## Architecture

The public website sends one structured assessment payload to a secure serverless
proxy. The proxy validates a strict field whitelist, obtains a Feishu tenant access
token from server-side secrets, creates one candidate result record, then batch
creates the candidate's 12 round evidence records. No Feishu secret is stored in
GitHub Pages or sent to the browser.

The existing Bitable is reused as the candidate result table. Two additional data
tables are added inside the same Bitable:

1. `候选人结果表`: one row per completed assessment.
2. `游戏回合明细表`: twelve rows per completed assessment.
3. `公司与岗位规则表`: recruiter-owned reference rules for company and role matching.

## Candidate Result Table

The existing three fields remain the first recruiter-facing fields:

- `是否值得推荐`
- `推荐公司`
- `适合岗位`

The table also stores:

- `候选人编号`
- `测评时间`
- `AI Sense 身份`
- `AI Sense 分数`
- `模型边界`
- `任务拆解`
- `验证意识`
- `Agent 工作流`
- `稳定性`
- `风险底线`
- `严格结论`
- `关键证据`
- `来源`

Non-recommended candidates are still written to the table. This preserves the
evidence required to audit a strict screening decision.

## Round Detail Table

Each completed assessment writes twelve detail rows with:

- `候选人编号`
- `游戏名称`
- `能力维度`
- `回合编号`
- `场景名称`
- `题目类型`
- `候选人选择`
- `正确答案`
- `回合得分`
- `是否高风险题`
- `是否触发风险`
- `行为证据`

The first version joins candidate and detail records by the stable
`候选人编号`. A Feishu relation field can be added later without changing the
website payload.

## Company And Role Rules Table

This is a manually maintained reference table, not written by the public website.
It contains:

- `规则名称`
- `主能力维度`
- `最低总分`
- `最低单项分`
- `最低稳定性`
- `必须通过风险底线`
- `推荐公司`
- `适合岗位`
- `备注`

The current website matching logic remains the scoring source for the first
release. Recruiters can use this table to review and refine matching rules before
moving rule evaluation fully into Feishu automation.

## Data Flow

1. A candidate completes all 12 rounds.
2. The website computes strict screening, badge, dimension scores, and stability.
3. The website saves a local snapshot and sends `{ candidate, rounds, source }`.
4. The proxy rejects malformed or incomplete payloads.
5. The proxy creates the candidate result row.
6. The proxy batch creates the 12 round detail rows.
7. The candidate sees only a neutral sync status, never recruiter conclusions.

## Error Handling

- If the proxy endpoint is absent, the candidate result still renders normally.
- If candidate record creation fails, no detail rows are attempted.
- If detail row creation fails after the candidate row succeeds, the proxy returns
  a partial failure with the candidate record ID for later reconciliation.
- The proxy limits CORS to the published GitHub Pages origin.
- Feishu `APP_SECRET` is stored only as a serverless secret.

## Recruiter Views

Recommended Feishu views:

- `强推荐候选人`: `是否值得推荐 = 强推荐`
- `可推荐待复核`: `是否值得推荐 = 可推荐`
- `风险底线未通过`: `风险底线 = 未通过`
- `Agent 人才池`: `适合岗位` contains `Agent`
- `模型评测人才池`: `适合岗位` contains `模型评测`
- `本周新增`: `测评时间` is within the current week

## Validation

- Unit tests verify payload construction and proxy validation.
- Browser verification confirms a completed candidate assessment produces 12
  structured round results.
- End-to-end verification confirms one candidate row and twelve detail rows appear
  in Feishu after the proxy is configured.

