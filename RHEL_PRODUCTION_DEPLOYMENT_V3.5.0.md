# Network Inventory v3.5.0 - RHEL 7 Production Deployment Guide

**✅ Updated for v3.5.0** - Supersedes `RHEL_PRODUCTION_DEPLOYMENT_V3.3.3.md`. Adds the Puppeteer/Chromium compatibility fix required for the new PDF Network Map Export feature; all other v3.3.3 guidance (Node 16, SQLite3, bcryptjs, Cesium, production frontend build, `serve`/PM2 setup) still applies unchanged.

---

## 🚨 **CRITICAL - Read This First**

### **v3.5.0 New Production Requirement: Puppeteer / Chromium on RHEL 7**

v3.5.0 added the **Network Routes → PDF Network Map Export** feature (`backend/networkMapRenderer.js`), which added a new backend dependency: **`puppeteer`**. This introduces **two separate RHEL-7-specific problems** that v3.3.3's guide never had to deal with:

1. **`puppeteer@23.x` (the version in `package.json` when this feature shipped) requires Node.js ≥18.** This guide still mandates **Node.js 16** for RHEL 7 (see below), so on Node 16 requiring `puppeteer` throws a **`SyntaxError`** the moment the backend loads `networkMapRenderer.js` — this is the "puppeteer-core syntax error on backend load" issue. **Fix:** `backend/package.json` now pins `"puppeteer": "21.11.0"` — the last Puppeteer release whose entire dependency chain (`puppeteer`, `puppeteer-core`, `@puppeteer/browsers`) declares `"engines": { "node": ">=16.13.2" } `, i.e. compatible with the Node 16.20.2 this guide installs. **Re-run `npm install` in `backend/` to pick this up.**

2. **Even with a Node-16-compatible Puppeteer, the Chromium binary it bundles/downloads ("Chrome for Testing") requires glibc ≥2.27.** RHEL 7 ships glibc **2.17**, so the bundled Chromium will fail to launch with an error like `` version `GLIBC_2.27' not found ``. This is unrelated to Node.js and cannot be fixed by any Puppeteer npm version — Chromium itself dropped support for glibc that old, and this host's limited yum access (no subscription, EPEL 7 archive-only) makes chasing an OS-native Chromium RPM's dependency chain unreliable. **Fix:** render PDFs via a small containerized sidecar with its own modern base image instead (Step 5c below), reached over HTTP via the `PDF_RENDER_SIDECAR_URL` environment variable. `networkMapRenderer.js` already supports this (falling back to a local Puppeteer launch, optionally via `PUPPETEER_EXECUTABLE_PATH`, when the sidecar isn't configured).

**⚠️ If you skip Steps 5b/5c, the backend may start fine but every "Export Network Map" request will fail (or the backend itself may fail to boot, if the Node-version fix in Step 5b wasn't applied).**

### **v3.3.3 Production Requirements (still apply)**

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

Node.js 18+ will NOT work on RHEL 7 due to glibc requirements — this is exactly why the v3.5.0 Puppeteer dependency had to be pinned back to a Node-16-compatible release instead of upgrading Node itself.

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

# Download v3.5.0
wget https://github.com/YOUR_USERNAME/YOUR_REPO/archive/refs/heads/v3.5.0.zip -O Core-Repository.zip

# Unzip
unzip Core-Repository.zip
mv YOUR_REPO-v3.5.0 Core-Repository

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
# NOTE: package.json pins "puppeteer": "21.11.0" (Node 16-compatible).
# Do NOT `npm install puppeteer@latest` - later majors require Node 18+ and
# will reintroduce the syntax error on this server.
npm install

# If npm install fails:
npm install --no-optional

# Install adm-zip (required for KMZ file parsing in Carrier Quote Repository)
npm install adm-zip

# Install which-country (required for KMZ route country detection in Carrier Quote Repository)
npm install which-country

# Install all-the-cities (required for KMZ transit city detection in Carrier Quote Repository)
npm install all-the-cities

# Initialize database (first time only)
node init_db.js

# Test backend
node index.js
# Should start without errors on port 4000
# Press Ctrl+C to stop
```

### **🚨🆕 Step 5b: Puppeteer Node-version fix (REQUIRED for v3.5.0)**

```bash
cd /root/Core-Repository/backend

# Force a clean reinstall from the pinned lockfile whenever package.json /
# package-lock.json / node_modules may be out of sync with the repo (e.g.
# right after transferring updated files to this server):
rm -rf node_modules
PUPPETEER_SKIP_DOWNLOAD=true npm ci
npm list puppeteer puppeteer-core @puppeteer/browsers
# Expect: puppeteer@21.11.0, puppeteer-core@21.11.0, @puppeteer/browsers@1.9.1
# If this still shows a v22+/v23 version, package.json on this server wasn't
# actually updated - re-copy it from the repo before continuing.

node index.js
# Should start cleanly now with no SyntaxError. Ctrl+C to stop.
```

### **🚨🆕 Step 5c: PDF-render sidecar container (REQUIRED for v3.5.0 PDF Network Map Export)**

