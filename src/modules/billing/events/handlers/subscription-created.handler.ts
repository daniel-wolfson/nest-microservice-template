import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { SubscriptionCreatedEvent } from '../impl/subscription-created.event';
import { BILLING_BROKER_CLIENT } from '../../brokers/billing-broker.constants';
import { BillingBrokerClient } from '../../brokers/billing-broker-client.interface';

@EventsHandler(SubscriptionCreatedEvent)
export class SubscriptionCreatedHandler implements IEventHandler<SubscriptionCreatedEvent> {
    private readonly logger = new Logger(SubscriptionCreatedHandler.name);

    constructor(
        @Inject(BILLING_BROKER_CLIENT)
        private readonly client: BillingBrokerClient,
    ) {}

    async handle(event: SubscriptionCreatedEvent) {
        this.logger.log(`Handling SubscriptionCreatedEvent for user ${event.userId}`);

        try {
            // Send event to notification service via RabbitMQ
            await this.client.emit('subscription.created', {
                subscriptionId: event.subscriptionId,
                userId: event.userId,
                planId: event.planId,
                timestamp: new Date().toISOString(),
            });

            // Send event to auth service to update user permissions
            await this.client.emit('user.subscription.activated', {
                userId: event.userId,
                planId: event.planId,
            });

            this.logger.log('Subscription created events emitted successfully');
        } catch (error) {
            this.logger.error('Failed to handle subscription created event', error);
        }
    }
}
