# 🏗️ WanderMind Travel Service - Architecture Documentation

## Overview

WanderMind Travel Service is an AI-powered travel planning backend built with NestJS, PostgreSQL, Redis, and BullMQ. The architecture follows a modular, layered approach with clear separation of concerns.

## Architecture Layers

### 1. Presentation Layer (Controllers)

**Location**: `src/controllers/`

- **Purpose**: Handle HTTP requests/responses, validate input, route to services
- **Responsibilities**:
  - Request validation (DTOs)
  - Authentication/Authorization (Guards)
  - Rate limiting
  - Response transformation
- **Key Controllers**:
  - `auth.controller.ts` - Authentication endpoints
  - `users.controller.ts` - User management
  - `plans.controller.ts` - Travel plan management
  - `jobs.controller.ts` - Background job management
  - `conversations.controller.ts` - Conversation management
  - `messages.controller.ts` - Message handling and chat
  - `embeddings.controller.ts` - Vector embeddings and semantic search
  - `health.controller.ts` - Health monitoring

### 2. Business Logic Layer (Services)

**Location**: `src/services/`

- **Purpose**: Implement business rules, orchestrate operations
- **Responsibilities**:
  - Business logic execution
  - Data validation
  - Transaction management
  - Service coordination
- **Key Services**:
  - `auth.service.ts` - Authentication and authorization
  - `users.service.ts` - User management
  - `plans.service.ts` - Plan CRUD operations
  - `jobs.service.ts` - Job lifecycle management
  - `conversations.service.ts` - Conversation management
  - `messages.service.ts` - Message handling
  - `chat.service.ts` - AI chat orchestration
  - `embeddings.service.ts` - Vector embeddings and semantic search
  - `prompt-templates.service.ts` - Template rendering (Handlebars)
  - `job-types.service.ts` - Job type validation (Zod)
  - `memory-compression.service.ts` - Memory compression for embeddings
  - **Context Builders**:
    - `conversation-context-builder.service.ts` - Build conversation context
    - `plan-context-builder.service.ts` - Build plan context
    - `embedding-context-builder.service.ts` - Build embedding context
    - `final-context-composer.service.ts` - Compose final context

### 3. Data Access Layer (Repositories)

**Location**: `src/entities/` + TypeORM

- **Purpose**: Database operations, entity definitions
- **Responsibilities**:
  - Entity definitions
  - Database queries
  - Relationship management
  - Soft delete support
- **Key Entities**:
  - `user.entity.ts` - User accounts
  - `plan.entity.ts` - Travel plans
  - `conversation.entity.ts` - Chat conversations
  - `message.entity.ts` - Chat messages
  - `job.entity.ts` - Background jobs
  - `job-type.entity.ts` - Job type definitions
  - `prompt-template.entity.ts` - Prompt templates
  - `embedding.entity.ts` - Vector embeddings (pgvector)
  - `refresh-token.entity.ts` - JWT refresh tokens

### 4. Infrastructure Layer

**Location**: `src/core/`, `src/config/`, `src/common/`

- **Purpose**: Cross-cutting concerns, infrastructure setup
- **Components**:
  - **Configuration** (`src/config/`):
    - Environment validation (Zod)
    - Database configuration
    - Redis configuration
    - Queue configuration
    - Logger configuration
  - **Core Modules** (`src/core/`):
    - `app-core.module.ts` - Aggregates all infrastructure
    - `cache.module.ts` - Redis cache
  - **Common Utilities** (`src/common/`):
    - Exception handling
    - Guards (JWT, rate limiting)
    - Interceptors (logging, transformation, timeout)
    - Filters (exception filters)
    - Decorators (current user)
    - Strategies (JWT, refresh token)
    - Services (LLM client, soft delete)

### 5. Queue Layer

**Location**: `src/queue/`

- **Purpose**: Asynchronous job processing
- **Components**:
  - `queue.module.ts` - BullMQ setup
  - `queue.service.ts` - Queue management
  - `job.processor.ts` - Job execution
  - `main.worker.ts` - Worker entry point

### 6. External Services

- **LLM Provider** (`src/common/services/llm/`):
  - `llm.client.ts` - LLM client interface
  - `provider/openai.client.ts` - OpenAI implementation
  - Retry logic, timeout handling, token tracking

## Architecture Patterns

### 1. Modular Architecture

- **Feature Modules**: Each business domain has its own module
  - `auth.module.ts`
  - `users.module.ts`
  - `plans.module.ts`
  - `jobs.module.ts`
  - `conversations.module.ts`
  - `messages.module.ts`
  - `embeddings.module.ts`
  - `llm.module.ts`
  - `prompt-templates.module.ts`
  - `context-builders.module.ts`
  - `memory-compression.module.ts`

### 2. Dependency Injection

- NestJS built-in DI container
- Interface-based design (LLM client)
- Circular dependency handling with `forwardRef()`

### 3. Repository Pattern

- TypeORM repositories for data access
- Service layer abstracts repository details
- Entity-based queries

### 4. DTO Pattern

- Input validation with class-validator
- Type-safe data transfer
- Whitelist validation (strips unknown properties)

### 5. Strategy Pattern

- LLM client abstraction (interface)
- Multiple provider support (OpenAI, future: Anthropic, etc.)
- JWT strategies (access token, refresh token)

### 6. Factory Pattern

- Configuration factories
- Service factories

### 7. Builder Pattern

- Context builders (conversation, plan, embedding)
- Final context composer

## Data Flow

### Request Flow

```
Client Request
  ↓
Controller (Validation, Auth, Rate Limiting)
  ↓
Service (Business Logic)
  ↓
Repository/Entity (Data Access)
  ↓
Database (PostgreSQL)
```

### Chat Flow

