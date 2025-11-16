# 🧠 **Phase 6 — Memory Intelligence (Compression Engine & Context Builders)**

This phase focuses on reducing long-term embedding storage size, improving recall quality, and enabling scalable memory.

---

## **6.1 Memory Compression — Strategy**

### **Compression Goals**

- Keep memory fresh + relevant
- Reduce embedding count by ~40–60%
- Maintain search quality

### **Redundancy Rules**

- **Duplicate threshold**: similarity ≥ 0.97
- **Low-value**: no usage in 30+ days
- **Outdated**: older than 90 days

### **Merging Strategy**

- KNN-based clustering (recommended over K-means for efficiency)
- LLM summary generation per cluster
- Create 1 summary embedding per cluster
- Archive original embeddings
- Never cluster embeddings < 14 days old (keep fresh)

### **Archival Strategy**

- Soft delete via `isDeleted = true`
- Retain archived embeddings for 90 days

### **Compression Modes**

- `"light"` → Dedup only (remove duplicates with similarity ≥ 0.97)
- `"full"` → Cluster + merge + archive

### **Job Contract**

```ts
{
  planId: string;
  mode: "light" | "full";
}
```

### **Configuration Constants**

- Similarity threshold: `0.95` (for clustering)
- Duplicate threshold: `0.97` (for deduplication)
- Retention days: `90` (for archival)
- Min cluster size: `2`
- Max cluster size: `50`
- Min age for clustering: `14 days`
- Low-value threshold: `30 days`

---

## **6.2 Memory Compression — Implementation**

### **Core Logic**

- [x] Implement `findRedundantEmbeddings(planId)`
- [x] Implement clustering (similarity-based grouping)
- [x] Implement embedding merging
- [x] Implement summary generation
- [x] Implement archival logic

### **Service**

- [x] Create `MemoryCompressionService`
  - [x] `compressPlanMemory(planId)`
  - [x] `groupSimilarEmbeddings()`
  - [x] `mergeCluster()`
  - [x] `archiveEmbeddings()`

- [x] Integrate with EmbeddingsService
- [x] Enforce plan ownership

### **Queue Jobs**

- [x] Add BullMQ job type: `memory_compression`
- [x] Add worker for compression
- [x] Add retry/backoff logic

---

## **6.3 Memory Compression — Scheduling & Automation**

- [x] Create CRON schedule
  - nightly compression (daily at 2 AM UTC)
  - weekly summarization (Sundays at 3 AM UTC)

- [x] Add `.env` variables
  - `MEMORY_COMPRESSION_ENABLED` (default: true)
  - `MEMORY_COMPRESSION_INTERVAL` (default: "0 2 \* \* \*")
  - `MEMORY_ARCHIVE_THRESHOLD` (default: 1000)
  - `MEMORY_INACTIVE_PLAN_DAYS` (default: 30)
  - `MEMORY_COMPRESSION_MIN_EMBEDDINGS_THRESHOLD` (default: 50)
  - `MEMORY_COMPRESSION_PRESERVE_RECENT_COUNT` (default: 20)
  - `MEMORY_COMPRESSION_ACTIVE_CONVERSATION_DAYS` (default: 7)

- [x] Trigger compression when:
  - embeddings > threshold
  - plan inactive for long period

---

## **6.4 Metrics, Logging, Observability**

- [x] Log number of embeddings before/after
- [x] Log number merged or archived
- [x] Log compression ratio
- [x] Emit worker metrics (latency, duration, CPU)
- [x] Add `/plans/:id/memory/stats` endpoint

---

## **6.5 Memory Safety**

- [x] Add DRY-RUN mode (no changes, just stats)
- [x] Minimum embeddings threshold before compression
- [x] Skip last N "fresh" embeddings
- [x] Prevent deletion of active conversation context

---

## **6.6 Memory Context Builders (for LLM)**

_(Part of Memory Intelligence, same phase)_

### **Conversation Context Builder**

- [ ] Gather recent messages
- [ ] Token-limit trimming
- [ ] Summaries for long messages

### **Plan Context Builder**

- [ ] Include plan metadata
- [ ] Include recent job data
- [ ] Include embeddings summary

### **Embedding Context Builder**

- [ ] Retrieve top-k embeddings
- [ ] Apply similarity threshold
- [ ] Build memory block for LLM

### **Final Context Composer**

- [ ] Merge plan + message + embedding context
- [ ] Apply token budget rules
- [ ] Produce final prompt the LLM will use

---

# 📊 **Phase 7 — Cost Tracking & Usage Metrics**

_(Renumbered. Phase 7 is next after Memory Intelligence.)_

## **7.1 Token Usage Logging**

- [ ] Store input/output token counts
- [ ] Store model id
- [ ] Store cost per request
- [ ] Add migration

## **7.2 Usage Reporting**

- [ ] `/usage/by-plan` endpoint
- [ ] `/usage/monthly`
- [ ] `/usage/models`

## **7.3 Alerts**

- [ ] Per-user cost thresholds
- [ ] Plan-level alerting

---

# 🗂 **Phase 8 — Job Types & Prompt Management**

- [ ] CRUD for job types
- [ ] Schema validation
- [ ] Prompt editing
- [ ] Prompt preview endpoint
- [ ] Add system prompts for future agents

---

# 📘 **Phase 9 — Deployment, Setup, Documentation**

- [ ] Update README
- [ ] Add architecture diagram
- [ ] Add memory flow diagram
- [ ] Document embeddings + compression system
- [ ] Deployment instructions (PM2 + Docker)
- [ ] ENV variable documentation

---

# ✔ Summary

Phase 6 (new):

- Memory Compression
- Memory Context Builders
- Observability & Automation
