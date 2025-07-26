# CNX Colocation Database Migration Guide

## 🎯 Purpose
This migration adds support for CNX Colocation file management and "more info" fields by adding missing database columns to the `location_reference` table.

## 🔧 What This Migration Does
- Adds `more_info` TEXT column to `location_reference` table
- Adds `design_file` TEXT column to `location_reference` table
- Fixes the database error: `SQLITE_ERROR: no such column: more_info`
- Enables full CNX Colocation functionality with file uploads and downloads

## ⚠️ Prerequisites

### 1. Backup Your Database
**CRITICAL: Always backup before running migrations!**

```bash
# Create backup with timestamp
cp network_routes.db network_routes_backup_$(date +%Y%m%d_%H%M%S).db

# Verify backup was created
ls -la network_routes_backup_*.db
```

### 2. Stop Your Application
```bash
# Stop the backend server
pm2 stop all
# OR if running directly
# Kill the Node.js process running your backend
```

### 3. Verify Database Location
Make sure your database file is in the expected location:
```bash
ls -la network_routes.db
```

## 🚀 Running the Migration

### Step 1: Navigate to Backend Directory
```bash
cd /path/to/your/Core-Repository/backend
```

### Step 2: Check Node.js Dependencies
Make sure sqlite3 is installed:
```bash
npm list sqlite3
# If not installed:
npm install sqlite3
```

### Step 3: Run the Migration Script
```bash
node cnx_colocation_migration.js
```

### Expected Output (Success):
```
🚀 Starting CNX Colocation Database Migration...
✅ Connected to SQLite database: /path/to/network_routes.db
📋 Found 1 migration(s) to process

🔄 Checking migration: Add CNX Colocation columns to location_reference table
📋 Current status:
   - more_info column exists: false
   - design_file column exists: false
🔨 Running 2 SQL statement(s)...
   1. ALTER TABLE location_reference ADD COLUMN more_info...
   ✅ Statement executed successfully
   2. ALTER TABLE location_reference ADD COLUMN design_file...
   ✅ Statement executed successfully
✅ Migration completed successfully: Add CNX Colocation columns to location_reference table

🔍 Verifying migration results...
📊 Final verification:
   ✅ more_info column: EXISTS
   ✅ design_file column: EXISTS

🎉 Migration completed successfully!
✅ CNX Colocation is now ready with full file and info support

🏆 All migrations completed and verified successfully!

📝 Next steps:
   1. Restart your backend server
   2. Test CNX Colocation file upload/download functionality
   3. Verify RU validation (max 30 per rack)

🔐 Database connection closed
```

### Expected Output (Already Applied):
```
🚀 Starting CNX Colocation Database Migration...
✅ Connected to SQLite database: /path/to/network_routes.db
📋 Found 1 migration(s) to process

🔄 Checking migration: Add CNX Colocation columns to location_reference table
✅ Migration already applied: Columns already exist

🔍 Verifying migration results...
📊 Final verification:
   ✅ more_info column: EXISTS
   ✅ design_file column: EXISTS

🎉 Migration completed successfully!
✅ CNX Colocation is now ready with full file and info support

🏆 All migrations completed and verified successfully!
```

## 🔍 Verification Steps

### 1. Check Database Schema
```bash
# Connect to SQLite and check table structure
sqlite3 network_routes.db

# In SQLite prompt:
.schema location_reference

# You should see the new columns:
# more_info TEXT,
# design_file TEXT

# Exit SQLite:
.quit
```

### 2. Start Your Application
```bash
# Start backend server
pm2 start ecosystem.config.js

# Check logs for any errors
pm2 logs
```

### 3. Test CNX Colocation Features
1. **Navigate to CNX Colocation page**
2. **Test location edit with design file upload**
3. **Verify "more info" field saves properly**
4. **Test file download functionality**
5. **Test RU validation (should prevent > 30 RU per rack)**

## 🚨 Troubleshooting

### Error: Database file not found
```
❌ Database file not found at: /path/to/network_routes.db
```
**Solution:** Update the `dbPath` variable in `cnx_colocation_migration.js` to point to your actual database location.

### Error: Column already exists
```
⚠️ Column already exists, skipping...
```
**This is normal** - the script detects existing columns and skips them safely.

### Error: Permission denied
```
❌ Error opening database: SQLITE_READONLY
```
**Solution:** 
1. Check file permissions: `chmod 644 network_routes.db`
2. Ensure your user has write access to the database directory

### Error: Database is locked
```
❌ Error opening database: SQLITE_BUSY
```
**Solution:**
1. Make sure no other processes are using the database
2. Stop your backend server completely
3. Check for any lingering processes: `ps aux | grep node`

## 🔄 Rollback Procedure

**Note:** SQLite doesn't support DROP COLUMN easily. If you need to rollback:

### Option 1: Restore from Backup
```bash
# Stop application
pm2 stop all

# Restore backup
cp network_routes_backup_YYYYMMDD_HHMMSS.db network_routes.db

# Restart application
pm2 start ecosystem.config.js
```

### Option 2: Manual Column Removal (Advanced)
This requires recreating the entire table - only do this if absolutely necessary and you understand SQL.

## ✅ Post-Migration Checklist

- [ ] Migration script completed successfully
- [ ] Database schema shows new columns
- [ ] Backend server started without errors
- [ ] CNX Colocation page loads properly
- [ ] File upload works for location design files
- [ ] File download works for all file types
- [ ] "More info" field saves and displays properly
- [ ] RU validation prevents exceeding 30 per rack
- [ ] All existing CNX Colocation data intact

## 📞 Support

If you encounter issues:
1. Check the migration script output for specific error messages
2. Verify database backup exists before attempting fixes
3. Ensure all prerequisites are met
4. Check file permissions and database accessibility

## 🎉 Success Confirmation

Your migration is successful when:
1. ✅ Migration script shows "All migrations completed and verified successfully!"
2. ✅ Backend starts without database errors
3. ✅ CNX Colocation design file upload/download works
4. ✅ Location "more info" fields save properly
5. ✅ RU validation prevents total > 30 per rack

**You're all set! CNX Colocation is now fully functional with file management capabilities.** 