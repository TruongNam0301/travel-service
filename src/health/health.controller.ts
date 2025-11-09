import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    const startTime = Date.now();

    const result = await this.health.check([
      // Database health check
      () => this.db.pingCheck('database', { timeout: 1500 }),

      // Redis health check (will be added when Redis indicator is configured)
      // () => this.redis.pingCheck('redis', { timeout: 1000 }),

      // Memory health check (heap should not exceed 500MB)
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),

      // RSS memory check (should not exceed 1GB)
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024),

      // Disk space check (should have at least 10% free)
      () =>
        this.disk.checkStorage('disk', {
          path:
            process.platform === 'win32' ? process.cwd().substring(0, 3) : '/',
          thresholdPercent: 0.9,
        }),
    ]);

    const responseTime = Date.now() - startTime;

    return {
      ...result,
      info: {
        ...result.info,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        environment: process.env.NODE_ENV || 'development',
      },
    };
  }

  @Get('ready')
  @HealthCheck()
  async ready() {
    // Readiness check - is the service ready to accept traffic?
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1500 }),
    ]);
  }

  @Get('live')
  live() {
    // Liveness check - is the service alive?
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
