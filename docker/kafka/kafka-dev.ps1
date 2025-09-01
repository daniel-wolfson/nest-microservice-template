# Kafka Development Environment Management Script (PowerShell)
# This script provides convenient commands to manage your local Kafka development setup

param(
    [Parameter(Position=0)]
    [string]$Command = "",
    
    [Parameter(Position=1)]
    [string]$TopicName = "",
    
    [Parameter(Position=2)]
    [int]$Partitions = 3,
    
    [Parameter(Position=3)]
    [int]$ReplicationFactor = 1
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeFile = Join-Path $ScriptDir "docker-compose.yml"

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    White = "White"
}

function Write-Status {
    param([string]$Message)
    Write-Host "[KAFKA-DEV] $Message" -ForegroundColor $Colors.Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Colors.Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Colors.Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Colors.Red
}

# Function to check if Docker is running
function Test-Docker {
    try {
        docker info | Out-Null
        return $true
    }
    catch {
        Write-Error "Docker is not running. Please start Docker and try again."
        exit 1
    }
}

# Function to start Kafka
function Start-Kafka {
    Write-Status "Starting Kafka development environment..."
    Test-Docker
    
    docker-compose -f $ComposeFile up -d
    
    Write-Status "Waiting for Kafka to be ready..."
    Start-Sleep -Seconds 30
    
    # Check if Kafka is ready
    try {
        docker-compose -f $ComposeFile exec -T kafka kafka-broker-api-versions --bootstrap-server localhost:9092 | Out-Null
        Write-Success "Kafka is ready!"
        Write-Status "Kafka UI available at: http://localhost:8080"
        Write-Status "Kafka broker available at: localhost:9092"
    }
    catch {
        Write-Warning "Kafka may still be starting up. Please wait a few more seconds."
    }
}

# Function to stop Kafka
function Stop-Kafka {
    Write-Status "Stopping Kafka development environment..."
    docker-compose -f $ComposeFile down
    Write-Success "Kafka stopped successfully"
}

# Function to restart Kafka
function Restart-Kafka {
    Write-Status "Restarting Kafka development environment..."
    Stop-Kafka
    Start-Sleep -Seconds 5
    Start-Kafka
}

# Function to show Kafka logs
function Show-KafkaLogs {
    Write-Status "Showing Kafka logs (press Ctrl+C to exit)..."
    docker-compose -f $ComposeFile logs -f kafka
}

# Function to show all services logs
function Show-AllLogs {
    Write-Status "Showing all services logs (press Ctrl+C to exit)..."
    docker-compose -f $ComposeFile logs -f
}

# Function to clean up Kafka data
function Clear-KafkaData {
    Write-Warning "This will remove all Kafka data and topics!"
    $confirmation = Read-Host "Are you sure you want to continue? (y/N)"
    
    if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
        Write-Status "Stopping services and cleaning data..."
        docker-compose -f $ComposeFile down -v
        
        # Remove volumes (ignore errors if they don't exist)
        try { docker volume rm kafka_kafka-data } catch {}
        try { docker volume rm kafka_zookeeper-data } catch {}
        try { docker volume rm kafka_zookeeper-logs } catch {}
        
        Write-Success "Kafka data cleaned successfully"
    }
    else {
        Write-Status "Operation cancelled"
    }
}

# Function to show Kafka status
function Show-KafkaStatus {
    Write-Status "Kafka development environment status:"
    docker-compose -f $ComposeFile ps
    
    Write-Host ""
    Write-Status "Checking Kafka connectivity..."
    
    try {
        docker-compose -f $ComposeFile exec -T kafka kafka-broker-api-versions --bootstrap-server localhost:9092 | Out-Null
        Write-Success "✅ Kafka broker is accessible"
    }
    catch {
        Write-Error "❌ Kafka broker is not accessible"
    }
    
    try {
        Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 5 -UseBasicParsing
        Write-Success "✅ Kafka UI is accessible at http://localhost:8080"
    }
    catch {
        Write-Warning "⚠️ Kafka UI is not accessible"
    }
}

