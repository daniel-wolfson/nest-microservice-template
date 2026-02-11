import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateInvoiceCommand } from '../impl/create-invoice.command';
import { InvoiceService } from '../../services/invoice.service';
import { Logger } from '@nestjs/common';

@CommandHandler(CreateInvoiceCommand)
export class CreateInvoiceHandler implements ICommandHandler<CreateInvoiceCommand> {
    private readonly logger = new Logger(CreateInvoiceHandler.name);

    constructor(private readonly invoiceService: InvoiceService) {}

    async execute(command: CreateInvoiceCommand) {
        this.logger.log(`Creating invoice for user ${command.userId}`);

        try {
            const invoice = await this.invoiceService.createInvoice(
                command.userId,
                command.amount,
                command.description,
                command.dueDate,
            );

            return invoice;
        } catch (error: any) {
            this.logger.error(`Failed to create invoice: ${error.message}`, error.stack);
            throw error;
        }
    }
}
