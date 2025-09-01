import { EachMessagePayload } from 'kafkajs';

// Consumer Delivery Strategy Interface

export interface IConsumerDeliveryStrategy {
    processMessage(payload: EachMessagePayload, handler: (payload: EachMessagePayload) => Promise<void>): Promise<void>;
    configure(): Promise<void>;
}
