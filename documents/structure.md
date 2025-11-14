Makes sense. Let’s streamline the backlog for a 2-dev team and focus only on what moves the product: LLM + embeddings + minimal ops. I’ve removed WM-701, WM-702, WM-801 and replaced them with ultra-light alternatives (README + Postman + a single smoke script).

# 🎯 Minimal, High-Impact Backlog (ticket-ready)

## 🔷 Epic: LLM Integration (Phase 4)

### WM-401 — LlmModule (provider interface + config)

**Goal:** One thin client to call any LLM.
**Scope:**

- Files: `src/modules/llm.module.ts`, `src/services/llm/llm.client.ts`, `src/services/llm/providers/openai.client.ts`
- Env: `LLM_API_KEY`, `LLM_MODEL`, `LLM_TIMEOUT_MS` (optional), `LLM_MAX_RETRIES` (optional)
  **Acceptance:**
- `LlmClient.generate(prompt, opts)` → `{ text, usage: {input, output, total}, model, latencyMs }`
- `LlmClient.embed(texts)` → `number[][]` (float arrays)
- Retries (2) + timeout; logs include `action: 'llm.call'` and `jobId` when present.
  **Est.:** M
  **Deps:** none

### WM-402 — PromptTemplatesService (minimal renderer)

**Goal:** Render prompts with variables from DB.
**Scope:**

- Files: `src/services/prompt-templates.service.ts`
- API: `renderByJobType(type, ctx)` (string replace `${var}` only; no conditionals)
  **Acceptance:**
- Missing var → leaves `${var}` as-is (does not crash)
- Logged with `action: 'prompt.render'`, `{ type }`
  **Est.:** S
  **Deps:** none

### WM-403 — JobTypesService (params validation)

**Goal:** Validate job params before enqueue.
**Scope:**

- Files: `src/services/job-types.service.ts`
- API: `validate(type, params)` using Zod schemas hardcoded for now (hotel/food/attraction)
  **Acceptance:**
- `JobsService.create()` returns 400 with Zod issues when invalid.
  **Est.:** S
  **Deps:** Jobs module

### WM-404 — Wire processor to LLM (replace placeholders)

**Goal:** Produce real structured results.
**Scope:**

- Edit `src/queue/job.processor.ts`: for each type → render prompt → `LlmClient.generate()` → parse JSON → save to `jobs.result`
- Create `parseSafeJson(str)` helper with error mapping
  **Acceptance:**
- POST job → state progresses to `COMPLETED` with structured `result` OR `FAILED` with `error.message`
- Tokens + latency saved if provided by provider
  **Est.:** M
  **Deps:** 401–403

### WM-405 — Usage tracking (DB fields)

**Goal:** Track spend & usage.
**Scope:**

- Migration: add nullable columns on `jobs` (`usage_input_tokens`, `usage_output_tokens`, `usage_total_tokens`, `latency_ms`, `model`)
- Save values in processor after LLM call
  **Acceptance:**
- Completed jobs show usage, visible via `GET /jobs/:id`
  **Est.:** S
  **Deps:** 404

---

## 🟩 Epic: Vector Memory (Phase 5)

### WM-501 — EmbeddingsService (createForMessage / createForJob)

**Goal:** Generate and store vectors.
**Scope:**

- Files: `src/modules/embeddings.module.ts`, `src/services/embeddings.service.ts`
- Methods: `createForMessage(messageId)`, `createForJob(jobId)` → calls `LlmClient.embed()` and writes to `embeddings` (upsert by ref)
  **Acceptance:**
- Stores `{ plan_id, ref_type, ref_id, vector }` with matching dimension
  **Est.:** M
  **Deps:** 401

### WM-502 — Auto-embedding hooks (simple events)

**Goal:** Index content automatically.
**Scope:**

- Emit lightweight events in code paths:
  - After message create → `EmbeddingsService.createForMessage` (fire-and-forget `try/catch`)
  - After job completed → `EmbeddingsService.createForJob`
    **Acceptance:**

- When `EMBEDDINGS_ENABLED=true`, a new message or job result gets an embedding row (errors logged, don’t break request)
  **Est.:** S
  **Deps:** 501

### WM-503 — POST /embeddings/search (plan-scoped cosine)

**Goal:** Minimal semantic recall.
**Scope:**

- Endpoint: `POST /embeddings/search { planId, query, topK? }`
- SQL: `ORDER BY vector <-> queryVec LIMIT topK` (pgvector)
- Return `{ refType, refId, score }[]`
  **Acceptance:**
- Ownership enforced by `planId → userId`
- Returns stable top-k with scores
  **Est.:** M
  **Deps:** 501

---

## 🟨 Epic: Ops & Minimal QA

### WM-601 — Queue metrics (tiny)

**Goal:** Quick visibility on workers.
**Scope:**

- Endpoint: `GET /queue/metrics` → `{ waiting, active, completed, failed, delayed }`
- Guard: reuse JWT; no roles for now
  **Acceptance:**
- Returns numbers from BullMQ queue; logs `{ action: 'queue.metrics' }`
  **Est.:** XS
  **Deps:** QueueModule

### WM-602 — Error codes + redaction check

**Goal:** Greppable logs; no secrets in errors.
**Scope:**

- Add `code` to common errors: `E_PARAM_INVALID`, `E_LLM_TIMEOUT`, `E_PARSE_JSON`
- Ensure Pino redacts `authorization`, `password`, `refreshToken`; keep message content out of error logs
  **Acceptance:**
- 3 simulated failures show clean redacted logs with `code`
  **Est.:** XS
  **Deps:** Logger

---

## 🟦 Epic: Ultra-light Testing & DX (no Testcontainers, no Swagger)

### WM-801A — Smoke script (one file)

**Goal:** A single end-to-end sanity check with dev stack.
**Scope:**

- File: `scripts/smoke.e2e.ts` (run against `docker-compose` dev DB/Redis)
- Steps: register → login → create plan → create job → poll until COMPLETED/FAILED → post a message → embeddings.search
  **Acceptance:**
- Run via `pnpm smoke:e2e`; exit code 0 on pass, non-zero on fail; prints concise timings
  **Est.:** S
  **Deps:** running dev stack

### WM-802A — Postman collection + README

**Goal:** Manual testing for 2-dev workflow.
**Scope:**

- `docs/WanderMind.postman_collection.json` with Auth/Plans/Jobs/Conversations/Messages/Embeddings requests
- README section: “Manual QA flow” with 7 steps and expected JSON snippets
  **Acceptance:**
- Importable collection; steps reproduce the smoke path manually
  **Est.:** XS
  **Deps:** none

---

# Lightweight manual QA flow (put into README)

1. Register & login → capture `accessToken`.
2. `POST /plans` → returns planId (check default conversation created if enabled).
3. `POST /plans/:planId/jobs` (type=research_hotel) → get jobId.
4. Poll `GET /jobs/:id` until `COMPLETED`/`FAILED`.
5. `POST /conversations/:id/messages` (<=10k chars) → returns messageId.
6. (If `EMBEDDINGS_ENABLED=true`) search: `POST /embeddings/search { planId, query }` → see refs.
7. `GET /queue/metrics` → numbers change over time.

---

# Suggested order (two short sprints)

- **Sprint A:** WM-401, WM-402, WM-403, WM-404, WM-801A
- **Sprint B:** WM-405, WM-501, WM-502, WM-503, WM-601, WM-602, WM-802A

Want me to spit out the **code stubs for WM-401 (LlmClient + OpenAI provider)** and the **smoke.e2e.ts** runner so you can paste and run?
