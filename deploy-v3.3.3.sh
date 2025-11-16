#!/bin/bash

# Deployment Script for Network Inventory v3.3.3
# This fixes the memory crash issue by switching from dev server to production build

set -e  # Exit on any error

echo "🚀 Starting Network Inventory v3.3.3 Deployment..."
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo "📍 Working directory: $SCRIPT_DIR"
echo ""

# Step 1: Stop PM2 processes
echo "⏸️  Step 1/7: Stopping PM2 processes..."
pm2 stop all || true
echo "✅ PM2 processes stopped"
echo ""

# Step 2: Clean caches
echo "🧹 Step 2/7: Cleaning caches and temporary files..."
rm -rf frontend/node_modules/.cache 2>/dev/null || true
rm -rf backend/node_modules/.cache 2>/dev/null || true
rm -rf .cache 2>/dev/null || true
npm cache clean --force 2>/dev/null || true
echo "✅ Caches cleaned"
echo ""

# Step 3: Check if 'serve' is installed globally
echo "📦 Step 3/7: Checking for 'serve' package..."
if ! command -v serve &> /dev/null; then
    echo "⚠️  'serve' not found, installing globally..."
    npm install -g serve
    echo "✅ 'serve' installed"
else
    echo "✅ 'serve' is already installed"
fi
echo ""

# Step 4: Install/update dependencies (if needed)
echo "📦 Step 4/7: Checking backend dependencies..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install --production
else
    echo "✅ Backend dependencies OK"
fi
cd ..
echo ""

echo "📦 Step 4/7: Checking frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
else
    echo "✅ Frontend dependencies OK"
fi
cd ..
echo ""

# Step 5: Build production frontend
echo "🏗️  Step 5/7: Building production frontend..."
echo "⚠️  This may take 2-3 minutes and use up to 2GB memory temporarily..."
cd frontend

# Increase Node memory limit for the build process only
export NODE_OPTIONS="--max-old-space-size=2048"

# Remove old build if exists
rm -rf build 2>/dev/null || true

# Build production version
npm run build

# Check if build was successful
if [ ! -d "build" ]; then
    echo "❌ Build failed! The 'build' folder was not created."
    exit 1
fi

echo "✅ Production build completed successfully"
cd ..
echo ""

# Step 6: Upload updated ecosystem.config.js and restart PM2
echo "🔄 Step 6/7: Restarting PM2 with updated configuration..."
pm2 delete all || true  # Delete old processes
pm2 start ecosystem.config.js --env production
pm2 save  # Save the PM2 process list
echo "✅ PM2 restarted with new configuration"
echo ""

# Step 7: Verify deployment
echo "🔍 Step 7/7: Verifying deployment..."
sleep 3  # Give processes time to start

echo ""
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "📝 Recent Frontend Logs:"
pm2 logs network-frontend --lines 20 --nostream

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Network Inventory v3.3.3 is now running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Frontend: http://172.30.252.118:3000"
echo "📍 Backend:  http://172.30.252.118:4000"
echo ""
echo "Expected Results:"
echo "  • Frontend memory: ~50MB (was ~900MB)"
echo "  • Frontend startup: <1 second (was 60+ seconds)"
echo "  • No more 'heap out of memory' crashes"
echo ""
echo "Monitor with:"
echo "  pm2 status      - Check process status"
echo "  pm2 monit       - Real-time monitoring"
echo "  pm2 logs        - View logs"
echo ""
echo "If you see any errors, run: pm2 logs network-frontend"

