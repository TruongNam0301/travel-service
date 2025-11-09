import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { AuthService } from "../services/auth.service";
import { LoginDto } from "../dto/auth/login.dto";
import { RegisterDto } from "../dto/auth/register.dto";
import { JwtRefreshAuthGuard } from "../common/guards/jwt-refresh-auth.guard";

interface RefreshTokenPayload {
  userId: string;
  jti: string;
  refreshToken: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(
    @Body() registerDto: RegisterDto,
    @Headers("user-agent") userAgent?: string,
  ) {
    return await this.authService.register(registerDto, { userAgent });
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @Post("login")
  async login(
    @Body() loginDto: LoginDto,
    @Headers("user-agent") userAgent?: string,
  ) {
    return await this.authService.login(loginDto, { userAgent });
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post("refresh")
  async refresh(@Req() req: Request & { user: RefreshTokenPayload }) {
    const { jti, refreshToken } = req.user;

    return await this.authService.refreshAccessToken(refreshToken, jti);
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post("logout")
  async logout(@Req() req: Request & { user: RefreshTokenPayload }) {
    const { jti } = req.user;

    await this.authService.logout(jti);

    return { message: "Logged out successfully" };
  }
}
