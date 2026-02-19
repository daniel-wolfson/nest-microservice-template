import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { TravelBookingCarRentalReservationEvent } from '../impl/booking-reservation-event';
import { TravelBookingSagaStateRepository } from '../../sagas/travel-booking-saga-state.repository';
import { SagaCoordinator } from '../../sagas/saga-coordinator.service';
import { TravelBookingSaga } from '../../sagas/travel-booking.saga';
import { TravelBookingRequestDto } from '../../dto/travel-booking.dto';
import { FlightReservationResult } from '../../dto/flight-reservation.dto';
import { HotelReservationResult } from '../../dto/hotel-reservation.dto';
import { CarRentalReservationResult } from '../../dto/car-rental-reservation.dto';
import { BookingNotificationService } from '../../services/booking-notification.service';

const ALL_CONFIRMATION_STEPS = ['flight_confirmed', 'hotel_confirmed', 'car_confirmed'] as const;

/**
 * Travel Booking Car Rental Reservation Event Handler
 *
 * Triggered when a car rental reservation confirmation is received from the broker
 * (published by BookingSagaMessageController after 'reservation.carRental.confirmed').
 *
 * Responsibilities:
 * 1. Persist the confirmed car rental reservation ID into MongoDB saga state
 * 2. Mark the 'car_confirmed' step as completed in MongoDB
 * 3. Increment the Redis step counter for car rental confirmation tracking
 * 4. JOIN POINT — if all three steps (flight + hotel + car) are confirmed,
 *    call saga.aggregateResults() to finalize the saga.
 */
@EventsHandler(TravelBookingCarRentalReservationEvent)
export class TravelBookingCarRentalReservationHandler implements IEventHandler<TravelBookingCarRentalReservationEvent> {
    private readonly logger = new Logger(TravelBookingCarRentalReservationHandler.name);

    constructor(
        private readonly sagaStateRepository: TravelBookingSagaStateRepository,
        private readonly sagaCoordinator: SagaCoordinator,
        private readonly saga: TravelBookingSaga,
        private readonly notificationService: BookingNotificationService,
    ) {}

    async handle(event: TravelBookingCarRentalReservationEvent): Promise<void> {
        const { bookingId, userId, carRentalReservationId, totalAmount, timestamp } = event;

        this.logger.log(
            `🚗 Handling TravelBookingCarRentalReservationEvent — bookingId: ${bookingId}, reservationId: ${carRentalReservationId}`,
        );

        try {
            await this.sagaStateRepository.setReservationId(bookingId, 'car', carRentalReservationId);
            const updatedState = await this.sagaStateRepository.addCompletedStep(bookingId, 'car_confirmed');
            await this.sagaCoordinator.incrementStepCounter(bookingId, 'car_confirmed');

            // JOIN POINT — check if all three confirmations arrived ──────
            const completedSteps: string[] = updatedState?.completedSteps ?? [];
            const allConfirmed = ALL_CONFIRMATION_STEPS.every(step => completedSteps.includes(step));

            if (!allConfirmed) {
                const missing = ALL_CONFIRMATION_STEPS.filter(step => !completedSteps.includes(step));
                this.logger.log(`⏳ Waiting for confirmations: [${missing.join(', ')}] — bookingId: ${bookingId}`);
                return;
            }

            this.logger.log(`🎯 All confirmations received — triggering aggregation for bookingId: ${bookingId}`);

            const req = (updatedState!.originalRequest ?? {}) as TravelBookingRequestDto;

            const flightResult: FlightReservationResult = {
                reservationId: updatedState!.flightReservationId!,
                confirmationCode: updatedState!.flightReservationId!,
                status: 'confirmed',
                amount: req.totalAmount ?? 0,
            };

            const hotelResult: HotelReservationResult = {
                reservationId: updatedState!.hotelReservationId!,
                hotelId: req.hotelId ?? '',
                checkInDate: req.checkInDate ?? '',
                checkOutDate: req.checkOutDate ?? '',
                amount: req.totalAmount ?? 0,
                timestamp: timestamp.toISOString(),
                confirmationCode: updatedState!.hotelReservationId!,
                status: 'confirmed',
            };

            const carResult: CarRentalReservationResult = {
                reservationId: carRentalReservationId,
                confirmationCode: carRentalReservationId,
                status: 'confirmed',
                amount: totalAmount,
            };

            // ── Step 5: Finalize saga ──────────────────────────────────────────────
            const aggregateResult = await this.saga.aggregateResults(bookingId, flightResult, hotelResult, carResult);
            this.logger.log(
                `✅ Saga aggregated successfully — bookingId: ${bookingId}, status: ${aggregateResult.status}`,
            );

            // ── Step 6: Notify client (SSE + Webhook) ─────────────────────────────
            await this.notificationService.notifyBookingConfirmed(bookingId, aggregateResult);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(
                `❌ Failed to handle TravelBookingCarRentalReservationEvent for booking ${bookingId}: ${errorMessage}`,
            );
            await this.notificationService.notifyBookingFailed(bookingId, errorMessage);
        }
    }
}
