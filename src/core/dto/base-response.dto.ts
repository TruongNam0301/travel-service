/**
 * Base Response DTOs
 * Standardized response structure for all API endpoints
 */

/**
 * Base success response structure
 * Used to wrap all successful API responses
 */
export interface BaseResponse<T = any> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
  method: string;
}

/**
 * Error details nested in error responses
 */
export interface ErrorDetails {
  errorCode?: string;
  metadata?: Record<string, unknown>;
  stack?: string;
}

/**
 * Base error response structure
 * Used to wrap all error/exception responses
 */
export interface BaseErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error: ErrorDetails;
  timestamp: string;
  path: string;
  method: string;
}

/**
 * Union type for all possible responses
 */
export type ApiResponse<T = any> = BaseResponse<T> | BaseErrorResponse;
