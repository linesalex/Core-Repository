# Frontend Update Guide - Build on Windows, Deploy to Server

This guide explains how to update the frontend application when your server has limited memory (< 2GB).

**Solution:** Build the frontend on your Windows PC (which has more RAM), then transfer the compiled files to the server.

---

## 📋 **Why This Approach?**

- **Server Issue:** Building React apps with Cesium.js requires 2-4GB of RAM
- **Your Server:** Only has ~1.4GB available memory
- **Solution:** Build files are platform-independent - build on Windows, deploy to Linux
- **Benefit:** Faster, more reliable, and mirrors production deployment best practices

---

## ✅ **Step-by-Step Process**

### **Step 1: Build on Your Windows PC**

Open PowerShell or Command Prompt in your project root directory:

```powershell
# Navigate to frontend directory
cd frontend

# Clean cache and old build (important!)
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue

# Install dependencies (if needed)
# npm install

# Build the production bundle
npm run build
```

**Expected Output:**
```
Creating an optimized production build...
Compiled successfully!

File sizes after gzip:
  XXX KB  build/static/js/main.XXXXX.js
  XXX KB  build/static/css/main.XXXXX.css
  ...

The build folder is ready to be deployed.
```

**Build Time:** 2-5 minutes (depending on your PC)

**Build Location:** `frontend/build/` directory

---

### **Step 2: Transfer Build Files to Server**

Choose one of the following methods:

#### **Option A: Using SCP (Secure Copy) - Fastest**

```powershell
# From your Windows PC (in project root directory)
# Replace 'username' with your server username
# Replace 'your-server-ip' with your server IP address

scp -r frontend\build username@your-server-ip:/root/Core-Repository/frontend/
```

**Example:**
```powershell
scp -r frontend\build root@172.30.252.118:/root/Core-Repository/frontend/
```

---

#### **Option B: Using SFTP Client (WinSCP, FileZilla) - Most Visual**

1. **Open WinSCP or FileZilla**
2. **Connect to your server:**
   - Protocol: SFTP
   - Host: Your server IP
   - Username: root (or your username)
   - Password: Your server password

3. **Navigate to:** `/root/Core-Repository/frontend/`

4. **Delete old build folder** on server (right-click → Delete)

5. **Upload new build folder:**
   - Drag and drop `frontend\build` from Windows PC to server
   - Or right-click → Upload

---

#### **Option C: Manual Zip & Upload - Most Compatible**

**On Windows:**
```powershell
# Compress the build folder
Compress-Archive -Path frontend\build -DestinationPath build.zip
```

**Upload `build.zip` to your server** (using any method - SFTP, web interface, etc.)

**On Server:**
```bash
# Navigate to frontend directory
cd /root/Core-Repository/frontend

# Remove old build
rm -rf build

# Extract new build
unzip ~/build.zip

# Clean up zip file
rm ~/build.zip
```

---

### **Step 3: Restart Frontend Service on Server**

```bash
# On your server (via SSH)
cd /root/Core-Repository

# Restart the frontend PM2 process
pm2 restart frontend

# Verify it's running
pm2 status

# Check logs for any issues
pm2 logs frontend --lines 20
```

**Expected Output:**
```
┌─────┬────────────┬─────────────┬─────────┬─────────┬──────────┐
│ id  │ name       │ mode        │ ↺       │ status  │ cpu      │
├─────┼────────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0   │ frontend   │ fork        │ 5       │ online  │ 0%       │
│ 1   │ backend    │ fork        │ 2       │ online  │ 0.3%     │
└─────┴────────────┴─────────────┴─────────┴─────────┴──────────┘
```

---

### **Step 4: Verify Deployment**

1. **Open your browser**
2. **Navigate to:** `http://your-server-ip:3000`
3. **Hard refresh to clear cache:** `Ctrl + Shift + R` (Windows) or `Ctrl + F5`
4. **Verify new features are working:**
   - Check KMZ Viewer (should be 2D flat map now)
   - Check location pins are in correct positions
   - Check labels only appear when zoomed in

---

## 📁 **What Gets Transferred?**

The `frontend/build/` directory contains:

```
build/
├── index.html              ← Main HTML file (entry point)
├── static/
│   ├── css/               ← Compiled stylesheets
│   ├── js/                ← Compiled JavaScript bundles
│   └── media/             ← Images, fonts, icons
├── cesium/                ← Cesium 3D library assets
├── serve.json             ← Configuration for serve
└── manifest.json          ← Web app manifest
```

**Total Size:** Approximately 50-100MB (much smaller than source code + node_modules)

---

