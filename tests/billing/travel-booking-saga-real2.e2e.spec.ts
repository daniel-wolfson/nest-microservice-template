import { SagaCoordinator } from '@/modules/billing/sagas/saga-coordinator.service';
import { TravelBookingSagaStateRepository } from '@/modules/billing/sagas/travel-booking-saga-state.repository';
import { TravelBookingSaga } from '@/modules/billing/sagas/travel-booking.saga';
import { HttpModule } from '@nestjs/axios';
import { INestApplication, Logger } from '@nestjs/common';
import { CqrsModule, EventBus } from '@nestjs/cqrs';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { Model } from 'mongoose';

import { BILLING_BROKER_CLIENT } from '@/modules/billing/brokers/billing-broker.constants';
import { BookingData } from '@/modules/billing/dto/booking-data.dto';
import { TravelBookingCarRentalReservationHandler } from '@/modules/billing/events/handlers/travel-booking-car-rental-reservation.handler';
import { TravelBookingFlightReservationHandler } from '@/modules/billing/events/handlers/travel-booking-flight-reservation.handler';
import { TravelBookingHotelReservationHandler } from '@/modules/billing/events/handlers/travel-booking-hotel-reservation.handler';
import {
    TravelBookingCarRentalReservationEvent,
    TravelBookingFlightReservationEvent,
    TravelBookingHotelReservationEvent,
} from '@/modules/billing/events/impl/booking-reservation-event';
import { ReservationStatus } from '@/modules/billing/sagas/saga-status.enum';
import {
    TravelBookingSagaState,
    TravelBookingSagaStateSchema,
} from '@/modules/billing/sagas/travel-booking-saga-state.schema';
import { CarRentalService } from '@/modules/billing/services/car-rental.service';
import { FlightService } from '@/modules/billing/services/flight.service';
import { HotelService } from '@/modules/billing/services/hotel.service';
import {
    TravelBookingNotification,
    TravelBookingNotificationService,
} from '@/modules/billing/webhooks_sse/travel-booking-notification.service';
import { REDIS_CLIENT, RedisModule } from '@/modules/cache/cache.redis.module';
import { exec } from 'child_process';
import { randomUUID } from 'crypto';
import { promisify } from 'util';
import { createTestingModule } from './billing-test.module';

