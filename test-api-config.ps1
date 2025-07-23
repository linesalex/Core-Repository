# Test API Configuration for Network Inventory System
# This script verifies that the frontend can connect to the backend

Write-Host "🧪 Network Inventory System - API Configuration Test" -ForegroundColor Green
Write-Host ""

# Check if config file exists
if (!(Test-Path "frontend\src\config.js")) {
    Write-Host "❌ Error: config.js not found" -ForegroundColor Red
    Write-Host "   Run from Core-Repository root directory" -ForegroundColor Yellow
    exit 1
}

# Check if .env file exists
$envFile = "frontend\.env"
if (Test-Path $envFile) {
    Write-Host "✅ Found .env configuration file" -ForegroundColor Green
    $envContent = Get-Content $envFile
    $apiUrl = ($envContent | Where-Object { $_ -like "REACT_APP_API_URL=*" }) -replace "REACT_APP_API_URL=", ""
    if ($apiUrl) {
        Write-Host "   API URL: $apiUrl" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  No .env file found - using auto-detection" -ForegroundColor Yellow
    $apiUrl = "http://localhost:4000"  # Default fallback
}

# Test different API endpoints
$endpoints = @(
    @{ Name = "Health Check"; Path = "/health"; Required = $true },
    @{ Name = "Database Health"; Path = "/health/database"; Required = $true },
    @{ Name = "Login Endpoint"; Path = "/login"; Required = $true; Method = "POST"; ExpectError = $true }
)

Write-Host ""
Write-Host "🔍 Testing API endpoints..." -ForegroundColor Yellow

$allPassed = $true
foreach ($endpoint in $endpoints) {
    $testUrl = "$apiUrl$($endpoint.Path)"
    $method = if ($endpoint.Method) { $endpoint.Method } else { "GET" }
    
    try {
        if ($method -eq "POST" -and $endpoint.ExpectError) {
            # For login endpoint, expect a 400 error (missing credentials)
            try {
                Invoke-RestMethod -Uri $testUrl -Method $method -TimeoutSec 5
                Write-Host "⚠️  $($endpoint.Name): Unexpected success" -ForegroundColor Yellow
            } catch {
                if ($_.Exception.Response.StatusCode -eq 400) {
                    Write-Host "✅ $($endpoint.Name): Correctly requires credentials" -ForegroundColor Green
                } else {
                    throw $_
                }
            }
        } else {
            $response = Invoke-RestMethod -Uri $testUrl -Method $method -TimeoutSec 5
            Write-Host "✅ $($endpoint.Name): OK" -ForegroundColor Green
        }
    } catch {
        $status = if ($_.Exception.Response) { $_.Exception.Response.StatusCode } else { "Connection Failed" }
        if ($endpoint.Required) {
            Write-Host "❌ $($endpoint.Name): $status" -ForegroundColor Red
            $allPassed = $false
        } else {
            Write-Host "⚠️  $($endpoint.Name): $status (optional)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
if ($allPassed) {
    Write-Host "🎉 All tests passed! Your API configuration is working correctly." -ForegroundColor Green
    Write-Host ""
    Write-Host "Your frontend should be able to connect to the backend successfully." -ForegroundColor White
} else {
    Write-Host "❌ Some tests failed. Please check your backend configuration." -ForegroundColor Red
    Write-Host ""
    Write-Host "Common solutions:" -ForegroundColor Yellow
    Write-Host "1. Start the backend: cd backend && npm start" -ForegroundColor White
    Write-Host "2. Check if port 4000 is available" -ForegroundColor White
    Write-Host "3. Verify firewall settings" -ForegroundColor White
    Write-Host "4. Run: .\configure-api.ps1 -AutoDetect" -ForegroundColor White
}

Write-Host ""
Write-Host "Configuration details:" -ForegroundColor Gray
Write-Host "  Config file: frontend\src\config.js" -ForegroundColor Gray
Write-Host "  Env file: $envFile $(if (Test-Path $envFile) { '(exists)' } else { '(not found)' })" -ForegroundColor Gray
Write-Host "  API URL: $apiUrl" -ForegroundColor Gray 