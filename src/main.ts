import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { Logger as PinoLogger } from "nestjs-pino";
import { json } from "express";
import { AppConfig } from "./config/app.config";

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  try {
    // Create NestJS application
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });

    app.useLogger(app.get(PinoLogger));

    app.use(json({ limit: "12kb" }));

    // Get app configuration
    const configService = app.get(ConfigService);
    const appConfig = configService.get<AppConfig>("app")!;
    const port = appConfig.port;
    const nodeEnv = appConfig.nodeEnv;
    const corsOrigins = appConfig.corsOrigins;

    app.use(helmet());

    app.enableCors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (nodeEnv === "development") {
          callback(null, true);
          return;
        }

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
