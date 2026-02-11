export class CancelSubscriptionCommand {
    constructor(public readonly subscriptionId: string, public readonly cancelAtPeriodEnd: boolean = false) {}
}