```
User Message
  ↓
MessagesController
  ↓
ChatService
  ↓
FinalContextComposer
  ├─ ConversationContextBuilder
  ├─ PlanContextBuilder
  └─ EmbeddingContextBuilder
  ↓
LLM Client (OpenAI)
  ↓
Response Generation
  ↓
Message Storage
```

### Job Processing Flow

```
Job Creation
  ↓
JobsService.create()
  ↓
Job Entity (PENDING state)
  ↓
BullMQ Queue (QUEUED state)
  ↓
JobProcessor.process()
  ├─ Prompt Template Rendering
  ├─ LLM Client Call
  ├─ Result Parsing
  └─ State Update (COMPLETED/FAILED)
```

## Security Architecture

### 1. Authentication

- **JWT-based**: Access tokens + refresh tokens
- **Token Storage**: Refresh tokens in database
- **Token Rotation**: Refresh token rotation on use
- **Device Tracking**: User agent and device ID

### 2. Authorization

- **Guards**: JWT authentication guard
- **Ownership Verification**: Service-level checks
- **Role-based**: User roles (USER, ADMIN)

### 3. Input Validation

- **Global ValidationPipe**: Whitelist mode
- **DTO Validation**: class-validator decorators
- **Type Safety**: TypeScript + Zod schemas

### 4. Rate Limiting

- **ThrottlerModule**: Redis-backed rate limiting
- **Per-user Limits**: User-specific throttling
- **Endpoint-specific**: Different limits per endpoint

### 5. Security Headers

- **Helmet**: HTTP security headers
- **CORS**: Configurable origin whitelist
- **Sensitive Data**: Password/token redaction in logs

## Caching Strategy

### Redis Cache

- **Cache Module**: `cache.module.ts`
- **TTL-based**: Time-to-live expiration
- **Max Entries**: Memory limit
- **Use Cases**:
  - Session data
  - Rate limiting counters
  - Frequently accessed data

## Queue Architecture

### BullMQ

- **Queue**: `research-jobs`
- **Redis Backend**: Job storage
- **Worker Process**: Separate process (`main.worker.ts`)
- **Job States**: PENDING → QUEUED → PROCESSING → COMPLETED/FAILED
- **Retry Logic**: Exponential backoff
- **Priority Support**: Job priority levels

## Database Architecture

### PostgreSQL

- **ORM**: TypeORM
- **Migrations**: Version-controlled schema
- **Extensions**: pgvector for vector embeddings
- **Indexes**: Optimized for queries
- **Soft Delete**: isDeleted flags

### Vector Storage

- **pgvector**: Vector extension
- **HNSW Index**: Fast similarity search
- **Embedding Dimension**: 1536 (OpenAI)

## Logging Architecture

### Pino Logger

- **Structured Logging**: JSON format
- **Request Correlation**: Unique request IDs
- **Log Levels**: debug, info, warn, error
- **Sensitive Data**: Automatic redaction
- **Pretty Printing**: Development mode

## Error Handling

### Exception Hierarchy

```
HttpException (NestJS)
  ↓
AppException (Base)
  ├─ DatabaseException
  ├─ ValidationException
  ├─ NotFoundException
  ├─ AuthorizationException
  ├─ AuthenticationException
  ├─ BusinessLogicException
  ├─ QueueException
  └─ ExternalServiceException
```

### Global Exception Filter

- **Catches**: All unhandled exceptions
- **Formats**: Consistent error responses
- **Logs**: Error details
- **Stack Traces**: Development mode only

## Monitoring & Health

### Health Checks

- **Database**: Connection ping
- **Memory**: Heap and RSS limits
- **Disk**: Free space threshold
- **Endpoints**: `/health`, `/health/ready`, `/health/live`

## Deployment Architecture

### Development

- **Docker Compose**: PostgreSQL + Redis
- **Hot Reload**: NestJS watch mode
- **Local Development**: `.env.local` support

### Production Considerations

- **Process Manager**: PM2 or similar
- **Container Orchestration**: Kubernetes/ECS
- **Managed Services**: RDS, ElastiCache
- **Load Balancing**: Multiple instances
- **Worker Processes**: Separate worker instances

## Scalability Considerations

### Horizontal Scaling

- **Stateless API**: JWT tokens
- **Shared State**: Redis for sessions/queues
- **Database**: Connection pooling
- **Workers**: Multiple worker instances

### Vertical Scaling

- **Connection Pooling**: Database connections
- **Memory Management**: Heap limits
- **Queue Concurrency**: Configurable worker concurrency

## Technology Stack

### Core

- **NestJS 11**: Framework
- **TypeScript 5.7**: Language
- **Node.js 20+**: Runtime

### Database

- **PostgreSQL 16**: Primary database
- **pgvector**: Vector extension
- **TypeORM 0.3**: ORM

### Cache & Queue

- **Redis 7**: Cache and queue backend
- **BullMQ 5.63**: Job queue

### AI/ML

- **OpenAI API**: LLM provider
- **pgvector**: Vector similarity search

### Security

- **Helmet**: Security headers
- **@nestjs/throttler**: Rate limiting
- **bcrypt**: Password hashing
- **passport-jwt**: JWT authentication

### Logging

- **Pino 10**: Structured logging
- **nestjs-pino**: NestJS integration

### Validation

- **class-validator**: Input validation
- **Zod 4.1**: Schema validation

## Future Enhancements

1. **Multi-Provider LLM**: Support for Anthropic, Cohere, etc.
2. **API Versioning**: Versioned endpoints
3. **GraphQL**: Alternative API layer
4. **WebSockets**: Real-time updates
5. **Event Sourcing**: Event-driven architecture
6. **CQRS**: Command Query Responsibility Segregation
7. **Microservices**: Service decomposition
8. **Service Mesh**: Inter-service communication
