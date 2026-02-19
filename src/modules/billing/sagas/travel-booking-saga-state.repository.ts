import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    TravelBookingSagaState,
    TravelBookingSagaStateDocument,
    SagaStatus,
} from './travel-booking-saga-state.schema';

@Injectable()
export class TravelBookingSagaStateRepository {
    private readonly logger = new Logger(TravelBookingSagaStateRepository.name);

    constructor(
        @InjectModel(TravelBookingSagaState.name)
        private readonly sagaStateModel: Model<TravelBookingSagaStateDocument>,
    ) {}

    /**
     * Create new saga state
     */
    async create(sagaState: Partial<TravelBookingSagaState>): Promise<TravelBookingSagaStateDocument> {
        this.logger.log(`Creating saga state for booking: ${sagaState.bookingId}`);
        const createdState = new this.sagaStateModel(sagaState);
        return await createdState.save();
    }

    /**
     * Find saga state by booking ID
     */
    async findByBookingId(bookingId: string): Promise<TravelBookingSagaStateDocument | null> {
        return await this.sagaStateModel.findOne({ bookingId }).exec();
    }

    /**
     * Find saga state by reservation ID
     */
    async findByReservationId(reservationId: string): Promise<TravelBookingSagaStateDocument | null> {
        return await this.sagaStateModel.findOne({ reservationId }).exec();
    }

    /**
     * Update saga state
     */
    async updateState(
        bookingId: string,
        update: Partial<TravelBookingSagaState>,
    ): Promise<TravelBookingSagaStateDocument | null> {
        this.logger.log(`Updating saga state for booking: ${bookingId}`);
        return await this.sagaStateModel
            .findOneAndUpdate({ bookingId }, { $set: update, updatedAt: new Date() }, { new: true })
            .exec();
    }

    /**
     * Add completed step
     */
    async addCompletedStep(bookingId: string, step: string): Promise<TravelBookingSagaStateDocument | null> {
        this.logger.log(`Adding completed step '${step}' for booking: ${bookingId}`);
        return await this.sagaStateModel
            .findOneAndUpdate(
                { bookingId },
                { $addToSet: { completedSteps: step }, updatedAt: new Date() },
                { new: true },
            )
            .exec();
    }

    /**
     * Set reservation ID
     */
    async setReservationId(
        bookingId: string,
        type: 'flight' | 'hotel' | 'car',
        reservationId: string,
    ): Promise<TravelBookingSagaStateDocument | null> {
        const field = `${type}ReservationId`;
        this.logger.log(`Setting ${field} to ${reservationId} for booking: ${bookingId}`);
        return await this.sagaStateModel
            .findOneAndUpdate({ bookingId }, { $set: { [field]: reservationId }, updatedAt: new Date() }, { new: true })
            .exec();
    }

    /**
     * Update status
     */
    async updateStatus(bookingId: string, status: SagaStatus): Promise<TravelBookingSagaStateDocument | null> {
        this.logger.log(`Updating status to '${status}' for booking: ${bookingId}`);
        return await this.sagaStateModel
            .findOneAndUpdate({ bookingId }, { $set: { status, updatedAt: new Date() } }, { new: true })
            .exec();
    }

    /**
     * Set error
     */
    async setError(
        bookingId: string,
        errorMessage: string,
        errorStack?: string,
    ): Promise<TravelBookingSagaStateDocument | null> {
        this.logger.error(`Setting error for booking ${bookingId}: ${errorMessage}`);
        return await this.sagaStateModel
            .findOneAndUpdate(
                { bookingId },
                { $set: { errorMessage, errorStack, status: SagaStatus.FAILED, updatedAt: new Date() } },
                { new: true },
            )
            .exec();
    }

    /**
     * Find all pending sagas (for recovery/monitoring)
     */
    async findPendingSagas(olderThanMinutes: number = 30): Promise<TravelBookingSagaStateDocument[]> {
        const cutoffDate = new Date(Date.now() - olderThanMinutes * 60 * 1000);
        return await this.sagaStateModel
            .find({
                status: { $in: [SagaStatus.PENDING, SagaStatus.FLIGHT_RESERVED, SagaStatus.HOTEL_RESERVED] },
                createdAt: { $lt: cutoffDate },
            })
            .exec();
    }

    /**
     * Get saga statistics by user
     */
    async getStatsByUser(userId: string): Promise<any> {
        return await this.sagaStateModel
            .aggregate([
                { $match: { userId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$totalAmount' },
                    },
                },
            ])
            .exec();
    }
}
