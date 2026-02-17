import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// GraphQL-step 13 - Configure Application Bootstrap
// Set up main.ts with NestFactory.create() and configure the application to listen on port 3000
// This creates the HTTP server and initializes all modules, making your GraphQL API accessible at /graphql endpoint
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { EnvironmentConfigFactory } from './config/environment.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';
import { LoggerFactory } from './modules/logging';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

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

// Configure RabbitMQ microservice options (if needed, can be moved to a separate file)
function configureRabbitMessageQueues(app: any, configService: ConfigService) {
    const rabbitmq_url =
        configService.get<string>('RABBITMQ_URL') ||
        (() => {
            throw new Error('RABBITMQ_URL is not defined');
        })();

    const username = configService.get<string>('RABBITMQ_DEFAULT_USER', 'guest');
    const password = configService.get<string>('RABBITMQ_DEFAULT_PASS', 'guest');

    // Define message queues based on hospitality industry domains
    const hospitalityQueues = [
        {
            // For handling new bookings, cancellations, and modifications.
            // High durability is critical to prevent losing booking information.
            name: 'booking_queue',
            options: { durable: true },
        },
        {
            // For processing payments, refunds, and charges.
            // This requires high durability and reliability.
            name: 'payment_queue',
            options: { durable: true },
        },
        {
            // For sending notifications like booking confirmations, reminders, and marketing messages.
            name: 'notification_queue',
            options: { durable: true },
        },
        {
            // For managing housekeeping tasks, room status updates, and maintenance requests.
            name: 'housekeeping_queue',
            options: { durable: true },
        },
        {
            // For logging user activities and system events for analytics and business intelligence.
            // Durability can be slightly relaxed for higher throughput if some data loss is acceptable.
            name: 'analytics_queue',
            options: { durable: false },
        },
    ];

    hospitalityQueues.forEach(queueConfig => {
        app.connectMicroservice({
            transport: Transport.RMQ,
            options: {
                urls: [rabbitmq_url],
                username: username,
                password: password,
                queue: queueConfig.name,
                queueOptions: queueConfig.options,
                prefetchCount: 1, // Process one message at a time to ensure order and reliability
                noAck: false, // Manual acknowledgment is crucial for ensuring messages are processed
            },
        });
    });
}

function configureKafkaMessageQueues(app: INestApplication<any>, configService: ConfigService) {
    const kafka_brokers = (configService.get<string>('KAFKA_BROKERS') || 'localhost:9092').split(',');

    // Define Kafka topics based on hospitality industry domains
    // Hospitality-related topics would be consumed by controllers using @MessagePattern decorator.
    // e.g. @MessagePattern('booking_topic')
    const hospitalityTopics = [
        {
            // For handling new bookings, cancellations, and modifications.
            clientId: 'hotel-booking-consumer',
            groupId: 'hotel-booking-group',
            topics: ['booking_topic'],
        },
        {
            // For processing payments, refunds, and charges.
            clientId: 'hotel-payment-consumer',
            groupId: 'hotel-payment-group',
            topics: ['payment_topic'],
        },
        {
            // For sending notifications like booking confirmations, reminders, and marketing messages.
            clientId: 'hotel-notification-consumer',
            groupId: 'hotel-notification-group',
            topics: ['notification_topic'],
        },
        {
            // For managing housekeeping tasks, room status updates, and maintenance requests.
            clientId: 'hotel-housekeeping-consumer',
            groupId: 'hotel-housekeeping-group',
            topics: ['housekeeping_topic'],
        },
        {
            // For logging user activities and system events for analytics and business intelligence.
            clientId: 'hotel-analytics-consumer',
            groupId: 'hotel-analytics-group',
            topics: ['analytics_topic'],
        },
    ];

    hospitalityTopics.forEach(topicConfig => {
        app.connectMicroservice<MicroserviceOptions>({
            transport: Transport.KAFKA,
            options: {
                client: {
                    clientId: topicConfig.clientId,
                    brokers: kafka_brokers,
                },
                consumer: {
                    groupId: topicConfig.groupId,
                    allowAutoTopicCreation: true,
                },
                subscribe: {
                    fromBeginning: false,
                    topics: topicConfig.topics,
                },
            },
        });
    });
}

// Extract global middleware configuration
function configureGlobalMiddleware(app: INestApplication, environmentConfig: any) {
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
function getCorsConfiguration(isProduction: boolean) {
    const origin = isProduction ? ['https://yourdomain.com', 'https://api.yourdomain.com'] : true;

    return {
        origin,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    };
}

// Extract Swagger setup
function setupSwagger(app: any, environmentConfig: any) {
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
bootstrap();
