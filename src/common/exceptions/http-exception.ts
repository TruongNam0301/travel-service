import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from './app.exception';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
  stack?: string;
}

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
  ): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const method = request.method;

    // Handle AppException (custom exceptions)
    if (exception instanceof AppException) {
      const response = exception.getResponse() as HttpExceptionResponse;
      const message = Array.isArray(response.message)
        ? response.message.join(', ')
        : response.message || exception.message;
      return {
        statusCode: exception.getStatus(),
        timestamp,
        path,
        method,
        message,
        errorCode: response.errorCode,
        metadata: response.metadata,
        ...(process.env.NODE_ENV === 'development' && {
          stack: exception.stack,
        }),
      };
    }

    // Handle standard HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const responseObj = exceptionResponse as HttpExceptionResponse;
        const msgValue = responseObj.message || exception.message;
        message = Array.isArray(msgValue) ? msgValue.join(', ') : msgValue;
      }

      return {
        statusCode: status,
        timestamp,
        path,
        method,
        message,
        ...(process.env.NODE_ENV === 'development' && {
          stack: exception.stack,
        }),
      };
    }

    // Handle unknown errors
    const error = exception as Error;
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp,
      path,
      method,
      message: error.message || 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
      }),
    };
  }

  private logError(exception: unknown, errorResponse: ErrorResponse): void {
    const { statusCode, path, method, message, errorCode } = errorResponse;

    // Log with appropriate level based on status code
    if (statusCode >= 500) {
      this.logger.error(
        `${method} ${path} - ${statusCode} - ${errorCode || 'ERROR'}: ${message}`,
        exception instanceof Error ? exception.stack : '',
      );
    } else if (statusCode >= 400) {
      this.logger.warn(
        `${method} ${path} - ${statusCode} - ${errorCode || 'ERROR'}: ${message}`,
      );
    } else {
      this.logger.log(
        `${method} ${path} - ${statusCode} - ${errorCode || 'INFO'}: ${message}`,
      );
    }
  }
}
