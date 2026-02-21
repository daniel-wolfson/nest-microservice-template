import { Controller, Get, Param, Sse, MessageEvent, Logger } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Observable, map, timeout, catchError, EMPTY } from 'rxjs';
import { TravelBookingNotificationService } from '../webhooks_sse/travel-booking-notification.service';

/**
 * SSE endpoint for real-time booking status updates.
 *
 * Usage (browser):
 *   const es = new EventSource('/travel-booking/abc-123/status/stream');
 *   es.addEventListener('booking.confirmed', e => {
 *       const data = JSON.parse(e.data);
 *       console.log('🎉 Booking confirmed!', data.result);
 *       es.close();
 *   });
 *   es.addEventListener('booking.failed', e => {
 *       const data = JSON.parse(e.data);
 *       console.error('❌ Booking failed:', data.error);
 *       es.close();
 *   });
 */
@ApiTags('Travel Booking Saga')
@Controller('travel-booking')
export class BookingSseController {
    private readonly logger = new Logger(BookingSseController.name);

    constructor(private readonly notificationService: TravelBookingNotificationService) {}

    /**
     * Subscribe to booking status updates via Server-Sent Events.
     * The stream auto-closes after receiving the final event (confirmed or failed)
     * or after a 5-minute timeout.
     */
    @Sse(':bookingId/status/stream')
    @ApiOperation({
        summary: 'Subscribe to booking status updates via SSE',
        description:
            'Opens a long-lived SSE connection. The server pushes a single event ' +
            '(booking.confirmed or booking.failed) as soon as all three service ' +
            'reservations are resolved. Connection closes automatically after the event.',
    })
    @ApiParam({ name: 'bookingId', description: 'The booking ID returned by POST /travel-booking' })
    streamBookingStatus(@Param('bookingId') bookingId: string): Observable<MessageEvent> {
        this.logger.log(`🔌 SSE client connected for booking: ${bookingId}`);

        return this.notificationService.getBookingStream(bookingId).pipe(
            // Auto-close stream after 5 minutes regardless of outcome
            timeout(5 * 60 * 1000),
            map(
                (notification): MessageEvent => ({
                    data: JSON.stringify(notification),
                    type: `booking.${notification.status}`,
                    id: bookingId,
                    retry: undefined,
                }),
            ),
            catchError(() => {
                this.logger.warn(`⏰ SSE stream timed out for booking: ${bookingId}`);
                return EMPTY;
            }),
        );
    }
}
