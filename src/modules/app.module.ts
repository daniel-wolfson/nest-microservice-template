import { BadRequestException, INestApplication, Module, ValidationPipe } from '@nestjs/common';
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
import { BillingModule } from './billing';
import { ValidationExceptionFilter } from '@/common/filters/validation-exception.filter';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RedisModule } from './cache/cache.redis.module';
import { HelperModule } from './helpers';

// Extract global middleware configuration
export function configureGlobalMiddleware(app: INestApplication, environmentConfig: any) {
    // Global Exception Filters (order matters - most specific first)
    app.useGlobalFilters(new ValidationExceptionFilter(), new GlobalExceptionFilter(app.get(ConfigService)));

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            disableErrorMessages: environmentConfig.isProduction,
            exceptionFactory: errors => {
                const formattedErrors = errors.reduce((acc, error) => {
                    acc[error.property] = Object.values(error.constraints || {});
                    return acc;
                }, {} as Record<string, string[]>);

                return new BadRequestException({
                    message: 'Validation failed',
                    errors: formattedErrors,
                });
            },
        }),
    );

    // CORS configuration
    const corsConfig = getCorsConfiguration(environmentConfig.isProduction);
    app.enableCors(corsConfig);
}

// Extract CORS configuration
export function getCorsConfiguration(isProduction: boolean) {
    const origin = isProduction ? ['https://yourdomain.com', 'https://api.yourdomain.com'] : true;

    return {
        origin,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    };
}

// Extract Swagger setup
export function setupSwagger(app: any, environmentConfig: any) {
    const config = new DocumentBuilder()
        .setTitle('Microservice API')
        .setDescription(`API Documentation - ${environmentConfig.environment}`)
        .setVersion('1.0')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                name: 'JWT',
                description: 'Enter JWT token',
                in: 'header',
            },
            'JWT-auth',
        )
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('/api', app, document);
}

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
        HelperModule,
        LoggerModule.forFeature('app.module'),

        // Feature modules (alphabetically)
        AuthenticationModule,
        DomainsModule,
        UserModule,
        RedisModule,
        BillingModule,

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
