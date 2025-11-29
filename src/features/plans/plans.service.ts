import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { ResourceException } from "../../core/exceptions/domain.exceptions";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, FindOptionsWhere, ILike, DataSource } from "typeorm";
import { Plan } from "./entities/plan.entity";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { QueryPlansDto } from "./dto/query-plans.dto";
import { PaginatedResponse } from "../../core/dto/paginated-response.dto";
import { ConversationsService } from "../conversations/conversations.service";

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  /**
   * Type guard to check if error is a PostgreSQL error with code property
   */
  private isPostgresErrorWithCode(
    err: unknown,
    code: string,
  ): err is { code: string } {
    return (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      typeof (err as { code: unknown }).code === "string" &&
      (err as { code: string }).code === code
    );
  }

  /**
   * Safely extract error message from unknown error type
   */
  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    if (typeof err === "string") {
      return err;
    }
    if (err && typeof err === "object" && "message" in err) {
      return String((err as { message: unknown }).message);
    }
    return JSON.stringify(err);
  }

  constructor(
    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationsService: ConversationsService,
  ) {}

  /**
   * Create a new plan for a user
   */
  async create(userId: string, createPlanDto: CreatePlanDto): Promise<Plan> {
    this.logger.log({
      action: "create_plan",
      userId,
      title: createPlanDto.title,
    });

    // Use transaction to create plan and default conversation atomically
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const plan = this.plansRepository.create({
        ...createPlanDto,
        userId,
        isDeleted: false,
      });

      const savedPlan = await queryRunner.manager.save(Plan, plan);

      await this.conversationsService.createWithManager(
        queryRunner.manager,
        savedPlan.id,
        { title: undefined, isDefault: true },
      );

      await queryRunner.commitTransaction();

      return savedPlan;
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();

      const errorMessage = this.getErrorMessage(err);

      // Check if it's a PostgreSQL unique constraint violation
      if (this.isPostgresErrorWithCode(err, "23505")) {
        throw ResourceException.conflict(
          "A default conversation already exists for this plan",
        );
      }

      this.logger.error({
        action: "plan_creation_failed",
        userId,
        error: errorMessage,
      });

      // Re-throw as Error if it's an Error instance, otherwise wrap it
      if (err instanceof Error) {
        throw err;
      }
      throw new Error(errorMessage);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Find all plans for a user with pagination and filters
   */
  async findAll(
    userId: string,
    query: QueryPlansDto,
  ): Promise<PaginatedResponse<Plan>> {
    const {
      page = 1,
      limit = 10,
      includeDeleted = false,
      search,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = query;

    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Plan> = {
      userId,
    };

    // Filter by deletion status
    if (!includeDeleted) {
      where.isDeleted = false;
    }

    // Search by title
    if (search) {
      where.title = ILike(`%${search}%`);
    }

    const [data, total] = await this.plansRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: {
        [sortBy]: sortOrder,
      },
    });

    const totalPages = Math.ceil(total / limit);

    this.logger.log({
      action: "list_plans",
      userId,
      total,
      page,
      limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Find one plan by ID with ownership check
   */
  async findOne(planId: string, userId: string): Promise<Plan> {
    const plan = await this.plansRepository.findOne({
      where: { id: planId },
    });

    if (!plan) {
      throw ResourceException.notFound("Plan", planId);
    }

    // Ownership check
    if (plan.userId !== userId) {
      this.logger.warn({
        action: "unauthorized_plan_access",
        userId,
        planId,
        ownerId: plan.userId,
      });
      throw ResourceException.notFound("Plan", planId);
    }

    // Don't return soft-deleted plans unless explicitly requested
    if (plan.isDeleted) {
      throw ResourceException.notFound("Plan", planId);
    }

    return plan;
  }

  /**
   * Find one plan by ID without ownership check (for internal use)
   */
  async findOneById(planId: string): Promise<Plan | null> {
    return await this.plansRepository.findOne({
      where: { id: planId },
    });
  }

  /**
   * Update a plan with ownership check
   */
  async update(
    planId: string,
    userId: string,
    updatePlanDto: UpdatePlanDto,
  ): Promise<Plan> {
    const plan = await this.findOne(planId, userId);

    this.logger.log({
      action: "update_plan",
      userId,
      planId,
      updates: Object.keys(updatePlanDto),
    });

    Object.assign(plan, updatePlanDto);
    const updatedPlan = await this.plansRepository.save(plan);

    this.logger.log({
      action: "plan_updated",
      userId,
      planId,
    });

    return updatedPlan;
  }

  /**
   * Soft delete a plan
   */
  async softDelete(planId: string, userId: string): Promise<void> {
    const plan = await this.findOne(planId, userId);

    this.logger.log({
      action: "soft_delete_plan",
      userId,
      planId,
    });

    plan.isDeleted = true;
    plan.deletedAt = new Date();
    plan.deletedBy = userId;

    await this.plansRepository.save(plan);

    this.logger.log({
      action: "plan_soft_deleted",
      userId,
      planId,
    });
  }

  /**
   * Verify plan ownership (used by other services)
   * Throws NotFoundException if plan doesn't exist or user doesn't own it
   */
  async verifyOwnership(planId: string, userId: string): Promise<void> {
    const plan = await this.plansRepository.findOne({
      where: { id: planId },
    });

    if (!plan) {
      throw ResourceException.notFound("Plan", planId);
    }

    if (plan.userId !== userId) {
      this.logger.warn({
        action: "unauthorized_plan_access",
        userId,
        planId,
        ownerId: plan.userId,
      });
      throw ResourceException.notFound("Plan", planId);
    }

    // Don't allow access to soft-deleted plans
    if (plan.isDeleted) {
      throw ResourceException.notFound("Plan", planId);
    }
  }
}
