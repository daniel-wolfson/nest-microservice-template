# Quick Start Guide - Billing Module

Get up and running with the billing module in 5 minutes!

## Prerequisites

-   ✅ Node.js installed
-   ✅ PostgreSQL running
-   ✅ RabbitMQ running (Docker recommended)
-   ✅ Stripe test account

## Quick Setup

### 1. Start RabbitMQ (30 seconds)

```bash
cd docker/microservice-template
docker-compose -f docker-compose.rabbitmq.yml up -d
```

### 2. Configure Environment (1 minute)

Create `.env` file:

```env
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
RABBITMQ_HOST=localhost
DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
```

Get Stripe keys from: https://dashboard.stripe.com/test/apikeys

### 3. Setup Database (1 minute)

Copy Prisma models from `src/modules/billing/prisma/schema.prisma` to your main schema, then:

```bash
npx prisma generate
npx prisma migrate dev --name billing_module
```

### 4. Install Dependencies (1 minute)

```bash
npm install @nestjs/cqrs @nestjs/microservices stripe
```

### 5. Import Module (30 seconds)

Update `src/modules/app.module.ts`:

```typescript
import { BillingModule } from './billing/billing.module';

@Module({
    imports: [
        BillingModule,
        // ... other modules
    ],
})
export class AppModule {}
```

### 6. Start Application (30 seconds)

```bash
npm run start:dev
```

## Test It Out!

### Check Balance

```bash
curl http://localhost:3000/billing/test-user/balance
```

Expected response:

```json
{
    "userId": "test-user",
    "balance": 0,
    "currency": "USD"
}
```

### Create Test Subscription

```bash
curl -X POST http://localhost:3000/billing/subscription/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "planId": "premium",
    "paymentMethodId": "pm_card_visa"
  }'
```

### Deposit Funds

```bash
curl -X POST http://localhost:3000/billing/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "amount": 100
  }'
```

## Stripe Test Cards

Use these for testing:

| Card          | Number              | Result       |
| ------------- | ------------------- | ------------ |
| Visa          | 4242 4242 4242 4242 | ✅ Success   |
| Decline       | 4000 0000 0000 0002 | ❌ Declined  |
| Requires Auth | 4000 0027 6000 3184 | 🔐 3D Secure |

Any future date and 3-digit CVC works for test cards.

## Setup Stripe Webhooks (Optional)

For local development:

```bash
# Install Stripe CLI
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/billing/webhook/stripe

# Copy the webhook secret shown and add to .env
```

## Seed Test Plans (Optional)

Create test subscription plans:

```bash
npx ts-node -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

prisma.plan.createMany({
  data: [
    {
      name: 'Basic',
      description: 'Basic plan',
      amount: 9.99,
      currency: 'USD',
      interval: 'month',
      isActive: true,
    },
    {
      name: 'Premium',
      description: 'Premium plan',
      amount: 29.99,
      currency: 'USD',
      interval: 'month',
      trialPeriodDays: 14,
      isActive: true,
    },
  ],
}).then(() => console.log('Plans created!'));
"
```

## What's Next?

1. 📖 Read [README.md](./README.md) for full documentation
2. 🔧 Check [INSTALLATION.md](./INSTALLATION.md) for detailed setup
3. 📝 See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for architecture
4. 🧪 Run tests: `npm test billing`
5. 📊 Access RabbitMQ UI: http://localhost:15672 (admin/123456)
6. 🎨 Add Swagger: Import `@nestjs/swagger` and add decorators

## Common Issues

### "Cannot connect to RabbitMQ"

```bash
docker-compose -f docker-compose.rabbitmq.yml restart
```

### "Prisma Client not generated"

```bash
npx prisma generate
```

### "Stripe signature verification failed"

-   Check webhook secret in `.env`
-   Use Stripe CLI for local testing
-   Verify endpoint URL in Stripe dashboard

### "Module '@/providers/prisma' not found"

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

## Support

-   📧 Contact development team
-   📚 Check NestJS documentation
-   💬 Review test files for examples
-   🐛 Check GitHub issues

## Success! 🎉

Your billing module is now ready! You can:

-   ✅ Accept payments via Stripe
-   ✅ Manage subscriptions
-   ✅ Track user balances
-   ✅ Generate invoices
-   ✅ Handle webhooks
-   ✅ Process transactions with state machine
-   ✅ Integrate with other microservices via RabbitMQ

Happy coding! 💻
