import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { TravelBookingCarRentalReservationEvent } from '../impl/booking-reservation-event';
import { CarRentalService } from '../../services/car-rental.service';
import { TravelBookingNotificationService } from '../../webhooks_sse/travel-booking-notification.service';

/**
 * Travel Booking Car Rental Reservation Event Handler
 *
 * Triggered when a car rental reservation confirmation is received from the broker
 * (published by BookingSagaMessageController after 'reservation.carRental.confirmed').
 *
 * Delegates all confirmation logic to CarRentalService.confirmCarRentalReservation(),
 * which saves the reservation ID, checks the JOIN POINT, and — if all three
 * services have confirmed — calls saga.aggregateResults() and notifies the client.
 */
@EventsHandler(TravelBookingCarRentalReservationEvent)
export class TravelBookingCarRentalReservationHandler implements IEventHandler<TravelBookingCarRentalReservationEvent> {
    constructor(private readonly carRentalService: CarRentalService, private readonly logger: Logger) {}

    async handle(event: TravelBookingCarRentalReservationEvent): Promise<void> {
        const { requestId: requestId, carRentalReservationId } = event;

        this.logger.log(
            `🚗 Handling ${TravelBookingCarRentalReservationHandler.name} — bookingId: ${requestId}, reservationId: ${carRentalReservationId}`,
        );

        await this.carRentalService.confirmReservation(requestId, carRentalReservationId);
    }
}
