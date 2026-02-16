export class TravelBookingCompensatedEvent {
    constructor(
        public readonly bookingId: string,
        public readonly userId: string,
        public readonly flightReservationId: string | undefined,
        public readonly hotelReservationId: string | undefined,
        public readonly carRentalReservationId: string | undefined,
        public readonly reason: string,
        public readonly timestamp: Date,
    ) {}
}
