import { IsString, IsNotEmpty, IsDateString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CarRentalReservationDto {
    @ApiProperty({ description: 'User ID' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ description: 'Pickup location' })
    @IsString()
    @IsNotEmpty()
    pickupLocation: string;

    @ApiProperty({ description: 'Drop-off location' })
    @IsString()
    @IsNotEmpty()
    dropoffLocation: string;

    @ApiProperty({ description: 'Pickup date (ISO 8601)' })
    @IsDateString()
    @IsNotEmpty()
    pickupDate: string;

    @ApiProperty({ description: 'Drop-off date (ISO 8601)' })
    @IsDateString()
    @IsNotEmpty()
    dropoffDate: string;

    @ApiProperty({ description: 'Reservation amount' })
    @IsNumber()
    @Min(0)
    amount: number;
}

export interface CarRentalReservationResult {
    reservationId: string;
    confirmationCode: string;
    status: 'confirmed' | 'pending';
    amount: number;
}
