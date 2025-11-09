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
import { JobsService } from "../services/jobs.service";
import { CreateJobDto } from "../dto/jobs/create-job.dto";
import { UpdateJobDto } from "../dto/jobs/update-job.dto";
import { QueryJobsDto } from "../dto/jobs/query-jobs.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../entities/user.entity";
import { Job } from "../entities/job.entity";
import { PaginatedResponse } from "../common/dto/paginated-response.dto";

@Controller()
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /**
   * Nested route: GET /plans/:planId/jobs
   * List all jobs for a plan
   */
  @Get("plans/:planId/jobs")
  async findAllByPlan(
    @CurrentUser() user: User,
    @Param("planId") planId: string,
    @Query() query: QueryJobsDto,
  ): Promise<PaginatedResponse<Job>> {
    return await this.jobsService.findAllByPlan(planId, user.id, query);
  }

  /**
   * Nested route: POST /plans/:planId/jobs
   * Create and queue a job for a plan
   */
  @Post("plans/:planId/jobs")
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: User,
    @Param("planId") planId: string,
    @Body() createJobDto: CreateJobDto,
  ): Promise<Job> {
    return await this.jobsService.create(planId, user.id, createJobDto);
  }

  /**
   * Flat route: GET /jobs/:id
   * Get a specific job by ID
   */
  @Get("jobs/:id")
  async findOne(
    @CurrentUser() user: User,
    @Param("id") id: string,
  ): Promise<Job> {
    return await this.jobsService.findOne(id, user.id);
  }

  /**
   * Flat route: PATCH /jobs/:id
   * Update job parameters
   */
  @Patch("jobs/:id")
  async update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() updateJobDto: UpdateJobDto,
  ): Promise<Job> {
    return await this.jobsService.update(id, user.id, updateJobDto);
  }

  /**
   * Flat route: DELETE /jobs/:id
   * Cancel a job
   */
  @Delete("jobs/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @CurrentUser() user: User,
    @Param("id") id: string,
  ): Promise<void> {
    await this.jobsService.cancel(id, user.id);
  }
}
