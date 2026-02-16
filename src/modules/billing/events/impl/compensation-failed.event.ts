/**
 * Compensation Failed Event
 * Published to Dead Letter Queue when a compensation transaction fails
 * This ensures failed compensations are tracked and can be retried manually
 */
export class CompensationFailedEvent {
    constructor(
        public readonly bookingId: string,
        public readonly compensationType: 'flight' | 'hotel' | 'car',
        public readonly reservationId: string,
        public readonly errorMessage: string,
        public readonly errorStack?: string,
        public readonly timestamp: Date = new Date(),
        public readonly retryCount: number = 0,
    ) {}
}
