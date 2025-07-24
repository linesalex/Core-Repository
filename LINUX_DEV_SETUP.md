# Network Inventory Management System - RHEL 7 Production Setup Guide

**🔥 BATTLE-TESTED GUIDE** - Based on real-world deployment experience and troubleshooting

## ⚠️ **CRITICAL REQUIREMENTS - READ FIRST**

This guide reflects **actual deployment challenges** encountered on RHEL 7. Follow these specific requirements to avoid common pitfalls.

### **🚨 Known Issues & Solutions**
- **Git Limitations**: Many RHEL 7 environments have limited/no git access - manual file transfer required
- **SQLite3 Version**: Must use SQLite3 5.0.2 specifically (newer versions cause native binding issues)
- **bcrypt Incompatibility**: bcrypt native compilation fails - must use bcryptjs alternative
- **Node.js Compatibility**: Node.js 18+ requires glibc 2.28+, RHEL 7 only has 2.17 - use Node.js 12-16
- **Native Modules**: C++ compilation often fails - use pure JavaScript alternatives when possible

---

## 🎯 **System Requirements**

- **RHEL 7.6+**: Red Hat Enterprise Linux 7.6 or higher
- **Root Access**: Required for package installation
- **4GB RAM**: Minimum (8GB recommended for development)
- **No Git Required**: Manual file transfer methods provided
- **Internet Access**: For package downloads (or internal mirrors)

---

## 📋 **Pre-Deployment Checklist**

```bash
# Check RHEL version
cat /etc/redhat-release
# Required: Red Hat Enterprise Linux Server release 7.6+

# Check available memory  
free -h
# Minimum: 4GB total

# Check available disk space
df -h
# Minimum: 10GB free space

# Check glibc version (important for Node.js compatibility)
ldd --version
# Expected: glibc 2.17 (RHEL 7 default)
```

---

## 📦 **Step 1: System Dependencies**

### **Enable Required Repositories**
```bash
# Enable EPEL (Extra Packages for Enterprise Linux)
sudo yum install -y epel-release

# If EPEL install fails, try direct download:
sudo yum install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm

# Update package cache
sudo yum update -y
```

### **Install Build Tools (Required for Native Modules)**
```bash
# Install essential development tools individually
sudo yum install -y \
    make \
    gcc \
    gcc-c++ \
    kernel-devel \
    autoconf \
    automake \
    libtool \
    pkgconfig \
    patch \
    python-devel \
    openssl-devel \
    bzip2-devel \
    libffi-devel \
    zlib-devel \
    sqlite-devel

# Install additional utilities
sudo yum install -y \
    curl \
    wget \
    unzip \
    tar \
    which

# Verify build tools installation
gcc --version
make --version
```

---

## 🟢 **Step 2: Node.js Installation (RHEL 7 Compatible)**

### **⚠️ CRITICAL: Use Node.js 12-16 Only**

**Node.js 18+ will NOT work on RHEL 7** due to glibc version requirements.

### **Method 1: Manual Binary Installation (Most Reliable)**
```bash
# Download Node.js 16 LTS (RHEL 7 compatible)
cd /tmp
wget https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz

# Extract to /opt
sudo mkdir -p /opt/nodejs
sudo tar -xJf node-v16.20.2-linux-x64.tar.xz -C /opt/nodejs --strip-components=1

# Add to PATH
echo 'export PATH=/opt/nodejs/bin:$PATH' | sudo tee -a /etc/profile
source /etc/profile

# Verify installation
node --version  # Should show v16.20.2
npm --version   # Should show 8.x.x
```

### **Method 2: NVM (Alternative)**
```bash
# Install NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install Node.js 16 LTS
nvm install 16.20.2
nvm use 16.20.2
nvm alias default 16.20.2

# Verify
node --version
```

### **Method 3: Repository (Last Resort)**
```bash
# Only if manual installation fails
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install -y nodejs

# If you get "No package nodejs available" error:
# Use Method 1 (Manual Binary) instead
```

---

## 📁 **Step 3: Application Deployment**

### **🚨 Deployment Methods**

Choose the deployment method that works best for your environment:

