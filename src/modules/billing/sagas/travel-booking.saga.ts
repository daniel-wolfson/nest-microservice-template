import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { FlightService } from '../services/flight.service';
import { HotelService } from '../services/hotel.service';
import { CarRentalService } from '../services/car-rental.service';
import { TravelBookingDto, TravelBookingResponseDto } from '../dto/travel-booking.dto';
import { FlightReservationDto, FlightReservationResult } from '../dto/flight-reservation.dto';
import { HotelReservationDto, HotelReservationResult } from '../dto/hotel-reservation.dto';
import { CarRentalReservationDto, CarRentalReservationResult } from '../dto/car-rental-reservation.dto';
import { CompensationFailedEvent } from '../events/impl/compensation-failed.event';

/**
 * Travel Booking Saga Orchestrator
 *
 * Implements the Saga pattern for distributed transactions across multiple services:
 * Flight → Hotel → Car Rental → Payment
 *
 * If any step fails, compensation transactions are executed in reverse order:
 * Cancel Car → Cancel Hotel → Cancel Flight
 *
 * This ensures eventual consistency and handles failure scenarios gracefully.
 */
@Injectable()
export class TravelBookingSaga {
    private readonly logger = new Logger(TravelBookingSaga.name);

    constructor(
        private readonly flightService: FlightService,
        private readonly hotelService: HotelService,
        private readonly carRentalService: CarRentalService,
        private readonly eventBus: EventBus,
    ) {}

