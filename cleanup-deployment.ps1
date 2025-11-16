# Deployment Cleanup Script for Network Inventory v3.3.3+
# This script removes development artifacts and caches before deployment
# Run this on your development machine OR on the server to free up space

Write-Host "🧹 Starting deployment cleanup..." -ForegroundColor Cyan

# Remove webpack/build caches (can be 2-4GB)
Write-Host "Removing webpack caches..." -ForegroundColor Yellow
Remove-Item -Path "frontend\node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "backend\node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".cache" -Recurse -Force -ErrorAction SilentlyContinue

# Clean npm cache (can help with memory issues)
Write-Host "Cleaning npm cache..." -ForegroundColor Yellow
npm cache clean --force 2>&1 | Out-Null

# Remove frontend build artifacts
Write-Host "Removing old build artifacts..." -ForegroundColor Yellow
Remove-Item -Path "frontend\build" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "frontend\dist" -Recurse -Force -ErrorAction SilentlyContinue

# Remove log files
Write-Host "Removing log files..." -ForegroundColor Yellow
Get-ChildItem -Path . -Include "*.log" -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force

# Remove temporary files
Write-Host "Removing temporary files..." -ForegroundColor Yellow
Remove-Item -Path "tmp" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "temp" -Recurse -Force -ErrorAction SilentlyContinue

# Remove OS-specific files
Write-Host "Removing OS-specific files..." -ForegroundColor Yellow
Get-ChildItem -Path . -Include ".DS_Store","Thumbs.db" -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force

# Remove editor files
Write-Host "Removing editor files..." -ForegroundColor Yellow
Remove-Item -Path ".vscode" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".idea" -Recurse -Force -ErrorAction SilentlyContinue

# Remove backup files
Write-Host "Removing backup files..." -ForegroundColor Yellow
Get-ChildItem -Path . -Include "*.bak","*.backup" -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force

Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Space freed. Directory sizes:" -ForegroundColor Cyan
Get-ChildItem -Directory | ForEach-Object {
    $size = (Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    if ($size -gt 0) {
        [PSCustomObject]@{
            Directory = $_.Name
            SizeMB = [math]::Round($size/1MB, 2)
        }
    }
} | Sort-Object SizeMB -Descending | Format-Table -AutoSize

