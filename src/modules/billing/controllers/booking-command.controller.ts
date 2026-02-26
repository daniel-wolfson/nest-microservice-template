import { Controller, Post, Body, Param, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BookingData, TravelBookingResponseDto } from '../dto/booking-data.dto';
import { BookTravelCommand } from '../commands/impl/book-travel.command';
import { TravelBookingNotificationService } from '../webhooks_sse/travel-booking-notification.service';
import { ReservationStatus } from '../sagas/saga-status.enum';

export class RegisterWebhookDto {
    @ApiProperty({
        description: 'URL that will receive a POST callback when the booking is confirmed or failed',
        example: 'https://my-system.com/callbacks/booking',
    })
    @IsUrl()
    webhookUrl: string;
}

@ApiTags('Travel Booking Saga')
@Controller('travel-booking')
export class BookingCommandController {
    private readonly logger = new Logger(BookingCommandController.name);

    constructor(
        private readonly commandBus: CommandBus,
        private readonly notificationService: TravelBookingNotificationService,
    ) {}

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
    async bookTravel(@Body() dto: BookingData): Promise<TravelBookingResponseDto> {
        this.logger.log(`Received travel booking request for user: ${dto.userId}`);

        try {
            const command = new BookTravelCommand(dto);
            const result = await this.commandBus.execute<BookTravelCommand, TravelBookingResponseDto>(command);

            if (result.status === ReservationStatus.CONFIRMED) {
                this.logger.log(`✅ Travel booking successful: ${result.requestId.requestId}`);
            } else {
                this.logger.warn(
                    `⚠️ Travel booking compensated: ${result.requestId.requestId} - ${result.errorMessage}`,
                );
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Failed to process travel booking: ${errorMessage}`, errorStack);
            throw error;
        }
    }

    /**
     * Register a one-shot webhook callback for booking completion.
     *
     * Call this immediately after POST /travel-booking with the received bookingId.
     * The service will POST the BookingNotification payload to the provided URL
     * once all three reservations are confirmed (or if the booking fails).
     *
     * The webhook is delivered once and then deregistered automatically.
     */
    @Post(':bookingId/webhook')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Register a webhook callback for booking completion',
        description:
            'Registers a one-shot webhook URL for the given booking. ' +
            'A POST request will be sent to the URL when all service reservations are ' +
            'confirmed (booking.confirmed) or when an error occurs (booking.failed).',
    })
    @ApiParam({ name: 'bookingId', description: 'The booking ID returned by POST /travel-booking' })
    @ApiBody({ type: RegisterWebhookDto })
    @ApiResponse({ status: 200, description: 'Webhook registered successfully' })
    registerWebhook(@Param('bookingId') bookingId: string, @Body() dto: RegisterWebhookDto): { message: string } {
        this.notificationService.registerWebhook(bookingId, dto.webhookUrl);
        return { message: `Webhook registered for booking ${bookingId}` };
    }
}
