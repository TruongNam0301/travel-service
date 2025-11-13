import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { AuthException } from "../common/exceptions/auth.exception";
import { JwtPayload } from "../common/interfaces/jwt-payload.interface";
import { LoginDto } from "../dto/auth/login.dto";
import { RegisterDto } from "../dto/auth/register.dto";
import { User } from "../entities/user.entity";
import { JWT_CONSTANTS } from "../shared/constants/jwt.constant";
import { UsersService } from "./users.service";

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

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
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw AuthException.EmailAlreadyExists(registerDto.email);
    }

    const passwordHash = await this.hashPassword(registerDto.password);

    const user = await this.usersService.create({
      email: registerDto.email,
      name: registerDto.name,
      passwordHash: passwordHash,
    });

    const { accessToken, refreshToken } = this.generateTokenPair(user);

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
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw AuthException.InvalidRefreshToken();
    }

    const { accessToken, refreshToken } = this.generateTokenPair(user);

    return {
      accessToken,
      refreshToken,
    };
  }

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
      secret: this.configService.get<string>(
        JWT_CONSTANTS.ENV_KEYS.JWT_REFRESH_SECRET,
      ),
      expiresIn: "7d",
      issuer:
        this.configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_ISSUER) ||
        JWT_CONSTANTS.DEFAULT_ISSUER,
      audience:
        this.configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_AUDIENCE) ||
        JWT_CONSTANTS.DEFAULT_AUDIENCE,
    });
    console.log("refreshToken", refreshToken);
    console.log("accessToken", accessToken);
    console.log("payload", {
      jwt: this.configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_SECRET),
      resr: this.configService.get<string>(
        JWT_CONSTANTS.ENV_KEYS.JWT_REFRESH_SECRET,
      ),
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
