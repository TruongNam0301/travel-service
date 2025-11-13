import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy, StrategyOptions } from "passport-jwt";
import { UsersService } from "../../services/users.service";
import { JWT_CONSTANTS } from "../../shared/constants/jwt.constant";
import { AuthException } from "../exceptions/auth.exception";
import { JwtPayload } from "../interfaces/jwt-payload.interface";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const secret =
      configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_REFRESH_SECRET) ||
      configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_SECRET);

    if (!secret) {
      throw new Error("JWT_SECRET or JWT_REFRESH_SECRET must be configured");
    }

    const issuer =
      configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_ISSUER) ||
      JWT_CONSTANTS.DEFAULT_ISSUER;
    const audience =
      configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_AUDIENCE) ||
      JWT_CONSTANTS.DEFAULT_AUDIENCE;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      issuer,
      audience,
    } satisfies Partial<StrategyOptions>);
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw AuthException.InvalidRefreshToken();
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw AuthException.InvalidRefreshToken();
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
