#!/bin/bash

# MongoDB Development Environment Startup Script
# This script starts MongoDB and Mongo Express for local development

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.mongodb.yml"

echo "🚀 Starting MongoDB Development Environment..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start MongoDB services
echo "📦 Starting MongoDB and Mongo Express..."
docker-compose -f "$DOCKER_COMPOSE_FILE" up -d

# Wait for MongoDB to be healthy
echo ""
echo "⏳ Waiting for MongoDB to be ready..."
timeout 60 bash -c 'until docker exec microservice-template-mongodb mongosh --eval "db.adminCommand(\"ping\")" > /dev/null 2>&1; do sleep 2; done' || {
    echo "❌ Error: MongoDB failed to start within 60 seconds"
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs mongodb
    exit 1
}

echo ""
echo "✅ MongoDB Development Environment is ready!"
echo ""
echo "📊 Access Points:"
echo "  - MongoDB:         localhost:27017"
echo "  - Mongo Express:   http://localhost:8082 (admin/admin123)"
echo ""
echo "🔧 Useful Commands:"
echo "  - View logs:       docker-compose -f $DOCKER_COMPOSE_FILE logs -f"
echo "  - Mongo Shell:     docker exec -it microservice-template-mongodb mongosh"
echo "  - Stop services:   docker-compose -f $DOCKER_COMPOSE_FILE down"
echo "  - View stats:      docker exec -it microservice-template-mongodb mongosh --eval 'db.stats()'"
echo ""
echo "📚 Saga State Monitoring:"
echo "  - View all sagas:  docker exec -it microservice-template-mongodb mongosh --eval 'use microservice-template-billing; db.travelbookingsagastates.find().pretty()'"
echo "  - Count by status: docker exec -it microservice-template-mongodb mongosh --eval 'use microservice-template-billing; db.travelbookingsagastates.aggregate([{\$group: {_id: \"\$status\", count: {\$sum: 1}}}])'"
echo "  - Pending sagas:   docker exec -it microservice-template-mongodb mongosh --eval 'use microservice-template-billing; db.travelbookingsagastates.find({status: \"PENDING\"}).pretty()'"
echo ""
