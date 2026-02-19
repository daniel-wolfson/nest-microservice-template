import { CreateSubscriptionHandler } from './create-subscription.handler';
import { CancelSubscriptionHandler } from './cancel-subscription.handler';
import { DepositHandler } from './deposit.handler';
import { WithdrawHandler } from './withdraw.handler';
import { CreateInvoiceHandler } from './create-invoice.handler';
import { TravelBookingHandler } from './book-travel.handler';

export const CommandHandlers = [
    CreateSubscriptionHandler,
    CancelSubscriptionHandler,
    DepositHandler,
    WithdrawHandler,
    CreateInvoiceHandler,
    TravelBookingHandler,
];
