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

// GraphQL-step 1 - Project Setup and Dependencies (imports show installed packages)
import { ApolloDriverConfig, ApolloDriver } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { UserModule } from './users/user.module';

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
        // GraphQL-step 4 - GraphQL Module Configuration
        // Set up GraphQLModule.forRoot() with ApolloDriver and autoSchemaFile option
        // This configures Apollo Server integration and enables automatic GraphQL schema generation
        GraphQLModule.forRoot<ApolloDriverConfig>({
            driver: ApolloDriver,
            autoSchemaFile: 'src/schema.gql',
        }),
        // GraphQL-step 12 - Register Module in AppModule
        // Import feature modules to make them available application-wide
        UserModule,
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
