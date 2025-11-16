#!/bin/bash

# Verification script for build folder structure
# This checks if the frontend build is correctly structured

echo "🔍 Verifying frontend build structure..."
echo ""

cd "$(dirname "$0")/frontend"

# Check if build folder exists
if [ ! -d "build" ]; then
    echo "❌ ERROR: build folder does not exist!"
    echo "   Run: cd frontend && npm run build"
    exit 1
fi

echo "✅ build folder exists"

# Check for index.html
if [ ! -f "build/index.html" ]; then
    echo "❌ ERROR: build/index.html is missing!"
    echo "   This is the main entry point. Build may have failed."
    exit 1
fi

echo "✅ build/index.html exists"

# Check for static folder
if [ ! -d "build/static" ]; then
    echo "⚠️  WARNING: build/static folder missing"
else
    echo "✅ build/static folder exists"
fi

# List top-level build contents
echo ""
echo "📁 Build folder structure:"
ls -lh build/ | head -20

# Check index.html size (should be >1KB)
INDEX_SIZE=$(stat -f%z "build/index.html" 2>/dev/null || stat -c%s "build/index.html" 2>/dev/null)
if [ "$INDEX_SIZE" -lt 1000 ]; then
    echo ""
    echo "⚠️  WARNING: index.html is very small (${INDEX_SIZE} bytes)"
    echo "   Expected: >1KB. Build may have failed."
else
    echo ""
    echo "✅ index.html size: $INDEX_SIZE bytes (looks good)"
fi

# Check if serve.json exists
if [ -f "serve.json" ]; then
    echo "✅ serve.json configuration exists"
else
    echo "⚠️  serve.json not found (will use default serve settings)"
fi

echo ""
echo "🎯 Expected structure:"
echo "   frontend/"
echo "   ├── build/"
echo "   │   ├── index.html          ← Main entry point"
echo "   │   ├── static/             ← JS/CSS/media files"
echo "   │   ├── cesium/             ← Cesium library assets"
echo "   │   └── ..."
echo "   └── serve.json              ← Serve configuration"
echo ""

# Test with serve (dry run)
echo "🧪 Testing serve command..."
if command -v serve &> /dev/null; then
    echo "✅ serve is installed"
    echo ""
    echo "To manually test serving:"
    echo "   cd frontend && serve -p 3000"
    echo ""
    echo "Then open: http://172.30.252.118:3000"
elif command -v npx &> /dev/null; then
    echo "✅ npx is available (will use: npx serve)"
    echo ""
    echo "To manually test serving:"
    echo "   cd frontend && npx serve -p 3000"
    echo ""
    echo "Then open: http://172.30.252.118:3000"
else
    echo "❌ ERROR: Neither serve nor npx is available!"
    echo "   Install with: npm install -g serve"
    exit 1
fi

echo "✅ Verification complete!"

