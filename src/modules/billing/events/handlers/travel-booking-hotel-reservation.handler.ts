import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { TravelBookingHotelReservationEvent } from '../impl/booking-reservation-event';
import { HotelService } from '../../services/hotel.service';
import { BookingNotificationService } from '../../services/booking-notification.service';

/**
 * Travel Booking Hotel Reservation Event Handler
 *
 * Triggered when a hotel reservation confirmation is received from the broker
 * (published by BookingSagaMessageController after 'reservation.hotel.confirmed').
 *
 * Delegates all confirmation logic to HotelService.confirmHotelReservation(),
 * which saves the reservation ID, checks the JOIN POINT, and — if all three
 * services have confirmed — calls saga.aggregateResults() and notifies the client.
 */
@EventsHandler(TravelBookingHotelReservationEvent)
export class TravelBookingHotelReservationHandler implements IEventHandler<TravelBookingHotelReservationEvent> {
    constructor(private readonly hotelService: HotelService, private readonly logger: Logger) {}

    async handle(event: TravelBookingHotelReservationEvent): Promise<void> {
        const { bookingId, hotelReservationId } = event;

        this.logger.log(
            `🏨 Handling ${TravelBookingHotelReservationHandler.name} — bookingId: ${bookingId}, reservationId: ${hotelReservationId}`,
        );

        await this.hotelService.confirmReservation(bookingId, hotelReservationId);
    }
}
