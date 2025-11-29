import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Plan } from "../../plans/entities/plan.entity";

@Entity("embeddings")
@Index(["planId", "createdAt"])
@Index(["planId", "refType"])
@Index(["planId", "refType", "refId"])
export class Embedding {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "plan_id", type: "uuid" })
  planId!: string;

  // pgvector column - will be created as vector(1536) in migration
  // TypeORM accepts number[] and pgvector handles the conversion
  @Column({
    type: "vector",
    nullable: false,
  })
  vector!: number[]; // pgvector accepts number[] directly

  @Column({ name: "ref_type", type: "varchar", length: 50 })
  refType!: string;

  @Column({ name: "ref_id", type: "uuid", nullable: true })
  refId!: string | null;

  @Column({ type: "text" })
  content!: string;

  // Soft delete fields
  @Column({ name: "is_deleted", type: "boolean", default: false })
  isDeleted!: boolean;

  @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt?: Date;

  @Column({ name: "deleted_by", type: "uuid", nullable: true })
  deletedBy?: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Plan, (plan) => plan.embeddings)
  @JoinColumn({ name: "plan_id" })
  plan?: Plan;
}
