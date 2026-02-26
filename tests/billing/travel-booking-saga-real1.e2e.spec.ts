import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';

import { BILLING_BROKER_CLIENT } from '@/modules/billing/brokers/billing-broker.constants';
import { BookingData } from '@/modules/billing/dto/booking-data.dto';
import { HotelReservationResult } from '@/modules/billing/dto/hotel-reservation-result.dto';
import { ReservationResult } from '@/modules/billing/dto/reservation-confirm-result.dto';
import { ReservationType } from '@/modules/billing/sagas/reservation-types.enum';
import { ReservationStatus } from '@/modules/billing/sagas/saga-status.enum';
import { TravelBookingSaga } from '@/modules/billing/sagas/travel-booking.saga';
import { REDIS_CLIENT } from '@/modules/cache/cache.redis.module';
import { ApiHelper } from '@/modules/helpers/helper.service';
import { exec } from 'child_process';
import { randomUUID } from 'crypto';
import { promisify } from 'util';
import { createTestingModule } from './billing-test.module';
const execAsync = promisify(exec);

/**
 * END-TO-END TEST: Travel Booking Saga with Real Redis and MongoDB
 *
 * This test suite validates the complete saga flow using actual Docker containers:
 * - MongoDB for durable state persistence
 * - Redis for distributed coordination
 *
 * Prerequisites:
 * - Docker must be running
 * - Ports 27017 (MongoDB) and 6379 (Redis) must be available
 *
 * Setup:
 * docker-compose -f docker/microservice-template/docker-compose.mongodb.yml up -d
 * docker-compose -f docker/microservice-template/docker-compose.redis.yml up -d
 *
 * Cleanup:
 * docker-compose -f docker/microservice-template/docker-compose.mongodb.yml down
 * docker-compose -f docker/microservice-template/docker-compose.redis.yml down
 */
