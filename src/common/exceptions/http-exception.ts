import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AppException } from "./app.exception";
import { BaseErrorResponse, ErrorDetails } from "../dto/base-response.dto";

interface HttpExceptionResponse {
  statusCode: number;
  message: string | string[];
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Global HTTP exception filter
 * Catches all HTTP exceptions and formats them consistently
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpException.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    // Log the error
    this.logError(exception, errorResponse);

    // Send response
    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request,
  ): BaseErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const method = request.method;

    // Handle AppException (custom exceptions)
    if (exception instanceof AppException) {
      const response = exception.getResponse() as HttpExceptionResponse;
      const message = Array.isArray(response.message)
        ? response.message.join(", ")
        : response.message || exception.message;

      const errorDetails: ErrorDetails = {
        errorCode: response.errorCode,
        metadata: response.metadata,
      };

      if (process.env.NODE_ENV === "development") {
        errorDetails.stack = exception.stack;
      }

      return {
        success: false,
        statusCode: exception.getStatus(),
        message,
        error: errorDetails,
        timestamp,
        path,
        method,
      };
    }

    // Handle standard HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      let errorCode: string | undefined;
      let metadata: Record<string, unknown> | undefined;

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else {
        const responseObj = exceptionResponse as HttpExceptionResponse;
        const msgValue = responseObj.message || exception.message;
        message = Array.isArray(msgValue) ? msgValue.join(", ") : msgValue;
        errorCode = responseObj.errorCode;
        metadata = responseObj.metadata;
      }

      const errorDetails: ErrorDetails = {
        errorCode,
        metadata,
      };

      if (process.env.NODE_ENV === "development") {
        errorDetails.stack = exception.stack;
      }

      return {
        success: false,
        statusCode: status,
        message,
        error: errorDetails,
        timestamp,
        path,
        method,
      };
    }

    // Handle unknown errors
    const error = exception as Error;
    const errorDetails: ErrorDetails = {
      errorCode: "INTERNAL_SERVER_ERROR",
    };

    if (process.env.NODE_ENV === "development") {
      errorDetails.stack = error.stack;
    }

    return {
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: error.message || "Internal server error",
      error: errorDetails,
      timestamp,
      path,
      method,
    };
  }

  private logError(exception: unknown, errorResponse: BaseErrorResponse): void {
    const { statusCode, path, method, message, error } = errorResponse;
    const errorCode = error.errorCode;

    // Log with appropriate level based on status code
    if (statusCode >= 500) {
      this.logger.error(
        `${method} ${path} - ${statusCode} - ${errorCode || "ERROR"}: ${message}`,
        exception instanceof Error ? exception.stack : "",
      );
    } else if (statusCode >= 400) {
      this.logger.warn(
        `${method} ${path} - ${statusCode} - ${errorCode || "ERROR"}: ${message}`,
      );
    } else {
      this.logger.log(
        `${method} ${path} - ${statusCode} - ${errorCode || "INFO"}: ${message}`,
      );
    }
  }
}
