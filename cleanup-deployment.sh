#!/bin/bash

# Deployment Cleanup Script for Network Inventory v3.3.3+
# This script removes development artifacts and caches before deployment
# Run this on your development machine OR on the server to free up space

echo "🧹 Starting deployment cleanup..."

# Remove webpack/build caches (can be 2-4GB)
echo "Removing webpack caches..."
rm -rf frontend/node_modules/.cache
rm -rf backend/node_modules/.cache
rm -rf .cache

# Clean npm cache (can help with memory issues)
echo "Cleaning npm cache..."
npm cache clean --force 2>/dev/null || true

# Remove frontend build artifacts
echo "Removing old build artifacts..."
rm -rf frontend/build
rm -rf frontend/dist

# Remove log files
echo "Removing log files..."
find . -name "*.log" -type f -delete

# Remove temporary files
echo "Removing temporary files..."
rm -rf tmp/
rm -rf temp/

# Remove OS-specific files
echo "Removing OS-specific files..."
find . -name ".DS_Store" -type f -delete
find . -name "Thumbs.db" -type f -delete

# Remove editor files
echo "Removing editor files..."
rm -rf .vscode/
rm -rf .idea/

# Remove backup files
echo "Removing backup files..."
find . -name "*.bak" -type f -delete
find . -name "*.backup" -type f -delete

echo "✅ Cleanup complete!"
echo ""
echo "Space freed. You can now deploy or check directory size with:"
echo "  du -sh ."

