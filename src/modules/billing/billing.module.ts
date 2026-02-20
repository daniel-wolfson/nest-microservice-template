import { BillingCommandController } from './controllers/billing-command.controller';
import { BillingEventController } from './controllers/billing-event.controller';
import { BillingQueryController } from './controllers/billing-query.controller';
import { BILLING_BROKER_CLIENT } from './brokers/billing-broker.constants';
import { BillingService } from './services/billing.service';
import { BookingCommandController } from './controllers/booking-command.controller';
import { BookingNotificationService } from './services/booking-notification.service';
import { BookingSseController } from './controllers/booking-sse.controller';
import { CarRentalService } from './services/car-rental.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { ClientProxy, ClientsModule, MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ClientProxyBillingBrokerClient } from './brokers/client-proxy-billing-broker.client';
import { CommandHandlers } from './commands/handlers';
import { EventHandlers } from './events/handlers';
import { FlightService } from './services/flight.service';
import { InvoiceService } from './services/invoice.service';
import { HotelService } from './services/hotel.service';
import { HttpModule } from '@nestjs/axios';
import { HelperModule } from '@/modules/helpers';
import { Module } from '@nestjs/common';
import { messageBrokerClientOptionsFactory } from './services/message-broker-client.factory';
import { QueryHandlers } from './queries/handlers';
import { SagaModule } from './sagas/travel-booking-saga.module';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { StripeService } from './services/stripe.service';
import { VirtualAccountService } from './services/virtual-account.service';
import { TransactionStateMachine } from './state-machines/transaction.state-machine';
import { WebhookController } from './controllers/webhook.controller';

@Module({
    imports: [
        CqrsModule,
        HttpModule,
        HelperModule,
        PrismaModule.forRoot({
            prismaServiceOptions: {},
        }),
        ConfigModule,
        SagaModule, // Import SagaModule for MongoDB-backed saga state management
        ClientsModule.registerAsync([
            {
                name: 'MESSAGE_BROKER_CLIENT',
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: messageBrokerClientOptionsFactory,
            },
        ]),
    ],
    controllers: [
        BillingCommandController,
        BillingQueryController,
        BillingEventController,
        BookingCommandController,
        BookingSseController,
        WebhookController,
    ],
    providers: [
        BillingService,
        BookingNotificationService,
        InvoiceService,
        HotelService,
        FlightService,
        StripeService,
        VirtualAccountService,
        TransactionStateMachine,
        CarRentalService,
        {
            provide: BILLING_BROKER_CLIENT,
            useFactory: (messageBrokerClient: ClientProxy) => {
                return new ClientProxyBillingBrokerClient(messageBrokerClient);
            },
            inject: ['MESSAGE_BROKER_CLIENT'],
        },
        ...CommandHandlers,
        ...QueryHandlers,
        ...EventHandlers,
    ],
    exports: [BillingService, StripeService, VirtualAccountService, InvoiceService],
})
export class BillingModule {}
