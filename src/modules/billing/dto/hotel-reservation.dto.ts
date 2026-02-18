import { IsString, IsNotEmpty, IsDateString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class HotelReservationDto {
    @ApiProperty({ description: 'User ID' })
    @IsString()
    @IsNotEmpty()
    userId: string;

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

    @ApiProperty({ description: 'Reservation amount' })
    @IsNumber()
    @Min(0)
    amount: number;
}

export class HotelReservationResult {
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
    status: string;
}
