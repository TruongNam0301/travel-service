# Chat Flow Logic

## Overview

This document describes the complete flow when a user sends a chat message through the API.

## API Endpoint

**POST** `/conversations/:id/chat`

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. API Request                                                  │
│    POST /conversations/:id/chat                                 │
│    Body: { "content": "What are good hotels in HCMC?" }         │
│    Headers: Authorization: Bearer {token}                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Authentication & Authorization                              │
│    - JWT token validation                                       │
│    - Rate limiting check (30 req/min per user)                  │
│    - User ownership verification                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. ChatService.sendMessage()                                    │
│    Input: userId, conversationId, userMessage                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Get Conversation & Verify Ownership                          │
│    - ConversationsService.findOne(conversationId, userId)       │
│    - Returns: conversation object with planId                   │
│    - Throws 404 if not found or unauthorized                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Save User Message                                            │
│    - MessagesService.create(userId, conversationId, content)     │
│    - Creates message with role: USER                            │
│    - Updates conversation.lastMessageAt                          │
│    - Updates conversation.messageCount                           │
│    - Returns: saved user message                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Build Context (FinalContextComposer)                         │
│    This step builds rich context from multiple sources           │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │                                          │
        ▼                                          ▼
┌───────────────────────────┐        ┌───────────────────────────┐
│ 6a. Conversation Context  │        │ 6b. Plan Context         │
│     Builder               │        │     Builder               │
│                           │        │                           │
│ - Get recent messages     │        │ - Get plan metadata       │
│   (default: 20 messages) │        │ - Get recent jobs (5)      │
│ - Trim to token limit     │        │ - Get embeddings summary  │
│ - Summarize long msgs     │        │ - Format plan info        │
│   (>500 tokens)           │        │ - Apply token budget      │
│ - Format for LLM          │        │                           │
└───────────┬───────────────┘        └───────────┬───────────────┘
            │                                    │
            └────────────────┬───────────────────┘
                             │
                             ▼
        ┌───────────────────────────────────────┐
        │ 6c. Embedding Context Builder         │
        │                                       │
        │ - Use userMessage as query            │
        │ - Semantic search embeddings          │
        │   (topK: 10, threshold: 0.7)         │
        │ - Filter by similarity                │
        │ - Format memory blocks                │
        │ - Apply token budget                  │
        └───────────────┬───────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Final Context Composition                                    │
│    - Merge all contexts (plan + embeddings + conversation)      │
│    - Apply token budget rules:                                  │
│      Priority: messages > embeddings > plan                    │
│    - Trim if over budget (default: 8000 tokens)                │
│    - Format final prompt structure                              │
│    - Returns: formatted context string                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Build LLM Prompt                                             │
│    System Prompt:                                               │
│    "You are a helpful travel assistant..."                      │
│                                                                 │
│    User Prompt:                                                 │
│    [Context from step 7]                                        │
│    User: {userMessage}                                          │
│    Assistant:                                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. Call LLM API                                                 │
│    - LLMClient.generate(prompt, options)                        │
│    - Options:                                                   │
│      * system: systemPrompt                                     │
│      * temperature: 0.7                                         │
│      * maxTokens: 2000                                          │
│    - Returns: { text, usage, model, latencyMs }                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 10. Save Assistant Message                                      │
│     - MessagesService.createAssistantMessage()                  │
│     - Creates message with role: ASSISTANT                      │
│     - Updates conversation.lastMessageAt                        │
│     - Updates conversation.messageCount                         │
│     - Returns: saved assistant message                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 11. Return Response                                             │
│     {                                                            │
│       "message": { ... assistant message ... },                 │
│       "conversation": { ... conversation ... },                 │
│       "usage": {                                                │
│         "input": 150,                                           │
│         "output": 200,                                          │
│         "total": 350                                            │
│       }                                                         │
│     }                                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Step-by-Step Flow

### Step 1: API Request

