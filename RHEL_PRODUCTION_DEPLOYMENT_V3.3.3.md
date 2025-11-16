# Network Inventory v3.3.3 - RHEL 7 Production Deployment Guide

**✅ Updated for v3.3.3** - Includes production build fixes, Cesium setup, and memory optimization

---

## 🚨 **CRITICAL - Read This First**

### **v3.3.3 Production Requirements**

Version 3.3.3 introduced Cesium.js for the KMZ 3D Globe Viewer, which requires:

1. **Production builds ONLY** - Development server (`npm start`) will crash due to memory limits
2. **`serve` package** - To serve the production build
3. **`serve.json` configuration** - For proper React SPA routing
4. **2GB temporary memory** - For the one-time build process (uses ~50MB after deployed)
5. **Updated ecosystem.config.js** - Using `npx serve` instead of `npm start`

**⚠️ If you run `npm start` in production, the frontend will crash with "JavaScript heap out of memory"**

---

## 📋 **Pre-Deployment Checklist**

```bash
# Check RHEL version
cat /etc/redhat-release
# Required: Red Hat Enterprise Linux Server release 7.6+

# Check available memory  
free -h
# Minimum: 4GB total (need 2GB for build, then only ~200MB for running)

# Check available disk space
df -h /root
# Minimum: 15GB free (includes build artifacts and Cesium assets)

# Check glibc version
ldd --version
# Expected: glibc 2.17 (RHEL 7 default)
```

---

## 📦 **Step 1: System Dependencies**

### **Enable Required Repositories**
```bash
# Enable EPEL
sudo yum install -y epel-release

# Update package cache
sudo yum update -y
```

### **Install Build Tools**
```bash
# Install essential development tools
sudo yum install -y \
    make \
    gcc \
    gcc-c++ \
    autoconf \
    automake \
    libtool \
    python-devel \
    openssl-devel \
    sqlite-devel \
    curl \
    wget \
    unzip \
    tar

# Verify
gcc --version
make --version
```

---

## 🟢 **Step 2: Node.js Installation**

### **⚠️ Use Node.js 16 (RHEL 7 Compatible)**

Node.js 18+ will NOT work on RHEL 7 due to glibc requirements.

```bash
# Download Node.js 16 LTS
cd /tmp
wget https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz

# Extract to /opt
sudo mkdir -p /opt/nodejs
sudo tar -xJf node-v16.20.2-linux-x64.tar.xz -C /opt/nodejs --strip-components=1

# Add to PATH
echo 'export PATH=/opt/nodejs/bin:$PATH' | sudo tee -a /etc/profile
source /etc/profile

# Verify
node --version  # Should show v16.20.2
npm --version   # Should show 8.x.x
```

---

## 📁 **Step 3: Application Deployment**

### **Method A: Download from Git (Recommended)**

```bash
# Stop existing PM2 processes (if upgrading)
pm2 stop all
pm2 delete all

# Backup existing installation (if upgrading)
cd /root
if [ -d "Core-Repository" ]; then
    mv Core-Repository Core-Repository.backup.$(date +%Y%m%d)
fi

# Download v3.3.3
wget https://github.com/YOUR_USERNAME/YOUR_REPO/archive/refs/heads/v3.3.3.zip -O Core-Repository.zip

# Unzip
unzip Core-Repository.zip
mv YOUR_REPO-v3.3.3 Core-Repository

cd Core-Repository

# If upgrading, restore important files:
# cp ../Core-Repository.backup.*/network_routes.db ./
# cp ../Core-Repository.backup.*/backend/kmz_files/*.kmz backend/kmz_files/
# cp ../Core-Repository.backup.*/backend/templates/*.kmz backend/templates/
```

### **Method B: Manual File Transfer**
```bash
# Create directory
sudo mkdir -p /root/Core-Repository
cd /root/Core-Repository

# Transfer files via SCP from your development machine:
# scp -r Core-Repository/ root@server-ip:/root/
```

