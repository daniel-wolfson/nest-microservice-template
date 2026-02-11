import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetInvoicesQuery } from '../impl/get-invoices.query';
import { InvoiceService } from '../../services/invoice.service';
import { Logger } from '@nestjs/common';

@QueryHandler(GetInvoicesQuery)
export class GetInvoicesHandler implements IQueryHandler<GetInvoicesQuery> {
    private readonly logger = new Logger(GetInvoicesHandler.name);

    constructor(private readonly invoiceService: InvoiceService) {}

    async execute(query: GetInvoicesQuery) {
        this.logger.log(`Getting invoices for user ${query.userId}`);

        const invoices = await this.invoiceService.getUserInvoices(query.userId);

        return invoices;
    }
}
