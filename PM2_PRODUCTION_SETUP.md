# 🚀 PM2 Production Setup Guide
## Updated ecosystem.config.js with Encryption Support

---

## 🔧 **Quick Setup Steps**

### 1. Generate Encryption Key
```bash
node setup_production_encryption.js
```

### 2. Update ecosystem.config.js
Replace the placeholder values in the `env_production` section:

```javascript
env_production: {
  NODE_ENV: 'production',
  PORT: 4000,
  // 🔐 Replace with a secure JWT secret (64+ characters)
  JWT_SECRET: 'your-super-secure-jwt-secret-min-64-chars-change-this-now',
  // 🔐 Replace with the generated encryption key
  ENCRYPTION_KEY: 'dd66e9221074e37176588cb8d4c85b19e1ec507335fdf86bded1754445583264'
}
```

### 3. Update Frontend API URL
In the frontend `env_production` section:
```javascript
// 🌐 Update to your actual production backend URL
REACT_APP_API_URL: 'http://YOUR-SERVER-IP:4000'
```

### 4. Deploy with PM2
```bash
# Stop existing processes
pm2 stop all

# Start with production environment
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup (run once)
pm2 startup
```

---

## 📋 **Required Configuration Updates**

### 🔐 **Security Settings (CRITICAL)**
| Variable | Purpose | Example |
|----------|---------|---------|
| `JWT_SECRET` | JWT token signing | `super-secure-secret-64-chars-minimum-change-this-now-abc123` |
| `ENCRYPTION_KEY` | API password encryption | `dd66e9221074e37...` (from setup script) |

### 🌐 **Network Settings**
| Variable | Purpose | Update Required |
|----------|---------|----------------|
| `REACT_APP_API_URL` | Frontend → Backend URL | ✅ Update to your server IP |
| `PORT` | Backend port | ⚠️ Default: 4000 |

### ⚡ **Performance Settings**
| Variable | Purpose | Value |
|----------|---------|-------|
| `GENERATE_SOURCEMAP` | React build optimization | `false` |
| `REACT_APP_DISABLE_DEVTOOLS` | Disable React DevTools | `true` |

---

## 🔒 **Security Checklist**

- [ ] ✅ Generated encryption key using setup script
- [ ] ✅ Set secure JWT_SECRET (64+ characters)
- [ ] ✅ Updated ENCRYPTION_KEY in ecosystem.config.js
- [ ] ✅ Updated REACT_APP_API_URL to production backend
- [ ] ✅ Verified no default/development secrets in production
- [ ] ✅ Database file permissions are secure
- [ ] ✅ Log files directory exists and is writable

---

## 📊 **Monitoring & Logs**

### View Application Status
```bash
pm2 status
pm2 logs network-backend
pm2 logs network-frontend
```

### Monitor Resources
```bash
pm2 monit
```

### Restart Services
```bash
# Restart specific service
pm2 restart network-backend
pm2 restart network-frontend

# Restart all
pm2 restart all
```

---

## 🚨 **Troubleshooting**

### "Failed to encrypt password" Error
1. Check if ENCRYPTION_KEY is set: `pm2 env 0`
2. Verify key format: `node diagnose_encryption_issue.js`
3. Restart backend: `pm2 restart network-backend`

### Frontend Cannot Connect to Backend
1. Check REACT_APP_API_URL in frontend environment
2. Verify backend is running: `pm2 status`
3. Test backend directly: `curl http://YOUR-SERVER:4000/health`

### High Memory Usage
1. Check memory usage: `pm2 monit`
2. Adjust max_memory_restart if needed
3. Consider using cluster mode for backend

---

## 🔄 **Updates & Maintenance**

### Update Application
```bash
# Pull latest code
git pull origin main

# Update dependencies
cd backend && npm install
cd ../frontend && npm install && npm run build

# Reload PM2 with zero downtime
pm2 reload ecosystem.config.js --env production
```

### Backup Before Updates
```bash
# Backup database
cp network_routes.db network_routes_backup_$(date +%Y%m%d).db

# Backup PM2 configuration
pm2 save
```

---

## 📝 **Example Complete Configuration**

```javascript
env_production: {
  NODE_ENV: 'production',
  PORT: 4000,
  JWT_SECRET: 'super-secure-jwt-secret-64-characters-minimum-change-this-production-key-abc123',
  ENCRYPTION_KEY: 'dd66e9221074e37176588cb8d4c85b19e1ec507335fdf86bded1754445583264'
}
```

Remember to replace the JWT_SECRET and ENCRYPTION_KEY with your actual secure values!
