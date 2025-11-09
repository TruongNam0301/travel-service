import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Message, MessageRole } from "../entities/message.entity";
import { Conversation } from "../entities/conversation.entity";
import { CreateMessageDto } from "../dto/messages/create-message.dto";
import { QueryMessagesDto } from "../dto/messages/query-messages.dto";
import { PaginatedResponse } from "../common/dto/paginated-response.dto";
import { ConversationsService } from "./conversations.service";

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
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
    // Check raw content length first (before any processing)
    if (dto.content && dto.content.length > 10000) {
      throw new HttpException(
        "Payload Too Large: Message content cannot exceed 10,000 characters",
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    // Normalize whitespace
    const normalizedContent = dto.content.replace(/\s+/g, " ").trim();

    // Reject if empty after normalization
    if (!normalizedContent || normalizedContent.length === 0) {
      throw new BadRequestException("Message cannot be empty");
    }

    // Verify conversation ownership (will throw 404 if unauthorized)
    const conversation = await this.conversationsService.findOne(
      conversationId,
      userId,
    );

    this.logger.log({
      action: "create_message",
      userId,
      conversationId,
      planId: conversation.planId,
      contentLength: normalizedContent.length,
    });

    const message = this.messagesRepository.create({
      conversationId,
      role: MessageRole.USER,
      content: normalizedContent,
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
      action: "message_created",
      userId,
      conversationId,
      planId: conversation.planId,
      messageId: savedMessage.id,
    });

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
}
