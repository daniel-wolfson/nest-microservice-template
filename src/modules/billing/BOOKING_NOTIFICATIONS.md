# Travel Booking — Notification Architecture

## Overview

After a booking is initiated, three external services (Flight, Hotel, Car Rental) respond
asynchronously via message broker events. The system waits for **all three confirmations**
using the **Join Pattern**, then notifies the client through two parallel channels:
**SSE** (for web UI) and **Webhook** (for B2B backends).

```
Client
  │
  ├─ 1. POST /travel-booking ─────────────────────► TravelBookingController
  │       ◄── { bookingId: "abc-123", status: "pending" }        │
  │                                                              │ emit events to broker
  ├─ 2a. GET /travel-booking/abc-123/status/stream  ◄──┐    [RabbitMQ / Kafka]
  │        (SSE — waits for confirmation)              │         │
  │                                                    │    ┌────┴──────────────────────────┐
  ├─ 2b. POST /travel-booking/abc-123/webhook          │    │  reservation.flight.confirmed │
  │        { webhookUrl: "https://..." }               │    │  reservation.hotel.confirmed  │
  │                                                    │    │  reservation.car.confirmed    │
  │                                                    │    └────┬──────────────────────────┘
  │                                                    │         │
  │                                                    │    Event Handlers (3 parallel)
  │                                                    │    ┌───────────────────────────────────────────────┐
  │                                                    │    │ TravelBookingFlightReservationHandler         │
  │                                                    │    │   1. Save flightReservationId → MongoDB       │
  │                                                    │    │   2. Mark flight_confirmed step               │
  │                                                    │    │   3. Increment Redis step counter             │
  │                                                    │    │   4. Check JOIN POINT ─────────────────────┐  │
  │                                                    │    ├──────────────────────────────              │  │
  │                                                    │    │ TravelBookingHotelReservationHandler       │  │
  │                                                    │    │   1. Save hotelReservationId → MongoDB     │  │
  │                                                    │    │   2. Mark hotel_confirmed step             │  │
  │                                                    │    │   3. Increment Redis step counter          │  │
  │                                                    │    │   4. Check JOIN POINT ─────────────────────┤  │
  │                                                    │    ├───────────────────────────────             │  │
  │                                                    │    │ TravelBookingCarRentalReservationHandler   │  │
  │                                                    │    │   1. Save carRentalReservationId → MongoDB │  │
  │                                                    │    │   2. Mark car_confirmed step               │  │
  │                                                    │    │   3. Increment Redis step counter          │  │
  │                                                    │    │   4. Check JOIN POINT ─────────────────────┘  │
  │                                                    │    └───────────────────────────────────────────────┘
  │                                                    │              │
  │                                                    │              ▼ (when all 3 are present)
  │                                                    │    saga.aggregateResults()
  │                                                    │         │
  │                                                    │         ├─ MongoDB: status → CONFIRMED
  │                                                    │         ├─ Redis: cleanup coordination data
  │                                                    │         └─ Returns TravelBookingResponseDto
  │                                                    │              │
  │                                                    │              ▼
  │                                                    │    BookingNotificationService
  │                                                    │         │
  │  ◄── SSE event (booking.confirmed) ─────────────── └─── bookingEvents$.next()
  │                                                        │
  └─ POST https://my-system.com/callbacks ◄────────────────┘
       (Webhook callback — one-shot delivery)
```

---

## JOIN POINT Logic

Each of the three event handlers checks `completedSteps[]` in MongoDB after marking
its own step. When all three are present, it reconstructs the result objects and
calls `saga.aggregateResults()`. The first handler to arrive waits; the last one fires.

```
completedSteps = ['flight_confirmed']           → wait
completedSteps = ['flight_confirmed', 'hotel_confirmed']  → wait
completedSteps = ['flight_confirmed', 'hotel_confirmed', 'car_confirmed'] → FIRE ✅
```

Because MongoDB's `$addToSet` is atomic, only one handler will observe all three
steps at once — naturally preventing duplicate `aggregateResults()` calls.

---

## Components

| File                                                               | Role                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `services/booking-notification.service.ts`                         | Core: holds RxJS Subject for SSE + webhook Map; delivers notifications |
| `controllers/booking-sse.controller.ts`                            | `GET /:bookingId/status/stream` — SSE endpoint                         |
| `controllers/travel-booking.controller.ts`                         | `POST /:bookingId/webhook` — register webhook callback                 |
| `events/handlers/travel-booking-flight-reservation.handler.ts`     | Handles `reservation.flight.confirmed` + JOIN POINT                    |
| `events/handlers/travel-booking-hotel-reservation.handler.ts`      | Handles `reservation.hotel.confirmed` + JOIN POINT                     |
| `events/handlers/travel-booking-car-rental-reservation.handler.ts` | Handles `reservation.carRental.confirmed` + JOIN POINT                 |

---

## Client Integration Examples

### Web UI — SSE

```typescript
// 1. Start booking
const { bookingId } = await fetch('/travel-booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookingRequest),
}).then(r => r.json());

// 2. Subscribe to real-time updates
const es = new EventSource(`/travel-booking/${bookingId}/status/stream`);

es.addEventListener('booking.confirmed', e => {
    const { result } = JSON.parse(e.data);
    console.log('🎉 All reservations confirmed!', result);
    // result.flightReservationId, result.hotelReservationId, result.carRentalReservationId
    es.close();
});

es.addEventListener('booking.failed', e => {
    const { error } = JSON.parse(e.data);
    console.error('❌ Booking failed:', error);
    es.close();
});
```

### B2B Backend — Webhook

```typescript
// 1. Start booking
const { bookingId } = await fetch('/travel-booking', { method: 'POST', ... }).then(r => r.json());

// 2. Register webhook callback (call immediately after step 1)
await fetch(`/travel-booking/${bookingId}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl: 'https://my-system.com/callbacks/booking' }),
});

// 3. Your callback server receives:
// POST https://my-system.com/callbacks/booking
// Headers:
//   X-Booking-Id: abc-123
//   X-Event-Type: booking.confirmed
// Body:
// {
//   "bookingId": "abc-123",
//   "status": "confirmed",
//   "result": {
//     "flightReservationId": "fl-xxx",
//     "hotelReservationId": "ht-xxx",
//     "carRentalReservationId": "cr-xxx",
//     ...
//   },
//   "timestamp": "2026-02-18T12:00:00.000Z"
// }
```

---

## Notification Payload

```typescript
interface BookingNotification {
    bookingId: string;
    status: 'confirmed' | 'failed';
    result?: TravelBookingResponseDto; // present when status = 'confirmed'
    error?: string; // present when status = 'failed'
    timestamp: Date;
}
```
