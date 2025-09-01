import { ConsumerConfig } from 'kafkajs';

export interface KafkaConsumerSettings extends ConsumerConfig {
    groupId: string;
    sessionTimeout?: number;
    rebalanceTimeout?: number;
    heartbeatInterval?: number;
    metadataMaxAge?: number;
    allowAutoTopicCreation?: boolean;
    maxBytesPerPartition?: number;
    minBytes?: number;
    maxBytes?: number;
    maxWaitTimeInMs?: number;
    retry?: {
        initialRetryTime?: number;
        retries?: number;
    };
}
