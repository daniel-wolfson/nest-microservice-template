import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { CancelSubscriptionCommand } from '../impl/cancel-subscription.command';
import { StripeService } from '../../services/stripe.service';
import { BillingService } from '../../services/billing.service';
import { Logger } from '@nestjs/common';
import { SubscriptionCanceledEvent } from '../../events/impl/subscription-canceled.event';

@CommandHandler(CancelSubscriptionCommand)
export class CancelSubscriptionHandler implements ICommandHandler<CancelSubscriptionCommand> {
    private readonly logger = new Logger(CancelSubscriptionHandler.name);

    constructor(
        private readonly stripeService: StripeService,
        private readonly billingService: BillingService,
        private readonly eventBus: EventBus,
    ) {}

    async execute(command: CancelSubscriptionCommand) {
        this.logger.log(`Canceling subscription ${command.subscriptionId}`);

        try {
            // Get subscription from database
            const subscription = await this.billingService.getSubscriptionById(command.subscriptionId);

            if (!subscription) {
                throw new Error(`Subscription ${command.subscriptionId} not found`);
            }

            // Cancel subscription via Stripe
            if (subscription.stripeSubscriptionId) {
                await this.stripeService.cancelSubscription(
                    subscription.stripeSubscriptionId,
                    command.cancelAtPeriodEnd,
                );
            }

            // Update subscription in database
            const updatedSubscription = await this.billingService.updateSubscription(command.subscriptionId, {
                status: command.cancelAtPeriodEnd ? 'ACTIVE' : 'CANCELED',
                cancelAtPeriodEnd: command.cancelAtPeriodEnd,
                canceledAt: command.cancelAtPeriodEnd ? undefined : new Date(),
            });

            // Emit event
            this.eventBus.publish(new SubscriptionCanceledEvent(command.subscriptionId, subscription.billingUserId));

            return updatedSubscription;
        } catch (error: any) {
            this.logger.error(`Failed to cancel subscription: ${error.message}`, error.stack);
            throw error;
        }
    }
}
