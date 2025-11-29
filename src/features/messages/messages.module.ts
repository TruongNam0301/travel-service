import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Message } from "./entities/message.entity";
import { Conversation } from "../conversations/entities/conversation.entity";
import { MessagesService } from "./messages.service";
import { ChatService } from "./chat.service";
import { IntentDetectionService } from "../../domain/intent-detection/intent-detection.service";
import { MessagesController } from "./messages.controller";
import { ConversationsModule } from "../conversations/conversations.module";
import { ContextBuildersModule } from "../../domain/context-builders/context-builders.module";
import { LlmModule } from "../../infrastructure/llm/llm.module";
import { JobsModule } from "../jobs/jobs.module";

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
