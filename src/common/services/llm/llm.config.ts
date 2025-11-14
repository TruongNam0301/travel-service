import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EnvConfig } from "src/config/env.schema";

export type LlmConfigValues = {
  apiKey: string;
  chatModel: string;
  embedModel: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
};

@Injectable()
export class LlmConfig {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  get values(): LlmConfigValues {
    return {
      apiKey: this.configService.getOrThrow("LLM_API_KEY"),
      chatModel: this.configService.get("LLM_MODEL", { infer: true }),
      embedModel: this.configService.get("LLM_EMBED_MODEL", { infer: true }),
      baseUrl: this.configService.get("LLM_BASE_URL", { infer: true }),
      timeoutMs: this.configService.get("LLM_TIMEOUT_MS", { infer: true }),
      maxRetries: this.configService.get("LLM_MAX_RETRIES", { infer: true }),
    };
  }
}
