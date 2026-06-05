# Feishu Resume Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let candidates upload a resume from the result page and attach it to the same Feishu candidate record that already stores the AI Sense screening result.

**Architecture:** The public page keeps the candidate record ID returned by the existing Feishu proxy. When a candidate selects a resume, the browser sends a bounded base64 payload to the same Cloudflare Worker. The Worker uploads the file to Feishu Drive as a Bitable attachment, then updates the candidate table row's `简历附件` field with the returned `file_token`.

**Tech Stack:** Vanilla JavaScript, Cloudflare Workers Fetch/FormData APIs, Feishu Bitable record APIs, Feishu Drive media upload API, Node built-in tests.

---

### Task 1: Add Resume Attachment Schema

**Files:**
- Modify: `scripts/setup-feishu.mjs`
- Modify: `test/feishu-schema.test.mjs`

- [ ] Add a `简历附件` attachment field with type `17` to `CANDIDATE_FIELDS`.
- [ ] Add a schema test assertion that `CANDIDATE_FIELDS` includes `简历附件`.

### Task 2: Extend The Worker

**Files:**
- Modify: `feishu-worker.example.js`
- Modify: `test/feishu-worker.test.mjs`

- [ ] Add a resume upload branch that accepts `resume.candidateRecordId`, `resume.fileName`, `resume.mimeType`, `resume.size`, and `resume.dataBase64`.
- [ ] Reject empty files, files over 20 MB, missing candidate record IDs, and unsupported extensions.
- [ ] Upload the file to `/open-apis/drive/v1/medias/upload_all` using `parent_type=bitable_file` and `parent_node=FEISHU_APP_TOKEN`.
- [ ] Update the existing candidate record with `{ "简历附件": [{ "file_token": token }] }`.
- [ ] Test that the Worker makes token, upload, and update calls in order.

### Task 3: Wire The Candidate UI

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `test/app-payload.test.mjs`

- [ ] Store the returned Feishu candidate `record_id` in the latest result snapshot.
- [ ] Replace the mailto CTA with a real upload button.
- [ ] Read the selected resume as base64 and POST it to the Worker.
- [ ] Show clear candidate-facing states: waiting for result sync, uploading, uploaded, or failed.

### Task 4: Verify And Publish

**Files:**
- Modify only source files already listed above.

- [ ] Run `node --test test/*.test.mjs`.
- [ ] Run syntax checks for `app.js`, `feishu-worker.example.js`, and `scripts/setup-feishu.mjs`.
- [ ] Preview the result page in the browser.
- [ ] Commit and push to `main`.
