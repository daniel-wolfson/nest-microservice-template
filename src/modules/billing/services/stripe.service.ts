import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';
import { PaymentSuccessEvent } from '../events/impl/payment-success.event';
import { SubscriptionUpdatedEvent } from '../events/impl/subscription-updated.event';

@Injectable()
export class StripeService {
    private readonly logger = new Logger(StripeService.name);
    private readonly stripe: Stripe;

    constructor(private readonly configService: ConfigService, private readonly eventBus: EventBus) {
        const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
        if (!apiKey) {
            this.logger.warn('STRIPE_SECRET_KEY not configured');
        }
        this.stripe = new Stripe(apiKey || 'sk_test_dummy', {
            apiVersion: '2026-01-28.clover', //'2024-11-20.acacia', TODO: ???
        });
    }

    async createCustomer(email: string, name?: string) {
        try {
            const customer = await this.stripe.customers.create({
                email,
                name,
            });
            return customer;
        } catch (error: any) {
            this.logger.error(`Failed to create Stripe customer: ${error.message}`);
            throw error;
        }
    }

    async createSubscription(customerId: string, priceId: string, paymentMethodId?: string) {
        try {
            const subscriptionData: Stripe.SubscriptionCreateParams = {
                customer: customerId,
                items: [{ price: priceId }],
                payment_behavior: 'default_incomplete',
                expand: ['latest_invoice.payment_intent'],
            };

            if (paymentMethodId) {
                subscriptionData.default_payment_method = paymentMethodId;
            }

            const subscription = await this.stripe.subscriptions.create(subscriptionData);
            return subscription;
        } catch (error: any) {
            this.logger.error(`Failed to create Stripe subscription: ${error.message}`);
            throw error;
        }
    }

    async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = false) {
        try {
            if (cancelAtPeriodEnd) {
                return await this.stripe.subscriptions.update(subscriptionId, {
                    cancel_at_period_end: true,
                });
            } else {
                return await this.stripe.subscriptions.cancel(subscriptionId);
            }
        } catch (error: any) {
            this.logger.error(`Failed to cancel Stripe subscription: ${error.message}`);
            throw error;
        }
    }

    async createPaymentIntent(amount: number, customerId: string, paymentMethodId?: string) {
        try {
            const paymentIntentData: Stripe.PaymentIntentCreateParams = {
                amount: Math.round(amount * 100), // Convert to cents
                currency: 'usd',
                customer: customerId,
                automatic_payment_methods: {
                    enabled: true,
                },
            };

            if (paymentMethodId) {
                paymentIntentData.payment_method = paymentMethodId;
                paymentIntentData.confirm = true;
            }

            const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);
            return paymentIntent;
        } catch (error: any) {
            this.logger.error(`Failed to create payment intent: ${error.message}`);
            throw error;
        }
    }

    async handleWebhook(payload: any, signature: string) {
        const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

        if (!webhookSecret) {
            this.logger.error('STRIPE_WEBHOOK_SECRET not configured');
            throw new Error('Webhook secret not configured');
        }

        try {
            const event = this.stripe.webhooks.constructEvent(JSON.stringify(payload), signature, webhookSecret);

            this.logger.log(`Received Stripe webhook: ${event.type}`);

            switch (event.type) {
                case 'payment_intent.succeeded':
                    await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
                    break;

                case 'payment_intent.payment_failed':
                    await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
                    break;

                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
                    break;

                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                    break;

                case 'invoice.payment_succeeded':
                    await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
                    break;

                case 'invoice.payment_failed':
                    await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
                    break;

                default:
                    this.logger.log(`Unhandled event type: ${event.type}`);
            }

            return { received: true };
        } catch (error: any) {
            this.logger.error(`Webhook error: ${error.message}`);
            throw error;
        }
    }

    private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
        this.logger.log(`Payment succeeded: ${paymentIntent.id}`);
        this.eventBus.publish(
            new PaymentSuccessEvent(paymentIntent.id, paymentIntent.customer as string, paymentIntent.amount / 100),
        );
    }

    private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
        this.logger.error(`Payment failed: ${paymentIntent.id}`);
        // Emit payment failed event
    }

    private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
        this.logger.log(`Subscription updated: ${subscription.id}`);
        this.eventBus.publish(
            new SubscriptionUpdatedEvent(subscription.id, subscription.customer as string, subscription.status),
        );
    }

    private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
        this.logger.log(`Subscription deleted: ${subscription.id}`);
        // Handle subscription deletion
    }

    private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
        this.logger.log(`Invoice payment succeeded: ${invoice.id}`);
        // Handle invoice payment success
    }

    private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
        this.logger.error(`Invoice payment failed: ${invoice.id}`);
        // Handle invoice payment failure
    }

    async retrieveSubscription(subscriptionId: string) {
        return this.stripe.subscriptions.retrieve(subscriptionId);
    }

    async retrieveCustomer(customerId: string) {
        return this.stripe.customers.retrieve(customerId);
    }
}
