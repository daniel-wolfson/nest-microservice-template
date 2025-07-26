import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';

interface SendMessageDto {
    message: string;
    routingKey?: string;
    exchange?: string;
}

@Controller('rabbitmq')
export class RabbitMQController {
    private readonly logger = new Logger(RabbitMQController.name);

    constructor(private readonly rabbitMQService: RabbitMQService) {}

    @Get('messages')
    getAllMessages() {
        const messages = this.rabbitMQService.getMessages();
        this.logger.log(`Retrieved ${messages.length} messages`);

        return {
            success: true,
            count: messages.length,
            messages: messages,
        };
    }

    @Get('messages/latest')
    getLatestMessage() {
        const message = this.rabbitMQService.getLatestMessage();
        this.logger.log('Retrieved latest message');

        return {
            success: true,
            message: message,
            hasMessage: !!message,
        };
    }

    @Get('status')
    getConnectionStatus() {
        try {
            const messageCount = this.rabbitMQService.getMessages().length;

            return {
                success: true,
                status: 'connected',
                messageCount: messageCount,
                timestamp: new Date(),
            };
        } catch (error) {
            this.logger.error('Failed to get RabbitMQ status:', error);
            return {
                success: false,
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date(),
            };
        }
    }

    @Post('send')
    async sendMessage(@Body() sendMessageDto: SendMessageDto) {
        try {
            const { message, routingKey = 'test.message', exchange = 'default.exchange' } = sendMessageDto;

            await this.rabbitMQService.publishMessage(exchange, routingKey, {
                content: message,
                timestamp: new Date(),
                id: Date.now(),
            });

            return {
                success: true,
                message: 'Message sent successfully',
                sentData: {
                    exchange,
                    routingKey,
                    content: message,
                },
            };
        } catch (error) {
            this.logger.error('Failed to send message:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    @Get('simulate')
    async simulateMessage(@Query('message') message = 'Test message') {
        try {
            await this.rabbitMQService.publishMessage('default.exchange', 'test.message', {
                content: message,
                timestamp: new Date(),
                id: Date.now(),
                type: 'simulated',
            });

            return {
                success: true,
                message: 'Simulated message sent and will be received shortly',
                sentMessage: message,
            };
        } catch (error) {
            this.logger.error('Failed to simulate message:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    @Get('clear')
    clearMessages() {
        this.rabbitMQService.clearMessages();

        return {
            success: true,
            message: 'All messages cleared',
            timestamp: new Date(),
        };
    }
}
