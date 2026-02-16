import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BillingController } from './billing.controller';
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
import { BillingMessageController } from './billing-message.controller';
import { TravelBookingController } from './travel-booking.controller';
import { FlightService } from './services/flight.service';
import { HotelService } from './services/hotel.service';
import { CarRentalService } from './services/car-rental.service';
import { TravelBookingSaga } from './sagas/travel-booking.saga';

@Module({
    imports: [
        CqrsModule,
        PrismaModule.forRoot({
            prismaServiceOptions: {},
        }),
        ConfigModule,
        ClientsModule.registerAsync([
            {
                name: 'BILLING_SERVICE',
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.RMQ,
                    options: {
                        urls: [
                            `amqp://${configService.get('RABBITMQ_DEFAULT_USER', 'admin')}:${configService.get(
                                'RABBITMQ_DEFAULT_PASS',
                                '123456',
                            )}@${configService.get('RABBITMQ_HOST', 'localhost')}:${configService.get(
                                'RABBITMQ_PORT',
                                '5672',
                            )}`,
                        ],
                        queue: 'billing_queue',
                        queueOptions: {
                            durable: true,
                        },
                        prefetchCount: 1,
                    },
                }),
                inject: [ConfigService],
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
        TravelBookingSaga,
        ...CommandHandlers,
        ...QueryHandlers,
        ...EventHandlers,
    ],
    exports: [BillingService, StripeService, VirtualAccountService, InvoiceService],
})
export class BillingModule {}
