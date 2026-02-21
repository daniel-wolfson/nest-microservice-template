#!/bin/bash

# Redis Development Environment Startup Script
# This script starts Redis and Redis Commander for local development

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.redis.yml"

echo "🚀 Starting Redis Development Environment..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start Redis services
echo "📦 Starting Redis and Redis Commander..."
docker-compose -f "$DOCKER_COMPOSE_FILE" up -d

# Wait for Redis to be healthy
echo ""
echo "⏳ Waiting for Redis to be ready..."
timeout 30 bash -c 'until docker exec microservice-template-redis redis-cli ping 2>/dev/null | grep -q PONG; do sleep 1; done' || {
    echo "❌ Error: Redis failed to start within 30 seconds"
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs redis
    exit 1
}

echo ""
echo "✅ Redis Development Environment is ready!"
echo ""
echo "📊 Access Points:"
echo "  - Redis:            localhost:6379"
echo "  - Redis Commander:  http://localhost:8081"
echo ""
echo "🔧 Useful Commands:"
echo "  - View logs:        docker-compose -f $DOCKER_COMPOSE_FILE logs -f"
echo "  - Redis CLI:        docker exec -it microservice-template-redis redis-cli"
echo "  - Stop services:    docker-compose -f $DOCKER_COMPOSE_FILE down"
echo "  - View stats:       docker exec -it microservice-template-redis redis-cli INFO"
echo ""
echo "📚 Saga Monitoring:"
echo "  - View locks:       docker exec -it microservice-template-redis redis-cli KEYS 'saga:lock:*'"
echo "  - View pending:     docker exec -it microservice-template-redis redis-cli ZRANGE saga:pending 0 -1 WITHSCORES"
echo "  - View cache:       docker exec -it microservice-template-redis redis-cli KEYS 'saga:in-active:*'"
echo ""
