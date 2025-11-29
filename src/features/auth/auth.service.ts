import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { AuthException } from "../../core/exceptions";
import { JwtPayload } from "../../core/interfaces/jwt-payload.interface";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import jwtConfig from "../../config/jwt.config";

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg: ConfigType<typeof jwtConfig>,
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

    const password = await this.hashPassword(registerDto.password);

    const user = await this.usersService.create({
      email: registerDto.email,
      name: registerDto.name,
      passwordHash: password,
    });

    const { accessToken, refreshToken } = this.generateTokenPair(user);

    return {
      user: { id: user.id, email: user.email, name: user.name },
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

    await this.usersService.updateLastLogin(user.id);

    const { accessToken, refreshToken } = this.generateTokenPair(user);

    return {
      user: { id: user.id, email: user.email, name: user.name },
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

    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtCfg.secret,
      expiresIn: this.jwtCfg.accessExpiration,
      issuer: this.jwtCfg.issuer,
      audience: this.jwtCfg.audience,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.jwtCfg.refreshSecret,
      expiresIn: this.jwtCfg.refreshExpiration,
      issuer: this.jwtCfg.issuer,
      audience: this.jwtCfg.audience,
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
