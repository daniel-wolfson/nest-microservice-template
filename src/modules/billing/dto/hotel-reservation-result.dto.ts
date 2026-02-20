import { ApiProperty } from '@nestjs/swagger';
import { IReservationConfirmResult } from '../services/reservation-confirm-result.interface';

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

    @ApiProperty({ description: 'Reservation status' })
    status: 'confirmed' | 'pending';
}
