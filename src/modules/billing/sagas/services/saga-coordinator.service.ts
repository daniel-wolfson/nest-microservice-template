import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * SagaCoordinator - Redis-based real-time coordination service
 *
 * Responsibilities:
 * 1. Distributed locks - prevent duplicate saga execution
 * 2. In-flight state cache - fast reads during saga execution
 * 3. Step progress tracking - monitor saga completion
 * 4. Pending saga queue - detect stuck sagas for recovery
 * 5. Rate limiting - prevent spam bookings
 *
 * Works in tandem with MongoDB (TravelBookingSagaStateRepository) for:
 * - Redis: Fast, volatile, coordination layer (TTL-based cleanup)
 * - MongoDB: Durable, persistent, audit trail (permanent storage)
 */
@Injectable()
export class SagaCoordinator {
    private readonly logger = new Logger(SagaCoordinator.name);
    private readonly redis: Redis;

    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
            retryStrategy: times => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });

        this.redis.on('connect', () => {
            this.logger.log('✅ Redis connected for saga coordination');
        });

        this.redis.on('error', error => {
            this.logger.error('❌ Redis connection error:', error);
        });
    }

    /**
     * 1. DISTRIBUTED LOCK - Prevent duplicate saga execution
     *
     * Use case: Prevent the same booking from being processed twice
     * if user clicks "Book" button multiple times
     */
    async acquireSagaLock(bookingId: string, ttlSeconds: number = 300): Promise<boolean> {
        const lockKey = `saga:lock:${bookingId}`;
        try {
            // NX = only set if doesn't exist, EX = expiry in seconds
            const result = await this.redis.set(lockKey, Date.now().toString(), 'EX', ttlSeconds, 'NX');
            const acquired = result === 'OK';

            if (acquired) {
                this.logger.log(`🔒 Lock acquired for booking: ${bookingId}`);
            } else {
                this.logger.warn(`⚠️ Lock already held for booking: ${bookingId}`);
            }

            return acquired;
        } catch (error) {
            this.logger.error(`❌ Failed to acquire lock for ${bookingId}:`, error);
            return false;
        }
    }

    async releaseSagaLock(bookingId: string): Promise<void> {
        const lockKey = `saga:lock:${bookingId}`;
        try {
            await this.redis.del(lockKey);
            this.logger.log(`🔓 Lock released for booking: ${bookingId}`);
        } catch (error) {
            this.logger.error(`❌ Failed to release lock for ${bookingId}:`, error);
        }
    }

    /**
     * Get lock status (for debugging)
     */
    async isLocked(bookingId: string): Promise<boolean> {
        const lockKey = `saga:lock:${bookingId}`;
        const exists = await this.redis.exists(lockKey);
        return exists === 1;
    }

    /**
     * 2. IN-FLIGHT STATE CACHE - Fast reads during saga execution
     *
     * Use case: Cache the current saga state in Redis for fast access
     * while saga is executing. Reduces MongoDB read load.
     * Auto-cleanup with TTL (e.g., 1 hour)
     */
    async cacheInFlightState(bookingId: string, state: any, ttlSeconds: number = 3600): Promise<void> {
        const key = `saga:inflight:${bookingId}`;
        try {
            await this.redis.setex(key, ttlSeconds, JSON.stringify(state));
            this.logger.debug(`💾 Cached in-flight state for booking: ${bookingId}`);
        } catch (error) {
            this.logger.error(`❌ Failed to cache state for ${bookingId}:`, error);
        }
    }

    async getInFlightState(bookingId: string): Promise<any | null> {
        const key = `saga:inflight:${bookingId}`;
        try {
            const cached = await this.redis.get(key);
            if (cached) {
                this.logger.debug(`✅ Cache hit for booking: ${bookingId}`);
                return JSON.parse(cached);
            }
            this.logger.debug(`⚠️ Cache miss for booking: ${bookingId}`);
            return null;
        } catch (error) {
            this.logger.error(`❌ Failed to get cached state for ${bookingId}:`, error);
            return null;
        }
    }

    async clearInFlightState(bookingId: string): Promise<void> {
        const key = `saga:inflight:${bookingId}`;
        try {
            await this.redis.del(key);
            this.logger.debug(`🗑️ Cleared in-flight state for booking: ${bookingId}`);
        } catch (error) {
            this.logger.error(`❌ Failed to clear state for ${bookingId}:`, error);
        }
    }

    /**
     * 3. SAGA STEP COUNTER - Track progress in real-time
     *
     * Use case: Monitor which steps have been completed
     * Useful for debugging stuck sagas
     */
    async incrementStepCounter(bookingId: string, step: string): Promise<number> {
        const key = `saga:steps:${bookingId}`;
        try {
            const count = await this.redis.hincrby(key, step, 1);
            await this.redis.expire(key, 7200); // 2 hours TTL
            this.logger.debug(`📊 Step '${step}' incremented to ${count} for booking: ${bookingId}`);
            return count;
        } catch (error) {
            this.logger.error(`❌ Failed to increment step counter for ${bookingId}:`, error);
            return 0;
        }
    }

    async getSagaProgress(bookingId: string): Promise<Record<string, string>> {
        const key = `saga:steps:${bookingId}`;
        try {
            const steps = await this.redis.hgetall(key);
            return steps;
        } catch (error) {
            this.logger.error(`❌ Failed to get saga progress for ${bookingId}:`, error);
            return {};
        }
    }

    async clearSagaProgress(bookingId: string): Promise<void> {
        const key = `saga:steps:${bookingId}`;
        try {
            await this.redis.del(key);
            this.logger.debug(`🗑️ Cleared saga progress for booking: ${bookingId}`);
        } catch (error) {
            this.logger.error(`❌ Failed to clear saga progress for ${bookingId}:`, error);
        }
    }

    /**
     * 4. PENDING SAGA QUEUE - Monitor stuck sagas
     *
     * Use case: Detect sagas that have been pending for too long
     * and may need manual intervention or auto-retry
     */
    async addToPendingQueue(bookingId: string, priority?: number): Promise<void> {
        const score = priority || Date.now();
        try {
            await this.redis.zadd('saga:pending', score, bookingId);
            this.logger.debug(`📥 Added booking ${bookingId} to pending queue`);
        } catch (error) {
            this.logger.error(`❌ Failed to add ${bookingId} to pending queue:`, error);
        }
    }

    async removeFromPendingQueue(bookingId: string): Promise<void> {
        try {
            await this.redis.zrem('saga:pending', bookingId);
            this.logger.debug(`📤 Removed booking ${bookingId} from pending queue`);
        } catch (error) {
            this.logger.error(`❌ Failed to remove ${bookingId} from pending queue:`, error);
        }
    }

    async getStuckSagas(olderThanMs: number = 30 * 60 * 1000): Promise<string[]> {
        const cutoff = Date.now() - olderThanMs;
        try {
            const stuckSagas = await this.redis.zrangebyscore('saga:pending', '-inf', cutoff);
            if (stuckSagas.length > 0) {
                this.logger.warn(`⚠️ Found ${stuckSagas.length} stuck sagas older than ${olderThanMs}ms`);
            }
            return stuckSagas;
        } catch (error) {
            this.logger.error('❌ Failed to get stuck sagas:', error);
            return [];
        }
    }

    async getPendingCount(): Promise<number> {
        try {
            return await this.redis.zcard('saga:pending');
        } catch (error) {
            this.logger.error('❌ Failed to get pending count:', error);
            return 0;
        }
    }

    /**
     * 5. RATE LIMITING - Prevent spam bookings
     *
     * Use case: Limit user to max N bookings per minute
     * to prevent abuse or accidental duplicate submissions
     */
    async checkRateLimit(userId: string, maxPerMinute: number = 5): Promise<boolean> {
        const key = `saga:ratelimit:${userId}`;
        try {
            const current = await this.redis.incr(key);

            if (current === 1) {
                await this.redis.expire(key, 60); // 1 minute window
            }

            const allowed = current <= maxPerMinute;

            if (!allowed) {
                this.logger.warn(`⚠️ Rate limit exceeded for user ${userId}: ${current}/${maxPerMinute} per minute`);
            }

            return allowed;
        } catch (error) {
            this.logger.error(`❌ Failed to check rate limit for ${userId}:`, error);
            // Fail open - allow the request if Redis is down
            return true;
        }
    }

    async getRateLimitCount(userId: string): Promise<number> {
        const key = `saga:ratelimit:${userId}`;
        try {
            const count = await this.redis.get(key);
            return count ? parseInt(count, 10) : 0;
        } catch (error) {
            this.logger.error(`❌ Failed to get rate limit count for ${userId}:`, error);
            return 0;
        }
    }

    /**
     * 6. SAGA METADATA - Store additional coordination data
     *
     * Use case: Store temporary metadata about the saga
     * (e.g., retry count, last error, worker ID)
     */
    async setSagaMetadata(bookingId: string, metadata: Record<string, any>, ttlSeconds: number = 3600): Promise<void> {
        const key = `saga:metadata:${bookingId}`;
        try {
            await this.redis.hmset(key, metadata);
            await this.redis.expire(key, ttlSeconds);
            this.logger.debug(`📝 Set metadata for booking: ${bookingId}`);
        } catch (error) {
            this.logger.error(`❌ Failed to set metadata for ${bookingId}:`, error);
        }
    }

    async getSagaMetadata(bookingId: string): Promise<Record<string, string>> {
        const key = `saga:metadata:${bookingId}`;
        try {
            return await this.redis.hgetall(key);
        } catch (error) {
            this.logger.error(`❌ Failed to get metadata for ${bookingId}:`, error);
            return {};
        }
    }

    /**
     * Cleanup and monitoring utilities
     */
    async cleanup(bookingId: string): Promise<void> {
        this.logger.log(`🧹 Cleaning up Redis data for booking: ${bookingId}`);
        await Promise.all([
            this.releaseSagaLock(bookingId),
            this.clearInFlightState(bookingId),
            this.clearSagaProgress(bookingId),
            this.removeFromPendingQueue(bookingId),
            this.redis.del(`saga:metadata:${bookingId}`),
        ]);
    }

    async getStats(): Promise<{
        pendingSagas: number;
        lockedSagas: number;
        cachedStates: number;
    }> {
        try {
            const [pendingSagas, lockKeys, cacheKeys] = await Promise.all([
                this.redis.zcard('saga:pending'),
                this.redis.keys('saga:lock:*'),
                this.redis.keys('saga:inflight:*'),
            ]);

            return {
                pendingSagas,
                lockedSagas: lockKeys.length,
                cachedStates: cacheKeys.length,
            };
        } catch (error) {
            this.logger.error('❌ Failed to get Redis stats:', error);
            return {
                pendingSagas: 0,
                lockedSagas: 0,
                cachedStates: 0,
            };
        }
    }

    async onModuleDestroy() {
        await this.redis.quit();
        this.logger.log('Redis connection closed');
    }
}
