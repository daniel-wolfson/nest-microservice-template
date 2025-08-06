// src/config/environment.config.ts
import { ConfigService } from '@nestjs/config';

export interface EnvironmentConfig {
    isDevelopment: boolean;
    isStaging: boolean;
    isProduction: boolean;
    environment: string;
}

export class EnvironmentConfigFactory {
    static create(configService: ConfigService): EnvironmentConfig {
        const environment = configService.get<string>('NODE_ENV', 'development');

        return {
            isDevelopment: environment === 'development',
            isStaging: environment === 'staging',
            isProduction: environment === 'production',
            environment,
        };
    }

    static getLogLevel(configService: ConfigService): string[] {
        const environment = configService.get<string>('NODE_ENV', 'development');

        switch (environment) {
            case 'production':
                return ['error', 'warn'];
            case 'staging':
                return ['error', 'warn', 'log'];
            case 'development':
            default:
                return ['error', 'warn', 'log', 'debug', 'verbose'];
        }
    }

    static getDatabaseConfig(configService: ConfigService) {
        const environment = configService.get<string>('NODE_ENV', 'development');

        const baseConfig = {
            url: configService.get<string>('DATABASE_URL'),
            synchronize: environment === 'development', // Only sync in development
            logging: environment === 'development',
        };

        switch (environment) {
            case 'production':
                return {
                    ...baseConfig,
                    ssl: { rejectUnauthorized: false },
                    pool: { max: 20, min: 5 },
                };
            case 'staging':
                return {
                    ...baseConfig,
                    pool: { max: 10, min: 2 },
                };
            default:
                return baseConfig;
        }
    }
}
