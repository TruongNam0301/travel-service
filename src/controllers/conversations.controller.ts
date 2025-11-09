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
import { ConversationsService } from "../services/conversations.service";
import { CreateConversationDto } from "../dto/conversations/create-conversation.dto";
import { QueryConversationsDto } from "../dto/conversations/query-conversations.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../entities/user.entity";
import { Conversation } from "../entities/conversation.entity";
import { PaginatedResponse } from "../common/dto/paginated-response.dto";

@Controller()
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get("plans/:planId/conversations")
  async findAll(
    @CurrentUser() user: User,
    @Param("planId", new ParseUUIDPipe({ version: "4" })) planId: string,
    @Query() query: QueryConversationsDto,
  ): Promise<
    PaginatedResponse<Conversation & { lastMessagePreview?: string }>
  > {
    return await this.conversationsService.findAll(user.id, planId, query);
  }

  @Post("plans/:planId/conversations")
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: User,
    @Param("planId", new ParseUUIDPipe({ version: "4" })) planId: string,
    @Body() createConversationDto: CreateConversationDto,
  ): Promise<Conversation> {
    return await this.conversationsService.create(
      user.id,
      planId,
      createConversationDto,
    );
  }

  @Get("conversations/:id")
  async findOne(
    @CurrentUser() user: User,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<Conversation> {
    return await this.conversationsService.findOne(id, user.id);
  }
}
