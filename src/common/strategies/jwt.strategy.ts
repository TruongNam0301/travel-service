import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { UsersService } from "../../services/users.service";
import { AuthException } from "../exceptions";
import { JWT_CONSTANTS } from "../../shared/constants/jwt.constant";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        JWT_CONSTANTS.ENV_KEYS.JWT_SECRET,
      ) as string,
      issuer:
        configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_ISSUER) ||
        JWT_CONSTANTS.DEFAULT_ISSUER,
      audience:
        configService.get<string>(JWT_CONSTANTS.ENV_KEYS.JWT_AUDIENCE) ||
        JWT_CONSTANTS.DEFAULT_AUDIENCE,
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
