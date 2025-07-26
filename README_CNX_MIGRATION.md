# CNX Colocation Database Migration

## 🎯 Overview

This migration package fixes critical CNX Colocation issues by adding missing database columns and implementing comprehensive file management functionality.

### What Gets Fixed:
- ❌ **Database Error**: `SQLITE_ERROR: no such column: more_info`
- ❌ **Missing Download**: Green ticks don't download files
- ❌ **No File Deletion**: Can't remove uploaded files
- ❌ **Unlimited RU**: No validation preventing >30 RU per rack

### What You Get:
- ✅ **Full File Management**: Upload, download, and delete design/pricing files
- ✅ **RU Validation**: Prevents exceeding 30 RU per rack
- ✅ **Enhanced UI**: Download buttons and delete options
- ✅ **Database Support**: Proper columns for file and info storage

---

## 🚀 Quick Start

### Prerequisites
- Backend server stopped: `pm2 stop all`
- Database backup (automatic with our script)
- Node.js with sqlite3 package

### Run Migration (Choose One)

#### Option A: Automated Script (Recommended)
```bash
cd backend
chmod +x run_cnx_migration.sh    # Linux/Mac only
./run_cnx_migration.sh           # Linux/Mac
# OR for Windows: run commands manually (see Option B)
```

#### Option B: Manual Commands
```bash
cd backend
pm2 stop all
cp ../network_routes.db ../network_routes_backup_$(date +%Y%m%d_%H%M%S).db
node cnx_colocation_migration.js
pm2 restart all
```

### Success Confirmation
Look for this output:
```
🎉 Migration completed successfully!
✅ CNX Colocation is now ready with full file and info support
🏆 All migrations completed and verified successfully!
```

---

## 📋 Step-by-Step Instructions

### Step 1: Prepare Your Environment

1. **Navigate to your repository:**
   ```bash
   cd /path/to/Core-Repository
   ```

2. **Stop your application:**
   ```bash
   pm2 stop all
   ```

3. **Verify database location:**
   ```bash
   ls -la network_routes.db
   ```

### Step 2: Create Database Backup

**CRITICAL: Always backup before running migrations!**

```bash
# Create timestamped backup
cp network_routes.db network_routes_backup_$(date +%Y%m%d_%H%M%S).db

# Verify backup was created
ls -la network_routes_backup_*.db
```

### Step 3: Check Dependencies

```bash
cd backend

# Check if sqlite3 is installed
npm list sqlite3

# If not installed:
npm install sqlite3
```

### Step 4: Run Migration

```bash
# From backend directory
node cnx_colocation_migration.js
```

### Step 5: Verify Success

The script will automatically verify the migration. Look for:
- ✅ `more_info column: EXISTS`
- ✅ `design_file column: EXISTS`
- 🎉 `Migration completed successfully!`

### Step 6: Restart Application

```bash
# From any directory
pm2 restart all

# Check for errors
pm2 logs
```

---

## 🧪 Testing Your Migration

After migration, test these features:

### 1. File Upload/Download
- Go to CNX Colocation page
- Edit a location → Upload design file (PDF)
- Click green tick → Should download file
- Edit rack → Upload pricing file (Excel)
- Click green tick → Should download file

### 2. File Deletion
- Edit location with existing design file
- Click "Remove" button → Should delete file
- Edit rack with existing pricing file
- Click "Remove" button → Should delete file

### 3. RU Validation
- Try adding client with >30 RU → Should be blocked
- Add clients totaling exactly 30 RU → Should work
- Try adding one more RU → Should show error

### 4. More Info Storage
- Edit location → Add text to "More Info" field
- Save and reload → Text should persist

---

## 📁 File Descriptions

### Migration Files
- **`backend/cnx_colocation_migration.js`** - Main migration script
- **`backend/run_cnx_migration.sh`** - Automated wrapper (Linux/Mac)
- **`CNX_COLOCATION_MIGRATION_GUIDE.md`** - Detailed migration guide
- **`QUICK_MIGRATION_REFERENCE.md`** - Quick reference commands

