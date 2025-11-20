# 📁 WanderMind Travel Service - Structure Documentation

## Project Structure

```
travel-service/
├── dist/                          # Compiled JavaScript output
├── node_modules/                  # Dependencies
├── scripts/                       # Utility scripts
│   └── init-db.sh                 # Database initialization
├── src/                           # Source code
│   ├── app.module.ts              # Root application module
│   ├── main.ts                    # Application entry point
│   │
│   ├── config/                    # Configuration modules
│   │   ├── app.config.ts          # Application configuration
│   │   ├── database.config.ts     # Database configuration
│   │   ├── redis.config.ts        # Redis configuration
│   │   ├── queue.config.ts        # Queue configuration
│   │   ├── logger.config.ts       # Logger configuration
│   │   ├── env.schema.ts          # Environment validation (Zod)
│   │   ├── context-builder.config.ts
│   │   └── memory-compression.config.ts
│   │
│   ├── core/                      # Core infrastructure modules
│   │   ├── app-core.module.ts     # Aggregates all core modules
│   │   └── cache.module.ts        # Redis cache module
│   │
│   ├── database/                  # Database setup
│   │   ├── database.module.ts     # TypeORM configuration
│   │   └── migrations/            # Database migrations
│   │       └── *.ts               # Migration files
│   │
│   ├── queue/                     # Queue infrastructure
│   │   ├── queue.module.ts        # BullMQ module setup
│   │   ├── queue.service.ts        # Queue management service
│   │   ├── job.processor.ts       # Job processor
│   │   └── main.worker.ts          # Worker entry point
│   │
│   ├── entities/                  # Database entities
│   │   ├── user.entity.ts          # User entity
│   │   ├── plan.entity.ts          # Plan entity
│   │   ├── conversation.entity.ts # Conversation entity
│   │   ├── message.entity.ts       # Message entity
│   │   ├── job.entity.ts           # Job entity
│   │   ├── job-type.entity.ts      # Job type entity
    │   │   ├── prompt-template.entity.ts
│   │   ├── embedding.entity.ts     # Embedding entity (pgvector)
│   │   ├── refresh-token.entity.ts # Refresh token entity
│   │   └── index.ts                # Entity exports
│   │
│   ├── controllers/               # API controllers
│   │   ├── auth.controller.ts      # Authentication endpoints
│   │   ├── users.controller.ts     # User endpoints
│   │   ├── plans.controller.ts     # Plan endpoints
│   │   ├── jobs.controller.ts      # Job endpoints
│   │   ├── conversations.controller.ts
│   │   ├── messages.controller.ts  # Message endpoints
│   │   ├── embeddings.controller.ts
│   │   └── health.controller.ts     # Health check endpoints
│   │
│   ├── services/                  # Business services
│   │   ├── auth.service.ts         # Authentication service
│   │   ├── users.service.ts        # User management service
│   │   ├── plans.service.ts        # Plan management service
│   │   ├── jobs.service.ts         # Job management service
│   │   ├── conversations.service.ts
│   │   ├── messages.service.ts     # Message service
│   │   ├── chat.service.ts         # Chat orchestration service
│   │   ├── embeddings.service.ts   # Embeddings service
│   │   ├── prompt-templates.service.ts
│   │   ├── job-types.service.ts    # Job type validation
│   │   ├── memory-compression.service.ts
│   │   ├── memory-compression-scheduler.service.ts
│   │   └── context-builders/       # Context builder services
│   │       ├── conversation-context-builder.service.ts
│   │       ├── plan-context-builder.service.ts
│   │       ├── embedding-context-builder.service.ts
│   │       └── final-context-composer.service.ts
│   │
│   ├── modules/                   # Feature modules
│   │   ├── auth.module.ts         # Authentication module
│   │   ├── users.module.ts        # Users module
│   │   ├── plans.module.ts        # Plans module
│   │   ├── jobs.module.ts         # Jobs module
│   │   ├── conversations.module.ts
│   │   ├── messages.module.ts     # Messages module
│   │   ├── embeddings.module.ts   # Embeddings module
│   │   ├── llm.module.ts          # LLM module
│   │   ├── prompt-templates.module.ts
│   │   ├── context-builders.module.ts
│   │   ├── memory-compression.module.ts
│   │   └── health.module.ts       # Health module
│   │
│   ├── dto/                       # Data Transfer Objects
│   │   ├── auth/                  # Auth DTOs
    │   │   │   ├── login.dto.ts
    │   │   │   ├── register.dto.ts
    │   │   │   └── refresh.dto.ts
│   │   ├── users/                 # User DTOs
    │   │   │   ├── create-user.dto.ts
    │   │   │   └── update-user.dto.ts
│   │   ├── plans/                 # Plan DTOs
    │   │   │   ├── create-plan.dto.ts
    │   │   │   ├── update-plan.dto.ts
    │   │   │   └── query-plans.dto.ts
│   │   ├── jobs/                  # Job DTOs
    │   │   │   ├── create-job.dto.ts
    │   │   │   ├── update-job.dto.ts
    │   │   │   └── query-jobs.dto.ts
│   │   ├── conversations/         # Conversation DTOs
    │   │   │   ├── create-conversation.dto.ts
    │   │   │   └── query-conversations.dto.ts
│   │   ├── messages/              # Message DTOs
    │   │   │   ├── create-message.dto.ts
│   │   │   ├── chat-message.dto.ts
    │   │   │   └── query-messages.dto.ts
│   │   ├── embeddings/            # Embedding DTOs
    │   │   │   ├── create-embedding.dto.ts
    │   │   │   ├── search-embeddings.dto.ts
    │   │   │   └── query-embeddings.dto.ts
│   │   └── common/                # Common DTOs
    │   │       ├── base-pagination.dto.ts
    │   │       ├── base-response.dto.ts
    │   │       └── paginated-response.dto.ts
    │   │
│   ├── common/                    # Shared utilities
│   │   ├── decorators/            # Custom decorators
│   │   │   └── current-user.decorator.ts
│   │   ├── exceptions/           # Exception classes
    │   │   │   ├── app.exception.ts
    │   │   │   ├── auth.exception.ts
    │   │   │   ├── http-exception.ts
    │   │   │   └── index.ts
│   │   ├── filters/              # Exception filters
│   │   │   └── all-exceptions.filter.ts
│   │   ├── guards/               # Authentication guards
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── jwt-refresh-auth.guard.ts
│   │   │   └── user-throttler.guard.ts
│   │   ├── interceptors/         # Interceptors
│   │   │   ├── transform.interceptor.ts
│   │   │   ├── logging.interceptor.ts
│   │   │   └── timeout.interceptor.ts
│   │   ├── interfaces/           # TypeScript interfaces
│   │   │   └── jwt-payload.interface.ts
│   │   ├── services/             # Common services
│   │   │   ├── llm/              # LLM client
│   │   │   │   ├── llm.client.ts
│   │   │   │   ├── llm.config.ts
│   │   │   │   └── provider/
│   │   │   │       └── openai.client.ts
│   │   │   └── soft-delete.service.ts
│   │   └── strategies/           # Passport strategies
│   │       ├── jwt.strategy.ts
│   │       └── jwt-refresh.strategy.ts
│   │
│   ├── shared/                   # Shared utilities
│   │   ├── constants/           # Constants
│   │   │   ├── jwt.constant.ts
│   │   │   ├── user-roles.constant.ts
│   │   │   ├── job-states.constant.ts
│   │   │   ├── message-roles.constant.ts
│   │   │   └── context-builder.constant.ts
│   │   ├── types/               # TypeScript types
│   │   │   ├── job.type.ts
│   │   │   ├── memory-compression.type.ts
│   │   │   └── context-builder.type.ts
│   │   └── utils/               # Utility functions
│   │       └── token.util.ts
│   │
│   └── types/                   # Type definitions
│       └── env-config.type.ts
│
├── documents/                    # Documentation
│   ├── architecture.md           # Architecture documentation
│   ├── structure.md              # This file
│   ├── bpmn.md                  # BPMN diagrams
│   ├── erd.md                   # ERD diagrams
│   ├── sequence.md               # Sequence diagrams
│   ├── chat-flow.md             # Chat flow documentation
│   └── tasks.md                 # Task documentation
│
├── docker-compose.yml            # Docker services
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.build.json           # Build configuration
├── nest-cli.json                 # NestJS CLI configuration
├── eslint.config.mjs             # ESLint configuration
├── .commitlintrc.json            # Commit linting rules
└── README.md                     # Project documentation
```

