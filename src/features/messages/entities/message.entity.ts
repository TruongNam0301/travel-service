import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Conversation } from "../../conversations/entities/conversation.entity";

export enum MessageRole {
  USER = "user",
  ASSISTANT = "assistant",
}

@Entity("messages")
@Index(["conversationId", "isDeleted", "createdAt", "id"])
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "conversation_id", type: "uuid" })
  conversationId: string;

  @Column({ type: "varchar", length: 20 })
  role: MessageRole;

  @Column({ type: "text" })
  content: string;

  @Column({ name: "created_by", type: "uuid" })
  createdBy: string;

  // Soft delete fields
  @Column({ name: "is_deleted", type: "boolean", default: false })
  isDeleted: boolean;

  @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt?: Date;

  @Column({ name: "deleted_by", type: "uuid", nullable: true })
  deletedBy?: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Conversation, (conversation) => conversation)
  @JoinColumn({ name: "conversation_id" })
  conversation: Conversation;
}
