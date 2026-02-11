import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OrderCreatedEvent } from '../impl/order-created.event';
import { CreateInvoiceCommand } from '../../commands/impl/create-invoice.command';

@EventsHandler(OrderCreatedEvent)
export class OrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
    private readonly logger = new Logger(OrderCreatedHandler.name);

    constructor(private readonly commandBus: CommandBus) {}

    async handle(event: OrderCreatedEvent) {
        this.logger.log(`Handling OrderCreatedEvent for order ${event.orderId}`);

        try {
            // Create invoice when order is created
            await this.commandBus.execute(
                new CreateInvoiceCommand(
                    event.userId,
                    event.amount,
                    `Invoice for order ${event.orderId}`,
                    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
                ),
            );

            this.logger.log(`Invoice created for order ${event.orderId}`);
        } catch (error) {
            this.logger.error('Failed to handle order created event', error);
        }
    }
}
