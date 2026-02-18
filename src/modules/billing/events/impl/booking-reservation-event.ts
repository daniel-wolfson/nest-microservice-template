export class TravelBookingFlightReservationEvent {
    constructor(
        public readonly bookingId: string,
        public readonly userId: string,
        public readonly flightReservationId: string,
        public readonly totalAmount: number,
        public readonly timestamp: Date,
    ) {}
}

export class TravelBookingCarRentalReservationEvent {
    constructor(
        public readonly bookingId: string,
        public readonly userId: string,
        public readonly carRentalReservationId: string,
        public readonly totalAmount: number,
        public readonly timestamp: Date,
    ) {}
}

export class TravelBookingHotelReservationEvent {
    constructor(
        public readonly bookingId: string,
        public readonly userId: string,
        public readonly hotelReservationId: string,
        public readonly totalAmount: number,
        public readonly timestamp: Date,
    ) {}
}
