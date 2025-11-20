import { Module, forwardRef } from "@nestjs/common";
import { ConversationContextBuilder } from "../services/context-builders/conversation-context-builder.service";
import { PlanContextBuilder } from "../services/context-builders/plan-context-builder.service";
import { EmbeddingContextBuilder } from "../services/context-builders/embedding-context-builder.service";
import { FinalContextComposer } from "../services/context-builders/final-context-composer.service";
import { MessagesModule } from "./messages.module";
import { PlansModule } from "./plans.module";
import { JobsModule } from "./jobs.module";
import { EmbeddingsModule } from "./embeddings.module";
import { LlmModule } from "./llm.module";
import { MemoryCompressionModule } from "./memory-compression.module";

@Module({
  imports: [
    forwardRef(() => MessagesModule),
    forwardRef(() => PlansModule),
    forwardRef(() => JobsModule),
    forwardRef(() => EmbeddingsModule),
    LlmModule,
    forwardRef(() => MemoryCompressionModule),
  ],
  providers: [
    ConversationContextBuilder,
    PlanContextBuilder,
    EmbeddingContextBuilder,
    FinalContextComposer,
  ],
  exports: [
    ConversationContextBuilder,
    PlanContextBuilder,
    EmbeddingContextBuilder,
    FinalContextComposer,
  ],
})
export class ContextBuildersModule {}
