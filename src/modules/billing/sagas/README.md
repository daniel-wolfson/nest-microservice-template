# Travel Booking Saga - Hybrid MongoDB + Redis Architecture

## Overview

This saga implementation uses a **hybrid approach** combining MongoDB and Redis for optimal performance, durability, and coordination:

-   **MongoDB**: Durable, persistent storage for audit trail, recovery, and analytics
-   **Redis**: Fast, in-memory coordination for locks, caching, and real-time monitoring

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              TravelBookingSaga.execute()                     │
│                                                              │
│  1. Acquire distributed lock (Redis)                        │
│  2. Check rate limit (Redis)                                │
│  3. Save persistent state (MongoDB)                         │
│  4. Cache in-flight state (Redis)                           │
│  5. Add to pending queue (Redis)                            │
│  6. Publish events to message broker                        │
│  7. Track step progress (Redis)                             │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
         ┌──────────────────┐  ┌──────────────────┐
         │  Redis (Fast)    │  │  MongoDB (Durable)│
         │                  │  │                   │
         │ • Locks          │  │ • Full State      │
         │ • Cache          │  │ • History         │
         │ • Queue          │  │ • Analytics       │
         │ • Rate Limit     │  │ • Audit Trail     │
         │ • Step Progress  │  │ • Recovery Data   │
         │                  │  │                   │
         │ TTL: 1-2 hours   │  │ TTL: Permanent    │
         └──────────────────┘  └──────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    ┌──────────────────┐
                    │  Event Handlers  │
                    │ (Confirmations)  │
                    │                  │
                    │ • hotel.confirmed│
                    │ • flight.confirmed│
                    │ • car.confirmed  │
                    └──────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │ aggregateResults()       │
                │                          │
                │ 1. Get cached state (Redis)│
                │ 2. Fallback to MongoDB   │
                │ 3. Update final state (MongoDB)│
                │ 4. Cleanup Redis data    │
                └──────────────────────────┘
```

## Redis Coordination Features

### 1. Distributed Locks

**Purpose**: Prevent duplicate saga execution if user clicks "Book" multiple times

```typescript
const lockAcquired = await this.sagaCoordinator.acquireSagaLock(bookingId, 300);
if (!lockAcquired) {
    throw new Error('Saga already in progress');
}
```

**Redis Key**: `saga:lock:{bookingId}`  
**TTL**: 300 seconds (5 minutes)

### 2. Rate Limiting

**Purpose**: Prevent spam bookings (max 5 per minute per user)

```typescript
const canProceed = await this.sagaCoordinator.checkRateLimit(userId, 5);
if (!canProceed) {
    throw new Error('Rate limit exceeded');
}
```

**Redis Key**: `saga:ratelimit:{userId}`  
**TTL**: 60 seconds

### 3. In-Flight State Cache

**Purpose**: Fast reads during saga execution (reduce MongoDB load)

```typescript
await this.sagaCoordinator.cacheInFlightState(
    bookingId,
    {
        bookingId,
        userId,
        status: 'PENDING',
        startTime: Date.now(),
    },
    3600,
);

const cached = await this.sagaCoordinator.getInFlightState(bookingId);
```

**Redis Key**: `saga:inflight:{bookingId}`  
**TTL**: 3600 seconds (1 hour)

### 4. Pending Saga Queue

**Purpose**: Monitor stuck sagas for recovery

```typescript
await this.sagaCoordinator.addToPendingQueue(bookingId);

// Later: find stuck sagas older than 30 minutes
const stuckSagas = await this.sagaCoordinator.getStuckSagas(30 * 60 * 1000);
```

**Redis Key**: `saga:pending` (Sorted Set with timestamp scores)  
**TTL**: None (manual cleanup)

### 5. Step Progress Tracking

**Purpose**: Monitor real-time saga completion progress

```typescript
await this.sagaCoordinator.incrementStepCounter(bookingId, 'hotel_requested');
await this.sagaCoordinator.incrementStepCounter(bookingId, 'flight_requested');
await this.sagaCoordinator.incrementStepCounter(bookingId, 'car_requested');

