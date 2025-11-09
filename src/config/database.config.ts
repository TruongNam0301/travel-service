import { registerAs } from "@nestjs/config";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { join } from "path";

export default registerAs(
  "database",
  (): TypeOrmModuleOptions => ({
    type: "postgres",
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    username: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    database: process.env.POSTGRES_DB || "travel_db",
    entities: [join(__dirname, "..", "**", "*.entity.{ts,js}")],
    migrations: [join(__dirname, "..", "database", "migrations", "*.{ts,js}")],
    synchronize: process.env.NODE_ENV === "development",
    logging: process.env.NODE_ENV === "development",
    extra: {
      application_name: "travel-service",
    },
  }),
);

export const connectionSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  username: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "postgres",
  database: process.env.POSTGRES_DB || "travel_db",
  entities: [join(__dirname, "..", "**", "*.entity.{ts,js}")],
  migrations: [join(__dirname, "..", "database", "migrations", "*.{ts,js}")],
});
