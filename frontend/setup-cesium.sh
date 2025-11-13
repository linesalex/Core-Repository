#!/bin/bash
# Setup script for Cesium assets - Linux/Mac
# This copies Cesium static assets from node_modules to public folder

echo ""
echo "==============================================="
echo "  Copying Cesium Assets to Public Folder"
echo "==============================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules/cesium/Build/Cesium" ]; then
    echo "ERROR: Cesium package not found in node_modules"
    echo "Please run 'npm install' first"
    exit 1
fi

# Copy Cesium assets to public folder
echo "Copying Cesium assets..."
cp -r node_modules/cesium/Build/Cesium public/cesium

if [ $? -eq 0 ]; then
    echo ""
    echo "SUCCESS: Cesium assets copied successfully!"
    echo "Location: public/cesium/"
    echo ""
    echo "You can now start the development server with 'npm start'"
    echo ""
else
    echo ""
    echo "ERROR: Failed to copy Cesium assets"
    exit 1
fi

