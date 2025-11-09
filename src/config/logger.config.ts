import { Params } from "nestjs-pino";
import { v4 as uuidv4 } from "uuid";
import { Request, Response } from "express";

interface RequestWithUser {
  user?: {
    id?: string;
  };
  id?: string;
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  query: any;
  params: any;
}

export const getLoggerConfig = (): Params => {
  const isDevelopment = process.env.NODE_ENV === "development";

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL || "info",
      transport: isDevelopment
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              singleLine: true,
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          }
        : undefined,
      autoLogging: true,
      // Generate unique request ID for tracing
      genReqId: (req: Request) => {
        return (req.headers["x-request-id"] as string) || uuidv4();
      },
      // Custom properties per request
      customProps: (req: Request) => {
        const reqWithUser = req as unknown as RequestWithUser;
        return {
          user: reqWithUser.user?.id,
          path: req.url,
          method: req.method,
        };
      },
      // Customize log serialization
      serializers: {
        req: (req: Request) => {
          const reqWithId = req;
          return {
            id: reqWithId.id,
            method: req.method,
            url: req.url,
            query: req.query,
            params: req.params,
          };
        },
        res: (res: Response) => ({
          statusCode: res.statusCode,
        }),
      },
      // Redact sensitive data
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body.password",
          "req.body.passwordConfirm",
        ],
        censor: "[REDACTED]",
      },
    },
  };
};
