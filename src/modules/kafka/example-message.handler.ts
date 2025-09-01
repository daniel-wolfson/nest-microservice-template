import { Injectable, Inject } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { MessageHandler } from './kafka-consumer.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class ExampleMessageHandler implements MessageHandler {
    constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

    async handle(payload: EachMessagePayload): Promise<void> {
        const { topic, partition, message } = payload;

        try {
            // Parse the message value
            const messageValue = message.value?.toString();
            const messageKey = message.key?.toString();

            this.logger.info('Processing Kafka message', {
                context: 'ExampleMessageHandler',
                method: 'handle',
                topic,
                partition,
                offset: message.offset,
                key: messageKey,
                timestamp: message.timestamp,
            });

            // Example message processing logic
            if (messageValue) {
                const parsedMessage = JSON.parse(messageValue);

                // Add your business logic here
                await this.processMessage(parsedMessage);

                this.logger.debug('Message processed successfully', {
                    context: 'ExampleMessageHandler',
                    method: 'handle',
                    topic,
                    messageId: parsedMessage.id || 'unknown',
                });
            }
        } catch (error) {
            this.logger.error('Failed to process Kafka message', {
                context: 'ExampleMessageHandler',
                method: 'handle',
                topic,
                partition,
                offset: message.offset,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });

            // Decide whether to rethrow the error or handle it gracefully
            // Rethrowing will cause Kafka to retry the message
            throw error;
        }
    }

    private async processMessage(message: any): Promise<void> {
        // Example business logic
        this.logger.debug('Processing message content', {
            context: 'ExampleMessageHandler',
            method: 'processMessage',
            messageType: message.type || 'unknown',
            messageId: message.id || 'unknown',
        });

        // Simulate some processing work
        await new Promise(resolve => setTimeout(resolve, 100));

        // Add your specific message processing logic here
        // For example: save to database, call external API, etc.
    }
}
