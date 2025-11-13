import { Controller, Post, Body, UseGuards, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { AuthService } from "../services/auth.service";
import { LoginDto } from "../dto/auth/login.dto";
import { RegisterDto } from "../dto/auth/register.dto";
import { JwtRefreshAuthGuard } from "../common/guards/jwt-refresh-auth.guard";

interface RefreshTokenPayload {
  userId: string;
  email: string;
  role: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(@Body() registerDto: RegisterDto) {
    return await this.authService.register(registerDto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post("refresh")
  async refresh(@Req() req: Request & { user: RefreshTokenPayload }) {
    const { userId } = req.user;
    return await this.authService.refreshAccessToken(userId);
  }
}
