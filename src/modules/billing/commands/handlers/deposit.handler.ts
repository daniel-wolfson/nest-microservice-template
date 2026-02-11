import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { DepositCommand } from '../impl/deposit.command';
import { BillingService } from '../../services/billing.service';
import { StripeService } from '../../services/stripe.service';
import { TransactionState, TransactionStateMachine } from '../../state-machines/transaction.state-machine';
import { Logger } from '@nestjs/common';
import { DepositCompletedEvent } from '../../events/impl/deposit-completed.event';

@CommandHandler(DepositCommand)
export class DepositHandler implements ICommandHandler<DepositCommand> {
    private readonly logger = new Logger(DepositHandler.name);

    constructor(
        private readonly billingService: BillingService,
        private readonly stripeService: StripeService,
        private readonly stateMachine: TransactionStateMachine,
        private readonly eventBus: EventBus,
    ) {}

    async execute(command: DepositCommand) {
        this.logger.log(`Processing deposit for user ${command.userId}`);

        try {
            // Get or create billing user
            const billingUser = await this.billingService.getOrCreateBillingUser(command.userId);

            // Create transaction in CREATED state
            const transaction = await this.billingService.createTransaction({
                billingUserId: billingUser.id,
                type: 'DEPOSIT',
                amount: command.amount,
                status: 'PENDING',
                state: 'CREATED',
                paymentMethodId: command.paymentMethodId,
                description: `Deposit of ${command.amount}`,
                idempotencyKey: `deposit-${command.userId}-${Date.now()}`,
            });

            // Transition to PROCESSING
            await this.stateMachine.transition(transaction.id, TransactionState.PROCESSING);

            // Process payment via Stripe
            const paymentIntent = await this.stripeService.createPaymentIntent(
                command.amount,
                billingUser.customerId || billingUser.id,
                command.paymentMethodId,
            );

            // Update transaction with payment intent
            await this.billingService.updateTransaction(transaction.id, {
                stripePaymentIntentId: paymentIntent.id,
                status: TransactionState.PROCESSING,
            });

            // If payment succeeded, update balance and complete transaction
            if (paymentIntent.status === 'succeeded') {
                await this.billingService.updateBalance(billingUser.id, command.amount);
                await this.stateMachine.transition(transaction.id, TransactionState.COMPLETED);

                // Emit event
                this.eventBus.publish(new DepositCompletedEvent(transaction.id, command.userId, command.amount));
            }

            return await this.billingService.getTransactionById(transaction.id);
        } catch (error: any) {
            this.logger.error(`Failed to process deposit: ${error.message}`, error.stack);
            throw error;
        }
    }
}
