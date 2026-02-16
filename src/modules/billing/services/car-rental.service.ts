import { Injectable, Logger } from '@nestjs/common';
import { CarRentalReservationDto, CarRentalReservationResult } from '../dto/car-rental-reservation.dto';

/**
 * Car Rental Service
 * Simulates car rental reservation system with compensation support
 * This service has a higher failure rate to demonstrate compensation
 */
@Injectable()
export class CarRentalService {
    private readonly logger = new Logger(CarRentalService.name);
    private readonly reservations = new Map<string, CarRentalReservationResult>();

    /**
     * Reserve a car
     * Simulates external API call to car rental booking system
     * Higher failure rate to trigger compensation flow
     */
    async reserveCar(dto: CarRentalReservationDto): Promise<CarRentalReservationResult> {
        this.logger.log(`Reserving car at ${dto.pickupLocation} for user ${dto.userId}`);

        // Simulate API delay
        await this.simulateDelay(1500);

        // Simulate 30% failure rate for testing compensation
        if (Math.random() < 0.3) {
            this.logger.error('Car rental reservation failed - no available cars');
            throw new Error('No available cars for the selected location and dates');
        }

        const reservationId = this.generateId('CAR');
        const confirmationCode = this.generateConfirmationCode();

        const result: CarRentalReservationResult = {
            reservationId,
            confirmationCode,
            status: 'confirmed',
            amount: dto.amount,
        };

        this.reservations.set(reservationId, result);

        this.logger.log(`Car reserved successfully: ${reservationId} (${confirmationCode})`);

        return result;
    }

    /**
     * Cancel a car rental reservation (compensation)
     * This is called when the saga needs to rollback
     */
    async cancelCar(reservationId: string): Promise<void> {
        this.logger.warn(`Compensating: Canceling car rental reservation ${reservationId}`);

        // Simulate API delay
        await this.simulateDelay(500);

        const reservation = this.reservations.get(reservationId);
        if (!reservation) {
            this.logger.error(`Car rental reservation ${reservationId} not found`);
            throw new Error(`Car rental reservation not found: ${reservationId}`);
        }

        // Mark as cancelled
        reservation.status = 'pending'; // In real system, this would be 'cancelled'
        this.reservations.delete(reservationId);

        this.logger.log(`Car rental reservation ${reservationId} cancelled successfully`);
    }

    /**
     * Get reservation details
     */
    async getReservation(reservationId: string): Promise<CarRentalReservationResult | null> {
        return this.reservations.get(reservationId) || null;
    }

    private generateId(prefix: string): string {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateConfirmationCode(): string {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    private async simulateDelay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
