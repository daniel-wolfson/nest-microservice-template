# Billing Module Installation Guide

## Prerequisites

-   Node.js 18+
-   PostgreSQL 14+
-   RabbitMQ 3.11+
-   Stripe Account (for payment processing)

## Step-by-Step Installation

### 1. Install Required Packages

```bash
npm install --save @nestjs/cqrs @nestjs/microservices stripe @nestjs/config
npm install --save class-validator class-transformer
npm install --save-dev @types/node
```

### 2. Database Setup

#### Add Prisma Models

Open your `prisma/schema.prisma` and add the billing models from `src/modules/billing/prisma/schema.prisma`.

#### Generate Prisma Client

```bash
npx prisma generate
```

#### Create Migration

```bash
npx prisma migrate dev --name add_billing_module
```

#### Apply Migration

```bash
npx prisma migrate deploy
```

### 3. Environment Configuration

Create or update `.env` file:

```env
# Copy from src/modules/billing/.env.example
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_PUBLISHABLE_KEY=pk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...

RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_DEFAULT_USER=admin
RABBITMQ_DEFAULT_PASS=123456

DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
```

### 4. RabbitMQ Setup

#### Using Docker (Recommended)

Navigate to docker compose file:

```bash
cd docker/microservice-template
docker-compose -f docker-compose.rabbitmq.yml up -d
```

#### Verify RabbitMQ

Access RabbitMQ Management UI:

-   URL: http://localhost:15672
-   Username: admin
-   Password: 123456

### 5. Stripe Configuration

#### Get API Keys

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy Secret Key to `STRIPE_SECRET_KEY`
3. Copy Publishable Key to `STRIPE_PUBLISHABLE_KEY`

#### Setup Webhook

##### For Local Development (Stripe CLI)

```bash
# Install Stripe CLI
# Windows (with Scoop)
scoop install stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/billing/webhook/stripe

# Copy webhook secret to .env
# Output will show: whsec_...
```

##### For Production

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter: `https://yourdomain.com/billing/webhook/stripe`
4. Select events:
    - `payment_intent.succeeded`
    - `payment_intent.payment_failed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_succeeded`
    - `invoice.payment_failed`
5. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

### 6. Import Billing Module

Update your `src/modules/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingModule } from './billing/billing.module';
import billingConfig from './billing/config/billing.config';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [billingConfig],
        }),
        BillingModule,
        // ... other modules
    ],
})
export class AppModule {}
```

### 7. Seed Initial Data

Create a seed script `prisma/seed-billing.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Create sample plans
    await prisma.plan.createMany({
        data: [
            {
                name: 'Basic Plan',
                description: 'Basic features',
                stripePriceId: 'price_basic_monthly',
                amount: 9.99,
                currency: 'USD',
                interval: 'month',
                intervalCount: 1,
                isActive: true,
            },
            {
                name: 'Premium Plan',
                description: 'All features included',
                stripePriceId: 'price_premium_monthly',
                amount: 29.99,
                currency: 'USD',
                interval: 'month',
                intervalCount: 1,
                trialPeriodDays: 14,
                isActive: true,
            },
        ],
    });

    console.log('Billing data seeded successfully');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
```

Run the seed:

```bash
npx ts-node prisma/seed-billing.ts
```

### 8. Start Application

```bash
npm run start:dev
```

### 9. Verify Installation

#### Health Check

```bash
curl http://localhost:3000/health
```

#### Test Endpoints

```bash
# Get balance (should create billing user automatically)
curl http://localhost:3000/billing/user-123/balance

# Response:
# {
#   "userId": "user-123",
#   "balance": 0,
#   "currency": "USD"
# }
```

### 10. Test Payment Flow

#### Create Test Payment

```bash
curl -X POST http://localhost:3000/billing/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "amount": 100,
    "paymentMethodId": "pm_card_visa"
  }'
```

Use Stripe test cards:

-   Success: `pm_card_visa` or `4242 4242 4242 4242`
-   Decline: `pm_card_chargeDeclinedInsufficientFunds`

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
npx prisma studio
```

### RabbitMQ Connection Issues

```bash
# Check RabbitMQ status
docker ps | grep rabbitmq

# View RabbitMQ logs
docker logs rabbitmq
```

### Stripe Webhook Issues

```bash
# Check webhook signing secret
stripe listen --print-secret

# Test webhook
stripe trigger payment_intent.succeeded
```

### Module Import Issues

If you get import errors, ensure:

1. All dependencies are installed: `npm install`
2. TypeScript is compiled: `npm run build`
3. Path aliases are configured in `tsconfig.json`

### Common Errors

#### "Module not found: @/providers/prisma"

Update `tsconfig.json`:

```json
{
    "compilerOptions": {
        "paths": {
            "@/*": ["src/*"]
        }
    }
}
```

#### "Cannot find module 'stripe'"

```bash
npm install stripe
```

#### "ECONNREFUSED" (RabbitMQ)

Start RabbitMQ:

```bash
docker-compose -f docker-compose.rabbitmq.yml up -d
```

## Next Steps

1. Configure Swagger documentation
2. Set up monitoring and logging
3. Configure Redis for caching
4. Set up BullMQ for background jobs
5. Implement PDF invoice generation
6. Add unit and integration tests

## Support

For additional help:

-   Check the main README.md
-   Review test files for usage examples
-   Consult NestJS documentation
-   Contact the development team
