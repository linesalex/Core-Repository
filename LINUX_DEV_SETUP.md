# Network Inventory Management System - RHEL 7 Development Setup

**Updated guide with all fixes and workarounds discovered during deployment** ✅

Quick and reliable setup guide for running the Network Inventory Management System in development mode on Red Hat Enterprise Linux 7, including all discovered fixes and compatibility workarounds.

## 🚀 Quick Requirements

- **RHEL 7**: Red Hat Enterprise Linux 7.x (7.6+ recommended)
- **Root/Sudo Access**: Required for package installation
- **Internet Connection**: For downloading packages and dependencies
- **15 minutes** of your time ⏰
- **Working SCP/SFTP access** (since git may not be available)

## 📋 Prerequisites Check

```bash
# Check RHEL version
cat /etc/redhat-release
# Should show: Red Hat Enterprise Linux Server release 7.x

# Check if you have sudo access
sudo whoami
# Should show: root

# Check glibc version (critical for Node.js compatibility)
ldd --version
# Should show: glibc 2.17 (RHEL 7 limitation)
```

## 📦 Step 1: Install Required Dependencies

### **Enable EPEL Repository**
```bash
# RHEL 7 requires EPEL for additional packages
sudo yum install -y epel-release

# If epel-release is not available, install directly
sudo yum install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm

# Update package cache
sudo yum update -y
```

### **Install Development Tools (Essential for bcrypt/sqlite3)**
```bash
# ⚠️ CRITICAL: Install these BEFORE Node.js to avoid compilation errors
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
    unzip

# ⚠️ IMPORTANT: Skip git installation if it causes conflicts
# Some RHEL 7 minimal installations have git conflicts
# We'll use SCP/SFTP instead for file transfers

# Check if git is available without conflicts
yum list available git
# If conflicts appear, skip git installation - we'll use alternative methods
```

## 🔧 Step 2: Install Node.js (RHEL 7 Compatible Version)

### **⚠️ CRITICAL: Use Node.js 14.x or 16.x ONLY**
**Node.js 18+ requires glibc 2.28+, but RHEL 7 only has glibc 2.17**

### **Method 1: NodeSource Repository (Recommended)**
```bash
# Install Node.js 16.x (LTS and RHEL 7 compatible)
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -

# Install Node.js
sudo yum install -y nodejs

# Verify installation
node --version  # Should show v16.x.x
npm --version   # Should show 8.x.x

# ⚠️ Configure npm for RHEL 7 compatibility (CRITICAL)
npm config set python python2
npm config set unsafe-perm true
npm config set legacy-peer-deps true
npm config set timeout 300000
```

### **Method 2: Manual Binary Installation (If repositories fail)**
```bash
# Download Node.js 16 pre-compiled binary
cd /tmp
wget https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz

# Extract and install
sudo tar -xJf node-v16.20.2-linux-x64.tar.xz -C /usr/local --strip-components=1

# Add to PATH
echo 'export PATH=/usr/local/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Configure npm for RHEL 7
npm config set python python2
npm config set unsafe-perm true
npm config set legacy-peer-deps true

# Verify installation
node --version  # Should show v16.20.2
npm --version

# Clean up
rm -f /tmp/node-v16.20.2-linux-x64.tar.xz
```

## 📁 Step 3: Get the Application Files

### **Method 1: SCP/SFTP Transfer (Recommended - No Git Required)**
```bash
# From your Windows machine, create project directory on server:
mkdir -p /root/Core-Repository
cd /root/Core-Repository

# Use WinSCP, FileZilla, or command line to transfer files:
# Windows PowerShell command (run from your local machine):
# scp -r C:\Users\lines\OneDrive\Code\Core-Repository\* root@YOUR_SERVER_IP:/root/Core-Repository/

# Or use any SFTP client to upload the entire project
```

### **Method 2: Manual File Transfer**
```bash
# If you have individual updated files, transfer them:
# - Transfer updated_frontend.tar.gz
# - Extract: tar -xzf updated_frontend.tar.gz
# - Ensure all directories are in place: backend/, frontend/, network_routes_schema.sql, etc.
```

