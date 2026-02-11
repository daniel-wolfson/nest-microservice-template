import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SubscriptionCreatedEvent } from '../impl/subscription-created.event';

@EventsHandler(SubscriptionCreatedEvent)
export class SubscriptionCreatedHandler implements IEventHandler<SubscriptionCreatedEvent> {
    private readonly logger = new Logger(SubscriptionCreatedHandler.name);

    constructor(@Inject('BILLING_SERVICE') private readonly client: ClientProxy) {}

    async handle(event: SubscriptionCreatedEvent) {
        this.logger.log(`Handling SubscriptionCreatedEvent for user ${event.userId}`);

        try {
            // Send event to notification service via RabbitMQ
            this.client.emit('subscription.created', {
                subscriptionId: event.subscriptionId,
                userId: event.userId,
                planId: event.planId,
                timestamp: new Date().toISOString(),
            });

            // Send event to auth service to update user permissions
            this.client.emit('user.subscription.activated', {
                userId: event.userId,
                planId: event.planId,
            });

            this.logger.log('Subscription created events emitted successfully');
        } catch (error) {
            this.logger.error('Failed to handle subscription created event', error);
        }
    }
}
