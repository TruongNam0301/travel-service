# 🔄 WanderMind Travel Service - BPMN Diagrams

## Business Process Model and Notation (BPMN)

This document contains BPMN diagrams for key business processes in the WanderMind Travel Service.

## 1. User Registration Process

```mermaid
flowchart TD
    Start([User Registration Request]) --> Validate[Validate Input]
    Validate -->|Invalid| Error1[Return Validation Error]
    Validate -->|Valid| CheckEmail{Email Exists?}
    CheckEmail -->|Yes| Error2[Return Email Exists Error]
    CheckEmail -->|No| HashPassword[Hash Password]
    HashPassword --> CreateUser[Create User Entity]
    CreateUser --> SaveDB[(Save to Database)]
    SaveDB --> Success[Return User Data]
    Success --> End([End])
    Error1 --> End
    Error2 --> End
```

## 2. User Login Process

```mermaid
flowchart TD
    Start([Login Request]) --> Validate[Validate Credentials]
    Validate -->|Invalid| Error1[Return Invalid Credentials]
    Validate -->|Valid| FindUser[Find User by Email]
    FindUser -->|Not Found| Error1
    FindUser -->|Found| CheckPassword{Password Match?}
    CheckPassword -->|No| Error1
    CheckPassword -->|Yes| GenerateTokens[Generate JWT Tokens]
    GenerateTokens --> SaveRefreshToken[Save Refresh Token]
    SaveRefreshToken --> UpdateLastLogin[Update Last Login]
    UpdateLastLogin --> ReturnTokens[Return Access & Refresh Tokens]
    ReturnTokens --> End([End])
    Error1 --> End
```

## 3. Plan Creation Process

```mermaid
flowchart TD
    Start([Create Plan Request]) --> Auth[Authenticate User]
    Auth -->|Unauthorized| Error1[Return 401]
    Auth -->|Authorized| Validate[Validate Plan Data]
    Validate -->|Invalid| Error2[Return Validation Error]
    Validate -->|Valid| CreatePlan[Create Plan Entity]
    CreatePlan --> SavePlan[(Save Plan to DB)]
    SavePlan --> CreateDefaultConv{Create Default<br/>Conversation?}
    CreateDefaultConv -->|Yes| CreateConv[Create Default Conversation]
    CreateConv --> SaveConv[(Save Conversation to DB)]
    SaveConv --> ReturnPlan[Return Plan Data]
    CreateDefaultConv -->|No| ReturnPlan
    ReturnPlan --> End([End])
    Error1 --> End
    Error2 --> End
```

## 4. Job Creation and Processing Process

```mermaid
flowchart TD
    Start([Create Job Request]) --> Auth[Authenticate User]
    Auth -->|Unauthorized| Error1[Return 401]
    Auth -->|Authorized| ValidatePlan{Plan Exists &<br/>Owned by User?}
    ValidatePlan -->|No| Error2[Return Not Found]
    ValidatePlan -->|Yes| ValidateJobType[Validate Job Type & Params]
    ValidateJobType -->|Invalid| Error3[Return Validation Error]
    ValidateJobType -->|Valid| CreateJob[Create Job Entity PENDING]
    CreateJob --> SaveJob[(Save Job to DB)]
    SaveJob --> Enqueue[Enqueue to BullMQ]
    Enqueue -->|Failed| UpdateFailed[Update Job State FAILED]
    UpdateFailed --> Error4[Return Enqueue Error]
    Enqueue -->|Success| UpdateQueued[Update Job State QUEUED]
    UpdateQueued --> ReturnJob[Return Job Data]
    ReturnJob --> End([End])

    Enqueue --> Worker[Worker Process]
    Worker --> UpdateProcessing[Update Job State PROCESSING]
    UpdateProcessing --> RenderTemplate[Render Prompt Template]
    RenderTemplate --> CallLLM[Call LLM API]
    CallLLM -->|Error| UpdateFailed2[Update Job State FAILED]
    CallLLM -->|Success| ParseResult[Parse LLM Response]
    ParseResult --> SaveResult[(Save Result to DB)]
    SaveResult --> UpdateCompleted[Update Job State COMPLETED]
    UpdateCompleted --> End2([Job Complete])

    Error1 --> End
    Error2 --> End
    Error3 --> End
    Error4 --> End
    UpdateFailed2 --> End2
```

## 5. Chat Message Process

