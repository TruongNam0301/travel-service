import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Conversation } from "./entities/conversation.entity";
import { Plan } from "../plans/entities/plan.entity";
import { ConversationsService } from "./conversations.service";
import { ConversationsController } from "./conversations.controller";
import { PlansModule } from "../plans/plans.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Plan]),
    forwardRef(() => PlansModule),
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
