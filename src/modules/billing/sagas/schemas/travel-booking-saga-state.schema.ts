import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TravelBookingSagaStateDocument = TravelBookingSagaState & Document;

export enum SagaStatus {
    PENDING = 'pending',
    FLIGHT_RESERVED = 'flight_reserved',
    HOTEL_RESERVED = 'hotel_reserved',
    CAR_RESERVED = 'car_reserved',
    PAYMENT_PROCESSED = 'payment_processed',
    CONFIRMED = 'confirmed',
    FAILED = 'failed',
    COMPENSATING = 'compensating',
    COMPENSATED = 'compensated',
}

@Schema({ timestamps: true, collection: 'travel_booking_saga_states' })
export class TravelBookingSagaState {
    @Prop({ required: true, unique: true, index: true })
    bookingId: string;

    @Prop({ required: true, index: true })
    reservationId: string;

    @Prop({ required: true, index: true })
    userId: string;

    @Prop({ required: true, type: String, enum: SagaStatus, default: SagaStatus.PENDING })
    status: SagaStatus;

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

    @Prop({ type: Number })
    sagaTimestamp: number;

    @Prop({ type: Date, default: Date.now })
    createdAt?: Date;

    @Prop({ type: Date, default: Date.now })
    updatedAt?: Date;
}

export const TravelBookingSagaStateSchema = SchemaFactory.createForClass(TravelBookingSagaState);

// Add indexes for common queries
TravelBookingSagaStateSchema.index({ bookingId: 1 });
TravelBookingSagaStateSchema.index({ reservationId: 1 });
TravelBookingSagaStateSchema.index({ userId: 1, status: 1 });
TravelBookingSagaStateSchema.index({ status: 1, createdAt: -1 });
