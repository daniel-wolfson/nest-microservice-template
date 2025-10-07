# Kafka Development Environment

This directory contains a complete Kafka development setup using Docker Compose with the most popular Kafka distribution from Confluent.

## 🚀 Quick Start

### Prerequisites

-   Docker and Docker Compose installed
-   Ports 2181, 8080, and 9092 available on your machine

### Start Kafka (Choose your platform)

**Windows (PowerShell):**

```powershell
.\kafka-dev.ps1 start
```

**Linux/macOS (Bash):**

```bash
chmod +x kafka-dev.sh
./kafka-dev.sh start
```

**Manual Docker Compose:**

```bash
docker-compose up -d
```

### Access Points

-   **Kafka Broker**: `localhost:9092`
-   **Kafka UI**: [http://localhost:8080](http://localhost:8080) (Web-based management)
-   **Zookeeper**: `localhost:2181`

## 📋 What's Included

### Services

1. **Zookeeper** (`confluentinc/cp-zookeeper:7.4.4`)

    - Coordination service for Kafka
    - Port: 2181
    - Persistent data storage

2. **Kafka Broker** (`confluentinc/cp-kafka:7.4.4`)

    - Main Kafka message broker
    - Port: 9092 (external), 29092 (internal)
    - Optimized for development with auto-topic creation
    - Transaction support for exactly-once semantics
    - Memory-optimized JVM settings (1GB max heap)

3. **Kafka UI** (`provectuslabs/kafka-ui:latest`)
    - Web-based management interface
    - Port: 8080
    - Topic management, message browsing, consumer groups monitoring
    - Performance metrics and cluster overview

### Optional Services (Commented Out)

-   **Schema Registry**: For Avro schema management
-   **Kafka Connect**: For data integration pipelines

## 🛠️ Management Scripts

### PowerShell Script (Windows)

```powershell
# Basic operations
.\kafka-dev.ps1 start           # Start all services
.\kafka-dev.ps1 stop            # Stop all services
.\kafka-dev.ps1 restart         # Restart all services
.\kafka-dev.ps1 status          # Show service status
.\kafka-dev.ps1 clean           # Remove all data (destructive)

# Topic management
.\kafka-dev.ps1 create-topic my-topic 5 1    # Create topic with 5 partitions
.\kafka-dev.ps1 list-topics                  # List all topics
.\kafka-dev.ps1 describe-topic my-topic      # Show topic details
.\kafka-dev.ps1 delete-topic my-topic        # Delete a topic

# Monitoring
.\kafka-dev.ps1 logs            # Follow Kafka logs
.\kafka-dev.ps1 logs-all        # Follow all service logs
```

### Bash Script (Linux/macOS)

```bash
# Basic operations
./kafka-dev.sh start           # Start all services
./kafka-dev.sh stop            # Stop all services
./kafka-dev.sh restart         # Restart all services
./kafka-dev.sh status          # Show service status
./kafka-dev.sh clean           # Remove all data (destructive)

# Topic management
./kafka-dev.sh create-topic my-topic 5 1    # Create topic with 5 partitions
./kafka-dev.sh list-topics                  # List all topics
./kafka-dev.sh describe-topic my-topic      # Show topic details
./kafka-dev.sh delete-topic my-topic        # Delete a topic

# Monitoring
./kafka-dev.sh logs            # Follow Kafka logs
./kafka-dev.sh logs-all        # Follow all service logs
```

## ⚙️ Configuration

### Development Optimizations

The setup includes several optimizations for local development:

-   **Auto-topic creation**: Topics are created automatically when referenced
-   **Low replication factor**: Single replica for faster startup
-   **Memory optimization**: JVM heap limited to 1GB for resource efficiency
-   **Fast log retention**: 7 days retention with 1GB size limit
-   **Transaction support**: Enabled for exactly-once semantics testing

### Environment Variables

Key configurations in `docker-compose.yml`:

```yaml
# Topic defaults
KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'
KAFKA_NUM_PARTITIONS: 3
KAFKA_DEFAULT_REPLICATION_FACTOR: 1

# Memory optimization
KAFKA_HEAP_OPTS: '-Xmx1G -Xms512M'

# Transaction support
KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
```

### Custom Configuration

You can customize settings by:

1. **Editing `kafka-dev.properties`**: Modify Kafka broker settings
2. **Updating `docker-compose.yml`**: Change environment variables
3. **Volume mounting**: Mount your own configuration files

#### About `kafka-dev.properties`

The `kafka-dev.properties` file is used to override default Kafka broker settings for your development environment.  
**Location:** Place this file in the `docker/kafka/` directory (same as this README).  
**Usage:** The Docker Compose setup automatically mounts this file into the Kafka container if present.

**Sample `kafka-dev.properties`:**
## 🔌 Application Integration

### NestJS Configuration

Update your application configuration to use the local Kafka:

```typescript
// src/config/configuration.ts
export default () => ({
    kafka: {
        brokers: ['localhost:9092'],
        clientId: 'my-nestjs-app',
        // ... other settings
    },
});
```

### Connection Examples

```typescript
// KafkaJS connection
const kafka = new Kafka({
    clientId: 'my-app',
    brokers: ['localhost:9092'],
});

// Test connection
const admin = kafka.admin();
await admin.connect();
const topics = await admin.listTopics();
console.log('Available topics:', topics);
```

## 📊 Monitoring & Debugging

### Kafka UI Features

Access Kafka UI at [http://localhost:8080](http://localhost:8080) to:

-   **Browse Topics**: View messages, partitions, and configurations
-   **Monitor Consumers**: Track consumer group lag and assignments
-   **Manage Schemas**: If Schema Registry is enabled
-   **View Metrics**: Broker performance and health statistics
-   **Execute Queries**: Browse message content with filters

### Health Checks

The setup includes health checks to verify service readiness:

```bash
# Check Kafka broker health
docker-compose exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092

# Check if Kafka UI is accessible
curl -f http://localhost:8080 || echo "Kafka UI not ready"

# PowerShell (Windows)
curl -s http://localhost:8080 | Select-String -Pattern "title"

# Bash (Linux/macOS)
curl -s http://localhost:8080 | grep "title"
```

### Log Analysis

```bash
# View Kafka broker logs
docker-compose logs -f kafka

# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f zookeeper
docker-compose logs -f kafka-ui
```

## 🚨 Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 2181, 8080, and 9092 are available
2. **Memory issues**: Reduce `KAFKA_HEAP_OPTS` if running on low-memory systems
3. **Startup timeout**: Kafka can take 30-60 seconds to fully initialize
4. **Connection refused**: Wait for health checks to pass before connecting

### Recovery Commands

```bash
# Clean restart (removes all data)
docker-compose down -v
docker-compose up -d

# Check your actual volume names using:
docker volume ls

# Then remove the correct volumes, for example:
docker volume rm microservice-template_kafka-data microservice-template_zookeeper-data
docker-compose up -d --force-recreate

# Reset specific volumes
docker volume rm kafka_kafka-data kafka_zookeeper-data
```

### Performance Tuning

For better performance on your development machine:

1. **Increase memory**: Modify `KAFKA_HEAP_OPTS` to `-Xmx2G -Xms1G`
2. **Adjust partitions**: Increase `KAFKA_NUM_PARTITIONS` for higher throughput
3. **Tune retention**: Modify log retention settings in `kafka-dev.properties`

## 📚 Additional Resources

-   [Kafka Documentation](https://kafka.apache.org/documentation/)
-   [Confluent Platform Documentation](https://docs.confluent.io/)
-   [KafkaJS Client Library](https://kafka.js.org/)
-   [Kafka UI Documentation](https://docs.kafka-ui.provectus.io/)

## 🔧 Advanced Configuration

### Enable Schema Registry

Uncomment the `schema-registry` service in `docker-compose.yml` and restart:

```bash
# Edit docker-compose.yml to uncomment schema-registry section
docker-compose up -d schema-registry
```

### Enable Kafka Connect

Uncomment the `kafka-connect` service in `docker-compose.yml` for data pipeline integration:

```bash
# Edit docker-compose.yml to uncomment kafka-connect section
docker-compose up -d kafka-connect
```

### Production Considerations

This setup is optimized for development. For production:

-   Increase replication factors
-   Enable authentication and authorization
-   Use external volumes for data persistence
-   Implement monitoring and alerting
-   Configure proper network security