Even with the Node fix above, the Chromium binary Puppeteer bundles/downloads requires glibc ≥2.27, and RHEL 7 only has glibc 2.17 — **no puppeteer npm version fixes this**, since it's the Chromium binary itself that's incompatible, not the Node.js package. This RHEL 7 host also has limited package-channel access (no subscription registered, EPEL 7 is archive-only, some third-party mirrors are dead), so chasing an OS-native `chromium-headless` RPM and its transitive dependencies (`libFLAC`, `libopus`, `libatomic`, ...) tends to cascade indefinitely.

Instead, `backend/pdf-render-sidecar/` is a small standalone rendering service that runs in a container with its **own modern base image** (unaffected by the host's ancient glibc). The main backend calls it over a local HTTP port instead of launching Chromium itself, controlled by the `PDF_RENDER_SIDECAR_URL` env var (already wired into `backend/networkMapRenderer.js` and `ecosystem.config.js`).

```bash
# 1. Install Docker CE (last release line still packaged for EL7)
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl enable --now docker
docker --version

# 2. Build the sidecar image (pulls ghcr.io/puppeteer/puppeteer, which already
#    bundles a working Chromium + all its shared-library dependencies - nothing
#    to resolve against this host's yum repos)
cd /root/Core-Repository/backend/pdf-render-sidecar
docker build -t network-inventory-pdf-sidecar .

# 3. Run it, bound to localhost only (never expose this port externally)
docker run -d --name pdf-sidecar --restart unless-stopped \
  -p 127.0.0.1:5051:5051 \
  network-inventory-pdf-sidecar

# 4. Verify it's up
curl http://127.0.0.1:5051/health
# Should return: {"status":"ok"}
```

`ecosystem.config.js` already sets `PDF_RENDER_SIDECAR_URL: 'http://127.0.0.1:5051'` on `network-backend`'s env — restart PM2 to pick it up:

```bash
cd /root/Core-Repository
pm2 restart network-backend
```

`--restart unless-stopped` makes Docker itself bring the container back up after a reboot (as long as the `docker` service is enabled, which Step 1 above already did via `systemctl enable`) — no separate systemd unit needed.

**Alternative (not recommended unless Docker is unavailable):** it's still possible to install an OS-native `chromium-headless` RPM from EPEL and set `PUPPETEER_EXECUTABLE_PATH` instead of `PDF_RENDER_SIDECAR_URL` — `networkMapRenderer.js` supports both. In practice this tends to hit missing `libFLAC.so.8` / `libopus.so.0` (normally from RPMFusion, since EPEL avoids codec libs) and `libatomic.so.1` (normally from RHEL's subscription-gated "optional" channel) with no guarantee it stops there, which is why the container approach above is the primary path in this guide.

---

## 🌐 **Step 6: Frontend Setup (PRODUCTION BUILD)**

### **⚠️ CRITICAL: This is Different from v3.3.2**

v3.3.3+ **MUST** use production builds. The development server will crash.

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

**⚠️ This step is CRITICAL**

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

### **📄 Create serve.json Configuration (REQUIRED)**

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

## 🚀 **Step 7: Configure PM2 (Updated for v3.5.0)**

### **✅ Correct ecosystem.config.js for v3.5.0**

```bash
cd /root/Core-Repository

# Backup existing config if upgrading
if [ -f ecosystem.config.js ]; then
    cp ecosystem.config.js ecosystem.config.js.backup
fi

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
        ENCRYPTION_KEY: 'your-encryption-key-here',
        // v3.5.0: PDF Network Map Export renders via the containerized sidecar
        // from Step 5c instead of launching Chromium natively (RHEL 7's glibc
        // 2.17 can't run the Chrome build Puppeteer needs). Leave unset to fall
        // back to a local Puppeteer launch (e.g. non-RHEL7 hosts).
        PDF_RENDER_SIDECAR_URL: 'http://127.0.0.1:5051'
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

# PDF_RENDER_SIDECAR_URL above assumes the sidecar container from Step 5c is
# running and bound to 127.0.0.1:5051 - update if you used a different port.
```

**❌ WRONG (development server - will crash):**
```javascript
{
  script: 'npm',
  args: 'start',
}
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
# View backend logs
pm2 logs network-backend --lines 30
# Should NOT see: "SyntaxError" from puppeteer/puppeteer-core

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

### **Test PDF Network Map Export (v3.5.0)**
```bash
# Confirm the sidecar container is up first:
docker ps --filter name=pdf-sidecar
curl http://127.0.0.1:5051/health
# Should return: {"status":"ok"}

# From the frontend, log in and go to Network Routes Repository, then click
# "Export Network Map" for any region. If it fails, check:
pm2 logs network-backend --err --lines 50
docker logs pdf-sidecar --tail 50
# ECONNREFUSED to 127.0.0.1:5051 -> sidecar container isn't running; `docker ps`
#   and `docker start pdf-sidecar` / re-run Step 5c
# Timeout -> a very large export (many pages) may need PDF_RENDER_SIDECAR_TIMEOUT_MS
#   raised in ecosystem.config.js (default 120000ms)
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

