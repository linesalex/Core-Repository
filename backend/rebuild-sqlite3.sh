#!/bin/bash

echo "Rebuilding sqlite3 module for current platform..."
echo

echo "Step 1: Removing existing sqlite3 installation..."
npm uninstall sqlite3

echo
echo "Step 2: Reinstalling sqlite3 and rebuilding for current platform..."
npm install sqlite3

echo
echo "Step 3: Testing the installation..."
node -e "try { require('sqlite3'); console.log('✓ sqlite3 module installed successfully'); } catch(e) { console.error('✗ sqlite3 module failed to load:', e.message); }"

echo
echo "Done! You can now run 'npm start' to start the application."