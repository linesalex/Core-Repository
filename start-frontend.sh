#!/bin/bash

# Startup script for Network Inventory Frontend
# This ensures serve is called correctly

cd "$(dirname "$0")/frontend"

# Check if build directory exists
if [ ! -d "build" ]; then
    echo "Error: build directory not found. Run 'npm run build' first."
    exit 1
fi

# Start serve with production build
echo "Starting frontend server on port 3000..."

# Try different methods to find and run serve
if command -v serve &> /dev/null; then
    # serve is in PATH
    serve -s build -p 3000
elif [ -f "/usr/local/bin/serve" ]; then
    # serve is in /usr/local/bin
    /usr/local/bin/serve -s build -p 3000
elif [ -f "/usr/bin/serve" ]; then
    # serve is in /usr/bin
    /usr/bin/serve -s build -p 3000
else
    # Use npx as fallback
    npx serve -s build -p 3000
fi

