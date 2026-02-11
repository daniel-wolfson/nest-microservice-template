import { Test, TestingModule } from '@nestjs/testing';
import {
    TransactionStateMachine,
    TransactionState,
} from '../../src/modules/billing/state-machines/transaction.state-machine';
import { PrismaService } from '@src/modules/prisma/prisma.service';

describe('TransactionStateMachine', () => {
    let stateMachine: TransactionStateMachine;
    let prismaService: PrismaService;

    const mockPrismaService = {
        transaction: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TransactionStateMachine,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        stateMachine = module.get<TransactionStateMachine>(TransactionStateMachine);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(stateMachine).toBeDefined();
    });

    describe('transition', () => {
        it('should successfully transition from CREATED to PROCESSING', async () => {
            const mockTransaction = {
                id: 'txn-1',
                state: TransactionState.CREATED,
                status: 'PENDING',
            };

            mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);
            mockPrismaService.transaction.update.mockResolvedValue({
                ...mockTransaction,
                state: TransactionState.PROCESSING,
                status: 'PROCESSING',
            });

            const result = await stateMachine.transition('txn-1', TransactionState.PROCESSING);

            expect(result).toBe(true);
            expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
                where: { id: 'txn-1' },
                data: expect.objectContaining({
                    state: TransactionState.PROCESSING,
                    status: 'PROCESSING',
                }),
            });
        });

        it('should successfully transition from PROCESSING to COMPLETED', async () => {
            const mockTransaction = {
                id: 'txn-1',
                state: TransactionState.PROCESSING,
                status: 'PROCESSING',
            };

            mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);
            mockPrismaService.transaction.update.mockResolvedValue({
                ...mockTransaction,
                state: TransactionState.COMPLETED,
                status: 'COMPLETED',
            });

            const result = await stateMachine.transition('txn-1', TransactionState.COMPLETED);

            expect(result).toBe(true);
        });

        it('should throw error for invalid transition', async () => {
            const mockTransaction = {
                id: 'txn-1',
                state: TransactionState.CREATED,
                status: 'PENDING',
            };

            mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);

            await expect(stateMachine.transition('txn-1', TransactionState.COMPLETED)).rejects.toThrow(
                'Invalid state transition',
            );
        });

        it('should allow transition from ERROR to PROCESSING (retry)', async () => {
            const mockTransaction = {
                id: 'txn-1',
                state: TransactionState.ERROR,
                status: 'FAILED',
            };

            mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);
            mockPrismaService.transaction.update.mockResolvedValue({
                ...mockTransaction,
                state: TransactionState.PROCESSING,
                status: 'PROCESSING',
            });

            const result = await stateMachine.transition('txn-1', TransactionState.PROCESSING);

            expect(result).toBe(true);
        });
    });

    describe('getNextStates', () => {
        it('should return possible next states from CREATED', () => {
            const nextStates = stateMachine.getNextStates(TransactionState.CREATED);

            expect(nextStates).toContain(TransactionState.PROCESSING);
            expect(nextStates).toContain(TransactionState.CANCELED);
        });

        it('should return possible next states from PROCESSING', () => {
            const nextStates = stateMachine.getNextStates(TransactionState.PROCESSING);

            expect(nextStates).toContain(TransactionState.COMPLETED);
            expect(nextStates).toContain(TransactionState.ERROR);
            expect(nextStates).toContain(TransactionState.CANCELED);
        });
    });

    describe('canTransitionTo', () => {
        it('should return true for valid transition', () => {
            const result = stateMachine.canTransitionTo(TransactionState.CREATED, TransactionState.PROCESSING);

            expect(result).toBe(true);
        });

        it('should return false for invalid transition', () => {
            const result = stateMachine.canTransitionTo(TransactionState.CREATED, TransactionState.COMPLETED);

            expect(result).toBe(false);
        });
    });
});
