import { IsString, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseReservation } from './base-reservation.dto';

export class CarReservationRequest extends BaseReservation {
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
}
