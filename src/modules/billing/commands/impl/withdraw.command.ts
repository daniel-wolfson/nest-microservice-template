export class WithdrawCommand {
    constructor(public readonly userId: string, public readonly amount: number, public readonly destination: string) {}
}
