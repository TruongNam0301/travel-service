import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { MessagesService } from "./messages.service";
import { ConversationsService } from "./conversations.service";
import { LLM_CLIENT } from "../common/services/llm/llm.client";
import type { LlmClient } from "../common/services/llm/llm.client";
import { LlmConfig, type ChatMode } from "../common/services/llm/llm.config";
import { FinalContextComposer } from "./context-builders/final-context-composer.service";
import { Message } from "../entities/message.entity";
import { Conversation } from "../entities/conversation.entity";
import { JobsService } from "./jobs.service";
import { Job, JobState } from "../entities/job.entity";
import { IntentDetectionService } from "./intent-detection.service";

export interface ChatResponse {
  message: Message;
  conversation: Conversation;
  usage?: {
    input: number;
    output: number;
    total: number;
  };
  job?: {
    triggered: boolean;
    jobId: string;
    jobType: string;
    state: JobState;
  };
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly finalContextComposer: FinalContextComposer,
    @Inject(LLM_CLIENT)
    private readonly llmClient: LlmClient,
    private readonly llmConfig: LlmConfig,
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
    private readonly intentDetection: IntentDetectionService,
  ) {}

  private resolveChatModel(mode: ChatMode = "default"): string {
    const configValues = this.llmConfig.values;
    const { routing, chatModel } = configValues;
    const modelForMode = routing.chat[mode];
    return modelForMode ?? chatModel;
  }

  /**
   * Send a chat message and get LLM response
   */
  async sendMessage(
    userId: string,
    conversationId: string,
    userMessage: string,
  ): Promise<ChatResponse> {
    const conversation = await this.conversationsService.findOne(
      conversationId,
      userId,
    );

    const userMsg = await this.messagesService.create(userId, conversationId, {
      content: userMessage,
    });

    // 1) Classify intent
    const { intent, jobType } =
      await this.intentDetection.classify(userMessage);

    this.logger.log({
      action: "chat.intent_detected",
      conversationId,
      intent,
      jobType,
    });

    // 2) If job requested → trigger job automatically
    if (intent === "job_request" && jobType) {
      try {
        const params = await this.buildJobParams(
          jobType,
          userMessage,
          conversation,
          userId,
          conversationId,
        );

        // Create job (validation happens inside JobsService.create)
        const job = await this.jobsService.create(conversation.planId, userId, {
          type: jobType,
          params,
        });

        const jobInfo: ChatResponse["job"] = {
          triggered: true,
          jobId: job.id,
          jobType: job.type,
          state: job.state,
        };

        // Create assistant message indicating job was triggered
        const assistantMsg = await this.messagesService.createAssistantMessage(
          userId,
          conversationId,
          `Okay! I'm starting to search for ${jobType.replace("research_", "").replace("find_", "")}...`,
        );

        const updatedConversation = await this.conversationsService.findOne(
          conversationId,
          userId,
        );

        this.logger.log({
          action: "chat.job_triggered",
          conversationId,
          jobId: job.id,
          jobType,
        });

        return {
          message: assistantMsg,
          conversation: updatedConversation,
          job: jobInfo,
        };
      } catch (error) {
        // Job creation failed → log error and continue with normal chat
        this.logger.error({
          action: "chat.job_creation_failed",
          conversationId,
          jobType,
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Continue with normal chat flow below
      }
    }

    // 3) Choose chat mode from routing
    const mode: ChatMode =
      intent === "planning"
        ? "planning"
        : intent === "summarization"
          ? "summarization"
          : "default";

    const model = this.resolveChatModel(mode);
    const temperature = mode === "planning" ? 0.7 : 0.3;

    // 4) Build context & prompt
    let contextPrefix = "";
    try {
      const finalContext = await this.finalContextComposer.composeContext({
        planId: conversation.planId,
        conversationId,
        query: userMessage,
      });

      if (finalContext.formatted) {
        contextPrefix = finalContext.formatted + "\n\n";
        this.logger.log({
          action: "chat.context_built",
          conversationId,
          contextTokens: finalContext.tokenCount,
        });
      }
    } catch (error) {
      this.logger.warn({
        action: "chat.context_build_failed",
        conversationId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Build prompt with context
    const systemPrompt = `You are a helpful travel assistant. You help users plan their trips, find hotels, restaurants, and attractions. 

Use the provided context (conversation history, plan information, and relevant memories) to give personalized and helpful responses.

IMPORTANT: Respond in natural, conversational language. Do NOT generate JSON responses or actions. Just have a friendly conversation with the user.`;

    const userPrompt = contextPrefix
      ? `${contextPrefix}User: ${userMessage}\n\nAssistant:`
      : `User: ${userMessage}\n\nAssistant:`;

    // 5) Call LLM with correct model
    let assistantResponse: string;
    let usage: { input: number; output: number; total: number } | undefined;

    try {
      const result = await this.llmClient.generate(userPrompt, {
        system: systemPrompt,
        temperature,
        maxTokens: 2048,
        model,
      });

      assistantResponse = result.text.trim();
      usage = result.usage;

      this.logger.log({
        action: "chat.llm_response_generated",
        conversationId,
        mode,
        model,
        responseLength: assistantResponse.length,
        tokensUsed: usage?.total ?? 0,
      });
    } catch (error) {
      this.logger.error({
        action: "chat.llm_generation_failed",
        conversationId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Fallback response
      assistantResponse =
        "I apologize, but I'm having trouble generating a response right now. Please try again.";
    }

    // 6) Check if response contains a job action
    let jobInfo: ChatResponse["job"] | undefined;
    const jobAction = this.parseJobAction(assistantResponse);

    if (jobAction) {
      this.logger.log({
        action: "chat.job_action_detected",
        conversationId,
        jobType: jobAction.jobType,
      });

      try {
        // Map common job type variations to supported types
        const normalizedJobType = this.normalizeJobType(jobAction.jobType);

        // Add conversation context to params for result delivery
        const enrichedParams = {
          ...jobAction.params,
          conversationId, // Add conversation ID for result delivery
          planId: conversation.planId,
          userId,
        };

        // Create and trigger the job
        const job = await this.jobsService.create(conversation.planId, userId, {
          type: normalizedJobType,
          params: enrichedParams,
        });

        jobInfo = {
          triggered: true,
          jobId: job.id,
          jobType: job.type,
          state: job.state,
        };

        // Update the assistant response to be user-friendly
        assistantResponse = `I'm searching for ${this.getJobTypeDescription(normalizedJobType)}. I'll update you once I have the results!`;

        this.logger.log({
          action: "chat.job_triggered_from_action",
          conversationId,
          jobId: job.id,
          originalJobType: jobAction.jobType,
          normalizedJobType,
        });
      } catch (error) {
        this.logger.error({
          action: "chat.job_action_execution_failed",
          conversationId,
          jobType: jobAction.jobType,
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Keep the original response if job creation fails
      }
    }

    // 7) Save assistant message
    const assistantMsg = await this.messagesService.createAssistantMessage(
      userId,
      conversationId,
      assistantResponse,
    );

    // Refresh conversation to get updated metadata (messageCount, lastMessageAt)
    const updatedConversation = await this.conversationsService.findOne(
      conversationId,
      userId,
    );

    this.logger.log({
      action: "chat.send_message.complete",
      userId,
      conversationId,
      userMessageId: userMsg.id,
      assistantMessageId: assistantMsg.id,
      intent,
      mode,
      jobTriggered: !!jobInfo,
    });

    return {
      message: assistantMsg,
      conversation: updatedConversation,
      usage,
      ...(jobInfo && { job: jobInfo }),
    };
  }

  /**
   * Parse LLM response to detect job actions
   */
  private parseJobAction(response: string): {
    jobType: string;
    params: Record<string, unknown>;
  } | null {
    try {
      // Try to parse as JSON
      const parsed: unknown = JSON.parse(response.trim());

      // Type guard to check if it's a valid job action
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "action" in parsed &&
        "jobType" in parsed &&
        parsed.action === "run_job" &&
        typeof parsed.jobType === "string"
      ) {
        const params =
          "params" in parsed &&
          typeof parsed.params === "object" &&
          parsed.params !== null
            ? (parsed.params as Record<string, unknown>)
            : {};

        return {
          jobType: parsed.jobType,
          params,
        };
      }
    } catch {
      // Not JSON, that's fine
    }

    return null;
  }

  /**
   * Normalize job type variations to supported types
   */
  private normalizeJobType(jobType: string): string {
    const normalized = jobType.toLowerCase().replace(/[_-]/g, "");

    // Map common variations
    const mappings: Record<string, string> = {
      findhotels: "research_hotel",
      searchhotels: "research_hotel",
      hotelresearch: "research_hotel",
      hotels: "research_hotel",
      accommodation: "research_hotel",
      accommodations: "research_hotel",

      findfood: "find_food",
      searchfood: "find_food",
      restaurants: "find_food",
      restaurant: "find_food",
      dining: "find_food",

      findattraction: "find_attraction",
      findattractions: "find_attraction",
      searchattraction: "find_attraction",
      attraction: "find_attraction",
      attractions: "find_attraction",
      thingstodo: "find_attraction",
      activities: "find_attraction",
    };

    return mappings[normalized] || jobType;
  }

  /**
   * Get user-friendly description for job type
   */
  private getJobTypeDescription(jobType: string): string {
    const descriptions: Record<string, string> = {
      research_hotel: "hotels and accommodations",
      find_food: "restaurants and dining options",
      find_attraction: "attractions and things to do",
    };

    return descriptions[jobType] || jobType.replace(/_/g, " ");
  }

  /**
   * Build job parameters using the current user message and prior context
   */
  private async buildJobParams(
    jobType: string,
    userMessage: string,
    conversation: Conversation,
    userId: string,
    conversationId: string,
  ): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {
      conversationId,
      planId: conversation.planId,
      userId,
      query: userMessage,
    };

    const locationFromMessage = this.extractLocationFromMessage(userMessage);

    if (locationFromMessage) {
      params.destination = locationFromMessage;
    } else {
      try {
        const previousJob = await this.findPreviousJob(
          conversation.planId,
          jobType,
        );

        if (previousJob) {
          const rawParams: unknown = previousJob.params;
          if (this.isRecord(rawParams)) {
            const previousLocation =
              (rawParams.destination as string | undefined) ||
              (rawParams.city as string | undefined) ||
              (rawParams.location as string | undefined);

            if (previousLocation) {
              params.destination = previousLocation;
              if (rawParams.city && typeof rawParams.city === "string") {
                params.city = rawParams.city;
              }
              if (
                rawParams.location &&
                typeof rawParams.location === "string"
              ) {
                params.location = rawParams.location;
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn({
          action: "chat.previous_job_lookup_failed",
          jobType,
          planId: conversation.planId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    if (!params.destination) {
      params.destination = userMessage.trim();
    }

    return params;
  }

  /**
   * Naive location extractor for quick follow-up queries
   */
  private extractLocationFromMessage(message: string): string | undefined {
    if (!message) {
      return undefined;
    }

    const normalized = message.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return undefined;
    }

    const locationMatch = normalized.match(
      /\b(?:in|at|around|near)\s+([^.,!?]+)/i,
    );

    if (!locationMatch) {
      return undefined;
    }

    let location = locationMatch[1]
      .replace(/\b(?:please|thanks|thank you)\b/gi, "")
      .trim();

    location = location.replace(/^(the|a|an)\s+/i, "").trim();
    location = location.replace(/\s{2,}/g, " ").trim();

    return location || undefined;
  }

  private async findPreviousJob(
    planId: string,
    jobType: string,
  ): Promise<Job | null> {
    const job = await this.jobsService.findMostRecentJobByPlanAndType(
      planId,
      jobType,
    );
    return job;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}
