import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/modules/prisma/prisma.service';
import { InvoiceStatus, TransactionStatus } from '@prisma/client';

export enum TransactionState {
    CREATED = 'CREATED',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    ERROR = 'ERROR',
    CANCELED = 'CANCELED',
}

interface StateTransition {
    from: TransactionState;
    to: TransactionState;
    action?: string;
}

@Injectable()
export class TransactionStateMachine {
    private readonly logger = new Logger(TransactionStateMachine.name);

    // Define valid state transitions
    private readonly transitions: StateTransition[] = [
        { from: TransactionState.CREATED, to: TransactionState.PROCESSING },
        { from: TransactionState.PROCESSING, to: TransactionState.COMPLETED },
        { from: TransactionState.PROCESSING, to: TransactionState.ERROR },
        { from: TransactionState.CREATED, to: TransactionState.CANCELED },
        { from: TransactionState.PROCESSING, to: TransactionState.CANCELED },
        { from: TransactionState.ERROR, to: TransactionState.PROCESSING }, // Retry
        { from: TransactionState.ERROR, to: TransactionState.CANCELED },
    ];

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Attempt to transition a transaction to a new state
     */
    async transition(transactionId: string, newState: TransactionState): Promise<boolean> {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id: transactionId },
        });

        if (!transaction) {
            throw new Error(`Transaction ${transactionId} not found`);
        }

        const currentState = transaction.state as TransactionState;

        // Check if transition is valid
        if (!this.isValidTransition(currentState, newState)) {
            this.logger.error(
                `Invalid state transition for transaction ${transactionId}: ${currentState} -> ${newState}`,
            );
            throw new Error(`Invalid state transition: ${currentState} -> ${newState}`);
        }

        // Perform the state transition
        await this.prisma.transaction.update({
            where: { id: transactionId },
            data: {
                state: newState,
                status: this.mapStateToStatus(newState),
                ...(newState === TransactionState.COMPLETED && { completedAt: new Date() }),
            },
        });

        this.logger.log(`Transaction ${transactionId} transitioned from ${currentState} to ${newState}`);

        // Execute side effects based on the new state
        await this.executeStateActions(transactionId, newState);

        return true;
    }

    /**
     * Check if a state transition is valid
     */
    private isValidTransition(from: TransactionState, to: TransactionState): boolean {
        // Allow staying in the same state
        if (from === to) {
            return true;
        }

        return this.transitions.some(t => t.from === from && t.to === to);
    }

    /**
     * Map state to transaction status
     */
    private mapStateToStatus(state: TransactionState): TransactionStatus {
        const statusMap: Record<TransactionState, TransactionStatus> = {
            [TransactionState.CREATED]: TransactionStatus.PENDING,
            [TransactionState.PROCESSING]: TransactionStatus.PROCESSING,
            [TransactionState.COMPLETED]: TransactionStatus.COMPLETED,
            [TransactionState.ERROR]: TransactionStatus.FAILED,
            [TransactionState.CANCELED]: TransactionStatus.CANCELED,
        };

        return statusMap[state];
    }

    /**
     * Execute actions based on the new state
     */
    private async executeStateActions(transactionId: string, state: TransactionState) {
        switch (state) {
            case TransactionState.COMPLETED:
                await this.onCompleted(transactionId);
                break;

            case TransactionState.ERROR:
                await this.onError(transactionId);
                break;

            case TransactionState.CANCELED:
                await this.onCanceled(transactionId);
                break;

            default:
                break;
        }
    }

    /**
     * Actions to perform when transaction is completed
     */
    private async onCompleted(transactionId: string) {
        this.logger.log(`Transaction ${transactionId} completed successfully`);
        // Additional actions like sending notifications, updating metrics, etc.
    }

    /**
     * Actions to perform when transaction encounters an error
     */
    private async onError(transactionId: string) {
        this.logger.error(`Transaction ${transactionId} encountered an error`);
        // Additional error handling actions
    }

    /**
     * Actions to perform when transaction is canceled
     */
    private async onCanceled(transactionId: string) {
        this.logger.log(`Transaction ${transactionId} was canceled`);
        // Rollback actions if needed
    }

    /**
     * Get current state of a transaction
     */
    async getCurrentState(transactionId: string): Promise<TransactionState> {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id: transactionId },
        });

        if (!transaction) {
            throw new Error(`Transaction ${transactionId} not found`);
        }

        return transaction.state as TransactionState;
    }

    /**
     * Get all possible next states from current state
     */
    getNextStates(currentState: TransactionState): TransactionState[] {
        return this.transitions.filter(t => t.from === currentState).map(t => t.to);
    }

    /**
     * Check if transaction can be transitioned to a specific state
     */
    canTransitionTo(currentState: TransactionState, targetState: TransactionState): boolean {
        return this.isValidTransition(currentState, targetState);
    }
}