---

## 🔧 **Step 4: Critical Dependency Fixes**

### **🚨 SQLite3 Version Fix (REQUIRED)**

```bash
cd /root/Core-Repository/backend

# Remove any existing SQLite3
rm -rf node_modules/sqlite3 package-lock.json
npm uninstall sqlite3

# Install specific RHEL 7 compatible version
npm install sqlite3@5.0.2

# Verify
npm list sqlite3
# Should show: sqlite3@5.0.2
```

### **🚨 bcrypt to bcryptjs Migration (REQUIRED)**

```bash
cd /root/Core-Repository/backend

# Remove bcrypt
npm uninstall bcrypt

# Install bcryptjs (pure JavaScript, no native compilation)
npm install bcryptjs

# Update auth.js to use bcryptjs
sed -i "s/require('bcrypt')/require('bcryptjs')/g" auth.js

# Verify
grep "bcryptjs" auth.js
# Should show: const bcrypt = require('bcryptjs');
```

---

## 🏗️ **Step 5: Backend Setup**

```bash
cd /root/Core-Repository/backend

# Install dependencies
npm install

# If npm install fails:
npm install --no-optional

# Initialize database (first time only)
node init_db.js

# Test backend
node index.js
# Should start without errors on port 4000
# Press Ctrl+C to stop
```

---

## 🌐 **Step 6: Frontend Setup (PRODUCTION BUILD)**

### **⚠️ CRITICAL: This is Different from v3.3.2**

v3.3.3 **MUST** use production builds. The development server will crash.

```bash
cd /root/Core-Repository/frontend

# Install dependencies
npm install

# If memory issues during install:
npm install --max-old-space-size=2048

# Create environment configuration
# Replace SERVER_IP with your actual server IP
echo "REACT_APP_API_URL=http://SERVER_IP:4000" > .env

# Example:
# echo "REACT_APP_API_URL=http://172.30.252.118:4000" > .env
```

### **🗺️ Setup Cesium Assets (Required for KMZ Viewer)**

```bash
cd /root/Core-Repository/frontend

# Make setup script executable
chmod +x setup-cesium.sh

# Run Cesium setup (copies ~50MB of assets)
./setup-cesium.sh

# Verify Cesium assets were copied
ls -lh public/cesium/
# Should show ~387 files including Workers/, Assets/, Widgets/

du -sh public/cesium/
# Should show approximately 20-50MB
```

### **🏗️ Build Production Frontend (REQUIRED)**

**⚠️ This step is NEW for v3.3.3 and is CRITICAL**

```bash
cd /root/Core-Repository/frontend

# Increase Node memory limit for build process ONLY
export NODE_OPTIONS="--max-old-space-size=2048"

# Build production version (takes 2-3 minutes)
npm run build

# Verify build was successful
ls -lh build/
# Should show index.html, static/, cesium/, etc.

# Check index.html exists and is >1KB
ls -lh build/index.html
# Should show a file >1KB (typically 3-5KB)

# Unset memory limit (not needed after build)
unset NODE_OPTIONS
```

### **📄 Create serve.json Configuration (REQUIRED for v3.3.3)**

**⚠️ This file is CRITICAL - without it, you'll see directory listings instead of the app**

```bash
cd /root/Core-Repository/frontend

# Create serve.json configuration file
cat > serve.json << 'EOF'
{
  "public": "build",
  "rewrites": [
    { "source": "**", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "**",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    },
    {
      "source": "static/**",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "directoryListing": false,
  "cleanUrls": false,
  "trailingSlash": false
}
EOF

# Verify file was created
cat serve.json
```

### **📦 Install serve Package (Required)**

```bash
# Install serve globally (used by PM2 to serve the production build)
npm install -g serve

# Verify installation
serve --version
# Should show version 14.x.x or similar

# Test serving manually (optional verification)
cd /root/Core-Repository/frontend
serve -p 3000
# Should show: "Accepting connections at http://localhost:3000"
# Press Ctrl+C to stop
# Open http://SERVER_IP:3000 in browser - should see login page
```

