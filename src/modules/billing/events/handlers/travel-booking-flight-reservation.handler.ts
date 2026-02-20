import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { TravelBookingFlightReservationEvent } from '../impl/booking-reservation-event';
import { FlightService } from '../../services/flight.service';
import { BookingNotificationService } from '../../services/booking-notification.service';

/**
 * Travel Booking Flight Reservation Event Handler
 *
 * Triggered when a flight reservation confirmation is received from the broker
 * (published by BookingSagaMessageController after 'reservation.flight.confirmed').
 *
 * Delegates all confirmation logic to FlightService.confirmFlightReservation(),
 * which saves the reservation ID, checks the JOIN POINT, and — if all three
 * services have confirmed — calls saga.aggregateResults() and notifies the client.
 */
@EventsHandler(TravelBookingFlightReservationEvent)
export class TravelBookingFlightReservationHandler implements IEventHandler<TravelBookingFlightReservationEvent> {
    constructor(private readonly flightService: FlightService, private readonly logger: Logger) {}

    async handle(event: TravelBookingFlightReservationEvent): Promise<void> {
        const { bookingId, flightReservationId } = event;

        this.logger.log(
            `✈️ Handling ${TravelBookingFlightReservationHandler.name} — bookingId: ${bookingId}, reservationId: ${flightReservationId}`,
        );

        await this.flightService.confirmReservation(bookingId, flightReservationId);
    }
}
