# Cross-Platform Logging Strategy

## Overview

This NestJS microservice implements a sophisticated cross-platform logging strategy that automatically adapts to the operating system and environment. The logging system supports multiple transports and is optimized for both Windows (development) and Linux (production) environments.

## Supported Logging Strategies

### Environment Variables

Configure logging using these environment variables:

-   `LOG_STRATEGY`: Determines which transports to use
-   `LOG_LEVEL`: Sets the minimum log level
-   `ELASTICSEARCH_NODE`: Elasticsearch server URL (optional)

### Strategy Options

| Strategy                 | Description                | Platforms     | Use Case              |
| ------------------------ | -------------------------- | ------------- | --------------------- |
| `CONSOLE`                | Console output only        | Windows/Linux | Development           |
| `FILE`                   | File logging with rotation | Windows/Linux | Development/Staging   |
| `ELASTICSEARCH` or `ELS` | Elasticsearch logging      | Windows/Linux | Production monitoring |
| `ALL`                    | All transports enabled     | Windows/Linux | Production            |
| `SYSLOG`                 | Linux syslog integration   | Linux only    | Production            |

## Platform-Specific Behavior

### Windows (Development)

-   **Log Directory**: `./logs/`
-   **Console**: Colorized, human-readable format
-   **File Rotation**: 7 days retention
-   **Elasticsearch**: Optional, for testing

### Linux (Production)

-   **Log Directory**: `/var/log/microservice/`
-   **Console**: JSON format for container logs
-   **File Rotation**: 30 days retention (90 days for errors)
-   **Syslog**: Integrated with system logging
-   **Symlinks**: Created for current logs

## Transport Configuration

### 1. Console Transport

**Development (Windows):**

```
2024-08-19 10:30:15 [info]: Application starting
2024-08-19 10:30:15 [debug]: Database connected
```

**Production (Linux):**

```json
{
    "timestamp": "2024-08-19T10:30:15.123Z",
    "level": "info",
    "message": "Application starting",
    "service": "microservice-template",
    "environment": "production"
}
```

### 2. File Transport

**Features:**

-   Daily rotation with date pattern
-   Automatic compression (gzip)
-   Separate error log files
-   Configurable retention periods

**File Structure:**

```
logs/
├── application-2024-08-19.log
├── application-2024-08-18.log.gz
├── error-2024-08-19.log
├── error-2024-08-18.log.gz
├── current.log -> application-2024-08-19.log (Linux only)
└── current-error.log -> error-2024-08-19.log (Linux only)
```

### 3. Elasticsearch Transport

**Features:**

-   Structured logging with metadata
-   Daily index rotation
-   Environment-specific indices
-   Rich metadata (hostname, platform, PID)

**Index Pattern:**

```
microservice-logs-development-2024.08.19
microservice-logs-production-2024.08.19
microservice-logs-staging-2024.08.19
```

**Log Structure:**

```json
{
    "@timestamp": "2024-08-19T10:30:15.123Z",
    "level": "info",
    "message": "User authentication successful",
    "environment": "production",
    "platform": "linux",
    "hostname": "app-server-01",
    "service": "microservice-template",
    "userId": "12345",
    "requestId": "req-abc-123"
}
```

### 4. Syslog Transport (Linux Only)

**Features:**

-   Integration with system logs
-   Standard syslog format
-   Facility: `local0`
-   Protocol: Unix socket (`/dev/log`)

## Environment Configuration

### Development (.env.development)

```bash
NODE_ENV=development
LOG_STRATEGY=CONSOLE
LOG_LEVEL=debug
ELASTICSEARCH_NODE=http://localhost:9200
```

### Staging (.env.staging)

```bash
NODE_ENV=staging
LOG_STRATEGY=FILE
LOG_LEVEL=debug
ELASTICSEARCH_NODE=http://staging-elasticsearch:9200
```

### Production (.env.production)

```bash
NODE_ENV=production
LOG_STRATEGY=ALL
LOG_LEVEL=info
ELASTICSEARCH_NODE=http://elasticsearch-server:9200
```

## Usage Examples

