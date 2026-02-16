export class TravelBookingCreatedEvent {
    constructor(
        public readonly bookingId: string,
        public readonly userId: string,
        public readonly flightReservationId: string,
        public readonly hotelReservationId: string,
        public readonly carRentalReservationId: string,
        public readonly totalAmount: number,
        public readonly timestamp: Date,
    ) {}
}
