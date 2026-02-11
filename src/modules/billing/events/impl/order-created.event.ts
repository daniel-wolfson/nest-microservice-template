export class OrderCreatedEvent {
    constructor(
        public readonly orderId: string,
        public readonly userId: string,
        public readonly amount: number,
        public readonly items: any[],
    ) {}
}
