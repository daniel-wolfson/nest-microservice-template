import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { TravelBookingSaga } from '../../src/modules/billing/sagas/travel-booking.saga';
import { FlightService } from '../../src/modules/billing/services/flight.service';
import { HotelService } from '../../src/modules/billing/services/hotel.service';
import { CarRentalService } from '../../src/modules/billing/services/car-rental.service';
import { TravelBookingRequestDto } from '../../src/modules/billing/dto/travel-booking.dto';
import { BILLING_BROKER_CLIENT } from '../../src/modules/billing/brokers/billing-broker.constants';
import { BillingBrokerClient } from '../../src/modules/billing/brokers/billing-broker-client.interface';
import { TravelBookingSagaStateRepository } from '../../src/modules/billing/sagas/repositories/travel-booking-saga-state.repository';
import { SagaCoordinator } from '../../src/modules/billing/sagas/services/saga-coordinator.service';
import { SagaStatus } from '../../src/modules/billing/sagas/schemas/travel-booking-saga-state.schema';
import { randomUUID } from 'crypto';

describe('TravelBookingSaga', () => {
    let saga: TravelBookingSaga;
    let flightService: FlightService;
    let hotelService: HotelService;
    let carRentalService: CarRentalService;
    let eventBus: EventBus;
    let billingBrokerClient: BillingBrokerClient;
    let sagaStateRepository: TravelBookingSagaStateRepository;
    let sagaCoordinator: SagaCoordinator;

    const mockTravelBookingDto: TravelBookingRequestDto = {
        reservationId: randomUUID(),
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

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TravelBookingSaga,
                FlightService,
                HotelService,
                CarRentalService,
                {
                    provide: EventBus,
                    useValue: {
                        publish: jest.fn(),
                    },
                },
                {
                    provide: BILLING_BROKER_CLIENT,
                    useValue: {
                        emit: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: TravelBookingSagaStateRepository,
                    useValue: {
                        create: jest.fn().mockResolvedValue({
                            bookingId: 'test-booking-id',
                            status: SagaStatus.PENDING,
                        }),
                        findByBookingId: jest.fn().mockResolvedValue({
                            bookingId: 'test-booking-id',
                            userId: 'user-123',
                            status: SagaStatus.PENDING,
                            originalRequest: mockTravelBookingDto,
                        }),
                        updateState: jest.fn().mockResolvedValue({
                            bookingId: 'test-booking-id',
                            status: SagaStatus.CONFIRMED,
                        }),
                        setError: jest.fn().mockResolvedValue(undefined),
                        addCompletedStep: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: SagaCoordinator,
                    useValue: {
                        acquireSagaLock: jest.fn().mockResolvedValue(true),
                        releaseSagaLock: jest.fn().mockResolvedValue(undefined),
                        checkRateLimit: jest.fn().mockResolvedValue(true),
                        cacheInFlightState: jest.fn().mockResolvedValue(undefined),
                        getInFlightState: jest.fn().mockResolvedValue(null),
                        clearInFlightState: jest.fn().mockResolvedValue(undefined),
                        addToPendingQueue: jest.fn().mockResolvedValue(undefined),
                        removeFromPendingQueue: jest.fn().mockResolvedValue(undefined),
                        incrementStepCounter: jest.fn().mockResolvedValue(1),
                        getSagaProgress: jest.fn().mockResolvedValue({}),
                        clearSagaProgress: jest.fn().mockResolvedValue(undefined),
                        setSagaMetadata: jest.fn().mockResolvedValue(undefined),
                        getSagaMetadata: jest.fn().mockResolvedValue({}),
                        cleanup: jest.fn().mockResolvedValue(undefined),
                        getStats: jest.fn().mockResolvedValue({
                            pendingSagas: 0,
                            lockedSagas: 0,
                            cachedStates: 0,
                        }),
                    },
                },
            ],
        }).compile();

        saga = module.get<TravelBookingSaga>(TravelBookingSaga);
        flightService = module.get<FlightService>(FlightService);
        hotelService = module.get<HotelService>(HotelService);
        carRentalService = module.get<CarRentalService>(CarRentalService);
        eventBus = module.get<EventBus>(EventBus);
        billingBrokerClient = module.get<BillingBrokerClient>(BILLING_BROKER_CLIENT);
        sagaStateRepository = module.get<TravelBookingSagaStateRepository>(TravelBookingSagaStateRepository);
        sagaCoordinator = module.get<SagaCoordinator>(SagaCoordinator);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Hybrid MongoDB + Redis Flow', () => {
        it('should execute saga with distributed lock, rate limit, and state persistence', async () => {
            const result = await saga.execute(mockTravelBookingDto);

            // Verify Redis coordination
            expect(sagaCoordinator.acquireSagaLock).toHaveBeenCalledWith(result.bookingId, 300);
            expect(sagaCoordinator.checkRateLimit).toHaveBeenCalledWith(mockTravelBookingDto.userId, 5);
            expect(sagaCoordinator.cacheInFlightState).toHaveBeenCalledWith(
                result.bookingId,
                expect.objectContaining({
                    bookingId: result.bookingId,
                    userId: mockTravelBookingDto.userId,
                    status: 'PENDING',
                }),
                3600,
            );
            expect(sagaCoordinator.addToPendingQueue).toHaveBeenCalledWith(result.bookingId);
            expect(sagaCoordinator.incrementStepCounter).toHaveBeenCalledTimes(3);
            expect(sagaCoordinator.releaseSagaLock).toHaveBeenCalledWith(result.bookingId);

            // Verify MongoDB persistence
            expect(sagaStateRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    bookingId: result.bookingId,
                    userId: mockTravelBookingDto.userId,
                    status: SagaStatus.PENDING,
                    totalAmount: mockTravelBookingDto.totalAmount,
                }),
            );

            // Verify broker events published
            expect(billingBrokerClient.emit).toHaveBeenCalledTimes(3);
            expect(billingBrokerClient.emit).toHaveBeenCalledWith('reservation.hotel.requested', expect.any(Promise));
            expect(billingBrokerClient.emit).toHaveBeenCalledWith('reservation.flight.requested', expect.any(Promise));
            expect(billingBrokerClient.emit).toHaveBeenCalledWith(
                'reservation.carRental.requested',
                expect.any(Promise),
            );

            // Verify result
            expect(result.status).toBe('pending');
            expect(result.bookingId).toBeDefined();
        });

        it('should fail if distributed lock cannot be acquired', async () => {
            jest.spyOn(sagaCoordinator, 'acquireSagaLock').mockResolvedValue(false);

            const result = await saga.execute(mockTravelBookingDto);

            expect(result.status).toBe('failed');
            expect(result.errorMessage).toContain('already in progress');
            expect(sagaStateRepository.create).not.toHaveBeenCalled();
            expect(billingBrokerClient.emit).not.toHaveBeenCalled();
        });

        it('should fail if rate limit exceeded', async () => {
            jest.spyOn(sagaCoordinator, 'checkRateLimit').mockResolvedValue(false);

            const result = await saga.execute(mockTravelBookingDto);

            expect(result.status).toBe('failed');
            expect(result.errorMessage).toContain('Rate limit exceeded');
            expect(sagaStateRepository.setError).toHaveBeenCalled();
            expect(sagaCoordinator.releaseSagaLock).toHaveBeenCalled();
        });

        it('should save error to MongoDB and Redis metadata on failure', async () => {
            const error = new Error('Broker unavailable');
            jest.spyOn(billingBrokerClient, 'emit').mockRejectedValue(error);

            const result = await saga.execute(mockTravelBookingDto);

            expect(result.status).toBe('failed');
            expect(sagaStateRepository.setError).toHaveBeenCalledWith(
                result.bookingId,
                'Broker unavailable',
                expect.any(String),
            );
            expect(sagaCoordinator.setSagaMetadata).toHaveBeenCalledWith(
                result.bookingId,
                expect.objectContaining({
                    error: 'Broker unavailable',
                }),
            );
            expect(sagaCoordinator.releaseSagaLock).toHaveBeenCalledWith(result.bookingId);
        });

        it('should always release lock even if error occurs', async () => {
            jest.spyOn(sagaStateRepository, 'create').mockRejectedValue(new Error('MongoDB down'));

            const result = await saga.execute(mockTravelBookingDto);

            expect(result.status).toBe('failed');
            expect(sagaCoordinator.releaseSagaLock).toHaveBeenCalledWith(result.bookingId);
        });

        it('should track saga steps in Redis', async () => {
            await saga.execute(mockTravelBookingDto);

            expect(sagaCoordinator.incrementStepCounter).toHaveBeenCalledWith(expect.any(String), 'hotel_requested');
            expect(sagaCoordinator.incrementStepCounter).toHaveBeenCalledWith(expect.any(String), 'flight_requested');
            expect(sagaCoordinator.incrementStepCounter).toHaveBeenCalledWith(expect.any(String), 'car_requested');
        });
    });

    describe('Aggregate Results with Hybrid Approach', () => {
        const mockBookingId = 'test-booking-id';
        const mockFlightResult = {
            reservationId: 'flight-123',
            confirmationCode: 'FL123',
            status: 'confirmed' as const,
            amount: 1000,
        };
        const mockHotelResult = {
            reservationId: 'hotel-456',
            hotelId: 'hotel-456',
            checkInDate: '2026-03-01',
            checkOutDate: '2026-03-08',
            amount: 1200,
            timestamp: new Date().toISOString(),
            confirmationCode: 'HT456',
            status: 'confirmed',
        };
        const mockCarResult = {
            reservationId: 'car-789',
            confirmationCode: 'CR789',
            status: 'confirmed' as const,
            amount: 300,
        };

        it('should use cached state from Redis before falling back to MongoDB', async () => {
            const cachedState = {
                bookingId: mockBookingId,
                userId: 'user-123',
                status: 'PENDING',
                originalRequest: mockTravelBookingDto,
            };
            jest.spyOn(sagaCoordinator, 'getInFlightState').mockResolvedValue(cachedState);

            const result = await saga.aggregateResults(mockBookingId, mockFlightResult, mockHotelResult, mockCarResult);

            expect(sagaCoordinator.getInFlightState).toHaveBeenCalledWith(mockBookingId);
            expect(sagaStateRepository.findByBookingId).not.toHaveBeenCalled(); // Cache hit
            expect(result.status).toBe('confirmed');
        });

        it('should fallback to MongoDB if Redis cache miss', async () => {
            jest.spyOn(sagaCoordinator, 'getInFlightState').mockResolvedValue(null);

            const result = await saga.aggregateResults(mockBookingId, mockFlightResult, mockHotelResult, mockCarResult);

            expect(sagaCoordinator.getInFlightState).toHaveBeenCalledWith(mockBookingId);
            expect(sagaStateRepository.findByBookingId).toHaveBeenCalledWith(mockBookingId);
            expect(result.status).toBe('confirmed');
        });

        it('should update final state in MongoDB', async () => {
            await saga.aggregateResults(mockBookingId, mockFlightResult, mockHotelResult, mockCarResult);

            expect(sagaStateRepository.updateState).toHaveBeenCalledWith(
                mockBookingId,
                expect.objectContaining({
                    flightReservationId: mockFlightResult.reservationId,
                    hotelReservationId: mockHotelResult.reservationId,
                    carRentalReservationId: mockCarResult.reservationId,
                    status: SagaStatus.CONFIRMED,
                }),
            );
        });

        it('should cleanup Redis coordination data after success', async () => {
            await saga.aggregateResults(mockBookingId, mockFlightResult, mockHotelResult, mockCarResult);

            expect(sagaCoordinator.incrementStepCounter).toHaveBeenCalledWith(mockBookingId, 'aggregated');
            expect(sagaCoordinator.removeFromPendingQueue).toHaveBeenCalledWith(mockBookingId);
            expect(sagaCoordinator.cleanup).toHaveBeenCalledWith(mockBookingId);
        });

        it('should throw error if saga state not found', async () => {
            jest.spyOn(sagaCoordinator, 'getInFlightState').mockResolvedValue(null);
            jest.spyOn(sagaStateRepository, 'findByBookingId').mockResolvedValue(null);

            await expect(
                saga.aggregateResults(mockBookingId, mockFlightResult, mockHotelResult, mockCarResult),
            ).rejects.toThrow('Saga state not found');
        });

        it('should save error metadata to Redis on aggregation failure', async () => {
            const error = new Error('Network timeout');
            jest.spyOn(sagaStateRepository, 'updateState').mockRejectedValue(error);

            await expect(
                saga.aggregateResults(mockBookingId, mockFlightResult, mockHotelResult, mockCarResult),
            ).rejects.toThrow('Network timeout');

            expect(sagaStateRepository.setError).toHaveBeenCalledWith(mockBookingId, 'Network timeout');
            expect(sagaCoordinator.setSagaMetadata).toHaveBeenCalledWith(
                mockBookingId,
                expect.objectContaining({
                    error: 'Network timeout',
                    step: 'aggregation',
                }),
                7200,
            );
        });
    });

    describe('Redis Coordination Edge Cases', () => {
        it('should handle Redis being unavailable gracefully', async () => {
            jest.spyOn(sagaCoordinator, 'acquireSagaLock').mockRejectedValue(new Error('Redis connection failed'));

            const result = await saga.execute(mockTravelBookingDto);

            // Saga should fail but handle error gracefully
            expect(result.status).toBe('failed');
        });

        it('should handle MongoDB being unavailable', async () => {
            jest.spyOn(sagaStateRepository, 'create').mockRejectedValue(new Error('MongoDB connection failed'));

            const result = await saga.execute(mockTravelBookingDto);

            expect(result.status).toBe('failed');
            expect(result.errorMessage).toContain('MongoDB connection failed');
            expect(sagaCoordinator.releaseSagaLock).toHaveBeenCalled(); // Lock always released
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limit of 5 bookings per minute per user', async () => {
            jest.spyOn(sagaCoordinator, 'checkRateLimit').mockResolvedValue(false);

            const result = await saga.execute(mockTravelBookingDto);

            expect(sagaCoordinator.checkRateLimit).toHaveBeenCalledWith(mockTravelBookingDto.userId, 5);
            expect(result.status).toBe('failed');
            expect(result.errorMessage).toContain('Rate limit exceeded');
        });
    });
});