### **Option A: Direct Git Download and Unzip (Recommended)**
```bash
# Create project directory
cd /root

# Download project directly from Git repository as zip
# Replace YOUR_GITHUB_USERNAME and YOUR_REPO_NAME with actual values
wget https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME/archive/refs/heads/main.zip -O Core-Repository.zip

# Unzip the downloaded file
unzip Core-Repository.zip

# Rename to standard directory name (adjust name if needed)
mv YOUR_REPO_NAME-main Core-Repository

# Navigate to project directory
cd Core-Repository

# Verify files are present
ls -la  # Should show backend/, frontend/, README.md, etc.
```

### **Option B: Direct File Transfer**
```bash
# Create project directory
sudo mkdir -p /root/Core-Repository
cd /root/Core-Repository

# Transfer files via SCP/SFTP from your development machine:
# scp -r Core-Repository/ root@server-ip:/root/
# Or use file transfer tools like WinSCP, FileZilla, etc.
```

### **Option C: Download Archive (if available)**
```bash
# If you have a project archive
cd /root
wget http://your-server/Core-Repository.tar.gz
tar -xzf Core-Repository.tar.gz
cd Core-Repository
```

### **Option D: Manual File Creation**
```bash
# Copy individual files via terminal/SSH
# Create each file manually using nano/vi
cd /root/Core-Repository
nano package.json  # Copy content from development machine
```

---

## 🔧 **Step 4: Critical Dependency Fixes**

### **🚨 SQLite3 Version Fix (REQUIRED)**

**Must use SQLite3 5.0.2 - newer versions cause native binding issues on RHEL 7**

```bash
cd /root/Core-Repository/backend

# Remove any existing SQLite3
npm uninstall sqlite3

# Install specific version that works on RHEL 7
npm install sqlite3@5.0.2

# Verify installation
npm list sqlite3
# Should show: sqlite3@5.0.2
```

### **🚨 bcrypt to bcryptjs Migration (REQUIRED)**

**bcrypt native compilation fails on RHEL 7 - must use pure JavaScript alternative**

```bash
cd /root/Core-Repository/backend

# Remove bcrypt
npm uninstall bcrypt

# Install bcryptjs (pure JavaScript, no compilation required)
npm install bcryptjs

# Update auth.js file to use bcryptjs using nano
nano auth.js

# In nano editor:
# 1. Find the line with: const bcrypt = require('bcrypt');
# 2. Change it to: const bcrypt = require('bcryptjs');
# 3. Save with: Ctrl+O, then Enter
# 4. Exit with: Ctrl+X

# Verify the change
grep -n "bcryptjs" auth.js
# Should show: const bcrypt = require('bcryptjs');
```

### **🚨 Fix Optional Chaining Syntax (if using older Node.js)**

```bash
# If you get syntax errors about optional chaining (?.):
cd /root/Core-Repository/backend

# Replace optional chaining with compatible syntax
sed -i 's/error\.response?.data/error.response \&\& error.response.data/g' *.js
sed -i 's/\.stack?.length/.stack \&\& .stack.length/g' *.js

# Or upgrade to Node.js 14+ which supports optional chaining
```

---

## 🏗️ **Step 5: Application Setup**

### **Backend Setup**
```bash
cd /root/Core-Repository/backend

# Install dependencies
npm install

# If npm install fails with native module errors:
npm install --build-from-source
# Or:
npm install --no-optional

# Initialize database
node init_db.js

# Test backend startup
node index.js
# Should start without errors, press Ctrl+C to stop
```

### **Frontend Setup**
```bash
cd /root/Core-Repository/frontend

# Install dependencies
npm install

# If memory issues during install:
npm install --max_old_space_size=4096

# Create environment configuration
echo "REACT_APP_API_URL=http://$(hostname -I | awk '{print $1}'):4000" > .env

# Test frontend build
npm run build
# Should complete without errors
```

---

## 🚀 **Step 6: Production Deployment with PM2**

### **Install PM2**
```bash
# Install PM2 globally
npm install -g pm2

# Verify installation
pm2 --version
```

### **Deploy with PM2**
```bash
cd /root/Core-Repository

# Create logs directory
mkdir -p logs

# Start applications
pm2 start ecosystem.config.js

# Save configuration for auto-restart
pm2 save

# Setup auto-startup on boot
pm2 startup
# Follow the command it shows

# Check status
pm2 list
```

