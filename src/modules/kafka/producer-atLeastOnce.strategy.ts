import { ProducerRecord, RecordMetadata, Producer, Kafka, Logger } from 'kafkajs';
import { BaseProducerDeliveryStrategy } from './producer-base-delivery.strategy';

export class AtLeastOnceProducerStrategy<T = any> extends BaseProducerDeliveryStrategy<T> {
    private producer?: Producer;
    private kafka?: Kafka;

    async configure(): Promise<void> {
        // Configure for at-least-once delivery:
        // - acks: 'all' or 1 (wait for leader acknowledgment)
        // - retries: > 0 (retry failed sends)
        // - idempotent: false (allows duplicates)
        // - maxInFlightRequests: can be > 1 since we allow duplicates

        const kafkaConfig = this.settings.getKafkaConfig();
        this.kafka = new Kafka(kafkaConfig);

        const producerSettings = this.settings.getProducerSettings();

        // Override settings for at-least-once semantics
        const atLeastOnceConfig = {
            ...producerSettings,
            // Wait for leader acknowledgment (at-least-once guarantee)
            acks: 1 as const, // or 'all' for stronger guarantee
            // Enable retries to ensure delivery
            retry: {
                initialRetryTime: producerSettings.retry?.initialRetryTime || 100,
                retries: Math.max(producerSettings.retry?.retries || 5, 3), // Ensure at least 3 retries
            },
            // Disable idempotence (allows duplicates for performance)
            idempotent: false,
            // Allow multiple in-flight requests for better throughput
            maxInFlightRequests: producerSettings.maxInFlightRequests || 5,
        };

        this.producer = this.kafka.producer(atLeastOnceConfig);
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
            // Send with retry logic built into kafkajs producer
            const result = await this.producer.send(record);
            return result;
        } catch (error) {
            // Log error but let kafkajs handle retries
            console.error('Failed to send message in at-least-once strategy:', error);
            throw error;
        }
    }

    async sendBatch(records: ProducerRecord[]): Promise<RecordMetadata[]> {
        if (!this.producer) {
            throw new Error('Producer not configured. Call configure() first.');
        }

        try {
            // Send batch with built-in retry mechanism
            const result = await this.producer.sendBatch({
                topicMessages: records,
            });

            // Flatten results from all topics
            return result.reduce((acc, topicResult) => {
                return acc.concat(topicResult);
            }, [] as RecordMetadata[]);
        } catch (error) {
            console.error('Failed to send batch in at-least-once strategy:', error);
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
