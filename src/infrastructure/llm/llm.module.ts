import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import llmConfig from "../../config/llm.config";
import { LLM_CLIENT } from "./llm.client";
import { LlmConfig } from "./llm.config";
import { OpenAiClient } from "./providers/openai.client";

@Module({
  imports: [ConfigModule.forFeature(llmConfig)],
  providers: [
    LlmConfig,
    OpenAiClient,
    {
      provide: LLM_CLIENT,
      useExisting: OpenAiClient,
    },
  ],
  exports: [LLM_CLIENT, LlmConfig],
})
export class LlmModule {}
