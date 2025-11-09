import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy, StrategyOptions } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Request } from "express";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { RefreshToken } from "../../entities/refresh-token.entity";
import { AuthException } from "../exceptions";
import { JWT_CONSTANTS } from "../../shared/constants/jwt.constant";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {
    const secret =
      configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_REFRESH_SECRET) ||
      configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_SECRET);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret as string,
      issuer:
        configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_ISSUER) ||
        JWT_CONSTANTS.DEFAULT_ISSUER,
      audience:
        configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_AUDIENCE) ||
        JWT_CONSTANTS.DEFAULT_AUDIENCE,
      passReqToCallback: true,
    } satisfies Partial<StrategyOptions>);
  }

  async validate(req: Request, payload: JwtPayload) {
    const jti = payload.jti;

    if (!jti) {
      throw AuthException.InvalidRefreshToken();
    }

    // Check if token is revoked
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { jti },
    });

    if (!tokenRecord || tokenRecord.isRevoked) {
      throw AuthException.InvalidRefreshToken();
    }

    // Check if token is expired
    if (new Date() > tokenRecord.expiresAt) {
      throw AuthException.TokenExpired();
    }

    // Extract refresh token from header
    const refreshToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    return {
      userId: payload.sub,
      jti,
      refreshToken,
    };
  }
}
