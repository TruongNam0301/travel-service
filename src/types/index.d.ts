import { User } from "../features/users/entities/user.entity";

/**
 * Extend Express Request to include user from JWT authentication
 */
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
