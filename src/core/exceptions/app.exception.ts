import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Base application exception
 * Extend this for custom application-specific errors
 */
export class AppException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly errorCode?: string,
    public readonly metadata?: Record<string, any>,
  ) {
    super(
      {
        statusCode,
        message,
        errorCode,
        metadata,
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}

/**
 * Database-related exceptions
 */
export class DatabaseException extends AppException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: string = "DATABASE_ERROR",
    metadata?: Record<string, any>,
  ) {
    super(message, statusCode, errorCode, metadata);
  }
}

/**
 * Resource not found exceptions
 */
export class NotFoundException extends AppException {
  constructor(
    resource: string,
    identifier?: string | number,
    errorCode: string = "RESOURCE_NOT_FOUND",
  ) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, HttpStatus.NOT_FOUND, errorCode, { resource, identifier });
  }
}

/**
 * Authorization exceptions
 */
export class AuthorizationException extends AppException {
  constructor(
    message: string = "Insufficient permissions",
    errorCode: string = "UNAUTHORIZED",
  ) {
    super(message, HttpStatus.FORBIDDEN, errorCode);
  }
}

/**
 * Authentication exceptions
 */
export class AuthenticationException extends AppException {
  constructor(
    message: string = "Authentication required",
    errorCode: string = "UNAUTHENTICATED",
  ) {
    super(message, HttpStatus.UNAUTHORIZED, errorCode);
  }
}

/**
 * Business logic exceptions
 */
export class BusinessLogicException extends AppException {
  constructor(
    message: string,
    metadata?: Record<string, any>,
    errorCode: string = "BUSINESS_LOGIC_ERROR",
  ) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, errorCode, metadata);
  }
}

/**
 * Queue/Job exceptions
 */
export class QueueException extends AppException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: string = "QUEUE_ERROR",
    metadata?: Record<string, any>,
  ) {
    super(message, statusCode, errorCode, metadata);
  }
}

/**
 * External service exceptions
 */
export class ExternalServiceException extends AppException {
  constructor(
    service: string,
    message: string,
    errorCode: string = "EXTERNAL_SERVICE_ERROR",
    metadata?: Record<string, any>,
  ) {
    super(
      `External service error (${service}): ${message}`,
      HttpStatus.BAD_GATEWAY,
      errorCode,
      { service, ...metadata },
    );
  }
}
