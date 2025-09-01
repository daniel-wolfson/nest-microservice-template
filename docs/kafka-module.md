# Kafka Module Documentation

## Overview

This Kafka module provides a comprehensive, production-ready implementation for Apache Kafka integration in NestJS applications. It includes configurable producer and consumer services with structured logging, error handling, and environment-based configuration.

## Features

-   **Environment-based Configuration**: All Kafka settings are configurable via environment variables
-   **Structured Logging**: Integration with Winston for comprehensive logging
-   **Production-ready**: Includes SSL/SASL support, connection pooling, and retry logic
-   **Type Safety**: Full TypeScript support with proper interfaces
-   **Message Handling**: Flexible message handler pattern for consumers
-   **Error Handling**: Comprehensive error handling with retry mechanisms
-   **HTTP API**: RESTful endpoints for sending messages

## Environment Variables

Configure the following environment variables in your `.env` file:

```bash
# Kafka Broker Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=microservice-template

# Consumer Configuration
KAFKA_GROUP_ID=microservice-template-group
KAFKA_SESSION_TIMEOUT=30000
KAFKA_HEARTBEAT_INTERVAL=3000
KAFKA_MAX_BYTES_PER_PARTITION=1048576
KAFKA_MIN_BYTES=1
KAFKA_MAX_WAIT_TIME=5000

# Producer Configuration
KAFKA_MAX_IN_FLIGHT_REQUESTS=5
KAFKA_REQUEST_TIMEOUT=30000
KAFKA_RETRY_DELAYMS=300
KAFKA_RETRY_RETRIES=5

# Security Configuration (optional)
KAFKA_SSL_ENABLED=false
KAFKA_SASL_MECHANISM=plain
KAFKA_SASL_USERNAME=your-username
KAFKA_SASL_PASSWORD=your-password

# Advanced Configuration
KAFKA_CONNECTION_TIMEOUT=1000
KAFKA_REQUEST_TIMEOUT=30000
KAFKA_ENFORCE_REQUEST_TIMEOUT=false
KAFKA_DELIVERY_TIMEOUT=300000
```

## Basic Usage

### 1. Import the KafkaModule

```typescript
import { Module } from '@nestjs/common';
import { KafkaModule } from './modules/kafka';

@Module({
    imports: [
        KafkaModule,
        // other modules...
    ],
})
export class AppModule {}
```

### 2. Inject Services

```typescript
import { Injectable } from '@nestjs/common';
import { KafkaProducerService, KafkaConsumerService } from './modules/kafka';

@Injectable()
export class MyService {
    constructor(
        private readonly kafkaProducer: KafkaProducerService,
        private readonly kafkaConsumer: KafkaConsumerService,
    ) {}

    async sendMessage(topic: string, message: any) {
        return await this.kafkaProducer.send({
            topic,
            messages: [
                {
                    key: 'message-key',
                    value: JSON.stringify(message),
                    timestamp: Date.now().toString(),
                },
            ],
        });
    }
}
```

### 3. Creating Message Handlers

Implement the `MessageHandler` interface for processing incoming messages:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { MessageHandler } from './modules/kafka';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class UserEventHandler implements MessageHandler {
    constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

    async handle(payload: EachMessagePayload): Promise<void> {
        const { topic, partition, message } = payload;

        try {
            const messageValue = message.value?.toString();
            if (messageValue) {
                const userEvent = JSON.parse(messageValue);

                // Process the user event
                await this.processUserEvent(userEvent);

                this.logger.info('User event processed successfully', {
                    context: 'UserEventHandler',
                    userId: userEvent.userId,
                    eventType: userEvent.type,
                });
            }
        } catch (error) {
            this.logger.error('Failed to process user event', {
                context: 'UserEventHandler',
                topic,
                partition,
                offset: message.offset,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error; // This will trigger Kafka retry mechanism
        }
    }

    private async processUserEvent(event: any): Promise<void> {
        // Your business logic here
    }
}
```

### 4. Setting up Consumers

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from './modules/kafka';
import { UserEventHandler } from './user-event.handler';

@Injectable()
export class KafkaConsumerSetup implements OnModuleInit {
    constructor(
        private readonly kafkaConsumer: KafkaConsumerService,
        private readonly userEventHandler: UserEventHandler,
    ) {}

    async onModuleInit() {
        // Subscribe to topics with handlers
        await this.kafkaConsumer.subscribe(
            { topic: 'user-events' },
            false, // fromBeginning
            this.userEventHandler,
        );

        // Start consuming messages
        await this.kafkaConsumer.run();
    }
}
```

## HTTP API Usage

The module provides RESTful endpoints for sending messages:

### Send Single Message

```bash
POST /kafka/send
Content-Type: application/json

{
  "topic": "user-events",
  "key": "user-123",
  "value": {
    "userId": "123",
    "type": "user_created",
    "timestamp": "2023-12-01T10:00:00Z"
  },
  "headers": {
    "source": "user-service"
  }
}
```

### Send Batch Messages

```bash
POST /kafka/send-batch
Content-Type: application/json

{
  "messages": [
    {
      "topic": "user-events",
      "key": "user-123",
      "value": {
        "userId": "123",
        "type": "user_created"
      }
    },
    {
      "topic": "user-events",
      "key": "user-124",
      "value": {
        "userId": "124",
        "type": "user_updated"
      }
    }
  ]
}
```

## Advanced Configuration

### SSL Configuration

For production environments with SSL enabled:

```bash
KAFKA_SSL_ENABLED=true
# Add your SSL certificate configuration here
```

### SASL Authentication

For authentication using SASL:

```bash
KAFKA_SASL_MECHANISM=scram-sha-256
KAFKA_SASL_USERNAME=your-username
KAFKA_SASL_PASSWORD=your-password
```

### Performance Tuning

Adjust these settings based on your performance requirements:

```bash
# Producer performance
KAFKA_MAX_IN_FLIGHT_REQUESTS=10
KAFKA_BATCH_SIZE=16384
KAFKA_LINGER_MS=5

# Consumer performance
KAFKA_MAX_BYTES_PER_PARTITION=2097152
KAFKA_MIN_BYTES=1024
KAFKA_MAX_WAIT_TIME=1000
```

## Error Handling and Monitoring

The module includes comprehensive error handling and logging:

-   All operations are logged with structured metadata
-   Failed messages can be retried based on configuration
-   Dead letter queue pattern can be implemented in message handlers
-   Consumer and producer health can be monitored through logs

## Best Practices

1. **Message Serialization**: Always serialize complex objects to JSON
2. **Error Handling**: Implement proper error handling in message handlers
3. **Monitoring**: Monitor consumer lag and producer throughput
4. **Testing**: Use the HTTP API for testing message flows
5. **Security**: Use SSL and SASL in production environments
6. **Performance**: Tune batch sizes and timeouts based on your use case

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check if Kafka broker is running and accessible
2. **Authentication Failed**: Verify SASL credentials
3. **Timeout Errors**: Adjust timeout settings for your network conditions
4. **Memory Issues**: Monitor and adjust batch sizes and buffer settings

### Debugging

Enable debug logging by setting the appropriate log levels in your Winston configuration. The module logs all important events with structured metadata for easy debugging.
