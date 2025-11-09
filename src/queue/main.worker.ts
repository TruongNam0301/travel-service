import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppCoreModule } from '../core/app-core.module';

/**
 * Separate worker process for BullMQ job processing
 * This can be run independently from the main application
 * Usage: npm run start:worker
 */
async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');

  try {
    // Create a minimal NestJS application with just the core modules
    const app = await NestFactory.createApplicationContext(AppCoreModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Enable graceful shutdown
    app.enableShutdownHooks();

    logger.log('🚀 Worker process started successfully');
    logger.log('Worker is now processing jobs from the queue...');

    // Keep the worker running
    process.on('SIGTERM', () => {
      void (async () => {
        logger.log('SIGTERM signal received: closing worker gracefully');
        await app.close();
        process.exit(0);
      })();
    });

    process.on('SIGINT', () => {
      void (async () => {
        logger.log('SIGINT signal received: closing worker gracefully');
        await app.close();
        process.exit(0);
      })();
    });
  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
}

void bootstrap();
