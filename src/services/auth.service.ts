import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "./users.service";
import { User } from "../entities/user.entity";
import { RegisterDto } from "../dto/auth/register.dto";
import { LoginDto } from "../dto/auth/login.dto";
import { JwtPayload } from "../common/interfaces/jwt-payload.interface";
import { AuthException } from "../common/exceptions/auth.exception";
import { JWT_CONSTANTS } from "../shared/constants/jwt.constant";

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;
  private readonly logger = new Logger("AuthService");

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<{
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
      email: registerDto.email,
      name: registerDto.name,
      passwordHash: passwordHash,
    });

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokenPair(user);

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
  async login(loginDto: LoginDto): Promise<{
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
    const { accessToken, refreshToken } = this.generateTokenPair(user);

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
   * Simply decodes and validates the JWT, no database check needed
   */
  async refreshAccessToken(
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Find user
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw AuthException.InvalidRefreshToken();
    }

    // Generate new token pair
    const { accessToken, refreshToken } = this.generateTokenPair(user);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Logout user (client-side only - just remove tokens)
   * No server-side action needed with stateless tokens
   */
  logout(): void {
    // With stateless JWT, logout is handled client-side
    // Client should remove the tokens from storage
    return;
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
   * No database storage - stateless JWT approach
   */
  private generateTokenPair(user: User): {
    accessToken: string;
    refreshToken: string;
  } {
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

    // Generate refresh token (no jti needed since not stored in DB)
    const refreshToken = this.jwtService.sign(payload as any, {
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

    return {
      accessToken,
      refreshToken,
    };
  }
}
