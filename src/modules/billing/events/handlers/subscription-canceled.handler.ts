import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { SubscriptionCanceledEvent } from '../impl/subscription-canceled.event';
import { BILLING_BROKER_CLIENT } from '../../brokers/billing-broker.constants';
import { BillingBrokerClient } from '../../brokers/billing-broker-client.interface';

@EventsHandler(SubscriptionCanceledEvent)
export class SubscriptionCanceledHandler implements IEventHandler<SubscriptionCanceledEvent> {
    private readonly logger = new Logger(SubscriptionCanceledHandler.name);

    constructor(
        @Inject(BILLING_BROKER_CLIENT)
        private readonly client: BillingBrokerClient,
    ) {}

    async handle(event: SubscriptionCanceledEvent) {
        this.logger.log(`Handling SubscriptionCanceledEvent for user ${event.userId}`);

        try {
            // Notify auth service to downgrade user permissions
            await this.client.emit('user.subscription.canceled', {
                userId: event.userId,
                subscriptionId: event.subscriptionId,
                timestamp: new Date().toISOString(),
            });

            // Notify user via notification service
            await this.client.emit('subscription.canceled', {
                userId: event.userId,
                subscriptionId: event.subscriptionId,
            });

            this.logger.log('Subscription canceled events emitted successfully');
        } catch (error) {
            this.logger.error('Failed to handle subscription canceled event', error);
        }
    }
}
