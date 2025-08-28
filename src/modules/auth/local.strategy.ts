import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { AuthService } from './auth.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private authService: AuthService, @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {
        super({
            usernameField: 'email', // Configure to use 'email' field instead of 'username'
            passwordField: 'password',
        });
    }

    async validate(email: string, password: string): Promise<any> {
        this.logger.debug(`Validating user: ${email}`, {
            context: 'LocalStrategy',
            method: 'validate',
            email,
        });
        const user = await this.authService.validateUser(email, password);
        if (!user) {
            this.logger.warn(`Authentication failed for user: ${email}`, {
                context: 'LocalStrategy',
                method: 'validate',
                email,
            });
            throw new UnauthorizedException();
        }
        this.logger.info(`User authenticated successfully: ${email}`, {
            context: 'LocalStrategy',
            method: 'validate',
            email,
            userId: user.id,
        });
        return user;
    }
}
