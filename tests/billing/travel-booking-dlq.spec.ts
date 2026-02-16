import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { TravelBookingSaga } from '../../src/modules/billing/sagas/travel-booking.saga';
import { FlightService } from '../../src/modules/billing/services/flight.service';
import { HotelService } from '../../src/modules/billing/services/hotel.service';
import { CarRentalService } from '../../src/modules/billing/services/car-rental.service';
import { TravelBookingDto } from '../../src/modules/billing/dto/travel-booking.dto';
import { CompensationFailedEvent } from '../../src/modules/billing/events/impl/compensation-failed.event';

describe('TravelBookingSaga - Dead Letter Queue', () => {
    let saga: TravelBookingSaga;
    let flightService: FlightService;
    let hotelService: HotelService;
    let carRentalService: CarRentalService;
    let eventBus: EventBus;
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
            ],
        }).compile();

        saga = module.get<TravelBookingSaga>(TravelBookingSaga);
        flightService = module.get<FlightService>(FlightService);
        hotelService = module.get<HotelService>(HotelService);
        carRentalService = module.get<CarRentalService>(CarRentalService);
        eventBus = module.get<EventBus>(EventBus);
        publishSpy = jest.spyOn(eventBus, 'publish');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const createMockDto = (): TravelBookingDto => ({
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
            jest.spyOn(flightService, 'reserveFlight').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: 'confirmed',
                amount: 1000,
            });

            jest.spyOn(hotelService, 'reserveHotel').mockResolvedValue({
                reservationId: 'HTL-456',
                confirmationCode: 'DEF456',
                status: 'confirmed',
                amount: 875,
            });

            // Mock car rental failure
            jest.spyOn(carRentalService, 'reserveCar').mockRejectedValue(new Error('No available cars'));

            // Mock successful hotel cancellation
            jest.spyOn(hotelService, 'cancelHotel').mockResolvedValue();

            // Mock FAILED flight cancellation
            const compensationError = new Error('Flight cancellation API unavailable');
            jest.spyOn(flightService, 'cancelFlight').mockRejectedValue(compensationError);

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
            jest.spyOn(flightService, 'reserveFlight').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: 'confirmed',
                amount: 1000,
            });

            jest.spyOn(hotelService, 'reserveHotel').mockResolvedValue({
                reservationId: 'HTL-456',
                confirmationCode: 'DEF456',
                status: 'confirmed',
                amount: 875,
            });

            // Mock car rental failure to trigger compensation
            jest.spyOn(carRentalService, 'reserveCar').mockRejectedValue(new Error('No available cars'));

            // Mock FAILED hotel cancellation
            const hotelError = new Error('Hotel cancellation system down');
            jest.spyOn(hotelService, 'cancelHotel').mockRejectedValue(hotelError);

            // Mock successful flight cancellation
            jest.spyOn(flightService, 'cancelFlight').mockResolvedValue();

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
            jest.spyOn(flightService, 'reserveFlight').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: 'confirmed',
                amount: 1000,
            });

            jest.spyOn(hotelService, 'reserveHotel').mockResolvedValue({
                reservationId: 'HTL-456',
                confirmationCode: 'DEF456',
                status: 'confirmed',
                amount: 875,
            });

            jest.spyOn(carRentalService, 'reserveCar').mockResolvedValue({
                reservationId: 'CAR-789',
                confirmationCode: 'GHI789',
                status: 'confirmed',
                amount: 625,
            });

            // Mock payment failure to trigger compensation
            jest.spyOn(saga as any, 'processPayment').mockRejectedValue(new Error('Payment processing failed'));

            // Mock ALL cancellations fail
            jest.spyOn(carRentalService, 'cancelCar').mockRejectedValue(new Error('Car cancellation API timeout'));
            jest.spyOn(hotelService, 'cancelHotel').mockRejectedValue(new Error('Hotel cancellation failed'));
            jest.spyOn(flightService, 'cancelFlight').mockRejectedValue(new Error('Flight cancellation failed'));

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
            jest.spyOn(flightService, 'reserveFlight').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: 'confirmed',
                amount: 1000,
            });

            // Mock hotel failure
            jest.spyOn(hotelService, 'reserveHotel').mockRejectedValue(new Error('Hotel unavailable'));

            // Mock flight cancellation failure with proper Error object
            const errorWithStack = new Error('Database connection lost');
            jest.spyOn(flightService, 'cancelFlight').mockRejectedValue(errorWithStack);

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
            jest.spyOn(flightService, 'reserveFlight').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: 'confirmed',
                amount: 1000,
            });

            jest.spyOn(hotelService, 'reserveHotel').mockRejectedValue(new Error('No rooms available'));

            jest.spyOn(flightService, 'cancelFlight').mockRejectedValue(new Error('Cancellation failed'));

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
            jest.spyOn(flightService, 'reserveFlight').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: 'confirmed',
                amount: 1000,
            });

            jest.spyOn(hotelService, 'reserveHotel').mockResolvedValue({
                reservationId: 'HTL-456',
                confirmationCode: 'DEF456',
                status: 'confirmed',
                amount: 875,
            });

            // Trigger compensation with car rental failure
            jest.spyOn(carRentalService, 'reserveCar').mockRejectedValue(new Error('No cars'));

            // Hotel cancellation fails
            jest.spyOn(hotelService, 'cancelHotel').mockRejectedValue(new Error('Hotel cancellation failed'));

            // Flight cancellation succeeds
            const cancelFlightSpy = jest.spyOn(flightService, 'cancelFlight').mockResolvedValue();

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
