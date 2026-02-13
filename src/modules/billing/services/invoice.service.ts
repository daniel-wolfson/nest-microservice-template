import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { BillingService } from './billing.service';
import { InvoiceStatus } from '@prisma/client';

@Injectable()
export class InvoiceService {
    private readonly logger = new Logger(InvoiceService.name);

    constructor(private readonly prisma: PrismaService, private readonly billingService: BillingService) {}

    async createInvoice(userId: string, amount: number, description?: string, dueDate?: Date) {
        const billingUser = await this.billingService.getOrCreateBillingUser(userId);

        const invoiceNumber = await this.generateInvoiceNumber();

        const invoice = await this.prisma.invoice.create({
            data: {
                billingUserId: billingUser.id,
                invoiceNumber,
                amount,
                currency: 'USD',
                status: 'DRAFT',
                description,
                dueDate,
            },
        });

        this.logger.log(`Created invoice ${invoiceNumber} for user ${userId}`);

        return invoice;
    }

    async getUserInvoices(userId: string) {
        const billingUser = await this.billingService.getOrCreateBillingUser(userId);

        return this.prisma.invoice.findMany({
            where: {
                billingUserId: billingUser.id,
            },
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                transactions: true,
            },
        });
    }

    async getInvoiceById(invoiceId: string) {
        return this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                transactions: true,
                billingUser: true,
            },
        });
    }

    async updateInvoiceStatus(invoiceId: string, status: InvoiceStatus) {
        return this.prisma.invoice.update({
            where: { id: invoiceId },
            data: { status },
        });
    }

    async markInvoiceAsPaid(invoiceId: string) {
        return this.prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                status: 'PAID',
                paidAt: new Date(),
            },
        });
    }

    async generateInvoicePDF(invoiceId: string): Promise<string> {
        const invoice = await this.getInvoiceById(invoiceId);

        if (!invoice) {
            throw new Error('Invoice not found');
        }

        // Here you would implement PDF generation using a library like pdfkit or puppeteer
        // For now, return a placeholder URL
        const pdfUrl = `https://example.com/invoices/${invoice.invoiceNumber}.pdf`;

        await this.prisma.invoice.update({
            where: { id: invoiceId },
            data: { pdfUrl },
        });

        this.logger.log(`Generated PDF for invoice ${invoice.invoiceNumber}`);

        return pdfUrl;
    }

    private async generateInvoiceNumber(): Promise<string> {
        const year = new Date().getFullYear();
        const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

        // Get the count of invoices this month
        const count = await this.prisma.invoice.count({
            where: {
                invoiceNumber: {
                    startsWith: `INV-${year}${month}`,
                },
            },
        });

        const sequence = (count + 1).toString().padStart(5, '0');

        return `INV-${year}${month}-${sequence}`;
    }

    async voidInvoice(invoiceId: string) {
        return this.prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                status: 'VOID',
            },
        });
    }

    async getUnpaidInvoices() {
        return this.prisma.invoice.findMany({
            where: {
                status: 'OPEN',
                dueDate: {
                    lt: new Date(),
                },
            },
            include: {
                billingUser: true,
            },
        });
    }
}
