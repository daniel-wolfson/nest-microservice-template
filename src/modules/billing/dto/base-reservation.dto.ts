import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Base class for all reservation DTOs
 * Contains common properties shared across Flight, Hotel, and Car Rental reservations
 */
export abstract class BaseReservationDto {
    @ApiProperty({ description: 'User ID' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ description: 'Reservation amount' })
    @IsNumber()
    @Min(0)
    amount: number;
}