const progress = await this.sagaCoordinator.getSagaProgress(bookingId);
// { hotel_requested: "1", flight_requested: "1", car_requested: "1" }
```

**Redis Key**: `saga:steps:{bookingId}` (Hash)  
**TTL**: 7200 seconds (2 hours)

### 6. Saga Metadata

**Purpose**: Store retry count, error details, worker ID

```typescript
await this.sagaCoordinator.setSagaMetadata(
    bookingId,
    {
        error: errorMessage,
        failedAt: Date.now().toString(),
        retryCount: '1',
    },
    7200,
);
```

**Redis Key**: `saga:metadata:{bookingId}` (Hash)  
**TTL**: 7200 seconds (2 hours)

## MongoDB Persistence

### Collection: `travel_booking_saga_states`

**Document Schema**:

```typescript
{
    bookingId: string;              // Unique booking ID
    reservationId: string;          // Unique reservation ID
    userId: string;                 // User who created the booking
    status: SagaStatus;             // PENDING | CONFIRMED | FAILED | COMPENSATED
    flightReservationId?: string;   // Flight reservation ID
    hotelReservationId?: string;    // Hotel reservation ID
    carRentalReservationId?: string;// Car rental reservation ID
    originalRequest: any;           // Original booking request
    totalAmount: number;            // Total booking amount
    completedSteps: string[];       // Array of completed step names
    errorMessage?: string;          // Error if failed
    errorStack?: string;            // Stack trace if failed
    sagaTimestamp: number;          // Saga start timestamp
    createdAt: Date;                // Document creation timestamp
    updatedAt: Date;                // Document update timestamp
}
```

**Indexes**:

-   `bookingId`: Unique index
-   `reservationId`: Unique index
-   `userId + status`: Compound index for user queries
-   `status + createdAt`: Compound index for monitoring

## Saga Flow

### Execution Flow (execute method)

1. **Generate booking ID**: `crypto.randomUUID()`
2. **Redis: Acquire lock**: Prevent duplicate execution
3. **Redis: Check rate limit**: Max 5 bookings/minute per user
4. **MongoDB: Save state**: Persist initial saga state
5. **Redis: Cache state**: Fast in-flight state access
6. **Redis: Add to pending queue**: Monitor stuck sagas
7. **Publish events**: Emit to message broker
8. **Redis: Track steps**: Increment step counters
9. **Redis: Release lock**: Allow next saga to run

### Aggregation Flow (aggregateResults method)

1. **Redis: Get cached state**: Try fast read first (~1ms)
2. **MongoDB: Fallback**: If cache miss, read from MongoDB (~5-20ms)
3. **MongoDB: Update state**: Persist final reservation IDs
4. **Redis: Track completion**: Increment aggregation step
5. **Redis: Remove from pending**: Saga completed
6. **Redis: Cleanup**: Delete all temporary coordination data

## Configuration

### Environment Variables

```bash
# MongoDB (required)
MONGODB_URI=mongodb://localhost:27017/microservice-template-billing

# Redis (required)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password  # optional
REDIS_DB=0                    # optional, default 0
```

### Rate Limiting Defaults

-   **Max bookings per minute**: 5 per user
-   **Window**: 60 seconds (sliding)

### TTL Defaults

| Data Type        | TTL         | Purpose                |
| ---------------- | ----------- | ---------------------- |
| Distributed Lock | 300s (5min) | Prevent duplicate saga |
| In-flight Cache  | 3600s (1h)  | Fast state reads       |
| Step Progress    | 7200s (2h)  | Debug stuck sagas      |
| Saga Metadata    | 7200s (2h)  | Error tracking         |
| Rate Limit       | 60s         | Prevent spam           |

## Monitoring & Debugging

### Get Redis Stats

```typescript
const stats = await sagaCoordinator.getStats();
// {
//   pendingSagas: 5,
//   lockedSagas: 2,
//   cachedStates: 8
// }
```

### Find Stuck Sagas

```typescript
// Find sagas pending for more than 30 minutes
const stuckSagas = await sagaCoordinator.getStuckSagas(30 * 60 * 1000);
```

### Get User Rate Limit

```typescript
const count = await sagaCoordinator.getRateLimitCount(userId);
// Current booking count in this minute
```

### Get Saga Progress

```typescript
const progress = await sagaCoordinator.getSagaProgress(bookingId);
// { hotel_requested: "1", flight_requested: "1", car_requested: "1", aggregated: "1" }
```

## Error Recovery

### Scenario 1: Redis Down

-   **Impact**: Coordination features unavailable (locks, cache, rate limit)
-   **Behavior**: Saga continues using MongoDB only
-   **Rate Limit**: Fails open (allows requests)

### Scenario 2: MongoDB Down

-   **Impact**: Cannot persist saga state
-   **Behavior**: Saga execution fails
-   **Recovery**: Retry after MongoDB restoration

### Scenario 3: Stuck Saga

```typescript
// Background job to recover stuck sagas
const stuckSagas = await sagaCoordinator.getStuckSagas(30 * 60 * 1000);

