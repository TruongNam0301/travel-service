import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { PlansService } from "./plans.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { QueryPlansDto } from "./dto/query-plans.dto";
import { JwtAuthGuard } from "../../core/guards/jwt-auth.guard";
import { CurrentUser } from "../../core/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { Plan } from "./entities/plan.entity";
import { PaginatedResponse } from "../../core/dto/paginated-response.dto";
import { MemoryCompressionService } from "../../domain/memory-compression/memory-compression.service";
import {
  CompressionDiagnostics,
  MemoryStats,
  CompressionResult,
} from "../../core/types/memory-compression.type";
import { ParseUUIDPipe } from "@nestjs/common";
import { CompressMemoryDto } from "./dto/compress-memory.dto";

@Controller("plans")
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly memoryCompressionService: MemoryCompressionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: User,
    @Body() createPlanDto: CreatePlanDto,
  ): Promise<Plan> {
    return await this.plansService.create(user.id, createPlanDto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query() query: QueryPlansDto,
  ): Promise<PaginatedResponse<Plan>> {
    return await this.plansService.findAll(user.id, query);
  }

  @Get(":id")
  async findOne(
    @CurrentUser() user: User,
    @Param("id") id: string,
  ): Promise<Plan> {
    return await this.plansService.findOne(id, user.id);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() updatePlanDto: UpdatePlanDto,
  ): Promise<Plan> {
    return await this.plansService.update(id, user.id, updatePlanDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: User,
    @Param("id") id: string,
  ): Promise<void> {
    await this.plansService.softDelete(id, user.id);
  }

  @Get(":id/memory/diagnostics")
  async getMemoryDiagnostics(
    @CurrentUser() user: User,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<CompressionDiagnostics> {
    return await this.memoryCompressionService.getCompressionDiagnostics(
      id,
      user.id,
    );
  }

  @Get(":id/memory/stats")
  async getMemoryStats(
    @CurrentUser() user: User,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<MemoryStats> {
    return await this.memoryCompressionService.getMemoryStats(id, user.id);
  }

  @Post(":id/memory/compress")
  @HttpCode(HttpStatus.OK)
  async compressMemory(
    @CurrentUser() user: User,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() compressMemoryDto: CompressMemoryDto,
  ): Promise<CompressionResult> {
    return await this.memoryCompressionService.compressPlanMemory(
      id,
      compressMemoryDto.mode,
      user.id,
      { dryRun: compressMemoryDto.dryRun ?? false },
    );
  }
}
