import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Plan } from "../entities/plan.entity";
import { PlansService } from "../services/plans.service";
import { PlansController } from "../controllers/plans.controller";
import { ConversationsModule } from "./conversations.module";
import { MemoryCompressionModule } from "./memory-compression.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan]),
    forwardRef(() => ConversationsModule),
    MemoryCompressionModule,
  ],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
