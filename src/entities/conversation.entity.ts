import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { Plan } from "./plan.entity";
import { Message } from "./message.entity";

@Entity("conversations")
@Index(["planId", "isDeleted", "lastMessageAt"])
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "plan_id", type: "uuid" })
  planId: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  title?: string;

  @Column({ name: "is_default", type: "boolean", default: false })
  isDefault: boolean;

  @Column({ name: "last_message_at", type: "timestamptz", nullable: true })
  @Index()
  lastMessageAt?: Date;

  @Column({ name: "message_count", type: "integer", default: 0 })
  messageCount: number;

  // Soft delete fields
  @Column({ name: "is_deleted", type: "boolean", default: false })
  isDeleted: boolean;

  @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt?: Date;

  @Column({ name: "deleted_by", type: "uuid", nullable: true })
  deletedBy?: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Plan, (plan) => plan.conversations)
  @JoinColumn({ name: "plan_id" })
  plan: Plan;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
