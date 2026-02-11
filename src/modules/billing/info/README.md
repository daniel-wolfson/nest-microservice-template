# Billing Module

Comprehensive NestJS billing service for SaaS applications with subscription management, payment processing, and invoice generation.

## Features

-   **Subscription Management**: Create, update, and cancel subscriptions via Stripe
-   **Payment Processing**: Handle one-time payments and recurring billing
-   **Virtual Accounts**: Prepaid balance system for users
-   **Invoice Generation**: Automated invoice creation and tracking
-   **Transaction State Machine**: Robust state management for payment flows
-   **Event-Driven Architecture**: RabbitMQ integration for microservices communication
-   **CQRS Pattern**: Command and Query separation for scalability

## Architecture

### Core Components

1. **BillingService**: Core business logic for billing operations
2. **StripeService**: Stripe API integration and webhook handling
3. **VirtualAccountService**: Prepaid account management
4. **InvoiceService**: Invoice generation and PDF creation
5. **TransactionStateMachine**: State machine for transaction lifecycle

### State Machine

Transaction states flow:

```
CREATED → PROCESSING → COMPLETED
             ↓
           ERROR → PROCESSING (retry)
             ↓
         CANCELED
```

## Installation

### 1. Install Dependencies

```bash
npm install stripe @nestjs/cqrs @nestjs/microservices class-validator class-transformer
```

### 2. Configure Environment Variables

Copy `.env.example` and configure:

```bash
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
```

### 3. Setup Prisma Schema

Add the models from `prisma/schema.prisma` to your main Prisma schema file:

```bash
npx prisma generate
npx prisma migrate dev --name add_billing_tables
```

### 4. Import Module

```typescript
import { BillingModule } from './modules/billing/billing.module';

@Module({
    imports: [BillingModule],
})
export class AppModule {}
```

## API Endpoints

### Subscriptions

#### Create Subscription

```http
POST /billing/subscription/create
Content-Type: application/json

{
  "userId": "user-123",
  "planId": "plan-premium",
  "paymentMethodId": "pm_card_123"
}
```

#### Cancel Subscription

```http
POST /billing/subscription/{id}/cancel
```

### Balance Operations

#### Get Balance

```http
GET /billing/{userId}/balance
```

#### Deposit Funds

```http
POST /billing/deposit
Content-Type: application/json

{
  "userId": "user-123",
  "amount": 100,
  "paymentMethodId": "pm_card_123"
}
```

#### Withdraw Funds

```http
POST /billing/withdraw
Content-Type: application/json

{
  "userId": "user-123",
  "amount": 50,
  "destination": "bank_account_123"
}
```

### Invoices

#### Get User Invoices

```http
GET /billing/invoices/{userId}
```

### Webhooks

#### Stripe Webhook

```http
POST /billing/webhook/stripe
```

## Message Patterns (RabbitMQ)

### Incoming Events

-   `order.created` → Creates invoice for order
-   `user.created` → Initializes billing user
-   `subscription.payment.failed` → Handles payment failures

### Outgoing Events

-   `subscription.created` → Notifies when subscription is created
-   `subscription.canceled` → Notifies when subscription is canceled
-   `payment.success` → Sends receipt via notification service
-   `user.balance.low` → Warns user about low balance
-   `user.subscription.activated` → Updates auth service

## Event Flow Examples

### 1. Order Created → Invoice Generated

```
Orders Service → order.created
              ↓
       Billing Service → CreateInvoiceCommand
              ↓
       Invoice Created → invoice.created
              ↓
  Notification Service → Email invoice
```

### 2. Payment Success → Notification

```
Stripe Webhook → payment.success
              ↓
       Billing Service → Updates balance
              ↓
       PaymentSuccessEvent
              ↓
  Notification Service → Send receipt
```

### 3. Subscription Failure → User Downgrade

```
Stripe Webhook → subscription.payment.failed
              ↓
       Billing Service → subscription.failed
              ↓
         Auth Service → Downgrade permissions
```

## Testing

### Run Unit Tests

```bash
npm test billing.service.spec
npm test transaction.state-machine.spec
npm test create-subscription.handler.spec
```

### Run Integration Tests

```bash
npm test billing.controller.spec
```

### Run All Billing Tests

```bash
npm test -- billing
```

## Stripe Webhook Setup

1. Install Stripe CLI:

```bash
stripe login
```

2. Forward webhooks to local:

```bash
stripe listen --forward-to localhost:3000/billing/webhook/stripe
```

3. Get webhook secret and add to `.env`

## Database Schema

### Key Tables

-   **BillingUser**: User billing profile with balance
-   **Subscription**: User subscriptions with Stripe integration
-   **Transaction**: Payment transactions with state machine
-   **Invoice**: Generated invoices for payments
-   **VirtualAccount**: Prepaid user accounts
-   **Plan**: Available subscription plans

## Transaction Idempotency

All payment operations support idempotency keys to prevent duplicate charges:

```typescript
await commandBus.execute(
    new DepositCommand(userId, amount, paymentMethodId, {
        idempotencyKey: 'unique-key-123',
    }),
);
```

## Error Handling

Global exception filter handles:

-   Insufficient balance errors
-   Stripe API errors
-   Invalid state transitions
-   Webhook signature validation

## Monitoring

Key metrics to track:

-   Successful/failed transactions
-   Subscription churn rate
-   Average transaction value
-   Low balance warnings
-   Payment method failures

## Security

-   Stripe webhook signature verification
-   Idempotency key validation
-   Transaction state machine prevents invalid transitions
-   Balance checks before withdrawals

## Future Enhancements

-   [ ] YooKassa payment gateway integration
-   [ ] Redis caching for subscription status
-   [ ] BullMQ for background job processing
-   [ ] PDF invoice generation with templates
-   [ ] Multi-currency support
-   [ ] Refund processing
-   [ ] Proration for plan changes
-   [ ] Usage-based billing

## Support

For issues or questions, contact the development team or check the main project documentation.
