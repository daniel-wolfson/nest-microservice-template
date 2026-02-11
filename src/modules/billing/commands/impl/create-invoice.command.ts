export class CreateInvoiceCommand {
    constructor(
        public readonly userId: string,
        public readonly amount: number,
        public readonly description?: string,
        public readonly dueDate?: Date,
    ) {}
}