### **Verify Files Are in Place**
```bash
cd /root/Core-Repository
ls -la
# You should see: backend/, frontend/, README.md, network_routes_schema.sql, etc.

# Check critical files exist
ls -la backend/package.json
ls -la frontend/package.json
ls -la backend/auth.js
ls -la frontend/src/
```

## 🔧 Step 4: Apply Critical Fixes for RHEL 7 Compatibility

### **Fix 1: Replace bcrypt with bcryptjs (CRITICAL)**
**bcrypt requires native compilation which often fails on RHEL 7**

```bash
cd /root/Core-Repository/backend

# Remove bcrypt and install bcryptjs
npm uninstall bcrypt
npm install bcryptjs

# Update auth.js to use bcryptjs
sed -i "s/require('bcrypt')/require('bcryptjs')/g" auth.js
sed -i "s/const bcrypt = require('bcrypt')/const bcrypt = require('bcryptjs')/g" auth.js

# Verify the change
grep -n "bcryptjs" auth.js
# Should show: const bcrypt = require('bcryptjs');
```

### **Fix 2: Update Frontend for Dynamic IP Detection**
```bash
cd /root/Core-Repository/frontend/src

# Create config.js for dynamic API URL detection
cat > config.js << 'EOF'
// Configuration file for dynamic API URL detection
const getApiBaseUrl = () => {
  // Priority 1: Use environment variable if set
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Priority 2: Auto-detect based on current hostname
  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // http: or https:
  
  // Use the same protocol as the frontend (for production HTTPS support)
  return `${protocol}//${hostname}:4000`;
};

// Configuration object
const config = {
  API_BASE_URL: getApiBaseUrl(),
  
  // Other configuration options
  APP_VERSION: '2.2',
  
  // Development vs Production settings
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  
  // Default settings
  DEFAULT_PAGE_SIZE: 10,
  REQUEST_TIMEOUT: 30000,
  
  // For debugging
  DEBUG_API_CALLS: process.env.REACT_APP_DEBUG === 'true'
};

// Log configuration in development
if (config.IS_DEVELOPMENT) {
  console.log('🔧 Frontend Configuration:', {
    API_BASE_URL: config.API_BASE_URL,
    hostname: window.location.hostname,
    environment: process.env.NODE_ENV
  });
}

export default config;
EOF

# Update api.js to use config
sed -i "1i import config from './config';" api.js
sed -i "s|const API_BASE_URL = 'http://localhost:4000';|const API_BASE_URL = config.API_BASE_URL;|g" api.js

# Update AuthContext.js
sed -i "1i import config from './config';" AuthContext.js
sed -i "s|'http://localhost:4000|\`\${config.API_BASE_URL}|g" AuthContext.js
```

### **Fix 3: Fix Optional Chaining for Node.js 16 Compatibility**
```bash
cd /root/Core-Repository/backend

# Fix optional chaining in db.js (not supported in Node.js < 14)
sed -i "s/row\?\./row \&\& row\./g" db.js
sed -i "s/results\?\./results \&\& results\./g" db.js

# Check for any other optional chaining usage
grep -r "?\.\ " *.js || echo "No optional chaining found"
```

### **Fix 4: Replace All Hardcoded localhost URLs in Frontend**
```bash
cd /root/Core-Repository/frontend/src

# Replace all hardcoded localhost:4000 URLs with config-based URLs
# First, add config import to all files that need it
for file in UserManagement.js PromoPricingManager.js NetworkDesignTool.js LocationDataManager.js ExchangeDataManager.js CNXColocationManager.js ChangeLogsViewer.js CarriersManager.js RouteFormDialog.js ExchangePricingTool.js; do
  if [ -f "$file" ]; then
    # Add config import if not present
    if ! grep -q "import config from './config'" "$file"; then
      sed -i "1i import config from './config';" "$file"
    fi
    
    # Replace hardcoded URLs
    sed -i "s|'http://localhost:4000'|\`\${config.API_BASE_URL}\`|g" "$file"
    sed -i "s|\"http://localhost:4000\"|\`\${config.API_BASE_URL}\`|g" "$file"
    
    echo "Updated $file"
  fi
