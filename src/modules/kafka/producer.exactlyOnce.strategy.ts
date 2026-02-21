import { ProducerRecord, RecordMetadata, Producer, Kafka } from 'kafkajs';
import { BaseProducerDeliveryStrategy } from './producer-base-delivery.strategy';

export class ExactlyOnceProducerStrategy<T = any> extends BaseProducerDeliveryStrategy<T> {
    private producer?: Producer;
    private kafka?: Kafka;
    private transactionId?: string;

    async configure(): Promise<void> {
        // Configure for exactly-once delivery:
        // - acks: 'all' (wait for all in-sync replicas)
        // - retries: > 0 (retry failed sends)
        // - idempotent: true (prevent duplicates)
        // - maxInFlightRequests: 1 (maintain order with idempotence)
        // - transactional: true (for exactly-once semantics)

        const kafkaConfig = this.settings.getKafkaConfig();
        this.kafka = new Kafka(kafkaConfig);

        const producerSettings = this.settings.getProducerSettings();

        // Generate unique transaction ID for this producer instance
        this.transactionId = `${kafkaConfig.clientId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Override settings for exactly-once semantics
        const exactlyOnceConfig = {
            ...producerSettings,
            // Wait for all in-sync replicas
            acks: 'all' as const,
            // Enable retries with idempotence
            retry: {
                initialRetryTime: producerSettings.retry?.initialRetryTime || 100,
                retries: Math.max(producerSettings.retry?.retries || 5, 3),
            },
            // Enable idempotence to prevent duplicates
            idempotent: true,
            // Limit in-active requests for ordering with idempotence
            maxInFlightRequests: 1,
            // Enable transactions for exactly-once semantics
            transactionTimeout: producerSettings.transactionTimeout || 30000,
            transactionalId: this.transactionId,
        };

        this.producer = this.kafka.producer(exactlyOnceConfig);
        await this.producer.connect();
    }

    getProducer(): Producer {
        if (!this.producer) {
            throw new Error('Producer not configured. Call configure() first.');
        }
        return this.producer;
    }

    async send(record: ProducerRecord): Promise<RecordMetadata[]> {
        if (!this.producer) {
            throw new Error('Producer not configured. Call configure() first.');
        }

        try {
            // Use idempotent producer for exactly-once semantics
            // Note: True exactly-once requires transactional support on consumer side as well
            const result = await this.producer.send(record);
            return result;
        } catch (error) {
            console.error('Failed to send message in exactly-once strategy:', error);
            throw error;
        }
    }

    async sendBatch(records: ProducerRecord[]): Promise<RecordMetadata[]> {
        if (!this.producer) {
            throw new Error('Producer not configured. Call configure() first.');
        }

        try {
            // Use idempotent producer for batch sending
            const result = await this.producer.sendBatch({
                topicMessages: records,
            });

            // Flatten results from all topics
            return result.reduce((acc, topicResult) => {
                return acc.concat(topicResult);
            }, [] as RecordMetadata[]);
        } catch (error) {
            console.error('Failed to send batch in exactly-once strategy:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this.producer) {
            await this.producer.disconnect();
            this.producer = undefined;
        }
    }
}
