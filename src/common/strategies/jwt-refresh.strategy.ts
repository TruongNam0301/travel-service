import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy, StrategyOptions } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { JWT_CONSTANTS } from "../../shared/constants/jwt.constant";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  private readonly logger = new Logger(JwtRefreshStrategy.name);

  constructor(private readonly configService: ConfigService) {
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

    this.logger.log(
      `JWT Refresh Strategy initialized with issuer: ${issuer}, audience: ${audience}`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async validate(payload: JwtPayload) {
    // JWT is already validated by passport (signature, expiration, issuer, audience)
    this.logger.debug(
      `Validating refresh token payload: ${JSON.stringify(payload)}`,
    );

    if (!payload.sub) {
      this.logger.error("Refresh token missing user ID (sub)");
      throw new UnauthorizedException("Invalid refresh token payload");
    }

    // Just return the user info from the decoded token
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
