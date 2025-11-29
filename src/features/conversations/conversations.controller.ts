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
import { ConversationsService } from "./conversations.service";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { QueryConversationsDto } from "./dto/query-conversations.dto";
import { JwtAuthGuard } from "../../core/guards/jwt-auth.guard";
import { CurrentUser } from "../../core/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { Conversation } from "./entities/conversation.entity";
import { PaginatedResponse } from "../../core/dto/paginated-response.dto";

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
