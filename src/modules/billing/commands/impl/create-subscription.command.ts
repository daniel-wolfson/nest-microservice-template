export class CreateSubscriptionCommand {
    constructor(
        public readonly userId: string,
        public readonly planId: string,
        public readonly paymentMethodId?: string,
    ) {}
}
