# MongoDB Development Environment Startup Script (PowerShell)
# This script starts MongoDB and Mongo Express for local development

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DockerComposeFile = Join-Path (Split-Path -Parent $ScriptDir) "docker-compose.mongodb.yml"

Write-Host "🚀 Starting MongoDB Development Environment..." -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Error: Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Start MongoDB services
Write-Host "📦 Starting MongoDB and Mongo Express..." -ForegroundColor Yellow
docker-compose -f $DockerComposeFile up -d

# Wait for MongoDB to be healthy
Write-Host ""
Write-Host "⏳ Waiting for MongoDB to be ready..." -ForegroundColor Yellow
$timeout = 60
$elapsed = 0
$ready = $false

while ($elapsed -lt $timeout -and -not $ready) {
    try {
        $result = docker exec microservice-template-mongodb mongosh --eval "db.adminCommand('ping')" 2>$null
        if ($result -match "ok.*1") {
            $ready = $true
        }
    } catch {
        # Ignore errors during startup
    }
    
    if (-not $ready) {
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
}

if (-not $ready) {
    Write-Host "❌ Error: MongoDB failed to start within $timeout seconds" -ForegroundColor Red
    docker-compose -f $DockerComposeFile logs mongodb
    exit 1
}

Write-Host ""
Write-Host "✅ MongoDB Development Environment is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Access Points:" -ForegroundColor Cyan
Write-Host "  - MongoDB:         localhost:27017"
Write-Host "  - Mongo Express:   http://localhost:8082 (admin/admin123)"
Write-Host ""
Write-Host "🔧 Useful Commands:" -ForegroundColor Cyan
Write-Host "  - View logs:       docker-compose -f $DockerComposeFile logs -f"
Write-Host "  - Mongo Shell:     docker exec -it microservice-template-mongodb mongosh"
Write-Host "  - Stop services:   docker-compose -f $DockerComposeFile down"
Write-Host "  - View stats:      docker exec -it microservice-template-mongodb mongosh --eval 'db.stats()'"
Write-Host ""
Write-Host "📚 Saga State Monitoring:" -ForegroundColor Cyan
Write-Host "  - View all sagas:  docker exec -it microservice-template-mongodb mongosh --eval 'use microservice-template-billing; db.travelbookingsagastates.find().pretty()'"
Write-Host "  - Count by status: docker exec -it microservice-template-mongodb mongosh --eval 'use microservice-template-billing; db.travelbookingsagastates.aggregate([{`$group: {_id: `"`$status`", count: {`$sum: 1}}}])'"
Write-Host "  - Pending sagas:   docker exec -it microservice-template-mongodb mongosh --eval 'use microservice-template-billing; db.travelbookingsagastates.find({status: `"PENDING`"}).pretty()'"
Write-Host ""
