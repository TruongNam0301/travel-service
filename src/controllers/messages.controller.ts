import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { MessagesService } from "../services/messages.service";
import { ChatService } from "../services/chat.service";
import { CreateMessageDto } from "../dto/messages/create-message.dto";
import { ChatMessageDto } from "../dto/messages/chat-message.dto";
import { QueryMessagesDto } from "../dto/messages/query-messages.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UserThrottlerGuard } from "../common/guards/user-throttler.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../entities/user.entity";
import { Message } from "../entities/message.entity";
import { PaginatedResponse } from "../common/dto/paginated-response.dto";

@Controller("conversations")
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly chatService: ChatService,
  ) {}

  @Post(":id/messages")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute per user
  async create(
    @CurrentUser() user: User,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() createMessageDto: CreateMessageDto,
  ): Promise<Message> {
    return await this.messagesService.create(user.id, id, createMessageDto);
  }

  @Get(":id/messages")
  async findAll(
    @CurrentUser() user: User,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Query() query: QueryMessagesDto,
  ): Promise<PaginatedResponse<Message>> {
    return await this.messagesService.findAll(user.id, id, query);
  }

  @Post(":id/chat")
  @HttpCode(HttpStatus.OK)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 chat requests per minute per user
  async chat(
    @CurrentUser() user: User,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() chatMessageDto: ChatMessageDto,
  ) {
    return await this.chatService.sendMessage(
      user.id,
      id,
      chatMessageDto.content,
    );
  }
}
