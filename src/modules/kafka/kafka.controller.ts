import { Controller, Post, Body, Inject } from '@nestjs/common';
import { KafkaProducerService } from './kafka-producer.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

interface SendMessageDto {
    topic: string;
    key?: string;
    value: any;
    headers?: Record<string, string>;
}

interface SendBatchDto {
    messages: SendMessageDto[];
}

@Controller('kafka')
export class KafkaController {
    constructor(
        private readonly kafkaProducerService: KafkaProducerService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    @Post('send')
    async sendMessage(@Body() dto: SendMessageDto) {
        try {
            const result = await this.kafkaProducerService.send({
                topic: dto.topic,
                messages: [
                    {
                        key: dto.key,
                        value: JSON.stringify(dto.value),
                        headers: dto.headers,
                        timestamp: Date.now().toString(),
                    },
                ],
            });

            this.logger.info('Message sent via HTTP API', {
                context: 'KafkaController',
                method: 'sendMessage',
                topic: dto.topic,
                key: dto.key,
            });

            return {
                success: true,
                result,
                message: 'Message sent successfully',
            };
        } catch (error) {
            this.logger.error('Failed to send message via HTTP API', {
                context: 'KafkaController',
                method: 'sendMessage',
                topic: dto.topic,
                error: error instanceof Error ? error.message : String(error),
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                message: 'Failed to send message',
            };
        }
    }

    @Post('send-batch')
    async sendBatch(@Body() dto: SendBatchDto) {
        try {
            const records = dto.messages.map(msg => ({
                topic: msg.topic,
                messages: [
                    {
                        key: msg.key,
                        value: JSON.stringify(msg.value),
                        headers: msg.headers,
                        timestamp: Date.now().toString(),
                    },
                ],
            }));

            const result = await this.kafkaProducerService.sendBatch(records);

            this.logger.info('Batch messages sent via HTTP API', {
                context: 'KafkaController',
                method: 'sendBatch',
                batchSize: dto.messages.length,
            });

            return {
                success: true,
                result,
                message: 'Batch messages sent successfully',
            };
        } catch (error) {
            this.logger.error('Failed to send batch messages via HTTP API', {
                context: 'KafkaController',
                method: 'sendBatch',
                batchSize: dto.messages.length,
                error: error instanceof Error ? error.message : String(error),
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                message: 'Failed to send batch messages',
            };
        }
    }
}
