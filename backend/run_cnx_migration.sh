#!/bin/bash

# CNX Colocation Database Migration Runner
# Run this script from the backend directory

echo "🚀 CNX Colocation Migration Runner"
echo "=================================="

# Check if we're in the backend directory
if [ ! -f "cnx_colocation_migration.js" ]; then
    echo "❌ Error: cnx_colocation_migration.js not found"
    echo "Please run this script from the backend directory"
    exit 1
fi

# Check if database exists
if [ ! -f "../network_routes.db" ]; then
    echo "❌ Error: Database file not found at ../network_routes.db"
    echo "Please ensure the database file exists"
    exit 1
fi

echo "✅ Found migration script and database file"

# Create backup
BACKUP_NAME="network_routes_backup_$(date +%Y%m%d_%H%M%S).db"
echo "📦 Creating backup: $BACKUP_NAME"
cp ../network_routes.db "../$BACKUP_NAME"

if [ $? -eq 0 ]; then
    echo "✅ Backup created successfully"
else
    echo "❌ Failed to create backup"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

# Check if sqlite3 module is available
echo "🔍 Checking sqlite3 dependency..."
if npm list sqlite3 > /dev/null 2>&1; then
    echo "✅ sqlite3 dependency found"
else
    echo "⚠️  sqlite3 dependency not found. Installing..."
    npm install sqlite3
    if [ $? -eq 0 ]; then
        echo "✅ sqlite3 installed successfully"
    else
        echo "❌ Failed to install sqlite3"
        exit 1
    fi
fi

# Run the migration
echo ""
echo "🔨 Running CNX Colocation migration..."
echo "======================================"
node cnx_colocation_migration.js

MIGRATION_EXIT_CODE=$?

echo ""
echo "======================================"

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo "🎉 Migration completed successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Restart your backend server: pm2 restart all"
    echo "   2. Test CNX Colocation functionality"
    echo "   3. Verify file upload/download features"
    echo ""
    echo "💾 Backup created: $BACKUP_NAME"
else
    echo "❌ Migration failed!"
    echo ""
    echo "🔄 To rollback, run:"
    echo "   cp ../$BACKUP_NAME ../network_routes.db"
    echo ""
    exit 1
fi 