export class SubscriptionUpdatedEvent {
    constructor(
        public readonly subscriptionId: string,
        public readonly customerId: string,
        public readonly status: string,
    ) {}
}
