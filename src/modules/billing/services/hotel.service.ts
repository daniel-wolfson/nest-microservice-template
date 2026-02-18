import { Injectable, Logger } from '@nestjs/common';
import { HotelReservationDto, HotelReservationResult } from '../dto/hotel-reservation.dto';

/**
 * Hotel Service
 * Simulates hotel reservation system with compensation support
 */
@Injectable()
export class HotelService {
    private readonly logger = new Logger(HotelService.name);
    private readonly reservations = new Map<string, HotelReservationResult>();

    /**
     * Reserve a hotel room
     * Simulates external API call to hotel booking system
     */
    async reserveHotel(dto: HotelReservationDto): Promise<HotelReservationResult> {
        this.logger.log(
            `Reserving hotel ${dto.hotelId} for user ${dto.userId} from ${dto.checkInDate} to ${dto.checkOutDate}`,
        );

        // Simulate API delay
        await this.simulateDelay(1200);

        // Simulate 10% failure rate for testing
        if (Math.random() < 0.1) {
            this.logger.error('Hotel reservation failed - no available rooms');
            throw new Error('No available rooms for the selected dates');
        }

        const reservationId = this.generateId('HTL');
        const confirmationCode = this.generateConfirmationCode();

        const result: HotelReservationResult = {
            reservationId,
            confirmationCode,
            status: 'confirmed',
            amount: dto.amount,
            checkInDate: dto.checkInDate,
            checkOutDate: dto.checkOutDate,
            hotelId: dto.hotelId,
            timestamp: new Date().toISOString(),
        };

        this.reservations.set(reservationId, result);

        this.logger.log(`Hotel reserved successfully: ${reservationId} (${confirmationCode})`);

        return result;
    }

    /**
     * Cancel a hotel reservation (compensation)
     * This is called when the saga needs to rollback
     */
    async cancelHotel(reservationId: string): Promise<void> {
        this.logger.warn(`Compensating: Canceling hotel reservation ${reservationId}`);

        // Simulate API delay
        await this.simulateDelay(500);

        const reservation = this.reservations.get(reservationId);
        if (!reservation) {
            this.logger.error(`Hotel reservation ${reservationId} not found`);
            throw new Error(`Hotel reservation not found: ${reservationId}`);
        }

        // Mark as cancelled
        reservation.status = 'pending'; // In real system, this would be 'cancelled'
        this.reservations.delete(reservationId);

        this.logger.log(`Hotel reservation ${reservationId} cancelled successfully`);
    }

    /**
     * Get reservation details
     */
    async getReservation(reservationId: string): Promise<HotelReservationResult | null> {
        return this.reservations.get(reservationId) || null;
    }

    private generateId(prefix: string): string {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    private generateConfirmationCode(): string {
        return Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    private async simulateDelay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
