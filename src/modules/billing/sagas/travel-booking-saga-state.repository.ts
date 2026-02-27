import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, MongooseError } from 'mongoose';
import { TravelBookingSagaState, TravelBookingSagaStateDocument } from './travel-booking-saga-state.schema';
import { ReservationStatus } from './saga-status.enum';
import { TravelBookingSagaRedisState } from './travel-booking-saga-state.type';
import { ReservationType } from './reservation-types.enum';
@Injectable()
export class TravelBookingSagaStateRepository {
    private readonly logger = new Logger(TravelBookingSagaStateRepository.name);

    constructor(
        @InjectModel(TravelBookingSagaState.name)
        private readonly sagaDbState: Model<TravelBookingSagaStateDocument>,
    ) {}

    /**
     * Create new saga state
     */
    async create(sagaState: TravelBookingSagaState): Promise<TravelBookingSagaStateDocument> {
        this.logger.log(`Creating saga state for booking: ${sagaState.bookingId}`);
        const createdState = new this.sagaDbState(sagaState);
        return await createdState.save();
    }

    /** Find saga state by request ID */
    async findByRequestId(requestId: string): Promise<TravelBookingSagaStateDocument | null> {
        return await this.sagaDbState.findOne({ requestId }).exec();
    }

    /** Find saga state by booking ID */
    async findByBookingId(bookingId: string): Promise<TravelBookingSagaStateDocument | null> {
        return await this.sagaDbState.findOne({ bookingId: bookingId }).exec();
    }

    /** Find saga state by reservation ID */
    async findByReservationId(requestId: string): Promise<TravelBookingSagaStateDocument | null> {
        return await this.sagaDbState.findOne({ reservationId: requestId }).exec();
    }

    async saveConfirmedReservation(
        type: ReservationType,
        requestId: string,
        reservationId: string,
        step: string,
    ): Promise<TravelBookingSagaStateDocument | null> {
        // 'car' maps to carRentalReservationId (the full field name in the schema)
        const fieldMap: Record<ReservationType, string> = {
            [ReservationType.FLIGHT]: 'flightReservationId',
            [ReservationType.HOTEL]: 'hotelReservationId',
            [ReservationType.CAR]: 'carRentalReservationId',
        };
        const field = fieldMap[type] ?? `${type.toLocaleLowerCase()}ReservationId`;
        this.logger.log(
            `Saving confirmed ${type} reservation ${reservationId} (step: ${step}) for booking request: ${requestId}`,
        );
        return await this.sagaDbState
            .findOneAndUpdate(
                { requestId },
                {
                    $set: { [field]: reservationId, updatedAt: new Date() },
                    $addToSet: { completedSteps: step },
                },
                { new: true },
            )
            .exec();
    }

    /** Update saga state */
    async updateState(
        requestId: string,
        update: Partial<TravelBookingSagaRedisState>,
    ): Promise<TravelBookingSagaStateDocument | null> {
        this.logger.log(`Updating saga state for booking: ${requestId}`);
        return await this.sagaDbState
            .findOneAndUpdate({ requestId }, { $set: update, updatedAt: new Date() }, { new: true })
            .exec();
    }

    /** Add completed step */
    async addCompletedStep(requestId: string, step: string): Promise<TravelBookingSagaStateDocument | null> {
        this.logger.log(`Adding completed step '${step}' for booking request: ${requestId}`);
        return await this.sagaDbState
            .findOneAndUpdate(
                { requestId },
                { $addToSet: { completedSteps: step }, updatedAt: new Date() },
                { new: true },
            )
            .exec();
    }

    /** Set reservation ID */
    async setReservationId(
        type: ReservationType,
        requestId: string,
        reservationId: string,
    ): Promise<TravelBookingSagaStateDocument | null> {
        const field = `${type.toLowerCase()}ReservationId`;
        this.logger.log(`Setting ${field} to ${reservationId} for booking request: ${requestId}`);
        return await this.sagaDbState
            .findOneAndUpdate({ requestId }, { $set: { [field]: reservationId }, updatedAt: new Date() }, { new: true })
            .exec();
    }

    /** Update status */
    async updateStatus(requestId: string, status: ReservationStatus): Promise<TravelBookingSagaStateDocument | null> {
        this.logger.log(`Updating status to '${status}' for booking request: ${requestId}`);
        return await this.sagaDbState
            .findOneAndUpdate({ bookingId: requestId }, { $set: { status, updatedAt: new Date() } }, { new: true })
            .exec();
    }

    /** Set error */
    async setError(
        requestId: string,
        errorMessage: string,
        errorStack?: string,
    ): Promise<TravelBookingSagaStateDocument | null> {
        this.logger.error(`Setting error for booking request ${requestId}: ${errorMessage}`);
        return await this.sagaDbState
            .findOneAndUpdate(
                { requestId },
                { $set: { errorMessage, errorStack, status: ReservationStatus.FAILED, updatedAt: new Date() } },
                { new: true },
            )
            .exec();
    }

    /** Find all pending sagas (for recovery/monitoring) */
    async findPendingSagas(olderThanMinutes: number = 30): Promise<TravelBookingSagaStateDocument[]> {
        const cutoffDate = new Date(Date.now() - olderThanMinutes * 60 * 1000);
        return await this.sagaDbState
            .find({
                status: {
                    $in: [
                        ReservationStatus.PENDING,
                        ReservationStatus.FLIGHT_RESERVED,
                        ReservationStatus.HOTEL_RESERVED,
                    ],
                },
                createdAt: { $lt: cutoffDate },
            })
            .exec();
    }

    /** Get saga statistics by user */
    async getStatsByUser(userId: string): Promise<any> {
        return await this.sagaDbState
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

    async deleteByUserId(userId: string): Promise<void> {
        try {
            await this.sagaDbState.deleteMany({ userId: userId });
        } catch (error: any) {
            throw new MongooseError(`deleteByUserId error: ${error.message}`);
        }
    }
}
