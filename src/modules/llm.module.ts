import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LLM_CLIENT } from "src/common/services/llm/llm.client";
import { LlmConfig } from "src/common/services/llm/llm.config";
import { OpenAiClient } from "src/common/services/llm/provider/openai.client";

@Module({
  imports: [ConfigModule],
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