### **🚨🆕 "SyntaxError" When Backend Loads (`puppeteer`/`puppeteer-core`)**

**Problem:** `pm2 logs network-backend` shows a `SyntaxError` pointing into `node_modules/puppeteer-core` or `node_modules/@puppeteer/browsers`, right after startup (often as soon as any route requiring `networkMapRenderer.js` is hit, or immediately if it's required eagerly).

**Cause:** `puppeteer` was installed at a version (v22+, e.g. the `^23.11.1` that originally shipped with the PDF Network Map Export feature) whose dependency chain requires **Node.js ≥18**. This RHEL 7 server runs Node 16 (required because of glibc 2.17), and Node 16's V8 cannot parse syntax used by newer Puppeteer releases.

**Solution:**
```bash
cd /root/Core-Repository/backend

# Confirm the pinned version in package.json
grep '"puppeteer"' package.json
# Should show: "puppeteer": "21.11.0"   (NOT ^23.x or "latest")

# If it shows a newer version, fix it and reinstall:
npm install puppeteer@21.11.0 puppeteer-core@21.11.0 --save-exact
node --version  # confirm still 16.x

pm2 restart network-backend
```

### **🚨🆕 PDF Export Fails: `version 'GLIBC_2.27' not found`**

**Problem:** The backend starts fine, but "Export Network Map" fails, and `pm2 logs network-backend --err` shows a glibc version error referencing `libm.so.6` / `libc.so.6` and Chromium/`headless_shell`.

**Cause:** Puppeteer's bundled "Chrome for Testing" binary requires glibc ≥2.27. RHEL 7 only has glibc 2.17 — no Puppeteer npm version fixes this, since it's the Chromium binary itself, not the Node.js package, that's incompatible. This almost always means `PDF_RENDER_SIDECAR_URL` isn't set (or the sidecar container isn't running), so `networkMapRenderer.js` fell back to launching a local Puppeteer browser.

**Solution:**
```bash
# Confirm the sidecar is actually running:
docker ps --filter name=pdf-sidecar
curl http://127.0.0.1:5051/health

# Confirm ecosystem.config.js has the URL set for network-backend:
grep -A1 PDF_RENDER_SIDECAR_URL /root/Core-Repository/ecosystem.config.js

# If either is missing, redo Step 5c, then:
pm2 restart network-backend
```
See **Step 5c** for the full container setup. Chasing an OS-native `chromium-headless` RPM instead is possible but not recommended on this host — see the "Alternative" note in Step 5c.

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
# 5. (Backend) puppeteer SyntaxError / GLIBC error → see the two new
#    troubleshooting entries above
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

### **v3.3.3+ (Production Build)**
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

# Re-check backend puppeteer pin didn't get bumped by a fresh npm install
cd ../backend
grep '"puppeteer"' package.json   # must stay 21.11.0 on this host

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
- [ ] `backend/package.json` has `"puppeteer": "21.11.0"` (NOT ^23.x/latest)
- [ ] `PUPPETEER_SKIP_DOWNLOAD=true` used so no incompatible bundled Chromium was downloaded
- [ ] Docker CE installed and enabled (`systemctl enable --now docker`)
- [ ] `pdf-render-sidecar` image built and running (`docker ps` shows `pdf-sidecar`, `curl http://127.0.0.1:5051/health` returns ok)
- [ ] `PDF_RENDER_SIDECAR_URL` set in `ecosystem.config.js` backend env
- [ ] Backend logs show no `SyntaxError` referencing puppeteer/puppeteer-core
- [ ] "Export Network Map" produces a downloadable PDF (not a 500 error)
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

If all checks pass, your Network Inventory v3.5.0 is successfully deployed!

**Access your application:**
- Frontend: `http://YOUR_SERVER_IP:3000`
- Backend API: `http://YOUR_SERVER_IP:4000`
- Default login: `admin` / `admin123`

**Key Differences from v3.3.3:**
1. ✅ `backend/package.json` pins `puppeteer@21.11.0` for Node 16 compatibility (newer Puppeteer requires Node 18+)
2. ✅ PDF Network Map Export renders via a Docker-based `pdf-render-sidecar` container (own modern glibc) called over `PDF_RENDER_SIDECAR_URL`, instead of launching Chromium natively (bundled Chrome-for-Testing needs glibc ≥2.27, RHEL 7 has 2.17)
3. ✅ Everything else (Node 16, SQLite3 5.0.2, bcryptjs, Cesium, production frontend build, `serve`/PM2) is unchanged from v3.3.3

**Next Steps:**
- Change default admin password
- Configure firewall rules
- Set up SSL/TLS (if exposing to internet)
- Configure backups
- Add monitoring/alerting

---

**Documentation Version:** v3.5.0
**Last Updated:** August 9, 2026
**Tested On:** RHEL 7.9, Node.js 16.20.2
**Supersedes:** `RHEL_PRODUCTION_DEPLOYMENT_V3.3.3.md`
