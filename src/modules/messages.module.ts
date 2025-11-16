import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Message } from "../entities/message.entity";
import { Conversation } from "../entities/conversation.entity";
import { MessagesService } from "../services/messages.service";
import { ChatService } from "../services/chat.service";
import { MessagesController } from "../controllers/messages.controller";
import { ConversationsModule } from "./conversations.module";
import { ContextBuildersModule } from "./context-builders.module";
import { LlmModule } from "./llm.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Conversation]),
    ConversationsModule,
    ContextBuildersModule,
    LlmModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService, ChatService],
  exports: [MessagesService, ChatService],
})
export class MessagesModule {}
