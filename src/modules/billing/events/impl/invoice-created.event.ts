export class InvoiceCreatedEvent {
    constructor(public readonly invoiceId: string, public readonly userId: string, public readonly amount: number) {}
}