---

## 🚀 **Step 7: Configure PM2 (Updated for v3.3.3)**

### **⚠️ ecosystem.config.js Changes**

Your `ecosystem.config.js` should look like this for v3.3.3:

```bash
cd /root/Core-Repository

# Backup existing config if upgrading
if [ -f ecosystem.config.js ]; then
    cp ecosystem.config.js ecosystem.config.js.backup
fi

# Verify your ecosystem.config.js has the correct frontend configuration
cat ecosystem.config.js
```

**The frontend section MUST have:**
```javascript
{
  name: 'network-frontend',
  cwd: './frontend',
  script: 'npx',  // ← Uses npx to run serve
  args: ['serve', '-p', '3000', '--no-clipboard'],  // ← Serves production build
  // ... other settings
}
```

**❌ WRONG (v3.3.2 and earlier - will crash):**
```javascript
{
  script: 'npm',
  args: 'start',  // ← Development server, crashes with v3.3.3
}
```

### **✅ Correct ecosystem.config.js for v3.3.3**

If your file doesn't match, here's the complete correct version:

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'network-backend',
      cwd: './backend',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        JWT_SECRET: 'your-super-secure-jwt-secret-change-this-in-production',
        ENCRYPTION_KEY: 'your-encryption-key-here'
      },
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      log_file: './logs/backend-combined.log',
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
      kill_timeout: 5000,
      merge_logs: true,
      time: true
    },
    {
      name: 'network-frontend',
      cwd: './frontend',
      script: 'npx',
      args: ['serve', '-p', '3000', '--no-clipboard'],
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        REACT_APP_API_URL: 'http://YOUR_SERVER_IP:4000'
      },
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      log_file: './logs/frontend-combined.log',
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
      kill_timeout: 5000,
      merge_logs: true,
      time: true
    }
  ]
};
EOF

# Replace YOUR_SERVER_IP with actual IP
sed -i 's/YOUR_SERVER_IP/172.30.252.118/g' ecosystem.config.js
```

---

## 🚀 **Step 8: Start with PM2**

```bash
cd /root/Core-Repository

# Create logs directory
mkdir -p logs

# Install PM2 if not already installed
npm install -g pm2

# Start applications with production environment
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup auto-startup on server reboot
pm2 startup
# Run the command it outputs (usually starts with 'sudo env PATH=...')

# Check status
pm2 list
```

### **✅ Expected PM2 Status**

```
┌─────┬──────────────────┬─────────┬──────┬────────┬─────────┬────────┐
│ id  │ name             │ status  │ cpu  │ memory │ restart │ uptime │
├─────┼──────────────────┼─────────┼──────┼────────┼─────────┼────────┤
│ 0   │ network-backend  │ online  │ 0%   │ 150MB  │ 0       │ 10s    │
│ 1   │ network-frontend │ online  │ 0%   │ 50MB   │ 0       │ 10s    │
└─────┴──────────────────┴─────────┴──────┴────────┴─────────┴────────┘
```

**Key indicators of success:**
- ✅ Both processes show "online"
- ✅ Frontend memory: ~50MB (NOT ~900MB)
- ✅ Restarts: 0 (not constantly restarting)
- ✅ Uptime: Stable and increasing

---

## 🔍 **Step 9: Verification & Testing**

### **Check Logs**
```bash
# View frontend logs
pm2 logs network-frontend --lines 30

# Should see:
# "INFO: Accepting connections at http://localhost:3000"
# 
# Should NOT see:
# "FATAL ERROR: JavaScript heap out of memory"
# "Starting the development server..."
# "getaddrinfo ENOTFOUND -l"
```

### **Test Backend**
```bash
curl http://localhost:4000/health
# Should return: {"status":"ok"}
```

### **Test Frontend**
```bash
curl -I http://localhost:3000/
# Should return: HTTP/1.1 200 OK
# Content-Type: text/html

