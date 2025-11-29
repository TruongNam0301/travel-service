import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Plan } from "./entities/plan.entity";
import { PlansService } from "./plans.service";
import { PlansController } from "./plans.controller";
import { ConversationsModule } from "../conversations/conversations.module";
import { MemoryCompressionModule } from "../../domain/memory-compression/memory-compression.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan]),
    forwardRef(() => ConversationsModule),
    forwardRef(() => MemoryCompressionModule),
  ],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
