import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { LoggerConfigService } from './logger-config.service';

@Module({
    imports: [
        WinstonModule.forRootAsync({
            imports: [ConfigModule],
            useClass: LoggerConfigService,
        }),
    ],
    exports: [WinstonModule],
})
export class LoggerModule {}
