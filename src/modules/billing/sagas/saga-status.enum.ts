export enum SagaStatus {
    PENDING = 'PENDING',
    FLIGHT_RESERVED = 'flight_reserved',
    HOTEL_RESERVED = 'hotel_reserved',
    CAR_RESERVED = 'car_reserved',
    PAYMENT_PROCESSED = 'payment_processed',
    CONFIRMED = 'confirmed',
    FAILED = 'failed',
    COMPENSATING = 'compensating',
    CANCELLED = 'cancelled',
}
