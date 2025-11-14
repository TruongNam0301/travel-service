import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { Logger as PinoLogger } from "nestjs-pino";
import { json } from "express";

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  try {
    // Create NestJS application
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true, // Buffer logs until logger is ready
    });

    // Use Pino logger
    app.useLogger(app.get(PinoLogger));

    // Request body size limit (12kb to enforce 10k content rule)
    app.use(json({ limit: "12kb" }));

    // Get ConfigService
    const configService = app.get(ConfigService);
    const port = configService.get<number>("PORT", 3000);
    const nodeEnv = configService.get<string>("NODE_ENV", "development");
    const corsOrigins = configService
      .get<string>("CORS_ORIGINS", "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim());

    // Security: Helmet for HTTP headers
    app.use(helmet());

    // CORS configuration

    app.enableCors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          callback(null, true);
          return;
        }

        // In development, allow all origins
        if (nodeEnv === "development") {
          callback(null, true);
          return;
        }

        // In production, check whitelist

        if (corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true, // Strip properties not in DTO
        forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
        transform: true, // Transform payloads to DTO instances
        transformOptions: {
          enableImplicitConversion: true, // Auto convert types
        },
      }),
    );

    // Enable graceful shutdown
    app.enableShutdownHooks();

    // Start server
    await app.listen(port, "0.0.0.0");

    logger.log(`🚀 Application is running on: http://localhost:${port}`);
    logger.log(`📝 Environment: ${nodeEnv}`);
    logger.log(`🏥 Health check: http://localhost:${port}/health`);

    // Handle unhandled rejections
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      process.exit(1);
    });
  } catch (error) {
    logger.error("Failed to start application:", error);
    process.exit(1);
  }
}

void bootstrap();
