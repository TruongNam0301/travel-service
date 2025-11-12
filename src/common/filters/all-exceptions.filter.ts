import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { BaseErrorResponse, ErrorDetails } from "../dto/base-response.dto";

/**
 * Global Exception Filter
 * Catches all exceptions and formats them consistently
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : "Internal server error";

    const errorDetails: ErrorDetails = {};

    if (process.env.NODE_ENV === "development" && exception instanceof Error) {
      errorDetails.stack = exception.stack;
    }

    const errorResponse: BaseErrorResponse = {
      success: false,
      statusCode: status,
      message,
      error: errorDetails,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Log error details
    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : exception,
    );

    response.status(status).json(errorResponse);
  }
}
