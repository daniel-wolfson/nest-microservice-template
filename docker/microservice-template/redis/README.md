# Redis for Saga Coordination

This Docker Compose file provides Redis infrastructure for the Travel Booking Saga coordination layer.

## Services

### 1. Redis (Port 6379)

-   **Image**: `redis:7-alpine`
-   **Purpose**: In-memory data store for saga coordination
-   **Persistence**: AOF (Append Only File) enabled
-   **Health Check**: Automatic ping every 10s

### 2. Redis Commander (Port 8081)

-   **Image**: `rediscommander/redis-commander`
-   **Purpose**: Web-based Redis GUI for monitoring and debugging
-   **Access**: http://localhost:8081

## Quick Start

```bash
# Start Redis
docker-compose -f docker-compose.redis.yml up -d

# View logs
docker-compose -f docker-compose.redis.yml logs -f redis

# Stop Redis
docker-compose -f docker-compose.redis.yml down

# Stop and remove data
docker-compose -f docker-compose.redis.yml down -v
```

## Redis CLI Access

```bash
# Connect to Redis container
docker exec -it microservice-template-redis redis-cli

# Example commands
127.0.0.1:6379> PING
PONG

# View all saga locks
127.0.0.1:6379> KEYS saga:lock:*

# View pending sagas
127.0.0.1:6379> ZRANGE saga:pending 0 -1 WITHSCORES

# View saga steps
127.0.0.1:6379> HGETALL saga:steps:abc-123

# View in-flight state
127.0.0.1:6379> GET saga:inflight:abc-123

# View rate limit
127.0.0.1:6379> GET saga:ratelimit:user123
```

## Redis Commander UI

Access the web interface at http://localhost:8081

Features:

-   Browse all Redis keys
-   View key values and TTLs
-   Execute Redis commands
-   Monitor memory usage
-   Real-time updates

## Data Structure

### Keys Used by Saga Coordinator

| Key Pattern                 | Type             | TTL   | Purpose                |
| --------------------------- | ---------------- | ----- | ---------------------- |
| `saga:lock:{bookingId}`     | String           | 300s  | Distributed locks      |
| `saga:inflight:{bookingId}` | String (JSON)    | 3600s | Cached saga state      |
| `saga:steps:{bookingId}`    | Hash             | 7200s | Step progress tracking |
| `saga:metadata:{bookingId}` | Hash             | 7200s | Saga metadata          |
| `saga:ratelimit:{userId}`   | String (counter) | 60s   | Rate limiting          |
| `saga:pending`              | Sorted Set       | None  | Pending saga queue     |

## Monitoring

### Check Redis Stats

```bash
docker exec -it microservice-template-redis redis-cli INFO

# Memory usage
docker exec -it microservice-template-redis redis-cli INFO memory

# Connected clients
docker exec -it microservice-template-redis redis-cli INFO clients

# Key statistics
docker exec -it microservice-template-redis redis-cli INFO keyspace
```

### Monitor Commands in Real-time

```bash
docker exec -it microservice-template-redis redis-cli MONITOR
```

## Troubleshooting

### Redis not starting

```bash
# Check container status
docker ps -a | grep redis

# View logs
docker logs microservice-template-redis

# Restart container
docker restart microservice-template-redis
```

### Clear all saga data

```bash
# WARNING: This will delete ALL saga coordination data
docker exec -it microservice-template-redis redis-cli FLUSHDB

# Or delete specific patterns
docker exec -it microservice-template-redis redis-cli --scan --pattern "saga:*" | xargs redis-cli DEL
```

### Data persistence issues

```bash
# Check volume
docker volume inspect microservice-template_redis-data

# Backup data
docker exec microservice-template-redis redis-cli --rdb /data/backup.rdb

# Restore from backup
docker cp backup.rdb microservice-template-redis:/data/dump.rdb
docker restart microservice-template-redis
```

## Production Configuration

For production, consider:

1. **Enable authentication**:

    ```yaml
    command: redis-server --requirepass your-strong-password --appendonly yes
    ```

2. **Memory limits**:

    ```yaml
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    ```

3. **Bind to specific interface**:

    ```yaml
    command: redis-server --bind 0.0.0.0 --protected-mode yes
    ```

4. **Use Redis Sentinel for HA**:

    - Add Sentinel containers
    - Configure automatic failover

5. **Use Redis Cluster for horizontal scaling**:
    - Multiple Redis nodes
    - Automatic sharding

## Environment Variables

See `.env.development` for Redis configuration:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Links

-   Redis Documentation: https://redis.io/docs
-   Redis Commander: https://github.com/joeferner/redis-commander
-   Redis Best Practices: https://redis.io/docs/manual/patterns/