### Database Changes
- **Table**: `location_reference`
- **New Columns**: 
  - `more_info TEXT` - Stores additional location information
  - `design_file TEXT` - Stores location design file names

### Backend API Changes
- **New Endpoints**: 6 new download/delete endpoints for file management
- **Enhanced Validation**: RU limits and file type checking
- **File Management**: Proper file storage and cleanup

### Frontend Changes
- **Download Buttons**: Added to all green tick indicators
- **Delete Buttons**: Added to all edit dialogs for file removal
- **RU Validation**: Real-time validation preventing >30 RU per rack
- **Enhanced UX**: Better error messages and visual feedback

---

## 🚨 Troubleshooting

### Common Issues

#### Database File Not Found
```
❌ Database file not found at: /path/to/network_routes.db
```
**Solution**: Update `dbPath` in `cnx_colocation_migration.js` to correct path

#### Column Already Exists
```
⚠️ Column already exists, skipping...
```
**This is normal** - script safely handles existing columns

#### Database Locked
```
❌ Error opening database: SQLITE_BUSY
```
**Solution**: 
1. Stop all Node.js processes: `pm2 stop all`
2. Kill any remaining: `pkill -f node`
3. Try migration again

#### Permission Denied
```
❌ Error opening database: SQLITE_READONLY
```
**Solution**:
1. Check file permissions: `chmod 644 network_routes.db`
2. Ensure your user owns the file: `chown $USER network_routes.db`

#### Missing sqlite3 Module
```
❌ Cannot find module 'sqlite3'
```
**Solution**: `npm install sqlite3`

### Rollback Procedure

If something goes wrong:

```bash
# Stop application
pm2 stop all

# Restore from backup (replace YYYYMMDD_HHMMSS with your backup timestamp)
cp network_routes_backup_YYYYMMDD_HHMMSS.db network_routes.db

# Restart application
pm2 restart all
```

---

## ✅ Post-Migration Checklist

Verify these items after migration:

- [ ] Migration script completed with success message
- [ ] Backend server starts without database errors
- [ ] CNX Colocation page loads properly
- [ ] Location design file upload works (PDF only)
- [ ] Rack pricing file upload works (Excel only)
- [ ] Client design file upload works (PDF only)
- [ ] Green tick download buttons work for all file types
- [ ] Remove buttons work in all edit dialogs
- [ ] "More info" fields save and display properly
- [ ] RU validation prevents exceeding 30 per rack
- [ ] All existing CNX Colocation data remains intact

---

## 🔧 Advanced Configuration

### Custom Database Path
If your database is in a different location, edit `backend/cnx_colocation_migration.js`:

```javascript
// Change this line to your database path
const dbPath = path.join(__dirname, '../your-custom-path/network_routes.db');
```

### File Upload Limits
File size limits are configured in `backend/routes.js`:
- **Location/Client Design**: 10MB PDF files
- **Rack Pricing**: 10MB Excel files (.xlsx)

---

## 📞 Support

### Before Requesting Help

Check these items:
1. ✅ Database backup exists
2. ✅ Backend server fully stopped during migration
3. ✅ sqlite3 npm package installed
4. ✅ Migration script shows success message
5. ✅ No file permission issues
6. ✅ Server restarts without errors

### Log Analysis

Check these logs for issues:
```bash
# PM2 logs
pm2 logs

# Migration script output
node cnx_colocation_migration.js

# Database schema verification
sqlite3 network_routes.db ".schema location_reference"
```

---

## 🎉 Success!

Your CNX Colocation system now has:
- 🔄 **Full File Management** - Upload, download, delete all file types
- 🛡️ **RU Validation** - Prevents resource over-allocation
- 📝 **Enhanced Storage** - Proper database support for files and info
- 🎨 **Better UX** - Improved interface with download/delete buttons

**Enjoy your fully functional CNX Colocation system!** 🚀 