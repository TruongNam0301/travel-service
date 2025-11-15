import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Embedding } from "../entities/embedding.entity";
import { MemoryCompressionService } from "../services/memory-compression.service";
import { PlansModule } from "./plans.module";
import { EmbeddingsModule } from "./embeddings.module";
import { LlmModule } from "./llm.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Embedding]),
    PlansModule,
    EmbeddingsModule,
    LlmModule,
  ],
  providers: [MemoryCompressionService],
  exports: [MemoryCompressionService],
})
export class MemoryCompressionModule {}