describe('Event-Driven Saga Lifecycle (Real Event Handlers, No Manual aggregateResults)', () => {
    let currentTestName = '';
    let app: INestApplication;
    let saga: TravelBookingSaga;
    let eventBus: EventBus;
    let sagaStateModel: Model<TravelBookingSagaState>;
    let redis: Redis;
    let notificationService: TravelBookingNotificationService;

    let testErrors: Array<{ test: string; error: any }> = [];
    let currentTest: string = '';
    let mockTravelBookingDto: BookingData = {} as any; // Populate with necessary test data as needed

    const MONGODB_URI = 'mongodb://admin:123456@localhost:27017/microservice-template-billing-test?authSource=admin';

    // For debugging: track handler invocations
    let flightHandler: TravelBookingFlightReservationHandler;
    let hotelHandler: TravelBookingHotelReservationHandler;
    let carHandler: TravelBookingCarRentalReservationHandler;

    const waitForInfrastructureReady = async (maxRetries = 20, delayMs = 250): Promise<void> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (redis?.status === 'wait') {
                try {
                    await redis.connect();
                } catch {
                    // ignore: may already be connecting/connected
                }
            }

            if (redis && redis.status !== 'ready') {
                try {
                    await redis.ping();
                } catch {
                    // ignore until next retry
                }
            }

            const redisReady = redis?.status === 'ready';
            const mongoReady = sagaStateModel?.db?.readyState === 1;

            if (redisReady && mongoReady) {
                return;
            }

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        throw new Error(
            `Infrastructure not ready after ${maxRetries} retries (Redis: ${redis?.status}, MongoDB: ${sagaStateModel?.db?.readyState})`,
        );
    };

    beforeAll(async () => {
        console.log('🚀 Setting up event-driven E2E test module...');

        const moduleFixture: TestingModule = await createTestingModule();
        app = moduleFixture.createNestApplication();
        await app.init();

        // Generate fresh booking DTO for this test to avoid conflicts
        mockTravelBookingDto = {
            requestId: randomUUID(),
            userId: 'user-123',
            flightOrigin: 'JFK',
            flightDestination: 'LAX',
            departureDate: '2026-03-01',
            returnDate: '2026-03-08',
            hotelId: 'hotel-456',
            checkInDate: '2026-03-01',
            checkOutDate: '2026-03-08',
            carPickupLocation: 'LAX Airport',
            carDropoffLocation: 'LAX Airport',
            carPickupDate: '2026-03-01',
            carDropoffDate: '2026-03-08',
            totalAmount: 2500,
        };

        // Spy on reserve* methods so saga2.execute() never hits the 10% random failures
        const flightSvc = moduleFixture.get<FlightService>(FlightService);
        const hotelSvc = moduleFixture.get<HotelService>(HotelService);
        const carSvc = moduleFixture.get<CarRentalService>(CarRentalService);

        jest.spyOn(flightSvc, 'makeReservation').mockResolvedValue({
            requestId: mockTravelBookingDto.requestId,
            reservationId: 'mock-flight-' + Date.now(),
            userId: mockTravelBookingDto.userId,
            confirmationCode: 'FL-MOCK',
            status: ReservationStatus.CONFIRMED,
            amount: 1500,
            timestamp: new Date().toISOString(),
        });
        jest.spyOn(hotelSvc, 'makeReservation').mockResolvedValue({
            requestId: mockTravelBookingDto.requestId,
            userId: mockTravelBookingDto.userId,
            reservationId: 'mock-hotel-' + Date.now(),
            confirmationCode: 'HT-MOCK',
            status: ReservationStatus.CONFIRMED,
            amount: 1800,
            checkInDate: '2026-05-01',
            checkOutDate: '2026-05-08',
            hotelId: 'hotel-mock',
            timestamp: new Date().toISOString(),
        });
        jest.spyOn(carSvc, 'makeReservation').mockResolvedValue({
            requestId: mockTravelBookingDto.requestId,
            userId: mockTravelBookingDto.userId,
            reservationId: 'mock-car-' + Date.now(),
            confirmationCode: 'CR-MOCK',
            status: ReservationStatus.CONFIRMED,
            amount: 200,
            timestamp: new Date().toISOString(),
        });

        redis = moduleFixture.get<Redis>(REDIS_CLIENT);
        saga = moduleFixture.get<TravelBookingSaga>(TravelBookingSaga);
        eventBus = moduleFixture.get<EventBus>(EventBus);
        sagaStateModel = moduleFixture.get<Model<TravelBookingSagaState>>(getModelToken(TravelBookingSagaState.name));
        notificationService = moduleFixture.get<TravelBookingNotificationService>(TravelBookingNotificationService);

        // Get handlers for debugging/tracking
        flightHandler = moduleFixture.get<TravelBookingFlightReservationHandler>(TravelBookingFlightReservationHandler);
        hotelHandler = moduleFixture.get<TravelBookingHotelReservationHandler>(TravelBookingHotelReservationHandler);
        carHandler = moduleFixture.get<TravelBookingCarRentalReservationHandler>(
            TravelBookingCarRentalReservationHandler,
        );

        // Verify infrastructure is ready
        console.log(`🔍 Verifying infrastructure...`);
        await waitForInfrastructureReady();

        const redisStatus = redis.status;
        const mongoReady = sagaStateModel.db.readyState;
        console.log(`   - Redis: ${redisStatus}`);
        console.log(`   - MongoDB: ${mongoReady === 1 ? 'connected' : 'disconnected'}`);

        console.log('✅ Event-driven test module initialized');
    }, 60000);

    afterAll(async () => {
        console.log('\n📍 afterAll: Cleaning up test resources...');

        try {
            // Clean Redis before closing app (which closes Redis connection)
            if (redis && redis.status === 'ready') {
                const keys = await redis.keys('saga:*');
                if (keys.length > 0) await redis.del(...keys);
            }
        } catch (error: any) {
            console.log(`Redis cleanup failed: ${error?.message}`);
        }

        // app.close() calls RedisModule.onModuleDestroy() which closes Redis connection
        try {
            await app.close();
        } catch (error: any) {
            console.log(`App close failed: ${error?.message}`);
        }
    }, 30000);

    beforeEach(async () => {
        currentTest = expect.getState().currentTestName || 'unknown';

        try {
            await sagaStateModel.deleteMany({ userId: mockTravelBookingDto.userId }).exec();

            // Verify Redis connection is alive before cleanup
            await redis.ping();
            const keys = await redis.keys('saga:*');
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } catch (error) {
            console.error('❌ Error in beforeEach cleanup:', error);
            throw error;
        }
    });

    afterEach(async function (this: any) {
        const testState = expect.getState();
        const error = testState.error;

        if (error) {
            testErrors.push({
                test: currentTest,
                error: error,
            });
            console.error(`\n❌ Test failed: ${currentTest}`);
            console.error(`   Message: ${error?.message}`);
            if (error?.stack) {
                console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
            }
        } else {
            console.log(`\n✅ Test passed: ${currentTest}`);
        }
    });

    test('Saga-step-real-handlers: execute → publish events → handlers fire JOIN POINT → confirmed', async () => {
        try {
            // #region Saga-step 1: Execute → persists PENDING state, emits broker messages
            console.log(`📋 Mock booking data:`, JSON.stringify(mockTravelBookingDto, null, 2));

            const executeResult = await saga.execute(mockTravelBookingDto);
            console.log(`🔍 Execute result:`, JSON.stringify(executeResult, null, 2));

            expect(executeResult.status).toBe(ReservationStatus.PENDING);
            const requestId = executeResult.requestId;
            console.log(` ✅ Saga-step 1: Saga executed → requestId: ${requestId}`);
            // #endregion

            // #region Saga-step-real 2: Subscribe → to BookingNotificationService BEFORE publishing events so we don't miss the notification if handlers are very fast
            const confirmationPromise = new Promise<TravelBookingNotification>((resolve, reject) => {
                const subscription = notificationService.getBookingStream(requestId).subscribe({
                    next: notification => {
                        subscription.unsubscribe();
                        resolve(notification);
                    },
                    error: err => {
                        subscription.unsubscribe();
                        reject(err);
                    },
                });
                setTimeout(() => {
                    subscription.unsubscribe();
                    reject(new Error(`Timeout: no notification received for booking ${requestId}`));
                }, 30000);
            });
            console.log(` ✅ Saga-step-real 2: Subscribed to notification stream for ${requestId}`);
            // #endregion

            // #region Saga-step-real 3: Set up → completion tracking for all 3 handlers using spies
            // Install spies BEFORE events are published to avoid race conditions
            let flightHandlerCompleted = false;
            let hotelHandlerCompleted = false;
            let carHandlerCompleted = false;

            const originalFlightHandle = flightHandler.handle.bind(flightHandler);
            const originalHotelHandle = hotelHandler.handle.bind(hotelHandler);
            const originalCarHandle = carHandler.handle.bind(carHandler);

            // Create resolve functions that will be called when handlers complete
            let flightResolve!: () => void;
            let hotelResolve!: () => void;
            let carResolve!: () => void;

            const flightPromise = new Promise<void>(resolve => {
                flightResolve = resolve;
            });
            const hotelPromise = new Promise<void>(resolve => {
                hotelResolve = resolve;
            });
            const carPromise = new Promise<void>(resolve => {
                carResolve = resolve;
            });

            // Install spies NOW (not inside promise constructor) to ensure they're ready before events fire
            jest.spyOn(flightHandler, 'handle').mockImplementation(async event => {
                console.log(`    → Flight handler invoked for ${event.requestId}`);
                try {
                    await originalFlightHandle(event);
                    flightHandlerCompleted = true;
                    console.log(`    → Flight handler completed successfully`);
                } catch (error: any) {
                    console.error(`    ✗ Flight handler error: ${error.message}`);
                    throw error;
                } finally {
                    flightResolve();
                }
            });

            jest.spyOn(hotelHandler, 'handle').mockImplementation(async event => {
                console.log(`    → Hotel handler invoked for ${event.requestId}`);
                try {
                    await originalHotelHandle(event);
                    hotelHandlerCompleted = true;
                    console.log(`    → Hotel handler completed successfully`);
                } catch (error: any) {
                    console.error(`    ✗ Hotel handler error: ${error.message}`);
                    throw error;
                } finally {
                    hotelResolve();
                }
            });

            jest.spyOn(carHandler, 'handle').mockImplementation(async event => {
                console.log(`    → Car handler invoked for ${event.requestId}`);
                try {
                    await originalCarHandle(event);
                    carHandlerCompleted = true;
                    console.log(`    → Car handler completed successfully`);
                } catch (error: any) {
                    console.error(`    ✗ Car handler error: ${error.message}`);
                    throw error;
                } finally {
                    carResolve();
                }
            });
            console.log(` ✅ Saga-step-real 3: Handler tracking spies installed`);
            // #endregion

            // #region Saga-step-real 4: Publish →the three reservation confirmation events via real EventBus. Each handler saves its reservationId → marks its step → checks JOIN POINT. The last one to arrive fires aggregateResults() + notifyBookingConfirmed().
            const flightReservationId = 'fl-' + randomUUID();
            const hotelReservationId = 'ht-' + randomUUID();
            const carReservationId = 'cr-' + randomUUID();
            const now = new Date();

            eventBus.publish(
                new TravelBookingFlightReservationEvent(
                    requestId,
                    mockTravelBookingDto.userId,
                    flightReservationId,
                    1500,
                    now,
                ),
            );
            eventBus.publish(
                new TravelBookingHotelReservationEvent(
                    requestId,
                    mockTravelBookingDto.userId,
                    hotelReservationId,
                    1800,
                    now,
                ),
            );
            eventBus.publish(
                new TravelBookingCarRentalReservationEvent(
                    requestId,
                    mockTravelBookingDto.userId,
                    carReservationId,
                    200,
                    now,
                ),
            );
            console.log(` ✅ Saga-step-real 4: Published flight / hotel / car reservation events`);
            // #endregion

            // #region Saga-step-real 4a: Wait → for all 3 handlers to complete (with timeout)
            console.log(`  ⏳ Waiting for all handlers to complete...`);
            const handlerTimeout = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Handler timeout after 25s')), 25000);
            });

            await Promise.race([Promise.all([flightPromise, hotelPromise, carPromise]), handlerTimeout]);

            console.log(` ✓ Saga-step-real 4a: All 3 handlers completed ✅`);
            console.log(`    - Flight: ${flightHandlerCompleted ? '✅' : '❌'}`);
            console.log(`    - Hotel: ${hotelHandlerCompleted ? '✅' : '❌'}`);
            console.log(`    - Car: ${carHandlerCompleted ? '✅' : '❌'}`);

            // #endregion

            // #region Saga-step-real 5: Wait → for the notification — pushed by the handler that completes the JOIN POINT
            const notification = await confirmationPromise;
            expect(notification.status).toBe(ReservationStatus.CONFIRMED);
            // Note: notification may contain requestId as bookingId until aggregateResults() generates final bookingId
            console.log(` ✅ Saga-step-real 5: Notification received — status: ${notification.status}`);
            // #endregion

            // #region Saga-step-real 6: Verify MongoDB → state was updated to CONFIRMED by aggregateResults()
            // Search by requestId (saga coordination key), not bookingId (generated later)
            // Note: MongoDB write might lag slightly behind notification, so we'll retry a few times
            console.log(`  ⏳ Waiting for MongoDB state to be persisted...`);
            let confirmedState: TravelBookingSagaState | null = null;
            let retries = 0;
            const maxRetries = 10;

            while (retries < maxRetries) {
                confirmedState = await sagaStateModel.findOne({ requestId: requestId });
                if (confirmedState?.status === ReservationStatus.CONFIRMED) {
                    break;
                }
                retries++;
                if (retries < maxRetries) {
                    console.log(
                        `    ⏱️ Retry ${retries}/${maxRetries} - Current status: ${
                            confirmedState?.status || 'not found'
                        }`,
                    );
                    await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
                }
            }

            expect(confirmedState).toBeDefined();
            expect(confirmedState!.status).toBe(ReservationStatus.CONFIRMED);
            expect(confirmedState!.flightReservationId).toBe(flightReservationId);
            expect(confirmedState!.hotelReservationId).toBe(hotelReservationId);
            expect(confirmedState!.carRentalReservationId).toBe(carReservationId);

            // Verify → that final bookingId was generated (customer confirmation number)
            expect(confirmedState!.bookingId).toBeDefined();
            expect(confirmedState!.bookingId).not.toBeNull();
            expect(confirmedState!.bookingId).toMatch(/^TRV-/); // Format: TRV-timestamp-random
            console.log(` ✅ Saga-step-real 6: MongoDB state → CONFIRMED with bookingId: ${confirmedState!.bookingId}`);

            // #endregion

            // #region Saga-step-real 7: Verify Redis → coordination data was cleaned up by aggregateResults()
            const cachedAfter = await redis.get(`saga:in-active:${requestId}`);
            const stepsAfter = await redis.exists(`saga:steps:${requestId}`);
            expect(cachedAfter).toBeNull();
            expect(stepsAfter).toBe(0);
            console.log(` ✅ Saga-step-real 7: Redis coordination data cleaned up`);

            // #endregion

            // #region Saga-step-real 8: Verify result → DTO contains all reservation IDs
            expect(notification.result).toBeDefined();
            expect(notification.result!.flightReservationId).toBe(flightReservationId);
            expect(notification.result!.hotelReservationId).toBe(hotelReservationId);
            expect(notification.result!.carRentalReservationId).toBe(carReservationId);
            // #endregion

            // #region Saga-step-real 9: Verify notification → contains the final bookingId (customer confirmation number)
            if (notification.result!.bookingId) {
                expect(notification.result!.bookingId).toBe(confirmedState!.bookingId);
                console.log(
                    ` ✅ Saga-step-real 9: Notification contains final bookingId: ${notification.result!.bookingId}`,
                );
            } else {
                console.log(` ⚠️ Saga-step-real 9: Notification uses requestId (bookingId not yet propagated)`);
            }
            // #endregion

            console.log('✅ Event-driven saga lifecycle verified successfully!');

            // Cleanup: Restore handler spies
            jest.restoreAllMocks();
        } catch (error: any) {
            console.error('\n❌ Test failed with error:');
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);

            // Cleanup: Restore handler spies even on error
            jest.restoreAllMocks();
            throw error; // Re-throw so Jest marks test as failed
        }
    }, 30000);
});
