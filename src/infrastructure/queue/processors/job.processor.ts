import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, forwardRef, Optional } from "@nestjs/common";
import { Job } from "bullmq";
import { LLM_CLIENT } from "../../llm/llm.client";
import type { LlmClient } from "../../llm/llm.client";
import { LlmConfig } from "../../llm/llm.config";
import { JobState } from "../../../features/jobs/entities/job.entity";
import { JobsService } from "../../../features/jobs/jobs.service";
import { MessagesService } from "../../../features/messages/messages.service";
import { JobData, JobResult } from "../../../core/types/job.type";
import {
  PromptTemplatesService,
  PromptTemplateError,
} from "../../../domain/prompt-templates/prompt-templates.service";
import { MemoryCompressionService } from "../../../domain/memory-compression/memory-compression.service";
import { CompressionResult } from "../../../core/types/memory-compression.type";
import { FinalContextComposer } from "../../../domain/context-builders/final-context-composer.service";
import { RegionService } from "../../../domain/region/region.service";
import { EmbeddingsGlobalService } from "../../../features/embeddings/embeddings-global.service";
import { GridCrawlService } from "../../../domain/region/grid-crawl.service";
import { EmbeddingGlobal } from "../../../features/embeddings/entities/embedding-global.entity";

/**
 * Research Jobs Processor
 * Processes research-related jobs and updates DB state
 */

@Processor("research-jobs")
export class JobProcessor extends WorkerHost {
  private readonly logger = new Logger(JobProcessor.name);

  constructor(
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
    @Inject(LLM_CLIENT)
    private readonly llmClient: LlmClient,
    private readonly llmConfig: LlmConfig,
    private readonly promptTemplatesService: PromptTemplatesService,
    private readonly memoryCompressionService: MemoryCompressionService,
    private readonly finalContextComposer: FinalContextComposer,
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
    // Google Maps integration services (optional - graceful degradation if not available)
    @Optional()
    private readonly regionService?: RegionService,
    @Optional()
    private readonly embeddingsGlobalService?: EmbeddingsGlobalService,
    @Optional()
    private readonly gridCrawlService?: GridCrawlService,
  ) {
    super();
  }

  private resolveModelForJob(jobType: string): string {
    const { routing, chatModel } = this.llmConfig.values;
    return routing.jobs[jobType] ?? routing.chat.default ?? chatModel;
  }

  async process(job: Job<JobData, JobResult, string>): Promise<JobResult> {
    const { jobId, type, params } = job.data;

    this.logger.log({
      action: "processing_job",
      jobId,
      type,
      bullJobId: job.id,
    });

    try {
      let result: JobResult;

      switch (type) {
        case "research_hotel":
          result = await this.processResearchHotel(params);
          break;
        case "find_food":
          result = await this.processFindFood(params);
          break;
        case "find_attraction":
          result = await this.processFindAttraction(params);
          break;
        case "memory_compression":
          result = await this.processMemoryCompression(job, params);
          break;
        default:
          this.logger.warn(`Unknown job type: ${type}`);
          result = {
            success: false,
            jobType: type,
            data: {},
            summary: "Unknown job type",
            meta: {
              createdAt: new Date().toISOString(),
              model: "unknown",
              tokensUsed: 0,
            },
          };
      }

      return result;
    } catch (error) {
      this.logger.error(`Job ${jobId} processing failed:`, error);
      throw error;
    }
  }

  @OnWorkerEvent("active")
  async onActive(job: Job<JobData>) {
    const { jobId } = job.data;

    this.logger.log({
      action: "job_active",
      jobId,
      bullJobId: job.id,
    });

    // Update DB state to PROCESSING
    await this.jobsService.updateJobState(jobId, {
      state: JobState.PROCESSING,
      startedAt: new Date(),
      workerId: job.id?.toString(),
    });
  }

