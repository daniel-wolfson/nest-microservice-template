import { EachMessagePayload } from 'kafkajs';
import { BaseConsumerDeliveryStrategy } from './consumer-base-delivery.strategy';

export class AtLeastOnceConsumerStrategy extends BaseConsumerDeliveryStrategy {
    async configure(): Promise<void> {
        // Configure for at-least-once: manual offset management, retries
        // Consumer settings: enable.auto.commit=false
    }

    async processMessage(
        payload: EachMessagePayload,
        handler: (payload: EachMessagePayload) => Promise<void>,
    ): Promise<void> {
        // Process message first, then commit offset - may result in duplicates on failure
        let processed = false;
        let retryCount = 0;
        const maxRetries = 3;

        while (!processed && retryCount < maxRetries) {
            try {
                await handler(payload);
                // In actual implementation, manually commit offset after successful processing
                processed = true;
            } catch (error) {
                retryCount++;
                if (retryCount >= maxRetries) {
                    // After max retries, send to dead letter queue or log error
                    throw error;
                }
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }
    }
}
