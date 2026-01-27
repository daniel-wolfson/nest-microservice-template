import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

import { ProvidersModule } from '@lib/providers';
import { SharedModule } from '@lib/shared';

import configuration from 'src/config/configuration';
import { EnvironmentConfigFactory } from 'src/config/environment.config';

import { DomainsModule } from '../domains/domains.module';
import { AuthModule } from './auth/auth.module';
import { KafkaModule } from './kafka';
import { LoggerModule } from './logging';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { UserModule } from './users/user.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
            envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env.local', '.env'],
            expandVariables: true,
            cache: true, // Cache configuration for better performance
        }),

        // Core modules
        SharedModule,
        ProvidersModule,
        LoggerModule,

        // Feature modules (alphabetically)
        AuthModule,
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
