# Saga Pattern Implementation - Quick Start

## What Was Implemented

A complete **Saga Pattern** implementation for distributed transaction management in a travel booking system.

## Architecture

```
TravelBookingController
    ↓
BookTravelCommand → BookTravelHandler
    ↓
TravelBookingSaga (Orchestrator)
    ↓
┌───────────────────────────┐
│ 1. FlightService          │ → Reserve Flight
│ 2. HotelService           │ → Reserve Hotel
│ 3. CarRentalService       │ → Reserve Car (30% failure rate)
│ 4. Payment Processing     │ → Process Payment
└───────────────────────────┘
    ↓
  SUCCESS → Return confirmed booking
    OR
  FAILURE → Execute compensations in reverse:
            - Cancel Car
            - Cancel Hotel
            - Cancel Flight
```

## Files Created

### Core Components

-   `sagas/travel-booking.saga.ts` - Main saga orchestrator
-   `services/flight.service.ts` - Flight reservation service
-   `services/hotel.service.ts` - Hotel reservation service
-   `services/car-rental.service.ts` - Car rental service (with 30% failure rate)

### CQRS Components

-   `commands/impl/book-travel.command.ts` - Command definition
-   `commands/handlers/book-travel.handler.ts` - Command handler
-   `events/impl/travel-booking-*.event.ts` - Domain events

### API & DTOs

-   `travel-booking.controller.ts` - REST endpoint
-   `dto/travel-booking.dto.ts` - Main booking DTOs
-   `dto/flight-reservation.dto.ts` - Flight DTOs
-   `dto/hotel-reservation.dto.ts` - Hotel DTOs
-   `dto/car-rental-reservation.dto.ts` - Car rental DTOs

### Documentation & Tests

-   `info/SAGA_PATTERN.md` - Complete documentation
-   `info/SAGA_EXAMPLES.http` - Example requests
-   `sagas/travel-booking.saga.spec.ts` - Unit tests

### Module Updates

-   Updated `billing.module.ts` to register all new services and saga

## Quick Test

### Start the application:

```bash
npm run start:dev
```

### Test the endpoint:

```bash
curl -X POST http://localhost:3000/travel-booking \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "flightOrigin": "JFK",
    "flightDestination": "LAX",
    "departureDate": "2026-03-15",
    "returnDate": "2026-03-22",
    "hotelId": "hilton-downtown-la",
    "checkInDate": "2026-03-15",
    "checkOutDate": "2026-03-22",
    "carPickupLocation": "LAX Airport",
    "carDropoffLocation": "LAX Airport",
    "carPickupDate": "2026-03-15",
    "carDropoffDate": "2026-03-22",
    "totalAmount": 2500.00
  }'
```

### Run multiple times to see compensation:

```bash
# PowerShell
1..10 | ForEach-Object {
    Write-Host "Request $_" -ForegroundColor Cyan
    $response = Invoke-RestMethod -Method Post `
        -Uri "http://localhost:3000/travel-booking" `
        -Body (@{
            userId = "user-$_"
            flightOrigin = "JFK"
            flightDestination = "LAX"
            departureDate = "2026-03-15"
            returnDate = "2026-03-22"
            hotelId = "hilton-downtown-la"
            checkInDate = "2026-03-15"
            checkOutDate = "2026-03-22"
            carPickupLocation = "LAX Airport"
            carDropoffLocation = "LAX Airport"
            carPickupDate = "2026-03-15"
            carDropoffDate = "2026-03-22"
            totalAmount = 2500.00
        } | ConvertTo-Json) `
        -ContentType "application/json"

    if ($response.status -eq "confirmed") {
        Write-Host "✓ Confirmed" -ForegroundColor Green
    } else {
        Write-Host "✗ Compensated: $($response.errorMessage)" -ForegroundColor Yellow
    }
}
```

## Key Features

✅ **Orchestration-based Saga** - Central coordinator manages workflow
✅ **Automatic Compensation** - Rollback on failure in reverse order
✅ **CQRS Pattern** - Commands, handlers, and events
✅ **Type-safe DTOs** - Validation with class-validator
✅ **Comprehensive Logging** - Track each step and compensation
✅ **Simulated Failures** - 30% failure rate in car rental for testing
✅ **Unit Tests** - Full test coverage
✅ **REST API** - Easy to test with curl/Postman
✅ **Documentation** - Complete guides and examples

## Saga Pattern Benefits

1. **Eventual Consistency** - No distributed locks needed
2. **Fault Tolerance** - Graceful failure handling
3. **Auditability** - Clear log trail of all operations
4. **Scalability** - Services remain independent
5. **Maintainability** - Clear separation of concerns

## What to Observe

### Successful Booking Logs:

```
[TravelBookingSaga] ✓ Step 1 Complete: Flight Reserved
[TravelBookingSaga] ✓ Step 2 Complete: Hotel Reserved
[TravelBookingSaga] ✓ Step 3 Complete: Car Reserved
[TravelBookingSaga] ✓ Step 4 Complete: Payment Processed
[TravelBookingSaga] ✅ Travel Booking Saga Completed Successfully
```

### Compensated Booking Logs:

```
[TravelBookingSaga] ❌ Travel Booking Saga Failed
[TravelBookingSaga] 🔄 Starting Compensation Process...
[CarRentalService] Compensating: Canceling car rental
[HotelService] Compensating: Canceling hotel reservation
[FlightService] Compensating: Canceling flight reservation
[TravelBookingSaga] ✅ Compensation Process Completed
```

## Next Steps

1. Run the application and test the endpoint
2. Monitor logs to see saga execution and compensation
3. Review the comprehensive documentation in `info/SAGA_PATTERN.md`
4. Try the example requests in `info/SAGA_EXAMPLES.http`
5. Run unit tests: `npm test travel-booking.saga`

## Production Considerations

For production use, consider adding:

-   Saga state persistence to database
-   Retry logic with exponential backoff
-   Timeout handling for each step
-   Dead letter queue for failed compensations
-   Idempotency keys to prevent duplicates
-   Metrics and monitoring
-   Circuit breaker pattern

---

**Documentation**: See `info/SAGA_PATTERN.md` for detailed explanation
**Examples**: See `info/SAGA_EXAMPLES.http` for test requests
**Tests**: See `sagas/travel-booking.saga.spec.ts` for unit tests
