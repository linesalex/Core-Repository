# 🚀 Quick Migration Reference - CNX Colocation

## 📋 TL;DR - Run This On Your Test Server

### Option 1: Automated Script (Recommended)
```bash
# Navigate to your repository
cd /path/to/Core-Repository/backend

# Make script executable
chmod +x run_cnx_migration.sh

# Run automated migration (includes backup)
./run_cnx_migration.sh

# Restart your server
pm2 restart all
```

### Option 2: Manual Steps
```bash
# 1. Navigate to backend directory
cd /path/to/Core-Repository/backend

# 2. Stop your application
pm2 stop all

# 3. Create backup
cp ../network_routes.db ../network_routes_backup_$(date +%Y%m%d_%H%M%S).db

# 4. Run migration
node cnx_colocation_migration.js

# 5. Restart application
pm2 start all
```

## ✅ Success Indicators

Your migration worked if you see:
```
🎉 Migration completed successfully!
✅ CNX Colocation is now ready with full file and info support
🏆 All migrations completed and verified successfully!
```

## 🧪 Quick Test

After migration, test these features:
1. Go to CNX Colocation page
2. Edit a location → Upload design file → Should work
3. Try to add client with 31+ RU → Should be blocked
4. Click green tick on design files → Should download

## 🚨 If Something Goes Wrong

### Restore backup:
```bash
pm2 stop all
cp ../network_routes_backup_YYYYMMDD_HHMMSS.db ../network_routes.db
pm2 start all
```

### Common issues:
- **Database locked**: Stop all Node.js processes first
- **Permission denied**: Check file permissions on database
- **Module not found**: Run `npm install sqlite3`

## 📞 Quick Support Checklist

Before asking for help, check:
- [ ] Database backup exists
- [ ] Backend server is stopped during migration
- [ ] sqlite3 npm package is installed
- [ ] Migration script shows success message
- [ ] Server restarts without errors

---

**That's it! Your CNX Colocation should now have full file management capabilities.** 