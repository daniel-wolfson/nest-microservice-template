# MongoDB for Saga State Persistence

This Docker Compose file provides MongoDB infrastructure for the Travel Booking Saga state persistence.

## Services

### 1. MongoDB (Port 27017)

-   **Image**: `mongo:7`
-   **Purpose**: Durable storage for saga state and audit trail
-   **Credentials**: admin/123456 (development only - uses environment variables)
-   **Database**: `microservice-template-billing`
-   **Health Check**: Automatic ping every 10s

### 2. Mongo Express (Port 8082)

-   **Image**: `mongo-express`
-   **Purpose**: Web-based MongoDB GUI for monitoring and debugging
-   **Access**: http://localhost:8082
-   **Login**: admin/123456 (development only)

## Quick Start

```bash
# Start MongoDB
docker-compose -f docker-compose.mongodb.yml up -d

# View logs
docker-compose -f docker-compose.mongodb.yml logs -f mongodb

# Stop MongoDB
docker-compose -f docker-compose.mongodb.yml down

# Stop and remove data
docker-compose -f docker-compose.mongodb.yml down -v
```

## MongoDB Shell Access

```bash
# Connect to MongoDB container
docker exec -it microservice-template-mongodb mongosh

# Switch to billing database
use microservice-template-billing

# View all collections
show collections

# Find all saga states
db.travelbookingsagastates.find().pretty()

# Find pending sagas
db.travelbookingsagastates.find({ status: 'PENDING' }).pretty()

# Find failed sagas
db.travelbookingsagastates.find({ status: 'FAILED' }).pretty()

# Count sagas by status
db.travelbookingsagastates.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 } } }
])

# View saga with specific bookingId
db.travelbookingsagastates.findOne({ bookingId: 'your-booking-id' })

# View sagas for specific user
db.travelbookingsagastates.find({ userId: 'user-123' }).pretty()

# Exit shell
exit
```

## Mongo Express UI

Access the web interface at http://localhost:8082

**Login credentials**: admin/admin123

Features:

-   Browse all databases and collections
-   View and edit documents
-   Run MongoDB queries
-   Export/import data
-   View collection statistics

## Data Schema

### TravelBookingSagaState Collection

```typescript
{
  bookingId: string;          // Unique saga identifier
  reservationId: string;      // UUID for the reservation
  userId: string;             // User who initiated booking
  status: SagaStatus;         // PENDING | CONFIRMED | FAILED | COMPENSATED
  originalRequest: {          // Original booking request
    userId: string;
    flightOrigin: string;
    flightDestination: string;
    // ... other fields
  };
  completedSteps: string[];   // List of completed step names
  flightReservationId?: string;
  hotelReservationId?: string;
  carRentalReservationId?: string;
  errorMessage?: string;
  errorStack?: string;
  totalAmount: number;
  sagaTimestamp: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## Monitoring

### Database Statistics

```bash
# Connect to MongoDB
docker exec -it microservice-template-mongodb mongosh

# Database stats
use microservice-template-billing
db.stats()

# Collection stats
db.travelbookingsagastates.stats()

# Index information
db.travelbookingsagastates.getIndexes()
```

### Check MongoDB Health

```bash
# Check if MongoDB is running
docker ps | grep mongodb

# Check MongoDB logs
docker-compose -f docker-compose.mongodb.yml logs mongodb

# Test connection
docker exec -it microservice-template-mongodb mongosh --eval "db.adminCommand('ping')"
```

## Backup and Restore

### Backup

```bash
# Backup entire database
docker exec microservice-template-mongodb mongodump \
  --db microservice-template-billing \
  --out /data/backup

# Copy backup to host
docker cp microservice-template-mongodb:/data/backup ./mongodb-backup
```

### Restore

```bash
# Restore from backup
docker exec microservice-template-mongodb mongorestore \
  --db microservice-template-billing \
  /data/backup/microservice-template-billing
```

## Environment Variables

Update `.env.development` with:

```env
MONGODB_URI=mongodb://admin:admin123@localhost:27017/microservice-template-billing?authSource=admin
```

For production, use stronger credentials and enable authentication properly.

## Troubleshooting

### Connection Issues

```bash
# Check if port 27017 is available
netstat -ano | findstr :27017

# Restart MongoDB
docker-compose -f docker-compose.mongodb.yml restart mongodb
```

### Clear All Data

```bash
# Stop containers and remove volumes
docker-compose -f docker-compose.mongodb.yml down -v

# Start fresh
docker-compose -f docker-compose.mongodb.yml up -d
```

## Integration with NestJS

The MongoDB connection is configured in `saga.module.ts`:

```typescript
MongooseModule.forRootAsync({
    useFactory: () => ({
        uri: process.env.MONGODB_URI,
    }),
});
```

Repository pattern is used for data access via `TravelBookingSagaStateRepository`.
