import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { UserBalanceLowEvent } from '../impl/user-balance-low.event';

@EventsHandler(UserBalanceLowEvent)
export class UserBalanceLowHandler implements IEventHandler<UserBalanceLowEvent> {
    private readonly logger = new Logger(UserBalanceLowHandler.name);

    constructor(@Inject('BILLING_SERVICE') private readonly client: ClientProxy) {}

    async handle(event: UserBalanceLowEvent) {
        this.logger.log(`Handling UserBalanceLowEvent for user ${event.userId}`);

        try {
            // Send warning to notification service
            this.client.emit('user.balance.low', {
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
