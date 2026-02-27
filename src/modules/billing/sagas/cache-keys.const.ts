/**
 * SagaCoordinator - Redis-based real-time coordination service
 *
 * Responsibilities:
 * 1. Distributed locks - prevent duplicate saga execution
 * 2. in-active state cache - fast reads during saga execution
 * 3. Step progress tracking - monitor saga completion
 * 4. Pending saga queue - detect stuck sagas for recovery
 * 5. Rate limiting - prevent spam bookings
 *
 * Works in tandem with MongoDB (TravelBookingSagaStateRepository) for:
 * - Redis: Fast, volatile, coordination layer (TTL-based cleanup)
 * - MongoDB: Durable, persistent, audit trail (permanent storage)
 */

export const cacheKeys = {
    DISTRIBUTED_LOCK: 'saga:lock:' as const,
    ACTIVE_STATE: 'saga:in-active:' as const,
    PROGRESS_STEPS: 'saga:steps:' as const,
    PENDING_QUEUE: 'saga:pending' as const,
    RATE_LIMIT: 'saga:ratelimit:' as const,
    METADATA: 'saga:metadata:' as const,
    ALL_DISTRIBUTED_LOCK: 'saga:lock:*' as const,
    ALL_ACTIVE_STATE: 'saga:in-active:*' as const,
    ALL_SAGAs: 'saga:*' as const,

    getDistributedLockKey: (requestId: string): `saga:lock:${string}` => `${cacheKeys.DISTRIBUTED_LOCK}${requestId}`,

    getActiveStateKey: (requestId: string): `saga:in-active:${string}` => `${cacheKeys.ACTIVE_STATE}${requestId}`,

    getProgressStepsKey: (requestId: string): `saga:steps:${string}` => `${cacheKeys.PROGRESS_STEPS}${requestId}`,

    getPendingQueueKey: (): 'saga:pending' => cacheKeys.PENDING_QUEUE,

    getRateLimitKey: (userId: string): `saga:ratelimit:${string}` => `${cacheKeys.RATE_LIMIT}${userId}`,

    getMetadataKey: (requestId: string): `saga:metadata:${string}` => `${cacheKeys.METADATA}${requestId}`,
} as const;
