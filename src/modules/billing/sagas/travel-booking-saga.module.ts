import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TravelBookingSaga } from './travel-booking.saga';
import { TravelBookingSagaStateRepository } from './travel-booking-saga-state.repository';
import { SagaCoordinator } from './saga-coordinator.service';
import { FlightService } from '../services/flight.service';
import { HotelService } from '../services/hotel.service';
import { CarRentalService } from '../services/car-rental.service';
import { BILLING_BROKER_CLIENT } from '../brokers/billing-broker.constants';
import { ClientProxyBillingBrokerClient } from '../brokers/client-proxy-billing-broker.client';
import { ClientProxy, ClientsModule } from '@nestjs/microservices';
import { messageBrokerClientOptionsFactory } from '../services/message-broker-client.factory';
import { TravelBookingSagaState, TravelBookingSagaStateSchema } from './travel-booking-saga-state.schema';

@Module({
    imports: [
        CqrsModule,
        ConfigModule,
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                uri:
                    configService.get<string>('MONGODB_URI') ||
                    'mongodb://localhost:27017/microservice-template-billing',
                connectionFactory: connection => {
                    connection.on('connected', () => {
                        console.log('MongoDB connected for Saga state');
                    });
                    connection.on('error', err => {
                        console.error('MongoDB connection error:', err);
                    });
                    return connection;
                },
            }),
        }),
        MongooseModule.forFeature([{ name: TravelBookingSagaState.name, schema: TravelBookingSagaStateSchema }]),
        ClientsModule.registerAsync([
            {
                name: 'MESSAGE_BROKER_CLIENT',
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: messageBrokerClientOptionsFactory,
            },
        ]),
    ],
    providers: [
        TravelBookingSaga,
        TravelBookingSagaStateRepository,
        SagaCoordinator,
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
    ],
    exports: [TravelBookingSaga, TravelBookingSagaStateRepository, SagaCoordinator],
})
export class SagaModule {}
