import { registerAs } from "@nestjs/config";
import { DataSource } from "typeorm";
import { join } from "path";

export interface DatabaseConfig {
  type: "postgres";
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  entities?: string[];
  migrations?: string[];
  synchronize?: boolean;
  logging?: boolean;
  extra?: Record<string, any>;
}

const getDbConfig = () => {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isDevelopment = nodeEnv === "development";

  return {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    username: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    database: process.env.POSTGRES_DB || "travel_db",
    synchronize:
      process.env.DATABASE_SYNCHRONIZE === "true" ||
      (process.env.DATABASE_SYNCHRONIZE === undefined && isDevelopment),
    logging:
      process.env.DATABASE_LOGGING === "true" ||
      (process.env.DATABASE_LOGGING === undefined && isDevelopment),
  };
};

export default registerAs("database", (): DatabaseConfig => {
  const config = getDbConfig();
  return {
    type: "postgres",
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    entities: [join(__dirname, "..", "**", "*.entity.{ts,js}")],
    migrations: [join(__dirname, "..", "database", "migrations", "*.{ts,js}")],
    synchronize: config.synchronize,
    logging: config.logging,
    extra: {
      application_name: "travel-service",
    },
  };
});

export const connectionSource = new DataSource({
  type: "postgres",
  ...getDbConfig(),
  entities: [join(__dirname, "..", "**", "*.entity.{ts,js}")],
  migrations: [join(__dirname, "..", "database", "migrations", "*.{ts,js}")],
});

export const DATABASE_CONFIG_KEY = "database";
