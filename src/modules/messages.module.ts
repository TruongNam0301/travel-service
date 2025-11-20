import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Message } from "../entities/message.entity";
import { Conversation } from "../entities/conversation.entity";
import { MessagesService } from "../services/messages.service";
import { ChatService } from "../services/chat.service";
import { IntentDetectionService } from "../services/intent-detection.service";
import { MessagesController } from "../controllers/messages.controller";
import { ConversationsModule } from "./conversations.module";
import { ContextBuildersModule } from "./context-builders.module";
import { LlmModule } from "./llm.module";
import { JobsModule } from "./jobs.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Conversation]),
    forwardRef(() => ConversationsModule),
    forwardRef(() => ContextBuildersModule),
    LlmModule,
    forwardRef(() => JobsModule),
  ],
  controllers: [MessagesController],
  providers: [MessagesService, ChatService, IntentDetectionService],
  exports: [MessagesService, ChatService],
})
export class MessagesModule {}
