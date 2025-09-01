import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import { KafkaSettings } from './kafka-settings';
import { ProducerStrategyFactory } from './producer-strategy.factory';
import { DeliverySemantics } from './delivery-semantics-strategy.enum';
import { IProducerDeliveryStrategy } from './producer-delivery-strategy.interface';
import { KafkaProducerSettings } from './kafka-producer-settings';
import { StructuredLogger } from 'src/common/winston.logger';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
    private producer: Producer;
    private producerStrategy: IProducerDeliveryStrategy;
    private isConnected = false;
    private connectionPromise: Promise<void> | null = null;
    producerSettings: KafkaProducerSettings;

    constructor(
        private readonly kafkaSettings: KafkaSettings,
        private readonly producerStrategyFactory: ProducerStrategyFactory,
        private readonly logger: StructuredLogger,
    ) {
        this.producerSettings = this.kafkaSettings.getProducerSettings();
    }

    async onModuleInit() {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = this.initConnection();
        return this.connectionPromise;
    }

    async onModuleDestroy() {
        try {
            await this.producer.disconnect();
            this.logger.info('Kafka Producer disconnected successfully', {
                context: 'KafkaProducerService',
                method: 'onModuleDestroy',
            });
        } catch (error) {
            this.logger.error('Failed to disconnect Kafka Producer', {
                context: 'KafkaProducerService',
                method: 'onModuleDestroy',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async send(record: ProducerRecord) {
        await this.ensureConnected();

        try {
            const result = this.producerStrategy.send(record);
            this.logger.debug('Message sent successfully', {
                context: 'KafkaProducerService',
                method: 'send',
                topic: record.topic,
                messageCount: record.messages.length,
            });
            return result;
        } catch (error) {
            this.logger.error('Failed to send message', {
                context: 'KafkaProducerService',
                method: 'send',
                topic: record.topic,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    async sendBatch(records: ProducerRecord[]) {
        try {
            const result = await this.producer.sendBatch({
                topicMessages: records,
            });
            this.logger.debug('Batch messages sent successfully', {
                context: 'KafkaProducerService',
                method: 'sendBatch',
                batchSize: records.length,
            });
            return result;
        } catch (error) {
            this.logger.error('Failed to send batch messages', {
                context: 'KafkaProducerService',
                method: 'sendBatch',
                batchSize: records.length,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    getHealthStatus(): { isConnected: boolean; hasDefaultStrategy: boolean } {
        return {
            isConnected: this.isConnected,
            hasDefaultStrategy: !!this.producerStrategy,
        };
    }

    private async ensureConnected(): Promise<void> {
        if (!this.isConnected) {
            await this.onModuleInit();
        }
    }

    private async initConnection(): Promise<void> {
        try {
            // Get default delivery semantics from settings
            const producerSettings = this.kafkaSettings.getProducerSettings();
            const defaultSemantics = producerSettings.deliveryStrategy || DeliverySemantics.AT_LEAST_ONCE;

            // Create and configure default strategy
            this.producerStrategy = await this.producerStrategyFactory.createStrategy(defaultSemantics);
            this.producer = this.producerStrategy.getProducer();

            // Connect the default producer
            await this.producer.connect();
            this.isConnected = true;

            this.logger.info('Kafka Producer initialized successfully', {
                context: 'KafkaProducerService',
                method: 'doInitialize',
                defaultSemantics,
                clientId: this.kafkaSettings.getKafkaConfig().clientId,
            });
        } catch (error) {
            this.isConnected = false;
            this.connectionPromise = null;

            this.logger.error('Failed to initialize Kafka Producer', {
                context: 'KafkaProducerService',
                method: 'doInitialize',
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
}
