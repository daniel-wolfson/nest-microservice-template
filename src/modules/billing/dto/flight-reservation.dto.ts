import { IsString, IsNotEmpty, IsDateString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FlightReservationDto {
    @ApiProperty({ description: 'User ID' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ description: 'Departure airport / city code' })
    @IsString()
    @IsNotEmpty()
    origin: string;

    @ApiProperty({ description: 'Arrival airport / city code' })
    @IsString()
    @IsNotEmpty()
    destination: string;

    @ApiProperty({ description: 'Departure date (ISO 8601)' })
    @IsDateString()
    @IsNotEmpty()
    departureDate: string;

    @ApiProperty({ description: 'Return date (ISO 8601)' })
    @IsDateString()
    @IsNotEmpty()
    returnDate: string;

    @ApiProperty({ description: 'Reservation amount' })
    @IsNumber()
    @Min(0)
    amount: number;
}

export interface FlightReservationResult {
    reservationId: string;
    confirmationCode: string;
    status: 'confirmed' | 'pending';
    amount: number;
}
