import { REDIS_CLIENT } from '@/modules/cache/cache.redis.module';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { TravelBookingSagaRedisState } from './travel-booking-saga-state.type';
import { cacheKeys } from './cache-keys.const';

@Injectable()
export class SagaCoordinator {
    private readonly logger = new Logger(SagaCoordinator.name);
    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

    /**
     * 1. DISTRIBUTED LOCK - Prevent duplicate saga execution
     * Use case: Prevent the same booking from being processed twice
     * if user clicks "Book" button multiple times
     */
    async acquireSagaLock(requestId: string, ttlSeconds: number = 300): Promise<boolean> {
        const lockKey = `${cacheKeys.DISTRIBUTED_LOCK}${requestId}`;
        try {
            // NX = only set if doesn't exist, EX = expiry in seconds
            const result = await this.redis.set(lockKey, new Date().toISOString(), 'EX', ttlSeconds, 'NX');
            const acquired = result === 'OK';

            if (acquired) {
                this.logger.log(`🔒 Lock acquired for booking: ${requestId}`);
            } else {
                this.logger.warn(`⚠️ Lock already held for booking: ${requestId}`);
            }

            return acquired;
        } catch (error) {
            this.logger.error(`❌ Failed to acquire lock for ${requestId}:`, error);
            return false;
        }
    }

    /** Release the lock after saga completion or failure */
    async releaseSagaLock(requestId: string): Promise<void> {
        const lockKey = cacheKeys.getDistributedLockKey(requestId);
        try {
            await this.redis.del(lockKey);
            this.logger.log(`🔓 Lock released for booking: ${requestId}`);
        } catch (error) {
            this.logger.error(`❌ Failed to release lock for ${requestId}:`, error);
        }
    }

    /** Get lock status (for debugging) */
    async isLocked(requestId: string): Promise<boolean> {
        const lockKey = cacheKeys.getDistributedLockKey(requestId);
        const exists = await this.redis.exists(lockKey);
        return exists === 1;
    }

    /**
     * 2. in-active STATE CACHE - Fast reads during saga execution
     * Use case: Cache the current saga state in Redis for fast access
     * while saga is executing. Reduces MongoDB read load.
     * Auto-cleanup with TTL (e.g., 1 hour)
     */
    async setActiveSagaState(
        requestId: string,
        state: TravelBookingSagaRedisState,
        ttlSeconds: number = 3600,
    ): Promise<void> {
        const key = cacheKeys.getActiveStateKey(requestId);
        try {
            await this.redis.setex(key, ttlSeconds, JSON.stringify(state));
            this.logger.debug(`💾 Cached in-active state for booking: ${requestId}`);
        } catch (error) {
            this.logger.error(`❌ Failed to cache state for ${requestId}:`, error);
        }
    }

    async getActiveSagaState(requestId: string): Promise<TravelBookingSagaRedisState | null> {
        const key = cacheKeys.getActiveStateKey(requestId);
        try {
            const cached = await this.redis.get(key);
            if (cached) {
                this.logger.debug(`✅ Cache hit for booking: ${requestId}`);
                return JSON.parse(cached);
            }
            this.logger.debug(`⚠️ Cache miss for booking: ${requestId}`);
            return null;
        } catch (error) {
            this.logger.error(`❌ Failed to get cached state for ${requestId}:`, error);
            return null;
        }
    }

    async clearActiveSagaState(requestId: string): Promise<void> {
        const key = cacheKeys.getActiveStateKey(requestId);
        try {
            await this.redis.del(key);
            this.logger.debug(`🗑️ Cleared in-active state for booking: ${requestId}`);
        } catch (error) {
            this.logger.error(`❌ Failed to clear state for ${requestId}:`, error);
        }
    }