```mermaid
flowchart TD
    Start([Chat Message Request]) --> Auth[Authenticate User]
    Auth -->|Unauthorized| Error1[Return 401]
    Auth -->|Authorized| ValidateConv{Conversation Exists &<br/>Owned by User?}
    ValidateConv -->|No| Error2[Return Not Found]
    ValidateConv -->|Yes| CreateUserMsg[Create User Message]
    CreateUserMsg --> SaveUserMsg[(Save User Message)]
    SaveUserMsg --> BuildContext[Build Context]
    BuildContext --> BuildConvContext[Build Conversation Context]
    BuildConvContext --> BuildPlanContext[Build Plan Context]
    BuildPlanContext --> BuildEmbedContext[Build Embedding Context]
    BuildEmbedContext --> ComposeContext[Compose Final Context]
    ComposeContext --> CallLLM[Call LLM with Context]
    CallLLM -->|Error| FallbackResponse[Return Fallback Response]
    CallLLM -->|Success| CreateAssistantMsg[Create Assistant Message]
    CreateAssistantMsg --> SaveAssistantMsg[(Save Assistant Message)]
    SaveAssistantMsg --> UpdateConvMetadata[Update Conversation Metadata]
    UpdateConvMetadata --> ReturnResponse[Return Chat Response]
    FallbackResponse --> CreateAssistantMsg
    ReturnResponse --> End([End])
    Error1 --> End
    Error2 --> End
```

## 6. Embedding Creation Process

```mermaid
flowchart TD
    Start([Create Embedding Request]) --> Auth[Authenticate User]
    Auth -->|Unauthorized| Error1[Return 401]
    Auth -->|Authorized| ValidatePlan{Plan Exists &<br/>Owned by User?}
    ValidatePlan -->|No| Error2[Return Not Found]
    ValidatePlan -->|Yes| ValidateInput[Validate Input Data]
    ValidateInput -->|Invalid| Error3[Return Validation Error]
    ValidateInput -->|Valid| GenerateEmbedding[Call LLM Embed API]
    GenerateEmbedding -->|Error| Error4[Return LLM Error]
    GenerateEmbedding -->|Success| CreateEmbedding[Create Embedding Entity]
    CreateEmbedding --> SaveEmbedding[(Save Embedding to DB)]
    SaveEmbedding --> ReturnEmbedding[Return Embedding Data]
    ReturnEmbedding --> End([End])
    Error1 --> End
    Error2 --> End
    Error3 --> End
    Error4 --> End
```

## 7. Semantic Search Process

```mermaid
flowchart TD
    Start([Semantic Search Request]) --> Auth[Authenticate User]
    Auth -->|Unauthorized| Error1[Return 401]
    Auth -->|Authorized| ValidatePlan{Plan Exists &<br/>Owned by User?}
    ValidatePlan -->|No| Error2[Return Not Found]
    ValidatePlan -->|Yes| ValidateQuery[Validate Search Query]
    ValidateQuery -->|Invalid| Error3[Return Validation Error]
    ValidateQuery -->|Valid| GenerateQueryEmbedding[Generate Query Embedding]
    GenerateQueryEmbedding -->|Error| Error4[Return LLM Error]
    GenerateQueryEmbedding -->|Success| SearchSimilar[Search Similar Embeddings]
    SearchSimilar --> FilterResults[Filter by Threshold]
    FilterResults --> Paginate[Paginate Results]
    Paginate --> ReturnResults[Return Search Results]
    ReturnResults --> End([End])
    Error1 --> End
    Error2 --> End
    Error3 --> End
    Error4 --> End
```

## 8. Memory Compression Process

```mermaid
flowchart TD
    Start([Memory Compression Trigger]) --> CheckSchedule{Scheduled<br/>Compression?}
    CheckSchedule -->|No| End([End])
    CheckSchedule -->|Yes| FindPlans[Find Plans with Many Embeddings]
    FindPlans --> ForEachPlan{For Each Plan}
    ForEachPlan -->|No More| End
    ForEachPlan -->|Next Plan| GetEmbeddings[Get All Embeddings]
    GetEmbeddings --> Cluster[Cluster Similar Embeddings]
    Cluster --> SelectRepresentative[Select Representative Embeddings]
    SelectRepresentative --> DeleteRedundant[Soft Delete Redundant Embeddings]
    DeleteRedundant --> UpdateMetadata[Update Compression Metadata]
    UpdateMetadata --> ForEachPlan
```

## 9. Context Building Process

