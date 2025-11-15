import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, FindOptionsWhere, ILike, DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Plan } from "../entities/plan.entity";
import { CreatePlanDto } from "../dto/plans/create-plan.dto";
import { UpdatePlanDto } from "../dto/plans/update-plan.dto";
import { QueryPlansDto } from "../dto/plans/query-plans.dto";
import { PaginatedResponse } from "../common/dto/paginated-response.dto";
import { ConversationsService } from "./conversations.service";

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
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

      // Auto-create default conversation if config enabled
      const createDefaultConversation = this.configService.get<boolean>(
        "CREATE_DEFAULT_CONVERSATION",
        true,
      );

      if (createDefaultConversation) {
        await this.conversationsService.createWithManager(
          queryRunner.manager,
          savedPlan.id,
          { title: undefined, isDefault: true },
        );
      }

      await queryRunner.commitTransaction();

      this.logger.log({
        action: "plan_created",
        userId,
        planId: savedPlan.id,
        defaultConversationCreated: createDefaultConversation,
      });

      return savedPlan;
    } catch (err) {
      await queryRunner.rollbackTransaction();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const isPostgresError = err && typeof err === "object" && "code" in err;

      if (isPostgresError && (err as { code: string }).code === "23505") {
        this.logger.error({
          action: "plan_creation_failed_unique_constraint",
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
        throw new ConflictException(
          "A default conversation already exists for this plan",
        );
      }

      this.logger.error({
        action: "plan_creation_failed",
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
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
      throw new NotFoundException(`Plan with id ${planId} not found`);
    }

    // Ownership check
    if (plan.userId !== userId) {
      this.logger.warn({
        action: "unauthorized_plan_access",
        userId,
        planId,
        ownerId: plan.userId,
      });
      throw new NotFoundException(`Plan with id ${planId} not found`);
    }

    // Don't return soft-deleted plans unless explicitly requested
    if (plan.isDeleted) {
      throw new NotFoundException(`Plan with id ${planId} not found`);
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
      throw new NotFoundException(`Plan with id ${planId} not found`);
    }

    if (plan.userId !== userId) {
      this.logger.warn({
        action: "unauthorized_plan_access",
        userId,
        planId,
        ownerId: plan.userId,
      });
      throw new NotFoundException(`Plan with id ${planId} not found`);
    }

    // Don't allow access to soft-deleted plans
    if (plan.isDeleted) {
      throw new NotFoundException(`Plan with id ${planId} not found`);
    }
  }
}
