# 🔄 WanderMind Travel Service - Sequence Diagrams

## Sequence Diagrams

This document contains sequence diagrams for key interactions in the WanderMind Travel Service.

## 1. User Registration Sequence

```mermaid
sequenceDiagram
    participant Client
    participant AuthController
    participant AuthService
    participant UsersService
    participant Database

    Client->>AuthController: POST /auth/register
    AuthController->>AuthController: Validate DTO
    AuthController->>AuthService: register(registerDto)
    AuthService->>UsersService: findByEmail(email)
    UsersService->>Database: SELECT * FROM users WHERE email = ?
    Database-->>UsersService: User or null
    UsersService-->>AuthService: User or null

    alt User exists
        AuthService-->>AuthController: Throw EmailAlreadyExists
        AuthController-->>Client: 409 Conflict
    else User does not exist
        AuthService->>AuthService: hashPassword(password)
        AuthService->>UsersService: create(userData)
        UsersService->>Database: INSERT INTO users ...
        Database-->>UsersService: User entity
        UsersService-->>AuthService: User entity
        AuthService-->>AuthController: User entity
        AuthController-->>Client: 201 Created + User data
    end
```

## 2. User Login Sequence

```mermaid
sequenceDiagram
    participant Client
    participant AuthController
    participant AuthService
    participant UsersService
    participant Database
    participant JWT

    Client->>AuthController: POST /auth/login
    AuthController->>AuthController: Validate DTO
    AuthController->>AuthService: login(loginDto)
    AuthService->>UsersService: findByEmail(email)
    UsersService->>Database: SELECT * FROM users WHERE email = ?
    Database-->>UsersService: User or null
    UsersService-->>AuthService: User or null

    alt User not found
        AuthService-->>AuthController: Throw InvalidCredentials
        AuthController-->>Client: 401 Unauthorized
    else User found
        AuthService->>AuthService: comparePassword(password, hash)
        alt Password incorrect
            AuthService-->>AuthController: Throw InvalidCredentials
            AuthController-->>Client: 401 Unauthorized
        else Password correct
            AuthService->>JWT: generateAccessToken(user)
            JWT-->>AuthService: accessToken
            AuthService->>JWT: generateRefreshToken(user)
            JWT-->>AuthService: refreshToken
            AuthService->>AuthService: hashRefreshToken(refreshToken)
            AuthService->>Database: INSERT INTO refresh_tokens ...
            Database-->>AuthService: RefreshToken entity
            AuthService->>UsersService: updateLastLogin(userId)
            UsersService->>Database: UPDATE users SET last_login_at = ?
            Database-->>UsersService: Updated user
            UsersService-->>AuthService: Updated user
            AuthService-->>AuthController: { accessToken, refreshToken, user }
            AuthController-->>Client: 200 OK + Tokens
        end
    end
```

## 3. Create Plan Sequence

```mermaid
sequenceDiagram
    participant Client
    participant PlansController
    participant PlansService
    participant ConversationsService
    participant Database

    Client->>PlansController: POST /plans
    PlansController->>PlansController: Validate DTO + JWT Auth
    PlansController->>PlansService: create(userId, createPlanDto)
    PlansService->>PlansService: verifyOwnership(userId, planId)
    PlansService->>Database: BEGIN TRANSACTION
    PlansService->>Database: INSERT INTO plans ...
    Database-->>PlansService: Plan entity
    PlansService->>PlansService: Should create default conversation?

    alt Create default conversation
        PlansService->>ConversationsService: createWithManager(planId, { isDefault: true })
        ConversationsService->>Database: INSERT INTO conversations ...
        Database-->>ConversationsService: Conversation entity
        ConversationsService-->>PlansService: Conversation entity
    end

    PlansService->>Database: COMMIT TRANSACTION
    Database-->>PlansService: Success
    PlansService-->>PlansController: Plan entity
    PlansController-->>Client: 201 Created + Plan data
```

## 4. Create and Process Job Sequence

