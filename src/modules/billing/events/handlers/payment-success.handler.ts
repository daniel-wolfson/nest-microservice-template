import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { PaymentSuccessEvent } from '../impl/payment-success.event';
import { BILLING_BROKER_CLIENT } from '../../brokers/billing-broker.constants';
import { BillingBrokerClient } from '../../brokers/billing-broker-client.interface';

@EventsHandler(PaymentSuccessEvent)
export class PaymentSuccessHandler implements IEventHandler<PaymentSuccessEvent> {
    private readonly logger = new Logger(PaymentSuccessHandler.name);

    constructor(
        @Inject(BILLING_BROKER_CLIENT)
        private readonly client: BillingBrokerClient,
    ) {}

    async handle(event: PaymentSuccessEvent) {
        this.logger.log(`Handling PaymentSuccessEvent for customer ${event.customerId}`);

        try {
            // Send event to notification service to send receipt
            await this.client.emit('payment.success', {
                paymentIntentId: event.paymentIntentId,
                customerId: event.customerId,
                amount: event.amount,
                timestamp: new Date().toISOString(),
            });

            this.logger.log('Payment success event emitted to notification service');
        } catch (error) {
            this.logger.error('Failed to handle payment success event', error);
        }
    }
}