done

# Verify changes
grep -r "localhost:4000" *.js && echo "⚠️ Still has hardcoded URLs" || echo "✅ All localhost URLs replaced"
```

## 🔧 Step 5: Install Dependencies with RHEL 7 Fixes

### **Install Backend Dependencies**
```bash
cd /root/Core-Repository/backend

# Clear any existing modules
rm -rf node_modules package-lock.json

# Install with RHEL 7 compatible settings
npm install --unsafe-perm=true --legacy-peer-deps

# If sqlite3 gives compilation errors, try precompiled version
npm install sqlite3 --build-from-source=false

# Verify critical modules work
node -e "const bcrypt = require('bcryptjs'); console.log('bcryptjs OK');"
node -e "const sqlite3 = require('sqlite3'); console.log('sqlite3 OK');"
```

### **Install Frontend Dependencies**
```bash
cd /root/Core-Repository/frontend

# Clear any existing modules
rm -rf node_modules package-lock.json

# Install with compatibility settings
npm install --legacy-peer-deps

# If memory issues occur during install
export NODE_OPTIONS="--max-old-space-size=2048"
npm install --legacy-peer-deps

# Verify React works
node -e "const react = require('react'); console.log('React OK');"
```

## 🗄 Step 6: Setup Database

```bash
# Navigate to backend directory
cd /root/Core-Repository/backend

# Initialize the database
node init_db.js

# Run database migrations
node migration_script.js

# Verify database was created
ls -la ../network_routes.db
# Should show the database file

# Test database connection
node -e "const db = require('./db'); console.log('Database connection OK');"
```

## 🚀 Step 7: Configure Firewall for Network Access

### **Configure firewalld for Development**
```bash
# Check if firewalld is running
sudo systemctl status firewalld

# Allow development ports
sudo firewall-cmd --zone=public --add-port=3000/tcp --permanent
sudo firewall-cmd --zone=public --add-port=4000/tcp --permanent
sudo firewall-cmd --reload

# For network access from other machines, get your IP
ip route get 1.1.1.1 | awk '{print $7; exit}'

# Allow access from your network (replace with your network range)
sudo firewall-cmd --zone=public --add-rich-rule='rule family="ipv4" source address="192.168.1.0/24" port protocol="tcp" port="3000" accept' --permanent
sudo firewall-cmd --zone=public --add-rich-rule='rule family="ipv4" source address="192.168.1.0/24" port protocol="tcp" port="4000" accept' --permanent
sudo firewall-cmd --reload

# Verify rules
sudo firewall-cmd --list-ports
```

### **Configure SELinux (If Enforcing)**
```bash
# Check SELinux status
getenforce

# If SELinux is enforcing and causing issues, temporarily disable for development
sudo setenforce 0

# For production, configure proper SELinux policies instead
```

## 🚀 Step 8: Start the Application

### **Start Backend (Terminal 1)**
```bash
cd /root/Core-Repository/backend

# Start backend with proper Node.js settings
NODE_OPTIONS="--max-old-space-size=1024" npm start

# You should see:
# "🔐 Using bcryptjs for password hashing (development mode)"
# "📊 Database connection established"
# "🚀 Server running on port 4000"
# "✅ All routes loaded successfully"
```

### **Start Frontend (Terminal 2)**
```bash
cd /root/Core-Repository/frontend

# Start frontend accessible from network
HOST=0.0.0.0 npm start

# You should see:
# "🔧 Frontend Configuration: { API_BASE_URL: 'http://YOUR_IP:4000', ... }"
# "Local: http://localhost:3000"
# "On Your Network: http://YOUR_IP:3000"
```

## ✅ Step 9: Access and Test the Application

### **Find Your Server IP**
```bash
# Get your server's IP address
SERVER_IP=$(ip route get 1.1.1.1 | awk '{print $7; exit}')
echo "🌐 Your server IP: $SERVER_IP"
echo "🖥️ Frontend URL: http://$SERVER_IP:3000"
echo "🔌 Backend URL: http://$SERVER_IP:4000"
```

### **Test the Application**
```bash
# Test backend health
curl http://localhost:4000/health

