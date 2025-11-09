import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "./users.service";
import { User } from "../entities/user.entity";
import { RefreshToken } from "../entities/refresh-token.entity";
import { RegisterDto } from "../dto/auth/register.dto";
import { LoginDto } from "../dto/auth/login.dto";
import { JwtPayload } from "../common/interfaces/jwt-payload.interface";
import { AuthException } from "../common/exceptions/auth.exception";
import { JWT_CONSTANTS } from "../shared/constants/jwt.constant";

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  /**
   * Register a new user
   */
  async register(
    registerDto: RegisterDto,
    deviceInfo?: { userAgent?: string; deviceId?: string },
  ): Promise<{
    user: Partial<User>;
    accessToken: string;
    refreshToken: string;
  }> {
    // Check if user already exists (case-insensitive)
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw AuthException.EmailAlreadyExists(registerDto.email);
    }

    // Hash password
    const passwordHash = await this.hashPassword(registerDto.password);

    // Create user
    const user = await this.usersService.create({
      ...registerDto,
      password: passwordHash,
    });

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokenPair(
      user,
      deviceInfo,
    );

    // Return sanitized user
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...sanitizedUser } = user;

    return {
      user: sanitizedUser,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login user
   */
  async login(
    loginDto: LoginDto,
    deviceInfo?: { userAgent?: string; deviceId?: string },
  ): Promise<{
    user: Partial<User>;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw AuthException.InvalidCredentials();
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokenPair(
      user,
      deviceInfo,
    );

    // Return sanitized user
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...sanitizedUser } = user;

    return {
      user: sanitizedUser,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshTokenValue: string,
    jti: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Find refresh token by jti
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { jti, isRevoked: false },
      relations: ["user"],
    });

    if (!tokenRecord) {
      throw AuthException.InvalidRefreshToken();
    }

    // Check if token is expired
    if (new Date() > tokenRecord.expiresAt) {
      throw AuthException.TokenExpired();
    }

    // Verify token hash
    const isValid = await bcrypt.compare(
      refreshTokenValue,
      tokenRecord.tokenHash,
    );

    if (!isValid) {
      throw AuthException.InvalidRefreshToken();
    }

    // Revoke old refresh token (token rotation)
    await this.revokeRefreshToken(jti);

    // Generate new token pair
    const { accessToken, refreshToken } = await this.generateTokenPair(
      tokenRecord.user,
      {
        userAgent: tokenRecord.userAgent || undefined,
        deviceId: tokenRecord.deviceId || undefined,
      },
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Logout user by revoking refresh token
   */
  async logout(jti: string): Promise<void> {
    await this.revokeRefreshToken(jti);
  }

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    const isPasswordValid = await this.comparePassword(
      password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate access token and refresh token pair
   */
  private async generateTokenPair(
    user: User,
    deviceInfo?: { userAgent?: string; deviceId?: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate access token
    const accessToken = this.jwtService.sign(payload as any, {
      secret: this.configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_SECRET),
      expiresIn: "1h",
      issuer:
        this.configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_ISSUER) ||
        JWT_CONSTANTS.DEFAULT_ISSUER,
      audience:
        this.configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_AUDIENCE) ||
        JWT_CONSTANTS.DEFAULT_AUDIENCE,
    });

    // Generate refresh token with jti
    const jti = this.generateJti();
    const refreshTokenPayload: JwtPayload = {
      ...payload,
      jti,
    };

    const refreshToken = this.jwtService.sign(refreshTokenPayload as any, {
      secret:
        this.configService.get<string>(
          JWT_CONSTANTS.ENV_KEYS.JWT_REFRESH_SECRET,
        ) || this.configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_SECRET),
      expiresIn: "7d",
      issuer:
        this.configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_ISSUER) ||
        JWT_CONSTANTS.DEFAULT_ISSUER,
      audience:
        this.configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_AUDIENCE) ||
        JWT_CONSTANTS.DEFAULT_AUDIENCE,
    });

    // Hash and store refresh token
    const tokenHash = await this.hashRefreshToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.refreshTokenRepository.save({
      userId: user.id,
      tokenHash,
      jti,
      expiresAt,
      isRevoked: false,
      userAgent: deviceInfo?.userAgent,
      deviceId: deviceInfo?.deviceId,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Hash refresh token
   */
  private async hashRefreshToken(token: string): Promise<string> {
    return await bcrypt.hash(token, this.saltRounds);
  }

  /**
   * Generate unique JWT ID
   */
  private generateJti(): string {
    return uuidv4();
  }

  /**
   * Revoke refresh token
   */
  private async revokeRefreshToken(jti: string): Promise<void> {
    await this.refreshTokenRepository.update({ jti }, { isRevoked: true });
  }

  /**
   * Clean up expired refresh tokens (can be called periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }
}
