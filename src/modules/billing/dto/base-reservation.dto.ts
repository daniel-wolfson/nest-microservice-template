import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Base class for all reservation DTOs
 * Contains common properties shared across Flight, Hotel, and Car Rental reservations
 */
export abstract class BaseReservation {
    @ApiProperty({ description: 'User ID' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ description: 'Reservation amount' })
    @IsNumber()
    @Min(0)
    amount: number;

    @ApiProperty({ description: 'Request ID' })
    @IsString()
    @IsNotEmpty()
    requestId: string;
}
