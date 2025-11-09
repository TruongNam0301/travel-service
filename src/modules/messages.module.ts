import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Message } from "../entities/message.entity";
import { Conversation } from "../entities/conversation.entity";
import { MessagesService } from "../services/messages.service";
import { MessagesController } from "../controllers/messages.controller";
import { ConversationsModule } from "./conversations.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Conversation]),
    ConversationsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
