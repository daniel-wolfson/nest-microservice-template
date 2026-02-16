import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { TravelBookingSaga } from '../../src/modules/billing/sagas/travel-booking.saga';
import { FlightService } from '../../src/modules/billing/services/flight.service';
import { HotelService } from '../../src/modules/billing/services/hotel.service';
import { CarRentalService } from '../../src/modules/billing/services/car-rental.service';
import { TravelBookingDto } from '../../src/modules/billing/dto/travel-booking.dto';

describe('TravelBookingSaga', () => {
    let saga: TravelBookingSaga;
    let flightService: FlightService;
    let hotelService: HotelService;
    let carRentalService: CarRentalService;
    let eventBus: EventBus;

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
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Successful Saga Flow', () => {
        it('should complete all steps successfully when no failures occur', async () => {
            // Mock successful responses
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

            const dto: TravelBookingDto = {
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

            const result = await saga.execute(dto);

            expect(result.status).toBe('confirmed');
            expect(result.flightReservationId).toBe('FLT-123');
            expect(result.hotelReservationId).toBe('HTL-456');
            expect(result.carRentalReservationId).toBe('CAR-789');
            expect(result.bookingId).toBeDefined();
            expect(result.errorMessage).toBeUndefined();
        });
    });

    describe('Compensation Flow', () => {
        it('should compensate when car rental fails', async () => {
            // Mock successful flight and hotel
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

            // Mock compensation methods
            const cancelFlightSpy = jest.spyOn(flightService, 'cancelFlight').mockResolvedValue();
            const cancelHotelSpy = jest.spyOn(hotelService, 'cancelHotel').mockResolvedValue();
            const cancelCarSpy = jest.spyOn(carRentalService, 'cancelCar').mockResolvedValue();

            const dto: TravelBookingDto = {
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

            const result = await saga.execute(dto);

            // Verify result
            expect(result.status).toBe('compensated');
            expect(result.errorMessage).toBe('No available cars');
            expect(result.flightReservationId).toBe('FLT-123');
            expect(result.hotelReservationId).toBe('HTL-456');

            // Verify compensations were called (car was never reserved, so not cancelled)
            expect(cancelFlightSpy).toHaveBeenCalledWith('FLT-123');
            expect(cancelHotelSpy).toHaveBeenCalledWith('HTL-456');
            expect(cancelCarSpy).not.toHaveBeenCalled();
        });

        it('should compensate all steps when hotel fails', async () => {
            // Mock successful flight
            jest.spyOn(flightService, 'reserveFlight').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: 'confirmed',
                amount: 1000,
            });

            // Mock hotel failure
            jest.spyOn(hotelService, 'reserveHotel').mockRejectedValue(new Error('No available rooms'));

            // Mock compensation methods
            const cancelFlightSpy = jest.spyOn(flightService, 'cancelFlight').mockResolvedValue();
            const cancelHotelSpy = jest.spyOn(hotelService, 'cancelHotel').mockResolvedValue();
            const cancelCarSpy = jest.spyOn(carRentalService, 'cancelCar').mockResolvedValue();

            const dto: TravelBookingDto = {
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

            const result = await saga.execute(dto);

            // Verify result
            expect(result.status).toBe('compensated');
            expect(result.errorMessage).toBe('No available rooms');
            expect(result.flightReservationId).toBe('FLT-123');

            // Verify compensations - only flight was reserved
            expect(cancelFlightSpy).toHaveBeenCalledWith('FLT-123');
            expect(cancelHotelSpy).not.toHaveBeenCalled();
            expect(cancelCarSpy).not.toHaveBeenCalled();
        });

        it('should compensate only flight when flight succeeds but hotel fails', async () => {
            jest.spyOn(flightService, 'reserveFlight').mockResolvedValue({
                reservationId: 'FLT-123',
                confirmationCode: 'ABC123',
                status: 'confirmed',
                amount: 1000,
            });

            jest.spyOn(hotelService, 'reserveHotel').mockRejectedValue(new Error('Hotel service unavailable'));

            const cancelFlightSpy = jest.spyOn(flightService, 'cancelFlight').mockResolvedValue();

            const dto: TravelBookingDto = {
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

            const result = await saga.execute(dto);

            expect(result.status).toBe('compensated');
            expect(cancelFlightSpy).toHaveBeenCalledWith('FLT-123');
        });
    });

    describe('Service Calls', () => {
        it('should call services in correct order', async () => {
            const callOrder: string[] = [];

            jest.spyOn(flightService, 'reserveFlight').mockImplementation(async () => {
                callOrder.push('flight');
                return {
                    reservationId: 'FLT-123',
                    confirmationCode: 'ABC123',
                    status: 'confirmed',
                    amount: 1000,
                };
            });

            jest.spyOn(hotelService, 'reserveHotel').mockImplementation(async () => {
                callOrder.push('hotel');
                return {
                    reservationId: 'HTL-456',
                    confirmationCode: 'DEF456',
                    status: 'confirmed',
                    amount: 875,
                };
            });

            jest.spyOn(carRentalService, 'reserveCar').mockImplementation(async () => {
                callOrder.push('car');
                return {
                    reservationId: 'CAR-789',
                    confirmationCode: 'GHI789',
                    status: 'confirmed',
                    amount: 625,
                };
            });

            const dto: TravelBookingDto = {
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

            await saga.execute(dto);

            expect(callOrder).toEqual(['flight', 'hotel', 'car']);
        });
    });
});
