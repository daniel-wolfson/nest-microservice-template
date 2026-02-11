import { SubscriptionCreatedHandler } from './subscription-created.handler';
import { SubscriptionCanceledHandler } from './subscription-canceled.handler';
import { PaymentSuccessHandler } from './payment-success.handler';
import { UserBalanceLowHandler } from './user-balance-low.handler';
import { OrderCreatedHandler } from './order-created.handler';

export const EventHandlers = [
    SubscriptionCreatedHandler,
    SubscriptionCanceledHandler,
    PaymentSuccessHandler,
    UserBalanceLowHandler,
    OrderCreatedHandler,
];
