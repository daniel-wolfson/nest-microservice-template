import { Module, Global, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global() // Makes Redis available everywhere without importing module
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: REDIS_CLIENT,
            useFactory: (configService: ConfigService) => {
                const redisConfig: RedisOptions = {
                    host: configService.get<string>('REDIS_HOST', 'localhost'),
                    port: configService.get<number>('REDIS_PORT', 6379),
                    password: configService.get<string>('REDIS_PASSWORD'),
                    db: configService.get<number>('REDIS_DB', 0),
                    keepAlive: 30000, // ← Keep the connection active
                    connectTimeout: 10000,
                    commandTimeout: 5000,
                    reconnectOnError: err => {
                        const targetError = 'READONLY';
                        if (err.message.includes(targetError)) {
                            return true; // reconnect
                        }
                        return false;
                    },
                    retryStrategy: (times: number) => {
                        if (times > 3) {
                            console.error('Redis connection failed after 3 retries');
                            return null;
                        }
                        return Math.min(times * 100, 2000);
                    },
                    maxRetriesPerRequest: 3,
                    enableReadyCheck: true,
                    lazyConnect: true,
                };
                const redis = new Redis(redisConfig);

                redis.on('connect', () => console.log('✅ Redis connected'));
                // Suppress expected shutdown/network-reset errors so they don't propagate
                redis.on('error', err => {
                    const code = (err as NodeJS.ErrnoException).code;
                    if (code === 'ECONNRESET' || code === 'ENOTCONN' || code === 'ERR_STREAM_DESTROYED') return;
                    if (redis.status === 'end' || redis.status === 'close') return;
                    console.error('❌ Redis error:', err);
                });
                redis.on('close', () => console.log('🔌 Redis connection closed'));

                return redis;
            },
            inject: [ConfigService],
        },
    ],
    exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

    onModuleDestroy() {
        // Use disconnect() (client-side immediate teardown) instead of quit() to avoid
        // the QUIT protocol round-trip that causes ECONNRESET / "Connection is closed" errors
        // in tests where two NestJS modules share the same Redis server.
        this.redis.disconnect();
        console.log('🧹 Redis disconnected');
    }
}
