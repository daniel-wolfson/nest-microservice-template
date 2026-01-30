import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

import { ProvidersModule } from '@lib/providers';
import { SharedModule } from '@lib/shared';

import configuration from 'src/config/configuration';
import { EnvironmentConfigFactory } from 'src/config/environment.config';
import appConfigurationFactory from './app-config/app-config.factory';
import { appConfigValidationSchema } from './app-config/app-config.validation';

import { DomainsModule } from '../domains/domains.module';
import { KafkaModule } from './kafka';
import { LoggerModule } from './logging';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { UserModule } from './users/user.module';
import { AuthenticationModule } from './authentication/authentication.module';
import { AppConfigModule } from './app-config/app-config.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration, ...appConfigurationFactory],
            validationSchema: appConfigValidationSchema,
            envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env.local', '.env'],
            expandVariables: true,
            cache: true, // Cache configuration for better performance
        }),

        // Core modules
        AppConfigModule,
        SharedModule,
        ProvidersModule,
        LoggerModule,

        // Feature modules (alphabetically)
        AuthenticationModule,
        DomainsModule,
        UserModule,

        // Integration modules
        GraphQLModule.forRoot<ApolloDriverConfig>({
            driver: ApolloDriver,
            autoSchemaFile: 'src/schema.gql',
        }),
        KafkaModule,
        RabbitMQModule,
    ],
    providers: [
        {
            provide: 'ENVIRONMENT_CONFIG',
            useFactory: EnvironmentConfigFactory.create,
            inject: [ConfigService],
        },
    ],
})
export class AppModule {}
