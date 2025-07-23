#!/bin/bash
# PM2 Deployment Script for Network Inventory Management System
# Run this script to set up PM2 for production deployment

set -e  # Exit on any error

echo "🚀 Network Inventory Management System - PM2 Deployment"
echo "========================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run this script as root"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "ecosystem.config.js" ]; then
    print_error "ecosystem.config.js not found. Please run this script from the Core-Repository root directory."
    exit 1
fi

print_info "Starting PM2 deployment process..."

# Step 1: Check Node.js version
print_info "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 12+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 12 ]; then
    print_error "Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 12+."
    exit 1
fi

print_status "Node.js version $(node --version) is compatible"

# Step 2: Install PM2 if not already installed
print_info "Checking PM2 installation..."
if ! command -v pm2 &> /dev/null; then
    print_info "Installing PM2 globally..."
    npm install -g pm2
    print_status "PM2 installed successfully"
else
    print_status "PM2 is already installed ($(pm2 --version))"
fi

# Step 3: Install dependencies
print_info "Installing backend dependencies..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
    print_status "Backend dependencies installed"
else
    print_status "Backend dependencies already installed"
fi

print_info "Installing frontend dependencies..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install
    print_status "Frontend dependencies installed"
else
    print_status "Frontend dependencies already installed"
fi

cd ..

# Step 4: Create logs directory
print_info "Creating logs directory..."
mkdir -p logs
chmod 755 logs
print_status "Logs directory created"

# Step 5: Check database file
if [ ! -f "network_routes.db" ]; then
    print_warning "Database file not found. You may need to initialize the database."
    print_info "Run: cd backend && node init_db.js"
else
    print_status "Database file found"
fi

# Step 6: Check for environment configuration
if [ -f "frontend/.env" ]; then
    print_status "Frontend environment configuration found"
else
    print_warning "Frontend .env file not found. Creating default configuration..."
    
    # Get server IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo "REACT_APP_API_URL=http://${SERVER_IP}:4000" > frontend/.env
    print_status "Created frontend/.env with API URL: http://${SERVER_IP}:4000"
fi

# Step 7: Stop any existing PM2 processes
print_info "Stopping any existing PM2 processes..."
pm2 delete all 2>/dev/null || true
print_status "Existing processes stopped"

# Step 8: Start applications with PM2
print_info "Starting applications with PM2..."
pm2 start ecosystem.config.js

# Wait a moment for processes to start
sleep 5

# Step 9: Check process status
print_info "Checking process status..."
pm2 list

# Step 10: Save PM2 configuration
print_info "Saving PM2 configuration..."
pm2 save

# Step 11: Setup auto-startup
print_info "Setting up auto-startup on boot..."
pm2 startup

print_status "PM2 deployment completed successfully!"

echo ""
echo "🎉 Deployment Summary:"
echo "====================="
echo "✅ PM2 installed and configured"
echo "✅ Dependencies installed"
echo "✅ Applications started"
echo "✅ Logs directory created"
echo "✅ Auto-startup configured"
echo ""

# Display access information
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "🌐 Access URLs:"
echo "Backend API: http://${SERVER_IP}:4000"
echo "Frontend App: http://${SERVER_IP}:3000"
echo ""

echo "📊 Management Commands:"
echo "pm2 list          - View all processes"
echo "pm2 monit         - Real-time monitoring"
echo "pm2 logs          - View logs"
echo "pm2 restart all   - Restart all processes"
echo "pm2 stop all      - Stop all processes"
echo ""

# Final health check
print_info "Performing health check..."
sleep 3

if pm2 list | grep -q "online"; then
    print_status "Health check passed - Applications are running"
    
    # Test backend endpoint
    if curl -s "http://${SERVER_IP}:4000/health" > /dev/null; then
        print_status "Backend API is responding"
    else
        print_warning "Backend API is not responding yet (may need more time to start)"
    fi
else
    print_error "Health check failed - Check PM2 logs for errors"
    pm2 logs --err --lines 20
fi

echo ""
print_info "For detailed troubleshooting, check the 'pm2' file in this directory"
print_info "For application usage guide, check APPLICATION_WALKTHROUGH.md"

echo ""
echo "🎯 Next Steps:"
echo "1. Check process status: pm2 list"
echo "2. Monitor logs: pm2 logs"
echo "3. Access the application at http://${SERVER_IP}:3000"
echo "4. Default login: admin / admin123"
echo ""

# Check if startup command was provided
if pm2 startup 2>&1 | grep -q "sudo"; then
    echo "⚠️  IMPORTANT: Run the startup command shown above to enable auto-restart on boot"
    echo ""
fi

print_status "PM2 deployment script completed!" 