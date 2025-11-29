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

export enum JobState {
  QUEUED = "queued",
  PENDING = "pending",
  PROCESSING = "processing",
  RETRYING = "retrying",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

@Entity("jobs")
@Index(["planId", "createdAt"])
@Index(["planId", "state"])
export class Job {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "plan_id", type: "uuid" })
  planId: string;

  @Column({ type: "varchar", length: 100 })
  type: string;

  @Column({ type: "jsonb", nullable: true })
  params?: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  result?: Record<string, any>;

  @Column({ type: "varchar", length: 20 })
  state: JobState;

  @Column({ type: "text", nullable: true })
  error?: string;

  @Column({ type: "int", default: 0 })
  retries: number;

  @Column({ type: "int", default: 0 })
  priority: number;

  @Column({ name: "started_at", type: "timestamptz", nullable: true })
  startedAt?: Date;

  @Column({ name: "finished_at", type: "timestamptz", nullable: true })
  finishedAt?: Date;

  @Column({ name: "duration_ms", type: "int", nullable: true })
  durationMs?: number;

  @Column({ name: "worker_id", type: "varchar", length: 100, nullable: true })
  workerId?: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Plan, (plan) => plan.jobs)
  @JoinColumn({ name: "plan_id" })
  plan: Plan;
}
