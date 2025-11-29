import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import jwtConfig from "../../../config/jwt.config";
import { UsersService } from "../../users/users.service";
import { AuthException } from "../../../core/exceptions";
import { JwtPayload } from "../../../core/interfaces/jwt-payload.interface";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    @Inject(jwtConfig.KEY)
    jwtCfg: ConfigType<typeof jwtConfig>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtCfg.secret,
      issuer: jwtCfg.issuer,
      audience: jwtCfg.audience,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw AuthException.Unauthorized("User not found");
    }

    return user;
  }
}