# Function to create a test topic
function New-TestTopic {
    param(
        [string]$Name = "test-topic",
        [int]$Parts = 3,
        [int]$Replication = 1
    )
    
    Write-Status "Creating test topic: $Name"
    docker-compose -f $ComposeFile exec -T kafka kafka-topics `
        --create `
        --bootstrap-server localhost:9092 `
        --topic $Name `
        --partitions $Parts `
        --replication-factor $Replication
    
    Write-Success "Topic '$Name' created successfully"
}

# Function to list topics
function Get-Topics {
    Write-Status "Listing Kafka topics:"
    docker-compose -f $ComposeFile exec -T kafka kafka-topics `
        --list `
        --bootstrap-server localhost:9092
}

# Function to delete a topic
function Remove-Topic {
    param([string]$Name)
    
    if ([string]::IsNullOrEmpty($Name)) {
        Write-Error "Please specify a topic name"
        Write-Host "Usage: .\kafka-dev.ps1 delete-topic <topic-name>"
        exit 1
    }
    
    Write-Status "Deleting topic: $Name"
    docker-compose -f $ComposeFile exec -T kafka kafka-topics `
        --delete `
        --bootstrap-server localhost:9092 `
        --topic $Name
    
    Write-Success "Topic '$Name' deleted successfully"
}

# Function to show topic details
function Get-TopicDetails {
    param([string]$Name)
    
    if ([string]::IsNullOrEmpty($Name)) {
        Write-Error "Please specify a topic name"
        Write-Host "Usage: .\kafka-dev.ps1 describe-topic <topic-name>"
        exit 1
    }
    
    Write-Status "Describing topic: $Name"
    docker-compose -f $ComposeFile exec -T kafka kafka-topics `
        --describe `
        --bootstrap-server localhost:9092 `
        --topic $Name
}

# Function to show help
function Show-Help {
    Write-Host "Kafka Development Environment Management (PowerShell)" -ForegroundColor $Colors.Blue
    Write-Host ""
    Write-Host "Usage: .\kafka-dev.ps1 <command> [options]"
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor $Colors.Yellow
    Write-Host "  start                Start Kafka development environment"
    Write-Host "  stop                 Stop Kafka development environment"
    Write-Host "  restart              Restart Kafka development environment"
    Write-Host "  status               Show status of all services"
    Write-Host "  logs                 Show Kafka logs (follow)"
    Write-Host "  logs-all             Show all services logs (follow)"
    Write-Host "  clean                Clean all Kafka data (destructive)"
    Write-Host "  create-topic [name] [partitions] [replication]"
    Write-Host "                       Create a test topic (defaults: test-topic, 3, 1)"
    Write-Host "  list-topics          List all topics"
    Write-Host "  delete-topic <name>  Delete a topic"
    Write-Host "  describe-topic <name> Show topic details"
    Write-Host "  help                 Show this help message"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor $Colors.Yellow
    Write-Host "  .\kafka-dev.ps1 start"
    Write-Host "  .\kafka-dev.ps1 create-topic my-topic 5 1"
    Write-Host "  .\kafka-dev.ps1 describe-topic my-topic"
    Write-Host "  .\kafka-dev.ps1 logs"
    Write-Host ""
    Write-Host "Access Points:" -ForegroundColor $Colors.Yellow
    Write-Host "  Kafka Broker: localhost:9092"
    Write-Host "  Kafka UI: http://localhost:8080"
    Write-Host "  Zookeeper: localhost:2181"
}

# Main script logic
switch ($Command.ToLower()) {
    "start" {
        Start-Kafka
    }
    "stop" {
        Stop-Kafka
    }
    "restart" {
        Restart-Kafka
    }
    "status" {
        Show-KafkaStatus
    }
    "logs" {
        Show-KafkaLogs
    }
    "logs-all" {
        Show-AllLogs
    }
    "clean" {
        Clear-KafkaData
    }
    "create-topic" {
        $name = if ($TopicName) { $TopicName } else { "test-topic" }
        New-TestTopic -Name $name -Parts $Partitions -Replication $ReplicationFactor
    }
    "list-topics" {
        Get-Topics
    }
    "delete-topic" {
        Remove-Topic -Name $TopicName
    }
    "describe-topic" {
        Get-TopicDetails -Name $TopicName
    }
    "help" {
        Show-Help
    }
    "" {
        Write-Error "No command specified"
        Show-Help
        exit 1
    }
    default {
        Write-Error "Unknown command: $Command"
        Show-Help
        exit 1
    }
}
