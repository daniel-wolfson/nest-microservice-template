import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';

@Injectable()
export class VirtualAccountService {
    private readonly logger = new Logger(VirtualAccountService.name);

    constructor(private readonly prisma: PrismaService) {}

    async createVirtualAccount(userId: string) {
        const billingUser = await this.prisma.billingUser.findUnique({
            where: { userId },
        });

        if (!billingUser) {
            throw new Error('Billing user not found');
        }

        const accountNumber = this.generateAccountNumber();

        const virtualAccount = await this.prisma.virtualAccount.create({
            data: {
                billingUserId: billingUser.id,
                accountNumber,
                balance: 0,
                currency: 'USD',
                status: 'ACTIVE',
            },
        });

        this.logger.log(`Created virtual account ${accountNumber} for user ${userId}`);

        return virtualAccount;
    }

    async getVirtualAccount(accountNumber: string) {
        return this.prisma.virtualAccount.findUnique({
            where: { accountNumber },
            include: {
                billingUser: true,
            },
        });
    }

    async getUserVirtualAccounts(userId: string) {
        const billingUser = await this.prisma.billingUser.findUnique({
            where: { userId },
        });

        if (!billingUser) {
            return [];
        }

        return this.prisma.virtualAccount.findMany({
            where: {
                billingUserId: billingUser.id,
            },
        });
    }

    async updateVirtualAccountBalance(accountNumber: string, amount: number) {
        return this.prisma.virtualAccount.update({
            where: { accountNumber },
            data: {
                balance: {
                    increment: amount,
                },
            },
        });
    }

    async suspendVirtualAccount(accountNumber: string) {
        return this.prisma.virtualAccount.update({
            where: { accountNumber },
            data: {
                status: 'SUSPENDED',
            },
        });
    }

    async closeVirtualAccount(accountNumber: string) {
        const virtualAccount = await this.getVirtualAccount(accountNumber);

        if (!virtualAccount) {
            throw new Error('Virtual account not found');
        }

        if (virtualAccount.balance > 0) {
            throw new Error('Cannot close account with positive balance');
        }

        return this.prisma.virtualAccount.update({
            where: { accountNumber },
            data: {
                status: 'CLOSED',
            },
        });
    }

    private generateAccountNumber(): string {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, '0');
        return `VA${timestamp}${random}`;
    }

    async transferBetweenAccounts(fromAccountNumber: string, toAccountNumber: string, amount: number) {
        const fromAccount = await this.getVirtualAccount(fromAccountNumber);
        const toAccount = await this.getVirtualAccount(toAccountNumber);

        if (!fromAccount || !toAccount) {
            throw new Error('Virtual account not found');
        }

        if (fromAccount.balance < amount) {
            throw new Error('Insufficient balance');
        }

        // Use transaction for atomicity
        return this.prisma.$transaction([
            this.prisma.virtualAccount.update({
                where: { accountNumber: fromAccountNumber },
                data: {
                    balance: {
                        decrement: amount,
                    },
                },
            }),
            this.prisma.virtualAccount.update({
                where: { accountNumber: toAccountNumber },
                data: {
                    balance: {
                        increment: amount,
                    },
                },
            }),
        ]);
    }
}
