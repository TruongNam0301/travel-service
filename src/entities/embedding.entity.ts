import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Plan } from './plan.entity';

@Entity('embeddings')
@Index(['planId', 'createdAt'])
@Index(['planId', 'refType'])
export class Embedding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  // pgvector column - will be created as vector(1536) in migration
  // TypeORM doesn't have native support for pgvector, so we use a custom type
  @Column({
    type: 'vector',
    nullable: false,
  })
  vector!: string; // Will be handled as vector type in PostgreSQL

  @Column({ name: 'ref_type', type: 'varchar', length: 50 })
  refType!: string;

  @Column({ name: 'ref_id', type: 'uuid' })
  refId!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => Plan, (plan) => plan.embeddings)
  @JoinColumn({ name: 'plan_id' })
  plan?: Plan;
}
