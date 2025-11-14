Got it. Here’s a **ticket-ready backlog** you can drop straight into Jira/Linear. Each task includes purpose, scope (files/funcs), acceptance, deps, and a T-shirt estimate.

---

# 🔷 Epic: LLM Integration (Phase 4)

### WM-401 — Create LlmModule (client provider + config)

**Why:** Foundation to call any LLM safely and consistently.
**Scope:**

- `src/modules/llm.module.ts`
- `src/services/llm/llm.client.ts` (interface: `generate`, `embed`)
- `src/services/llm/providers/openai.client.ts` (real impl, env driven)
- `src/config/env.schema.ts` (+ LLM keys, model, timeout, retries)
  **Acceptance:**
- `LlmClient.generate(prompt, {system?, temperature?})` returns `{ text, usage: { input, output, total }, model, latencyMs }`.
- `LlmClient.embed(text[])` returns `Float32Array[]`.
- Timeouts + retries (expo backoff) logged via Pino with `action=llm.call`.
  **Deps:** Config, Logger.
  **Estimate:** M

### WM-402 — PromptTemplatesModule + renderer

**Why:** DB-stored prompts with paramized rendering.
**Scope:**

- `src/modules/prompt-templates.module.ts`
- `src/services/prompt-templates.service.ts` (`render(templateId|jobType, ctx)`)
- Simple renderer (Mustache-like) + unit tests for conditionals/loops (or token replace if you prefer KISS).
  **Acceptance:**
- Rendering supports: variables, sections (if/each), safe default on missing keys.
- Throws structured error on invalid template, logged with `templateId`.
  **Deps:** LlmModule (later), JobTypes.
  **Estimate:** M

### WM-403 — JobTypesModule (+ params schema validation)

**Why:** Validate job params before enqueue; map job types to templates.
**Scope:**

- `src/modules/job-types.module.ts`, `src/services/job-types.service.ts`
- `getByName(type)`, `validateParams(type, params)` (Zod schemas read from DB).
  **Acceptance:**
- `JobsService.create()` rejects invalid params with 400; error shows Zod path.
- Seed 3 types: `research_hotel`, `find_food`, `find_attraction`.
  **Deps:** DB entity exists, JobsService.
  **Estimate:** S/M

### WM-404 — Replace placeholder processors with real LLM calls

**Why:** Produce real structured results.
**Scope:**

- `src/queue/job.processor.ts` call chain: JobTypes → PromptTemplates → LlmClient.
- Parse JSON to `BaseJobResponse<T>`; store in `jobs.result`.
  **Acceptance:**
- POST job → worker → LLM → DB result saved; tokens/latency recorded.
- Failure path marks `FAILED` with `error.code` and `error.message`.
  **Deps:** 401–403.
  **Estimate:** M

### WM-405 — Token usage & cost logging

**Why:** Control spend and enable dashboards.
**Scope:**

- Extend `jobs` with `usage_input_tokens`, `usage_output_tokens`, `usage_total_tokens`, `cost_usd` (nullable).
- Per-call cost calc via provider pricing map (config).
  **Acceptance:**
- Completed job row shows accurate usage; logged in Pino (`action=llm.usage`).
  **Deps:** 401, 404; DB migration.
  **Estimate:** S

---

# 🟩 Epic: Vector Memory (Phase 5)

### WM-501 — EmbeddingsModule (service + controller)

**Why:** Persist vectors for semantic recall.
**Scope:**

- `src/modules/embeddings.module.ts`
- `src/services/embeddings.service.ts`
- `createForMessage(messageId)`, `createForJob(jobId)` → calls `LlmClient.embed`
  **Acceptance:**
- Writes to `embeddings` with correct `plan_id`, `ref_type` (`message|job`), `vector`.
- Validates vector size and upserts by `(ref_type, ref_id)`.
  **Deps:** 401.
  **Estimate:** M

### WM-502 — Background embedding hooks

**Why:** Auto-index content as it’s created.
**Scope:**

- Emit internal event `MessageCreated` & `JobCompleted` (domain events).
- Subscriber calls `EmbeddingsService` (dedupe via upsert).
  **Acceptance:**
- Creating a message or completing a job triggers embedding creation when `EMBEDDINGS_ENABLED=true`.
  **Deps:** 501, MessagesService, JobsService.
  **Estimate:** S

### WM-503 — POST /embeddings/search (plan-scoped cosine)

**Why:** Semantic recall within a plan.
**Scope:**

- `POST /embeddings/search { planId, query, topK }`
- SQL using pgvector `<->` operator; returns refs + scores.
  **Acceptance:**
- Returns top-k with `{refType, refId, score, snippet}`; ownership enforced.
  **Deps:** 501.
  **Estimate:** M

### WM-504 — Summarization compression job (optional)

**Why:** Keep vector count low & cheaper context.
**Scope:**

- BullMQ job `summarize_conversation(planId, conversationId)` → writes compressed note + embedding.
  **Acceptance:**
