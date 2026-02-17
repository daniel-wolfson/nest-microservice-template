import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TravelBookingDto, TravelBookingResponseDto } from '../dto/travel-booking.dto';
import { BookTravelCommand } from '../commands/impl/book-travel.command';

@ApiTags('Travel Booking Saga')
@Controller('travel-booking')
export class TravelBookingController {
    private readonly logger = new Logger(TravelBookingController.name);

    constructor(private readonly commandBus: CommandBus) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Book a complete travel package (Flight + Hotel + Car)',
        description: `
      Executes a Saga pattern for distributed travel booking:
      1. Reserve Flight
      2. Reserve Hotel
      3. Reserve Car
      4. Process Payment
      
      If any step fails, compensating transactions are executed in reverse order:
      - Cancel Car
      - Cancel Hotel
      - Cancel Flight
      
      This demonstrates the Saga pattern for handling distributed transactions.
    `,
    })
    @ApiResponse({
        status: 200,
        description: 'Travel booking completed (either confirmed or compensated)',
        type: TravelBookingResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid request data',
    })
    @ApiResponse({
        status: 500,
        description: 'Internal server error',
    })
    async bookTravel(@Body() dto: TravelBookingDto): Promise<TravelBookingResponseDto> {
        this.logger.log(`Received travel booking request for user: ${dto.userId}`);

        try {
            const command = new BookTravelCommand(dto);
            const result = await this.commandBus.execute<BookTravelCommand, TravelBookingResponseDto>(command);

            if (result.status === 'confirmed') {
                this.logger.log(`✅ Travel booking successful: ${result.bookingId}`);
            } else {
                this.logger.warn(`⚠️ Travel booking compensated: ${result.bookingId} - ${result.errorMessage}`);
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Failed to process travel booking: ${errorMessage}`, errorStack);
            throw error;
        }
    }
}
