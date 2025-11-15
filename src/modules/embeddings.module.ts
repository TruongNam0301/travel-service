import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Embedding } from "../entities/embedding.entity";
import { EmbeddingsService } from "../services/embeddings.service";
import { EmbeddingsController } from "../controllers/embeddings.controller";
import { PlansModule } from "./plans.module";
import { LlmModule } from "./llm.module";

@Module({
  imports: [TypeOrmModule.forFeature([Embedding]), PlansModule, LlmModule],
  controllers: [EmbeddingsController],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
