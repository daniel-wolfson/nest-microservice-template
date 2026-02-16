# Travel Booking Saga Pattern Implementation

## Overview

This implementation demonstrates the **Saga Pattern** for managing distributed transactions across multiple microservices. The saga orchestrates a travel booking workflow that includes flight, hotel, and car rental reservations.

## Saga Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Travel Booking Saga                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Reserve Flight  │
                    └──────────────────┘
                              │
                        ✓ SUCCESS
                              │
                              ▼
                    ┌──────────────────┐
                    │   Reserve Hotel  │
                    └──────────────────┘
                              │
                        ✓ SUCCESS
                              │
                              ▼
                    ┌──────────────────┐
                    │   Reserve Car    │
                    └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              ✓ SUCCESS            ✗ FAILURE
                    │                   │
                    ▼                   ▼
          ┌──────────────────┐   ┌──────────────────┐
          │ Process Payment  │   │  COMPENSATE:     │
          └──────────────────┘   │  1. Cancel Car   │
                    │             │  2. Cancel Hotel │
              ✓ SUCCESS           │  3. Cancel Flight│
                    │             └──────────────────┘
                    ▼
          ┌──────────────────┐
          │ Booking Confirmed│
          └──────────────────┘
```

## Architecture

### Services

#### 1. FlightService

-   **Location**: `services/flight.service.ts`
-   **Responsibilities**:
    -   Reserve flights
    -   Cancel flight reservations (compensation)
    -   Manage flight reservation state
-   **Features**:
    -   10% simulated failure rate
    -   Generates unique reservation IDs and confirmation codes
    -   Tracks all reservations in memory

#### 2. HotelService

-   **Location**: `services/hotel.service.ts`
-   **Responsibilities**:
    -   Reserve hotel rooms
    -   Cancel hotel reservations (compensation)
    -   Manage hotel reservation state
-   **Features**:
    -   10% simulated failure rate
    -   Generates unique reservation IDs and confirmation codes
    -   Tracks all reservations in memory

#### 3. CarRentalService

-   **Location**: `services/car-rental.service.ts`
-   **Responsibilities**:
    -   Reserve rental cars
    -   Cancel car rental reservations (compensation)
    -   Manage car rental reservation state
-   **Features**:
    -   **30% simulated failure rate** (intentionally higher to demonstrate compensation)
    -   Generates unique reservation IDs and confirmation codes
    -   Tracks all reservations in memory

### Saga Orchestrator

#### TravelBookingSaga

-   **Location**: `sagas/travel-booking.saga.ts`
-   **Pattern**: Orchestration-based Saga
-   **Responsibilities**:
    -   Coordinate the entire booking workflow
    -   Execute steps sequentially
    -   Handle failures and trigger compensation
    -   Maintain saga state

**Key Methods**:

-   `execute()`: Main saga execution method
-   `reserveFlight()`: Step 1 - Reserve flight
-   `reserveHotel()`: Step 2 - Reserve hotel
-   `reserveCar()`: Step 3 - Reserve car rental
-   `processPayment()`: Step 4 - Process payment
-   `compensate()`: Execute compensating transactions in reverse order

### CQRS Components

#### Commands

-   **BookTravelCommand**: Command to initiate travel booking
-   **BookTravelHandler**: Handler that invokes the saga

#### Events

-   **TravelBookingCreatedEvent**: Published when booking succeeds
-   **TravelBookingFailedEvent**: Published when booking fails
-   **TravelBookingCompensatedEvent**: Published when compensation completes

#### DTOs

-   **TravelBookingDto**: Input data for booking
-   **TravelBookingResponseDto**: Response with booking details
-   **FlightReservationDto/Result**: Flight-specific data
-   **HotelReservationDto/Result**: Hotel-specific data
-   **CarRentalReservationDto/Result**: Car rental-specific data

## API Endpoint

### POST /travel-booking

Book a complete travel package with automatic compensation on failure.

**Request Body**:

```json
{
    "userId": "user-123",
    "flightOrigin": "JFK",
    "flightDestination": "LAX",
    "departureDate": "2026-03-01",
    "returnDate": "2026-03-08",
    "hotelId": "hotel-456",
    "checkInDate": "2026-03-01",
    "checkOutDate": "2026-03-08",
    "carPickupLocation": "LAX Airport",
    "carDropoffLocation": "LAX Airport",
    "carPickupDate": "2026-03-01",
    "carDropoffDate": "2026-03-08",
    "totalAmount": 2500.0
}
```

**Success Response** (200 OK):

```json
{
    "bookingId": "TRV-1708099200000-ABC123XYZ",
    "flightReservationId": "FLT-1708099201000-def456uvw",
    "hotelReservationId": "HTL-1708099202200-ghi789rst",
    "carRentalReservationId": "CAR-1708099203700-jkl012mno",
    "status": "confirmed",
    "timestamp": "2026-02-16T12:00:00.000Z"
}
```

**Compensated Response** (200 OK):

```json
{
    "bookingId": "TRV-1708099200000-ABC123XYZ",
    "flightReservationId": "FLT-1708099201000-def456uvw",
    "hotelReservationId": "HTL-1708099202200-ghi789rst",
    "carRentalReservationId": null,
    "status": "compensated",
    "errorMessage": "No available cars for the selected location and dates",
    "timestamp": "2026-02-16T12:00:05.000Z"
}
```

## Compensation Strategy

The saga implements **backward recovery** through compensating transactions:

1. **Detect Failure**: Any step in the saga can fail
2. **Stop Forward Progress**: No further steps are executed
3. **Execute Compensations**: Cancel operations in **reverse order**:
    - Cancel Car Rental (if reserved)
    - Cancel Hotel (if reserved)
    - Cancel Flight (if reserved)
4. **Return Compensated Status**: Inform the client that the booking failed but was properly rolled back

### Compensation Characteristics

-   **Idempotent**: Compensations can be safely retried
-   **Best Effort**: Logs errors but continues with remaining compensations
-   **Reverse Order**: Ensures dependencies are handled correctly
-   **Async**: Each compensation is awaited before proceeding

## Testing the Saga

### Testing Successful Flow

```bash
curl -X POST http://localhost:3000/travel-booking \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "flightOrigin": "JFK",
    "flightDestination": "LAX",
    "departureDate": "2026-03-01",
    "returnDate": "2026-03-08",
    "hotelId": "hotel-456",
    "checkInDate": "2026-03-01",
    "checkOutDate": "2026-03-08",
    "carPickupLocation": "LAX Airport",
    "carDropoffLocation": "LAX Airport",
    "carPickupDate": "2026-03-01",
    "carDropoffDate": "2026-03-08",
    "totalAmount": 2500.00
  }'
