import { ApiProperty } from '@nestjs/swagger';
import { ReservationStatus } from '../sagas/saga-status.enum';

export class ReservationResult {
    @ApiProperty({ description: 'Reservation ID' })
    reservationId: string;

    @ApiProperty({ description: 'User ID' })
    userId: string;

    @ApiProperty({ description: 'Request ID' })
    requestId: string;

    @ApiProperty({ description: 'Reservation amount' })
    amount: number;

    @ApiProperty({ description: 'Timestamp' })
    timestamp?: string;

    @ApiProperty({ description: 'Confirmation code' })
    confirmationCode: string;

    @ApiProperty({ description: 'Reservation status', enum: ReservationStatus })
    status: ReservationStatus.CONFIRMED | ReservationStatus.PENDING;

    constructor() {
        this.timestamp = new Date().toISOString();
    }
}
