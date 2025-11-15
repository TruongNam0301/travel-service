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

- [ ] Implement `findRedundantEmbeddings(planId)`
- [ ] Implement clustering (similarity-based grouping)
- [ ] Implement embedding merging
- [ ] Implement summary generation
- [ ] Implement archival logic

### **Service**

- [ ] Create `MemoryCompressionService`
  - [ ] `compressPlanMemory(planId)`
  - [ ] `groupSimilarEmbeddings()`
  - [ ] `mergeCluster()`
  - [ ] `archiveEmbeddings()`

- [ ] Integrate with EmbeddingsService
- [ ] Enforce plan ownership

### **Queue Jobs**

- [ ] Add BullMQ job type: `memory_compression`
- [ ] Add worker for compression
- [ ] Add retry/backoff logic

---

## **6.3 Memory Compression — Scheduling & Automation**

- [ ] Create CRON schedule
  - nightly compression
  - weekly summarization

- [ ] Add `.env` variables
  - `MEMORY_COMPRESSION_ENABLED`
  - `MEMORY_COMPRESSION_INTERVAL`
  - `MEMORY_ARCHIVE_THRESHOLD`

- [ ] Trigger compression when:
  - embeddings > threshold
  - plan inactive for long period

---

## **6.4 Metrics, Logging, Observability**

- [ ] Log number of embeddings before/after
- [ ] Log number merged or archived
- [ ] Log compression ratio
- [ ] Emit worker metrics (latency, duration, CPU)
- [ ] (Optional) Add `/plans/:id/memory/stats` endpoint

---

## **6.5 Memory Safety**

- [ ] Add DRY-RUN mode (no changes, just stats)
- [ ] Minimum embeddings threshold before compression
- [ ] Skip last N “fresh” embeddings
- [ ] Prevent deletion of active conversation context

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
