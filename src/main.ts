import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// GraphQL-step 13 - Configure Application Bootstrap
// Set up main.ts with NestFactory.create() and configure the application to listen on port 3000
// This creates the HTTP server and initializes all modules, making your GraphQL API accessible at /graphql endpoint
import { NestFactory } from '@nestjs/core';
import { AppModule, configureGlobalMiddleware, setupSwagger } from './modules/app.module';
import { EnvironmentConfigFactory } from './config/environment.config';
import { LoggerFactory } from './modules/logging';
import {
    configureKafkaMessageQueues,
    configureRabbitMessageQueues,
} from './modules/billing/brokers/billing-broker-queue.configure';

async function bootstrap() {
    // Create initial logger for bootstrap process
    const bootstrapLogger = LoggerFactory.createFromEnvironment();

    try {
        // Create NestJS application with bootstrap logger
        const app = await NestFactory.create(AppModule, {
            logger: bootstrapLogger,
        });

        // Initialize application logger with full context
        const appLogger = LoggerFactory.createFromEnvironment(app);
        app.useLogger(appLogger);

        const configService = app.get(ConfigService);
        const environmentConfig = EnvironmentConfigFactory.create(configService);

        // Configure global middleware and filters
        configureGlobalMiddleware(app, environmentConfig);

        // Configure message broker based on environment variable
        const messageBroker = configService.get<string>('MESSAGE_BROKER', 'rabbitmq');
        if (messageBroker === 'rabbitmq') {
            configureRabbitMessageQueues(app, configService);
            appLogger.log('Using RabbitMQ as message broker');
        } else if (messageBroker === 'kafka') {
            configureKafkaMessageQueues(app, configService);
            appLogger.log('Using Kafka as message broker');
        }

        await app.startAllMicroservices();

        // Setup Swagger documentation (non-production only)
        if (!environmentConfig.isProduction) {
            setupSwagger(app, environmentConfig);
        }

        // Start the application
        const port = configService.get('PORT', 3000);
        await app.listen(port, () => {
            appLogger.log(`🚀 Application running on port ${port} in ${environmentConfig.environment} mode`);
            if (!environmentConfig.isProduction) {
                appLogger.log(`📚 Swagger available at: http://localhost:${port}/api`);
            }
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        bootstrapLogger.error(
            `Failed to start application: ${errorMessage}`,
            error instanceof Error ? error.stack : undefined,
        );
        process.exit(1);
    }
}
bootstrap();
