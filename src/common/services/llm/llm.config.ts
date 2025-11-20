import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EnvConfig } from "src/config/env.schema";

export type LlmProviderName = "openai"; // extend later: "anthropic" | "deepseek" | ...

export type ChatMode = "default" | "summarization" | "planning";

export interface LlmRoutingConfig {
  chat: {
    default: string;
    summarization: string;
    planning: string;
  };
  jobs: Record<string, string>; // jobType -> model
}

export interface LlmConfigValues {
  provider: LlmProviderName;
  // OpenAI
  apiKey: string;
  baseUrl: string;
  chatModel: string; // global default
  embedModel: string;
  timeoutMs: number;
  maxRetries: number;
  projectId?: string;
  organizationId?: string;
  routing: LlmRoutingConfig;
}

@Injectable()
export class LlmConfig {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  get values(): LlmConfigValues {
    const provider = (this.config.get<LlmProviderName>("LLM_PROVIDER", {
      infer: true,
    }) ?? "openai") as LlmProviderName;

    // Get API key with fallback to legacy LLM_API_KEY
    const apiKey =
      this.config.get<string>("OPENAI_API_KEY", { infer: true }) ??
      this.config.getOrThrow<string>("LLM_API_KEY", { infer: true });

    // Get base URL with fallback
    const baseUrl =
      this.config.get<string>("OPENAI_BASE_URL", { infer: true }) ??
      this.config.get<string>("LLM_BASE_URL", { infer: true }) ??
      "https://api.openai.com/v1";

    // Shared defaults with fallback to legacy vars
    const baseChatModel =
      this.config.get<string>("OPENAI_CHAT_MODEL", { infer: true }) ??
      this.config.get<string>("LLM_MODEL", { infer: true }) ??
      "gpt-4o-mini";

    const routing: LlmRoutingConfig = {
      chat: {
        default:
          this.config.get<string>("OPENAI_CHAT_MODEL_DEFAULT", {
            infer: true,
          }) ?? baseChatModel,
        summarization:
          this.config.get<string>("OPENAI_CHAT_MODEL_SUMMARY", {
            infer: true,
          }) ?? "gpt-4o-mini",
        planning:
          this.config.get<string>("OPENAI_CHAT_MODEL_PLANNING", {
            infer: true,
          }) ?? "gpt-4o",
      },
      jobs: {
        // You can override these via env if you want:
        // e.g. JOB_MODEL_RESEARCH_HOTEL=gpt-4o
        research_hotel:
          this.config.get<string>("JOB_MODEL_RESEARCH_HOTEL", {
            infer: true,
          }) ?? "gpt-4o",
        find_food:
          this.config.get<string>("JOB_MODEL_RESEARCH_FOOD", {
            infer: true,
          }) ?? "gpt-4o-mini",
        find_attraction:
          this.config.get<string>("JOB_MODEL_RESEARCH_ATTRACTION", {
            infer: true,
          }) ?? "gpt-4o-mini",
        memory_compression:
          this.config.get<string>("JOB_MODEL_MEMORY_COMPRESSION", {
            infer: true,
          }) ?? "gpt-4o-mini",
      },
    };

    const values: LlmConfigValues = {
      provider,
      apiKey,
      baseUrl,
      chatModel: baseChatModel,
      embedModel:
        this.config.get<string>("OPENAI_EMBED_MODEL", { infer: true }) ??
        this.config.get<string>("LLM_EMBED_MODEL", { infer: true }) ??
        "text-embedding-3-small",
      timeoutMs: Number(
        this.config.get<string>("OPENAI_TIMEOUT_MS", { infer: true }) ??
          this.config.get<string>("LLM_TIMEOUT_MS", { infer: true }) ??
          "60000",
      ),
      maxRetries: Number(
        this.config.get<string>("OPENAI_MAX_RETRIES", { infer: true }) ??
          this.config.get<string>("LLM_MAX_RETRIES", { infer: true }) ??
          "2",
      ),
      projectId: this.config.get<string>("OPENAI_PROJECT_ID", {
        infer: true,
      }),
      organizationId: this.config.get<string>("OPENAI_ORG_ID", {
        infer: true,
      }),
      routing,
    };

    return values;
  }
}
