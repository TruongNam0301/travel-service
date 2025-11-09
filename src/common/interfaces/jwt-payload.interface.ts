export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: 'user' | 'admin';
  jti?: string; // JWT ID for refresh tokens
}
