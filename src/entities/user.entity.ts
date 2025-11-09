import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import { Plan } from "./plan.entity";
import { RefreshToken } from "./refresh-token.entity";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  BANNED = "banned",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  email: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ name: "avatar_url", type: "varchar", length: 500, nullable: true })
  avatarUrl?: string;

  @Column({ type: "jsonb", nullable: true })
  preferences?: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  settings?: Record<string, any>;

  @Column({
    type: "varchar",
    length: 20,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({
    type: "varchar",
    length: 20,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true })
  lastLoginAt?: Date;

  // Relations
  @OneToMany(() => Plan, (plan) => plan.user)
  plans: Plan[];

  @OneToMany(() => RefreshToken, (token) => token.user, {
    cascade: ["remove"],
  })
  refreshTokens: RefreshToken[];

  // Hooks
  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail() {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }
  }
}