```mermaid
sequenceDiagram
    participant Client
    participant JobsController
    participant JobsService
    participant JobTypesService
    participant Database
    participant BullMQ
    participant JobProcessor
    participant PromptTemplatesService
    participant LlmClient
    participant OpenAI

    Client->>JobsController: POST /plans/:planId/jobs
    JobsController->>JobsController: Validate DTO + JWT Auth
    JobsController->>JobsService: create(planId, userId, createJobDto)
    JobsService->>JobsService: verifyOwnership(userId, planId)
    JobsService->>JobTypesService: validate(jobType, params)
    JobTypesService-->>JobsService: Validation result

    alt Validation failed
        JobsService-->>JobsController: Throw ValidationException
        JobsController-->>Client: 400 Bad Request
    else Validation passed
        JobsService->>Database: INSERT INTO jobs (state: PENDING)
        Database-->>JobsService: Job entity
        JobsService->>BullMQ: addJob(jobType, jobData)
        BullMQ-->>JobsService: Job enqueued

        alt Enqueue failed
            JobsService->>Database: UPDATE jobs SET state = FAILED
            JobsService-->>JobsController: Throw InternalServerError
            JobsController-->>Client: 500 Internal Server Error
        else Enqueue success
            JobsService->>Database: UPDATE jobs SET state = QUEUED
            JobsService-->>JobsController: Job entity
            JobsController-->>Client: 201 Created + Job data
        end
    end

    Note over BullMQ,JobProcessor: Worker Process (Separate)
    BullMQ->>JobProcessor: process(job)
    JobProcessor->>Database: UPDATE jobs SET state = PROCESSING
    JobProcessor->>PromptTemplatesService: render(jobType, params)
    PromptTemplatesService-->>JobProcessor: Rendered prompt
    JobProcessor->>LlmClient: generate(prompt, options)
    LlmClient->>OpenAI: POST /chat/completions
    OpenAI-->>LlmClient: LLM Response
    LlmClient-->>JobProcessor: { text, usage, model }
    JobProcessor->>JobProcessor: parseResult(text)
    JobProcessor->>Database: UPDATE jobs SET state = COMPLETED, result = ?
    Database-->>JobProcessor: Updated job
```

## 5. Chat Message Sequence

```mermaid
sequenceDiagram
    participant Client
    participant MessagesController
    participant ChatService
    participant MessagesService
    participant ConversationsService
    participant FinalContextComposer
    participant ConversationContextBuilder
    participant PlanContextBuilder
    participant EmbeddingContextBuilder
    participant LlmClient
    participant OpenAI
    participant Database

    Client->>MessagesController: POST /conversations/:id/chat
    MessagesController->>MessagesController: Validate DTO + JWT Auth
    MessagesController->>ChatService: sendMessage(userId, conversationId, content)
    ChatService->>ConversationsService: findOne(conversationId, userId)
    ConversationsService->>Database: SELECT * FROM conversations WHERE id = ?
    Database-->>ConversationsService: Conversation entity
    ConversationsService-->>ChatService: Conversation entity

    ChatService->>MessagesService: create(userId, conversationId, { content })
    MessagesService->>Database: INSERT INTO messages ...
    Database-->>MessagesService: Message entity
    MessagesService-->>ChatService: User message entity

    ChatService->>FinalContextComposer: composeContext({ planId, conversationId, query })

    par Build contexts in parallel
        FinalContextComposer->>ConversationContextBuilder: buildConversationContext(conversationId)
        ConversationContextBuilder->>MessagesService: getRecentMessages(conversationId)
        MessagesService->>Database: SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC
        Database-->>MessagesService: Messages array
        MessagesService-->>ConversationContextBuilder: Messages array
        ConversationContextBuilder-->>FinalContextComposer: ConversationContext
    and
        FinalContextComposer->>PlanContextBuilder: buildPlanContext(planId)
        PlanContextBuilder->>Database: SELECT * FROM plans WHERE id = ?
        Database-->>PlanContextBuilder: Plan entity
        PlanContextBuilder-->>FinalContextComposer: PlanContext
    and
        FinalContextComposer->>EmbeddingContextBuilder: buildEmbeddingContext(planId, query)
        EmbeddingContextBuilder->>LlmClient: embed([query])
        LlmClient->>OpenAI: POST /embeddings
        OpenAI-->>LlmClient: Embedding vector
        LlmClient-->>EmbeddingContextBuilder: Embedding vector
        EmbeddingContextBuilder->>Database: SELECT * FROM embeddings WHERE plan_id = ? ORDER BY vector <-> ? LIMIT ?
        Database-->>EmbeddingContextBuilder: Similar embeddings
        EmbeddingContextBuilder-->>FinalContextComposer: EmbeddingContext
    end

    FinalContextComposer->>FinalContextComposer: applyTokenBudget(contexts)
    FinalContextComposer->>FinalContextComposer: formatFinalPrompt(contexts)
    FinalContextComposer-->>ChatService: FinalContext

    ChatService->>LlmClient: generate(prompt, { system, temperature })
    LlmClient->>OpenAI: POST /chat/completions
    OpenAI-->>LlmClient: LLM Response
    LlmClient-->>ChatService: { text, usage, model }

    ChatService->>MessagesService: createAssistantMessage(userId, conversationId, response)
    MessagesService->>Database: INSERT INTO messages (role: ASSISTANT)
    Database-->>MessagesService: Assistant message entity
    MessagesService-->>ChatService: Assistant message entity

    ChatService->>ConversationsService: findOne(conversationId, userId)
    ConversationsService->>Database: SELECT * FROM conversations WHERE id = ?
    Database-->>ConversationsService: Updated conversation
    ConversationsService-->>ChatService: Updated conversation

    ChatService-->>MessagesController: { message, conversation, usage }
    MessagesController-->>Client: 200 OK + Chat response
```

