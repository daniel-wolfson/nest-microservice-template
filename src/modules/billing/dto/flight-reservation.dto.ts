import { IsString, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseReservationDto } from './base-reservation.dto';

export class FlightReservationDto extends BaseReservationDto {
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
}
