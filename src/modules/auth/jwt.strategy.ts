import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';
import { JwtConfigFactory } from './jwt.factory';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(JwtStrategy.name);

    constructor(jwtConfigFactory: JwtConfigFactory) {
        const config = {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtConfigFactory.getJwtSecret(),
            issuer: jwtConfigFactory.getJwtIssuer(),
            audience: jwtConfigFactory.getJwtAudience(),
        };

        super(config);

        // Debug logging
        this.logger.debug('JWT Strategy Configuration:');
        this.logger.debug(`Secret: ${config.secretOrKey ? 'Set' : 'Missing'}`);
        this.logger.debug(`Issuer: ${config.issuer}`);
        this.logger.debug(`Audience: ${config.audience}`);
    }

    async validate(payload: any) {
        return { userId: payload.sub, username: payload.username };
    }
}