    /**
     * Execute the travel booking saga
     * Returns a response with the booking status and details
     */
    async execute(dto: TravelBookingDto): Promise<TravelBookingResponseDto> {
        const bookingId = this.generateBookingId();
        let flightReservation: FlightReservationResult | null = null;
        let hotelReservation: HotelReservationResult | null = null;
        let carRentalReservation: CarRentalReservationResult | null = null;

        this.logger.log(`Starting Travel Booking Saga: ${bookingId}`);
        this.logger.log(`User: ${dto.userId}, Total Amount: $${dto.totalAmount}`);

        try {
            // Step 1: Reserve Flight
            flightReservation = await this.reserveFlight(dto);
            this.logger.log(`✓ Step 1 Complete: Flight Reserved (${flightReservation.reservationId})`);

            // Step 2: Reserve Hotel
            hotelReservation = await this.reserveHotel(dto);
            this.logger.log(`✓ Step 2 Complete: Hotel Reserved (${hotelReservation.reservationId})`);

            // Step 3: Reserve Car
            carRentalReservation = await this.reserveCar(dto);
            this.logger.log(`✓ Step 3 Complete: Car Reserved (${carRentalReservation.reservationId})`);

            // Step 4: Process Payment (simulated)
            await this.processPayment(dto.userId, dto.totalAmount);
            this.logger.log(`✓ Step 4 Complete: Payment Processed`);

            // All steps successful
            this.logger.log(`✅ Travel Booking Saga Completed Successfully: ${bookingId}`);

            return {
                bookingId,
                flightReservationId: flightReservation.reservationId,
                hotelReservationId: hotelReservation.reservationId,
                carRentalReservationId: carRentalReservation.reservationId,
                status: 'confirmed',
                timestamp: new Date(),
            };
        } catch (error) {
            // Saga failed - execute compensating transactions
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`❌ Travel Booking Saga Failed: ${errorMessage}`);
            this.logger.warn(`🔄 Starting Compensation Process...`);

            await this.compensate(bookingId, flightReservation, hotelReservation, carRentalReservation);

            return {
                bookingId,
                flightReservationId: flightReservation?.reservationId,
                hotelReservationId: hotelReservation?.reservationId,
                carRentalReservationId: carRentalReservation?.reservationId,
                status: 'compensated',
                errorMessage,
                timestamp: new Date(),
            };
        }
    }

    /**
     * Step 1: Reserve Flight
     */
    private async reserveFlight(dto: TravelBookingDto): Promise<FlightReservationResult> {
        this.logger.log(`Step 1: Reserving Flight...`);

        const flightDto: FlightReservationDto = {
            userId: dto.userId,
            origin: dto.flightOrigin,
            destination: dto.flightDestination,
            departureDate: dto.departureDate,
            returnDate: dto.returnDate,
            amount: dto.totalAmount * 0.4, // 40% of total
        };

        return await this.flightService.reserveFlight(flightDto);
    }

    /**
     * Step 2: Reserve Hotel
     */
    private async reserveHotel(dto: TravelBookingDto): Promise<HotelReservationResult> {
        this.logger.log(`Step 2: Reserving Hotel...`);

        const hotelDto: HotelReservationDto = {
            userId: dto.userId,
            hotelId: dto.hotelId,
            checkInDate: dto.checkInDate,
            checkOutDate: dto.checkOutDate,
            amount: dto.totalAmount * 0.35, // 35% of total
        };

        return await this.hotelService.reserveHotel(hotelDto);
    }

    /**
     * Step 3: Reserve Car
     */
    private async reserveCar(dto: TravelBookingDto): Promise<CarRentalReservationResult> {
        this.logger.log(`Step 3: Reserving Car...`);

        const carDto: CarRentalReservationDto = {
            userId: dto.userId,
            pickupLocation: dto.carPickupLocation,
            dropoffLocation: dto.carDropoffLocation,
            pickupDate: dto.carPickupDate,
            dropoffDate: dto.carDropoffDate,
            amount: dto.totalAmount * 0.25, // 25% of total
        };

        return await this.carRentalService.reserveCar(carDto);
    }

    /**
     * Step 4: Process Payment (simulated)
     */
    private async processPayment(userId: string, amount: number): Promise<void> {
        this.logger.log(`Step 4: Processing Payment of $${amount}...`);

        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate occasional payment failures
        if (Math.random() < 0.05) {
            throw new Error('Payment processing failed');
        }
    }

    /**
     * Compensate - Execute compensating transactions in reverse order
     * This is the heart of the Saga pattern
     * 
     * If any compensation fails, publishes CompensationFailedEvent to Dead Letter Queue
     */
    private async compensate(
        bookingId: string,
        flightReservation: FlightReservationResult | null,
        hotelReservation: HotelReservationResult | null,
        carRentalReservation: CarRentalReservationResult | null,
    ): Promise<void> {
        const compensations: Array<() => Promise<void>> = [];

        // Build compensation stack in reverse order
        if (carRentalReservation) {
            compensations.push(async () => {
                try {
                    await this.carRentalService.cancelCar(carRentalReservation.reservationId);
                    this.logger.log(`✓ Compensated: Car rental cancelled`);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const errorStack = error instanceof Error ? error.stack : undefined;
                    this.logger.error(`Failed to cancel car rental: ${errorMessage}`);
                    
                    // Publish to Dead Letter Queue
                    const deadLetterEvent = new CompensationFailedEvent(
                        bookingId,
                        'car',
                        carRentalReservation.reservationId,
                        errorMessage,
                        errorStack,
                    );
                    this.eventBus.publish(deadLetterEvent);
                    this.logger.warn(`📮 Published CompensationFailedEvent to Dead Letter Queue for car rental ${carRentalReservation.reservationId}`);
                }
            });
        }

        if (hotelReservation) {
            compensations.push(async () => {
                try {
                    await this.hotelService.cancelHotel(hotelReservation.reservationId);
                    this.logger.log(`✓ Compensated: Hotel booking cancelled`);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const errorStack = error instanceof Error ? error.stack : undefined;
                    this.logger.error(`Failed to cancel hotel: ${errorMessage}`);
                    
                    // Publish to Dead Letter Queue
                    const deadLetterEvent = new CompensationFailedEvent(
                        bookingId,
                        'hotel',
                        hotelReservation.reservationId,
                        errorMessage,
                        errorStack,
                    );
                    this.eventBus.publish(deadLetterEvent);
                    this.logger.warn(`📮 Published CompensationFailedEvent to Dead Letter Queue for hotel ${hotelReservation.reservationId}`);
                }
            });
        }

        if (flightReservation) {
            compensations.push(async () => {
                try {
                    await this.flightService.cancelFlight(flightReservation.reservationId);
                    this.logger.log(`✓ Compensated: Flight booking cancelled`);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const errorStack = error instanceof Error ? error.stack : undefined;
                    this.logger.error(`Failed to cancel flight: ${errorMessage}`);
                    
                    // Publish to Dead Letter Queue
                    const deadLetterEvent = new CompensationFailedEvent(
                        bookingId,
                        'flight',
                        flightReservation.reservationId,
                        errorMessage,
                        errorStack,
                    );
                    this.eventBus.publish(deadLetterEvent);
                    this.logger.warn(`📮 Published CompensationFailedEvent to Dead Letter Queue for flight ${flightReservation.reservationId}`);
                }
            });
        }

        // Execute compensations
        for (const compensate of compensations) {
            await compensate();
        }

        this.logger.log(`✅ Compensation Process Completed`);
    }

    private generateBookingId(): string {
        return `TRV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }
}
