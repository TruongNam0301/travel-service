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
import { JobType } from "../../../features/jobs/entities/job-type.entity";

@Entity("prompt_templates")
@Index(["jobTypeId", "version"])
export class PromptTemplate {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "job_type_id", type: "uuid" })
  jobTypeId: string;

  @Column({ type: "text" })
  template: string;

  @Column({ type: "int" })
  version: number;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => JobType, (jobType) => jobType.promptTemplates)
  @JoinColumn({ name: "job_type_id" })
  jobType: JobType;
}
