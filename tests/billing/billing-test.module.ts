import { SagaCoordinator } from '@/modules/billing/sagas/saga-coordinator.service';
import { TravelBookingSagaStateRepository } from '@/modules/billing/sagas/travel-booking-saga-state.repository';
import { TravelBookingSaga } from '@/modules/billing/sagas/travel-booking.saga';
import { HttpModule } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { CommandBus, CqrsModule, EventBus, QueryBus } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';

import { BILLING_BROKER_CLIENT } from '@/modules/billing/brokers/billing-broker.constants';
import { CarRentalService } from '@/modules/billing/services/car-rental.service';
import { FlightService } from '@/modules/billing/services/flight.service';
import { HotelService } from '@/modules/billing/services/hotel.service';

import { EnvironmentConfigFactory } from '@/config/environment.config';
import { BillingService, InvoiceService, StripeService, TransactionStateMachine } from '@/modules/billing';
import { CommandHandlers } from '@/modules/billing/commands/handlers';
import { EventHandlers } from '@/modules/billing/events/handlers';
import { QueryHandlers } from '@/modules/billing/queries/handlers';
import {
    TravelBookingSagaState,
    TravelBookingSagaStateSchema,
} from '@/modules/billing/sagas/travel-booking-saga-state.schema';
import { TravelBookingNotificationService } from '@/modules/billing/webhooks_sse/travel-booking-notification.service';
import { RedisModule } from '@/modules/cache/cache.redis.module';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExplorerService } from '@nestjs/cqrs/dist/services/explorer.service';

/**
 * Factory function to create a compiled NestJS TestingModule for billing E2E tests.
 * Reusable across multiple test suites.
 *
 * @param mongodbUri - MongoDB connection string
 * @returns Compiled TestingModule ready for createNestApplication()
 */
export async function createTestingModule(): Promise<TestingModule> {
    return await Test.createTestingModule({
        imports: [
            ConfigModule.forRoot({ isGlobal: true, load: [] }),
            CqrsModule,
            HttpModule,
            MongooseModule.forRootAsync({
                inject: [ConfigService],
                useFactory: (configService: ConfigService) => ({
                    uri: configService.get<string>('MONGODB_URI'),
                    connectionFactory: connection => {
                        connection.on('connected', () => {
                            console.log('✅ MongoDB connected for Saga state');
                        });
                        connection.on('error', err => {
                            console.error('MongoDB connection error:', err);
                        });
                        return connection;
                    },
                    connectTimeoutMS: 60000, // 60 seconds to establish connection
                    socketTimeoutMS: 60000, // 60 seconds for socket operations
                    serverSelectionTimeoutMS: 30000, // 30 seconds to find a server
                }),
            }),
            MongooseModule.forFeature([
                {
                    name: TravelBookingSagaState.name,
                    schema: TravelBookingSagaStateSchema,
                },
            ]),
            RedisModule,
        ],
        providers: [
            TravelBookingSaga,
            TransactionStateMachine,
            CommandBus,
            QueryBus,
            InvoiceService,
            ExplorerService,
            FlightService,
            HotelService,
            PrismaService,
            BillingService,
            StripeService,
            CarRentalService,
            TravelBookingSagaStateRepository,
            SagaCoordinator,
            Logger,
            {
                provide: EventBus,
                useValue: {
                    publish: jest.fn(),
                    register: jest.fn(),
                    unregister: jest.fn(),
                    registerSagas: jest.fn(),
                },
            },
            {
                provide: BILLING_BROKER_CLIENT,
                useValue: {
                    emit: jest.fn().mockResolvedValue(undefined),
                },
            },
            {
                provide: 'ENVIRONMENT_CONFIG',
                useFactory: EnvironmentConfigFactory.create,
                inject: [ConfigService],
            },
            // Real TravelBookingNotificationService — needed by event-driven tests
            // (getBookingStream returns Observable, notifyBookingConfirmed pushes to it).
            // HttpModule is already imported, so HttpService is available for webhooks.
            TravelBookingNotificationService,
            ...CommandHandlers,
            ...QueryHandlers,
            ...EventHandlers,
        ],
    }).compile();
}
