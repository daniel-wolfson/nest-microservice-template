import { ApiProperty } from '@nestjs/swagger';
import { IReservationConfirmResult } from '../services/reservation-confirm-result.interface';
import { SagaStatus } from '../sagas/saga-status.enum';

export class HotelReservationResult implements IReservationConfirmResult {
    @ApiProperty({ description: 'Reservation ID' })
    reservationId: string;

    @ApiProperty({ description: 'Hotel ID' })
    hotelId: string;

    @ApiProperty({ description: 'Check-in date' })
    checkInDate: string;

    @ApiProperty({ description: 'Check-out date' })
    checkOutDate: string;

    @ApiProperty({ description: 'Reservation amount' })
    amount: number;

    @ApiProperty({ description: 'Timestamp' })
    timestamp: string;

    @ApiProperty({ description: 'Confirmation code' })
    confirmationCode: string;

    @ApiProperty({ description: 'Reservation status', enum: SagaStatus })
    status: SagaStatus.CONFIRMED | SagaStatus.PENDING;
}
