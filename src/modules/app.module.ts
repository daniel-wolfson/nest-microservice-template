import { ProvidersModule } from '@lib/providers';
import { SharedModule } from '@lib/shared';
import { Module } from '@nestjs/common';
import { DomainsModule } from '../domains/domains.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from 'src/config/configuration';
import { EnvironmentConfigFactory } from 'src/config/environment.config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
            envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env.local', '.env'],
            expandVariables: true, // Allow variable substitution
        }),
        SharedModule,
        ProvidersModule,
        DomainsModule,
        AuthModule,
        RabbitMQModule,
        WinstonModule.forRoot({
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
                }),
                new winston.transports.File({ filename: 'logs/app.log' }),
            ],
        }),
    ],
    providers: [
        {
            provide: 'ENVIRONMENT_CONFIG',
            useFactory: (configService: ConfigService) => EnvironmentConfigFactory.create(configService),
            inject: [ConfigService],
        },
    ],
})
export class AppModule {}
