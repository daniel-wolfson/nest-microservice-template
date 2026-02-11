import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PaymentSuccessEvent } from '../impl/payment-success.event';

@EventsHandler(PaymentSuccessEvent)
export class PaymentSuccessHandler implements IEventHandler<PaymentSuccessEvent> {
    private readonly logger = new Logger(PaymentSuccessHandler.name);

    constructor(@Inject('BILLING_SERVICE') private readonly client: ClientProxy) {}

    async handle(event: PaymentSuccessEvent) {
        this.logger.log(`Handling PaymentSuccessEvent for customer ${event.customerId}`);

        try {
            // Send event to notification service to send receipt
            this.client.emit('payment.success', {
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
