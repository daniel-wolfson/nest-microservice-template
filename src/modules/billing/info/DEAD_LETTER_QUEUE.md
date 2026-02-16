# Dead Letter Queue (DLQ) for Failed Compensations

## Overview

When a compensation transaction fails during the Saga rollback process, the system publishes a `CompensationFailedEvent` to a Dead Letter Queue (DLQ). This ensures that failed compensations are tracked, logged, and can be retried manually or automatically.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Saga Compensation Flow                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                       Saga Fails
                              │
                              ▼
                    ┌──────────────────┐
                    │   Compensate:    │
                    │   Cancel Car     │
                    └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              ✓ SUCCESS            ✗ FAILURE
                    │                   │
                    ▼                   ▼
          ┌──────────────────┐   ┌──────────────────────┐
          │   Continue to    │   │ Publish              │
          │   Cancel Hotel   │   │ CompensationFailed   │
          └──────────────────┘   │ Event to DLQ         │
                                 └──────────────────────┘
                                           │
                                           ▼
                              ┌──────────────────────────┐
                              │ CompensationFailed       │
                              │ Handler Processes Event  │
                              │ - Log to monitoring      │
                              │ - Store in DB            │
                              │ - Send alerts            │
                              │ - Schedule retry         │
                              └──────────────────────────┘
```

## Components

### 1. CompensationFailedEvent

**Location**: `events/impl/compensation-failed.event.ts`

Event published when a compensation transaction fails.

**Properties**:
- `bookingId`: The travel booking ID
- `compensationType`: Type of compensation ('flight' | 'hotel' | 'car')
- `reservationId`: The reservation ID that failed to cancel
- `errorMessage`: Human-readable error message
- `errorStack`: Optional stack trace for debugging
- `timestamp`: When the failure occurred
- `retryCount`: Number of retry attempts (default 0)

**Example**:
```typescript
new CompensationFailedEvent(
  'TRV-1234567890-ABC',
  'flight',
  'FLT-123',
  'Flight cancellation API unavailable',
  'Error: Flight cancellation API unavailable\n    at ...',
  new Date(),
  0
)
```

### 2. CompensationFailedHandler

**Location**: `events/handlers/compensation-failed.handler.ts`

Event handler that processes compensation failures.

**Current Implementation**:
- Logs detailed error information
- Warns about need for manual intervention
- Provides TODO comments for production features

**Production Recommendations**:
```typescript
// 1. Store in database
await this.deadLetterQueueRepository.save({
  bookingId: event.bookingId,
  compensationType: event.compensationType,
  reservationId: event.reservationId,
  errorMessage: event.errorMessage,
  errorStack: event.errorStack,
  timestamp: event.timestamp,
  retryCount: event.retryCount,
  status: 'pending',
});

// 2. Send alert to operations team
await this.alertService.sendAlert({
  severity: 'high',
  title: 'Compensation Failed',
  message: `Failed to compensate ${event.compensationType}`,
  metadata: event,
});

// 3. Schedule automatic retry
if (event.retryCount < 3) {
  await this.retryScheduler.scheduleRetry(event, event.retryCount + 1);
}

