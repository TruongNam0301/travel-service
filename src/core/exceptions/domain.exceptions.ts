import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Base exception for domain-specific errors
 */
export class DomainException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(message, statusCode);
    this.name = "DomainException";
  }
}

/**
 * Exception thrown when a resource is not found
 */
export class ResourceNotFoundException extends DomainException {
  constructor(resource: string, id: string | number) {
    super(`${resource} with id ${id} not found`, HttpStatus.NOT_FOUND);
    this.name = "ResourceNotFoundException";
  }
}

/**
 * Exception thrown when a resource operation fails
 */
export class ResourceException extends DomainException {
  constructor(message: string, statusCode?: HttpStatus) {
    super(message, statusCode || HttpStatus.BAD_REQUEST);
    this.name = "ResourceException";
  }

  static validation(message: string): ResourceException {
    return new ResourceException(message);
  }

  static notFound(resource: string, id: string | number): ResourceException {
    return new ResourceException(
      `${resource} with id ${id} not found`,
      HttpStatus.NOT_FOUND,
    );
  }

  static conflict(message: string): ResourceException {
    return new ResourceException(message, HttpStatus.CONFLICT);
  }
}

/**
 * Exception thrown when a validation fails
 */
export class ValidationException extends DomainException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
    this.name = "ValidationException";
  }
}

/**
 * Exception thrown when a business rule is violated
 */
export class BusinessRuleException extends DomainException {
  constructor(message: string) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY);
    this.name = "BusinessRuleException";
  }
}

/**
 * Exception thrown for system/infrastructure errors
 */
export class SystemException extends DomainException {
  constructor(message: string, statusCode?: HttpStatus) {
    super(message, statusCode || HttpStatus.INTERNAL_SERVER_ERROR);
    this.name = "SystemException";
  }

  static queueEnqueue(message: string): SystemException {
    return new SystemException(message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