- **Endpoint**: `POST /conversations/:id/chat`
- **Authentication**: JWT Bearer token required
- **Rate Limit**: 30 requests per minute per user
- **Request Body**:
  ```json
  {
    "content": "What are good hotels in Ho Chi Minh City?"
  }
  ```

### Step 2: Authentication & Validation

- JWT token validation
- User extraction from token
- Rate limiting check
- Request body validation (content required, max 10,000 chars)

### Step 3: Get Conversation

- Verify conversation exists
- Verify user owns the conversation (via plan ownership)
- Extract `planId` from conversation
- **Error**: Returns 404 if conversation not found or unauthorized

### Step 4: Save User Message

- Normalize message content (trim whitespace)
- Create message entity with:
  - `role`: `USER`
  - `content`: normalized user message
  - `conversationId`: from URL parameter
  - `createdBy`: userId from token
- Save to database
- Update conversation metadata:
  - `lastMessageAt`: current timestamp
  - `messageCount`: increment by 1

### Step 5: Build Context (Parallel Execution)

#### 5a. Conversation Context Builder

1. **Fetch Messages**:
   - Get recent messages (default: 20, but fetch 40 for trimming)
   - Order by `createdAt DESC`
   - Filter: `isDeleted = false`

2. **Process Long Messages**:
   - For each message > 500 tokens:
     - Call LLM to summarize
     - Replace with: `[Summarized from X tokens] {summary}`
   - If summarization fails, keep original

3. **Token Trimming**:
   - Calculate total tokens
   - If over budget (default: 50% of 8000 = 4000 tokens):
     - Remove oldest messages first
     - Trim message content if needed
   - Preserve word boundaries when trimming

4. **Format**:

   ```
   ## Conversation History

   User: {message1}
   Assistant: {message2}
   ...
   ```

#### 5b. Plan Context Builder

1. **Fetch Plan Data**:
   - Get plan by ID
   - Extract metadata (if exists)

2. **Fetch Recent Jobs**:
   - Get last 5 completed jobs
   - Order by `finishedAt DESC`
   - Include job type, state, summary

3. **Get Embeddings Summary**:
   - Call `MemoryCompressionService.getMemoryStats()`
   - Get: total, active, archived embeddings
   - Get last compression info (if exists)

4. **Format**:

   ```
   ## Plan: {plan.title}
   Plan ID: {plan.id}

   ### Plan Metadata
   {JSON metadata}

   ### Recent Jobs (5)
   - {job.type} ({job.state}): {job.summary}

   ### Memory Summary
   Total embeddings: X (Y active, Z archived)
   Last compression: {mode} mode, {ratio}% reduction
   ```

5. **Token Budget**:
   - Default: 15% of total (1200 tokens)
   - Trim if over budget (remove metadata first, then reduce jobs)

#### 5c. Embedding Context Builder

1. **Semantic Search**:
   - Use `userMessage` as query
   - Generate query embedding via LLM
   - Search similar embeddings:
     - `topK`: 10 (default)
     - `threshold`: 0.7 (default)
     - Filter by `planId`
     - Order by similarity DESC

2. **Format Results**:

   ```
   ## Relevant Memory (10 items)

   ### Memory Item (85.3% relevant, message)
   Reference ID: {refId}
   Content: {embedding.content}
   ```

3. **Token Budget**:
   - Default: 35% of total (2800 tokens)
   - Trim if over budget (reduce number of embeddings, then trim content)

### Step 6: Final Context Composition

1. **Token Budget Allocation**:

   ```
   Total Budget: 8000 tokens (default)
   - Messages: 4000 tokens (50%)
   - Embeddings: 2800 tokens (35%)
   - Plan: 1200 tokens (15%)
   ```

2. **Merge Contexts** (with priority):
   - If total > budget:
     - **Priority 1**: Keep conversation context (highest priority)
     - **Priority 2**: Trim embeddings (take 60% of excess)
     - **Priority 3**: Trim plan metadata (take remaining excess)
     - **Last Resort**: Trim conversation if still over