## 6. Create Embedding Sequence

```mermaid
sequenceDiagram
    participant Client
    participant EmbeddingsController
    participant EmbeddingsService
    participant PlansService
    participant LlmClient
    participant OpenAI
    participant Database

    Client->>EmbeddingsController: POST /embeddings
    EmbeddingsController->>EmbeddingsController: Validate DTO + JWT Auth
    EmbeddingsController->>EmbeddingsService: create(userId, createEmbeddingDto)
    EmbeddingsService->>PlansService: verifyOwnership(userId, planId)
    PlansService->>Database: SELECT * FROM plans WHERE id = ? AND user_id = ?
    Database-->>PlansService: Plan or null
    PlansService-->>EmbeddingsService: Ownership verified

    EmbeddingsService->>LlmClient: embed([content])
    LlmClient->>OpenAI: POST /embeddings
    OpenAI-->>LlmClient: Embedding vector
    LlmClient-->>EmbeddingsService: Embedding vector

    EmbeddingsService->>Database: INSERT INTO embeddings (vector, content, ...)
    Database-->>EmbeddingsService: Embedding entity
    EmbeddingsService-->>EmbeddingsController: Embedding entity
    EmbeddingsController-->>Client: 201 Created + Embedding data
```

## 7. Semantic Search Sequence

```mermaid
sequenceDiagram
    participant Client
    participant EmbeddingsController
    participant EmbeddingsService
    participant PlansService
    participant LlmClient
    participant OpenAI
    participant Database

    Client->>EmbeddingsController: POST /plans/:planId/embeddings/search
    EmbeddingsController->>EmbeddingsController: Validate DTO + JWT Auth
    EmbeddingsController->>EmbeddingsService: searchSimilar(userId, planId, searchDto)
    EmbeddingsService->>PlansService: verifyOwnership(userId, planId)
    PlansService->>Database: SELECT * FROM plans WHERE id = ? AND user_id = ?
    Database-->>PlansService: Plan or null
    PlansService-->>EmbeddingsService: Ownership verified

    EmbeddingsService->>LlmClient: embed([query])
    LlmClient->>OpenAI: POST /embeddings
    OpenAI-->>LlmClient: Query embedding vector
    LlmClient-->>EmbeddingsService: Query embedding vector

    EmbeddingsService->>Database: SELECT *, 1 - (vector <=> ?) as similarity<br/>FROM embeddings<br/>WHERE plan_id = ? AND is_deleted = false<br/>ORDER BY vector <-> ?<br/>LIMIT ?
    Database-->>EmbeddingsService: Similar embeddings with scores

    EmbeddingsService->>EmbeddingsService: Filter by threshold
    EmbeddingsService->>EmbeddingsService: Paginate results
    EmbeddingsService-->>EmbeddingsController: Paginated results
    EmbeddingsController-->>Client: 200 OK + Search results
```

## 8. Token Refresh Sequence

