import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { CarReservationRequest } from '../dto/car-rental-reservation.dto';
import { TravelBookingSagaStateRepository } from '../sagas/travel-booking-saga-state.repository';
import { SagaCoordinator } from '../sagas/saga-coordinator.service';
import { TravelBookingSaga } from '../sagas/travel-booking.saga';
import { TravelBookingNotificationService } from '../webhooks_sse/travel-booking-notification.service';
import { ApiHelper } from '@/modules/helpers/helper.service';
import { ReservationStatus } from '../sagas/saga-status.enum';
import { ReservationResult } from '../dto/reservation-confirm-result.dto';
import { IReservationService } from './reservation-service.interface';
import { ReservationType } from '../sagas/reservation-types.enum';
const ALL_CONFIRMATION_STEPS = ['FLIGHT_CONFIRMED', 'HOTEL_CONFIRMED', 'CAR_CONFIRMED'];

/**
 * Car Rental Service
 * Simulates car rental reservation system with compensation support
 * This service has a higher failure rate to demonstrate compensation
 */
@Injectable()
export class CarRentalService implements IReservationService {
    private readonly logger = new Logger(CarRentalService.name);
    private readonly reservations = new Map<string, ReservationResult>();

    constructor(
        private readonly sagaStateRepository: TravelBookingSagaStateRepository,
        private readonly sagaCoordinator: SagaCoordinator,
        @Inject(forwardRef(() => TravelBookingSaga))
        private readonly saga: TravelBookingSaga,
        private readonly notificationService: TravelBookingNotificationService,
    ) {}

    /**
     * Reserve a car
     * Simulates external API call to car rental booking system
     * Higher failure rate to trigger compensation flow
     */
    async makeReservation(request: CarReservationRequest): Promise<ReservationResult> {
        this.logger.log(`Reserving car at ${request.pickupLocation} for user ${request.userId}`);

        // Simulate API delay AND Simulate 30% failure rate for testing compensation
        await ApiHelper.simulateDelayOrRandomError(1500, 0.3);

        const reservationId = ApiHelper.generateRequestId('CAR');
        const confirmationCode = ApiHelper.generateConfirmationCode();

        const result: ReservationResult = {
            requestId: request.requestId,
            userId: request.userId,
            reservationId,
            confirmationCode,
            status: ReservationStatus.CONFIRMED,
            amount: request.amount,
            timestamp: new Date().toISOString(),
        };

        this.reservations.set(reservationId, result);

        this.logger.log(`Car reserved successfully: ${reservationId} (${confirmationCode})`);

        return result;
    }

    /**
     * Confirm a car rental reservation received from the broker.
     *
     * Persists the reservationId, marks 'hotel_confirmed', then checks the
     * JOIN POINT. If all three confirmations have arrived, finalises the saga
     * and notifies the client via SSE / Webhook.
     */
    async confirmReservation(requestId: string, reservationId: string): Promise<void> {
        try {
            this.logger.log(`🚗 Confirming car rental reservation ${reservationId} for booking ${requestId}`);

            const updatedState = await this.sagaStateRepository.saveConfirmedReservation(
                ReservationType.CAR,
                requestId,
                reservationId,
                'CAR_CONFIRMED',
            );
            await this.sagaCoordinator.incrementStepCounter(requestId, 'CAR_CONFIRMED');

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
                `❌ Failed to handle TravelBookingCarRentalReservationEvent for booking ${requestId}: ${errorMessage}`,
            );
            await this.notificationService.notifyBookingFailed(requestId, errorMessage);
        }
    }

    /**
     * Cancel a car rental reservation (compensation)
     * This is called when the saga needs to rollback
     */
    async cancelReservation(reservationId: string): Promise<void> {
        this.logger.warn(`Compensating: Canceling car rental reservation ${reservationId}`);

        // Simulate API delay for Non prod
        await ApiHelper.simulateDelayOrRandomError();

        const reservation = this.reservations.get(reservationId);
        if (!reservation) {
            this.logger.error(`Car rental reservation ${reservationId} not found`);
            throw new Error(`Car rental reservation not found: ${reservationId}`);
        }

        // Mark as cancelled
        reservation.status = ReservationStatus.CONFIRMED; // In real system, this would be 'cancelled'
        this.reservations.delete(reservationId);

        this.logger.log(`Car rental reservation ${reservationId} cancelled successfully`);
    }

    /**
     * Get reservation details
     */
    async getReservation(reservationId: string): Promise<ReservationResult | null> {
        return this.reservations.get(reservationId) || null;
    }
}
