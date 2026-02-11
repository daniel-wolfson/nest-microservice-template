# Billing Module Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     External Services                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │  Stripe  │    │ YooKassa │    │  Client  │                  │
│  │   API    │    │   API    │    │   App    │                  │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘                  │
│       │ webhooks      │ webhooks       │ REST API                │
└───────┼───────────────┼────────────────┼─────────────────────────┘
        │               │                │
        ▼               ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Billing Module (NestJS)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │   REST API     │  │    Webhooks    │  │  Message Queue   │  │
│  │  Controllers   │  │   Controller   │  │   Controller     │  │
│  └───────┬────────┘  └───────┬────────┘  └────────┬─────────┘  │
│          │                   │                     │             │
│          └───────────────────┼─────────────────────┘             │
│                              ▼                                   │
│              ┌───────────────────────────┐                       │
│              │     Command Bus (CQRS)    │                       │
│              ├───────────────────────────┤                       │
│              │    CreateSubscription     │                       │
│              │    CancelSubscription     │                       │
│              │    Deposit / Withdraw     │                       │
│              │    CreateInvoice          │                       │
│              └────────────┬──────────────┘                       │
│                           ▼                                      │
│          ┌────────────────────────────────────┐                 │
│          │         Command Handlers           │                 │
│          └──────────┬─────────────────────────┘                 │
│                     ▼                                            │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Core Services                            │       │
│  ├──────────────────────────────────────────────────────┤       │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │       │
│  │  │  Billing   │  │   Stripe   │  │  Virtual   │     │       │
│  │  │  Service   │  │  Service   │  │  Account   │     │       │
│  │  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘     │       │
│  │         │                │                │           │       │
│  │  ┌──────┴─────┐  ┌──────┴─────┐                     │       │
│  │  │  Invoice   │  │Transaction │                     │       │
│  │  │  Service   │  │State Machine│                    │       │
│  │  └────────────┘  └────────────┘                     │       │
│  └────────────────────┬─────────────────────────────────┘       │
│                       ▼                                          │
│          ┌────────────────────────────┐                         │
│          │      Event Bus (CQRS)      │                         │
│          ├────────────────────────────┤                         │
│          │  SubscriptionCreated       │                         │
│          │  PaymentSuccess            │                         │
│          │  BalanceLow                │                         │
│          │  OrderCreated              │                         │
│          └──────────┬─────────────────┘                         │
│                     ▼                                            │
│          ┌────────────────────────────┐                         │
│          │      Event Handlers        │                         │
│          └──────────┬─────────────────┘                         │
│                     │                                            │
└─────────────────────┼──────────────────────────────────────────┘
                      ▼
        ┌─────────────────────────────┐
        │    RabbitMQ Message Bus     │
        └──────┬──────────────────────┘
               │
     ┌─────────┴─────────┬──────────────┬─────────────┐
     ▼                   ▼              ▼             ▼
┌─────────┐      ┌──────────┐   ┌──────────┐  ┌──────────┐
│  Auth   │      │  Orders  │   │   Notif  │  │  Other   │
│ Service │      │  Service │   │  Service │  │ Services │
└─────────┘      └──────────┘   └──────────┘  └──────────┘

     ▲                   │              ▲             ▲
     │                   │              │             │
     │                   ▼              │             │
     │          ┌──────────────┐        │             │
     │          │ subscription │        │             │
     └──────────│   .created   ├────────┘             │
                └──────────────┘                      │
                ┌──────────────┐                      │
                │    payment   ├──────────────────────┘
                │   .success   │
                └──────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Data Layer (Prisma + PostgreSQL)              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Billing  │  │Subscrip- │  │Transac-  │  │ Invoice  │       │
│  │  Users   │  │  tions   │  │  tions   │  │          │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │ Virtual  │  │ Payment  │  │  Plans   │                     │
│  │ Accounts │  │ Methods  │  │          │                     │
│  └──────────┘  └──────────┘  └──────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

## Message Flow Examples

### 1. Create Subscription Flow

```
Client → POST /billing/subscription/create
         ↓
    BillingController
         ↓
    CreateSubscriptionCommand → CommandBus
         ↓
    CreateSubscriptionHandler
         ↓
    ┌─────────────────────┐
    │ 1. Get/Create User  │ → BillingService
    ├─────────────────────┤
    │ 2. Get Plan         │ → BillingService
    ├─────────────────────┤
    │ 3. Create Stripe    │ → StripeService
    │    Subscription     │
    ├─────────────────────┤
    │ 4. Save to DB       │ → Prisma
    ├─────────────────────┤
    │ 5. Publish Event    │ → EventBus
    └─────────────────────┘
         ↓
    SubscriptionCreatedEvent
         ↓
    SubscriptionCreatedHandler
         ↓
    RabbitMQ → subscription.created
         ↓
    ┌──────────────┬───────────────┐
    ↓              ↓               ↓
Auth Service   Notification   Analytics
(activate)     (send email)   (track)
```

