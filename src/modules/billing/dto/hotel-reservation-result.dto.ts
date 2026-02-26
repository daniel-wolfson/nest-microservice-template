import { ApiProperty } from '@nestjs/swagger';
import { ReservationResult } from './reservation-confirm-result.dto';

export class HotelReservationResult extends ReservationResult {
    @ApiProperty({ description: 'Hotel ID' })
    hotelId: string;

    @ApiProperty({ description: 'Check-in date' })
    checkInDate: string;

    @ApiProperty({ description: 'Check-out date' })
    checkOutDate: string;
}
