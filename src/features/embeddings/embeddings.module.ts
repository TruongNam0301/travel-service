import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Embedding } from "./entities/embedding.entity";
import { EmbeddingsService } from "./embeddings.service";
import { PlansModule } from "../plans/plans.module";
import { LlmModule } from "../../infrastructure/llm/llm.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Embedding]),
    forwardRef(() => PlansModule),
    LlmModule,
  ],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
