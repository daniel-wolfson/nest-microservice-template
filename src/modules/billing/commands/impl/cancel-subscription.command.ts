import { Command } from '@nestjs/cqrs';
import { Subscription } from '@prisma/client';

export class CancelSubscriptionCommand extends Command<Subscription> {
    constructor(public readonly subscriptionId: string, public readonly cancelAtPeriodEnd: boolean = false) {
        super();
    }
}
