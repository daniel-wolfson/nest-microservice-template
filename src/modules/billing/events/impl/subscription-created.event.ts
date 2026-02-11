export class SubscriptionCreatedEvent {
    constructor(
        public readonly subscriptionId: string,
        public readonly userId: string,
        public readonly planId: string,
    ) {}
}