    /**
     * 3. SAGA STEP COUNTER - Track progress in real-time
     * Use case: Monitor which steps have been completed
     * Useful for debugging stuck sagas
     */
    async incrementStepCounter(requestId: string, step: string): Promise<number> {
        const key = cacheKeys.getProgressStepsKey(requestId);
        try {
            const count = await this.redis.hincrby(key, step, 1);
            await this.redis.expire(key, 7200); // 2 hours TTL
            this.logger.debug(`📊 Step '${step}' incremented to ${count} for booking: ${requestId}`);
            return count;
        } catch (error) {
            this.logger.error(`❌ Failed to increment step counter for ${requestId}:`, error);
            return 0;
        }
    }

    async getSagaProgressStep(requestId: string): Promise<Record<string, string>> {
        const key = cacheKeys.getProgressStepsKey(requestId);
        try {
            const steps = await this.redis.hgetall(key);
            return steps;
        } catch (error) {
            this.logger.error(`❌ Failed to get saga progress for ${requestId}:`, error);
            return {};
        }
    }

    async clearSagaProgress(requestId: string): Promise<void> {
        const key = cacheKeys.getProgressStepsKey(requestId);
        try {
            await this.redis.del(key);
            this.logger.debug(`🗑️ Cleared saga progress for booking: ${requestId}`);
        } catch (error) {
            this.logger.error(`❌ Failed to clear saga progress for ${requestId}:`, error);
        }
    }

    /**
     * 4. PENDING SAGA QUEUE - Monitor stuck sagas
     * Use case: Detect sagas that have been pending for too long
     * and may need manual intervention or auto-retry
     */
    async addToPendingQueue(requestId: string, priority?: number): Promise<void> {
        const score = priority || Date.now();
        try {
            await this.redis.zadd(cacheKeys.PENDING_QUEUE, score, requestId);
            this.logger.debug(`📥 Added booking ${requestId} to pending queue`);
        } catch (error) {
            this.logger.error(`❌ Failed to add ${requestId} to pending queue:`, error);
        }
    }

    async removeFromPendingQueue(requestId: string): Promise<void> {
        try {
            await this.redis.zrem(cacheKeys.PENDING_QUEUE, requestId);
            this.logger.debug(`📤 Removed booking ${requestId} from pending queue`);
        } catch (error) {
            this.logger.error(`❌ Failed to remove ${requestId} from pending queue:`, error);
        }
    }

    async getStuckSagas(olderThanMs: number = 30 * 60 * 1000): Promise<string[]> {
        const cutoff = Date.now() - olderThanMs;
        try {
            const stuckSagas = await this.redis.zrangebyscore(cacheKeys.PENDING_QUEUE, '-inf', cutoff);
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
            return await this.redis.zcard(cacheKeys.PENDING_QUEUE);
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
        const key = cacheKeys.getRateLimitKey(userId);
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
        const key = cacheKeys.getRateLimitKey(userId);
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
     * Use case: Store temporary metadata about the saga
     * (e.g., retry count, last error, worker ID)
     */
    async setSagaMetadata(requestId: string, metadata: Record<string, any>, ttlSeconds: number = 3600): Promise<void> {
        const key = cacheKeys.getMetadataKey(requestId);
        try {
            await this.redis.hmset(key, metadata);
            await this.redis.expire(key, ttlSeconds);
            this.logger.debug(`📝 Set metadata for booking: ${requestId}`);
        } catch (error) {
            this.logger.error(`❌ Failed to set metadata for ${requestId}:`, error);
        }
    }

    async getSagaMetadata(requestId: string): Promise<Record<string, string>> {
        const key = cacheKeys.getMetadataKey(requestId);
        try {
            return await this.redis.hgetall(key);
        } catch (error) {
            this.logger.error(`❌ Failed to get metadata for ${requestId}:`, error);
            return {};
        }
    }

    /**
     * Cleanup and monitoring utilities
     */
    async cleanup(requestId: string): Promise<void> {
        this.logger.log(`🧹 Cleaning up Redis data for booking request: ${requestId}`);
        await Promise.all([
            this.releaseSagaLock(requestId),
            this.clearActiveSagaState(requestId),
            this.clearSagaProgress(requestId),
            this.removeFromPendingQueue(requestId),
            this.redis.del(cacheKeys.getMetadataKey(requestId)),
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
                this.redis.keys('saga:in-active:*'),
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
