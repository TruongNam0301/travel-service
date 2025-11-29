import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  /**
   * Override getTracker to use user ID for authenticated requests,
   * falling back to IP address for unauthenticated requests.
   * This ensures per-user rate limiting instead of per-IP.
   */
  protected getTracker(req: Record<string, any>): Promise<string> {
    // Use user ID if available (authenticated request)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const user = req.user;
    if (user && typeof user === "object" && "id" in user) {
      const userId = (user as { id: unknown }).id;
      if (typeof userId === "string") {
        return Promise.resolve(`user:${userId}`);
      }
    }
    // Fall back to IP address for unauthenticated requests
    let ip: string = "unknown";
    if (typeof req.ip === "string") {
      ip = req.ip;
    } else if (req.connection && typeof req.connection === "object") {
      const connection = req.connection as { remoteAddress?: unknown };
      if (
        "remoteAddress" in connection &&
        typeof connection.remoteAddress === "string"
      ) {
        ip = connection.remoteAddress;
      }
    }
    return Promise.resolve(ip);
  }
}
