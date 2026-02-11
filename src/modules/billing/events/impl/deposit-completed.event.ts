export class DepositCompletedEvent {
    constructor(
        public readonly transactionId: string,
        public readonly userId: string,
        public readonly amount: number,
    ) {}
}
