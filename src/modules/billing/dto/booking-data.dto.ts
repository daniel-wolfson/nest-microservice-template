import { IsString, IsNotEmpty, IsDateString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SagaStatus } from '../sagas/saga-status.enum';

export class BookingData {
    @ApiProperty({ description: 'User ID initiating the booking' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ description: 'Reservation ID' })
    @IsNotEmpty()
    requestId: string;

    @ApiProperty({ description: 'Origin airport code' })
    @IsString()
    @IsNotEmpty()
    flightOrigin: string;

    @ApiProperty({ description: 'Destination airport code' })
    @IsString()
    @IsNotEmpty()
    flightDestination: string;

    @ApiProperty({ description: 'Flight departure date' })
    @IsDateString()
    departureDate: string;

    @ApiProperty({ description: 'Flight return date' })
    @IsDateString()
    returnDate: string;

    @ApiProperty({ description: 'Hotel name or ID' })
    @IsString()
    @IsNotEmpty()
    hotelId: string;

    @ApiProperty({ description: 'Hotel check-in date' })
    @IsDateString()
    checkInDate: string;

    @ApiProperty({ description: 'Hotel check-out date' })
    @IsDateString()
    checkOutDate: string;

    @ApiProperty({ description: 'Car rental pickup location' })
    @IsString()
    @IsNotEmpty()
    carPickupLocation: string;

    @ApiProperty({ description: 'Car rental dropoff location' })
    @IsString()
    @IsNotEmpty()
    carDropoffLocation: string;

    @ApiProperty({ description: 'Car rental pickup date' })
    @IsDateString()
    carPickupDate: string;

    @ApiProperty({ description: 'Car rental dropoff date' })
    @IsDateString()
    carDropoffDate: string;

    @ApiProperty({ description: 'Total payment amount' })
    @IsNumber()
    @Min(0)
    totalAmount: number;
}

export class TravelBookingResponseDto {
    @ApiProperty({ description: 'Booking ID' })
    bookingId: string;

    @ApiProperty({ description: 'Travel booking request details' })
    @IsNotEmpty()
    originalRequest: BookingData;

    @ApiProperty({ description: 'Flight reservation ID' })
    flightReservationId?: string;

    @ApiProperty({ description: 'Hotel reservation ID' })
    hotelReservationId?: string;

    @ApiProperty({ description: 'Car rental reservation ID' })
    carRentalReservationId?: string;

    @ApiProperty({ description: 'Booking status' })
    status: SagaStatus; // 'PENDING' | 'CONFIRMED' | 'FAILED' | 'COMPENSATED';

    @ApiProperty({ description: 'Error message if failed' })
    errorMessage?: string;

    @ApiProperty({ description: 'Timestamp of booking' })
    timestamp: Date;
}