for (const bookingId of stuckSagas) {
    const mongoState = await sagaRepository.findByBookingId(bookingId);

    if (mongoState.status === SagaStatus.PENDING) {
        // Retry or compensate based on business logic
        await compensateSaga(mongoState);
    }
}
```

## Performance Metrics

| Operation        | MongoDB | Redis  | Hybrid (Best Case) |
| ---------------- | ------- | ------ | ------------------ |
| Lock acquisition | ~5-20ms | ~0.5ms | ~0.5ms             |
| State read       | ~5-20ms | ~0.5ms | ~0.5ms (cache hit) |
| State write      | ~5-20ms | ~0.5ms | ~5-20ms (both)     |
| Rate limit check | N/A     | ~0.5ms | ~0.5ms             |

## Best Practices

1. **Always release locks**: Use try-finally to ensure lock release
2. **Cleanup on completion**: Remove Redis data after saga completes
3. **Fail open on Redis errors**: Allow requests if Redis is down (for rate limiting)
4. **Monitor stuck sagas**: Run periodic jobs to detect and recover stuck sagas
5. **Set appropriate TTLs**: Balance memory usage vs debugging needs
6. **Index MongoDB properly**: Ensure queries are performant
7. **Log extensively**: Use structured logging for debugging

## Testing

### Unit Tests

```typescript
describe('TravelBookingSaga', () => {
    it('should acquire lock before executing', async () => {
        const result = await saga.execute(bookingRequest);
        expect(sagaCoordinator.acquireSagaLock).toHaveBeenCalled();
    });

    it('should fail if lock already held', async () => {
        sagaCoordinator.acquireSagaLock.mockResolvedValue(false);
        const result = await saga.execute(bookingRequest);
        expect(result.status).toBe('failed');
    });

    it('should cleanup Redis on success', async () => {
        await saga.aggregateResults(bookingId, flight, hotel, car);
        expect(sagaCoordinator.cleanup).toHaveBeenCalledWith(bookingId);
    });
});
```

### Integration Tests

```typescript
describe('Redis Integration', () => {
    it('should enforce rate limiting', async () => {
        for (let i = 0; i < 6; i++) {
            await saga.execute({ ...bookingRequest, userId: 'test-user' });
        }
        // 6th request should be rate limited
        expect(lastResult.status).toBe('failed');
    });
});
```

## Migration Guide

### From MongoDB-only to Hybrid

1. **Install Redis**: `npm install ioredis`
2. **Add environment variables**: See Configuration section
3. **No schema changes**: MongoDB schema remains the same
4. **Backward compatible**: Old sagas continue to work

### Rollback Plan

If Redis causes issues, simply remove `SagaCoordinator` injection and the saga will fall back to MongoDB-only mode.

### Quick Start

# 1. Start Redis

cd docker/microservice-template/redis
./redis-dev.ps1 # Windows

# or

./redis-dev.sh # Linux/Mac

# 2. Access Redis Commander

# http://localhost:8081

# 3. Run your NestJS app

npm run start:dev

### Redis vs MongoDB Comparison

Feature MongoDB Redis Hybrid (Your Implementation)
Latency 5-20ms <1ms <1ms (read), 5-20ms (write)
Persistence ✅ Permanent ❌ In-memory ✅ MongoDB for audit
TTL ❌ Manual ✅ Automatic ✅ Redis auto-cleanup
Locks ⚠️ Complex ✅ Native ✅ Redis locks
Analytics ✅ Rich queries ❌ Limited ✅ MongoDB analytics

### Updated TravelBookingSaga.execute()

execute():

1. Redis: Acquire lock → Prevent duplicates
2. Redis: Check rate limit → Prevent spam
3. MongoDB: Save state → Durable persistence
4. Redis: Cache state → Fast reads
5. Redis: Add to queue → Monitor stuck sagas
6. Publish events → Message broker
7. Redis: Track steps → Real-time progress
8. Redis: Release lock → Allow next saga

aggregateResults():

1. Redis: Get cached state (fast ~1ms)
2. MongoDB: Fallback if cache miss (~5-20ms)
3. MongoDB: Update final state
4. Redis: Cleanup all coordination data

### Monitoring Commands

# View all saga locks

docker exec -it microservice-template-redis redis-cli KEYS "saga:lock:\*"

# View pending sagas

docker exec -it microservice-template-redis redis-cli ZRANGE saga:pending 0 -1 WITHSCORES

# View saga progress

docker exec -it microservice-template-redis redis-cli HGETALL saga:steps:abc-123

# Get Redis stats

docker exec -it microservice-template-redis redis-cli INFO

## License

Part of the microservice-template project.