```

### Testing Compensation Flow

Due to the 30% failure rate in car rental service, approximately 3 out of 10 requests will trigger compensation. You can test this by making multiple requests and observing the responses.

### Logs to Watch

**Successful Booking**:

```
[TravelBookingSaga] Starting Travel Booking Saga: TRV-...
[TravelBookingSaga] Step 1: Reserving Flight...
[FlightService] Reserving flight from JFK to LAX for user user-123
[FlightService] Flight reserved successfully: FLT-... (ABC123)
[TravelBookingSaga] ✓ Step 1 Complete: Flight Reserved
[TravelBookingSaga] Step 2: Reserving Hotel...
[HotelService] Reserving hotel hotel-456 for user user-123
[HotelService] Hotel reserved successfully: HTL-... (DEF456)
[TravelBookingSaga] ✓ Step 2 Complete: Hotel Reserved
[TravelBookingSaga] Step 3: Reserving Car...
[CarRentalService] Reserving car at LAX Airport for user user-123
[CarRentalService] Car reserved successfully: CAR-... (GHI789)
[TravelBookingSaga] ✓ Step 3 Complete: Car Reserved
[TravelBookingSaga] Step 4: Processing Payment of $2500...
[TravelBookingSaga] ✓ Step 4 Complete: Payment Processed
[TravelBookingSaga] ✅ Travel Booking Saga Completed Successfully: TRV-...
```

**Compensated Booking**:

```
[TravelBookingSaga] Starting Travel Booking Saga: TRV-...
[TravelBookingSaga] Step 1: Reserving Flight...
[FlightService] Flight reserved successfully: FLT-...
[TravelBookingSaga] ✓ Step 1 Complete: Flight Reserved
[TravelBookingSaga] Step 2: Reserving Hotel...
[HotelService] Hotel reserved successfully: HTL-...
[TravelBookingSaga] ✓ Step 2 Complete: Hotel Reserved
[TravelBookingSaga] Step 3: Reserving Car...
[CarRentalService] Car rental reservation failed - no available cars
[TravelBookingSaga] ❌ Travel Booking Saga Failed: No available cars...
[TravelBookingSaga] 🔄 Starting Compensation Process...
[CarRentalService] Compensating: Canceling car rental reservation CAR-...
[TravelBookingSaga] ✓ Compensated: Car rental cancelled
[HotelService] Compensating: Canceling hotel reservation HTL-...
[TravelBookingSaga] ✓ Compensated: Hotel booking cancelled
[FlightService] Compensating: Canceling flight reservation FLT-...
[TravelBookingSaga] ✓ Compensated: Flight booking cancelled
[TravelBookingSaga] ✅ Compensation Process Completed
```

## Benefits of This Implementation

1. **Eventual Consistency**: Maintains consistency across services without distributed locks
2. **Fault Tolerance**: Handles failures gracefully with automatic rollback
3. **Visibility**: Clear logging of each step and compensation
4. **Scalability**: Services remain independent and can scale separately
5. **Testability**: Easy to test with simulated failures
6. **Maintainability**: Clear separation of concerns with CQRS pattern

## Key Saga Pattern Concepts Demonstrated

-   **Orchestration**: Centralized saga coordinator (TravelBookingSaga)
-   **Compensating Transactions**: Explicit compensation logic for each step
-   **Forward Recovery**: Not implemented (could retry failed steps)
-   **Backward Recovery**: Implemented via compensate() method
-   **Isolation**: Each service manages its own state
-   **Durability**: In production, saga state would be persisted

## Production Considerations

For production deployment, consider:

1. **Saga State Persistence**: Store saga state in database
2. **Retry Logic**: Implement retry with exponential backoff
3. **Timeout Handling**: Add timeouts for each step
4. **Dead Letter Queue**: Handle failed compensations
5. **Idempotency Keys**: Prevent duplicate operations
6. **Monitoring**: Add metrics and alerts
7. **Circuit Breaker**: Prevent cascading failures
8. **Event Sourcing**: Store all saga events for audit trail

## Related Patterns

-   **CQRS**: Command Query Responsibility Segregation (already implemented)
-   **Event Sourcing**: Could be added for full audit trail
-   **Choreography-based Saga**: Alternative to orchestration
-   **Two-Phase Commit**: Traditional approach (not recommended for microservices)

## References

-   [Saga Pattern by Chris Richardson](https://microservices.io/patterns/data/saga.html)
-   [NestJS CQRS](https://docs.nestjs.com/recipes/cqrs)
-   [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
