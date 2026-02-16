export class TravelBookingFailedEvent {
    constructor(
        public readonly bookingId: string,
        public readonly userId: string,
        public readonly errorMessage: string,
        public readonly timestamp: Date,
    ) {}
}