# Test from network (replace YOUR_IP)
curl http://YOUR_IP:4000/health

# Should return: {"status":"healthy","timestamp":"..."}
```

### **Access from Browser**
1. **Open browser** on any device on your network
2. **Navigate to**: `http://YOUR_SERVER_IP:3000`
3. **Login with**:
   - **Username**: `admin`
   - **Password**: `admin123`

### **Verify Dynamic IP Detection**
1. **Open browser console** (F12 → Console)
2. **Look for**: `🔧 Frontend Configuration: { API_BASE_URL: 'http://YOUR_IP:4000', ... }`
3. **This confirms** the frontend is automatically using your server's IP

## 🛠 Common RHEL 7 Troubleshooting

### **Issue 1: bcrypt Compilation Errors**
```bash
# Symptoms: "node-gyp rebuild failed" during npm install
# Solution: Use bcryptjs instead

cd backend
npm uninstall bcrypt
npm install bcryptjs
sed -i "s/require('bcrypt')/require('bcryptjs')/g" auth.js

# Verify fix
node -e "const bcrypt = require('bcryptjs'); console.log('bcryptjs works');"
```

### **Issue 2: sqlite3 Compilation Errors**
```bash
# Symptoms: "node-gyp rebuild failed" for sqlite3
# Solution: Use precompiled binary

cd backend
npm uninstall sqlite3
npm install sqlite3 --build-from-source=false

# Alternative: Use specific version
npm install sqlite3@5.0.2

# Verify fix
node -e "const sqlite3 = require('sqlite3'); console.log('sqlite3 works');"
```

### **Issue 3: Frontend Connection Errors**
```bash
# Symptoms: "Network Error" in frontend
# Check: Is backend running?
curl http://localhost:4000/health

# Check: Are ports open?
sudo netstat -tulpn | grep :4000
sudo netstat -tulpn | grep :3000

# Check: Firewall blocking?
sudo firewall-cmd --list-ports

# Check: Frontend config
grep -A 5 "API_BASE_URL" frontend/src/config.js
```

### **Issue 4: Node.js Version Incompatibility**
```bash
# Symptoms: "GLIBC_2.28 not found" or similar
# Check versions
node --version
ldd --version

# Solution: Use Node.js 16.x for RHEL 7
sudo yum remove -y nodejs npm
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install -y nodejs
```

### **Issue 5: Permission Errors**
```bash
# Symptoms: EACCES errors during npm install or start
# Solution: Fix ownership and permissions

sudo chown -R $USER:$USER /root/Core-Repository
chmod -R 755 /root/Core-Repository

# Configure npm
npm config set unsafe-perm true
npm config set cache /tmp/.npm-cache
```

### **Issue 6: Memory Issues During Install**
```bash
# Symptoms: "JavaScript heap out of memory"
# Solution: Increase Node.js memory

export NODE_OPTIONS="--max-old-space-size=2048"
npm install

# Make permanent
echo 'export NODE_OPTIONS="--max-old-space-size=2048"' >> ~/.bashrc
source ~/.bashrc
```

### **Issue 7: Port Already in Use**
```bash
# Find what's using the port
sudo netstat -tulpn | grep :4000
sudo netstat -tulpn | grep :3000

# Kill the process
sudo kill -9 <PID>

# Or use different ports
PORT=4001 npm start  # Backend
PORT=3001 npm start  # Frontend
```

## 🔄 Development Workflow

### **Daily Startup Commands**
```bash
# Terminal 1 - Backend
cd /root/Core-Repository/backend
NODE_OPTIONS="--max-old-space-size=1024" npm start

# Terminal 2 - Frontend  
cd /root/Core-Repository/frontend
HOST=0.0.0.0 npm start
```