---

## 🛠️ **Troubleshooting Guide**

### **🚨 Native Module Compilation Errors**

**Problem**: `Error: Could not locate the bindings file`
```bash
# Solution 1: Reinstall with specific version
cd /root/Core-Repository/backend
npm uninstall sqlite3
npm install sqlite3@5.0.2

# Solution 2: Use better-sqlite3 (alternative)
npm uninstall sqlite3
npm install better-sqlite3
# Note: Requires code changes in db.js

# Solution 3: Force rebuild
npm rebuild sqlite3
```

### **🚨 bcrypt Compilation Errors**

**Problem**: `node-pre-gyp ERR! build error`
```bash
# Solution: Switch to bcryptjs (no compilation required)
cd /root/Core-Repository/backend
npm uninstall bcrypt
npm install bcryptjs

# Update all references in code
find . -name "*.js" -exec sed -i 's/require.*bcrypt.*/require("bcryptjs")/g' {} +
```

### **🚨 Node.js Version Issues**

**Problem**: `GLIBC_2.28 not found`
```bash
# Check your glibc version
ldd --version

# RHEL 7 has glibc 2.17, incompatible with Node.js 18+
# Solution: Downgrade to Node.js 16
sudo rm -rf /opt/nodejs  # If using manual install
# Reinstall Node.js 16 using Method 1 above
```

### **🚨 Permission Issues**
```bash
# Fix file permissions
sudo chown -R $USER:$USER /root/Core-Repository
chmod 644 network_routes.db

# If running as root:
npm config set unsafe-perm true
```

### **🚨 Port Conflicts**
```bash
# Check what's using ports 3000/4000
netstat -tulpn | grep -E ":3000|:4000"

# Kill conflicting processes
sudo kill -9 <PID>

# Or change ports in ecosystem.config.js
```

### **🚨 Memory Issues**
```bash
# Check available memory
free -h

# If low memory, increase swap:
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo mkswap /swapfile
sudo swapon /swapfile

# Or reduce PM2 memory limits in ecosystem.config.js
```

---

## 📊 **Production Monitoring**

### **Health Checks**
```bash
# Check PM2 processes
pm2 list

# Check application health
curl http://localhost:4000/health

# Monitor logs
pm2 logs --lines 50

# Monitor resource usage
pm2 monit
```

### **Database Maintenance**
```bash
# Backup database
cp network_routes.db network_routes.db.backup.$(date +%Y%m%d)

# Check database integrity
sqlite3 network_routes.db "PRAGMA integrity_check;"

# Vacuum database (optimize)
sqlite3 network_routes.db "VACUUM;"
```

---

## 🔒 **Security Considerations**

### **Production Hardening**
```bash
# Set secure JWT secret
export JWT_SECRET="your-super-secure-secret-here"

# Configure firewall
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=4000/tcp
sudo firewall-cmd --reload

# Disable SELinux if causing issues (not recommended for production)
sudo setenforce 0
```

---

## 📞 **Getting Help**

### **Log Locations**
- **PM2 Logs**: `~/.pm2/logs/`
- **Application Logs**: `/root/Core-Repository/logs/`
- **System Logs**: `/var/log/messages`

### **Common Commands**
```bash
# Restart everything
pm2 restart all

# View errors only
pm2 logs --err

# Emergency stop
pm2 kill

# Check Node.js compatibility
node -e "console.log(process.versions)"
```

### **Support Files**
- **PM2 Guide**: `pm2` file in project root
- **Quick Reference**: `PM2_QUICK_REFERENCE.md`
- **Application Manual**: `APPLICATION_WALKTHROUGH.md`

---

## 🏁 **Success Checklist**

- [ ] Node.js 16.x installed and working
- [ ] SQLite3 5.0.2 specifically installed
- [ ] bcryptjs (not bcrypt) installed  
- [ ] Backend starts without errors
- [ ] Frontend builds successfully
- [ ] PM2 processes running
- [ ] Health check returns success: `curl http://localhost:4000/health`
- [ ] Can access frontend: `http://server-ip:3000`
- [ ] Can login with admin/admin123

**🎉 If all checks pass, your Network Inventory Management System is ready for production!** 