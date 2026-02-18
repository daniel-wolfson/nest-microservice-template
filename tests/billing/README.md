### travel-booking.saga.e2e.spec Test terminal commands:

# Start services

docker-compose -f docker/microservice-template/docker-compose.mongodb.yml up -d
docker-compose -f docker/microservice-template/docker-compose.redis.yml up -d

# Run E2E tests

npm test -- travel-booking.saga.e2e.spec.ts
