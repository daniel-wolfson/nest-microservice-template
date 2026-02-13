import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from '../../src/modules/billing/services/billing.service';
import { PrismaService } from '@/modules/prisma/prisma.service';

describe('BillingService', () => {
    let service: BillingService;
    let prismaService: PrismaService;

    const mockPrismaService = {
        billingUser: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        subscription: {
            create: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
        },
        transaction: {
            create: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
        },
        plan: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BillingService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<BillingService>(BillingService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getOrCreateBillingUser', () => {
        it('should return existing billing user', async () => {
            const mockUser = {
                id: 'billing-user-1',
                userId: 'user-1',
                balance: 100,
                currency: 'USD',
            };

            mockPrismaService.billingUser.findUnique.mockResolvedValue(mockUser);

            const result = await service.getOrCreateBillingUser('user-1');

            expect(result).toEqual(mockUser);
            expect(mockPrismaService.billingUser.findUnique).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
            });
        });

        it('should create new billing user if not exists', async () => {
            const mockUser = {
                id: 'billing-user-1',
                userId: 'user-1',
                balance: 0,
                currency: 'USD',
            };

            mockPrismaService.billingUser.findUnique.mockResolvedValue(null);
            mockPrismaService.billingUser.create.mockResolvedValue(mockUser);

            const result = await service.getOrCreateBillingUser('user-1');

            expect(result).toEqual(mockUser);
            expect(mockPrismaService.billingUser.create).toHaveBeenCalledWith({
                data: {
                    userId: 'user-1',
                    balance: 0,
                    currency: 'USD',
                },
            });
        });
    });

    describe('updateBalance', () => {
        it('should update user balance', async () => {
            const mockUser = {
                id: 'billing-user-1',
                userId: 'user-1',
                balance: 150,
                currency: 'USD',
            };

            mockPrismaService.billingUser.update.mockResolvedValue(mockUser);

            const result = await service.updateBalance('billing-user-1', 50);

            expect(result).toEqual(mockUser);
            expect(mockPrismaService.billingUser.update).toHaveBeenCalledWith({
                where: { id: 'billing-user-1' },
                data: {
                    balance: {
                        increment: 50,
                    },
                },
            });
        });
    });

    describe('createSubscription', () => {
        it('should create a subscription', async () => {
            const mockSubscription = {
                id: 'sub-1',
                billingUserId: 'billing-user-1',
                planId: 'plan-1',
                status: 'ACTIVE',
            };

            mockPrismaService.subscription.create.mockResolvedValue(mockSubscription);

            const result = await service.createSubscription({
                billingUserId: 'billing-user-1',
                planId: 'plan-1',
                status: 'ACTIVE',
            });

            expect(result).toEqual(mockSubscription);
        });
    });

    describe('getActiveSubscriptionByUserId', () => {
        it('should return active subscription for user', async () => {
            const mockUser = {
                id: 'billing-user-1',
                userId: 'user-1',
                balance: 100,
                currency: 'USD',
            };

            const mockSubscription = {
                id: 'sub-1',
                billingUserId: 'billing-user-1',
                status: 'ACTIVE',
            };

            mockPrismaService.billingUser.findUnique.mockResolvedValue(mockUser);
            mockPrismaService.subscription.findFirst.mockResolvedValue(mockSubscription);

            const result = await service.getActiveSubscriptionByUserId('user-1');

            expect(result).toEqual(mockSubscription);
        });
    });

    describe('checkBalanceLow', () => {
        it('should return true if balance is below threshold', async () => {
            const mockUser = {
                id: 'billing-user-1',
                userId: 'user-1',
                balance: 5,
                currency: 'USD',
            };

            mockPrismaService.billingUser.findUnique.mockResolvedValue(mockUser);

            const result = await service.checkBalanceLow('user-1', 10);

            expect(result).toBe(true);
        });

        it('should return false if balance is above threshold', async () => {
            const mockUser = {
                id: 'billing-user-1',
                userId: 'user-1',
                balance: 20,
                currency: 'USD',
            };

            mockPrismaService.billingUser.findUnique.mockResolvedValue(mockUser);

            const result = await service.checkBalanceLow('user-1', 10);

            expect(result).toBe(false);
        });
    });
});
