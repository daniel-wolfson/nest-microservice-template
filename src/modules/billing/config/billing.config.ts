import { registerAs } from '@nestjs/config';

export default registerAs('billing', () => ({
    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    yookassa: {
        shopId: process.env.YOOKASSA_SHOP_ID,
        secretKey: process.env.YOOKASSA_SECRET_KEY,
    },
    currency: process.env.BILLING_CURRENCY || 'USD',
    lowBalanceThreshold: parseInt(process.env.BILLING_LOW_BALANCE_THRESHOLD || '10', 10),
    invoiceDueDays: parseInt(process.env.BILLING_INVOICE_DUE_DAYS || '7', 10),
    rabbitmq: {
        host: process.env.RABBITMQ_HOST || 'localhost',
        port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
        user: process.env.RABBITMQ_DEFAULT_USER || 'admin',
        password: process.env.RABBITMQ_DEFAULT_PASS || '123456',
    },
}));
