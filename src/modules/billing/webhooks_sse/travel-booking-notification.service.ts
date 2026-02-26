import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { TravelBookingResponseDto } from '../dto/booking-data.dto';

export interface TravelBookingNotification {
    bookingId: string;
    status: 'CONFIRMED' | 'failed';
    result?: TravelBookingResponseDto;
    error?: string;
    timestamp: number;
}

/**
 * Travel Booking Notification Service
 *
 * Responsible for notifying clients about booking completion via two channels:
 *
 * 1. SSE (Server-Sent Events) — real-time streaming for web clients.
 *    Client subscribes to GET /travel-booking/:bookingId/status/stream
 *    and receives a push event as soon as all three reservations are confirmed.
 *
 * 2. Webhook — HTTP POST callback for B2B/backend clients.
 *    Client registers a callback URL via POST /travel-booking/:bookingId/webhook
 *    immediately after receiving a bookingId from POST /travel-booking.
 *
 * Both channels are triggered together inside notifyBookingConfirmed() /
 * notifyBookingFailed(), which is called from the event handlers' JOIN POINT
 * once flight_confirmed + hotel_confirmed + car_confirmed are all present.
 */
@Injectable()
export class TravelBookingNotificationService implements OnModuleDestroy {
    private readonly logger = new Logger(TravelBookingNotificationService.name);

    /** RxJS Subject that powers SSE streams */
    private readonly bookingEvents$ = new Subject<TravelBookingNotification>();

    /** bookingId → webhookUrl registry */
    private readonly webhookRegistry = new Map<string, string>();

    constructor(private readonly httpService: HttpService) {}

    onModuleDestroy(): void {
        this.bookingEvents$.complete();
    }

    /** WEBHOOK REGISTRY
     * Registers a webhook URL for a specific booking ID.
     * @param bookingId - The ID of the booking for which to register the webhook
     * @param webhookUrl - The URL to which webhook notifications should be sent
     */
    registerWebhook(bookingId: string, webhookUrl: string): void {
        this.webhookRegistry.set(bookingId, webhookUrl);
        this.logger.log(`🔗 Webhook registered for booking ${bookingId} → ${webhookUrl}`);
    }

    /** SSE STREAM
     * Returns an Observable that emits the single notification for this booking.
     * Used by BookingSseController to create per-client SSE streams.
     */
    getBookingStream(bookingId: string): Observable<TravelBookingNotification> {
        return this.bookingEvents$.asObservable().pipe(filter(event => event.bookingId === bookingId));
    }

    /** BOOKING CONFIRMED
     * Notify clients that the booking has been confirmed. This is called from the saga's completion flow once all steps are successful.
     * It emits a 'CONFIRMED' event to SSE listeners and sends a webhook with the result.
     * @param bookingId - The ID of the booking that was confirmed
     * @param result - The result object containing booking details
     */
    async notifyBookingConfirmed(bookingId: string, result: TravelBookingResponseDto): Promise<void> {
        const notification: TravelBookingNotification = {
            bookingId,
            status: 'CONFIRMED',
            result,
            timestamp: new Date().getTime(),
        };

        // Push to all SSE listeners
        this.bookingEvents$.next(notification);
        this.logger.log(`📡 SSE event emitted: booking ${bookingId} → confirmed`);

        // Send Webhook if registered
        await this.sendWebhook(notification);
    }

    /** BOOKING FAILED
     * Notify clients that the booking has failed. This can be called from the saga's compensation flow if any step fails.
     * It emits a 'failed' event to SSE listeners and sends a webhook with the error message.
     * @param bookingId - The ID of the booking that failed
     * @param error - A string describing the error that caused the failure
     */
    async notifyBookingFailed(bookingId: string, error: string): Promise<void> {
        const notification: TravelBookingNotification = {
            bookingId,
            status: 'failed',
            error,
            timestamp: new Date().getTime(),
        };

        this.bookingEvents$.next(notification);
        this.logger.warn(`📡 SSE event emitted: booking ${bookingId} → failed`);

        await this.sendWebhook(notification);
    }

    /** SEND WEBHOOK
     * Sends a webhook notification to the registered URL for this booking, if any.
     * The payload includes the bookingId, status, and either the result (for confirmed) or error message (for failed).
     * After sending, it logs the outcome and removes the webhook from the registry to ensure one-shot delivery.
     * @param notification - The notification object containing bookingId, status, result/error, and timestamp
     */
    private async sendWebhook(notification: TravelBookingNotification): Promise<void> {
        const webhookUrl = this.webhookRegistry.get(notification.bookingId);
        if (!webhookUrl) return;

        try {
            await this.httpService.axiosRef.post(webhookUrl, notification, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Booking-Id': notification.bookingId,
                    'X-Event-Type': `booking.${notification.status}`,
                },
                timeout: 5000,
            });
            this.logger.log(`✅ Webhook delivered: booking ${notification.bookingId} → ${webhookUrl}`);
            this.webhookRegistry.delete(notification.bookingId); // one-shot delivery
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`❌ Webhook delivery failed for booking ${notification.bookingId}: ${msg}`);
        }
    }
}
