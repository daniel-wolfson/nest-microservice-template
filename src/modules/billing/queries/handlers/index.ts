import { GetBalanceHandler } from './get-balance.handler';
import { GetInvoicesHandler } from './get-invoices.handler';
import { GetSubscriptionHandler } from './get-subscription.handler';
import { GetTransactionsHandler } from './get-transactions.handler';

export const QueryHandlers = [GetBalanceHandler, GetInvoicesHandler, GetSubscriptionHandler, GetTransactionsHandler];
