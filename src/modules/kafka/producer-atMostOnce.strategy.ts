import { ProducerRecord, RecordMetadata, Producer, Kafka } from 'kafkajs';
import { BaseProducerDeliveryStrategy } from './producer-base-delivery.strategy';

export class AtMostOnceProducerStrategy<T = any> extends BaseProducerDeliveryStrategy<T> {
    private producer?: Producer;
    private kafka?: Kafka;

    async configure(): Promise<void> {
        // Configure for at-most-once delivery:
        // - acks: 0 (fire and forget, no acknowledgment required)
        // - retries: 0 (no retries to avoid duplicates)
        // - idempotent: false (not needed since no retries)

        const kafkaConfig = this.settings.getKafkaConfig();
        this.kafka = new Kafka(kafkaConfig);

        const producerSettings = this.settings.getProducerSettings();

        // Override settings for at-most-once semantics
        const atMostOnceConfig = {
            ...producerSettings,
            // No acknowledgment required (fire and forget)
            acks: 0 as const,
            // No retries to prevent duplicates
            retry: {
                initialRetryTime: 0,
                retries: 0,
            },
            // Idempotence not needed
            idempotent: false,
            // Can have high in-flight requests for performance
            maxInFlightRequests: producerSettings.maxInFlightRequests || 10,
        };

        this.producer = this.kafka.producer(atMostOnceConfig);
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
            // Fire and forget - no acknowledgment required
            const result = await this.producer.send(record);
            return result;
        } catch (error) {
            // In at-most-once, we don't retry on failure
            console.warn('Message may have been lost in at-most-once strategy:', error);
            throw error;
        }
    }

    async sendBatch(records: ProducerRecord[]): Promise<RecordMetadata[]> {
        if (!this.producer) {
            throw new Error('Producer not configured. Call configure() first.');
        }

        try {
            // Fire and forget batch sending
            const result = await this.producer.sendBatch({
                topicMessages: records,
            });

            // Flatten results from all topics
            return result.reduce((acc, topicResult) => {
                return acc.concat(topicResult);
            }, [] as RecordMetadata[]);
        } catch (error) {
            console.warn('Batch messages may have been lost in at-most-once strategy:', error);
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
