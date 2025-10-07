import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { KafkaSettings } from './kafka-settings';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaConsumerService } from './kafka-consumer.service';
import { KafkaController } from './kafka.controller';
import { ExampleMessageHandler } from './example-message.handler';
import { ProducerStrategyFactory } from './producer-strategy.factory';
import { StructuredLogger } from '../../../src/common/winston.logger';

@Module({
    imports: [ConfigModule, WinstonModule, KafkaModule],
    controllers: [KafkaController],
    providers: [
        KafkaSettings,
        KafkaProducerService,
        KafkaConsumerService,
        ProducerStrategyFactory,
        ExampleMessageHandler,
        StructuredLogger,
    ],
    exports: [KafkaSettings, KafkaProducerService, KafkaConsumerService, ExampleMessageHandler],
})
export class KafkaModule {}
