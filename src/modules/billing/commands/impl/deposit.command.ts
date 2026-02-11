export class DepositCommand {
    constructor(
        public readonly userId: string,
        public readonly amount: number,
        public readonly paymentMethodId?: string,
    ) {}
}
