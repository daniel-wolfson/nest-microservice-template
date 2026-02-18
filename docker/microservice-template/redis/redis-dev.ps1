# Redis Development Environment Startup Script (PowerShell)
# This script starts Redis and Redis Commander for local development

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DockerComposeFile = Join-Path (Split-Path -Parent $ScriptDir) "docker-compose.redis.yml"

Write-Host "🚀 Starting Redis Development Environment..." -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Error: Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Start Redis services
Write-Host "📦 Starting Redis and Redis Commander..." -ForegroundColor Yellow
docker-compose -f $DockerComposeFile up -d

# Wait for Redis to be healthy
Write-Host ""
Write-Host "⏳ Waiting for Redis to be ready..." -ForegroundColor Yellow
$timeout = 30
$elapsed = 0
$ready = $false

while ($elapsed -lt $timeout -and -not $ready) {
    try {
        $result = docker exec microservice-template-redis redis-cli ping 2>$null
        if ($result -eq "PONG") {
            $ready = $true
        }
    } catch {
        # Ignore errors during startup
    }
    
    if (-not $ready) {
        Start-Sleep -Seconds 1
        $elapsed++
    }
}

if (-not $ready) {
    Write-Host "❌ Error: Redis failed to start within $timeout seconds" -ForegroundColor Red
    docker-compose -f $DockerComposeFile logs redis
    exit 1
}

Write-Host ""
Write-Host "✅ Redis Development Environment is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Access Points:" -ForegroundColor Cyan
Write-Host "  - Redis:            localhost:6379"
Write-Host "  - Redis Commander:  http://localhost:8081"
Write-Host ""
Write-Host "🔧 Useful Commands:" -ForegroundColor Cyan
Write-Host "  - View logs:        docker-compose -f $DockerComposeFile logs -f"
Write-Host "  - Redis CLI:        docker exec -it microservice-template-redis redis-cli"
Write-Host "  - Stop services:    docker-compose -f $DockerComposeFile down"
Write-Host "  - View stats:       docker exec -it microservice-template-redis redis-cli INFO"
Write-Host ""
Write-Host "📚 Saga Monitoring:" -ForegroundColor Cyan
Write-Host "  - View locks:       docker exec -it microservice-template-redis redis-cli KEYS 'saga:lock:*'"
Write-Host "  - View pending:     docker exec -it microservice-template-redis redis-cli ZRANGE saga:pending 0 -1 WITHSCORES"
Write-Host "  - View cache:       docker exec -it microservice-template-redis redis-cli KEYS 'saga:inflight:*'"
Write-Host ""
