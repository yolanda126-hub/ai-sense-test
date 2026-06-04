# Feishu Recruiter Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send every completed AI Sense assessment into a private Feishu Bitable recruiter backend with one candidate record and twelve round evidence records.

**Architecture:** The browser builds a structured assessment payload from its existing game state. A Cloudflare Worker-compatible proxy validates the payload, writes the candidate summary to the existing Feishu table, and batch creates round detail records in a second table using server-side credentials.

**Tech Stack:** Vanilla JavaScript, Node built-in test runner, Feishu Bitable OpenAPI, Cloudflare Workers

---

### Task 1: Add Structured Round Results

**Files:**
- Create: `test/app-payload.test.mjs`
- Modify: `app.js`

- [ ] Write a failing Node test that expects the app to retain structured round results and build a `{ candidate, rounds, source }` payload.
- [ ] Run `node --test test/app-payload.test.mjs` and confirm it fails because structured round results are missing.
- [ ] Add `roundResults` to state, capture each submitted choice, and build the Feishu assessment payload.
- [ ] Run `node --test test/app-payload.test.mjs` and confirm it passes.

### Task 2: Expand The Secure Feishu Proxy

**Files:**
- Create: `test/feishu-worker.test.mjs`
- Modify: `feishu-worker.example.js`

- [ ] Write failing tests for payload validation, candidate field whitelisting, and twelve-row batch creation.
- [ ] Run `node --test test/feishu-worker.test.mjs` and confirm the tests fail.
- [ ] Implement candidate record creation followed by round detail batch creation using separate table IDs.
- [ ] Run `node --test test/feishu-worker.test.mjs` and confirm the tests pass.

### Task 3: Document Deployment And Table Schema

**Files:**
- Modify: `FEISHU_SETUP.md`
- Modify: `README.md`

- [ ] Document the three Feishu tables, exact field names, required permissions, and Worker environment variables.
- [ ] Document that `FEISHU_APP_SECRET` must be stored as a secret and never committed.
- [ ] Verify documentation field names match the website payload and proxy whitelists.

### Task 4: Create Feishu Tables And Configure API Access

**Files:**
- Modify: `feishu-config.js`

- [ ] Create the candidate result columns in the existing Bitable table.
- [ ] Create `游戏回合明细表` and its columns.
- [ ] Create `公司与岗位规则表` and its columns.
- [ ] Create or configure a Feishu Open Platform app with Bitable record permissions.
- [ ] Deploy the proxy with Feishu credentials stored as secrets.
- [ ] Put the deployed proxy URL in `feishu-config.js`.

### Task 5: Verify And Publish

**Files:**
- Modify: `index.html`

- [ ] Run `node --test test/*.test.mjs` and confirm all tests pass.
- [ ] Complete a local browser assessment and confirm the payload contains one candidate and twelve rounds.
- [ ] Complete a production assessment and confirm Feishu receives one candidate row and twelve detail rows.
- [ ] Update asset version strings, commit the changes, push `main`, and verify GitHub Pages.

