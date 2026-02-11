export class PaymentSuccessEvent {
    constructor(
        public readonly paymentIntentId: string,
        public readonly customerId: string,
        public readonly amount: number,
    ) {}
}
