import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';

export class AuthException extends AppException {
  static InvalidCredentials(): AuthException {
    return new AuthException(
      'Invalid email or password',
      HttpStatus.UNAUTHORIZED,
      'AUTH_INVALID_CREDENTIALS',
    );
  }

  static TokenExpired(): AuthException {
    return new AuthException(
      'Token has expired',
      HttpStatus.UNAUTHORIZED,
      'AUTH_TOKEN_EXPIRED',
    );
  }

  static Unauthorized(message = 'Unauthorized access'): AuthException {
    return new AuthException(
      message,
      HttpStatus.UNAUTHORIZED,
      'AUTH_UNAUTHORIZED',
    );
  }

  static EmailAlreadyExists(email: string): AuthException {
    return new AuthException(
      `Email ${email} is already registered`,
      HttpStatus.CONFLICT,
      'AUTH_EMAIL_EXISTS',
    );
  }

  static InvalidRefreshToken(): AuthException {
    return new AuthException(
      'Invalid or revoked refresh token',
      HttpStatus.UNAUTHORIZED,
      'AUTH_INVALID_REFRESH_TOKEN',
    );
  }
}
