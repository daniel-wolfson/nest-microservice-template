import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetSubscriptionQuery } from '../impl/get-subscription.query';
import { BillingService } from '../../services/billing.service';
import { Logger } from '@nestjs/common';

@QueryHandler(GetSubscriptionQuery)
export class GetSubscriptionHandler implements IQueryHandler<GetSubscriptionQuery> {
    private readonly logger = new Logger(GetSubscriptionHandler.name);

    constructor(private readonly billingService: BillingService) {}

    async execute(query: GetSubscriptionQuery) {
        this.logger.log(`Getting subscription for user ${query.userId}`);

        const subscription = await this.billingService.getActiveSubscriptionByUserId(query.userId);

        return subscription;
    }
}
