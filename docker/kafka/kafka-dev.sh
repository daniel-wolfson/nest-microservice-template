#!/bin/bash

# Kafka Development Environment Management Script
# This script provides convenient commands to manage your local Kafka development setup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[KAFKA-DEV]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to start Kafka
start_kafka() {
    print_status "Starting Kafka development environment..."
    check_docker
    
    docker-compose -f "$COMPOSE_FILE" up -d
    
    print_status "Waiting for Kafka to be ready..."
    TIMEOUT=60
    INTERVAL=5
    ELAPSED=0
    while [ $ELAPSED -lt $TIMEOUT ]; do
        # Check if kafka container is running
        if docker-compose -f "$COMPOSE_FILE" ps | grep -q 'kafka.*Up'; then
            if docker-compose -f "$COMPOSE_FILE" exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; then
                print_success "Kafka is ready!"
                print_status "Kafka UI available at: http://localhost:8080"
                print_status "Kafka broker available at: localhost:9092"
                break
            fi
        else
            print_warning "Kafka container is not running yet."
        fi
        sleep $INTERVAL
        ELAPSED=$((ELAPSED + INTERVAL))
    done
    if [ $ELAPSED -ge $TIMEOUT ]; then
        print_warning "Kafka did not become ready within $TIMEOUT seconds. Please check the logs."
    fi
}

# Function to stop Kafka
stop_kafka() {
    print_status "Stopping Kafka development environment..."
    docker-compose -f "$COMPOSE_FILE" down
    print_success "Kafka stopped successfully"
}

# Function to restart Kafka
restart_kafka() {
    print_status "Restarting Kafka development environment..."
    stop_kafka

    print_status "Waiting for all containers to stop..."
    TIMEOUT=30
    INTERVAL=2
    ELAPSED=0
    while [ $ELAPSED -lt $TIMEOUT ]; do
        if [ "$(docker-compose -f "$COMPOSE_FILE" ps -q | xargs docker inspect -f '{{.State.Running}}' 2>/dev/null | grep -c true)" -eq 0 ]; then
            print_success "All containers have stopped."
            break
        fi
        sleep $INTERVAL
        ELAPSED=$((ELAPSED + INTERVAL))
    done
    if [ $ELAPSED -ge $TIMEOUT ]; then
        print_warning "Some containers may not have stopped after $TIMEOUT seconds."
    fi

        docker-compose -f "$COMPOSE_FILE" down -v --remove-orphans
        print_success "Kafka data cleaned successfully"
# Function to show Kafka logs
logs_kafka() {
    print_status "Showing Kafka logs (press Ctrl+C to exit)..."
    docker-compose -f "$COMPOSE_FILE" logs -f kafka
}

# Function to show all services logs
logs_all() {
    print_status "Showing all services logs (press Ctrl+C to exit)..."
    docker-compose -f "$COMPOSE_FILE" logs -f
}

# Function to clean up Kafka data
clean_kafka() {
    print_warning "This will remove all Kafka data and topics!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Stopping services and cleaning data..."
        docker-compose -f "$COMPOSE_FILE" down -v
        docker volume rm kafka_kafka-data kafka_zookeeper-data kafka_zookeeper-logs 2>/dev/null || true
        print_success "Kafka data cleaned successfully"
    else
        print_status "Operation cancelled"
    fi
}

# Function to show Kafka status
status_kafka() {
    print_status "Kafka development environment status:"
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo
    print_status "Checking Kafka connectivity..."
    if docker-compose -f "$COMPOSE_FILE" exec -T kafka kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; then
        print_success "✅ Kafka broker is accessible"
    else
        print_error "❌ Kafka broker is not accessible"
    fi
    
    if curl -s http://localhost:8080 > /dev/null 2>&1; then
        print_success "✅ Kafka UI is accessible at http://localhost:8080"
    else
        print_warning "⚠️  Kafka UI is not accessible"
    fi
}

# Function to create a test topic
create_test_topic() {
    local topic_name=${1:-"test-topic"}
    local partitions=${2:-3}
    local replication=${3:-1}
    
    print_status "Creating test topic: $topic_name"
    docker-compose -f "$COMPOSE_FILE" exec kafka kafka-topics \
        --create \
        --bootstrap-server localhost:9092 \
        --topic "$topic_name" \
        --partitions "$partitions" \
        --replication-factor "$replication"
    
    print_success "Topic '$topic_name' created successfully"
}

# Function to list topics
list_topics() {
    print_status "Listing Kafka topics:"
    docker-compose -f "$COMPOSE_FILE" exec kafka kafka-topics \
        --list \
        --bootstrap-server localhost:9092
}

# Function to delete a topic
delete_topic() {
    local topic_name=${1}
    if [ -z "$topic_name" ]; then
        print_error "Please specify a topic name"
        echo "Usage: $0 delete-topic <topic-name>"
        exit 1
    fi
    
    print_status "Deleting topic: $topic_name"
    docker-compose -f "$COMPOSE_FILE" exec kafka kafka-topics \
        --delete \
        --bootstrap-server localhost:9092 \
        --topic "$topic_name"
    
    print_success "Topic '$topic_name' deleted successfully"
}

# Function to show topic details
describe_topic() {
    local topic_name=${1}
    if [ -z "$topic_name" ]; then
        print_error "Please specify a topic name"
        echo "Usage: $0 describe-topic <topic-name>"
        exit 1
    fi
    
    print_status "Describing topic: $topic_name"
    docker-compose -f "$COMPOSE_FILE" exec kafka kafka-topics \
        --describe \
        --bootstrap-server localhost:9092 \
        --topic "$topic_name"
}

# Function to show help
show_help() {
    echo "Kafka Development Environment Management"
    echo
    echo "Usage: $0 <command> [options]"
    echo
    echo "Commands:"
    echo "  start                Start Kafka development environment"
    echo "  stop                 Stop Kafka development environment"
    echo "  restart              Restart Kafka development environment"
    echo "  status               Show status of all services"
    echo "  logs                 Show Kafka logs (follow)"
    echo "  logs-all             Show all services logs (follow)"
    echo "  clean                Clean all Kafka data (destructive)"
    echo "  create-topic [name] [partitions] [replication]"
    echo "                       Create a test topic (defaults: test-topic, 3, 1)"
    echo "  list-topics          List all topics"
    echo "  delete-topic <name>  Delete a topic"
    echo "  describe-topic <name> Show topic details"
    echo "  help                 Show this help message"
    echo
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 create-topic my-topic 5 1"
    echo "  $0 describe-topic my-topic"
    echo "  $0 logs"
    echo
    echo "Access Points:"
    echo "  Kafka Broker: localhost:9092"
    echo "  Kafka UI: http://localhost:8080"
    echo "  Zookeeper: localhost:2181"
}

# Main script logic
case "${1:-}" in
    start)
        start_kafka
        ;;
    stop)
        stop_kafka
        ;;
    restart)
        restart_kafka
        ;;
    status)
        status_kafka
        ;;
    logs)
        logs_kafka
        ;;
    logs-all)
        logs_all
        ;;
    clean)
        clean_kafka
        ;;
    create-topic)
        create_test_topic "$2" "$3" "$4"
        ;;
    list-topics)
        list_topics
        ;;
    delete-topic)
        delete_topic "$2"
        ;;
    describe-topic)
        describe_topic "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    "")
        print_error "No command specified"
        show_help
        exit 1
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
