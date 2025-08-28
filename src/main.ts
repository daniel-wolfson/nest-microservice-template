import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { EnvironmentConfigFactory } from './config/environment.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';
import { LoggerFactory } from './modules/logging';

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
        await configureGlobalMiddleware(app, environmentConfig);

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

// Extract global middleware configuration
async function configureGlobalMiddleware(app: any, environmentConfig: any) {
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
