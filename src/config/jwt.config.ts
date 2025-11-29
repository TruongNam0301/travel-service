import { registerAs } from "@nestjs/config";

export interface JwtConfig {
  secret: string;
  refreshSecret: string;
  issuer: string;
  audience: string;
  accessExpiration: number; // seconds
  refreshExpiration: number; // seconds
}

export default registerAs(
  "jwt",
  (): JwtConfig => ({
    secret: process.env.JWT_SECRET || "",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "",
    issuer: process.env.JWT_ISSUER || "travel-service",
    audience: process.env.JWT_AUDIENCE || "travel-app",
    accessExpiration: parseInt(
      process.env.JWT_ACCESS_EXPIRATION || "86400",
      10,
    ),
    refreshExpiration: parseInt(
      process.env.JWT_REFRESH_EXPIRATION || "604800",
      10,
    ),
  }),
);

export const JWT_CONFIG_KEY = "jwt";
