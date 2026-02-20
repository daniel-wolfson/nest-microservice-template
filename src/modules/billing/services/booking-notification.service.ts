import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { TravelBookingResponseDto } from '../dto/booking-data.dto';

export interface BookingNotification {
    bookingId: string;
    status: 'confirmed' | 'failed';
    result?: TravelBookingResponseDto;
    error?: string;
    timestamp: Date;
}

/**
 * Booking Notification Service
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
export class BookingNotificationService implements OnModuleDestroy {
    private readonly logger = new Logger(BookingNotificationService.name);

    /** RxJS Subject that powers SSE streams */
    private readonly bookingEvents$ = new Subject<BookingNotification>();

    /** bookingId → webhookUrl registry */
    private readonly webhookRegistry = new Map<string, string>();

    constructor(private readonly httpService: HttpService) {}

    onModuleDestroy(): void {
        this.bookingEvents$.complete();
    }

    // ─── WEBHOOK REGISTRY ────────────────────────────────────────────────────

    registerWebhook(bookingId: string, webhookUrl: string): void {
        this.webhookRegistry.set(bookingId, webhookUrl);
        this.logger.log(`🔗 Webhook registered for booking ${bookingId} → ${webhookUrl}`);
    }

    // ─── SSE STREAM ──────────────────────────────────────────────────────────

    /**
     * Returns an Observable that emits the single notification for this booking.
     * Used by BookingSseController to create per-client SSE streams.
     */
    getBookingStream(bookingId: string): Observable<BookingNotification> {
        return this.bookingEvents$.asObservable().pipe(filter(event => event.bookingId === bookingId));
    }

    // ─── NOTIFY CONFIRMED ────────────────────────────────────────────────────

    async notifyBookingConfirmed(bookingId: string, result: TravelBookingResponseDto): Promise<void> {
        const notification: BookingNotification = {
            bookingId,
            status: 'confirmed',
            result,
            timestamp: new Date(),
        };

        // Push to all SSE listeners
        this.bookingEvents$.next(notification);
        this.logger.log(`📡 SSE event emitted: booking ${bookingId} → confirmed`);

        // Send Webhook if registered
        await this.sendWebhook(notification);
    }

    // ─── NOTIFY FAILED ────────────────────────────────────────────────────

    async notifyBookingFailed(bookingId: string, error: string): Promise<void> {
        const notification: BookingNotification = {
            bookingId,
            status: 'failed',
            error,
            timestamp: new Date(),
        };

        this.bookingEvents$.next(notification);
        this.logger.warn(`📡 SSE event emitted: booking ${bookingId} → failed`);

        await this.sendWebhook(notification);
    }

    // ─── INTERNAL: SEND WEBHOOK ───────────────────────────────────────────────

    private async sendWebhook(notification: BookingNotification): Promise<void> {
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