  @OnWorkerEvent("completed")
  async onCompleted(job: Job<JobData, JobResult>) {
    const { jobId, params, userId } = job.data;
    const result = job.returnvalue;
    const finishedAt = new Date();
    const startedAt = job.processedOn ? new Date(job.processedOn) : finishedAt;
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    this.logger.log({
      action: "job_completed",
      jobId,
      bullJobId: job.id,
      durationMs,
    });

    // Update DB state to COMPLETED with result
    await this.jobsService.updateJobState(jobId, {
      state: JobState.COMPLETED,
      finishedAt,
      durationMs,
      result: result as unknown as Record<string, unknown>,
    });

    // Send results back to conversation if conversationId is present
    const conversationId = params.conversationId as string | undefined;
    if (conversationId && userId && result) {
      try {
        const formattedResult = this.formatJobResultForUser(result);
        await this.messagesService.createAssistantMessage(
          userId,
          conversationId,
          formattedResult,
        );

        this.logger.log({
          action: "job_result_sent_to_conversation",
          jobId,
          conversationId,
        });
      } catch (error) {
        this.logger.warn({
          action: "job_result_delivery_failed",
          jobId,
          conversationId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<JobData>, error: Error) {
    const { jobId, params, userId } = job.data;
    const finishedAt = new Date();
    const startedAt = job.processedOn ? new Date(job.processedOn) : finishedAt;
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    this.logger.error({
      action: "job_failed",
      jobId,
      bullJobId: job.id,
      error: error.message,
      durationMs,
    });

    // Update DB state to FAILED with error
    await this.jobsService.updateJobState(jobId, {
      state: JobState.FAILED,
      finishedAt,
      durationMs,
      error: error.message,
    });

    // Notify user of failure if conversationId is present
    const conversationId = params.conversationId as string | undefined;
    if (conversationId && userId) {
      try {
        const errorMessage = `I'm sorry, but I encountered an error while processing your request: ${error.message}. Please try again or rephrase your request.`;
        await this.messagesService.createAssistantMessage(
          userId,
          conversationId,
          errorMessage,
        );

        this.logger.log({
          action: "job_error_sent_to_conversation",
          jobId,
          conversationId,
        });
      } catch (notificationError) {
        this.logger.warn({
          action: "job_error_notification_failed",
          jobId,
          conversationId,
          error:
            notificationError instanceof Error
              ? notificationError.message
              : "Unknown error",
        });
      }
    }
  }

  /**
   * Format job result for user-friendly display in conversation
   * Returns JSON string with both message and structured data for frontend mapping
   */
  private formatJobResultForUser(result: JobResult): string {
    if (!result.success) {
      const errorResponse = {
        type: "job_result",
        success: false,
        message: `I couldn't complete the search. ${result.summary || "Please try again."}`,
        data: null,
      };
      return JSON.stringify(errorResponse);
    }

    // Create structured response with both message and data
    const response = {
      type: "job_result",
      success: true,
      jobType: result.jobType,
      message: result.summary || "Here's what I found:",
      data: result.data, // Full structured data for frontend mapping
      meta: result.meta,
    };

    return JSON.stringify(response, null, 2);
  }

  /**
   * Strips markdown code blocks from LLM response text before JSON parsing.
   * Handles cases where LLM wraps JSON in ```json ... ``` or ``` ... ```
   */
  private stripMarkdownCodeBlocks(text: string): string {
    let cleaned = text.trim();

    // Remove markdown code block markers (```json or ```)
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");

    return cleaned.trim();
  }

  /**
   * Renders a prompt template for the given job type with context.
   * Falls back to hardcoded prompt if template not found (backward compatibility).
   * @param jobType - Job type name (e.g., 'research_hotel')
   * @param params - Job parameters to use as template context
   * @param fallbackPrompt - Hardcoded prompt to use if template rendering fails
   * @returns Rendered prompt string
   */
  private async renderPrompt(
    jobType: string,
    params: Record<string, unknown>,
    fallbackPrompt: string,
  ): Promise<string> {
    try {
      // Build memory context if planId is available
      let contextPrefix = "";
      const planId = params.planId as string | undefined;
      const conversationId = params.conversationId as string | undefined;
      const query = params.query as string | undefined;

      if (planId) {
        try {
          const finalContext = await this.finalContextComposer.composeContext({
            planId,
            conversationId,
            query,
            includeConversation: !!conversationId,
            includeEmbeddings: true,
            includePlan: true,
          });

          if (finalContext.formatted) {
            contextPrefix = finalContext.formatted + "\n\n";
            this.logger.log({
              action: "prompt.context_added",
              jobType,
              planId,
              conversationId,
              contextTokens: finalContext.tokenCount,
            });
          }
        } catch (error) {
          // Log but don't fail - continue without context
          this.logger.warn({
            action: "prompt.context_build_failed",
            jobType,
            planId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const context = {
        ...params,
        jobId: params.jobId,
      };
      const rendered = await this.promptTemplatesService.render(
        jobType,
        context,
      );

      // Prepend context if available
      return contextPrefix + rendered;
    } catch (error) {
      if (error instanceof PromptTemplateError) {
        this.logger.warn({
          action: "template_render_failed_fallback",
          jobType,
          templateId: error.templateId,
          error: error.message,
          usingFallback: true,
        });
      } else {
        this.logger.warn({
          action: "template_render_unexpected_error",
          jobType,
          error: error instanceof Error ? error.message : String(error),
          usingFallback: true,
        });
      }
      // Fallback to hardcoded prompt for backward compatibility
      return fallbackPrompt;
    }
  }

  private async processResearchHotel(
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    // Extract destination (larger region) with fallback to city for backward compatibility
    const destination =
      (params.destination as string) || (params.city as string);
    // Extract location (smaller sub-area) separately
    const location = params.location as string | undefined;
    const minRating =
      (params.minRating as number) || (params.reviewScore as number);
    const limit = (params.limit as number) || 10;

    if (!destination) {
      throw new Error(
        "Missing required parameter: destination or city must be provided",
      );
    }

    this.logger.log({
      action: "research_hotel.start",
      destination,
      location,
      minRating,
      limit,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // HYBRID APPROACH: Check global embeddings first, then crawl if needed
    // ─────────────────────────────────────────────────────────────────────────

    // Check if Google Maps services are available
    if (
      this.regionService &&
      this.embeddingsGlobalService &&
      this.gridCrawlService
    ) {
      try {
        return await this.processResearchHotelWithGoogleMaps(
          destination,
          location,
          minRating,
          limit,
          params,
        );
      } catch (error) {
        this.logger.warn({
          action: "research_hotel.google_maps_failed_fallback_to_llm",
          destination,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Fall through to LLM-only approach
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FALLBACK: LLM-only approach (original behavior)
    // ─────────────────────────────────────────────────────────────────────────
    return await this.processResearchHotelWithLLM(params);
  }

  /**
   * Process hotel research using Google Maps data (hybrid approach)
   */
  private async processResearchHotelWithGoogleMaps(
    destination: string,
    _location: string | undefined,
    minRating: number | undefined,
    limit: number,
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    const regionId = this.regionService!.normalizeRegionId(destination);

    this.logger.log({
      action: "research_hotel.check_global_data",
      destination,
      regionId,
    });

    // Step 1: Check if we have data for this region
    const regionCheck = await this.regionService!.checkRegionData(
      destination,
      "lodging",
      50, // Minimum 50 hotels to consider data sufficient
    );

    let dataSource: "google_maps" | "google_maps+crawl" | "llm_only" =
      "google_maps";

    // Step 2: If no data or stale, trigger crawl
    if (regionCheck.needsCrawl) {
      this.logger.log({
        action: "research_hotel.trigger_crawl",
        regionId,
        reason: regionCheck.reason,
      });

      dataSource = "google_maps+crawl";

      // Crawl the region for lodging
      const crawlResult = await this.gridCrawlService!.crawlRegion(
        destination,
        "lodging",
      );

      if (crawlResult.errors.length > 0 && crawlResult.places.length === 0) {
        // Crawl completely failed, fall back to LLM
        throw new Error(`Crawl failed: ${crawlResult.errors.join(", ")}`);
      }

      this.logger.log({
        action: "research_hotel.crawl_complete",
        regionId,
        placesFound: crawlResult.places.length,
        apiCalls: crawlResult.totalApiCalls,
        duration: crawlResult.duration,
      });
    }

    // Step 3: Query stored data with filters
    const filters = {
      minRating,
    };

    const hotels = await this.embeddingsGlobalService!.searchByRegion(
      regionId,
      "lodging",
      filters,
      limit,
    );

    this.logger.log({
      action: "research_hotel.query_complete",
      regionId,
      hotelsFound: hotels.length,
      dataSource,
    });

    // Step 4: Format results
    const formattedHotels = hotels.map((h) => this.formatHotelResult(h));

    // Step 5: Optional LLM enrichment for recommendations
    let summary = `Found ${hotels.length} hotel${hotels.length !== 1 ? "s" : ""} in ${destination}`;
    let tokensUsed = 0;

    if (hotels.length > 0 && params.query) {
      // Use LLM to generate a natural language summary
      try {
        const enrichmentResult = await this.enrichHotelResultsWithLLM(
          formattedHotels,
          params.query as string,
          params,
        );
        summary = enrichmentResult.summary;
        tokensUsed = enrichmentResult.tokensUsed;
      } catch (error) {
        this.logger.warn({
          action: "research_hotel.llm_enrichment_failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      success: true,
      jobType: "research_hotel",
      data: {
        hotels: formattedHotels,
        regionId,
        dataSource,
      },
      summary,
      meta: {
        createdAt: new Date().toISOString(),
        model: "google_maps",
        tokensUsed,
        dataSource,
      },
    };
  }

  /**
   * Format EmbeddingGlobal to hotel result structure
   */
  private formatHotelResult(hotel: EmbeddingGlobal): Record<string, unknown> {
    return {
      name: hotel.name,
      rating: hotel.rating,
      totalReviews: hotel.totalRatings,
      priceLevel:
        hotel.priceLevel !== undefined
          ? "$".repeat(hotel.priceLevel + 1)
          : undefined,
      address: hotel.address,
      location: {
        lat: Number(hotel.lat),
        lng: Number(hotel.lng),
      },
      googleMapsUrl: hotel.rawData.url,
      photos: hotel.photos?.slice(0, 3).map((p) => ({
        reference: p.photoReference,
        width: p.width,
        height: p.height,
      })),
      types: hotel.types,
      openNow: hotel.openingHours?.openNow,
      website: hotel.website,
      phoneNumber: hotel.phoneNumber,
      placeId: hotel.placeId,
    };
  }

  /**
   * Use LLM to enrich hotel results with natural language summary
   */
  private async enrichHotelResultsWithLLM(
    hotels: Record<string, unknown>[],
    userQuery: string,
    params: Record<string, unknown>,
  ): Promise<{ summary: string; tokensUsed: number }> {
    const hotelSummary = hotels
      .slice(0, 5)
      .map((h, i) => {
        const name = typeof h.name === "string" ? h.name : "Unknown";
        const rating =
          typeof h.rating === "number" ? h.rating.toString() : "N/A";
        const address = typeof h.address === "string" ? h.address : "";
        return `${i + 1}. ${name} (${rating}★, ${address})`;
      })
      .join("\n");

    const prompt = `Based on the user's request: "${userQuery}"

Here are the top hotels found:
${hotelSummary}

Write a brief, helpful summary (2-3 sentences) recommending these hotels to the user. Be friendly and mention key highlights.`;

    const model = this.resolveModelForJob("research_hotel");
    const { text, usage } = await this.llmClient.generate(prompt, {
      jobId: params.jobId as string,
      temperature: 0.5,
      maxTokens: 200,
      model,
    });

    return {
      summary: text.trim(),
      tokensUsed: usage?.total ?? 0,
    };
  }

  /**
   * Original LLM-only hotel research (fallback)
   */
  private async processResearchHotelWithLLM(
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    const destination =
      (params.destination as string) || (params.city as string);
    const location = params.location as string | undefined;
    const nights = params.nights as number;
    const locationDetails = params.locationDetails as string;
    const budget = params.budget as string;
    const reviewScore = params.reviewScore as number;
    const checkInDate = params.checkInDate as string;
    const checkOutDate = params.checkOutDate as string;
    const budgetPerNight = params.budgetPerNight as number;
    const currency = params.currency as string;
    const minRating = params.minRating as number;
    const guests = params.guests as number;

    // Build location text (smaller sub-area)
    const locationText = location ? ` in ${location}` : "";
    // Build location details (address)
    const locationDetailsPrompt = locationDetails
      ? ` in address ${locationDetails}`
      : "";

    // Build date range prompt
    const dateRangePrompt =
      checkInDate && checkOutDate
        ? ` from ${checkInDate} to ${checkOutDate}`
        : nights
          ? ` for ${nights} night${nights > 1 ? "s" : ""}`
          : "";

    // Build budget prompt (support both formats)
    const budgetValue = budgetPerNight
      ? `${budgetPerNight.toLocaleString()} ${currency || "VND"} per night`
      : budget || "";
    const budgetPrompt = budgetValue ? ` with budget ${budgetValue}` : "";

    // Build rating prompt
    const ratingValue = minRating || reviewScore;
    const ratingPrompt = ratingValue
      ? ` with rating ${ratingValue} or higher`
      : "";

    // Build guests prompt
    const guestsPrompt = guests
      ? ` for ${guests} guest${guests > 1 ? "s" : ""}`
      : "";

    const fallbackPrompt = `You are a travel research assistant in VietNam. Find google maps and return hotel recommendations for ${destination}${locationText}${dateRangePrompt}${guestsPrompt}${locationDetailsPrompt}${budgetPrompt}${ratingPrompt}.
Return ONLY valid JSON with this exact structure: {
  "hotels": [
    {
      "name": "Hotel Name",
      "price": "price per night",
      "rating": "rating out of 5",
      "amenities": ["amenity1", "amenity2"],
      "location": "specific area in city",
      "address": "address of the hotel",
      "link_google_maps": "link to the hotel on google maps"
    }
  ]
}`;

    const prompt = await this.renderPrompt(
      "research_hotel",
      params,
      fallbackPrompt,
    );

    const model = this.resolveModelForJob("research_hotel");
    const {
      text,
      usage,
      model: responseModel,
    } = await this.llmClient.generate(prompt, {
      jobId: params.jobId as string,
      temperature: 0.3,
      maxTokens: 2000,
      model,
    });

    // Parse JSON safely
    let parsedData: Record<string, unknown>;
    try {
      const cleanedText = this.stripMarkdownCodeBlocks(text);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(cleanedText);
      parsedData = parsed as Record<string, unknown>;
    } catch (error) {
      this.logger.error("Failed to parse LLM response as JSON:", {
        error: error instanceof Error ? error.message : "Unknown error",
        text: text.substring(0, 200),
      });
      throw new Error(
        `Failed to parse JSON from LLM response: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    const hotelCount = (parsedData?.hotels as unknown[])?.length ?? 0;
    const locationSummary = location ? ` in ${location}` : "";
    const summary =
      hotelCount > 0
        ? `Found ${hotelCount} hotel${hotelCount > 1 ? "s" : ""} in ${destination}${locationSummary}`
        : `No hotels found in ${destination}${locationSummary} matching your criteria`;

    return {
      success: true,
      jobType: "research_hotel",
      data: {
        ...parsedData,
        dataSource: "llm_only",
      },
      summary,
      meta: {
        createdAt: new Date().toISOString(),
        model: responseModel ?? "unknown",
        tokensUsed: usage?.total ?? 0,
        dataSource: "llm_only",
      },
    };
  }

  private async processFindFood(
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    // Extract destination (larger region) with fallback to city for backward compatibility
    const destination =
      (params.destination as string) || (params.city as string);
    // Extract location (smaller sub-area) separately
    const location = params.location as string | undefined;
    const cuisine = params.cuisine as string;
    const budget = params.budget as string;

    if (!destination) {
      throw new Error(
        "Missing required parameter: destination or city must be provided",
      );
    }

    this.logger.log("Processing find_food job with params:", params);

    const locationText = location ? ` in ${location}` : "";
    const fallbackPrompt = `You are a travel research assistant. Find and return restaurant recommendations for ${destination}${locationText}${cuisine ? ` specializing in ${cuisine} cuisine` : ""}${budget ? ` with ${budget} budget` : ""}.
Return ONLY valid JSON with this exact structure:
{
  "restaurants": [
    {
      "name": "Restaurant Name",
      "cuisine": "cuisine type",
      "priceRange": "$ or $$ or $$$ or $$$$",
      "rating": "rating out of 5",
      "specialties": ["dish1", "dish2"],
      "location": "specific area in city",
      "description": "brief description"
    }
  ]
}`;

    const prompt = await this.renderPrompt("find_food", params, fallbackPrompt);

    const model = this.resolveModelForJob("find_food");
    const {
      text,
      usage,
      model: responseModel,
    } = await this.llmClient.generate(prompt, {
      jobId: params.jobId as string,
      temperature: 0.4,
      maxTokens: 2000,
      model,
    });

    let parsedData: Record<string, unknown>;
    try {
      const cleanedText = this.stripMarkdownCodeBlocks(text);
      parsedData = JSON.parse(cleanedText) as Record<string, unknown>;
    } catch (error) {
      throw new Error(
        `Failed to parse JSON from LLM response: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    const locationSummary = location ? ` in ${location}` : "";
    return {
      success: true,
      jobType: "find_food",
      data: parsedData,
      summary: `Found ${(parsedData?.restaurants as unknown[])?.length ?? 0} restaurants in ${destination}${locationSummary}`,
      meta: {
        createdAt: new Date().toISOString(),
        model: responseModel ?? "unknown",
        tokensUsed: usage?.total ?? 0,
      },
    };
  }

  private async processFindAttraction(
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    // Support both old format (city) and new format (location, destination)
    const city =
      (params.city as string) ||
      (params.location as string) ||
      (params.destination as string);
    const category = params.category as string;
    const duration = params.duration as string;

    if (!city) {
      throw new Error(
        "Missing required parameter: city, location, or destination must be provided",
      );
    }

    this.logger.log("Processing find_attraction job with params:", params);

    const fallbackPrompt = `You are a travel research assistant. Find and return tourist attraction recommendations for ${city}${category ? ` in the ${category} category` : ""}${duration ? ` suitable for ${duration} visits` : ""}.
Return ONLY valid JSON with this exact structure:
{
  "attractions": [
    {
      "name": "Attraction Name",
      "category": "category type (museum, park, historical, etc.)",
      "rating": "rating out of 5",
      "estimatedDuration": "typical visit duration",
      "entryFee": "entry fee or 'Free'",
      "location": "specific area in city",
      "highlights": ["highlight1", "highlight2"],
      "description": "brief description"
    }
  ]
}`;

    const prompt = await this.renderPrompt(
      "find_attraction",
      params,
      fallbackPrompt,
    );

    const model = this.resolveModelForJob("find_attraction");
    const {
      text,
      usage,
      model: responseModel,
    } = await this.llmClient.generate(prompt, {
      jobId: params.jobId as string,
      temperature: 0.4,
      maxTokens: 2000,
      model,
    });

    // Parse JSON safely
    let parsedData: Record<string, unknown>;
    try {
      const cleanedText = this.stripMarkdownCodeBlocks(text);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(cleanedText);
      parsedData = parsed as Record<string, unknown>;
    } catch (error) {
      this.logger.error("Failed to parse LLM response as JSON:", {
        error: error instanceof Error ? error.message : "Unknown error",
        text: text.substring(0, 200),
      });
      throw new Error(
        `Failed to parse JSON from LLM response: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return {
      success: true,
      jobType: "find_attraction",
      data: parsedData,
      summary: `Found ${(parsedData?.attractions as unknown[])?.length ?? 0} attractions in ${city}`,
      meta: {
        createdAt: new Date().toISOString(),
        model: responseModel ?? "unknown",
        tokensUsed: usage?.total ?? 0,
      },
    };
  }

  private async processMemoryCompression(
    job: Job<JobData, JobResult, string>,
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    const planId = params.planId as string;
    const mode = params.mode as "light" | "full";
    const userId = params.userId as string | undefined;
    const dryRun = params.dryRun as boolean | undefined;

    if (!planId) {
      throw new Error("Missing required parameter: planId");
    }

    if (!mode || (mode !== "light" && mode !== "full")) {
      throw new Error(
        "Missing or invalid parameter: mode (must be 'light' or 'full')",
      );
    }

    // Track metrics: start time, CPU usage, memory
    const processingStartTime = Date.now();
    const cpuUsageBefore = process.cpuUsage();
    const memoryUsageBefore = process.memoryUsage();

    // Calculate queue time (time from job creation to processing start)
    const queueTimeMs = job.processedOn
      ? job.processedOn - (job.timestamp || Date.now())
      : 0;

    this.logger.log({
      action: "memory_compression.worker.start",
      planId,
      mode,
      userId: userId ?? null,
      dryRun: dryRun ?? false,
      queueTimeMs,
      jobCreatedAt: job.timestamp
        ? new Date(job.timestamp).toISOString()
        : null,
    });

    let compressionResult: CompressionResult;
    try {
      compressionResult =
        await this.memoryCompressionService.compressPlanMemory(
          planId,
          mode,
          userId,
          { dryRun },
        );
    } finally {
      // Track metrics: end time, CPU usage, memory
      const processingEndTime = Date.now();
      const processingDurationMs = processingEndTime - processingStartTime;
      const cpuUsageAfter = process.cpuUsage(cpuUsageBefore);
      const memoryUsageAfter = process.memoryUsage();

      // Calculate CPU usage
      const cpuUserMs = cpuUsageAfter.user / 1000; // Convert microseconds to milliseconds
      const cpuSystemMs = cpuUsageAfter.system / 1000;
      const cpuTotalMs = cpuUserMs + cpuSystemMs;
      const cpuPercentage =
        processingDurationMs > 0
          ? ((cpuTotalMs / processingDurationMs) * 100).toFixed(2)
          : "0.00";

      // Memory delta
      const memoryDeltaMB = {
        rss: (memoryUsageAfter.rss - memoryUsageBefore.rss) / 1024 / 1024,
        heapTotal:
          (memoryUsageAfter.heapTotal - memoryUsageBefore.heapTotal) /
          1024 /
          1024,
        heapUsed:
          (memoryUsageAfter.heapUsed - memoryUsageBefore.heapUsed) /
          1024 /
          1024,
        external:
          (memoryUsageAfter.external - memoryUsageBefore.external) /
          1024 /
          1024,
      };

      // Log worker metrics
      this.logger.log({
        action: "memory_compression.worker.metrics",
        planId,
        mode,
        queueTimeMs,
        processingDurationMs,
        totalLatencyMs: queueTimeMs + processingDurationMs,
        cpu: {
          userMs: cpuUserMs.toFixed(2),
          systemMs: cpuSystemMs.toFixed(2),
          totalMs: cpuTotalMs.toFixed(2),
          percentage: cpuPercentage,
        },
        memory: {
          rssMB: memoryUsageAfter.rss / 1024 / 1024,
          heapTotalMB: memoryUsageAfter.heapTotal / 1024 / 1024,
          heapUsedMB: memoryUsageAfter.heapUsed / 1024 / 1024,
          externalMB: memoryUsageAfter.external / 1024 / 1024,
          deltaMB: memoryDeltaMB,
        },
      });
    }

    if (!compressionResult) {
      throw new Error("Compression result is missing");
    }

    return {
      success: true,
      jobType: "memory_compression",
      data: compressionResult as unknown as Record<string, unknown>,
      summary: `Compressed ${compressionResult.beforeCount} embeddings to ${compressionResult.afterCount} (ratio: ${compressionResult.compressionRatio.toFixed(2)})`,
      meta: {
        createdAt: new Date().toISOString(),
        model: "memory-compression",
        tokensUsed: 0,
      },
    };
  }
}
