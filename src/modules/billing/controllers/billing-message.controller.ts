import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { CommandBus, EventBus } from '@nestjs/cqrs';
import { OrderCreatedEvent } from '../events/impl/order-created.event';
import { CreateInvoiceCommand } from '../commands/impl/create-invoice.command';

@Controller()
export class BillingMessageController {
    private readonly logger = new Logger(BillingMessageController.name);

    constructor(private readonly commandBus: CommandBus, private readonly eventBus: EventBus) {}

    /**
     * Handle order.created events from Orders service
     */
    @EventPattern('order.created')
    async handleOrderCreated(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received order.created event: ${JSON.stringify(data)}`);

        try {
            // Publish internal event
            this.eventBus.publish(new OrderCreatedEvent(data.orderId, data.userId, data.amount, data.items || []));

            // Acknowledge the message
            const channel = context.getChannelRef();
            const originalMsg = context.getMessage();
            channel.ack(originalMsg);

            this.logger.log(`Order created event processed successfully`);
        } catch (error: any) {
            this.logger.error(`Failed to process order.created event: ${error?.message}`);
            // Optionally, nack the message for retry
            const channel = context.getChannelRef();
            const originalMsg = context.getMessage();
            channel.nack(originalMsg, false, true);
        }
    }

    /**
     * Handle user.created events from Auth service
     */
    @EventPattern('user.created')
    async handleUserCreated(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received user.created event: ${JSON.stringify(data)}`);

        try {
            // Create billing user when new user is created
            // This would be handled by BillingService.getOrCreateBillingUser
            // when the user first interacts with billing

            const channel = context.getChannelRef();
            const originalMsg = context.getMessage();
            channel.ack(originalMsg);
        } catch (error: any) {
            this.logger.error(`Failed to process user.created event: ${error?.message}`);
        }
    }

    /**
     * Handle payment.webhook events
     */
    @EventPattern('payment.webhook')
    async handlePaymentWebhook(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received payment.webhook event`);

        try {
            // Process payment webhook
            // This is already handled by the webhook controller, but can be queued here

            const channel = context.getChannelRef();
            const originalMsg = context.getMessage();
            channel.ack(originalMsg);
        } catch (error: any) {
            this.logger.error(`Failed to process payment.webhook event: ${error?.message}`);
        }
    }

    /**
     * Handle subscription.failed events (e.g., from payment failures)
     */
    @EventPattern('subscription.payment.failed')
    async handleSubscriptionPaymentFailed(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received subscription.payment.failed event`);

        try {
            // Notify auth service to downgrade user
            // Update subscription status
            // This would trigger the auth service to revoke premium features

            const channel = context.getChannelRef();
            const originalMsg = context.getMessage();
            channel.ack(originalMsg);
        } catch (error: any) {
            this.logger.error(`Failed to process subscription failed event: ${error?.message}`);
        }
    }
}
