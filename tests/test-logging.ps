# PowerShell Logging Test Script for Windows
# Run with: .\test-logging.ps1

Write-Host "🧪 Testing Cross-Platform Logging Configuration" -ForegroundColor Cyan
Write-Host ""

# Platform Information
Write-Host "Platform Information:" -ForegroundColor Yellow
Write-Host "OS: $([System.Environment]::OSVersion.VersionString)"
Write-Host "Platform: $([System.Environment]::OSVersion.Platform)"
Write-Host "Machine: $env:COMPUTERNAME"
Write-Host "User: $env:USERNAME"
Write-Host ""

# Test different LOG_STRATEGY values
$strategies = @(
    @{ Name = "Console Only"; Strategy = "CONSOLE"; Description = "Development mode" },
    @{ Name = "File Logging"; Strategy = "FILE"; Description = "File rotation with console" },
    @{ Name = "Elasticsearch"; Strategy = "ELS"; Description = "Elasticsearch with console" },
    @{ Name = "All Transports"; Strategy = "ALL"; Description = "All available transports" }
)

Write-Host "Available Logging Strategies:" -ForegroundColor Yellow
$strategies | ForEach-Object -Begin { $i = 1 } -Process {
    Write-Host "$i. $($_.Name) (LOG_STRATEGY=$($_.Strategy))"
    Write-Host "   $($_.Description)" -ForegroundColor Gray
    $i++
}
Write-Host ""

# Check if required packages are installed
Write-Host "Checking Dependencies:" -ForegroundColor Yellow
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$requiredPackages = @("winston", "winston-daily-rotate-file", "winston-elasticsearch", "winston-syslog", "nest-winston")

foreach ($package in $requiredPackages) {
    if ($packageJson.dependencies.$package -or $packageJson.devDependencies.$package) {
        Write-Host "✅ $package installed" -ForegroundColor Green
    } else {
        Write-Host "❌ $package missing" -ForegroundColor Red
    }
}
Write-Host ""

# Check environment files
Write-Host "Environment Configuration:" -ForegroundColor Yellow
$envFiles = @(".env.development", ".env.staging", ".env.production")
foreach ($file in $envFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file | Where-Object { $_ -match "LOG_STRATEGY=" }
        if ($content) {
            Write-Host "✅ $file - $content" -ForegroundColor Green
        } else {
            Write-Host "⚠️  $file - No LOG_STRATEGY found" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ $file - File not found" -ForegroundColor Red
    }
}
Write-Host ""

# Test log directory creation
Write-Host "Log Directory Test:" -ForegroundColor Yellow
$logDir = "logs"
if (!(Test-Path $logDir)) {
    try {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        Write-Host "✅ Created log directory: $logDir" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to create log directory: $logDir" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "✅ Log directory exists: $logDir" -ForegroundColor Green
}

# Test write permissions
try {
    $testFile = Join-Path $logDir "test-write.log"
    "Test log entry" | Out-File -FilePath $testFile -Encoding UTF8
    Remove-Item $testFile -Force
    Write-Host "✅ Log directory is writable" -ForegroundColor Green
} catch {
    Write-Host "❌ Log directory is not writable" -ForegroundColor Red
}
Write-Host ""

# Sample log formats
Write-Host "Sample Log Formats:" -ForegroundColor Yellow
$sampleLog = @{
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    level = "info"
    message = "User authentication successful"
    service = "microservice-template"
    userId = "12345"
    requestId = "req-abc-123"
}

Write-Host "Development Console Format:" -ForegroundColor Cyan
Write-Host "$($sampleLog.timestamp) [INFO]: $($sampleLog.message)"
Write-Host "  Context: userId=$($sampleLog.userId), requestId=$($sampleLog.requestId)" -ForegroundColor Gray

Write-Host ""
Write-Host "Production JSON Format:" -ForegroundColor Cyan
$jsonLog = $sampleLog | ConvertTo-Json -Depth 3
Write-Host $jsonLog -ForegroundColor Gray
Write-Host ""

# Docker services check
Write-Host "Docker Services Check:" -ForegroundColor Yellow
try {
    $dockerOutput = docker ps --format "table {{.Names}}\t{{.Status}}" 2>$null
    if ($dockerOutput) {
        Write-Host "Docker containers running:" -ForegroundColor Green
        $dockerOutput | Write-Host -ForegroundColor Gray
    } else {
        Write-Host "⚠️  No Docker containers running" -ForegroundColor Yellow
        Write-Host "   Run: docker-compose -f docker-compose.logging.yml up -d" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Docker not available or not running" -ForegroundColor Red
}
Write-Host ""

# Testing instructions
Write-Host "Testing Instructions:" -ForegroundColor Yellow
Write-Host "1. Build the application:" -ForegroundColor White
Write-Host "   npm run build" -ForegroundColor Gray

Write-Host "2. Test different logging strategies:" -ForegroundColor White
Write-Host '   $env:LOG_STRATEGY="CONSOLE"; npm run start:dev' -ForegroundColor Gray
Write-Host '   $env:LOG_STRATEGY="FILE"; npm run start:dev' -ForegroundColor Gray
Write-Host '   $env:LOG_STRATEGY="ALL"; npm run start:dev' -ForegroundColor Gray

Write-Host "3. Check log files:" -ForegroundColor White
Write-Host '   Get-Content -Path "logs\application-*.log" -Wait' -ForegroundColor Gray

Write-Host "4. Test with Elasticsearch (optional):" -ForegroundColor White
Write-Host "   docker-compose -f docker-compose.logging.yml up -d" -ForegroundColor Gray
Write-Host "   Wait 30 seconds for Elasticsearch to start" -ForegroundColor Gray
Write-Host '   $env:LOG_STRATEGY="ELS"; npm run start:dev' -ForegroundColor Gray
Write-Host "   Visit: http://localhost:5601 (Kibana)" -ForegroundColor Gray

Write-Host ""
Write-Host "🚀 Ready to test cross-platform logging!" -ForegroundColor Green
