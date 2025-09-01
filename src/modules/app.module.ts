import { ProvidersModule } from '@lib/providers';
import { SharedModule } from '@lib/shared';
import { Module } from '@nestjs/common';
import { DomainsModule } from '../domains/domains.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from 'src/config/configuration';
import { EnvironmentConfigFactory } from 'src/config/environment.config';
import { LoggerModule } from './logging';
import { KafkaModule } from './kafka';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
            envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env.local', '.env'],
            expandVariables: true,
        }),
        SharedModule,
        ProvidersModule,
        DomainsModule,
        AuthModule,
        RabbitMQModule,
        KafkaModule,
        LoggerModule,
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
