# Deployment Size Reduction Guide

## Problem
Version 3.3.3 was initially ~4GB larger than 3.3.2 due to accumulated development caches and artifacts.

## Root Cause
The `frontend/node_modules/.cache` directory accumulates webpack build cache during development, growing to 2-4GB over time. This directory is **not needed** for production deployment.

## Solution

### On Your Server (Quick Fix)
Run this command to immediately free up space:

**PowerShell (Windows):**
```powershell
.\cleanup-deployment.ps1
```

**Bash (Linux):**
```bash
chmod +x cleanup-deployment.sh
./cleanup-deployment.sh
```

**Manual Cleanup (if scripts don't work):**
```bash
# Remove webpack cache (saves ~2-4GB)
rm -rf frontend/node_modules/.cache
rm -rf backend/node_modules/.cache

# Remove build artifacts
rm -rf frontend/build
rm -rf frontend/dist
```

### Expected Space Savings
- **Webpack cache**: 2-4GB
- **Build artifacts**: 100-500MB
- **Log files**: Variable
- **Temporary files**: Variable
- **Total savings**: ~2.5-5GB

## Prevention

### 1. Before Deployment
Always run the cleanup script before deploying to your server:
```bash
# On your development machine
./cleanup-deployment.ps1  # Windows
./cleanup-deployment.sh   # Linux
```

### 2. Git Configuration
The `.gitignore` file has been updated to exclude:
- `frontend/node_modules/.cache/`
- `backend/node_modules/.cache/`
- `.cache/`

### 3. Deployment Best Practices
**Option A: Deploy from Git (Recommended)**
```bash
# On server
git pull origin main
npm install --production
cd frontend && npm run build
```

**Option B: Deploy Clean Build**
```bash
# On development machine
./cleanup-deployment.ps1
tar -czf deployment.tar.gz --exclude='node_modules' .
# Upload deployment.tar.gz to server
# On server, extract and run npm install --production
```

## What Gets Cleaned

| Item | Purpose | Safe to Remove? | Space Saved |
|------|---------|----------------|-------------|
| `frontend/node_modules/.cache/` | Webpack build cache | ✅ Yes (dev only) | 2-4GB |
| `backend/node_modules/.cache/` | Node module cache | ✅ Yes (dev only) | <100MB |
| `frontend/build/` | Old build artifacts | ✅ Yes (rebuilt) | 100-500MB |
| `*.log` | Log files | ✅ Yes | Variable |
| `.vscode/`, `.idea/` | Editor configs | ✅ Yes (dev only) | <10MB |

## Regular Maintenance

Run the cleanup script:
- **Before each deployment** to server
- **Weekly** on development machines
- **Monthly** on servers (if needed)

## Monitoring
Check directory sizes:

**PowerShell:**
```powershell
Get-ChildItem -Directory | ForEach-Object {
    $size = (Get-ChildItem $_.FullName -Recurse | Measure-Object -Property Length -Sum).Sum
    [PSCustomObject]@{Directory=$_.Name; SizeGB=[math]::Round($size/1GB,2)}
} | Sort-Object SizeGB -Descending
```

**Bash:**
```bash
du -h -d 1 | sort -hr
```

## Notes
- The cleanup scripts are safe to run multiple times
- They only remove development/cache files, not production data
- Database files, uploaded KMZ files, and templates are preserved
- Run with elevated permissions if you encounter "access denied" errors

