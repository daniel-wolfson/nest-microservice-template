import { INestApplication, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ClientProxy, ClientsModule, MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BillingController } from './controllers/billing.controller';
import { BillingService } from './services/billing.service';
import { StripeService } from './services/stripe.service';
import { VirtualAccountService } from './services/virtual-account.service';
import { InvoiceService } from './services/invoice.service';
import { TransactionStateMachine } from './state-machines/transaction.state-machine';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { EventHandlers } from './events/handlers';
import { WebhookController } from './webhook.controller';
import { BillingMessageController } from './controllers/billing-message.controller';
import { TravelBookingController } from './controllers/travel-booking.controller';
import { FlightService } from './services/flight.service';
import { HotelService } from './services/hotel.service';
import { CarRentalService } from './services/car-rental.service';
import { BILLING_BROKER_CLIENT } from './brokers/billing-broker.constants';
import { ClientProxyBillingBrokerClient } from './brokers/client-proxy-billing-broker.client';
import { messageBrokerClientOptionsFactory } from './services/message-broker-client.factory';
import { SagaModule } from './sagas/travel-booking-saga.module';

@Module({
    imports: [
        CqrsModule,
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
    controllers: [BillingController, WebhookController, BillingMessageController, TravelBookingController],
    providers: [
        BillingService,
        StripeService,
        VirtualAccountService,
        InvoiceService,
        TransactionStateMachine,
        FlightService,
        HotelService,
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
