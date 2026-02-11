import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { CreateSubscriptionCommand } from '../impl/create-subscription.command';
import { StripeService } from '../../services/stripe.service';
import { BillingService } from '../../services/billing.service';
import { Logger } from '@nestjs/common';
import { SubscriptionCreatedEvent } from '../../events/impl/subscription-created.event';

@CommandHandler(CreateSubscriptionCommand)
export class CreateSubscriptionHandler implements ICommandHandler<CreateSubscriptionCommand> {
    private readonly logger = new Logger(CreateSubscriptionHandler.name);

    constructor(
        private readonly stripeService: StripeService,
        private readonly billingService: BillingService,
        private readonly eventBus: EventBus,
    ) {}

    async execute(command: CreateSubscriptionCommand) {
        this.logger.log(`Creating subscription for user ${command.userId}`);

        try {
            // Get or create billing user
            const billingUser = await this.billingService.getOrCreateBillingUser(command.userId);

            // Get plan details
            const plan = await this.billingService.getPlan(command.planId);

            if (!plan) {
                throw new Error(`Plan ${command.planId} not found`);
            }

            // Create subscription via Stripe
            const subscription = await this.stripeService.createSubscription(
                billingUser.customerId || billingUser.id,
                plan.stripePriceId || plan.id,
                command.paymentMethodId,
            );

            // Save subscription to database
            const savedSubscription = await this.billingService.createSubscription({
                billingUserId: billingUser.id,
                stripeSubscriptionId: subscription.id,
                stripePriceId: plan.stripePriceId,
                planId: command.planId,
                planName: plan.name,
                status: subscription.status as any,
                currentPeriodStart: subscription.start_date //.current_period_start
                    ? new Date(subscription.start_date * 1000) //current_period_start
                    : undefined,
                currentPeriodEnd: subscription.ended_at //current_period_end
                    ? new Date(subscription.ended_at * 1000) //current_period_end
                    : undefined,
            });

            // Emit event
            this.eventBus.publish(new SubscriptionCreatedEvent(savedSubscription.id, command.userId, command.planId));

            return savedSubscription;
        } catch (error: any) {
            this.logger.error(`Failed to create subscription: ${error.message}`, error.stack);
            throw error;
        }
    }
}