```mermaid
flowchart TD
    Start([Build Context Request]) --> CalculateBudget[Calculate Token Budget]
    CalculateBudget --> ParallelBuild[Build Contexts in Parallel]
    ParallelBuild --> BuildConv[Build Conversation Context]
    ParallelBuild --> BuildPlan[Build Plan Context]
    ParallelBuild --> BuildEmbed[Build Embedding Context]

    BuildConv --> GetMessages[Get Recent Messages]
    GetMessages --> SummarizeLong[Summarize Long Messages]
    SummarizeLong --> FormatConv[Format Conversation Context]

    BuildPlan --> GetPlan[Get Plan Data]
    GetPlan --> GetJobs[Get Recent Jobs]
    GetJobs --> GetEmbeddingsSummary[Get Embeddings Summary]
    GetEmbeddingsSummary --> FormatPlan[Format Plan Context]

    BuildEmbed --> GenerateQueryEmbed[Generate Query Embedding]
    GenerateQueryEmbed --> SearchSimilar[Search Similar Embeddings]
    SearchSimilar --> FormatEmbed[Format Embedding Context]

    FormatConv --> ApplyBudget[Apply Token Budget]
    FormatPlan --> ApplyBudget
    FormatEmbed --> ApplyBudget

    ApplyBudget --> ComposeFinal[Compose Final Context]
    ComposeFinal --> ReturnContext[Return Final Context]
    ReturnContext --> End([End])
```

## 10. Token Refresh Process

```mermaid
flowchart TD
    Start([Refresh Token Request]) --> ValidateToken[Validate Refresh Token]
    ValidateToken -->|Invalid| Error1[Return Invalid Token]
    ValidateToken -->|Valid| FindToken[Find Refresh Token in DB]
    FindToken -->|Not Found| Error2[Return Token Not Found]
    FindToken -->|Found| CheckExpired{Token Expired?}
    CheckExpired -->|Yes| DeleteToken[Delete Refresh Token]
    DeleteToken --> Error3[Return Token Expired]
    CheckExpired -->|No| CheckRevoked{Token Revoked?}
    CheckRevoked -->|Yes| Error4[Return Token Revoked]
    CheckRevoked -->|No| GenerateNewTokens[Generate New Access & Refresh Tokens]
    GenerateNewTokens --> DeleteOldToken[Delete Old Refresh Token]
    DeleteOldToken --> SaveNewToken[Save New Refresh Token]
    SaveNewToken --> ReturnTokens[Return New Tokens]
    ReturnTokens --> End([End])
    Error1 --> End
    Error2 --> End
    Error3 --> End
    Error4 --> End
```

## 11. Error Handling Process

```mermaid
flowchart TD
    Start([Exception Thrown]) --> CatchException[Global Exception Filter]
    CatchException --> IdentifyType{Exception Type?}
    IdentifyType -->|AppException| ExtractMetadata[Extract Metadata]
    IdentifyType -->|HttpException| ExtractHttpData[Extract HTTP Data]
    IdentifyType -->|Unknown| ExtractGeneric[Extract Generic Data]

    ExtractMetadata --> FormatError[Format Error Response]
    ExtractHttpData --> FormatError
    ExtractGeneric --> FormatError

    FormatError --> LogError{Log Level?}
    LogError -->|Error| LogErrorLevel[Log as Error]
    LogError -->|Warn| LogWarnLevel[Log as Warn]
    LogError -->|Info| LogInfoLevel[Log as Info]

    LogErrorLevel --> IncludeStack{Development Mode?}
    LogWarnLevel --> IncludeStack
    LogInfoLevel --> IncludeStack

    IncludeStack -->|Yes| AddStack[Include Stack Trace]
    IncludeStack -->|No| SkipStack[Skip Stack Trace]

    AddStack --> ReturnResponse[Return Error Response]
    SkipStack --> ReturnResponse
    ReturnResponse --> End([End])
```

## 12. Rate Limiting Process

```mermaid
flowchart TD
    Start([Incoming Request]) --> ExtractKey[Extract Rate Limit Key]
    ExtractKey --> CheckRedis{Check Redis Counter}
    CheckRedis -->|Key Exists| GetCount[Get Current Count]
    CheckRedis -->|Key Not Exists| CreateKey[Create Key with TTL]
    CreateKey --> GetCount

    GetCount --> CheckLimit{Count < Limit?}
    CheckLimit -->|Yes| Increment[Increment Counter]
    CheckLimit -->|No| BlockRequest[Block Request]

    Increment --> AllowRequest[Allow Request]
    BlockRequest --> Return429[Return 429 Too Many Requests]
    AllowRequest --> ProcessRequest[Process Request]
    ProcessRequest --> End([End])
    Return429 --> End
```

## Process Characteristics

### Synchronous Processes

- User Registration
- User Login
- Plan Creation
- Chat Message
- Embedding Creation
- Semantic Search
- Token Refresh

### Asynchronous Processes

- Job Processing (via BullMQ)
- Memory Compression (scheduled)

### Parallel Processing

- Context Building (conversation, plan, embedding contexts built in parallel)

### Error Handling

- All processes include error handling
- Global exception filter catches unhandled errors
- Structured error responses

### Validation

- Input validation at controller level
- Business rule validation at service level
- Database constraints at entity level