```mermaid
sequenceDiagram
    participant Client
    participant AuthController
    participant AuthService
    participant Database
    participant JWT

    Client->>AuthController: POST /auth/refresh
    AuthController->>AuthController: Validate DTO + Refresh Token Auth
    AuthController->>AuthService: refreshAccessToken(refreshToken)
    AuthService->>AuthService: verifyRefreshToken(refreshToken)
    AuthService->>Database: SELECT * FROM refresh_tokens WHERE token_hash = ?
    Database-->>AuthService: RefreshToken entity or null

    alt Token not found
        AuthService-->>AuthController: Throw InvalidToken
        AuthController-->>Client: 401 Unauthorized
    else Token found
        AuthService->>AuthService: Check if expired

        alt Token expired
            AuthService->>Database: DELETE FROM refresh_tokens WHERE id = ?
            AuthService-->>AuthController: Throw TokenExpired
            AuthController-->>Client: 401 Unauthorized
        else Token valid
            AuthService->>AuthService: Check if revoked

            alt Token revoked
                AuthService-->>AuthController: Throw TokenRevoked
                AuthController-->>Client: 401 Unauthorized
            else Token active
                AuthService->>JWT: generateAccessToken(user)
                JWT-->>AuthService: New accessToken
                AuthService->>JWT: generateRefreshToken(user)
                JWT-->>AuthService: New refreshToken
                AuthService->>Database: DELETE FROM refresh_tokens WHERE id = ?
                AuthService->>Database: INSERT INTO refresh_tokens ...
                Database-->>AuthService: New RefreshToken entity
                AuthService-->>AuthController: { accessToken, refreshToken }
                AuthController-->>Client: 200 OK + New tokens
            end
        end
    end
```

## 9. Memory Compression Sequence

```mermaid
sequenceDiagram
    participant Scheduler
    participant MemoryCompressionService
    participant EmbeddingsService
    participant Database
    participant LlmClient
    participant OpenAI

    Scheduler->>MemoryCompressionService: compressMemories(planId)
    MemoryCompressionService->>EmbeddingsService: findByPlan(planId)
    EmbeddingsService->>Database: SELECT * FROM embeddings WHERE plan_id = ? AND is_deleted = false
    Database-->>EmbeddingsService: Embeddings array
    EmbeddingsService-->>MemoryCompressionService: Embeddings array

    MemoryCompressionService->>MemoryCompressionService: clusterSimilar(embeddings)
    MemoryCompressionService->>MemoryCompressionService: selectRepresentatives(clusters)
    MemoryCompressionService->>MemoryCompressionService: identifyRedundant(embeddings, representatives)

    loop For each redundant embedding
        MemoryCompressionService->>Database: UPDATE embeddings SET is_deleted = true WHERE id = ?
        Database-->>MemoryCompressionService: Updated
    end

    MemoryCompressionService->>Database: UPDATE plans SET metadata = ? WHERE id = ?
    Database-->>MemoryCompressionService: Updated plan
    MemoryCompressionService-->>Scheduler: Compression complete
```

## 10. Context Building Sequence (Detailed)

```mermaid
sequenceDiagram
    participant ChatService
    participant FinalContextComposer
    participant ConversationContextBuilder
    participant PlanContextBuilder
    participant EmbeddingContextBuilder
    participant MessagesService
    participant PlansService
    participant JobsService
    participant EmbeddingsService
    participant LlmClient
    participant Database

    ChatService->>FinalContextComposer: composeContext({ planId, conversationId, query })
    FinalContextComposer->>FinalContextComposer: calculateTokenBudget(maxTokens)

    par Build Conversation Context
        FinalContextComposer->>ConversationContextBuilder: buildConversationContext(conversationId, { maxTokens })
        ConversationContextBuilder->>MessagesService: getRecentMessages(conversationId, limit)
        MessagesService->>Database: SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?
        Database-->>MessagesService: Messages array
        MessagesService-->>ConversationContextBuilder: Messages array

        alt Long messages exist
            ConversationContextBuilder->>LlmClient: generate(summarizePrompt)
            LlmClient-->>ConversationContextBuilder: Summaries
        end

        ConversationContextBuilder->>ConversationContextBuilder: formatConversation(messages, summaries)
        ConversationContextBuilder->>ConversationContextBuilder: estimateTokens(formatted)
        ConversationContextBuilder-->>FinalContextComposer: ConversationContext
    and Build Plan Context
        FinalContextComposer->>PlanContextBuilder: buildPlanContext(planId, { maxTokens })
        PlanContextBuilder->>PlansService: findOneById(planId)
        PlansService->>Database: SELECT * FROM plans WHERE id = ?
        Database-->>PlanContextBuilder: Plan entity
        PlanContextBuilder->>JobsService: findRecentJobs(planId, limit)
        JobsService->>Database: SELECT * FROM jobs WHERE plan_id = ? ORDER BY created_at DESC LIMIT ?
        Database-->>JobsService: Jobs array
        JobsService-->>PlanContextBuilder: Jobs array
        PlanContextBuilder->>PlanContextBuilder: formatPlan(plan, jobs)
        PlanContextBuilder->>PlanContextBuilder: estimateTokens(formatted)
        PlanContextBuilder-->>FinalContextComposer: PlanContext
    and Build Embedding Context
        FinalContextComposer->>EmbeddingContextBuilder: buildEmbeddingContext(planId, query, { maxTokens })
        EmbeddingContextBuilder->>LlmClient: embed([query])
        LlmClient-->>EmbeddingContextBuilder: Query embedding
        EmbeddingContextBuilder->>EmbeddingsService: searchSimilar(planId, queryEmbedding, { topK })
        EmbeddingsService->>Database: SELECT *, 1 - (vector <=> ?) as similarity FROM embeddings WHERE plan_id = ? ORDER BY vector <-> ? LIMIT ?
        Database-->>EmbeddingsService: Similar embeddings
        EmbeddingsService-->>EmbeddingContextBuilder: Similar embeddings
        EmbeddingContextBuilder->>EmbeddingContextBuilder: formatEmbeddings(embeddings)
        EmbeddingContextBuilder->>EmbeddingContextBuilder: estimateTokens(formatted)
        EmbeddingContextBuilder-->>FinalContextComposer: EmbeddingContext
    end

    FinalContextComposer->>FinalContextComposer: applyTokenBudget(contexts, maxTokens)
    FinalContextComposer->>FinalContextComposer: formatFinalPrompt(contexts)
    FinalContextComposer-->>ChatService: FinalContext
```

