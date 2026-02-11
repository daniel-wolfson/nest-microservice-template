import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { BillingController } from '../../src/modules/billing/billing.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateSubscriptionDto } from '../../src/modules/billing/dto/create-subscription.dto';
import { DepositDto } from '../../src/modules/billing/dto/deposit.dto';

describe('BillingController (Integration)', () => {
    let app: INestApplication;
    let controller: BillingController;
    let commandBus: CommandBus;
    let queryBus: QueryBus;

    const mockCommandBus = {
        execute: jest.fn(),
    };

    const mockQueryBus = {
        execute: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [BillingController],
            providers: [
                {
                    provide: CommandBus,
                    useValue: mockCommandBus,
                },
                {
                    provide: QueryBus,
                    useValue: mockQueryBus,
                },
            ],
        }).compile();

        app = module.createNestApplication();
        await app.init();

        controller = module.get<BillingController>(BillingController);
        commandBus = module.get<CommandBus>(CommandBus);
        queryBus = module.get<QueryBus>(QueryBus);
    });

    afterEach(async () => {
        await app.close();
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createSubscription', () => {
        it('should create subscription', async () => {
            const dto: CreateSubscriptionDto = {
                userId: 'user-1',
                planId: 'plan-1',
                paymentMethodId: 'pm_123',
            };

            const mockResult = {
                id: 'sub-1',
                userId: 'user-1',
                planId: 'plan-1',
                status: 'ACTIVE',
            };

            mockCommandBus.execute.mockResolvedValue(mockResult);

            const result = await controller.createSubscription(dto);

            expect(result).toEqual(mockResult);
            expect(mockCommandBus.execute).toHaveBeenCalled();
        });
    });

    describe('getBalance', () => {
        it('should return user balance', async () => {
            const mockBalance = {
                userId: 'user-1',
                balance: 100,
                currency: 'USD',
            };

            mockQueryBus.execute.mockResolvedValue(mockBalance);

            const result = await controller.getBalance('user-1');

            expect(result).toEqual(mockBalance);
            expect(mockQueryBus.execute).toHaveBeenCalled();
        });
    });

    describe('deposit', () => {
        it('should process deposit', async () => {
            const dto: DepositDto = {
                userId: 'user-1',
                amount: 50,
                paymentMethodId: 'pm_123',
            };

            const mockTransaction = {
                id: 'txn-1',
                userId: 'user-1',
                amount: 50,
                status: 'COMPLETED',
            };

            mockCommandBus.execute.mockResolvedValue(mockTransaction);

            const result = await controller.deposit(dto);

            expect(result).toEqual(mockTransaction);
            expect(mockCommandBus.execute).toHaveBeenCalled();
        });
    });

    describe('getInvoices', () => {
        it('should return user invoices', async () => {
            const mockInvoices = [
                {
                    id: 'inv-1',
                    userId: 'user-1',
                    amount: 100,
                    status: 'PAID',
                },
                {
                    id: 'inv-2',
                    userId: 'user-1',
                    amount: 50,
                    status: 'OPEN',
                },
            ];

            mockQueryBus.execute.mockResolvedValue(mockInvoices);

            const result = await controller.getInvoices('user-1');

            expect(result).toEqual(mockInvoices);
            expect(mockQueryBus.execute).toHaveBeenCalled();
        });
    });
});
