import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '@src/modules/app-config/app-config.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(appConfigService: AppConfigService) {
        const config = {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: appConfigService.jwtAccessSecret,
            issuer: appConfigService.jwtIssuer,
            audience: appConfigService.jwtAudience,
        };

        super(config);
    }

    async validate(payload: any) {
        return { userId: payload.sub, username: payload.username };
    }
}
