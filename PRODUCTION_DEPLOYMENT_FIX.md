# 🚨 URGENT: Fix Production Memory Crashes (v3.3.3)

## Problem Summary

Your production server is **crashing due to memory exhaustion** because it's running the **development server** (`react-scripts start`) instead of serving a production build.

**Evidence from logs:**
```
FATAL ERROR: JavaScript heap out of memory
(node:4235) 898.6 MB -> crash
```

The Cesium library added in v3.3.3 requires more memory during webpack compilation, pushing the development server over the ~1GB Node.js heap limit.

---

## ⚡ Immediate Fix (Run on Your Server)

### Step 1: Stop PM2 Processes
```bash
cd /root/Core-Repository
pm2 stop all
```

### Step 2: Clean Cache and Build Production Frontend
```bash
# Clean caches
./cleanup-deployment.sh

# Or manually:
rm -rf frontend/node_modules/.cache
npm cache clean --force

# Build production frontend (this MUST be done once)
cd frontend
export NODE_OPTIONS="--max-old-space-size=2048"  # Increase memory for build
npm run build
cd ..
```

**Note:** The build process may take 2-3 minutes and will use more memory temporarily, but that's normal.

### Step 3: Install `serve` (if not already installed)
```bash
npm install -g serve
```

### Step 4: Update Your PM2 Configuration

**Share your `ecosystem.config.js` file** (redact secrets), but it should look like this:

```javascript
module.exports = {
  apps: [
    // Backend (this is probably correct already)
    {
      name: 'network-inventory-backend',
      script: './backend/index.js',
      cwd: '/root/Core-Repository',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        // ... your other env vars
      }
    },
    
    // Frontend (THIS NEEDS TO CHANGE)
    {
      name: 'network-inventory-frontend',
      script: 'serve',  // ← Use 'serve', NOT 'npm'
      cwd: '/root/Core-Repository/frontend',
      args: ['-s', 'build', '-l', '3000'],  // ← Serve the BUILD folder (MUST be array!)
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

**If your config currently has:**
- ❌ `script: 'npm'` with `args: 'start'` → **This is wrong!**
- ❌ `script: 'node_modules/.bin/react-scripts'` → **This is wrong!**

**It should be:**
- ✅ `script: 'serve'` with `args: ['-s', 'build', '-l', '3000']` (array format!)

### Step 5: Restart PM2
```bash
pm2 restart ecosystem.config.js
pm2 save
```

---

## 📊 Expected Results

**Before Fix:**
- Memory: ~900MB and crashing
- Startup time: 60-75 seconds before crash
- Status: Constantly restarting

**After Fix:**
- Memory: ~50-100MB (95% reduction!)
- Startup time: <1 second
- Status: Stable, no crashes

---

## 🔍 Verify It's Working

```bash
# Check PM2 status
pm2 status

# Check memory usage (should be <100MB for frontend)
pm2 monit

# Check logs (should be stable, no crashes)
pm2 logs network-inventory-frontend --lines 50
```

The frontend logs should show:
```
Serving static content from: build
Listening on port 3000
```

**NOT:**
```
Starting the development server...
FATAL ERROR: JavaScript heap out of memory
```

---

## 🎯 Why This Happened

### Development vs Production

| Aspect | Development (`npm start`) | Production (`serve build`) |
|--------|---------------------------|----------------------------|
| **Purpose** | Hot-reload for coding | Serve static files |
| **Memory** | 900MB+ | 50-100MB |
| **CPU** | High (constant compilation) | Minimal |
| **Startup** | 60+ seconds | <1 second |
| **Suitable for production?** | ❌ **NO** | ✅ **YES** |

### Why v3.3.3 Made It Worse

v3.3.3 added Cesium.js for the KMZ Viewer, which:
- Adds ~20MB of assets
- Requires more memory during webpack compilation
- Pushes development server over the memory limit
- **Production builds handle it fine** because the assets are pre-compiled

---

## 📝 Files Needed for Diagnosis

Please share (redact secrets):

1. **`ecosystem.config.js`** - Your PM2 configuration
2. **`frontend/package.json`** - Check build scripts
3. **Output of these commands:**
   ```bash
   pm2 status
   node --version
   npm --version
   free -h  # Check available server memory
   ```

---

## 🆘 Alternative: Increase Memory (Not Recommended)

If you absolutely must run the development server (not recommended), you can increase Node.js memory:

```javascript
// ecosystem.config.js - Frontend app
{
  name: 'network-inventory-frontend',
  script: 'npm',
  args: 'start',
  cwd: '/root/Core-Repository/frontend',
  node_args: '--max-old-space-size=2048',  // ← Increase to 2GB
  env: {
    NODE_OPTIONS: '--max-old-space-size=2048'
  }
}
```

**But this is wrong because:**
- Wastes 2GB of RAM unnecessarily
- Slower performance
- Not how production servers should work
- Still uses 20x more memory than production build

---

## ✅ Correct Production Architecture

```
┌─────────────────────────────────────────┐
│         Your Server (Linux)             │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  PM2 Process Manager             │   │
│  │                                   │   │
│  │  ┌──────────────────────────┐    │   │
│  │  │ Backend                   │   │   │
│  │  │ Node.js (backend/index.js)│   │   │
│  │  │ Port: 4000                │   │   │
│  │  │ Memory: ~150MB            │   │   │
│  │  └──────────────────────────┘    │   │
│  │                                   │   │
│  │  ┌──────────────────────────┐    │   │
│  │  │ Frontend                  │   │   │
│  │  │ serve -s build -l 3000    │   │   │
│  │  │ (Static file server)      │   │   │
│  │  │ Port: 3000                │   │   │
│  │  │ Memory: ~50MB             │   │   │
│  │  └──────────────────────────┘    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Total Memory: ~200MB (efficient!)     │
└─────────────────────────────────────────┘
```

---

## 📞 Next Steps

1. **Stop PM2 processes**
2. **Run cleanup script**
3. **Build production frontend** (`npm run build`)
4. **Share your ecosystem.config.js** (I'll fix it)
5. **Update PM2 config** to use `serve`
6. **Restart and verify**

**Please share:**
- Your `ecosystem.config.js` (redact secrets/paths if sensitive)
- Any other questions about the setup

This will fix your crashes permanently and reduce memory usage by 95%.