## 11. Error Handling Sequence

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant Service
    participant GlobalExceptionFilter
    participant Logger

    Client->>Controller: HTTP Request
    Controller->>Service: serviceMethod()

    alt Exception thrown
        Service-->>Controller: Throw Exception
        Controller-->>GlobalExceptionFilter: Exception caught

        GlobalExceptionFilter->>GlobalExceptionFilter: Identify exception type
        GlobalExceptionFilter->>GlobalExceptionFilter: Extract error details

        alt AppException
            GlobalExceptionFilter->>GlobalExceptionFilter: Extract metadata
        else HttpException
            GlobalExceptionFilter->>GlobalExceptionFilter: Extract HTTP data
        else Unknown
            GlobalExceptionFilter->>GlobalExceptionFilter: Extract generic data
        end

        GlobalExceptionFilter->>GlobalExceptionFilter: Format error response
        GlobalExceptionFilter->>Logger: Log error (level based on type)
        Logger-->>GlobalExceptionFilter: Logged

        alt Development mode
            GlobalExceptionFilter->>GlobalExceptionFilter: Include stack trace
        else Production mode
            GlobalExceptionFilter->>GlobalExceptionFilter: Skip stack trace
        end

        GlobalExceptionFilter-->>Controller: Error response
        Controller-->>Client: HTTP Error Response
    else Success
        Service-->>Controller: Result
        Controller-->>Client: HTTP Success Response
    end
```

## 12. Rate Limiting Sequence

```mermaid
sequenceDiagram
    participant Client
    participant ThrottlerGuard
    participant Redis
    participant Controller

    Client->>ThrottlerGuard: HTTP Request
    ThrottlerGuard->>ThrottlerGuard: Extract rate limit key (user ID or IP)
    ThrottlerGuard->>Redis: GET rate_limit:key

    alt Key exists
        Redis-->>ThrottlerGuard: Current count
        ThrottlerGuard->>ThrottlerGuard: Check if count < limit

        alt Count < limit
            ThrottlerGuard->>Redis: INCR rate_limit:key
            Redis-->>ThrottlerGuard: New count
            ThrottlerGuard-->>Controller: Allow request
            Controller-->>Client: Response
        else Count >= limit
            ThrottlerGuard-->>Client: 429 Too Many Requests
        end
    else Key does not exist
        ThrottlerGuard->>Redis: SET rate_limit:key 1 EX ttl
        Redis-->>ThrottlerGuard: Key created
        ThrottlerGuard-->>Controller: Allow request
        Controller-->>Client: Response
    end
```

## Interaction Patterns

### Synchronous Interactions

- Most API endpoints are synchronous
- Immediate response to client
- Database operations are blocking

### Asynchronous Interactions

- Job processing via BullMQ
- Worker process handles jobs separately
- Client receives job ID immediately

### Parallel Processing

- Context building (conversation, plan, embedding)
- Multiple database queries in parallel
- Improved performance

### Error Propagation

- Exceptions bubble up through layers
- Global exception filter catches all
- Consistent error response format

### Transaction Management

- Database transactions for multi-step operations
- Rollback on failure
- Consistency guarantees
