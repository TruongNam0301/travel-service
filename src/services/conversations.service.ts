import {
  Injectable,
  NotFoundException,
  Logger,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager, FindOptionsWhere } from "typeorm";
import { Conversation } from "../entities/conversation.entity";
import { Plan } from "../entities/plan.entity";
import { CreateConversationDto } from "../dto/conversations/create-conversation.dto";
import { QueryConversationsDto } from "../dto/conversations/query-conversations.dto";
import { PaginatedResponse } from "../common/dto/paginated-response.dto";
import { PlansService } from "./plans.service";

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,
    private readonly plansService: PlansService,
  ) {}

  /**
   * Create a conversation for a plan with ownership validation
   */
  async create(
    userId: string,
    planId: string,
    dto: CreateConversationDto,
  ): Promise<Conversation> {
    // Verify plan ownership
    const hasOwnership = await this.plansService.verifyOwnership(
      planId,
      userId,
    );
    if (!hasOwnership) {
      throw new NotFoundException(`Plan with id ${planId} not found`);
    }

    this.logger.log({
      action: "create_conversation",
      userId,
      planId,
      isDefault: dto.isDefault,
    });

    // If setting as default, unset previous default
    if (dto.isDefault) {
      await this.unsetPreviousDefault(planId);
    }

    try {
      const conversation = this.conversationsRepository.create({
        ...dto,
        planId,
        messageCount: 0,
        isDeleted: false,
      });

      const savedConversation =
        await this.conversationsRepository.save(conversation);

      this.logger.log({
        action: "conversation_created",
        userId,
        planId,
        conversationId: savedConversation.id,
      });

      return savedConversation;
    } catch (error: unknown) {
      // Handle unique constraint violation (PG error code 23505)
      const isPostgresError =
        error &&
        typeof error === "object" &&
        "code" in error &&
        "constraint" in error;

      if (
        isPostgresError &&
        (error as { code: string }).code === "23505" &&
        (error as { constraint: string }).constraint ===
          "ux_conversations_plan_default"
      ) {
        throw new ConflictException(
          "A default conversation already exists for this plan",
        );
      }
      throw error;
    }
  }

  /**
   * Create a conversation within a transaction (for PlansService integration)
   */
  async createWithManager(
    manager: EntityManager,
    planId: string,
    dto: CreateConversationDto,
  ): Promise<Conversation> {
    this.logger.log({
      action: "create_conversation_with_manager",
      planId,
      isDefault: dto.isDefault,
    });

    const conversation = manager.create(Conversation, {
      ...dto,
      planId,
      messageCount: 0,
      isDeleted: false,
    });

    const savedConversation = await manager.save(Conversation, conversation);

    this.logger.log({
      action: "conversation_created_with_manager",
      planId,
      conversationId: savedConversation.id,
    });

    return savedConversation;
  }

  /**
   * Find all conversations for a plan with enriched data
   */
  async findAll(
    userId: string,
    planId: string,
    query: QueryConversationsDto,
  ): Promise<
    PaginatedResponse<Conversation & { lastMessagePreview?: string }>
  > {
    // Verify plan ownership first
    const hasOwnership = await this.plansService.verifyOwnership(
      planId,
      userId,
    );
    if (!hasOwnership) {
      throw new NotFoundException(`Plan with id ${planId} not found`);
    }

    const {
      page = 1,
      limit = 10,
      includeDeleted = false,
      sortBy = "lastMessageAt",
      sortOrder = "DESC",
    } = query;

    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Conversation> = {
      planId,
    };

    if (!includeDeleted) {
      where.isDeleted = false;
    }

    // Build query with subquery for last message preview
    const queryBuilder = this.conversationsRepository
      .createQueryBuilder("c")
      .leftJoin(
        (subQuery) => {
          return subQuery
            .select("m.conversation_id", "conversation_id")
            .addSelect("SUBSTRING(m.content, 1, 120)", "preview")
            .from("messages", "m")
            .where("m.is_deleted = false")
            .distinctOn(["m.conversation_id"])
            .orderBy("m.conversation_id")
            .addOrderBy("m.created_at", "DESC");
        },
        "last_msg",
        "last_msg.conversation_id = c.id",
      )
      .addSelect("last_msg.preview", "lastMessagePreview")
      .where("c.plan_id = :planId", { planId });

    if (!includeDeleted) {
      queryBuilder.andWhere("c.is_deleted = false");
    }

    // Apply sorting
    const validSortOrder =
      sortOrder === "ASC" || sortOrder === "DESC" ? sortOrder : "DESC";
    if (sortBy === "lastMessageAt") {
      queryBuilder.orderBy("c.last_message_at", validSortOrder, "NULLS LAST");
    } else {
      queryBuilder.orderBy(`c.${sortBy}`, validSortOrder);
    }

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [rawResults, total] = await queryBuilder.getManyAndCount();

    // Map raw results to include lastMessagePreview
    const data = rawResults.map((conversation) => {
      const conversationWithPreview = conversation as Conversation & {
        lastMessagePreview?: string;
      };
      return {
        ...conversationWithPreview,
        lastMessagePreview:
          conversationWithPreview.lastMessagePreview || undefined,
      };
    }) as (Conversation & { lastMessagePreview?: string })[];

    const totalPages = Math.ceil(total / limit);

    this.logger.log({
      action: "list_conversations",
      userId,
      planId,
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
   * Find one conversation by ID with ownership check
   */
  async findOne(conversationId: string, userId: string): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
      relations: ["plan"],
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with id ${conversationId} not found`,
      );
    }

    // Verify plan ownership
    if (conversation.plan.userId !== userId) {
      this.logger.warn({
        action: "unauthorized_conversation_access",
        userId,
        conversationId,
        ownerId: conversation.plan.userId,
      });
      throw new NotFoundException(
        `Conversation with id ${conversationId} not found`,
      );
    }

    // Don't return soft-deleted conversations
    if (conversation.isDeleted) {
      throw new NotFoundException(
        `Conversation with id ${conversationId} not found`,
      );
    }

    return conversation;
  }

  /**
   * Update message metadata when a new message is created
   */
  async updateMessageMetadata(
    conversationId: string,
    lastMessageAt: Date,
  ): Promise<void> {
    this.logger.log({
      action: "update_message_metadata",
      conversationId,
    });

    await this.conversationsRepository
      .createQueryBuilder()
      .update(Conversation)
      .set({
        messageCount: () => "message_count + 1",
        lastMessageAt,
      })
      .where("id = :conversationId", { conversationId })
      .execute();
  }

  /**
   * Unset previous default conversation for a plan
   */
  private async unsetPreviousDefault(planId: string): Promise<void> {
    await this.conversationsRepository
      .createQueryBuilder()
      .update(Conversation)
      .set({ isDefault: false })
      .where("plan_id = :planId", { planId })
      .andWhere("is_default = true")
      .andWhere("is_deleted = false")
      .execute();
  }
}
