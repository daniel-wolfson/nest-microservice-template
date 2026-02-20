import { IsString, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseReservationDto } from './base-reservation.dto';

export class HotelReservationDto extends BaseReservationDto {
    @ApiProperty({ description: 'Hotel ID' })
    @IsString()
    @IsNotEmpty()
    hotelId: string;

    @ApiProperty({ description: 'Check-in date (ISO 8601)' })
    @IsDateString()
    @IsNotEmpty()
    checkInDate: string;

    @ApiProperty({ description: 'Check-out date (ISO 8601)' })
    @IsDateString()
    @IsNotEmpty()
    checkOutDate: string;
}
