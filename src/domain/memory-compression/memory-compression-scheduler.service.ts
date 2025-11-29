import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Plan } from "../../features/plans/entities/plan.entity";
import { Embedding } from "../../features/embeddings/entities/embedding.entity";
import { Conversation } from "../../features/conversations/entities/conversation.entity";
import { JobsService } from "../../features/jobs/jobs.service";
import { MemoryCompressionService } from "./memory-compression.service";
import memoryCompressionConfig from "../../config/memory-compression.config";

/**
 * Memory Compression Scheduler Service
 * Handles automated memory compression via CRON jobs
 */
@Injectable()
export class MemoryCompressionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(MemoryCompressionSchedulerService.name);
  private readonly compressionEnabled: boolean;
  private readonly archiveThreshold: number;
  private readonly inactivePlanDays: number;
  private readonly defaultMode: "light" | "full";

  constructor(
    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,
    @InjectRepository(Embedding)
    private readonly embeddingsRepository: Repository<Embedding>,
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
    private readonly memoryCompressionService: MemoryCompressionService,
    @Inject(memoryCompressionConfig.KEY)
    private readonly memoryCompressionCfg: ConfigType<
      typeof memoryCompressionConfig
    >,
  ) {
    this.compressionEnabled = memoryCompressionCfg.enabled;
    this.archiveThreshold = memoryCompressionCfg.archiveThreshold;
    this.inactivePlanDays = memoryCompressionCfg.inactivePlanDays;
    this.defaultMode = memoryCompressionCfg.defaultMode as "light" | "full";
  }

  onModuleInit() {
    if (!this.compressionEnabled) {
      this.logger.warn(
        "Memory compression scheduler is disabled via MEMORY_COMPRESSION_ENABLED",
      );
      return;
    }
    this.logger.log("Memory compression scheduler initialized");
  }

  /**
   * Nightly compression job - runs daily at 2 AM (configurable)
   * Performs light compression (deduplication) on all eligible plans
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: "nightly-memory-compression",
    timeZone: "UTC",
  })
  async handleNightlyCompression() {
    if (!this.compressionEnabled) {
      this.logger.debug("Skipping nightly compression - disabled");
      return;
    }

    this.logger.log("Starting nightly memory compression job");

    try {
      // Find plans that need compression
      const plansToCompress = await this.findPlansNeedingCompression();

      this.logger.log({
        action: "nightly_compression_start",
        planCount: plansToCompress.length,
      });

      let successCount = 0;
      let errorCount = 0;

      // Process plans in batches to avoid overwhelming the system
      for (const plan of plansToCompress) {
        try {
          await this.scheduleCompressionJob(plan.id, plan.userId, "light");
          successCount++;
        } catch (error) {
          this.logger.error({
            action: "nightly_compression_plan_failed",
            planId: plan.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          errorCount++;
        }
      }

      this.logger.log({
        action: "nightly_compression_complete",
        totalPlans: plansToCompress.length,
        successCount,
        errorCount,
      });
    } catch (error) {
      this.logger.error({
        action: "nightly_compression_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Weekly summarization job - runs every Sunday at 3 AM
   * Performs full compression (clustering + summarization) on inactive plans
   */
  @Cron("0 3 * * 0", {
    name: "weekly-memory-summarization",
    timeZone: "UTC",
  })
  async handleWeeklySummarization() {
    if (!this.compressionEnabled) {
      this.logger.debug("Skipping weekly summarization - disabled");
      return;
    }

    this.logger.log("Starting weekly memory summarization job");

    try {
      // Find inactive plans that need full compression
      const inactivePlans = await this.findInactivePlans();

      this.logger.log({
        action: "weekly_summarization_start",
        planCount: inactivePlans.length,
      });

      let successCount = 0;
      let errorCount = 0;

      for (const plan of inactivePlans) {
        try {
          await this.scheduleCompressionJob(plan.id, plan.userId, "full");
          successCount++;
        } catch (error) {
          this.logger.error({
            action: "weekly_summarization_plan_failed",
            planId: plan.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          errorCount++;
        }
      }

      this.logger.log({
        action: "weekly_summarization_complete",
        totalPlans: inactivePlans.length,
        successCount,
        errorCount,
      });
    } catch (error) {
      this.logger.error({
        action: "weekly_summarization_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Find plans that need compression based on:
   * 1. Embedding count > threshold
   * 2. Plan is not deleted
   */
  async findPlansNeedingCompression(): Promise<
    Array<{ id: string; userId: string }>
  > {
    // Use raw SQL for efficient counting
    const sql = `
      SELECT 
        p.id,
        p.user_id as "userId",
        COUNT(e.id) as embedding_count
      FROM plans p
      LEFT JOIN embeddings e ON e.plan_id = p.id AND e.is_deleted = false
      WHERE p.is_deleted = false
      GROUP BY p.id, p.user_id
      HAVING COUNT(e.id) >= $1
      ORDER BY embedding_count DESC
    `;

    interface PlanRow {
      id: string;
      userId: string;
      embedding_count: string;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const results = await this.dataSource.query(sql, [this.archiveThreshold]);

    return (results as PlanRow[]).map((row) => ({
      id: row.id,
      userId: row.userId,
    }));
  }

  /**
   * Find inactive plans (no activity for specified days)
   * Activity is determined by:
   * - Last message in any conversation
   * - Last job update
   * - Plan update timestamp
   */
  async findInactivePlans(): Promise<Array<{ id: string; userId: string }>> {
    const inactiveDate = new Date();
    inactiveDate.setDate(inactiveDate.getDate() - this.inactivePlanDays);

    // Find plans where:
    // 1. No recent messages (last_message_at < inactiveDate OR no conversations)
    // 2. No recent jobs (updated_at < inactiveDate)
    // 3. Plan itself hasn't been updated recently
    const sql = `
      SELECT DISTINCT p.id, p.user_id as "userId"
      FROM plans p
      WHERE p.is_deleted = false
        AND p.updated_at < $1
        AND (
          -- No recent conversations with messages
          NOT EXISTS (
            SELECT 1 
            FROM conversations c
            WHERE c.plan_id = p.id 
              AND c.is_deleted = false
              AND c.last_message_at >= $1
          )
          OR NOT EXISTS (
            SELECT 1
            FROM conversations c
            WHERE c.plan_id = p.id
              AND c.is_deleted = false
          )
        )
        AND (
          -- No recent jobs
          NOT EXISTS (
            SELECT 1
            FROM jobs j
            WHERE j.plan_id = p.id
              AND j.updated_at >= $1
          )
        )
        AND (
          -- Has embeddings to compress
          EXISTS (
            SELECT 1
            FROM embeddings e
            WHERE e.plan_id = p.id
              AND e.is_deleted = false
          )
        )
    `;

    interface InactivePlanRow {
      id: string;
      userId: string;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const results = await this.dataSource.query(sql, [inactiveDate]);

    return (results as InactivePlanRow[]).map((row) => ({
      id: row.id,
      userId: row.userId,
    }));
  }

  /**
   * Schedule a compression job for a plan
   */
  private async scheduleCompressionJob(
    planId: string,
    userId: string,
    mode: "light" | "full",
  ): Promise<void> {
    this.logger.log({
      action: "schedule_compression_job",
      planId,
      userId,
      mode,
    });

    await this.jobsService.create(planId, userId, {
      type: "memory_compression",
      params: {
        planId,
        mode,
        userId,
      },
      priority: mode === "full" ? 1 : 0, // Full compression has higher priority
    });
  }

  /**
   * Manually trigger compression for a specific plan
   * Useful for testing or manual triggers
   */
  async triggerCompressionForPlan(
    planId: string,
    userId: string,
    mode?: "light" | "full",
  ): Promise<void> {
    const compressionMode = mode || this.defaultMode;

    this.logger.log({
      action: "manual_compression_trigger",
      planId,
      userId,
      mode: compressionMode,
    });

    await this.scheduleCompressionJob(planId, userId, compressionMode);
  }

  /**
   * Check if a plan needs compression based on threshold
   */
  async checkPlanNeedsCompression(planId: string): Promise<boolean> {
    const embeddingCount = await this.embeddingsRepository.count({
      where: { planId, isDeleted: false },
    });

    return embeddingCount >= this.archiveThreshold;
  }

  /**
   * Check if a plan is inactive
   */
  async checkPlanIsInactive(planId: string): Promise<boolean> {
    const inactiveDate = new Date();
    inactiveDate.setDate(inactiveDate.getDate() - this.inactivePlanDays);

    const plan = await this.plansRepository.findOne({
      where: { id: planId },
    });

    if (!plan || plan.isDeleted) {
      return false;
    }

    // Check if plan was updated recently
    if (plan.updatedAt >= inactiveDate) {
      return false;
    }

    // Check for recent conversation activity
    const recentConversation = await this.conversationsRepository.findOne({
      where: {
        planId,
        isDeleted: false,
      },
      order: { lastMessageAt: "DESC" },
    });

    if (
      recentConversation?.lastMessageAt &&
      recentConversation.lastMessageAt >= inactiveDate
    ) {
      return false;
    }

    return true;
  }
}
