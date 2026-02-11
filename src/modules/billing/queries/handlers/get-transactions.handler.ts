import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetTransactionsQuery } from '../impl/get-transactions.query';
import { BillingService } from '../../services/billing.service';
import { Logger } from '@nestjs/common';

@QueryHandler(GetTransactionsQuery)
export class GetTransactionsHandler implements IQueryHandler<GetTransactionsQuery> {
    private readonly logger = new Logger(GetTransactionsHandler.name);

    constructor(private readonly billingService: BillingService) {}

    async execute(query: GetTransactionsQuery) {
        this.logger.log(`Getting transactions for user ${query.userId}`);

        const transactions = await this.billingService.getUserTransactions(query.userId);

        return transactions;
    }
}
