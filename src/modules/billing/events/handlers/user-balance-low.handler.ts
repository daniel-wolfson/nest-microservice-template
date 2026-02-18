import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { UserBalanceLowEvent } from '../impl/user-balance-low.event';
import { BILLING_BROKER_CLIENT } from '../../brokers/billing-broker.constants';
import { BillingBrokerClient } from '../../brokers/billing-broker-client.interface';

@EventsHandler(UserBalanceLowEvent)
export class UserBalanceLowHandler implements IEventHandler<UserBalanceLowEvent> {
    private readonly logger = new Logger(UserBalanceLowHandler.name);

    constructor(
        @Inject(BILLING_BROKER_CLIENT)
        private readonly client: BillingBrokerClient,
    ) {}

    async handle(event: UserBalanceLowEvent) {
        this.logger.log(`Handling UserBalanceLowEvent for user ${event.userId}`);

        try {
            // Send warning to notification service
            await this.client.emit('user.balance.low', {
                userId: event.userId,
                currentBalance: event.currentBalance,
                threshold: event.threshold,
                timestamp: new Date().toISOString(),
            });

            this.logger.log('Balance low warning sent successfully');
        } catch (error) {
            this.logger.error('Failed to handle balance low event', error);
        }
    }
}
