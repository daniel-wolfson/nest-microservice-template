import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);

    constructor(private readonly prisma: PrismaService) {}

    async getOrCreateBillingUser(userId: string) {
        let billingUser = await this.prisma.billingUser.findUnique({
            where: { userId },
        });

        if (!billingUser) {
            billingUser = await this.prisma.billingUser.create({
                data: {
                    userId,
                    balance: 0,
                    currency: 'USD',
                },
            });
            this.logger.log(`Created billing user for userId: ${userId}`);
        }

        return billingUser;
    }

    async updateBalance(billingUserId: string, amount: number) {
        return this.prisma.billingUser.update({
            where: { id: billingUserId },
            data: {
                balance: {
                    increment: amount,
                },
            },
        });
    }

    async createSubscription(data: any) {
        return this.prisma.subscription.create({
            data,
        });
    }

    async updateSubscription(subscriptionId: string, data: any) {
        return this.prisma.subscription.update({
            where: { id: subscriptionId },
            data,
        });
    }

    async getSubscriptionById(subscriptionId: string) {
        return this.prisma.subscription.findUnique({
            where: { id: subscriptionId },
        });
    }

    async getActiveSubscriptionByUserId(userId: string) {
        const billingUser = await this.getOrCreateBillingUser(userId);

        return this.prisma.subscription.findFirst({
            where: {
                billingUserId: billingUser.id,
                status: {
                    in: ['ACTIVE', 'TRIALING'],
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async createTransaction(data: any) {
        return this.prisma.transaction.create({
            data,
        });
    }

    async updateTransaction(transactionId: string, data: any) {
        return this.prisma.transaction.update({
            where: { id: transactionId },
            data,
        });
    }

    async getTransactionById(transactionId: string) {
        return this.prisma.transaction.findUnique({
            where: { id: transactionId },
        });
    }

    async getUserTransactions(userId: string) {
        const billingUser = await this.getOrCreateBillingUser(userId);

        return this.prisma.transaction.findMany({
            where: {
                billingUserId: billingUser.id,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async getPlan(planId: string) {
        return this.prisma.plan.findUnique({
            where: { id: planId },
        });
    }

    async getAllPlans() {
        return this.prisma.plan.findMany({
            where: { isActive: true },
        });
    }

    async checkBalanceLow(userId: string, threshold: number = 10): Promise<boolean> {
        const billingUser = await this.getOrCreateBillingUser(userId);
        return billingUser.balance < threshold;
    }

    async getSubscriptionsByStatus(status: SubscriptionStatus) {
        return this.prisma.subscription.findMany({
            where: { status },
            include: {
                billingUser: true,
            },
        });
    }
}
