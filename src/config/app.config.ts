import { registerAs } from "@nestjs/config";

export interface AppConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  isDevelopment: boolean;
  isProduction: boolean;
  corsOrigins: string[];
  rateLimit: {
    ttl: number;
    max: number;
  };
}

export default registerAs("app", (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV || "development";
  return {
    nodeEnv,
    port: parseInt(process.env.PORT || "3000", 10),
    logLevel: process.env.LOG_LEVEL || "info",
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",
    corsOrigins: (
      process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:5173"
    ).split(","),
    rateLimit: {
      ttl: parseInt(process.env.RATE_LIMIT_TTL || "60", 10),
      max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
    },
  };
});

export const APP_CONFIG_KEY = "app";