## Module Dependencies

### Core Modules

```
AppModule
  ├── AppCoreModule (Global)
  │   ├── ConfigModule
  │   ├── LoggerModule
  │   ├── DatabaseModule
  │   ├── CacheConfigModule
  │   └── QueueModule
  ├── ThrottlerModule
  ├── HealthModule
  └── Feature Modules
```

### Feature Modules

```
AuthModule
  ├── UsersModule
  └── JWT Strategies

UsersModule
  └── DatabaseModule

PlansModule
  ├── DatabaseModule
  └── ConversationsModule (circular)

ConversationsModule
  ├── DatabaseModule
  └── PlansModule (circular)

MessagesModule
  ├── DatabaseModule
  └── ConversationsModule

JobsModule
  ├── DatabaseModule
  ├── QueueModule
  ├── LlmModule
  └── PromptTemplatesModule

EmbeddingsModule
  ├── DatabaseModule
  └── LlmModule

LlmModule
  └── ConfigModule

PromptTemplatesModule
  └── DatabaseModule

ContextBuildersModule
  ├── ConversationsModule
  ├── PlansModule
  ├── EmbeddingsModule
  └── LlmModule

MemoryCompressionModule
  ├── DatabaseModule
  ├── EmbeddingsModule
  └── ScheduleModule
```

## Service Dependencies

### Chat Service Flow

```
ChatService
  ├── MessagesService
  ├── ConversationsService
  ├── FinalContextComposer
  │   ├── ConversationContextBuilder
  │   │   └── MessagesService
  │   ├── PlanContextBuilder
  │   │   ├── PlansService
  │   │   ├── JobsService
  │   │   └── MemoryCompressionService
  │   └── EmbeddingContextBuilder
  │       └── EmbeddingsService
  └── LlmClient
```