- After N messages, summary is created; verified by E2E stub.
  **Deps:** 401, 501.
  **Estimate:** M (optional)

---

# 🟨 Epic: Observability & Ops

### WM-601 — Queue metrics endpoint

**Why:** Operability of workers.
**Scope:**

- `GET /queue/metrics` → `{waiting, active, completed, failed, delayed}` (BullMQ).
  **Acceptance:**
- Auth required (admin role or feature flag).
- Works in prod/staging; logged with `action=queue.metrics`.
  **Deps:** QueueModule.
  **Estimate:** S

### WM-602 — Error taxonomy + redaction audit

**Why:** Greppable logs & no PII leakage.
**Scope:**

- Standardize `error.code` enums; ensure redaction of `authorization`, `password`, `refreshToken`, `content` on error paths.
  **Acceptance:**
- 3 representative failures show redacted logs in dev.
  **Deps:** Logger config.
  **Estimate:** S

---

# 🟦 Epic: API Docs & DX

### WM-701 — Swagger/OpenAPI bootstrap

**Why:** Contract for FE and QA.
**Scope:**

- Install `@nestjs/swagger`; set up `/docs`; add JWT bearer; sample schemas for all DTOs.
- Export `openapi.json` on build (CI artifact).
  **Acceptance:**
- All routes visible, with request/response and error shapes; includes `X-API-Contract` header.
  **Deps:** None.
  **Estimate:** S

### WM-702 — Body size limit + 413 path

**Why:** Align infra with 10k content rule.
**Scope:**

- `main.ts` `app.use(json({ limit: '12kb' }))`; controller returns 413 for oversize.
  **Acceptance:**
- Sending >10k chars to messages yields 413 (tested).
  **Deps:** Messages.
  **Estimate:** XS

---

# 🟫 Epic: Testing (Phase 7 kickstart)

### WM-801 — Testcontainers bootstrap (Postgres + Redis)

**Why:** Reliable, isolated E2E.
**Scope:**

- `test/jest-e2e.json`, `test/test-setup.ts`, helper factories.
  **Acceptance:**
- Containers spin in <2 min locally/CI; env wired to app.
  **Deps:** None.
  **Estimate:** S

### WM-802 — E2E: Auth → Plan → Job → status

**Why:** Golden path.
**Scope:**

- Register → login → create plan → create job → poll status.
  **Acceptance:**
- Asserts `PENDING→QUEUED→(PROCESSING)→COMPLETED/FAILED`.
  **Deps:** 801.
  **Estimate:** S/M

### WM-803 — E2E: Conversation & Messages + rate limit

**Why:** Verify Phase 3 behavior.
**Scope:**

- Create conversation (or default), post messages (≤10k), list paginated ASC; hit rate-limit 60/min.
  **Acceptance:**
- 413 for >10k; throttling keyed by `userId`.
  **Deps:** 801.
  **Estimate:** S

### WM-804 — Race test: single default conversation

**Why:** Ensure unique default invariant.
**Scope:**

- Concurrent `isDefault=true` create; expect 201 and 409.
  **Acceptance:**
- 409 handled gracefully (PG 23505).
  **Deps:** Conversations.
  **Estimate:** XS

---

# 🟥 Epic: Security & Policy

### WM-901 — Ownership leakage policy (404 everywhere)

**Why:** Prevent ID enumeration.
**Scope:**

- Audit controllers/services for consistent 404 on unauthorized across Plans/Jobs/Conversations/Messages.
  **Acceptance:**
- 4 targeted tests pass (cross-user access → 404).
  **Deps:** Existing modules.
  **Estimate:** XS

### WM-902 — Throttler per-user tracker

**Why:** Mobile/VPN users share IPs; throttle by user.
**Scope:**

- Custom ThrottlerGuard: override `getTracker()` to use `req.user.id || ip`.
  **Acceptance:**
- Two users behind same IP don’t block each other; single user rate-limited as configured.
  **Deps:** Throttler.
  **Estimate:** S

---

# 🧩 Epic: Small UX/Data Enhancements

### WM-1001 — Auto-title conversation from first message

**Why:** Better UX with minimal logic.
**Scope:**

- On first message for a conversation with `title=null`, set title = first 50 chars.
  **Acceptance:**
- Verified via E2E; title remains editable.
  **Deps:** Messages, Conversations.
  **Estimate:** XS

### WM-1002 — Consistent response envelope extras

**Why:** Easier debugging.
**Scope:**

- TransformInterceptor adds `requestId` and `durationMs` to envelope.
  **Acceptance:**
- Present on all responses; requestId correlates with logs.
  **Deps:** Existing interceptor.
  **Estimate:** XS

---

## Notes on sequencing

- Start with **WM-701, 702, 801** (docs/limits/tests) to lock the contract.
- Parallelize **401–404** (LLM core) and **601/902** (ops & throttling).
- Kick off **501–503** once 401 is in.
- Keep **802–804** green as regression guard.
