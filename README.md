# 🧭 WanderMind Travel Service

AI-powered travel planning backend service built with NestJS, PostgreSQL, Redis, and BullMQ.

## 🚀 Features

- **TypeORM** with PostgreSQL and pgvector for vector embeddings
- **Redis** for caching and session management
- **BullMQ** for asynchronous job processing
- **Pino** for structured logging with request correlation
- **Helmet** for security headers
- **Rate limiting** with Redis storage
- **Health checks** for database and Redis
- **Graceful shutdown** handling
- **Global exception handling** with custom exception types
- **Docker Compose** for easy local development
- **Zod** for environment validation
- **Husky** and **lint-staged** for code quality

## 📋 Prerequisites

- **Node.js** 20+
- **Yarn** package manager
- **Docker** and **Docker Compose** (for local development)
- **Git** for version control

## 🛠️ Installation

### 1. Clone the repository

```bash
cd travel-service
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Environment Setup

The project uses environment-specific configuration files for easier setup:

#### Quick Start (Development)

For local development, use the minimal `.env.development` file:

```bash
cp .env.development .env
```

Edit `.env` and add your **required** secrets:

```env
# Required: JWT Secrets
JWT_SECRET=your-secret-key-change-me
JWT_REFRESH_SECRET=your-refresh-secret-change-me

# Required: OpenAI API Key
OPENAI_API_KEY=sk-your-openai-key-here
LLM_PROVIDER=openai
```

**That's it!** All other settings use sensible defaults for development.

#### Production Setup

For production, copy the production template:

```bash
cp .env.production.example .env.production
```

Edit `.env.production` with your production values. See the full configuration reference below.

#### Configuration Reference

For all available options, see `.env.example`. The configuration is organized by domain:

- **App**: Port, environment, logging
- **Database**: PostgreSQL connection
- **Redis**: Cache and queue backend
- **JWT**: Authentication settings
- **LLM**: AI provider configuration
- **Vector**: Search engine settings
- **Google Maps**: Optional API integration

Most variables have defaults - only JWT secrets and LLM API keys are required.

## 🐳 Docker Setup

### Start Services

Start PostgreSQL (with pgvector) and Redis:

```bash
yarn docker:up
```

This starts:

- **PostgreSQL 16** with pgvector extension on port `5432`
- **Redis 7** on port `6379`

### Verify Services

Check if containers are running:

```bash
docker ps
```

You should see `travel-postgres` and `travel-redis` containers.

### Stop Services

```bash
yarn docker:down
```

### View Logs

```bash
yarn docker:logs
```

### Quick Start

For a complete setup guide, see [QUICK_START.md](./QUICK_START.md)

## 🗄️ Database Migrations

### Generate a new migration

```bash
yarn migration:generate -n MigrationName
```

### Run pending migrations

```bash
yarn migration:run
```

### Revert last migration

```bash
yarn migration:revert
```

## 🏃‍♂️ Running the Application

### Development mode (with hot reload)

```bash
yarn start:dev
```

### Production mode

```bash
yarn build
yarn start:prod
```

### Worker process (for BullMQ jobs)

```bash
yarn start:worker
```

## 🏥 Health Checks

The service exposes health check endpoints:

- **Full health check**: `GET /health`
  - Checks database, Redis, memory, disk
  - Returns uptime and response time
- **Readiness check**: `GET /health/ready`
  - Checks if service is ready to accept traffic
- **Liveness check**: `GET /health/live`
  - Simple ping to verify service is alive

Example response:

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up" },
    "memory_rss": { "status": "up" },
    "disk": { "status": "up" },
    "uptime": 120.5,
    "timestamp": "2025-11-09T12:00:00.000Z",
    "responseTime": "45ms",
    "environment": "development"
  }
}
```

## 🧪 Testing

Run unit tests:

```bash
yarn test
```

Run tests in watch mode:

```bash
yarn test:watch
```

Run tests with coverage:

```bash
yarn test:cov
```

Run e2e tests:

```bash
yarn test:e2e
```

## 📝 Code Quality

The project uses ESLint, Prettier, and Husky for code quality.

### Manual linting

```bash
yarn lint
```

### Format code

```bash
yarn format
```

### Pre-commit hooks

Husky automatically runs lint-staged on commit, which:

- Lints and fixes TypeScript/JavaScript files
- Formats all staged files with Prettier

## 🏗️ Project Structure

```
src/
├── config/              # Domain-specific configuration files
│   ├── app.config.ts           # App, CORS, rate limiting
│   ├── database.config.ts      # PostgreSQL settings
│   ├── redis.config.ts         # Redis & cache
│   ├── queue.config.ts         # BullMQ configuration
│   ├── jwt.config.ts           # JWT authentication
│   ├── llm.config.ts           # LLM provider (OpenAI)
│   ├── vector.config.ts        # Vector search settings
│   ├── context-builder.config.ts  # Memory context builder
│   ├── memory-compression.config.ts # Memory compression
│   ├── env.schema.ts           # Zod validation
│   └── logger.config.ts        # Logging configuration
├── core/                # Core infrastructure modules
│   ├── app-core.module.ts  # Loads all configs
│   └── cache.module.ts     # Redis cache module
├── database/            # Database module
│   ├── database.module.ts
│   └── migrations/      # TypeORM migrations
├── queue/               # BullMQ queue infrastructure
│   ├── queue.module.ts
│   ├── queue.service.ts
│   ├── main.worker.ts   # Worker entrypoint
│   └── job.processor.ts # Job processing logic
├── common/              # Shared utilities
│   ├── constants/       # Domain constants
│   ├── decorators/
│   ├── interceptors/
│   ├── interfaces/
│   ├── guards/
│   ├── strategies/      # Passport strategies
│   ├── services/        # Shared services (LLM, Google Maps)
│   └── exceptions/      # Exception handling
├── services/            # Business logic services
│   ├── auth.service.ts
│   ├── chat.service.ts
│   ├── context-builders/  # Memory context builders
│   └── ...
├── controllers/         # API controllers
├── entities/            # TypeORM entities
└── modules/             # Feature modules
```

