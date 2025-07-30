import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);

    // Configure Swagger
    const config = new DocumentBuilder()
        .setTitle('Your API Title') // Set your API title
        .setDescription('The description of your API') // Set your API description
        .setVersion('1.0') // Set your API version
        .addTag('users') // Optional: Add tags to categorize your endpoints
        .addBearerAuth() // Optional: If you use JWT authentication
        .build();
    const document = SwaggerModule.createDocument(app, config);

    // Setup Swagger UI at a specific path (e.g., '/api')
    SwaggerModule.setup('api', app, document);

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 3000);

    logger.log(`RABBITMQ_URL: ${process.env.RABBITMQ_URL ? 'SET' : 'NOT SET'}`);
    logger.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);

    await app.listen(port, () => {
        Logger.log(`APPLICATION start on http://localhost:${port}`, 'MAIN');
    });
}
bootstrap();