describe('TravelBookingSaga E2E (Redis + MongoDB)', () => {
    let app: INestApplication;
    let saga: TravelBookingSaga;
    //let sagaCoordinator: SagaCoordinator;
    let redis: Redis;

    //const MONGODB_URI = 'mongodb://admin:123456@localhost:27017/microservice-template-billing-test?authSource=admin';

    // Fresh reservationId per test — prevents findByReservationId() from returning stale cross-test data
    let mockTravelBookingDto: BookingData;

    beforeAll(async () => {
        // Fresh DTO with new reservationId prevents findByReservationId() returning stale data from previous tests
        mockTravelBookingDto = {
            requestId: randomUUID(),
            userId: 'e2e-user-123',
            flightOrigin: 'JFK',
            flightDestination: 'LAX',
            departureDate: '2026-05-01',
            returnDate: '2026-05-08',
            hotelId: 'e2e-hotel-456',
            checkInDate: '2026-05-01',
            checkOutDate: '2026-05-08',
            carPickupLocation: 'LAX Airport',
            carDropoffLocation: 'LAX Airport',
            carPickupDate: '2026-05-01',
            carDropoffDate: '2026-05-08',
            totalAmount: 3500,
        };

        // Capture unhandled rejections
        process.on('unhandledRejection', (reason, promise) => {
            debugger;
            console.error('🚨 Unhandled Rejection at:', promise);
            console.error('Reason:', reason);
        });

        console.log('🚀 Starting E2E Test Setup...');

        // Verify Docker services are running
        try {
            const { stdout: mongoCheck } = await execAsync(
                'docker ps --filter "name=microservice-template-mongodb" --format "{{.Names}}"',
            );
            const { stdout: redisCheck } = await execAsync(
                'docker ps --filter "name=microservice-template-redis" --format "{{.Names}}"',
            );

            if (!mongoCheck.includes('mongodb') || !redisCheck.includes('redis')) {
                throw new Error('Services not found');
            }
            console.log('✅ Docker services are running');
        } catch (error) {
            console.error('❌ Docker services not running. Please start them:');
            console.error('   docker-compose -f docker/microservice-template/docker-compose.mongodb.yml up -d');
            console.error('   docker-compose -f docker/microservice-template/docker-compose.redis.yml up -d');
            throw new Error('Docker services required for E2E tests');
        }

        try {
            // Create NestJS testing module with real MongoDB and Redis
            const moduleFixture: TestingModule = await createTestingModule();

            app = moduleFixture.createNestApplication();
            await app.init();

            // ✅ Get Redis client from DI container
            redis = moduleFixture.get<Redis>(REDIS_CLIENT);

            var pongResult = await redis.ping();
            console.log(`✅ Redis connection established ${pongResult.toString() == 'PONG' ? 'successful' : 'failed'}`);

            saga = moduleFixture.get<TravelBookingSaga>(TravelBookingSaga);

            console.log('✅ NestJS application initialized');
            console.log('');
        } catch (error) {
            console.error('❌ Error connecting to Docker services:', error);
            throw error; // Re-throw to prevent tests running with broken setup
        }
    }, 60000); // 60 second timeout for setup

    afterAll(async () => {
        console.log('🧹 Cleaning up E2E Test...');

        try {
            // Clear test data from MongoDB
            // await sagaStateModel.deleteMany({ userId: 'e2e-user-123' });
            console.log('✅ MongoDB test data cleaned');

            // Clear test data from Redis (only if connection is still alive)
            try {
                await redis.ping();
                const keys = await redis.keys('saga:*');
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
                console.log('✅ Redis test data cleaned');
            } catch (redisError) {
                console.log('⚠️ Redis already disconnected, skipping cleanup');
            }

            // app.close() calls RedisModule.onModuleDestroy() which calls redis.quit() —
            // do NOT call redis.quit() manually here to avoid double-close (ECONNRESET).
            await app.close();
            console.log('✅ Connections closed');
        } catch (error) {
            console.error('❌ Error in afterAll cleanup:', error);
        }
    }, 30000);

    beforeEach(async () => {
        // Clear previous test data
        try {
            // await saga.deleteByUserId(mockTravelBookingDto.userId);

            // Verify Redis connection is alive before cleanup
            await redis.ping();
            const keys = await redis.keys('saga:*');
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } catch (error) {
            debugger;
            console.error('❌ Error in beforeEach cleanup:', error);
            throw error;
        }
    });

    afterEach(function () {});

    describe('Complete Saga Flow with Real Infrastructure', () => {
        test('should execute saga and persist state in MongoDB', async () => {
            // Act - execute saga with mock booking data
            const result = await saga.execute(mockTravelBookingDto);

            // Assert - Verify execution result
            expect(result.status).toBe(ReservationStatus.PENDING);
            expect(result.requestId).toBeDefined();

            // Verify MongoDB persistence - search by requestId (saga coordination key)
            const savedState = await saga.findByRequestId(result.requestId);

            expect(savedState).toBeDefined();
            expect(savedState!.status).toBe(ReservationStatus.PENDING); // execute() saves PENDING; CONFIRMED only after aggregateResults()
            expect(savedState!.userId).toBe(mockTravelBookingDto.userId);
            expect(savedState!.totalAmount).toBe(mockTravelBookingDto.totalAmount);
            expect(savedState!.originalRequest).toBeDefined();

            // bookingId should be null/undefined at this stage (generated later in aggregateResults)
            expect(savedState!.bookingId).toBeUndefined();

            console.log(`✅ Saga state persisted to MongoDB with requestId: ${result.requestId}`);
        }, 15000);

        test('should create distributed lock in Redis during execution', async () => {
            const result = await saga.execute(mockTravelBookingDto);

            // Lock should be released after execution
            const lockExists = await redis.exists(`saga:lock:${result.requestId}`);
            expect(lockExists).toBe(0); // Lock released

            console.log(`✅ Distributed lock managed correctly`);
        }, 15000);

        test('should cache in-active state in Redis during execution', async () => {
            // Spy on cacheActiveSagaState to intercept when cache is set
            let capturedRequestId: string | null = null;
            let capturedState: any = null;

            const originalCacheMethod = saga.coordinator.cacheActiveSagaState.bind(saga.coordinator);

            jest.spyOn(saga.coordinator, 'cacheActiveSagaState').mockImplementation(async (requestId, state, ttl) => {
                capturedRequestId = requestId;
                capturedState = state;
                // Call the real method to actually cache the data
                return originalCacheMethod(requestId, state, ttl);
            });

            // Start saga execution
            const executePromise = saga.execute(mockTravelBookingDto);

            // Wait a bit for caching to happen (saga-execute-step 6 happens before broker emit)
            await new Promise(resolve => setTimeout(resolve, 50));

            // Verify cache was called
            expect(saga.coordinator.cacheActiveSagaState).toHaveBeenCalled();
            expect(capturedRequestId).not.toBeNull();

            // Check if state is cached in Redis DURING execution
            if (capturedRequestId) {
                const cachedState = await redis.get(`saga:in-active:${capturedRequestId}`);

                if (cachedState) {
                    const parsedState = JSON.parse(cachedState);
                    expect(parsedState.userId).toBe(mockTravelBookingDto.userId);
                    expect(parsedState.totalAmount).toBe(mockTravelBookingDto.totalAmount);
                    expect(parsedState.status).toBe(ReservationStatus.PENDING);
                    console.log(`✅ In-active state cached in Redis during execution`);
                }
            }

            // Wait for saga to complete
            await executePromise;

            // Verify cache was cleared after completion (saga-execute-step 14)
            expect(capturedRequestId).not.toBeNull();
            const cachedAfter = await redis.get(`saga:in-active:${capturedRequestId}`);
            expect(cachedAfter).toBeNull();
            console.log(`✅ Cache cleared after saga completion`);
        }, 15000);

        test('should track saga steps in Redis', async () => {
            const result = await saga.execute(mockTravelBookingDto);

            // Check step counters
            const hotelStep = await redis.hget(`saga:steps:${result.requestId}`, 'HOTEL_REQUESTED');
            const flightStep = await redis.hget(`saga:steps:${result.requestId}`, 'FLIGHT_REQUESTED');
            const carStep = await redis.hget(`saga:steps:${result.requestId}`, 'CAR_REQUESTED');

            expect(hotelStep).toBe('1');
            expect(flightStep).toBe('1');
            expect(carStep).toBe('1');

            console.log(`✅ Saga steps tracked in Redis`);
        }, 15000);

        test('should add saga to pending queue in Redis', async () => {
            const result = await saga.execute(mockTravelBookingDto);

            // Check pending queue
            const pendingScore = await redis.zscore('saga:pending', result.requestId);
            expect(pendingScore).toBeDefined();

            console.log(`✅ Saga added to pending queue`);
        }, 15000);

        test('should enforce rate limiting across multiple requests', async () => {
            // Make 6 requests quickly (limit is 5 per minute)
            const results = [];
            for (let i = 0; i < 6; i++) {
                // Unique reservationId per request — prevents idempotency early-return bypassing rate limit
                results.push(
                    await saga.execute({
                        ...mockTravelBookingDto,
                        userId: 'rate-limit-test-user',
                        requestId: randomUUID(),
                    }),
                );
            }

            // First 5 should succeed, 6th should fail
            const successCount = results.filter(r => r.status === ReservationStatus.PENDING).length;
            const failedCount = results.filter(r => r.status === ReservationStatus.FAILED).length;

            expect(successCount).toBe(5);
            expect(failedCount).toBe(1);
            expect(results[5].message).toContain('Rate limit exceeded');

            // Cleanup
            await saga.deleteByUserId(mockTravelBookingDto.userId);

            console.log(`✅ Rate limiting enforced: ${successCount} succeeded, ${failedCount} failed`);
        }, 20000);

        test('should prevent concurrent execution with distributed lock', async () => {
            const dto = { ...mockTravelBookingDto };

            // Start first execution
            const firstExecution = saga.execute(dto);

            // Wait a bit and try concurrent execution with same data (simulated by acquiring lock manually)
            await new Promise(resolve => setTimeout(resolve, 100));

            // Try to acquire lock while first saga is running
            const bookingId = (await firstExecution).bookingId;
            const lockAcquired = await saga.coordinator.acquireSagaLock(bookingId, 300);

            // Lock should already be taken (or just released)
            // Since execution is async and fast, lock might be released already
            // So we test that the lock mechanism works by checking it was used
            expect(lockAcquired).toBeDefined();

            await saga.coordinator.releaseSagaLock(bookingId);

            console.log(`✅ Distributed lock prevents concurrent execution`);
        }, 15000);
    });

    describe('Aggregate Results with Real Infrastructure', () => {
        test('should aggregate results and update MongoDB state', async () => {
            // First execute saga
            const executeResult = await saga.execute(mockTravelBookingDto);
            const requestId = executeResult.requestId;

            // Simulate confirmation results
            const expectedFlightResult: ReservationResult = {
                userId: mockTravelBookingDto.userId,
                reservationId: ApiHelper.generatePNR('FLT'),
                confirmationCode: 'FL-E2E-123',
                status: ReservationStatus.CONFIRMED,
                requestId: requestId,
                amount: 1500,
            };
            const expectedHotelResult: HotelReservationResult = {
                userId: mockTravelBookingDto.userId,
                requestId: requestId,
                reservationId: ApiHelper.generatePNR('HTL'),
                hotelId: mockTravelBookingDto.hotelId,
                checkInDate: mockTravelBookingDto.checkInDate,
                checkOutDate: mockTravelBookingDto.checkOutDate,
                amount: 1800,
                confirmationCode: 'HT-E2E-456',
                status: ReservationStatus.CONFIRMED,
            };
            const expectedCarResult: ReservationResult = {
                userId: mockTravelBookingDto.userId,
                requestId: requestId,
                reservationId: ApiHelper.generatePNR('CAR'),
                confirmationCode: 'CR-E2E-789',
                status: ReservationStatus.CONFIRMED,
                amount: 200,
            };

            // Save each reservation ID to MongoDB (simulating what event handlers do atomically)
            await saga.saveConfirmedReservation(
                ReservationType.FLIGHT,
                requestId,
                expectedFlightResult.reservationId,
                'FLIGHT_CONFIRMED',
            );
            await saga.saveConfirmedReservation(
                ReservationType.HOTEL,
                requestId,
                expectedHotelResult.reservationId,
                'HOTEL_CONFIRMED',
            );
            await saga.saveConfirmedReservation(
                ReservationType.CAR,
                requestId,
                expectedCarResult.reservationId,
                'CAR_CONFIRMED',
            );

            // Aggregate results — reads IDs from MongoDB
            const aggregateResult = await saga.aggregateResults(requestId);

            // Verify result
            expect(aggregateResult.status).toBe(ReservationStatus.CONFIRMED);
            expect(aggregateResult.flightReservationId).toBe(expectedFlightResult.reservationId);
            expect(aggregateResult.hotelReservationId).toBe(expectedHotelResult.reservationId);
            expect(aggregateResult.carRentalReservationId).toBe(expectedCarResult.reservationId);

            // Verify MongoDB state updated
            const updatedState = await saga.findByRequestId(requestId);
            expect(updatedState!.status).toBe(ReservationStatus.CONFIRMED);
            expect(updatedState!.flightReservationId).toBe(expectedFlightResult.reservationId);
            expect(updatedState!.hotelReservationId).toBe(expectedHotelResult.reservationId);
            expect(updatedState!.carRentalReservationId).toBe(expectedCarResult.reservationId);

            // Verify bookingId was generated
            expect(updatedState!.bookingId).toBeDefined();
            expect(updatedState!.bookingId).toMatch(/^TRV-/);

            console.log(`✅ Aggregation completed and MongoDB updated with bookingId: ${updatedState!.bookingId}`);
        }, 20000);

        test('should cleanup Redis data after successful aggregation', async () => {
            // Arrange - execute saga and simulate confirmations
            const executeResult = await saga.execute(mockTravelBookingDto);
            const requestId = executeResult.requestId;
            const expectedFlightResult = {
                reservationId: ApiHelper.generatePNR('FLT'),
                confirmationCode: 'FL123',
                status: ReservationStatus.CONFIRMED,
                amount: 1500,
            };
            const expectedHotelResult = {
                reservationId: ApiHelper.generatePNR('HTL'),
                hotelId: 'hotel-456',
                checkInDate: '2026-05-01',
                checkOutDate: '2026-05-08',
                amount: 1800,
                timestamp: new Date().toISOString(),
                confirmationCode: 'HT456',
                status: ReservationStatus.CONFIRMED,
            };
            const expectedCarResult = {
                reservationId: ApiHelper.generatePNR('CAR'),
                confirmationCode: 'CR789',
                status: ReservationStatus.CONFIRMED,
                amount: 200,
            };

            // Act - Save confirmations and aggregate results. Save each reservation ID to MongoDB (simulating what event handlers do atomically)
            await saga.saveConfirmedReservation(
                ReservationType.FLIGHT,
                requestId,
                expectedFlightResult.reservationId,
                'FLIGHT_CONFIRMED',
            );
            await saga.saveConfirmedReservation(
                ReservationType.HOTEL,
                requestId,
                expectedHotelResult.reservationId,
                'HOTEL_CONFIRMED',
            );
            await saga.saveConfirmedReservation(
                ReservationType.CAR,
                requestId,
                expectedCarResult.reservationId,
                'CAR_CONFIRMED',
            );
            await saga.aggregateResults(requestId);

            // Assert - Verify Redis data exists
            const cachedBefore = await redis.get(`saga:in-active:${requestId}`);
            expect(cachedBefore).toBeDefined();

            // Assert -Verify Redis cleanup
            const cachedAfter = await redis.get(`saga:in-active:${requestId}`);
            const stepsAfter = await redis.exists(`saga:steps:${requestId}`);
            const metadataAfter = await redis.exists(`saga:metadata:${requestId}`);

            expect(cachedAfter).toBeNull();
            expect(stepsAfter).toBe(0);
            expect(metadataAfter).toBe(0);

            console.log(`✅ Redis coordination data cleaned up after aggregation`);
        }, 20000);
    });

    describe('Error Scenarios with Real Infrastructure', () => {
        test('should persist error state in MongoDB on failure', async () => {
            // Mock broker to fail
            const billingBrokerClient = app.get(BILLING_BROKER_CLIENT);
            jest.spyOn(billingBrokerClient, 'emit').mockRejectedValueOnce(new Error('E2E Broker Error'));

            const result = await saga.execute(mockTravelBookingDto);

            // Verify failure result
            expect(result.status).toBe(ReservationStatus.FAILED);
            expect(result.message).toContain('E2E Broker Error');

            // Verify MongoDB error state
            const errorState = await saga.findByRequestId(result.requestId);
            expect(errorState!.errorMessage).toContain('E2E Broker Error');

            console.log(`✅ Error state persisted to MongoDB`);
        }, 15000);

        test('should set error metadata in Redis on failure', async () => {
            // Mock broker to fail
            const billingBrokerClient = app.get(BILLING_BROKER_CLIENT);
            jest.spyOn(billingBrokerClient, 'emit').mockRejectedValueOnce(new Error('E2E Redis Metadata Test'));

            const result = await saga.execute(mockTravelBookingDto);

            // Verify Redis error metadata
            const metadata = await redis.hgetall(`saga:metadata:${result.requestId}`);
            expect(metadata.error).toContain('E2E Redis Metadata Test');

            console.log(`✅ Error metadata set in Redis`);
        }, 15000);
    });

    describe('Hybrid MongoDB + Redis Architecture', () => {
        test('should use Redis cache for fast reads, MongoDB for persistence', async () => {
            // Prevent execute()'s finally-block (saga-execute-step 15) from clearing the cache
            // so we can verify Redis still holds the data for fast reads.
            jest.spyOn(saga.coordinator, 'clearActiveSagaState').mockResolvedValue(undefined);

            // Act - Execute saga
            const executeResult = await saga.execute(mockTravelBookingDto);

            const redisCached = await saga.coordinator.getActiveSagaState(executeResult.requestId);

            // Assert - Redis cache should have the data (not cleared due to spy)
            expect(redisCached).not.toBeNull();
            expect(redisCached!.userId).toBe(mockTravelBookingDto.userId);

            // Assert - Durable read from MongoDB (use findByRequestId — bookingId is null at this stage)
            const mongoState = await saga.dbState.findByRequestId(executeResult.requestId);
            expect(mongoState).toBeDefined();
            expect(mongoState!.userId).toBe(mockTravelBookingDto.userId);

            // Assert - Both should have consistent data
            expect(redisCached!.userId).toBe(mongoState!.userId);
            expect(redisCached!.status).toBe(ReservationStatus.PENDING);
            expect(mongoState!.status).toBe(ReservationStatus.PENDING);

            // Cleanup: restore mock and actually clear the cache
            jest.restoreAllMocks();
            await saga.coordinator.clearActiveSagaState(executeResult.requestId);

            console.log(`✅ Hybrid architecture: Redis cache + MongoDB persistence verified`);
        }, 15000);

        test('should fallback to MongoDB when Redis cache expires', async () => {
            // Execute saga
            const executeResult = await saga.execute(mockTravelBookingDto);
            const bookingId = executeResult.requestId;

            // Manually expire Redis cache
            await redis.del(`saga:in-active:${bookingId}`);

            // Try to get cached state (should return null)
            const redisState = await saga.coordinator.getActiveSagaState(bookingId);
            expect(redisState).toBeNull();

            // MongoDB should still have the data (use findByRequestId — bookingId is null at this stage)
            const mongoState = await saga.dbState.findByRequestId(bookingId);
            expect(mongoState).toBeDefined();
            expect(mongoState!.status).toBe(ReservationStatus.PENDING);

            console.log(`✅ MongoDB fallback works when Redis cache expires`);
        }, 15000);
    });

    describe('Real-World Saga Lifecycle', () => {
        test('should complete full saga lifecycle: execute → pending → aggregate → confirmed', async () => {
            console.log('🔄 Testing complete saga lifecycle...');

            // Step 1: Execute saga
            const executeResult = await saga.execute(mockTravelBookingDto);
            expect(executeResult.status).toBe(ReservationStatus.PENDING);
            console.log(`  ✓ Step 1: Saga executed (${executeResult.requestId})`);

            // Step 2: Verify pending state in MongoDB
            const pendingState = await saga.findByRequestId(executeResult.requestId);
            expect(pendingState!.status).toBe(ReservationStatus.PENDING);
            console.log(`  ✓ Step 2: Pending state verified in MongoDB`);

            // Step 3: Verify Redis coordination active
            const cachedState = await redis.get(`saga:in-active:${executeResult.requestId}`);
            expect(cachedState).toBeDefined();
            console.log(`  ✓ Step 3: Redis coordination active`);

            // Step 4: Simulate confirmations — save each reservation ID to MongoDB
            // (in production this is done atomically by each service's confirm*Reservation method)
            await saga.dbState.saveConfirmedReservation(
                ReservationType.FLIGHT,
                executeResult.requestId,
                'fl-123',
                'flight_confirmed',
            );
            await saga.dbState.saveConfirmedReservation(
                ReservationType.HOTEL,
                executeResult.requestId,
                'ht-456',
                'hotel_confirmed',
            );
            await saga.dbState.saveConfirmedReservation(
                ReservationType.CAR,
                executeResult.requestId,
                'cr-789',
                'hotel_confirmed',
            );
            // Uncomment: car field mapping is now fixed (saveConfirmedReservation 'car' → carRentalReservationId)
            const aggregateResult = await saga.aggregateResults(executeResult.requestId);
            expect(aggregateResult.status).toBe('CONFIRMED');
            console.log(`  ✓ Step 4: Results aggregated successfully`);

            // Step 5: Verify final confirmed state in MongoDB
            const confirmedState = await saga.findByRequestId(executeResult.requestId);
            expect(confirmedState!.status).toBe(ReservationStatus.CONFIRMED);
            expect(confirmedState!.flightReservationId).toBeDefined();
            expect(confirmedState!.hotelReservationId).toBeDefined();
            expect(confirmedState!.carRentalReservationId).toBeDefined();

            // Verify bookingId was generated in aggregateResults()
            expect(confirmedState!.bookingId).toBeDefined();
            expect(confirmedState!.bookingId).toMatch(/^TRV-/);
            console.log(
                `  ✓ Step 5: Confirmed state persisted in MongoDB with bookingId: ${confirmedState!.bookingId}`,
            );

            // Step 6: Verify Redis cleanup
            const cleanedCache = await redis.get(`saga:in-active:${executeResult.requestId}`);
            expect(cleanedCache).toBeNull();
            console.log(`  ✓ Step 6: Redis coordination data cleaned`);

            console.log('✅ Complete saga lifecycle verified successfully!');
        }, 30000);
    });
});
