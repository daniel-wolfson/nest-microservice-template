import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { CompensationFailedEvent } from '../impl/compensation-failed.event';

/**
 * Compensation Failed Event Handler
 * Handles events published to Dead Letter Queue when compensations fail
 *
 * In production, this handler could:
 * - Store failed compensations in a database table
 * - Send alerts to operations team
 * - Trigger retry mechanisms
 * - Log to external monitoring systems (Sentry, DataDog, etc.)
 * - Update saga state to track failed compensations
 */
@EventsHandler(CompensationFailedEvent)
export class CompensationFailedHandler implements IEventHandler<CompensationFailedEvent> {
    private readonly logger = new Logger(CompensationFailedHandler.name);

    async handle(event: CompensationFailedEvent) {
        this.logger.error(
            `📬 Dead Letter Queue: Compensation failed for ${event.compensationType} reservation ${event.reservationId}`,
        );
        this.logger.error(`Booking ID: ${event.bookingId}`);
        this.logger.error(`Error: ${event.errorMessage}`);
        this.logger.error(`Timestamp: ${event.timestamp.toISOString()}`);
        this.logger.error(`Retry Count: ${event.retryCount}`);

        if (event.errorStack) {
            this.logger.debug(`Stack Trace: ${event.errorStack}`);
        }

        // TODO: In production, implement the following:
        // 1. Store in dead letter queue table for manual review
        // await this.deadLetterQueueRepository.save({
        //   bookingId: event.bookingId,
        //   compensationType: event.compensationType,
        //   reservationId: event.reservationId,
        //   errorMessage: event.errorMessage,
        //   errorStack: event.errorStack,
        //   timestamp: event.timestamp,
        //   retryCount: event.retryCount,
        //   status: 'pending',
        // });

        // 2. Send alert to operations team
        // await this.alertService.sendAlert({
        //   severity: 'high',
        //   title: 'Compensation Failed',
        //   message: `Failed to compensate ${event.compensationType} for booking ${event.bookingId}`,
        //   metadata: event,
        // });

        // 3. Schedule automatic retry after delay (if retry count < max retries)
        // if (event.retryCount < 3) {
        //   await this.retryScheduler.scheduleRetry(event, event.retryCount + 1);
        // }

        // 4. Update saga state
        // await this.sagaStateRepository.updateCompensationStatus(
        //   event.bookingId,
        //   event.compensationType,
        //   'failed',
        // );

        this.logger.warn(
            `⚠️ Manual intervention may be required for ${event.compensationType} cancellation (${event.reservationId})`,
        );
    }
}
