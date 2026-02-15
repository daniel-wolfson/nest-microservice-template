import { Command } from '@nestjs/cqrs';
import { Subscription } from '@prisma/client';

export class CreateSubscriptionCommand extends Command<Subscription> {
    constructor(
        public readonly userId: string,
        public readonly planId: string,
        public readonly paymentMethodId?: string,
    ) {
        super();
    }
}
