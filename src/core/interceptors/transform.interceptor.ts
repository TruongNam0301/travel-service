import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { Request, Response } from "express";
import { BaseResponse } from "../dto/base-response.dto";

/**
 * Interface for controller responses that include a message
 */
interface ResponseWithMessage {
  message: string;
  data?: unknown;
}

/**
 * Transform Interceptor
 * Wraps all responses in a consistent structure with full metadata
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, BaseResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<BaseResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((data: T) => {
        // Extract status code from response or default to 200
        const statusCode = response.statusCode || 200;

        // Extract message if controller returned an object with a message property
        let message = "Success";
        let responseData: T = data;

        // Check if the response is an object with a message field
        if (
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof (data as ResponseWithMessage).message === "string"
        ) {
          const responseWithMessage = data as ResponseWithMessage;
          message = responseWithMessage.message;
          // If there's also a data field, use that as the actual data
          if (
            "data" in responseWithMessage &&
            responseWithMessage.data !== undefined
          ) {
            responseData = responseWithMessage.data as T;
          }
        }

        return {
          success: true,
          statusCode,
          message,
          data: responseData,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
        };
      }),
    );
  }
}
