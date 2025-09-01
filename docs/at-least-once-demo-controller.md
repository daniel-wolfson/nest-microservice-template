# AtLeastOnceProducerStrategy Demo Controller

This controller demonstrates the usage of the `AtLeastOnceProducerStrategy` class, showcasing how to implement reliable message delivery with at-least-once semantics in Kafka.

## Features

### 🔄 **At-Least-Once Delivery Guarantees**

-   **No Message Loss**: Messages are retried until acknowledged
-   **Possible Duplicates**: Network issues may cause duplicate deliveries
-   **Leader Acknowledgment**: Waits for Kafka leader to confirm receipt
-   **Automatic Retries**: Built-in retry mechanism for failed sends

## API Endpoints

### 1. Send Single Message

```http
POST /kafka/delivery-strategies/at-least-once/send
Content-Type: application/json

{
  "topic": "user-events",
  "key": "user-123",
  "value": {
    "userId": "123",
    "action": "login",
    "timestamp": "2025-09-04T10:00:00Z"
  },
  "headers": {
    "source": "user-service",
    "version": "1.0"
  }
}
```

**Response:**

```json
{
    "success": true,
    "strategy": "at-least-once",
    "result": [
        {
            "topicName": "user-events",
            "partition": 0,
            "errorCode": 0,
            "offset": "12345"
        }
    ],
    "guarantees": {
        "duplicates": "possible",
        "messageLoss": "prevented",
        "acknowledgment": "leader-ack",
        "retries": "enabled"
    }
}
```

### 2. Send Batch Messages

```http
POST /kafka/delivery-strategies/at-least-once/send-batch
Content-Type: application/json

{
  "messages": [
    {
      "topic": "user-events",
      "key": "user-123",
      "value": { "userId": "123", "action": "login" }
    },
    {
      "topic": "order-events",
      "key": "order-456",
      "value": { "orderId": "456", "status": "created" }
    }
  ]
}
```

### 3. Stress Test

```http
POST /kafka/delivery-strategies/at-least-once/stress-test
Content-Type: application/json

{
  "topic": "stress-test-topic",
  "messageCount": 100,
  "messageSize": "medium"
}
```

**Response:**

```json
{
    "success": true,
    "strategy": "at-least-once",
    "statistics": {
        "messageCount": 100,
        "duration": "2500ms",
        "throughput": "40 msg/sec",
        "successfulSends": 100,
        "averageLatency": "25ms per message"
    },
    "guarantees": {
        "duplicates": "possible (due to retries)",
        "messageLoss": "prevented",
        "acknowledgment": "leader-ack",
        "reliability": "high"
    }
}
```

## Configuration

The controller uses the `AtLeastOnceProducerStrategy` with these settings:

```typescript
{
  acks: 1,                    // Wait for leader acknowledgment
  retries: 3,                 // Minimum 3 retry attempts
  idempotent: false,          // Allow duplicates for performance
  maxInFlightRequests: 5      // Allow multiple concurrent requests
}
```

## Use Cases

### ✅ **Perfect For:**

-   **User activity tracking** - Login, logout, page views
-   **Order processing** - Order creation, status updates
-   **Audit logging** - Security events, compliance logs
-   **Notification systems** - Email, SMS, push notifications
-   **Analytics events** - Click tracking, conversion events

### ❌ **Not Ideal For:**

-   **Financial transactions** - Use exactly-once instead
-   **Critical system events** - Use exactly-once for stronger guarantees
-   **High-frequency metrics** - Consider at-most-once for performance

## Performance Characteristics

-   **Throughput**: Medium-High (better than exactly-once)
-   **Latency**: Medium (waits for acknowledgment)
-   **Reliability**: High (prevents message loss)
-   **Resource Usage**: Medium (retries consume resources)

## Error Handling

The controller includes comprehensive error handling:

-   **Connection failures** - Automatic reconnection
-   **Send failures** - Retry with backoff
-   **Timeout handling** - Configurable timeouts
-   **Logging** - Structured Winston logging for debugging

## Testing the Controller

### Using cURL:

```bash
# Send a simple message
curl -X POST http://localhost:3000/kafka/delivery-strategies/at-least-once/send \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "test-topic",
    "key": "test-key",
    "value": {"message": "Hello Kafka!"}
  }'

# Run stress test
curl -X POST http://localhost:3000/kafka/delivery-strategies/at-least-once/stress-test \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "stress-test",
    "messageCount": 50,
    "messageSize": "small"
  }'
```

### Using Swagger UI:

Navigate to `http://localhost:3000/api` to access the interactive API documentation and test the endpoints.

## Monitoring and Observability

The controller provides detailed logging for monitoring:

-   **Message sending events** with topic, key, and timing
-   **Error events** with full stack traces
-   **Performance metrics** including throughput and latency
-   **Strategy configuration** details for troubleshooting

## Integration Example

```typescript
// Inject the controller in your service
@Injectable()
export class UserService {
    constructor(private readonly deliveryDemoController: DeliveryStrategyDemoController) {}

    async trackUserLogin(userId: string) {
        await this.deliveryDemoController.sendAtLeastOnce({
            topic: 'user-events',
            key: userId,
            value: {
                userId,
                action: 'login',
                timestamp: new Date().toISOString(),
            },
        });
    }
}
```
