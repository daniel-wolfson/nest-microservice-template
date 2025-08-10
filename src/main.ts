import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { EnvironmentConfigFactory } from './config/environment.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);
    const environmentConfig = EnvironmentConfigFactory.create(configService);

    //Set up logging based on environment
    const logLevels = EnvironmentConfigFactory.getLogLevel(configService).filter((level: string) =>
        ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'].includes(level),
    ) as ('log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal')[];
    app.useLogger(logLevels);

    // Global Exception Filters (order matters - most specific first)
    app.useGlobalFilters(
        new ValidationExceptionFilter(),
        //new HttpExceptionFilter(),
        new GlobalExceptionFilter(configService),
    );

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            disableErrorMessages: environmentConfig.isProduction, // Hide detailed errors in production
            exceptionFactory: errors => {
                // Custom error formatting for validation errors
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

    // Extract CORS configuration logic
    const getCorsConfiguration = (isProduction: boolean) => {
        const origin = isProduction ? ['https://yourdomain.com', 'https://api.yourdomain.com'] : true;

        return {
            origin,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
        };
    };

    // Apply CORS with extracted configuration
    app.enableCors(getCorsConfiguration(environmentConfig.isProduction));

    const port = configService.get<number>('PORT', 3000);

    // Swagger setup (only for non-production)
    if (!environmentConfig.isProduction) {
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
                'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller
            )
            .build();
        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('/api', app, document);
    }

    await app.listen(port, () => {
        logger.log(`🚀 Application running on port ${port} in ${environmentConfig.environment} mode`);
        if (!environmentConfig.isProduction) {
            logger.log(`Swagger available at: http://localhost:${port}/api`);
        }
    });
}
bootstrap();
