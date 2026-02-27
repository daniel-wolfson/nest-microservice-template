import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ReservationStatus } from './saga-status.enum';

export type TravelBookingSagaStateDocument = TravelBookingSagaState & Document;

@Schema({ timestamps: true, collection: 'travel_booking_saga_states' })
export class TravelBookingSagaState {
    /** Confirmed booking reference - the final record ID after successful completion */
    @Prop({ required: false, unique: true, sparse: true }) // Removed 'index: true'
    bookingId?: string;

    /** Saga correlation ID - tracks the entire booking workflow/transaction */
    @Prop({ required: true, unique: true }) // Removed 'index: true'
    requestId: string;

    /** User ID associated with the booking */
    @Prop({ required: true }) // Removed 'index: true'
    userId: string;

    @Prop({ required: true, type: String, enum: ReservationStatus, default: ReservationStatus.PENDING })
    status: ReservationStatus;

    @Prop({ type: Object })
    originalRequest: Record<string, any>;

    @Prop()
    flightReservationId?: string;

    @Prop()
    hotelReservationId?: string;

    @Prop()
    carRentalReservationId?: string;

    @Prop({ type: Number })
    totalAmount: number;

    @Prop()
    errorMessage?: string;

    @Prop()
    errorStack?: string;

    @Prop({ type: [String], default: [] })
    completedSteps: string[];

    @Prop({ type: Object })
    metadata?: Record<string, any>;

    @Prop({ type: String })
    timestamp: string;

    @Prop({ type: Date, default: Date.now })
    createdAt?: Date;

    @Prop({ type: Date, default: Date.now })
    updatedAt?: Date;
}

export const TravelBookingSagaStateSchema = SchemaFactory.createForClass(TravelBookingSagaState);

// Add indexes for common queries
// sparse: true allows multiple null values, only enforces uniqueness on non-null bookingIds
TravelBookingSagaStateSchema.index({ bookingId: 1 }, { unique: true, sparse: true });
TravelBookingSagaStateSchema.index({ requestId: 1 }, { unique: true }); // requestId is always present and unique
TravelBookingSagaStateSchema.index({ userId: 1, status: 1 });
TravelBookingSagaStateSchema.index({ status: 1, createdAt: -1 });
