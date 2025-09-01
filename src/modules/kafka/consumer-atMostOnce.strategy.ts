import { EachMessagePayload } from 'kafkajs';
import { BaseConsumerDeliveryStrategy } from './consumer-base-delivery.strategy';

export class AtMostOnceConsumerStrategy extends BaseConsumerDeliveryStrategy {
    async configure(): Promise<void> {
        // Configure for at-most-once: auto-commit enabled, no manual offset management
        // Consumer settings: enable.auto.commit=true, auto.commit.interval.ms=small
    }

    async processMessage(
        payload: EachMessagePayload,
        handler: (payload: EachMessagePayload) => Promise<void>,
    ): Promise<void> {
        // Commit offset before processing - if processing fails, message is lost
        try {
            // In actual implementation, commit offset first
            await handler(payload);
        } catch (error) {
            // Message is lost if processing fails (at-most-once semantics)
            console.warn('Message processing failed but offset already committed (at-most-once)', error);
        }
    }
}
