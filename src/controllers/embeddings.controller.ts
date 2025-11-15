import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { SearchEmbeddingsDto } from "../dto/embeddings/search-embeddings.dto";
import { CreateEmbeddingDto } from "../dto/embeddings/create-embedding.dto";
import { QueryEmbeddingsDto } from "../dto/embeddings/query-embeddings.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../entities/user.entity";
import {
  EmbeddingsService,
  SearchResult,
} from "src/services/embeddings.service";
import { Embedding } from "../entities/embedding.entity";
import { PaginatedResponse } from "../common/dto/paginated-response.dto";

@Controller()
@UseGuards(JwtAuthGuard)
export class EmbeddingsController {
  constructor(private readonly embeddingsService: EmbeddingsService) {}

  @Post("embeddings")
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateEmbeddingDto,
  ): Promise<Embedding> {
    return await this.embeddingsService.create(
      user.id,
      dto.planId,
      dto.text,
      dto.refType,
      dto.refId,
    );
  }

  @Get("embeddings/:id")
  async findById(
    @CurrentUser() user: User,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Query("includeVector") includeVector?: string,
  ): Promise<Embedding> {
    const shouldIncludeVector = includeVector === "true";
    return await this.embeddingsService.findById(
      id,
      user.id,
      shouldIncludeVector,
    );
  }

  @Get("plans/:planId/embeddings")
  async findByPlan(
    @CurrentUser() user: User,
    @Param("planId", new ParseUUIDPipe({ version: "4" })) planId: string,
    @Query() query: QueryEmbeddingsDto,
  ): Promise<PaginatedResponse<Embedding>> {
    return await this.embeddingsService.findByPlan(planId, user.id, {
      page: query.page,
      limit: query.limit,
      refType: query.refType,
      refTypes: query.refTypes,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      includeDeleted: query.includeDeleted,
      includeVector: query.includeVector,
    });
  }

  @Delete("embeddings/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: User,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<void> {
    await this.embeddingsService.delete(id, user.id);
  }

  @Post("plans/:planId/embeddings/search")
  async search(
    @CurrentUser() user: User,
    @Param("planId", new ParseUUIDPipe({ version: "4" })) planId: string,
    @Body() dto: SearchEmbeddingsDto,
  ): Promise<SearchResult[]> {
    const res = await this.embeddingsService.searchSimilar(
      user.id,
      planId,
      dto.query,
      {
        topK: dto.topK,
        offset: dto.offset,
        threshold: dto.threshold,
        refTypes: dto.refTypes,
        from: dto.from ? new Date(dto.from) : undefined,
        to: dto.to ? new Date(dto.to) : undefined,
        includeDeleted: dto.includeDeleted,
      },
    );
    return res;
  }
}
