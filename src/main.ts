import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 3000);

    logger.log(`RABBITMQ_URL: ${process.env.RABBITMQ_URL ? 'SET' : 'NOT SET'}`);
    logger.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);

    await app.listen(port, () => {
        Logger.log(`APPLICATION start on http://localhost:${port}`, 'MAIN');
    });
}
bootstrap();
