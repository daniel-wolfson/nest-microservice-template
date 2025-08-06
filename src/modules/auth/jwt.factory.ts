// src/config/jwt-config.provider.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtOptionsFactory } from '@nestjs/jwt';

@Injectable()
export class JwtConfigFactory implements JwtOptionsFactory {
    constructor(private configService: ConfigService) {}

    public createJwtOptions(): JwtModuleOptions {
        const secret = this.getJwtSecret();
        const expiresIn = this.configService.get<number>('JWT_EXPIRATION', 3600);

        if (!secret) {
            throw new Error('JWT_SECRET is required but not provided');
        }

        return {
            secret,
            signOptions: {
                expiresIn: `${expiresIn}s`,
                issuer: this.configService.get<string>('JWT_ISSUER', 'app'),
                audience: this.configService.get<string>('JWT_AUDIENCE', 'app-users'),
            },
            verifyOptions: {
                issuer: this.configService.get<string>('JWT_ISSUER', 'app'),
                audience: this.configService.get<string>('JWT_AUDIENCE', 'app-users'),
            },
        };
    }

    getJwtSecret(): string {
        const secret = this.configService.get<string>('JWT_SECRET') ?? this.getDefaultSecret();
        if (!secret) {
            throw new Error('JWT_SECRET is required but not provided');
        }
        return secret;
    }
    getJwtIssuer(): string {
        const issuer = this.configService.get<string>('JWT_ISSUER') ?? 'app';
        return issuer;
    }

    getJwtAudience(): string {
        const audience = this.configService.get<string>('JWT_AUDIENCE') ?? 'app-users';
        return audience;
    }

    getDefaultSecret(): string {
        return `default_secret_${Date.now()}`;
    }
}