# Check actual content
curl http://localhost:3000/ | head -20
# Should show HTML starting with: <!DOCTYPE html>
```

### **Test in Browser**

1. Open: `http://YOUR_SERVER_IP:3000`
2. Should see login page
3. Login with default credentials: `admin` / `admin123`
4. Navigate to **Network Routes Repository** → **KMZ Viewer**
5. Should see 3D globe (not errors about missing files)

---

## 🛠️ **Troubleshooting**

### **🚨 Frontend Crashes with "heap out of memory"**

**Problem:** Logs show `FATAL ERROR: JavaScript heap out of memory`

**Cause:** Using `npm start` instead of production build

**Solution:**
```bash
# Check your ecosystem.config.js
cd /root/Core-Repository
grep "script.*args" ecosystem.config.js

# Should show:
# script: 'npx',
# args: ['serve', '-p', '3000', '--no-clipboard'],

# If it shows 'npm' and 'start', update it:
pm2 stop all
# Fix ecosystem.config.js (see Step 7)
pm2 start ecosystem.config.js --env production
```

### **🚨 Frontend Shows Directory Listing (build/cesium)**

**Problem:** Browser shows folder structure instead of the app

**Cause:** Missing `serve.json` configuration

**Solution:**
```bash
cd /root/Core-Repository/frontend

# Create serve.json (see Step 6)
cat > serve.json << 'EOF'
{
  "public": "build",
  "rewrites": [{ "source": "**", "destination": "/index.html" }],
  "directoryListing": false
}
EOF

# Restart frontend
pm2 restart network-frontend
```

### **🚨 "getaddrinfo ENOTFOUND -l" Error**

**Problem:** PM2 logs show DNS lookup errors for "-l"

**Cause:** Incorrect args format in ecosystem.config.js

**Solution:**
```bash
# Check args format
cd /root/Core-Repository
grep "args:" ecosystem.config.js

# MUST be array format:
# args: ['serve', '-p', '3000', '--no-clipboard'],

# NOT string format:
# args: '-s build -p 3000',  ← WRONG

# If wrong, fix it (see Step 7) and restart
pm2 restart ecosystem.config.js
```

### **🚨 Cesium Globe is Black/Empty**

**Problem:** KMZ Viewer loads but shows black globe

**Cause:** Cesium assets not copied to public folder

**Solution:**
```bash
cd /root/Core-Repository/frontend

# Check if assets exist
ls public/cesium/Assets/Textures/
# Should show: NaturalEarthII/

# If missing, run setup
./setup-cesium.sh

# Rebuild frontend
npm run build

# Restart
pm2 restart network-frontend
```

### **🚨 "Not allowed to load local resource" Errors**

**Problem:** Browser console shows file:// errors for Cesium

**Cause:** Cesium trying to load from wrong path

**Solution:**
```bash
cd /root/Core-Repository/frontend

# Verify Cesium assets are in build folder
ls build/cesium/Workers/
# Should show many .js files

# If missing, ensure setup ran before build:
./setup-cesium.sh
npm run build
pm2 restart network-frontend
```

### **🚨 PM2 Process Keeps Restarting**

**Problem:** `pm2 list` shows many restarts

**Cause:** Application crashes on startup

**Solution:**
```bash
# Check error logs
pm2 logs network-frontend --err --lines 50

# Common issues:
# 1. Missing build folder → Run: cd frontend && npm run build
# 2. Wrong node version → Check: node --version (should be 16.x)
# 3. Missing dependencies → Run: cd frontend && npm install
# 4. Port conflict → Check: netstat -tulpn | grep 3000
```

### **🚨 Build Process Fails with Memory Error**

**Problem:** `npm run build` fails with heap out of memory

**Solution:**
```bash
cd /root/Core-Repository/frontend

# Increase memory for build process
export NODE_OPTIONS="--max-old-space-size=2048"
npm run build

# If still fails, try 4GB:
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

# After build completes:
unset NODE_OPTIONS
```

