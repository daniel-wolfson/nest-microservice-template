import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { WithdrawCommand } from '../impl/withdraw.command';
import { BillingService } from '../../services/billing.service';
import { TransactionState, TransactionStateMachine } from '../../sagas/transaction.state-machine';
import { Logger, BadRequestException } from '@nestjs/common';
import { WithdrawalCompletedEvent } from '../../events/impl/withdrawal-completed.event';

@CommandHandler(WithdrawCommand)
export class WithdrawHandler implements ICommandHandler<WithdrawCommand> {
    private readonly logger = new Logger(WithdrawHandler.name);

    constructor(
        private readonly billingService: BillingService,
        private readonly stateMachine: TransactionStateMachine,
        private readonly eventBus: EventBus,
    ) {}

    async execute(command: WithdrawCommand) {
        this.logger.log(`Processing withdrawal for user ${command.userId}`);

        try {
            // Get billing user
            const billingUser = await this.billingService.getOrCreateBillingUser(command.userId);

            // Check if user has sufficient balance
            if (billingUser.balance < command.amount) {
                throw new BadRequestException('Insufficient balance');
            }

            // Create transaction in CREATED state
            const transaction = await this.billingService.createTransaction({
                billingUserId: billingUser.id,
                type: 'WITHDRAWAL',
                amount: command.amount,
                status: 'PENDING',
                state: 'CREATED',
                description: `Withdrawal of ${command.amount}`,
                metadata: { destination: command.destination },
                idempotencyKey: `withdraw-${command.userId}-${Date.now()}`,
            });

            // Transition to PROCESSING
            await this.stateMachine.transition(transaction.id, TransactionState.PROCESSING);

            // Deduct from balance
            await this.billingService.updateBalance(billingUser.id, -command.amount);

            // Complete transaction
            await this.stateMachine.transition(transaction.id, TransactionState.COMPLETED);

            // Emit event
            this.eventBus.publish(new WithdrawalCompletedEvent(transaction.id, command.userId, command.amount));

            return await this.billingService.getTransactionById(transaction.id);
        } catch (error: any) {
            this.logger.error(`Failed to process withdrawal: ${error.message}`, error.stack);
            throw error;
        }
    }
}