### 2. Payment Webhook Flow

```
Stripe Webhook → POST /billing/webhook/stripe
         ↓
    WebhookController
         ↓
    Verify Signature
         ↓
    StripeService.handleWebhook()
         ↓
    ┌─────────────────────────────┐
    │ payment_intent.succeeded    │
    └──────────┬──────────────────┘
               ↓
    PaymentSuccessEvent → EventBus
         ↓
    PaymentSuccessHandler
         ↓
    RabbitMQ → payment.success
         ↓
    Notification Service
         ↓
    Send Receipt Email
```

### 3. Order Created → Invoice Flow

```
Orders Service → order.created (RabbitMQ)
         ↓
    BillingMessageController
         ↓
    OrderCreatedEvent → EventBus
         ↓
    OrderCreatedHandler
         ↓
    CreateInvoiceCommand → CommandBus
         ↓
    CreateInvoiceHandler
         ↓
    InvoiceService
         ↓
    ┌─────────────────────┐
    │ 1. Generate Number  │
    ├─────────────────────┤
    │ 2. Create Invoice   │
    ├─────────────────────┤
    │ 3. Save to DB       │
    ├─────────────────────┤
    │ 4. Publish Event    │
    └─────────────────────┘
         ↓
    InvoiceCreatedEvent
         ↓
    RabbitMQ → invoice.created
         ↓
    Notification Service → Send Invoice
```

### 4. Deposit Transaction State Machine

```
POST /billing/deposit
         ↓
    DepositCommand
         ↓
    DepositHandler
         ↓
    ┌─────────────────────────────────────┐
    │ State: CREATED                       │
    │ Create transaction record            │
    └──────────┬──────────────────────────┘
               ↓
    StateMachine.transition(PROCESSING)
         ↓
    ┌─────────────────────────────────────┐
    │ State: PROCESSING                    │
    │ Create Stripe PaymentIntent          │
    └──────────┬──────────────────────────┘
               ↓
    ┌─────────┴─────────┐
    │ Payment Succeeded? │
    └─────────┬─────────┘
              ↓ YES
    Update Balance
         ↓
    StateMachine.transition(COMPLETED)
         ↓
    ┌─────────────────────────────────────┐
    │ State: COMPLETED                     │
    │ completedAt = now()                  │
    └──────────┬──────────────────────────┘
               ↓
    DepositCompletedEvent
         ↓
    RabbitMQ → Notification
```

## Technology Stack

```
┌─────────────────────────────────────────┐
│         Application Layer                │
├─────────────────────────────────────────┤
│ NestJS 10+                               │
│ TypeScript                               │
│ @nestjs/cqrs (CQRS Pattern)             │
│ @nestjs/microservices (RabbitMQ)        │
│ class-validator (Validation)            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         Integration Layer                │
├─────────────────────────────────────────┤
│ Stripe SDK (Payments)                    │
│ RabbitMQ (Message Queue)                │
│ Prisma ORM (Database)                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          Data Layer                      │
├─────────────────────────────────────────┤
│ PostgreSQL (Primary Database)           │
│ Redis (Caching - Future)                │
└─────────────────────────────────────────┘
```

## Key Design Patterns

1. **CQRS (Command Query Responsibility Segregation)**

    - Commands: Write operations
    - Queries: Read operations
    - Event Bus: Async communication

2. **Event-Driven Architecture**

    - Domain events for business logic
    - Event handlers for side effects
    - RabbitMQ for inter-service messaging

3. **State Machine Pattern**

    - Transaction lifecycle management
    - Valid transition enforcement
    - Audit trail and recovery

4. **Repository Pattern**

    - Data access abstraction
    - Service layer for business logic
    - Prisma for ORM

5. **Microservices Architecture**
    - Self-contained billing module
    - Message queue integration
    - Loosely coupled services

## Security Layers

```
┌──────────────────────────────────────┐
│  Stripe Webhook Verification         │ ← Signature check
├──────────────────────────────────────┤
│  Input Validation (class-validator)  │ ← DTO validation
├──────────────────────────────────────┤
│  Idempotency Keys                    │ ← Duplicate prevention
├──────────────────────────────────────┤
│  State Machine                       │ ← Valid transitions
├──────────────────────────────────────┤
│  Balance Checks                      │ ← Sufficient funds
├──────────────────────────────────────┤
│  Database Transactions               │ ← ACID compliance
└──────────────────────────────────────┘
```

## Scalability Considerations

-   **Horizontal Scaling**: Stateless services
-   **Message Queue**: Async processing
-   **Event-Driven**: Decoupled services
-   **Caching Ready**: Redis integration points
-   **Database Indexes**: Optimized queries
-   **Connection Pooling**: Prisma managed

## Monitoring Points

-   Transaction state changes
-   Payment successes/failures
-   Subscription lifecycle events
-   Balance threshold alerts
-   Webhook processing
-   API response times
-   Queue message processing

This architecture provides a solid foundation for a production-ready billing system with room for future enhancements!
