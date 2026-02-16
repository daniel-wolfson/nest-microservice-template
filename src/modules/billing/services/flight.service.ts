import { Injectable, Logger } from '@nestjs/common';
import { FlightReservationDto, FlightReservationResult } from '../dto/flight-reservation.dto';

/**
 * Flight Service
 * Simulates flight reservation system with compensation support
 */
@Injectable()
export class FlightService {
    private readonly logger = new Logger(FlightService.name);
    private readonly reservations = new Map<string, FlightReservationResult>();

    /**
     * Reserve a flight
     * Simulates external API call to flight booking system
     */
    async reserveFlight(dto: FlightReservationDto): Promise<FlightReservationResult> {
        this.logger.log(`Reserving flight from ${dto.origin} to ${dto.destination} for user ${dto.userId}`);

        // Simulate API delay
        await this.simulateDelay(1000);

        // Simulate 10% failure rate for testing
        if (Math.random() < 0.1) {
            this.logger.error('Flight reservation failed - no available flights');
            throw new Error('No available flights for the selected route');
        }

        const reservationId = this.generateId('FLT');
        const confirmationCode = this.generateConfirmationCode();

        const result: FlightReservationResult = {
            reservationId,
            confirmationCode,
            status: 'confirmed',
            amount: dto.amount,
        };

        this.reservations.set(reservationId, result);

        this.logger.log(`Flight reserved successfully: ${reservationId} (${confirmationCode})`);

        return result;
    }

    /**
     * Cancel a flight reservation (compensation)
     * This is called when the saga needs to rollback
     */
    async cancelFlight(reservationId: string): Promise<void> {
        this.logger.warn(`Compensating: Canceling flight reservation ${reservationId}`);

        // Simulate API delay
        await this.simulateDelay(500);

        const reservation = this.reservations.get(reservationId);
        if (!reservation) {
            this.logger.error(`Flight reservation ${reservationId} not found`);
            throw new Error(`Flight reservation not found: ${reservationId}`);
        }

        // Mark as cancelled
        reservation.status = 'pending'; // In real system, this would be 'cancelled'
        this.reservations.delete(reservationId);

        this.logger.log(`Flight reservation ${reservationId} cancelled successfully`);
    }

    /**
     * Get reservation details
     */
    async getReservation(reservationId: string): Promise<FlightReservationResult | null> {
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
