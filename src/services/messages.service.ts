import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PaginatedResponse } from "../common/dto/paginated-response.dto";
import { CreateMessageDto } from "../dto/messages/create-message.dto";
import { QueryMessagesDto } from "../dto/messages/query-messages.dto";
import { Conversation } from "../entities/conversation.entity";
import { Message, MessageRole } from "../entities/message.entity";
import { ConversationsService } from "./conversations.service";

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationsService: ConversationsService,
  ) {}

  /**
   * Create a user message
   */
  async create(
    userId: string,
    conversationId: string,
    dto: CreateMessageDto,
  ): Promise<Message> {
    const message = this.messagesRepository.create({
      conversationId,
      role: MessageRole.USER,
      content: dto.content.replace(/\s+/g, " ").trim(),
      createdBy: userId,
      isDeleted: false,
    });

    const savedMessage = await this.messagesRepository.save(message);

    await this.conversationsService.updateMessageMetadata(
      conversationId,
      savedMessage.createdAt,
    );

    return savedMessage;
  }

  /**
   * Find all messages for a conversation with pagination
   */
  async findAll(
    userId: string,
    conversationId: string,
    query: QueryMessagesDto,
  ): Promise<PaginatedResponse<Message>> {
    // Verify conversation ownership (will throw 404 if unauthorized)
    const conversation = await this.conversationsService.findOne(
      conversationId,
      userId,
    );

    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "ASC",
    } = query;

    const skip = (page - 1) * limit;

    // Build query with stable sort (createdAt, id)
    const validSortOrder =
      sortOrder === "ASC" || sortOrder === "DESC" ? sortOrder : "ASC";
    const queryBuilder = this.messagesRepository
      .createQueryBuilder("m")
      .where("m.conversation_id = :conversationId", { conversationId })
      .andWhere("m.is_deleted = false")
      .orderBy(`m.${sortBy}`, validSortOrder)
      .addOrderBy("m.id", "ASC") // Stable sort
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    this.logger.log({
      action: "list_messages",
      userId,
      conversationId,
      planId: conversation.planId,
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
   * Get recent messages for a conversation (internal use, no ownership check)
   * Used by context builders
   */
  async getRecentMessagesInternal(
    conversationId: string,
    limit: number,
  ): Promise<Message[]> {
    return await this.messagesRepository.find({
      where: {
        conversationId,
        isDeleted: false,
      },
      order: {
        createdAt: "DESC",
        id: "ASC",
      },
      take: limit,
    });
  }

  /**
   * Create an assistant message
   */
  async createAssistantMessage(
    userId: string,
    conversationId: string,
    content: string,
  ): Promise<Message> {
    // Verify conversation ownership
    const conversation = await this.conversationsService.findOne(
      conversationId,
      userId,
    );

    this.logger.log({
      action: "create_assistant_message",
      userId,
      conversationId,
      planId: conversation.planId,
      contentLength: content.length,
    });

    const message = this.messagesRepository.create({
      conversationId,
      role: MessageRole.ASSISTANT,
      content,
      createdBy: userId,
      isDeleted: false,
    });

    const savedMessage = await this.messagesRepository.save(message);

    // Update conversation metadata
    await this.conversationsService.updateMessageMetadata(
      conversationId,
      savedMessage.createdAt,
    );

    this.logger.log({
      action: "assistant_message_created",
      userId,
      conversationId,
      planId: conversation.planId,
      messageId: savedMessage.id,
    });

    return savedMessage;
  }
}
