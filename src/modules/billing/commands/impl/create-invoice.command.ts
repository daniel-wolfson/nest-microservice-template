import { Command } from '@nestjs/cqrs';
import { Invoice } from '@prisma/client';

export class CreateInvoiceCommand extends Command<Invoice> {
    constructor(
        public readonly userId: string,
        public readonly amount: number,
        public readonly description?: string,
        public readonly dueDate?: Date,
    ) {
        super();
    }
}