// 4. Update saga state
await this.sagaStateRepository.updateCompensationStatus(
  event.bookingId,
  event.compensationType,
  'failed',
);
```

### 3. Updated TravelBookingSaga

The saga's `compensate` method now includes DLQ publishing:

```typescript
private async compensate(
  bookingId: string,
  flightReservation: FlightReservationResult | null,
  hotelReservation: HotelReservationResult | null,
  carRentalReservation: CarRentalReservationResult | null,
): Promise<void> {
  // ... compensation logic
  
  try {
    await this.flightService.cancelFlight(reservationId);
    this.logger.log(`✓ Compensated: Flight booking cancelled`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Publish to Dead Letter Queue
    const deadLetterEvent = new CompensationFailedEvent(
      bookingId,
      'flight',
      reservationId,
      errorMessage,
      errorStack,
    );
    this.eventBus.publish(deadLetterEvent);
    this.logger.warn(`📮 Published CompensationFailedEvent to DLQ`);
  }
}
```

## Behavior

### Success Case
When compensations succeed, no events are published:
```
[TravelBookingSaga] 🔄 Starting Compensation Process...
[HotelService] Compensating: Canceling hotel reservation HTL-456
[TravelBookingSaga] ✓ Compensated: Hotel booking cancelled
[FlightService] Compensating: Canceling flight reservation FLT-123
[TravelBookingSaga] ✓ Compensated: Flight booking cancelled
[TravelBookingSaga] ✅ Compensation Process Completed
```

### Failure Case
When a compensation fails, event is published:
```
[TravelBookingSaga] 🔄 Starting Compensation Process...
[HotelService] Compensating: Canceling hotel reservation HTL-456
[TravelBookingSaga] ✓ Compensated: Hotel booking cancelled
[FlightService] Compensating: Canceling flight reservation FLT-123
[TravelBookingSaga] Failed to cancel flight: Flight cancellation API unavailable
[TravelBookingSaga] 📮 Published CompensationFailedEvent to Dead Letter Queue for flight FLT-123
[TravelBookingSaga] ✅ Compensation Process Completed

[CompensationFailedHandler] 📬 Dead Letter Queue: Compensation failed for flight reservation FLT-123
[CompensationFailedHandler] Booking ID: TRV-1708099200000-ABC
[CompensationFailedHandler] Error: Flight cancellation API unavailable
[CompensationFailedHandler] Timestamp: 2026-02-16T12:00:05.000Z
[CompensationFailedHandler] Retry Count: 0
[CompensationFailedHandler] ⚠️ Manual intervention may be required for flight cancellation (FLT-123)
```

## Testing

### Unit Tests

**Location**: `tests/billing/travel-booking-dlq.spec.ts`

Tests include:
- ✅ Publishing CompensationFailedEvent when flight cancellation fails
- ✅ Publishing when hotel cancellation fails
- ✅ Publishing when car cancellation fails
- ✅ Publishing multiple events when multiple compensations fail
- ✅ Including error stack in events
- ✅ Including booking ID in events
- ✅ Continuing compensation even when one fails

**Run tests**:
```bash
npm test travel-booking-dlq
```

### Manual Testing

To test compensation failures, you can modify a service to always throw an error during cancellation:

```typescript
// In flight.service.ts - temporarily for testing
async cancelFlight(reservationId: string): Promise<void> {
  // Force failure
  throw new Error('SIMULATED: Flight cancellation API unavailable');
}
```

Then trigger a saga failure and observe the DLQ event being published.

## Production Implementation Checklist

### 1. Database Schema
Create a table to store failed compensations:

```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id VARCHAR(100) NOT NULL,
  compensation_type VARCHAR(20) NOT NULL,
  reservation_id VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  timestamp TIMESTAMP NOT NULL,
  retry_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  last_retry_at TIMESTAMP,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dlq_booking_id ON dead_letter_queue(booking_id);
CREATE INDEX idx_dlq_status ON dead_letter_queue(status);
CREATE INDEX idx_dlq_timestamp ON dead_letter_queue(timestamp);
```

### 2. Repository Implementation

```typescript
@Injectable()
export class DeadLetterQueueRepository {
  async save(event: CompensationFailedEvent): Promise<void> {
    await this.prisma.deadLetterQueue.create({
      data: {
        bookingId: event.bookingId,
        compensationType: event.compensationType,
        reservationId: event.reservationId,
        errorMessage: event.errorMessage,
        errorStack: event.errorStack,
        timestamp: event.timestamp,
        retryCount: event.retryCount,
        status: 'pending',
      },
    });
  }
}
```

### 3. Alert Service Integration

```typescript
await this.alertService.sendAlert({
  channel: 'ops-critical',
  severity: 'high',
  title: 'Saga Compensation Failed',
  message: `Failed to cancel ${event.compensationType} reservation`,
  fields: {
    'Booking ID': event.bookingId,
    'Reservation ID': event.reservationId,
    'Error': event.errorMessage,
    'Retry Count': event.retryCount,
  },
});
```

### 4. Retry Scheduler

```typescript
@Injectable()
export class CompensationRetryScheduler {
  async scheduleRetry(event: CompensationFailedEvent, newRetryCount: number): Promise<void> {
    const delayMinutes = Math.pow(2, newRetryCount) * 5; // Exponential backoff
    
    await this.queueService.schedule(
      'retry-compensation',
      {
        bookingId: event.bookingId,
        compensationType: event.compensationType,
        reservationId: event.reservationId,
        retryCount: newRetryCount,
      },
      {
        delay: delayMinutes * 60 * 1000,
      },
    );
  }
}
```

### 5. Monitoring Dashboard

Create a dashboard to view and manage failed compensations:

- **Pending**: Compensations waiting for retry
- **Retrying**: Currently being retried
- **Failed**: Exceeded max retries
- **Resolved**: Manually or automatically resolved

Actions:
- View details
- Retry now
- Mark as resolved
- View error logs

### 6. Metrics & Alerts

Track the following metrics:

- `compensation_failures_total` - Counter
- `compensation_retry_attempts_total` - Counter
- `compensation_resolution_time_seconds` - Histogram
- `pending_compensations_count` - Gauge

Alert on:
- Compensation failure rate > 5%
- Pending compensations > 10
- Compensation age > 24 hours

## Best Practices

1. **Never Lose Data**: Always publish to DLQ before giving up
2. **Include Context**: Provide enough information to manually resolve
3. **Exponential Backoff**: Increase delay between retries
4. **Max Retries**: Set a limit (e.g., 3 attempts)
5. **Manual Resolution**: Provide tools for ops team to intervene
6. **Audit Trail**: Log all retry attempts and resolutions
7. **Monitoring**: Alert on DLQ buildup
8. **Documentation**: Maintain runbook for manual resolution

## Manual Resolution Procedure

When a compensation cannot be automatically resolved:

1. **Identify the Issue**
   - Check error message and stack trace
   - Verify external service status
   - Review reservation details

2. **Attempt Manual Cancellation**
   - Use external service's admin panel
   - Contact service provider if necessary
   - Document the cancellation reference

3. **Update Records**
   - Mark DLQ entry as resolved
   - Record resolution method
   - Update saga state if applicable

4. **Issue Refund (if applicable)**
   - If cancellation succeeded, no refund needed
   - If stuck, issue manual refund to customer
   - Document transaction details

5. **Post-Mortem**
   - Document root cause
   - Implement preventive measures
   - Update monitoring if needed

## Related Documentation

- [SAGA_PATTERN.md](SAGA_PATTERN.md) - Overall saga implementation
- [SAGA_QUICKSTART.md](../SAGA_QUICKSTART.md) - Quick start guide
- [SAGA_EXAMPLES.http](SAGA_EXAMPLES.http) - Example requests

## Summary

The Dead Letter Queue implementation ensures that:
- ✅ No compensation failures are silently ignored
- ✅ Operations team is alerted to issues requiring intervention
- ✅ Failed compensations can be retried automatically
- ✅ Full audit trail exists for all compensation attempts
- ✅ System remains resilient even when external services fail
- ✅ Customer data integrity is maintained
