export class PaymentFailedEvent {
    constructor(
        public readonly paymentIntentId: string,
        public readonly customerId: string,
        public readonly errorMessage: string,
    ) {}
}
