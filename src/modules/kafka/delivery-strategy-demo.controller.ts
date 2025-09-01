import { Controller, Post, Body, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AtLeastOnceProducerStrategy } from './producer-atLeastOnce.strategy';
import { KafkaSettings } from './kafka-settings';
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

@ApiTags('Kafka Delivery Strategies Demo')
@Controller('kafka/delivery-strategies')
export class DeliveryStrategyDemoController {
    private atLeastOnceStrategy?: AtLeastOnceProducerStrategy;

    constructor(
        private readonly kafkaSettings: KafkaSettings,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    @Post('at-least-once/send')
    @ApiOperation({
        summary: 'Send message using At-Least-Once delivery strategy',
        description:
            'Demonstrates sending a single message with at-least-once guarantees. May result in duplicates but ensures delivery.',
    })
    @ApiBody({
        type: Object,
        description: 'Message to send',
        examples: {
            userEvent: {
                summary: 'User Event Example',
                value: {
                    topic: 'user-events',
                    key: 'user-123',
                    value: {
                        userId: '123',
                        action: 'login',
                        timestamp: '2025-09-04T10:00:00Z',
                        ip: '192.168.1.100',
                    },
                    headers: {
                        source: 'user-service',
                        version: '1.0',
                    },
                },
            },
            orderEvent: {
                summary: 'Order Event Example',
                value: {
                    topic: 'order-events',
                    key: 'order-456',
                    value: {
                        orderId: '456',
                        customerId: '789',
                        amount: 99.99,
                        status: 'created',
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Message sent successfully with at-least-once guarantee',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                strategy: { type: 'string', example: 'at-least-once' },
                result: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            topicName: { type: 'string' },
                            partition: { type: 'number' },
                            errorCode: { type: 'number' },
                            offset: { type: 'string' },
                        },
                    },
                },
                guarantees: {
                    type: 'object',
                    properties: {
                        duplicates: { type: 'string', example: 'possible' },
                        messageLoss: { type: 'string', example: 'prevented' },
                        acknowledgment: { type: 'string', example: 'leader-ack' },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid message format' })
    @ApiResponse({ status: 500, description: 'Failed to send message' })
    async sendAtLeastOnce(@Body() dto: SendMessageDto) {
        try {
            const strategy = await this.getAtLeastOnceStrategy();

            const record = {
                topic: dto.topic,
                messages: [
                    {
                        key: dto.key,
                        value: JSON.stringify(dto.value),
                        headers: dto.headers,
                        timestamp: Date.now().toString(),
                    },
                ],
            };

            const result = await strategy.send(record);

            this.logger.info('Message sent using At-Least-Once strategy', {
                context: 'DeliveryStrategyDemoController',
                method: 'sendAtLeastOnce',
                topic: dto.topic,
                key: dto.key,
                resultCount: result.length,
            });

            return {
                success: true,
                strategy: 'at-least-once',
                result,
                guarantees: {
                    duplicates: 'possible',
                    messageLoss: 'prevented',
                    acknowledgment: 'leader-ack',
                    retries: 'enabled',
                },
                message: 'Message sent with at-least-once delivery guarantee',
            };
        } catch (error) {
            this.logger.error('Failed to send message using At-Least-Once strategy', {
                context: 'DeliveryStrategyDemoController',
                method: 'sendAtLeastOnce',
                topic: dto.topic,
                error: error instanceof Error ? error.message : String(error),
            });

            throw new HttpException(
                {
                    success: false,
                    strategy: 'at-least-once',
                    error: error instanceof Error ? error.message : String(error),
                    message: 'Failed to send message with at-least-once strategy',
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('at-least-once/send-batch')
    @ApiOperation({
        summary: 'Send batch of messages using At-Least-Once delivery strategy',
        description: 'Demonstrates sending multiple messages in a batch with at-least-once guarantees.',
    })
    @ApiBody({
        type: Object,
        description: 'Batch of messages to send',
        examples: {
            mixedEvents: {
                summary: 'Mixed Events Batch',
                value: {
                    messages: [
                        {
                            topic: 'user-events',
                            key: 'user-123',
                            value: { userId: '123', action: 'login' },
                        },
                        {
                            topic: 'user-events',
                            key: 'user-124',
                            value: { userId: '124', action: 'logout' },
                        },
                        {
                            topic: 'order-events',
                            key: 'order-456',
                            value: { orderId: '456', status: 'created' },
                        },
                    ],
                },
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Batch sent successfully with at-least-once guarantee',
    })
    async sendBatchAtLeastOnce(@Body() dto: SendBatchDto) {
        try {
            const strategy = await this.getAtLeastOnceStrategy();

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

            const result = await strategy.sendBatch(records);

            this.logger.info('Batch sent using At-Least-Once strategy', {
                context: 'DeliveryStrategyDemoController',
                method: 'sendBatchAtLeastOnce',
                batchSize: dto.messages.length,
                resultCount: result.length,
            });

            return {
                success: true,
                strategy: 'at-least-once',
                batchSize: dto.messages.length,
                result,
                guarantees: {
                    duplicates: 'possible',
                    messageLoss: 'prevented',
                    acknowledgment: 'leader-ack',
                    retries: 'enabled',
                },
                message: 'Batch sent with at-least-once delivery guarantee',
            };
        } catch (error) {
            this.logger.error('Failed to send batch using At-Least-Once strategy', {
                context: 'DeliveryStrategyDemoController',
                method: 'sendBatchAtLeastOnce',
                batchSize: dto.messages.length,
                error: error instanceof Error ? error.message : String(error),
            });

            throw new HttpException(
                {
                    success: false,
                    strategy: 'at-least-once',
                    error: error instanceof Error ? error.message : String(error),
                    message: 'Failed to send batch with at-least-once strategy',
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('at-least-once/stress-test')
    @ApiOperation({
        summary: 'Stress test At-Least-Once delivery strategy',
        description:
            'Sends multiple messages rapidly to test the reliability and performance of at-least-once delivery.',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                topic: { type: 'string', example: 'stress-test-topic' },
                messageCount: { type: 'number', example: 100, minimum: 1, maximum: 1000 },
                messageSize: { type: 'string', enum: ['small', 'medium', 'large'], example: 'medium' },
            },
            required: ['topic', 'messageCount'],
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Stress test completed successfully',
    })
    async stressTestAtLeastOnce(@Body() dto: { topic: string; messageCount: number; messageSize?: string }) {
        try {
            const strategy = await this.getAtLeastOnceStrategy();
            const messageCount = Math.min(dto.messageCount, 1000); // Limit for safety

            // Generate test payload based on size
            const getPayload = (size: string = 'medium') => {
                const basePayload = { id: Date.now(), timestamp: new Date().toISOString() };
                switch (size) {
                    case 'small':
                        return { ...basePayload, data: 'small' };
                    case 'large':
                        return { ...basePayload, data: 'x'.repeat(1000), metadata: { large: true } };
                    default:
                        return { ...basePayload, data: 'medium-sized-payload', details: { test: true } };
                }
            };

            const startTime = Date.now();
            const results = [];

            // Send messages in batches of 10 for better performance
            const batchSize = 10;
            for (let i = 0; i < messageCount; i += batchSize) {
                const batch = [];
                const currentBatchSize = Math.min(batchSize, messageCount - i);

                for (let j = 0; j < currentBatchSize; j++) {
                    batch.push({
                        topic: dto.topic,
                        messages: [
                            {
                                key: `stress-test-${i + j}`,
                                value: JSON.stringify({
                                    ...getPayload(dto.messageSize),
                                    messageIndex: i + j,
                                    batchIndex: Math.floor(i / batchSize),
                                }),
                                timestamp: Date.now().toString(),
                            },
                        ],
                    });
                }

                const batchResult = await strategy.sendBatch(batch);
                results.push(...batchResult);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            this.logger.info('At-Least-Once stress test completed', {
                context: 'DeliveryStrategyDemoController',
                method: 'stressTestAtLeastOnce',
                topic: dto.topic,
                messageCount,
                duration,
                throughput: Math.round((messageCount / duration) * 1000),
            });

            return {
                success: true,
                strategy: 'at-least-once',
                statistics: {
                    messageCount,
                    duration: `${duration}ms`,
                    throughput: `${Math.round((messageCount / duration) * 1000)} msg/sec`,
                    successfulSends: results.length,
                    averageLatency: `${Math.round(duration / messageCount)}ms per message`,
                },
                guarantees: {
                    duplicates: 'possible (due to retries)',
                    messageLoss: 'prevented',
                    acknowledgment: 'leader-ack',
                    reliability: 'high',
                },
                message: 'Stress test completed successfully',
            };
        } catch (error) {
            this.logger.error('At-Least-Once stress test failed', {
                context: 'DeliveryStrategyDemoController',
                method: 'stressTestAtLeastOnce',
                error: error instanceof Error ? error.message : String(error),
            });

            throw new HttpException(
                {
                    success: false,
                    strategy: 'at-least-once',
                    error: error instanceof Error ? error.message : String(error),
                    message: 'Stress test failed',
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async getAtLeastOnceStrategy(): Promise<AtLeastOnceProducerStrategy> {
        if (!this.atLeastOnceStrategy) {
            this.atLeastOnceStrategy = new AtLeastOnceProducerStrategy(this.kafkaSettings);
            await this.atLeastOnceStrategy.configure();

            this.logger.info('AtLeastOnceProducerStrategy initialized', {
                context: 'DeliveryStrategyDemoController',
                method: 'getAtLeastOnceStrategy',
            });
        }
        return this.atLeastOnceStrategy;
    }

    // Cleanup method (should be called on module destroy)
    async cleanup() {
        if (this.atLeastOnceStrategy) {
            await this.atLeastOnceStrategy.disconnect();
            this.atLeastOnceStrategy = undefined;

            this.logger.info('AtLeastOnceProducerStrategy cleanup completed', {
                context: 'DeliveryStrategyDemoController',
                method: 'cleanup',
            });
        }
    }
}