## ⚙️ Configuration Architecture

The project uses a **domain-driven configuration** approach with NestJS's `@nestjs/config`:

### Configuration Files

Each domain has its own config file using `registerAs()`:

- **`app.config.ts`**: Application settings, CORS, rate limiting
- **`database.config.ts`**: PostgreSQL connection and behavior
- **`redis.config.ts`**: Redis connection and caching
- **`jwt.config.ts`**: JWT authentication settings
- **`llm.config.ts`**: LLM provider configuration
- **`vector.config.ts`**: Vector search settings
- **`queue.config.ts`**: BullMQ queue configuration

### Using Configuration in Services

Instead of reading `process.env` directly, inject domain configs:

```typescript
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import jwtConfig from "@/config/jwt.config";

@Injectable()
export class AuthService {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg: ConfigType<typeof jwtConfig>,
  ) {}

  generateToken() {
    // Use typed configuration
    const secret = this.jwtCfg.secret;
    const expiration = this.jwtCfg.accessExpiration;
  }
}
```

### Benefits

- **Type-safe**: Full TypeScript support for all config values
- **Domain-organized**: Each config file is self-contained
- **Smart defaults**: Most values have sensible defaults
- **Environment-specific**: Automatic loading of `.env.development`, `.env.production`
- **Easy testing**: Mock specific config namespaces

### Required vs Optional

**Required variables** (must be set in production):

- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `OPENAI_API_KEY`, `LLM_PROVIDER`

**Optional variables** (have defaults):

- All database, Redis, and app settings
- Port, log level, CORS origins, etc.

## 🔒 Security Features

- **Helmet**: Sets secure HTTP headers
- **CORS**: Configurable origin whitelist
- **Rate Limiting**: Throttles requests to prevent abuse
- **Validation**: Global validation pipes with DTO whitelist
- **Environment Validation**: Zod schema validation at startup
- **Graceful Shutdown**: Closes connections cleanly on termination
- **Global Exception Filter**: Centralized error handling with consistent error responses

## 📊 Logging

The service uses Pino for structured logging with:

- **Request correlation**: Each request gets a unique ID
- **Custom properties**: User ID and path included in logs
- **Sensitive data redaction**: Passwords and tokens are hidden
- **Pretty printing**: Colorized output in development
- **JSON logs**: Structured logs in production

Example log:

```json
{
  "level": "info",
  "time": 1699545600000,
  "pid": 12345,
  "req": {
    "id": "req-123",
    "method": "GET",
    "url": "/health"
  },
  "res": {
    "statusCode": 200
  },
  "responseTime": 45,
  "msg": "request completed"
}
```

## 🔄 Background Jobs

The service uses BullMQ for background job processing:

1. **Queue Service**: Generic service for managing jobs
2. **Workers**: Separate process for job execution
3. **Redis**: Used as job queue backend
4. **Monitoring**: Queue metrics available through QueueService

To process jobs, run the worker:

```bash
yarn start:worker
```

## 🚢 Deployment

### Building for production

```bash
yarn build
```

The compiled output is in the `dist/` folder.

### Running in production

```bash
NODE_ENV=production yarn start:prod
```

### Docker deployment

A `docker-compose.yml` is provided for local development. For production deployment, consider:

- Using managed PostgreSQL (AWS RDS, Azure Database)
- Using managed Redis (AWS ElastiCache, Azure Cache)
- Container orchestration (Kubernetes, ECS)
- Process manager (PM2) for Node.js processes

## 🛡️ Exception Handling

The service includes a comprehensive exception handling system:

### Custom Exceptions

- **`AppException`**: Base exception with metadata support
- **`DatabaseException`**: Database operation errors
- **`ValidationException`**: Input validation errors
- **`NotFoundException`**: Resource not found errors
- **`AuthorizationException`**: Permission denied errors
- **`AuthenticationException`**: Authentication required errors
- **`BusinessLogicException`**: Business rule violations
- **`QueueException`**: Background job errors
- **`ExternalServiceException`**: Third-party API failures

### Global Exception Filter

All exceptions are automatically caught and formatted consistently:

```json
{
  "statusCode": 404,
  "timestamp": "2025-11-09T12:00:00.000Z",
  "path": "/api/plans/123",
  "method": "GET",
  "message": "Plan with identifier '123' not found",
  "errorCode": "RESOURCE_NOT_FOUND",
  "metadata": {
    "resource": "Plan",
    "identifier": "123"
  }
}
```

### Usage Example

```typescript
import { NotFoundException, ValidationException } from "@/common/exceptions";

// Throw custom exceptions
throw new NotFoundException("Plan", planId);
throw new ValidationException("Invalid date range", { startDate, endDate });
```

See `src/common/exceptions/` for more details.

## 📚 API Documentation

API documentation will be added using Swagger/OpenAPI in future updates.

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Commit (Husky will run pre-commit checks)
5. Push and create a pull request

## 📄 License

UNLICENSED - Private project

## 🆘 Troubleshooting

### Database connection issues

Ensure Docker services are running:

```bash
yarn docker:up
docker ps  # Check if containers are running
```

### Port already in use

Check if another process is using the port:

```bash
# Windows
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :3000
```

### TypeORM migration errors

Ensure database is running and environment variables are correct. Check connection with:

```bash
yarn typeorm schema:log
```

## 🔗 Related Documentation

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Pino Documentation](https://getpino.io/)

---

Built with ❤️ for WanderMind Travel Planning Platform
