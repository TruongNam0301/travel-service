import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as Handlebars from "handlebars";
import { PromptTemplate } from "./entities/prompt-template.entity";
import { JobType } from "../../features/jobs/entities/job-type.entity";

export class PromptTemplateError extends Error {
  constructor(
    message: string,
    public readonly templateId?: string,
    public readonly jobType?: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = "PromptTemplateError";
    Object.setPrototypeOf(this, PromptTemplateError.prototype);
  }
}

/**
 * Service for rendering DB-stored prompt templates using Handlebars
 */
@Injectable()
export class PromptTemplatesService {
  private readonly logger = new Logger(PromptTemplatesService.name);
  private readonly handlebars: typeof Handlebars;

  constructor(
    @InjectRepository(PromptTemplate)
    private readonly promptTemplateRepository: Repository<PromptTemplate>,
    @InjectRepository(JobType)
    private readonly jobTypeRepository: Repository<JobType>,
  ) {
    // Initialize Handlebars with custom helpers
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  /**
   * Register custom Handlebars helpers for safe defaults and utilities
   */
  private registerHelpers(): void {
    this.handlebars.registerHelper(
      "default",
      function (value: any, defaultValue: any): any {
        return value !== undefined && value !== null && value !== ""
          ? value
          : defaultValue;
      },
    );
  }

  /**
   * Render a prompt template with the given context
   * @param templateIdOrJobType - Either a template UUID or job type name
   * @param ctx - Context object with variables for template rendering
   * @returns Rendered prompt string
   * @throws PromptTemplateError if template not found or rendering fails
   */
  async render(
    templateIdOrJobType: string,
    ctx: Record<string, any>,
  ): Promise<string> {
    let template: PromptTemplate | null = null;
    let lookupMethod: "templateId" | "jobType" = "jobType";

    // Check if input is a UUID format (8-4-4-4-12 pattern)
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        templateIdOrJobType,
      );

    // Try to load template by ID if UUID format
    if (isUuid) {
      lookupMethod = "templateId";
      template = await this.promptTemplateRepository.findOne({
        where: { id: templateIdOrJobType },
        relations: ["jobType"],
      });

      if (!template) {
        this.logger.warn({
          action: "template_not_found_by_id",
          templateId: templateIdOrJobType,
        });
      }
    }

    // If not found by ID or not UUID, try loading by job type name
    if (!template) {
      lookupMethod = "jobType";
      const jobType = await this.jobTypeRepository.findOne({
        where: { name: templateIdOrJobType, isActive: true },
        relations: ["promptTemplates"],
      });

      if (jobType) {
        // Get the active template with the highest version
        template = await this.promptTemplateRepository
          .createQueryBuilder("pt")
          .where("pt.job_type_id = :jobTypeId", { jobTypeId: jobType.id })
          .andWhere("pt.is_active = :isActive", { isActive: true })
          .orderBy("pt.version", "DESC")
          .getOne();
      }

      if (!template) {
        const error = new PromptTemplateError(
          `Prompt template not found for ${isUuid ? "templateId" : "jobType"}: ${templateIdOrJobType}`,
          isUuid ? templateIdOrJobType : undefined,
          !isUuid ? templateIdOrJobType : undefined,
        );

        this.logger.error({
          action: "template_not_found",
          lookupMethod,
          identifier: templateIdOrJobType,
          error: error.message,
        });

        throw error;
      }
    }

    // Compile and render the template
    try {
      const compiledTemplate = this.handlebars.compile(template.template, {
        strict: false, // Allow missing properties without throwing
        noEscape: false, // Keep HTML escaping for safety
      });

      const rendered = compiledTemplate(ctx);

      this.logger.log({
        action: "template_rendered",
        templateId: template.id,
        jobType: template.jobType?.name,
        contextKeys: Object.keys(ctx),
      });

      return rendered;
    } catch (error) {
      const templateError = new PromptTemplateError(
        `Failed to render template: ${error instanceof Error ? error.message : "Unknown error"}`,
        template.id,
        template.jobType?.name,
        error instanceof Error ? error : undefined,
      );

      throw templateError;
    }
  }
}
