import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from "@nestjs/common";
import { Observable, throwError, TimeoutError } from "rxjs";
import { catchError, timeout } from "rxjs/operators";

/**
 * Timeout Interceptor
 * Throws an error if request takes longer than specified timeout
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeoutMs: number = 30000) {} // Default 30 seconds

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err: Error) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () => new RequestTimeoutException("Request timeout"),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
