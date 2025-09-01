import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { Kafka, Consumer, ConsumerSubscribeTopic, EachMessagePayload } from 'kafkajs';
import { KafkaSettings } from './kafka-settings';
import { StructuredLogger } from 'src/common/winston.logger';

export interface MessageHandler {
    handle(payload: EachMessagePayload): Promise<void>;
}

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
    private kafka: Kafka;
    private consumer: Consumer;
    private messageHandlers: Map<string, MessageHandler> = new Map();

    constructor(private readonly kafkaSettings: KafkaSettings, private readonly logger: StructuredLogger) {
        const kafkaConfig = this.kafkaSettings.getKafkaConfig();
        this.kafka = new Kafka(kafkaConfig);

        const consumerSettings = this.kafkaSettings.getConsumerSettings();
        this.consumer = this.kafka.consumer(consumerSettings);
    }

    async onModuleInit() {
        try {
            await this.consumer.connect();
            this.logger.info('Kafka Consumer connected successfully', {
                context: 'KafkaConsumerService',
                method: 'onModuleInit',
            });
        } catch (error) {
            this.logger.error('Failed to connect Kafka Consumer', {
                context: 'KafkaConsumerService',
                method: 'onModuleInit',
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    async subscribe(topic: ConsumerSubscribeTopic, fromBeginning = false, handler?: MessageHandler) {
        try {
            await this.consumer.subscribe({ ...topic, fromBeginning });

            if (handler && typeof topic === 'string') {
                this.messageHandlers.set(topic, handler);
            }

            this.logger.info('Subscribed to topic', {
                context: 'KafkaConsumerService',
                method: 'subscribe',
                topic: typeof topic === 'string' ? topic : topic.topic,
                fromBeginning,
            });
        } catch (error) {
            this.logger.error('Failed to subscribe to topic', {
                context: 'KafkaConsumerService',
                method: 'subscribe',
                topic: typeof topic === 'string' ? topic : topic.topic,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async run(eachMessage?: (payload: EachMessagePayload) => Promise<void>) {
        try {
            await this.consumer.run({
                eachMessage: eachMessage || this.handleMessage.bind(this),
            });
        } catch (error) {
            this.logger.error('Failed to run consumer', {
                context: 'KafkaConsumerService',
                method: 'run',
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    private async handleMessage(payload: EachMessagePayload) {
        const { topic } = payload;
        const handler = this.messageHandlers.get(topic);

        if (handler) {
            try {
                await handler.handle(payload);
                this.logger.debug('Message processed successfully', {
                    context: 'KafkaConsumerService',
                    method: 'handleMessage',
                    topic,
                    partition: payload.partition,
                    offset: payload.message.offset,
                });
            } catch (error) {
                this.logger.error('Failed to process message', {
                    context: 'KafkaConsumerService',
                    method: 'handleMessage',
                    topic,
                    partition: payload.partition,
                    offset: payload.message.offset,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
                throw error;
            }
        } else {
            this.logger.warn('No handler found for topic', {
                context: 'KafkaConsumerService',
                method: 'handleMessage',
                topic,
            });
        }
    }

    async pause(topics: string[]) {
        try {
            this.consumer.pause(topics.map(topic => ({ topic })));
            this.logger.info('Consumer paused for topics', {
                context: 'KafkaConsumerService',
                method: 'pause',
                topics,
            });
        } catch (error) {
            this.logger.error('Failed to pause consumer', {
                context: 'KafkaConsumerService',
                method: 'pause',
                topics,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async resume(topics: string[]) {
        try {
            this.consumer.resume(topics.map(topic => ({ topic })));
            this.logger.info('Consumer resumed for topics', {
                context: 'KafkaConsumerService',
                method: 'resume',
                topics,
            });
        } catch (error) {
            this.logger.error('Failed to resume consumer', {
                context: 'KafkaConsumerService',
                method: 'resume',
                topics,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async onModuleDestroy() {
        try {
            await this.consumer.disconnect();
            this.logger.info('Kafka Consumer disconnected successfully', {
                context: 'KafkaConsumerService',
                method: 'onModuleDestroy',
            });
        } catch (error) {
            this.logger.error('Failed to disconnect Kafka Consumer', {
                context: 'KafkaConsumerService',
                method: 'onModuleDestroy',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
