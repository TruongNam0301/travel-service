import { Module, forwardRef } from "@nestjs/common";
import { ConversationContextBuilder } from "./conversation-context-builder.service";
import { PlanContextBuilder } from "./plan-context-builder.service";
import { EmbeddingContextBuilder } from "./embedding-context-builder.service";
import { FinalContextComposer } from "./final-context-composer.service";
import { MessagesModule } from "../../features/messages/messages.module";
import { PlansModule } from "../../features/plans/plans.module";
import { JobsModule } from "../../features/jobs/jobs.module";
import { EmbeddingsModule } from "../../features/embeddings/embeddings.module";
import { LlmModule } from "../../infrastructure/llm/llm.module";
import { MemoryCompressionModule } from "../memory-compression/memory-compression.module";

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
