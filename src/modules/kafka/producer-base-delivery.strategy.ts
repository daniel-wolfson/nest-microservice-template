import { Producer, ProducerRecord, RecordMetadata } from 'kafkajs';
import { IProducerDeliveryStrategy } from './producer-delivery-strategy.interface';
import { KafkaSettings } from './kafka-settings';

// Producer Strategy Implementations
export abstract class BaseProducerDeliveryStrategy<T = any> implements IProducerDeliveryStrategy<T> {
    constructor(protected readonly settings: KafkaSettings) {}
    abstract getProducer(): Producer;
    abstract send(record: ProducerRecord): Promise<RecordMetadata[]>;
    abstract sendBatch(records: ProducerRecord[]): Promise<RecordMetadata[]>;
    abstract configure(): Promise<void>;
    abstract disconnect(): Promise<void>;
}
