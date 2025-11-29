import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy, StrategyOptions } from "passport-jwt";
import { UsersService } from "../../users/users.service";
import { AuthException } from "../../../core/exceptions";
import { JwtPayload } from "../../../core/interfaces/jwt-payload.interface";
import jwtConfig from "../../../config/jwt.config";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg: ConfigType<typeof jwtConfig>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtCfg.refreshSecret,
      issuer: jwtCfg.issuer,
      audience: jwtCfg.audience,
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
