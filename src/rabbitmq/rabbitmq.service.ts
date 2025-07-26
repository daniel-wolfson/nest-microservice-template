import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection, RabbitSubscribe, RabbitPayload } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class RabbitMQService {
    private readonly logger = new Logger(RabbitMQService.name);
    private messages: any[] = [];

    constructor(private readonly amqpConnection: AmqpConnection) {}

    async publishMessage(exchange: string, routingKey: string, message: any): Promise<void> {
        try {
            await this.amqpConnection.publish(exchange, routingKey, message);
            this.logger.log(`Message published to ${exchange} with routing key ${routingKey}`);
        } catch (error) {
            this.logger.error('Failed to publish message:', error);
            throw error;
        }
    }

    getMessages(): any[] {
        return this.messages;
    }

    getLatestMessage(): any {
        return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
    }

    clearMessages(): void {
        this.messages = [];
        this.logger.log('Messages cleared');
    }

    @RabbitSubscribe({
        exchange: 'default.exchange',
        routingKey: 'test.message',
        queue: 'test.queue',
    })
    public async handleMessage(@RabbitPayload() data: any) {
        this.logger.log('Received message from RabbitMQ:', data);

        this.messages.push({
            id: Date.now(),
            data,
            receivedAt: new Date(),
        });

        if (this.messages.length > 100) {
            this.messages = this.messages.slice(-100);
        }
    }
}
