import { ReservationStatus } from './saga-status.enum';
import { Prop } from '@nestjs/mongoose';

/**
 * This file defines the TypeScript type for the saga state stored in Redis.
 * It represents the current state of a travel booking saga, including all relevant information needed to manage the workflow.
 */
/**
 * Represents the state of a travel booking saga stored in Redis.
 *
 * This type manages the complete lifecycle of a distributed travel booking transaction,
 * tracking individual service reservations (flight, hotel, car rental) and overall booking status.
 *
 * @property {string} requestId - Saga correlation ID that tracks the entire booking workflow/transaction
 * @property {string | null} [bookingId] - Confirmed booking reference ID after successful completion
 * @property {string | null} [flightReservationId] - Reservation ID from the flight service
 * @property {string | null} [hotelReservationId] - Reservation ID from the hotel service
 * @property {string | null} [carRentalReservationId] - Reservation ID from the car rental service
 * @property {any} metadata - Additional metadata and context for the saga
 * @property {number} timestamp - Unix timestamp of the last state update
 * @property {SagaStatus} status - Current status of the saga workflow
 * @property {number | null} totalAmount - Total booking amount after payment processing
 * @property {string | null} userId - User ID associated with the booking
 * @property {string | null} [message] - Optional message for error handling or status updates
 * @property {string[] | null} [completedSteps] - List of completed steps in the saga (e.g., ['flight_reserved', 'hotel_reserved', 'car_reserved'])
 */
export class TravelBookingSagaRedisState {
    @Prop({ required: true })
    requestId: string;

    @Prop({ required: false, default: null })
    bookingId?: string | null;

    @Prop({ required: false, default: null })
    flightReservationId?: string | null;

    @Prop({ required: false, default: null })
    hotelReservationId?: string | null;

    @Prop({ required: false, default: null })
    carRentalReservationId?: string | null;

    @Prop({ required: true })
    metadata: any;

    @Prop({ required: true })
    timestamp: string;

    @Prop({ required: true })
    status: ReservationStatus;

    @Prop({ required: true, default: null })
    totalAmount: number | null;

    @Prop({ required: true, default: null })
    userId: string | null;

    @Prop({ required: false, default: null })
    message?: string | null;

    @Prop({ required: false, default: null })
    completedSteps?: string[] | null;
}
