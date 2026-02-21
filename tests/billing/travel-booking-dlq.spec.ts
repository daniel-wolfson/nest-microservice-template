import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { TravelBookingSaga } from '@/modules/billing/sagas/travel-booking.saga';
import { FlightService } from '@/modules/billing/services/flight.service';
import { HotelService } from '@/modules/billing/services/hotel.service';
import { CarRentalService } from '@/modules/billing/services/car-rental.service';
import { BookingData } from '@/modules/billing/dto/booking-data.dto';
import { CompensationFailedEvent } from '@/modules/billing/events/impl/compensation-failed.event';
import { TravelBookingSagaStateRepository } from '@/modules/billing/sagas/travel-booking-saga-state.repository';
import { SagaCoordinator } from '@/modules/billing/sagas/saga-coordinator.service';
import { BILLING_BROKER_CLIENT } from '@/modules/billing/brokers/billing-broker.constants';
import { SagaStatus } from '@/modules/billing/sagas/saga-status.enum';

describe.skip('TravelBookingSaga - Dead Letter Queue', () => {
    let saga: TravelBookingSaga;
    let flightService: FlightService;
    let hotelService: HotelService;
    let carRentalService: CarRentalService;
    let sagaStateRepository: TravelBookingSagaStateRepository;
    let eventBus: EventBus;
    let sagaCoordinator: SagaCoordinator;
    let publishSpy: jest.SpyInstance;

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
                    provide: TravelBookingSagaStateRepository,
                    useValue: {
                        create: jest.fn().mockResolvedValue({
                            bookingId: 'test-booking-id',
                            status: SagaStatus.PENDING,
                        }),
                        findByBookingId: jest.fn().mockResolvedValue(null),
                        updateState: jest.fn().mockResolvedValue({}),
                        setError: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: SagaCoordinator,
                    useValue: {
                        acquireSagaLock: jest.fn().mockResolvedValue(true),
                        releaseSagaLock: jest.fn().mockResolvedValue(undefined),
                        checkRateLimit: jest.fn().mockResolvedValue(true),
                        cacheActiveSagaState: jest.fn().mockResolvedValue(undefined),
                        addToPendingQueue: jest.fn().mockResolvedValue(undefined),
                        incrementStepCounter: jest.fn().mockResolvedValue(1),
                        setSagaMetadata: jest.fn().mockResolvedValue(undefined),
                        cleanup: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: BILLING_BROKER_CLIENT,
                    useValue: {
                        emit: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        }).compile();

        saga = module.get<TravelBookingSaga>(TravelBookingSaga);
        flightService = module.get<FlightService>(FlightService);
        hotelService = module.get<HotelService>(HotelService);
        carRentalService = module.get<CarRentalService>(CarRentalService);
        eventBus = module.get<EventBus>(EventBus);
        sagaStateRepository = module.get<TravelBookingSagaStateRepository>(TravelBookingSagaStateRepository);
        sagaCoordinator = module.get<SagaCoordinator>(SagaCoordinator);
        publishSpy = jest.spyOn(eventBus, 'publish');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const createMockDto = (): BookingData => ({
        requestId: 'mock-reservation-' + Date.now(),
        userId: 'user-123',
        flightOrigin: 'JFK',
        flightDestination: 'LAX',
        departureDate: '2026-03-15',
        returnDate: '2026-03-22',
        hotelId: 'hilton-downtown-la',
        checkInDate: '2026-03-15',
        checkOutDate: '2026-03-22',
        carPickupLocation: 'LAX Airport',
        carDropoffLocation: 'LAX Airport',
        carPickupDate: '2026-03-15',
        carDropoffDate: '2026-03-22',
        totalAmount: 2500,
    });

    describe('Compensation Failure Scenarios', () => {
        it('should publish CompensationFailedEvent to Dead Letter Queue when flight cancellation fails', async () => {
            // Mock successful reservations
            jest.spyOn(flightService, 'makeReservation').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: SagaStatus.CONFIRMED,
                amount: 1000,
            });

            jest.spyOn(hotelService, 'makeReservation').mockResolvedValue({
                reservationId: 'HTL-456',
                hotelId: 'hilton-downtown-la',
                checkInDate: '2026-03-15',
                checkOutDate: '2026-03-22',
                confirmationCode: 'DEF456',
                status: SagaStatus.CONFIRMED,
                amount: 875,
                timestamp: new Date().toISOString(),
            });

            // Mock car rental failure
            jest.spyOn(carRentalService, 'makeReservation').mockRejectedValue(new Error('No available cars'));

            // Mock successful hotel cancellation
            jest.spyOn(hotelService, 'cancelReservation').mockResolvedValue();

            // Mock FAILED flight cancellation
            const compensationError = new Error('Flight cancellation API unavailable');
            jest.spyOn(flightService, 'cancelReservation').mockRejectedValue(compensationError);

            const dto = createMockDto();
            const result = await saga.execute(dto);

            // Verify saga was compensated
            expect(result.status).toBe('compensated');

            // Verify CompensationFailedEvent was published for flight
            expect(publishSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    compensationType: 'flight',
                    reservationId: 'FLT-123',
                    errorMessage: 'Flight cancellation API unavailable',
                }),
            );

            // Verify event is of correct type
            const publishedEvents = publishSpy.mock.calls.map(call => call[0]);
            const compensationFailedEvents = publishedEvents.filter(event => event instanceof CompensationFailedEvent);
            expect(compensationFailedEvents.length).toBe(1);
            expect(compensationFailedEvents[0].compensationType).toBe('flight');
        });

        it('should publish CompensationFailedEvent when hotel cancellation fails', async () => {
            // Mock successful reservations
            jest.spyOn(flightService, 'makeReservation').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: SagaStatus.CONFIRMED,
                amount: 1000,
            });

            jest.spyOn(hotelService, 'makeReservation').mockResolvedValue({
                reservationId: 'HTL-456',
                hotelId: 'hilton-downtown-la',
                checkInDate: '2026-03-15',
                checkOutDate: '2026-03-22',
                confirmationCode: 'DEF456',
                status: SagaStatus.CONFIRMED,
                amount: 875,
                timestamp: new Date().toISOString(),
            });
            jest.spyOn(carRentalService, 'makeReservation').mockRejectedValue(new Error('No available cars'));

            // Mock FAILED hotel cancellation
            const hotelError = new Error('Hotel cancellation system down');
            jest.spyOn(hotelService, 'cancelReservation').mockRejectedValue(hotelError);

            // Mock successful flight cancellation
            jest.spyOn(flightService, 'cancelReservation').mockResolvedValue();

            const dto = createMockDto();
            await saga.execute(dto);

            // Verify CompensationFailedEvent was published for hotel
            expect(publishSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    compensationType: 'hotel',
                    reservationId: 'HTL-456',
                    errorMessage: 'Hotel cancellation system down',
                }),
            );
        });

        it('should publish multiple CompensationFailedEvents when multiple compensations fail', async () => {
            // Mock successful reservations
            jest.spyOn(flightService, 'makeReservation').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: SagaStatus.CONFIRMED,
                amount: 1000,
            });

            jest.spyOn(hotelService, 'makeReservation').mockResolvedValue({
                reservationId: 'HTL-456',
                hotelId: 'hilton-downtown-la',
                checkInDate: '2026-03-15',
                checkOutDate: '2026-03-22',
                confirmationCode: 'DEF456',
                status: SagaStatus.CONFIRMED,
                amount: 875,
                timestamp: new Date().toISOString(),
            });

            jest.spyOn(carRentalService, 'makeReservation').mockResolvedValue({
                reservationId: 'CAR-789',
                confirmationCode: 'GHI789',
                status: SagaStatus.CONFIRMED,
                amount: 625,
            });

            // Mock payment failure to trigger compensation
            jest.spyOn(saga as any, 'processPayment').mockRejectedValue(new Error('Payment processing failed'));

            // Mock ALL cancellations fail
            jest.spyOn(carRentalService, 'cancelReservation').mockRejectedValue(
                new Error('Car cancellation API timeout'),
            );
            jest.spyOn(hotelService, 'cancelReservation').mockRejectedValue(new Error('Hotel cancellation failed'));
            jest.spyOn(flightService, 'cancelReservation').mockRejectedValue(new Error('Flight cancellation failed'));

            const dto = createMockDto();
            await saga.execute(dto);

            // Verify THREE CompensationFailedEvents were published
            const publishedEvents = publishSpy.mock.calls.map(call => call[0]);
            const compensationFailedEvents = publishedEvents.filter(event => event instanceof CompensationFailedEvent);

            expect(compensationFailedEvents.length).toBe(3);

            // Verify each type is present
            const types = compensationFailedEvents.map(e => e.compensationType);
            expect(types).toContain('car');
            expect(types).toContain('hotel');
            expect(types).toContain('flight');
        });

        it('should include error stack in CompensationFailedEvent', async () => {
            jest.spyOn(flightService, 'makeReservation').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: SagaStatus.CONFIRMED,
                amount: 1000,
            });

            // Mock hotel failure
            jest.spyOn(hotelService, 'makeReservation').mockRejectedValue(new Error('Hotel unavailable'));

            // Mock flight cancellation failure with proper Error object
            const errorWithStack = new Error('Database connection lost');
            jest.spyOn(flightService, 'cancelReservation').mockRejectedValue(errorWithStack);

            const dto = createMockDto();
            await saga.execute(dto);

            // Verify error stack is included
            const publishedEvents = publishSpy.mock.calls.map(call => call[0]);
            const compensationFailedEvent = publishedEvents.find(event => event instanceof CompensationFailedEvent);

            expect(compensationFailedEvent).toBeDefined();
            expect(compensationFailedEvent.errorStack).toBeDefined();
            expect(compensationFailedEvent.errorStack).toContain('Database connection lost');
        });

        it('should include booking ID in CompensationFailedEvent', async () => {
            jest.spyOn(flightService, 'makeReservation').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: SagaStatus.CONFIRMED,
                amount: 1000,
            });

            jest.spyOn(hotelService, 'makeReservation').mockRejectedValue(new Error('No rooms available'));

            jest.spyOn(flightService, 'cancelReservation').mockRejectedValue(new Error('Cancellation failed'));

            const dto = createMockDto();
            const result = await saga.execute(dto);

            // Verify bookingId is in the event
            expect(publishSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    bookingId: result.bookingId,
                    compensationType: 'flight',
                }),
            );
        });

        it('should continue compensating other services even when one compensation fails', async () => {
            jest.spyOn(flightService, 'makeReservation').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: SagaStatus.CONFIRMED,
                amount: 1000,
            });

            jest.spyOn(hotelService, 'makeReservation').mockResolvedValue({
                reservationId: 'HTL-456',
                hotelId: 'hilton-downtown-la',
                checkInDate: '2026-03-15',
                checkOutDate: '2026-03-22',
                confirmationCode: 'DEF456',
                status: SagaStatus.CONFIRMED,
                amount: 875,
                timestamp: new Date().toISOString(),
            });
            jest.spyOn(carRentalService, 'makeReservation').mockRejectedValue(new Error('No cars'));

            // Hotel cancellation fails
            jest.spyOn(hotelService, 'cancelReservation').mockRejectedValue(new Error('Hotel cancellation failed'));

            // Flight cancellation succeeds
            const cancelFlightSpy = jest.spyOn(flightService, 'cancelReservation').mockResolvedValue();

            const dto = createMockDto();
            await saga.execute(dto);

            // Verify flight cancellation was still attempted and succeeded
            expect(cancelFlightSpy).toHaveBeenCalled();

            // Verify only hotel compensation failure event was published
            const publishedEvents = publishSpy.mock.calls.map(call => call[0]);
            const compensationFailedEvents = publishedEvents.filter(event => event instanceof CompensationFailedEvent);

            expect(compensationFailedEvents.length).toBe(1);
            expect(compensationFailedEvents[0].compensationType).toBe('hotel');
        });
    });
});
