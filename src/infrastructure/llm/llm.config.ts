import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import llmConfigFactory from "../../config/llm.config";

// Re-export types from the config file
export type {
  LlmProviderName,
  ChatMode,
  LlmRoutingConfig,
} from "../../config/llm.config";
export type { LlmConfig as LlmConfigValues } from "../../config/llm.config";

/**
 * LlmConfig service - wraps the configuration for easier injection
 * This is kept for backward compatibility with existing services
 */
@Injectable()
export class LlmConfig {
  constructor(
    @Inject(llmConfigFactory.KEY)
    private readonly config: ConfigType<typeof llmConfigFactory>,
  ) {}

  get values(): ConfigType<typeof llmConfigFactory> {
    return this.config;
  }
}
