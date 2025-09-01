import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaConfig } from 'kafkajs';
import { KafkaConsumerSettings } from './kafka-consumer-settings';
import { KafkaProducerSettings } from './kafka-producer-settings';
import { KafkaConnectionSettings } from './kafka-connection-settings';

/**
 * Injectable service that provides Kafka configuration settings and factory methods.
 */

@Injectable()
export class KafkaSettings {
    constructor(private readonly configService: ConfigService) {}

    getKafkaConfig(): KafkaConfig {
        const brokers = this.configService
            .get<string>('KAFKA_BROKERS', 'localhost:9092')
            .split(',')
            .map(broker => broker.trim());

        const settings: KafkaConnectionSettings = {
            brokers,
            clientId: this.configService.get<string>('KAFKA_CLIENT_ID', 'custom-client-id'),
            connectionTimeout: this.configService.get<number>('KAFKA_CONNECTION_TIMEOUT', 3000),
            requestTimeout: this.configService.get<number>('KAFKA_REQUEST_TIMEOUT', 30000),
            retry: {
                initialRetryTime: this.configService.get<number>('KAFKA_INITIAL_RETRY_TIME', 100),
                retries: this.configService.get<number>('KAFKA_RETRIES', 8),
            },
        };

        // SSL Configuration
        const sslEnabled = this.configService.get<boolean>('KAFKA_SSL_ENABLED', false);
        if (sslEnabled) {
            settings.ssl = true;
        }

        // SASL Configuration
        const saslMechanism = this.configService.get<string>('KAFKA_SASL_MECHANISM');
        const saslUsername = this.configService.get<string>('KAFKA_SASL_USERNAME');
        const saslPassword = this.configService.get<string>('KAFKA_SASL_PASSWORD');

        if (saslMechanism && saslUsername && saslPassword) {
            settings.sasl = {
                mechanism: saslMechanism as 'plain' | 'scram-sha-256' | 'scram-sha-512',
                username: saslUsername,
                password: saslPassword,
            };
        }

        return {
            clientId: settings.clientId,
            brokers: settings.brokers,
            ssl: settings.ssl,
            sasl: settings.sasl as any,
            connectionTimeout: settings.connectionTimeout,
            requestTimeout: settings.requestTimeout,
            retry: settings.retry,
        };
    }

    getProducerSettings(): KafkaProducerSettings {
        return {
            maxInFlightRequests: this.configService.get<number>('KAFKA_PRODUCER_MAX_IN_FLIGHT_REQUESTS', 5),
            idempotent: this.configService.get<boolean>('KAFKA_PRODUCER_IDEMPOTENT', false),
            transactionTimeout: this.configService.get<number>('KAFKA_PRODUCER_TRANSACTION_TIMEOUT', 30000),
            retry: {
                initialRetryTime: this.configService.get<number>('KAFKA_PRODUCER_INITIAL_RETRY_TIME', 100),
                retries: this.configService.get<number>('KAFKA_PRODUCER_RETRIES', 5),
            },
        };
    }

    getConsumerSettings(): KafkaConsumerSettings {
        return {
            groupId: this.configService.get<string>('KAFKA_CONSUMER_GROUP_ID', 'microservice-group'),
            sessionTimeout: this.configService.get<number>('KAFKA_CONSUMER_SESSION_TIMEOUT', 30000),
            rebalanceTimeout: this.configService.get<number>('KAFKA_CONSUMER_REBALANCE_TIMEOUT', 60000),
            heartbeatInterval: this.configService.get<number>('KAFKA_CONSUMER_HEARTBEAT_INTERVAL', 3000),
            metadataMaxAge: this.configService.get<number>('KAFKA_CONSUMER_METADATA_MAX_AGE', 300000),
            allowAutoTopicCreation: this.configService.get<boolean>('KAFKA_CONSUMER_ALLOW_AUTO_TOPIC_CREATION', true),
            maxBytesPerPartition: this.configService.get<number>('KAFKA_CONSUMER_MAX_BYTES_PER_PARTITION', 1048576),
            minBytes: this.configService.get<number>('KAFKA_CONSUMER_MIN_BYTES', 1),
            maxBytes: this.configService.get<number>('KAFKA_CONSUMER_MAX_BYTES', 10485760),
            maxWaitTimeInMs: this.configService.get<number>('KAFKA_CONSUMER_MAX_WAIT_TIME', 5000),
            retry: {
                initialRetryTime: this.configService.get<number>('KAFKA_CONSUMER_INITIAL_RETRY_TIME', 100),
                retries: this.configService.get<number>('KAFKA_CONSUMER_RETRIES', 8),
            },
        };
    }

    // Environment-specific configurations
    isProduction(): boolean {
        return this.configService.get<string>('NODE_ENV') === 'production';
    }

    isDevelopment(): boolean {
        return this.configService.get<string>('NODE_ENV') === 'development';
    }

    getLogLevel(): string {
        return this.configService.get<string>('KAFKA_LOG_LEVEL', 'info');
    }
}
