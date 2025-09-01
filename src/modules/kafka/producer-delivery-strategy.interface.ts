import { Producer, ProducerRecord, RecordMetadata } from 'kafkajs';

// Producer Delivery Strategy Interfaces

export interface IProducerDeliveryStrategy<T = any> {
    getProducer(): Producer;
    send(record: ProducerRecord): Promise<RecordMetadata[]>;
    sendBatch(records: ProducerRecord[]): Promise<RecordMetadata[]>;
    configure(): Promise<void>;
    disconnect(): Promise<void>;
}