### Job Processing Flow

```
JobProcessor
  ├── JobsService
  ├── LlmClient
  ├── PromptTemplatesService
  ├── MemoryCompressionService
  └── FinalContextComposer
```

## Entity Relationships

### User → Plans → Conversations → Messages

```
User (1) ──< (N) Plan
Plan (1) ──< (N) Conversation
Conversation (1) ──< (N) Message
```

### Plan → Jobs, Embeddings

```
Plan (1) ──< (N) Job
Plan (1) ──< (N) Embedding
```

### Job Type → Prompt Templates

```
JobType (1) ──< (N) PromptTemplate
```

## Data Flow Patterns

### Request → Response

```
HTTP Request
  ↓
Controller (Validation, Auth)
  ↓
Service (Business Logic)
  ↓
Repository (Data Access)
  ↓
Database
  ↓
Response
```

### Chat Request

```
POST /conversations/:id/chat
  ↓
MessagesController.chat()
  ↓
ChatService.sendMessage()
  ├── Create User Message
  ├── Build Context (FinalContextComposer)
  │   ├── Conversation Context
  │   ├── Plan Context
  │   └── Embedding Context
  ├── Call LLM
  └── Create Assistant Message
  ↓
Response
```

### Job Creation

```
POST /plans/:planId/jobs
  ↓
JobsController.create()
  ↓
JobsService.create()
  ├── Validate Job Type
  ├── Create Job Entity (PENDING)
  ├── Enqueue to BullMQ (QUEUED)
  └── Return Job
  ↓
Response
```

### Job Processing

```
BullMQ Queue
  ↓
JobProcessor.process()
  ├── Update State (PROCESSING)
  ├── Render Prompt Template
  ├── Call LLM
  ├── Parse Result
  ├── Update State (COMPLETED/FAILED)
  └── Store Result
```

## Configuration Hierarchy

### Environment Variables

```
.env / .env.local
  ↓
env.schema.ts (Zod Validation)
  ↓
Config Modules
  ├── app.config.ts
  ├── database.config.ts
  ├── redis.config.ts
  ├── queue.config.ts
  ├── logger.config.ts
  ├── context-builder.config.ts
  └── memory-compression.config.ts
  ↓
ConfigService (Injection)
```

## Security Layers

### Request Security

```
HTTP Request
  ↓
Helmet (Security Headers)
  ↓
CORS (Origin Check)
  ↓
Rate Limiting (Throttler)
  ↓
JWT Auth Guard
  ↓
Controller
```

### Data Security

```
Input
  ↓
DTO Validation (class-validator)
  ↓
Whitelist Filter
  ↓
Service Validation
  ↓
Database (TypeORM)
```

## Logging Flow

```
Request
  ↓
Logging Interceptor
  ├── Request ID Generation
  ├── Request Logging
  └── Response Logging
  ↓
Pino Logger
  ├── Structured JSON
  ├── Sensitive Data Redaction
  └── Output (Console/File)
```

## Error Handling Flow

```
Exception Thrown
  ↓
Global Exception Filter
  ├── Format Error Response
  ├── Log Error
  └── Return HTTP Response
```

## Caching Strategy

### Cache Layers

```
Service Method
  ↓
Cache Check (Redis)
  ├── Hit → Return Cached Data
  └── Miss → Fetch from DB → Cache → Return
```

## Queue Architecture

### Queue Flow

```
Service
  ↓
QueueService.addJob()
  ↓
BullMQ Queue (Redis)
  ↓
Worker Process
  ↓
JobProcessor.process()
  ↓
Result Storage
```

## Database Schema

### Tables

- `users` - User accounts
- `plans` - Travel plans
- `conversations` - Chat conversations
- `messages` - Chat messages
- `jobs` - Background jobs
- `job_types` - Job type definitions
- `prompt_templates` - Prompt templates
- `embeddings` - Vector embeddings
- `refresh_tokens` - JWT refresh tokens

### Indexes

- Primary keys (UUID)
- Foreign keys
- Composite indexes (for queries)
- Vector indexes (HNSW for embeddings)

## File Naming Conventions

- **Entities**: `*.entity.ts`
- **Controllers**: `*.controller.ts`
- **Services**: `*.service.ts`
- **Modules**: `*.module.ts`
- **DTOs**: `*.dto.ts`
- **Configs**: `*.config.ts`
- **Guards**: `*.guard.ts`
- **Interceptors**: `*.interceptor.ts`
- **Filters**: `*.filter.ts`
- **Strategies**: `*.strategy.ts`

## Code Organization Principles

1. **Separation of Concerns**: Each layer has distinct responsibilities
2. **Single Responsibility**: Each service/controller handles one domain
3. **Dependency Injection**: Loose coupling via DI
4. **Interface Segregation**: Small, focused interfaces
5. **DRY**: Shared utilities in `common/` and `shared/`
6. **Type Safety**: TypeScript throughout
7. **Validation**: Input validation at boundaries
