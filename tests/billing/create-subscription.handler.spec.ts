import { Test, TestingModule } from '@nestjs/testing';
import { CreateSubscriptionHandler } from '@/modules/billing/commands/handlers/create-subscription.handler';
import { CreateSubscriptionCommand } from '@/modules/billing/commands/impl/create-subscription.command';
import { StripeService } from '@/modules/billing/services/stripe.service';
import { BillingService } from '@/modules/billing/services/billing.service';
import { EventBus } from '@nestjs/cqrs';

describe('CreateSubscriptionHandler', () => {
    let handler: CreateSubscriptionHandler;
    let stripeService: StripeService;
    let billingService: BillingService;
    let eventBus: EventBus;

    const mockStripeService = {
        createSubscription: jest.fn(),
    };

    const mockBillingService = {
        getOrCreateBillingUser: jest.fn(),
        getPlan: jest.fn(),
        createSubscription: jest.fn(),
    };

    const mockEventBus = {
        publish: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CreateSubscriptionHandler,
                {
                    provide: StripeService,
                    useValue: mockStripeService,
                },
                {
                    provide: BillingService,
                    useValue: mockBillingService,
                },
                {
                    provide: EventBus,
                    useValue: mockEventBus,
                },
            ],
        }).compile();

        handler = module.get<CreateSubscriptionHandler>(CreateSubscriptionHandler);
        stripeService = module.get<StripeService>(StripeService);
        billingService = module.get<BillingService>(BillingService);
        eventBus = module.get<EventBus>(EventBus);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should create subscription successfully', async () => {
        const command = new CreateSubscriptionCommand('user-1', 'plan-1', 'pm_123');

        const mockBillingUser = {
            id: 'billing-user-1',
            userId: 'user-1',
            customerId: 'cus_123',
            balance: 0,
        };

        const mockPlan = {
            id: 'plan-1',
            name: 'Premium Plan',
            stripePriceId: 'price_123',
        };

        const mockStripeSubscription = {
            id: 'sub_123',
            status: 'active',
            current_period_start: 1234567890,
            current_period_end: 1234567890,
        };

        const mockSubscription = {
            id: 'subscription-1',
            billingUserId: 'billing-user-1',
            stripeSubscriptionId: 'sub_123',
            planId: 'plan-1',
            status: 'ACTIVE',
        };

        mockBillingService.getOrCreateBillingUser.mockResolvedValue(mockBillingUser);
        mockBillingService.getPlan.mockResolvedValue(mockPlan);
        mockStripeService.createSubscription.mockResolvedValue(mockStripeSubscription);
        mockBillingService.createSubscription.mockResolvedValue(mockSubscription);

        const result = await handler.execute(command);

        expect(result).toEqual(mockSubscription);
        expect(mockBillingService.getOrCreateBillingUser).toHaveBeenCalledWith('user-1');
        expect(mockBillingService.getPlan).toHaveBeenCalledWith('plan-1');
        expect(mockStripeService.createSubscription).toHaveBeenCalled();
        expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should throw error if plan not found', async () => {
        const command = new CreateSubscriptionCommand('user-1', 'invalid-plan', 'pm_123');

        const mockBillingUser = {
            id: 'billing-user-1',
            userId: 'user-1',
            customerId: 'cus_123',
            balance: 0,
        };

        mockBillingService.getOrCreateBillingUser.mockResolvedValue(mockBillingUser);
        mockBillingService.getPlan.mockResolvedValue(null);

        await expect(handler.execute(command)).rejects.toThrow('Plan invalid-plan not found');
    });
});
