import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { TravelBookingFlightReservationEvent } from '../impl/booking-reservation-event';
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
 * Travel Booking Flight Reservation Event Handler
 *
 * Triggered when a flight reservation confirmation is received from the broker
 * (published by BookingSagaMessageController after 'reservation.flight.confirmed').
 *
 * Responsibilities:
 * 1. Persist the confirmed flight reservation ID into MongoDB saga state
 * 2. Mark the 'flight_confirmed' step as completed in MongoDB
 * 3. Increment the Redis step counter for flight confirmation tracking
 * 4. JOIN POINT — if all three steps (flight + hotel + car) are confirmed,
 *    call saga.aggregateResults() to finalize the saga.
 */
@EventsHandler(TravelBookingFlightReservationEvent)
export class TravelBookingFlightReservationHandler implements IEventHandler<TravelBookingFlightReservationEvent> {
    private readonly logger = new Logger(TravelBookingFlightReservationHandler.name);

    constructor(
        private readonly sagaStateRepository: TravelBookingSagaStateRepository,
        private readonly sagaCoordinator: SagaCoordinator,
        private readonly saga: TravelBookingSaga,
        private readonly notificationService: BookingNotificationService,
    ) {}

    async handle(event: TravelBookingFlightReservationEvent): Promise<void> {
        const { bookingId, userId, flightReservationId, totalAmount, timestamp } = event;

        this.logger.log(
            `✈️ Handling TravelBookingFlightReservationEvent — bookingId: ${bookingId}, reservationId: ${flightReservationId}`,
        );

        try {
            await this.sagaStateRepository.setReservationId(bookingId, 'flight', flightReservationId);
            const updatedState = await this.sagaStateRepository.addCompletedStep(bookingId, 'flight_confirmed');
            await this.sagaCoordinator.incrementStepCounter(bookingId, 'flight_confirmed');

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
                reservationId: flightReservationId,
                confirmationCode: flightReservationId,
                status: 'confirmed',
                amount: totalAmount,
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
                reservationId: updatedState!.carRentalReservationId!,
                confirmationCode: updatedState!.carRentalReservationId!,
                status: 'confirmed',
                amount: req.totalAmount ?? 0,
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
                `❌ Failed to handle TravelBookingFlightReservationEvent for booking ${bookingId}: ${errorMessage}`,
            );
            await this.notificationService.notifyBookingFailed(bookingId, errorMessage);
        }
    }
}
