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
import { User } from "../../users/entities/user.entity";
import { Job } from "../../jobs/entities/job.entity";
import { Conversation } from "../../conversations/entities/conversation.entity";
import { Embedding } from "../../embeddings/entities/embedding.entity";

@Entity("plans")
export class Plan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  @Index()
  userId: string;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>;

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
  @ManyToOne(() => User, (user) => user.plans)
  @JoinColumn({ name: "user_id" })
  user: User;

  @OneToMany(() => Job, (job) => job.plan)
  jobs: Job[];

  @OneToMany(() => Conversation, (conversation) => conversation.plan)
  conversations: Conversation[];

  @OneToMany(() => Embedding, (embedding) => embedding.plan)
  embeddings: Embedding[];
}
