import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetBalanceQuery } from '../impl/get-balance.query';
import { BillingService } from '../../services/billing.service';
import { Logger } from '@nestjs/common';

@QueryHandler(GetBalanceQuery)
export class GetBalanceHandler implements IQueryHandler<GetBalanceQuery> {
    private readonly logger = new Logger(GetBalanceHandler.name);

    constructor(private readonly billingService: BillingService) {}

    async execute(query: GetBalanceQuery) {
        this.logger.log(`Getting balance for user ${query.userId}`);

        const billingUser = await this.billingService.getOrCreateBillingUser(query.userId);

        return {
            userId: query.userId,
            balance: billingUser.balance,
            currency: billingUser.currency,
        };
    }
}