### Basic Logging in Services

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  async login(credentials: LoginDto) {
    this.logger.log(\`login: Attempting login for user: \${credentials.email}\`);

    try {
      const user = await this.validateUser(credentials);
      this.logger.log(\`login: Successful login for user: \${credentials.email}\`);
      return user;
    } catch (error) {
      this.logger.error(\`login: Failed login for user: \${credentials.email}\`, error.stack);
      throw error;
    }
  }
}
```

### Structured Logging with Metadata

```typescript
this.logger.log('User action completed', {
    userId: user.id,
    action: 'profile_update',
    duration: Date.now() - startTime,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
});
```

### Error Logging with Context

```typescript
this.logger.error('Database connection failed', {
    error: error.message,
    stack: error.stack,
    database: 'postgres',
    host: 'localhost',
    port: 5432,
});
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install winston winston-daily-rotate-file winston-elasticsearch winston-syslog
```

### 2. Configure Environment

Create appropriate `.env.{environment}` files with logging configuration.

### 3. Start with Elasticsearch (Optional)

```bash
# Start Elasticsearch and Kibana for log visualization
docker-compose -f docker-compose.logging.yml up -d
```

### 4. Run Application

```bash
# Development
npm run start:dev

# Production
npm run start:prod
```

## Log Monitoring

### Kibana Dashboard (Elasticsearch)

1. Access Kibana: `http://localhost:5601`
2. Create index pattern: `microservice-logs-*`
3. Explore logs with filters and queries

### Linux System Logs

```bash
# View application logs in syslog
sudo tail -f /var/log/syslog | grep microservice-template

# View rotated log files
ls -la /var/log/microservice/
tail -f /var/log/microservice/current.log
```

### File Logs

```bash
# Windows
Get-Content -Path "logs\\application-$(Get-Date -Format 'yyyy-MM-dd').log" -Wait

# Linux
tail -f /var/log/microservice/current.log
```

## Performance Considerations

### Buffer Management

-   Elasticsearch transport uses connection pooling
-   File transport buffers writes for efficiency
-   Console transport is immediate for debugging

### Log Levels by Environment

-   **Development**: `debug` level for detailed troubleshooting
-   **Staging**: `debug` level for testing
-   **Production**: `info` level for performance

### Resource Usage

-   Log rotation prevents disk space issues
-   Compression reduces storage requirements
-   Retention policies automatically clean old logs

## Security Features

### Data Sanitization

-   Passwords and tokens are automatically redacted
-   PII is filtered from production logs
-   Error stacks are sanitized in production

### Access Control

-   Linux logs use appropriate file permissions
-   Syslog integration follows system security
-   Elasticsearch can be secured with authentication

## Troubleshooting

### Common Issues

**Elasticsearch Connection Failed:**

```bash
# Check Elasticsearch status
curl http://localhost:9200/_cluster/health

# Verify configuration
echo $ELASTICSEARCH_NODE
```

**File Permission Errors (Linux):**

```bash
# Create log directory with proper permissions
sudo mkdir -p /var/log/microservice
sudo chown $USER:$USER /var/log/microservice
sudo chmod 755 /var/log/microservice
```

**Syslog Not Working:**

```bash
# Check syslog service
sudo systemctl status rsyslog

# Test syslog connectivity
logger -p local0.info "Test message from microservice"
```

### Debug Mode

Enable verbose logging configuration:

```bash
LOG_LEVEL=debug
LOG_STRATEGY=ALL
```

This will show transport configuration details during startup.

## Best Practices

1. **Use Appropriate Log Levels**

    - `error`: System errors, exceptions
    - `warn`: Potential issues, deprecations
    - `info`: Important business events
    - `debug`: Detailed troubleshooting information

2. **Include Context**

    - Request IDs for tracing
    - User IDs for audit trails
    - Timing information for performance

3. **Sanitize Sensitive Data**

    - Never log passwords or tokens
    - Hash or redact PII in production
    - Use structured logging for better filtering

4. **Monitor Log Volume**

    - Adjust log levels based on environment
    - Use sampling for high-volume events
    - Set appropriate retention policies

5. **Test Logging Configuration**
    - Verify all transports in staging
    - Test log rotation and retention
    - Validate Elasticsearch integration

This logging strategy provides enterprise-grade observability while maintaining excellent developer experience across different platforms and environments.