## 🔄 **Quick Update Workflow (For Future Changes)**

When you make code changes and need to deploy:

### **On Windows PC:**
```powershell
cd frontend
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue
npm run build
scp -r build root@your-server-ip:/root/Core-Repository/frontend/
```

### **On Server:**
```bash
pm2 restart frontend
```

**That's it!** The entire update takes 2-5 minutes.

---

## ⚠️ **Important Notes**

### **Build Requirements:**
- ✅ **Windows PC:** Must have latest code from repository
- ✅ **Node.js:** Must be installed on Windows PC (same major version as server)
- ✅ **Dependencies:** Run `npm install` in `frontend/` if `package.json` changed
- ✅ **Environment:** Build is production-optimized (minified, optimized)

### **What NOT to Transfer:**
- ❌ `node_modules/` - Not needed, server doesn't need dependencies
- ❌ `src/` - Source code not needed, only compiled build
- ❌ `.cache/` - Build cache, server doesn't need it
- ❌ `package.json` / `package-lock.json` - Not needed for deployment

### **Platform Independence:**
- ✅ Build files are **100% platform-independent**
- ✅ Works identically on Windows/Linux/Mac
- ✅ The `serve` package on server just serves static files
- ✅ No compilation or transpilation needed on server

---

## 🐛 **Troubleshooting**

### **Problem: Frontend shows old version after restart**

**Solution:** Hard refresh browser cache
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

### **Problem: PM2 fails to restart frontend**

**Solution:** Check PM2 logs
```bash
pm2 logs frontend --lines 50
pm2 describe frontend
```

**Common Issue:** `serve` not found
```bash
npm install -g serve
pm2 restart frontend
```

### **Problem: Build fails on Windows PC**

**Solution:** Check Node.js version and dependencies
```powershell
node --version  # Should be v16+ for React Scripts 5
cd frontend
npm install     # Reinstall dependencies
npm run build   # Try again
```

### **Problem: SCP command not found on Windows**

**Solutions:**
1. Install [Git for Windows](https://git-scm.com/download/win) (includes SCP)
2. Use PuTTY's `pscp.exe` instead
3. Use WinSCP or FileZilla (GUI option)

### **Problem: 404 errors or blank page after deployment**

**Solution:** Check `serve.json` exists in build folder
```bash
# On server
cat /root/Core-Repository/frontend/build/serve.json

# Should show:
# {
#   "public": ".",
#   "rewrites": [
#     { "source": "**", "destination": "/index.html" }
#   ],
#   "directoryListing": false
# }
```

If missing, create it:
```bash
echo '{
  "public": ".",
  "rewrites": [
    { "source": "**", "destination": "/index.html" }
  ],
  "directoryListing": false
}' > /root/Core-Repository/frontend/build/serve.json

pm2 restart frontend
```

---

## 📝 **Version Tracking**

Keep track of deployed versions:

```bash
# On server - check current version
cat /root/Core-Repository/frontend/build/index.html | grep -o "v[0-9]*\.[0-9]*\.[0-9]*"

# Or check package.json
cat /root/Core-Repository/frontend/package.json | grep version
```

**Current Version:** v3.3.3

---

## 🚀 **Production Best Practices**

This workflow mirrors industry-standard deployment practices:

1. ✅ **Separate build and deploy environments** (build locally, deploy remotely)
2. ✅ **Build optimization** (production builds are minified and optimized)
3. ✅ **Reduced server load** (no compilation on production server)
4. ✅ **Faster deployments** (transfer 50-100MB vs. 500MB+ node_modules)
5. ✅ **Consistent builds** (same build works across all environments)

---

## 🔐 **Security Notes**

- ✅ Build files contain **no sensitive information** (credentials, API keys removed at build time)
- ✅ Environment variables are **compiled out** in production builds
- ✅ Source code is **obfuscated and minified** for security
- ⚠️ Never commit `build/` folder to git (it's in `.gitignore`)

---

## 📞 **Need Help?**

If you encounter issues:

1. Check PM2 logs: `pm2 logs frontend`
2. Check browser console (F12) for JavaScript errors
3. Verify build folder size: `du -sh frontend/build` (should be 50-100MB)
4. Ensure `serve` is installed globally on server: `npm list -g serve`

---

## ✨ **Summary**

**Build on Windows → Transfer to Server → Restart PM2 → Done!**

This approach is:
- ✅ Faster (no server compilation)
- ✅ More reliable (consistent builds)
- ✅ Industry standard (CI/CD pipelines use this method)
- ✅ Memory efficient (server doesn't need 4GB RAM)

**Deployment time:** 2-5 minutes total