### **Update Application (Without Git)**
```bash
# Stop services
pkill -f "node"

# Transfer new files via SCP/SFTP
# Then restart:
cd /root/Core-Repository/backend && npm start &
cd /root/Core-Repository/frontend && HOST=0.0.0.0 npm start &
```

### **Reset Database**
```bash
cd /root/Core-Repository/backend
rm ../network_routes.db
node init_db.js
node migration_script.js
```

## 📊 Production Considerations for RHEL 7

### **Process Management with systemd**
```bash
# Create systemd service for backend
sudo tee /etc/systemd/system/network-inventory-backend.service > /dev/null <<EOF
[Unit]
Description=Network Inventory Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/Core-Repository/backend
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max-old-space-size=1024
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable network-inventory-backend
sudo systemctl start network-inventory-backend
sudo systemctl status network-inventory-backend
```

### **Nginx Reverse Proxy Setup**
```bash
# Install Nginx
sudo yum install -y nginx

# Configure Nginx for the application
sudo tee /etc/nginx/conf.d/network-inventory.conf > /dev/null <<EOF
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api/ {
        rewrite ^/api/(.*)$ /\$1 break;
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable and start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx

# Update firewall for HTTP
sudo firewall-cmd --zone=public --add-service=http --permanent
sudo firewall-cmd --reload
```

## 🔧 Maintenance Commands

### **Check Application Health**
```bash
# Check processes
ps aux | grep -E "(node|npm)"

# Check ports
sudo netstat -tulpn | grep -E ":(3000|4000)"

# Check logs
sudo journalctl -u network-inventory-backend -f

# Check disk space
df -h
du -sh /root/Core-Repository
```

### **Update Dependencies**
```bash
cd /root/Core-Repository/backend
npm update

cd /root/Core-Repository/frontend  
npm update
```

### **Backup Database**
```bash
# Create backup
cp /root/Core-Repository/network_routes.db /root/network_routes_backup_$(date +%Y%m%d_%H%M%S).db

# List backups
ls -la /root/network_routes_backup_*
```

## 🎯 Quick Reference Commands

### **Application Management**
```bash
# Start development servers
cd /root/Core-Repository/backend && npm start &
cd /root/Core-Repository/frontend && HOST=0.0.0.0 npm start &

# Stop servers
pkill -f "node"

# Check status
curl http://localhost:4000/health
curl http://localhost:3000

# View logs
tail -f backend/app.log
# Browser console for frontend logs
```

### **System Management**
```bash
# Check RHEL version
cat /etc/redhat-release

# Check Node.js
node --version && npm --version

# Check services
sudo systemctl status firewalld
sudo systemctl status nginx

# Check network
ip addr show
sudo firewall-cmd --list-all
```

### **Troubleshooting**
```bash
# Clear npm cache
npm cache clean --force

# Rebuild node modules
rm -rf node_modules package-lock.json && npm install

# Check system resources
free -h && df -h && uptime

# Check error logs
sudo journalctl -f
tail -f /var/log/messages
```

---

## 🎉 Conclusion

This updated guide includes all the fixes and workarounds discovered during real-world deployment on RHEL 7:

✅ **bcryptjs instead of bcrypt** (native compilation fix)
✅ **Dynamic IP detection** (no hardcoded localhost)
✅ **Node.js 16.x compatibility** (glibc 2.17 limitation)
✅ **sqlite3 compilation fixes**
✅ **Firewall and SELinux configuration**
✅ **Network access from other devices**
✅ **systemd service management**
✅ **Production-ready configurations**

**🚀 Your Network Inventory Management System is now fully compatible with RHEL 7!**

## 📞 Support

For issues specific to this setup:

1. **Check the troubleshooting section** above first
2. **Verify all fixes were applied** (bcryptjs, config.js, etc.)
3. **Check system compatibility** (Node.js 16.x, glibc 2.17)
4. **Review firewall and SELinux** settings
5. **Test with curl commands** before browser testing

**The application should now work reliably on RHEL 7 with all discovered fixes applied!** 🎯 