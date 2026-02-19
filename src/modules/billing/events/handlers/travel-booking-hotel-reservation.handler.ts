import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { TravelBookingHotelReservationEvent } from '../impl/booking-reservation-event';
import { TravelBookingSagaStateRepository } from '../../sagas/travel-booking-saga-state.repository';
import { SagaCoordinator } from '../../sagas/saga-coordinator.service';
import { TravelBookingSaga } from '../../sagas/travel-booking.saga';
import { TravelBookingRequestDto } from '../../dto/travel-booking.dto';
import { FlightReservationResult } from '../../dto/flight-reservation.dto';
import { HotelReservationResult } from '../../dto/hotel-reservation.dto';
import { CarRentalReservationResult } from '../../dto/car-rental-reservation.dto';
import { BookingNotificationService } from '../../services/booking-notification.service';

/**
 * Required confirmation steps for a complete saga.
 * The JOIN POINT fires saga.aggregateResults() only when all three are present.
 */
const ALL_CONFIRMATION_STEPS = ['flight_confirmed', 'hotel_confirmed', 'car_confirmed'] as const;

/**
 * Travel Booking Hotel Reservation Event Handler
 *
 * Triggered when a hotel reservation confirmation is received from the broker
 * (published by BookingSagaMessageController after 'reservation.hotel.confirmed').
 *
 * Responsibilities:
 * 1. Persist the confirmed hotel reservation ID into MongoDB saga state
 * 2. Mark the 'hotel_confirmed' step as completed in MongoDB
 * 3. Increment the Redis step counter for hotel confirmation tracking
 * 4. JOIN POINT — if flight_confirmed + hotel_confirmed + car_confirmed are all
 *    present, reconstruct the result objects and call saga.aggregateResults()
 *    to finalize the saga (update MongoDB to CONFIRMED and clean up Redis).
 */
@EventsHandler(TravelBookingHotelReservationEvent)
export class TravelBookingHotelReservationHandler implements IEventHandler<TravelBookingHotelReservationEvent> {
    private readonly logger = new Logger(TravelBookingHotelReservationHandler.name);

    constructor(
        private readonly sagaStateRepository: TravelBookingSagaStateRepository,
        private readonly sagaCoordinator: SagaCoordinator,
        private readonly saga: TravelBookingSaga,
        private readonly notificationService: BookingNotificationService,
    ) {}

    async handle(event: TravelBookingHotelReservationEvent): Promise<void> {
        const { bookingId, userId, hotelReservationId, totalAmount, timestamp } = event;

        this.logger.log(
            `🏨 Handling TravelBookingHotelReservationEvent — bookingId: ${bookingId}, reservationId: ${hotelReservationId}`,
        );

        try {
            await this.sagaStateRepository.setReservationId(bookingId, 'hotel', hotelReservationId);
            const updatedState = await this.sagaStateRepository.addCompletedStep(bookingId, 'hotel_confirmed');
            await this.sagaCoordinator.incrementStepCounter(bookingId, 'hotel_confirmed');

            // JOIN POINT — check if all three confirmations arrived ──────
            const completedSteps: string[] = updatedState?.completedSteps ?? [];
            const allConfirmed = ALL_CONFIRMATION_STEPS.every(step => completedSteps.includes(step));

            if (!allConfirmed) {
                const missing = ALL_CONFIRMATION_STEPS.filter(step => !completedSteps.includes(step));
                this.logger.log(`⏳ Waiting for confirmations: [${missing.join(', ')}] — bookingId: ${bookingId}`);
                return;
            }

            this.logger.log(`🎯 All confirmations received — triggering aggregation for bookingId: ${bookingId}`);

            // Reconstruct result objects from persisted state + event data.
            // confirmationCode is informational only (not stored separately), so
            // we fall back to the reservationId as an unambiguous identifier.
            const req = (updatedState!.originalRequest ?? {}) as TravelBookingRequestDto;

            const flightResult: FlightReservationResult = {
                reservationId: updatedState!.flightReservationId!,
                confirmationCode: updatedState!.flightReservationId!,
                status: 'confirmed',
                amount: req.totalAmount ?? 0,
            };

            const hotelResult: HotelReservationResult = {
                reservationId: hotelReservationId,
                hotelId: req.hotelId ?? '',
                checkInDate: req.checkInDate ?? '',
                checkOutDate: req.checkOutDate ?? '',
                amount: totalAmount,
                timestamp: timestamp.toISOString(),
                confirmationCode: hotelReservationId,
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
                `❌ Failed to handle TravelBookingHotelReservationEvent for booking ${bookingId}: ${errorMessage}`,
            );
            await this.notificationService.notifyBookingFailed(bookingId, errorMessage);
        }
    }
}
