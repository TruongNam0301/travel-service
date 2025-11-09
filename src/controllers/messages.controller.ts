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
import { CreateMessageDto } from "../dto/messages/create-message.dto";
import { QueryMessagesDto } from "../dto/messages/query-messages.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../entities/user.entity";
import { Message } from "../entities/message.entity";
import { PaginatedResponse } from "../common/dto/paginated-response.dto";

@Controller("conversations")
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post(":id/messages")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute
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
}