---

## 📊 **Performance Benchmarks**

### **v3.3.2 (Development Server)**
- Frontend memory: ~900MB → Crashes
- Startup time: 60-75 seconds
- CPU: High (constant compilation)
- Status: Unstable, restart loops

### **v3.3.3 (Production Build)**
- Frontend memory: ~50MB (95% reduction!)
- Startup time: <1 second
- CPU: Minimal
- Status: Stable

---

## 🔒 **Security Configuration**

### **Configure Firewall**
```bash
# Allow ports
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=4000/tcp
sudo firewall-cmd --reload

# Verify
sudo firewall-cmd --list-ports
```

### **Update JWT Secret**
```bash
# Edit ecosystem.config.js
nano ecosystem.config.js

# Change:
JWT_SECRET: 'your-super-secure-jwt-secret-change-this-in-production'
# To a long random string

# Restart backend
pm2 restart network-backend
```

---

## 📞 **Monitoring & Maintenance**

### **Daily Monitoring**
```bash
# Check status
pm2 list

# Check resource usage
pm2 monit

# View logs
pm2 logs --lines 50
```

### **Database Backup**
```bash
# Backup database
cd /root/Core-Repository
cp network_routes.db backups/network_routes.db.$(date +%Y%m%d)

# Check integrity
sqlite3 network_routes.db "PRAGMA integrity_check;"
```

### **Update Application**
```bash
# Stop PM2
pm2 stop all

# Backup
cd /root
cp -r Core-Repository Core-Repository.backup.$(date +%Y%m%d)

# Download new version
# ... (repeat Step 3)

# Restore data
cp Core-Repository.backup.*/network_routes.db Core-Repository/

# Rebuild frontend
cd Core-Repository/frontend
npm run build

# Restart
pm2 start ecosystem.config.js --env production
pm2 save
```

---

## ✅ **Success Checklist**

- [ ] Node.js 16.x installed
- [ ] SQLite3 5.0.2 installed
- [ ] bcryptjs (not bcrypt) installed
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed
- [ ] Cesium assets copied to `frontend/public/cesium/` (~387 files, 20-50MB)
- [ ] `frontend/serve.json` configuration file created
- [ ] Production build completed successfully (`frontend/build/` folder exists)
- [ ] `frontend/build/index.html` exists and is >1KB
- [ ] `serve` package installed globally
- [ ] `ecosystem.config.js` uses `npx serve` (NOT `npm start`)
- [ ] PM2 processes show "online" status
- [ ] Frontend memory ~50MB (NOT ~900MB)
- [ ] No restarts in PM2 list
- [ ] `curl http://localhost:3000/` returns HTML (not directory listing)
- [ ] Can login at `http://SERVER_IP:3000`
- [ ] KMZ Viewer shows 3D globe (no console errors)
- [ ] Backend health check returns OK: `curl http://localhost:4000/health`

---

## 🎉 **Deployment Complete!**

If all checks pass, your Network Inventory v3.3.3 is successfully deployed!

**Access your application:**
- Frontend: `http://YOUR_SERVER_IP:3000`
- Backend API: `http://YOUR_SERVER_IP:4000`
- Default login: `admin` / `admin123`

**Key Differences from v3.3.2:**
1. ✅ Production build required (not `npm start`)
2. ✅ `serve.json` configuration file
3. ✅ Updated `ecosystem.config.js` using `npx serve`
4. ✅ 95% less memory usage
5. ✅ Instant startup (not 60+ seconds)
6. ✅ Stable operation (no crashes)

**Next Steps:**
- Change default admin password
- Configure firewall rules
- Set up SSL/TLS (if exposing to internet)
- Configure backups
- Add monitoring/alerting

---

**Documentation Version:** v3.3.3  
**Last Updated:** November 16, 2024  
**Tested On:** RHEL 7.9, Node.js 16.20.2

