import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SubscriptionCanceledEvent } from '../impl/subscription-canceled.event';

@EventsHandler(SubscriptionCanceledEvent)
export class SubscriptionCanceledHandler implements IEventHandler<SubscriptionCanceledEvent> {
    private readonly logger = new Logger(SubscriptionCanceledHandler.name);

    constructor(@Inject('BILLING_SERVICE') private readonly client: ClientProxy) {}

    async handle(event: SubscriptionCanceledEvent) {
        this.logger.log(`Handling SubscriptionCanceledEvent for user ${event.userId}`);

        try {
            // Notify auth service to downgrade user permissions
            this.client.emit('user.subscription.canceled', {
                userId: event.userId,
                subscriptionId: event.subscriptionId,
                timestamp: new Date().toISOString(),
            });

            // Notify user via notification service
            this.client.emit('subscription.canceled', {
                userId: event.userId,
                subscriptionId: event.subscriptionId,
            });

            this.logger.log('Subscription canceled events emitted successfully');
        } catch (error) {
            this.logger.error('Failed to handle subscription canceled event', error);
        }
    }
}
