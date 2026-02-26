import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { HotelReservationResult } from '../dto/hotel-reservation-result.dto';
import { TravelBookingSagaStateRepository } from '../sagas/travel-booking-saga-state.repository';
import { SagaCoordinator } from '../sagas/saga-coordinator.service';
import { TravelBookingSaga } from '../sagas/travel-booking.saga';
import { TravelBookingNotificationService } from '../webhooks_sse/travel-booking-notification.service';
import { ApiHelper } from '@/modules/helpers/helper.service';
import { IReservationService } from './reservation-service.interface';
import { ReservationStatus } from '../sagas/saga-status.enum';
import { HotelReservationRequest as HotelReservationRequest } from '../dto/hotel-reservation.-request.dto';
import { ReservationType } from '../sagas/reservation-types.enum';

const ALL_CONFIRMATION_STEPS = ['flight_confirmed', 'hotel_confirmed', 'hotel_confirmed'];

/**
 * Hotel Service
 * Simulates hotel reservation system with compensation support
 */
@Injectable()
export class HotelService implements IReservationService {
    private readonly logger = new Logger(HotelService.name);
    private readonly reservations = new Map<string, HotelReservationResult>();

    constructor(
        private readonly sagaStateRepository: TravelBookingSagaStateRepository,
        private readonly sagaCoordinator: SagaCoordinator,
        @Inject(forwardRef(() => TravelBookingSaga))
        private readonly saga: TravelBookingSaga,
        private readonly notificationService: TravelBookingNotificationService,
    ) {}

    /**
     * Reserve a hotel room
     * Simulates external API call to hotel booking system
     */
    async makeReservation(request: HotelReservationRequest): Promise<HotelReservationResult> {
        this.logger.log(
            `Reserving hotel ${request.hotelId} for user ${request.userId} from ${request.checkInDate} to ${request.checkOutDate}`,
        );

        // Simulate API delay AND Simulate 10% failure rate for testing
        //await ApiHelper.simulateDelayOrRandomError(1200, 0.1);

        const reservationId = ApiHelper.generateId('HTL');
        const confirmationCode = ApiHelper.generateConfirmationCode();

        const result: HotelReservationResult = {
            requestId: request.requestId,
            userId: request.userId,
            reservationId,
            confirmationCode,
            status: ReservationStatus.CONFIRMED,
            amount: request.amount,
            timestamp: new Date().toISOString(),

            checkInDate: request.checkInDate,
            checkOutDate: request.checkOutDate,
            hotelId: request.hotelId,
        };

        this.reservations.set(reservationId, result);

        this.logger.log(`Hotel reserved successfully: ${reservationId} (${confirmationCode})`);

        return result;
    }

    /**
     * Confirm a hotel reservation received from the broker.
     *
     * Persists the reservationId, marks 'hotel_confirmed', then checks the
     * JOIN POINT. If all three confirmations have arrived, finalizes the saga
     * and notifies the client via SSE / Webhook.
     */
    async confirmReservation(requestId: string, reservationId: string): Promise<void> {
        try {
            debugger;
            this.logger.log(`🏨 Confirming hotel reservation ${reservationId} for booking ${requestId}`);

            const updatedState = await this.sagaStateRepository.saveConfirmedReservation(
                ReservationType.HOTEL,
                requestId,
                reservationId,
                'HOTEL_CONFIRMED',
            );
            await this.sagaCoordinator.incrementStepCounter(requestId, 'HOTEL_CONFIRMED');

            const completedSteps: string[] = updatedState?.completedSteps ?? [];
            const allConfirmed = ALL_CONFIRMATION_STEPS.every(step => completedSteps.includes(step));

            if (!allConfirmed) {
                const missing = ALL_CONFIRMATION_STEPS.filter(step => !completedSteps.includes(step));
                this.logger.log(`⏳ Waiting for confirmations: [${missing.join(', ')}] — bookingId: ${requestId}`);
                return;
            }

            this.logger.log(`🎯 All confirmations received — triggering aggregation for bookingId: ${requestId}`);
            const aggregateResult = await this.saga.aggregateResults(requestId);
            this.logger.log(`✅ Saga aggregated — bookingId: ${requestId}, status: ${aggregateResult.status}`);
            await this.notificationService.notifyBookingConfirmed(requestId, aggregateResult);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(
                `❌ Failed to handle TravelBookingHotelReservationEvent for booking ${requestId}: ${errorMessage}`,
            );
            await this.notificationService.notifyBookingFailed(requestId, errorMessage);
        }
    }

    /**
     * Cancel a hotel reservation (compensation)
     * This is called when the saga needs to rollback
     */
    async cancelReservation(reservationId: string): Promise<void> {
        this.logger.warn(`Compensating: Canceling hotel reservation ${reservationId}`);

        await ApiHelper.simulateDelayOrRandomError(500);

        const reservation = this.reservations.get(reservationId);
        if (!reservation) {
            this.logger.error(`Hotel reservation ${reservationId} not found`);
            throw new Error(`Hotel reservation not found: ${reservationId}`);
        }

        // Mark as cancelled
        reservation.status = ReservationStatus.PENDING; // In real system, this would be 'cancelled'
        this.reservations.delete(reservationId);

        this.logger.log(`Hotel reservation ${reservationId} cancelled successfully`);
    }

    /**
     * Get reservation details
     */
    async getReservation(reservationId: string): Promise<HotelReservationResult | null> {
        return this.reservations.get(reservationId) || null;
    }
}
