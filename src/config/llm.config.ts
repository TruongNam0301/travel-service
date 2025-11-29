import { registerAs } from "@nestjs/config";

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

export interface LlmConfig {
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

export default registerAs("llm", (): LlmConfig => {
  const baseChatModel = "gpt-4o-mini";
  const routing: LlmRoutingConfig = {
    chat: {
      default: baseChatModel,
      summarization: baseChatModel,
      planning: baseChatModel,
    },
    jobs: {
      research_hotel: "gpt-4o",
      find_food: "gpt-4o-mini",
      find_attraction: "gpt-4o-mini",
      memory_compression: "gpt-4o-mini",
    },
  };

  return {
    provider: (process.env.LLM_PROVIDER as LlmProviderName) || "openai",
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    chatModel: baseChatModel,
    embedModel: "text-embedding-3-small",
    timeoutMs: 60000,
    maxRetries: 2,
    projectId: process.env.OPENAI_PROJECT_ID,
    organizationId: process.env.OPENAI_ORGANIZATION_ID,
    routing,
  };
});

export const LLM_CONFIG_KEY = "llm";
