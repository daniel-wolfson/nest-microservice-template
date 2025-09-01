import { EachMessagePayload } from 'kafkajs';
import { BaseConsumerDeliveryStrategy } from './consumer-base-delivery.strategy';

export class ExactlyOnceConsumerStrategy extends BaseConsumerDeliveryStrategy {
    async configure(): Promise<void> {
        // Configure for exactly-once: transactional consumer, manual offset management
        // Consumer settings: enable.auto.commit=false, isolation.level=read_committed
    }

    async processMessage(
        payload: EachMessagePayload,
        handler: (payload: EachMessagePayload) => Promise<void>,
    ): Promise<void> {
        // Use transactional processing with idempotency checks
        try {
            // In actual implementation, check if message was already processed (idempotency)
            const messageId = this.extractMessageId(payload);
            if (await this.isMessageAlreadyProcessed(messageId)) {
                // Message already processed, skip
                return;
            }

            // Process within transaction
            await handler(payload);

            // Mark message as processed and commit offset within transaction
            await this.markMessageAsProcessed(messageId);
            // In actual implementation, commit offset within transaction
        } catch (error) {
            // Transaction will be rolled back
            throw error;
        }
    }

    private extractMessageId(payload: EachMessagePayload): string {
        // Extract unique message identifier from headers or message key
        return payload.message.key?.toString() || `${payload.topic}-${payload.partition}-${payload.message.offset}`;
    }

    private async isMessageAlreadyProcessed(messageId: string): Promise<boolean> {
        // Check against processed messages store (database, cache, etc.)
        // This is a placeholder - implement based on your storage solution
        return false;
    }

    private async markMessageAsProcessed(messageId: string): Promise<void> {
        // Store message ID to prevent reprocessing
        // This is a placeholder - implement based on your storage solution
    }
}