3. **Format Final Prompt**:

   ```
   [Plan Context]

   [Embedding Context]

   [Conversation Context]
   ```

### Step 7: Build LLM Prompt

- **System Prompt**:

  ```
  You are a helpful travel assistant. You help users plan their trips,
  find hotels, restaurants, and attractions. Use the provided context
  (conversation history, plan information, and relevant memories) to
  give personalized and helpful responses.
  ```

- **User Prompt**:

  ```
  [Context from step 6]

  User: {userMessage}

  Assistant:
  ```

### Step 8: Call LLM API

- **Model**: From config (default: `gpt-4o-mini`)
- **Parameters**:
  - `temperature`: 0.7
  - `maxTokens`: 2000
  - `system`: system prompt
  - `user`: user prompt with context
- **Response**:
  - `text`: Generated response
  - `usage`: Token usage stats
  - `model`: Model used
  - `latencyMs`: API call duration

### Step 9: Save Assistant Message

- Create message entity with:
  - `role`: `ASSISTANT`
  - `content`: LLM response text
  - `conversationId`: from URL parameter
  - `createdBy`: userId from token
- Save to database
- Update conversation metadata:
  - `lastMessageAt`: current timestamp
  - `messageCount`: increment by 1

### Step 10: Return Response

```json
{
  "message": {
    "id": "uuid",
    "conversationId": "uuid",
    "role": "assistant",
    "content": "Here are some great hotels...",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "conversation": {
    "id": "uuid",
    "planId": "uuid",
    "title": "...",
    "messageCount": 10,
    "lastMessageAt": "2024-01-01T00:00:00Z"
  },
  "usage": {
    "input": 150,
    "output": 200,
    "total": 350
  }
}
```

---

## Error Handling

### Context Building Failures

- **Behavior**: Log warning, continue without context
- **Result**: Chat still works, but without rich context

### LLM API Failures

- **Behavior**: Log error, return fallback message
- **Fallback**: "I apologize, but I'm having trouble generating a response right now. Please try again."

### Database Failures

- **Behavior**: Throw error, return 500
- **Result**: Request fails, user message may or may not be saved

---

## Token Budget Example

**Scenario**: Total context = 10,000 tokens, Budget = 8,000 tokens

1. **Initial Allocation**:
   - Messages: 4,000 tokens
   - Embeddings: 3,500 tokens
   - Plan: 1,500 tokens
   - **Total**: 9,000 tokens ❌

2. **Trimming**:
   - Excess: 1,000 tokens
   - Trim embeddings: 1,000 × 0.6 = 600 tokens
   - New embeddings: 3,500 - 600 = 2,900 tokens
   - **New Total**: 8,400 tokens ❌

3. **Further Trimming**:
   - Remaining excess: 400 tokens
   - Trim plan: 1,500 - 400 = 1,100 tokens
   - **Final Total**: 8,000 tokens ✅

---

## Performance Optimizations

1. **Parallel Context Building**:
   - Conversation, Plan, and Embedding contexts built in parallel
   - Reduces total latency

2. **Token Estimation**:
   - Fast approximation (4 chars ≈ 1 token)
   - No need for exact tokenization

3. **Caching Opportunities**:
   - Plan metadata (short TTL)
   - Embeddings summary (short TTL)

4. **Early Exit**:
   - Skip embedding search if no query provided
   - Skip conversation context if no conversationId

---

## Configuration

Environment variables (defaults):

- `CONTEXT_BUILDER_MAX_TOKENS`: 8000
- `CONTEXT_BUILDER_MESSAGE_LIMIT`: 20
- `CONTEXT_BUILDER_EMBEDDING_TOP_K`: 10
- `CONTEXT_BUILDER_EMBEDDING_THRESHOLD`: 0.7
- `CONTEXT_BUILDER_JOB_LIMIT`: 5
- `CONTEXT_BUILDER_LONG_MESSAGE_THRESHOLD`: 500
