# Network Inventory Management System - RHEL 7 Development Setup

Quick and simple setup guide for running the Network Inventory Management System in development mode on Red Hat Enterprise Linux 7.

## 🚀 Quick Requirements

- **RHEL 7**: Red Hat Enterprise Linux 7.x (7.6+ recommended)
- **Root/Sudo Access**: Required for package installation
- **Internet Connection**: For downloading packages and dependencies
- **10 minutes** of your time ⏰

## 📋 Prerequisites Check

```bash
# Check RHEL version
cat /etc/redhat-release
# Should show: Red Hat Enterprise Linux Server release 7.x

# Check if you have sudo access
sudo whoami
# Should show: root
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

### **Install Development Tools**
```bash
# Fix groups database first (common RHEL 7 issue)
sudo yum groups mark convert

# Install essential build tools (required for npm packages with native modules)
sudo yum groupinstall -y "Development Tools"

# If groupinstall fails, install core packages individually
if [ $? -ne 0 ]; then
    sudo yum install -y make gcc gcc-c++ kernel-devel
fi

# Install additional required packages (avoid git conflicts)
sudo yum install -y \
    curl \
    wget \
    python-devel \
    openssl-devel \
    bzip2-devel \
    libffi-devel \
    zlib-devel \
    sqlite-devel

# Check if git is already installed
git --version
# If git is not installed or you need to upgrade:
# sudo yum install -y git
```

## 🔧 Step 2: Install Node.js

### **Method 1: NodeSource Repository (RHEL 7 Compatible)**
```bash
# IMPORTANT: Use Node.js 16.x for RHEL 7 compatibility
# Node.js 18+ requires glibc 2.28+, but RHEL 7 only has glibc 2.17
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -

# Install Node.js
sudo yum install -y nodejs

# Verify installation
node --version  # Should show v16.x.x
npm --version   # Should show 8.x.x

# Check system compatibility
ldd --version  # Should show glibc 2.17 (RHEL 7 default)
```

### **Method 2: Using NVM (Most Reliable for RHEL 7)**
```bash
# Install NVM (Node Version Manager) - works on any system
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell configuration
source ~/.bashrc

# Install Node.js 16 LTS (RHEL 7 compatible)
nvm install 16
nvm use 16
nvm alias default 16

# Verify installation
node --version  # Should show v16.x.x
npm --version   # Should show 8.x.x

# List available versions if needed
nvm ls-remote --lts
```

### **Method 3: Pre-compiled Binaries (If repositories fail)**
```bash
# Download Node.js 16 pre-compiled binary (RHEL 7 compatible)
cd /tmp
wget https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz

# Extract and install
sudo tar -xJf node-v16.20.2-linux-x64.tar.xz -C /usr/local --strip-components=1

# Add to PATH if needed
echo 'export PATH=/usr/local/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Verify installation
node --version  # Should show v16.20.2
npm --version   # Should show 8.x.x

# Clean up
rm -f /tmp/node-v16.20.2-linux-x64.tar.xz
```

## 📁 Step 3: Get the Application

### **Clone or Download**
```bash
# Option 1: Clone with git
git clone <your-repository-url>
cd Core-Repository

# Option 2: If you have the files already
# Just navigate to your project directory
cd /path/to/Core-Repository

# Make sure you're in the right directory
pwd
ls -la  # You should see backend/, frontend/, README.md, etc.
```

## 🔧 Step 4: Verify System Compatibility

### **Check RHEL 7 System Requirements**
```bash
# Check glibc version (should be 2.17 for RHEL 7)
ldd --version

# Check system architecture
uname -m  # Should show x86_64

# Check available memory (Node.js needs at least 512MB)
free -h

# Check disk space
df -h
```

## 🔧 Step 5: Configure npm for RHEL 7

### **Set npm Configuration (Important for RHEL 7)**
```bash
# Set npm to use compatible settings for RHEL 7
npm config set python python2
npm config set unsafe-perm true

# Increase npm timeout for slower connections
npm config set timeout 300000

# Set legacy peer deps (helps with older npm versions)
npm config set legacy-peer-deps true

# If behind corporate firewall, you may need:
# npm config set strict-ssl false
# npm config set registry http://registry.npmjs.org/
```

## 🔧 Step 6: Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# If you encounter permission errors, try:
# sudo npm install --unsafe-perm=true

# Install frontend dependencies
cd ../frontend
npm install

# If installation fails due to memory issues:
# npm install --max_old_space_size=4096
```

## 🗄 Step 7: Setup Database

```bash
# Navigate to backend directory
cd backend

# Initialize the database
node init_db.js

# Run database migrations
node migration_script.js

# You should see: "Database initialized successfully" and "Migration completed successfully"

# Verify database was created
ls -la ../network_routes.db
# Should show the database file with proper permissions
```

## 🚀 Step 8: Configure Firewall (Optional but Recommended)

### **Configure firewalld for Development**
```bash
# Check if firewalld is running
sudo systemctl status firewalld

# If firewalld is active, allow development ports
sudo firewall-cmd --zone=public --add-port=3000/tcp --permanent
sudo firewall-cmd --zone=public --add-port=4000/tcp --permanent
sudo firewall-cmd --reload

# Verify rules
sudo firewall-cmd --list-ports
```

### **Alternative: Temporarily Disable firewall (Less Secure)**
```bash
# Only if you have issues with firewall
sudo systemctl stop firewalld
sudo systemctl disable firewalld
```

## 🚀 Step 9: Start the Application

### **Terminal 1 - Start Backend**
```bash
cd backend
npm start
# You should see: "Server running on port 4000"

# If you get EACCES errors on RHEL 7:
# sudo npm start
```

### **Terminal 2 - Start Frontend**
```bash
# Open a new terminal window/tab
cd frontend
npm start
# You should see: "Local: http://localhost:3000"

# If port 3000 is blocked, specify a different port:
# PORT=3001 npm start
```

## ✅ Step 10: Access the Application

1. **Open your web browser** (Firefox, Chrome, or any modern browser)
2. **Navigate to**: `http://localhost:3000`
3. **Login with default credentials**:
   - **Username**: `admin`
   - **Password**: `admin123`

### **If you can't access the application:**
```bash
# Check if services are running
curl http://localhost:4000/health  # Backend health check
curl http://localhost:3000         # Frontend check

# Check what's listening on ports
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :4000

# Check firewall status
sudo firewall-cmd --list-all
```

🎉 **That's it! You're running the Network Inventory Management System on RHEL 7!**

## 🔧 Development Commands

### **Backend Commands**
```bash
cd backend

# Start backend (development mode with auto-restart)
npm run dev

# Start backend (production mode)
npm start

# Check if database exists
ls -la ../network_routes.db
```

### **Frontend Commands**
```bash
cd frontend

# Start development server
npm start

# Build for production
npm run build

# Test the build
npx serve -s build
```

## 🛠 Common Development Tasks

### **Reset Database**
```bash
cd backend
rm ../network_routes.db
node init_db.js
node migration_script.js
```

### **Update Dependencies**
```bash
# Update backend
cd backend
npm update

# Update frontend
cd frontend
npm update
```

### **Check Application Status**
```bash
# Check if backend is running
curl http://localhost:4000/health

# Check if frontend is accessible
curl http://localhost:3000
```

## 🔍 RHEL 7 Specific Troubleshooting

### **Port Already in Use**
```bash
# Find what's using port 4000
sudo netstat -tulpn | grep :4000
# Or use ss command (modern alternative)
sudo ss -tulpn | grep :4000

# Kill the process if needed
sudo kill -9 <PID>

# Find what's using port 3000
sudo netstat -tulpn | grep :3000
sudo kill -9 <PID>
```

### **Firewall Issues**
```bash
# Check firewall status
sudo systemctl status firewalld
sudo firewall-cmd --list-all

# Allow ports if blocked
sudo firewall-cmd --zone=public --add-port=3000/tcp --permanent
sudo firewall-cmd --zone=public --add-port=4000/tcp --permanent
sudo firewall-cmd --reload

# Temporarily disable firewall for testing
sudo systemctl stop firewalld
```

### **SELinux Issues**
```bash
# Check SELinux status
getenforce

# If SELinux is enforcing and causing issues:
sudo setenforce 0  # Temporary disable

# For permanent disable (requires reboot):
sudo sed -i 's/SELINUX=enforcing/SELINUX=disabled/' /etc/selinux/config
```

### **Permission Issues**
```bash
# Make sure you own the project directory
sudo chown -R $USER:$USER /path/to/Core-Repository

# Make sure database is writable
chmod 664 network_routes.db

# If running as root, you may need:
# npm config set unsafe-perm true
```

### **Node.js Compatibility Issues (Most Common)**
```bash
# Check if you're trying to install incompatible Node.js version
node --version
ldd --version  # Should show glibc 2.17 for RHEL 7

# If you get glibc version errors, use Node.js 16 instead of 18+
# Uninstall incompatible version first
sudo yum remove -y nodejs npm

# Install compatible version
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install -y nodejs

# Or use NVM method (most reliable)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 16
nvm use 16
```

### **Node.js/npm Issues on RHEL 7**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# If native module compilation fails:
sudo yum install -y python-devel gcc gcc-c++
npm rebuild

# For memory issues during install:
npm install --max_old_space_size=4096

# If npm install fails with EACCES:
npm config set unsafe-perm true
npm install
```

### **Database Issues**
```bash
# Check if database file exists
ls -la network_routes.db

# Check database permissions
ls -la network_routes.db
# Should show: -rw-rw-r-- 1 username username

# Check if SQLite is working
node -e "const sqlite3 = require('sqlite3'); console.log('SQLite OK');"

# Reinitialize database if corrupted
rm network_routes.db
node init_db.js
node migration_script.js
```

### **Network/Corporate Environment Issues**
```bash
# If behind corporate proxy, configure npm:
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# If SSL certificate issues:
npm config set strict-ssl false

# Use internal npm registry if needed:
npm config set registry http://internal-registry.company.com/
```

### **System Resource Issues**
```bash
# Check available memory
free -h

# Check disk space
df -h

# Check system load
uptime

# If system is slow/unresponsive:
# Reduce Node.js memory usage
export NODE_OPTIONS="--max-old-space-size=1024"
```

## 📱 Access from Other Devices (RHEL 7)

If you want to access the application from other devices on your network:

### **Find Your IP Address**
```bash
# Get your local IP address (RHEL 7 methods)
ip route get 1.1.1.1 | awk '{print $7; exit}'
# or
ip addr show | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d'/' -f1
# or traditional method
ifconfig | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}'
```

### **Configure Firewall for Network Access**
```bash
# Allow access from your network (replace 192.168.1.0/24 with your network)
sudo firewall-cmd --zone=public --add-rich-rule='rule family="ipv4" source address="192.168.1.0/24" port protocol="tcp" port="3000" accept' --permanent
sudo firewall-cmd --zone=public --add-rich-rule='rule family="ipv4" source address="192.168.1.0/24" port protocol="tcp" port="4000" accept' --permanent
sudo firewall-cmd --reload

# Or allow all network access (less secure)
sudo firewall-cmd --zone=public --add-port=3000/tcp --permanent
sudo firewall-cmd --zone=public --add-port=4000/tcp --permanent
sudo firewall-cmd --reload
```

### **Update Frontend Configuration**
```bash
# Edit frontend package.json
vi frontend/package.json

# Find the "start" script and modify it:
"start": "HOST=0.0.0.0 react-scripts start"

# Or set environment variable
export HOST=0.0.0.0
cd frontend
npm start
```

### **Configure SELinux (if enabled)**
```bash
# Allow network connections if SELinux is enforcing
sudo setsebool -P httpd_can_network_connect 1
sudo setsebool -P httpd_can_network_relay 1
```

Now you can access from other devices:
- **Frontend**: `http://YOUR_IP:3000`
- **Backend API**: `http://YOUR_IP:4000`

## 🔄 Stopping the Application

### **Stop Services Properly**
```bash
# In each terminal window, press:
Ctrl + C

# Or if running in background:
pkill -f "node"
pkill -f "react-scripts"

# Check that processes are stopped
ps aux | grep node
ps aux | grep react-scripts
```

## 📊 RHEL 7 Development vs Production

| Feature | RHEL 7 Development | RHEL 7 Production |
|---------|-------------------|-------------------|
| **Setup Time** | 10 minutes | 3+ hours |
| **Security** | Basic + SELinux | Enterprise-grade |
| **Performance** | Basic | Optimized |
| **SSL/HTTPS** | No | Yes |
| **Process Management** | Manual | systemd + PM2 |
| **Web Server** | Development | Apache/Nginx |
| **Monitoring** | Console logs | Full monitoring |
| **Backups** | Manual | Automated |
| **Updates** | Manual | Scripted |
| **Firewall** | firewalld basic | firewalld hardened |
| **SELinux** | Permissive/Disabled | Enforcing |

## 🎯 RHEL 7 Specific Next Steps

1. **Change default password** in User Management
2. **Configure SELinux** properly if using in production
3. **Review firewall rules** for your network requirements
4. **Test with corporate proxy** if in enterprise environment
5. **Monitor system resources** during development
6. **Consider using systemd** for service management
7. **Plan for Red Hat subscription** management if going to production

## 📞 RHEL 7 Specific Help

### **Check System Status**
```bash
# Check RHEL version and subscription
cat /etc/redhat-release
sudo subscription-manager status

# Check system resources
free -h
df -h
uptime

# Check network connectivity
ping -c 3 8.8.8.8
curl -I https://registry.npmjs.org
```

### **Check Application Logs**
```bash
# Backend logs (in the terminal where backend is running)
# Frontend logs (in the terminal where frontend is running)
# Browser console (F12 → Console tab)

# System logs
sudo journalctl -f
sudo tail -f /var/log/messages
```

### **Quick Health Check**
```bash
# Test backend
curl http://localhost:4000/health

# Test database
cd backend
node -e "const db = require('./db'); console.log('Database OK');"

# Test system services
sudo systemctl status firewalld
sudo systemctl status NetworkManager
```

## 🛡️ RHEL 7 Security Considerations

### **For Development Environment**
```bash
# Minimal security for development
sudo setenforce 0  # Disable SELinux temporarily
sudo systemctl stop firewalld  # Stop firewall for testing

# Re-enable for production testing
sudo setenforce 1
sudo systemctl start firewalld
```

### **For Production Preparation**
```bash
# Keep security enabled
sudo setenforce 1
sudo systemctl enable firewalld
sudo systemctl start firewalld

# Configure proper firewall rules
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 🔧 RHEL 7 System Maintenance

### **Keep System Updated**
```bash
# Check for updates
sudo yum check-update

# Update system (careful in production)
sudo yum update -y

# Update only security patches
sudo yum update --security -y
```

### **Monitor Resources**
```bash
# Check disk usage
df -h
du -sh /path/to/Core-Repository

# Check memory usage
free -h
cat /proc/meminfo

# Check CPU usage
top
htop  # if installed: sudo yum install htop
```

---

**🎉 Happy Development on RHEL 7!** 

You now have a fully functional Network Inventory Management System running on Red Hat Enterprise Linux 7 for development and testing!

## 📋 RHEL 7 Quick Reference

### **Essential Commands Summary**
```bash
# System Information
cat /etc/redhat-release
sudo subscription-manager status
free -h && df -h

# Package Management
sudo yum install <package>
sudo yum update -y
sudo yum groupinstall "Development Tools"

# Service Management
sudo systemctl status <service>
sudo systemctl start/stop/restart <service>
sudo systemctl enable/disable <service>

# Firewall Management
sudo firewall-cmd --list-all
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --reload

# SELinux Management
getenforce
sudo setenforce 0/1
sudo setsebool -P <boolean> on/off

# Network Troubleshooting
sudo netstat -tulpn | grep :port
sudo ss -tulpn | grep :port
ip addr show
```

### **Application Quick Start Commands**
```bash
# One-time setup (copy and paste) - RHEL 7 Compatible
sudo yum install -y epel-release
sudo yum groups mark convert
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install -y nodejs
sudo yum groupinstall -y "Development Tools"

# Configure npm for RHEL 7
npm config set python python2
npm config set unsafe-perm true

# Start application (every time)
cd /path/to/Core-Repository
cd backend && npm start &
cd ../frontend && npm start &

# Stop application
pkill -f "node"
```

## 🔗 Additional RHEL 7 Resources

- **Red Hat Customer Portal**: https://access.redhat.com
- **RHEL 7 Documentation**: https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/7/
- **Node.js on RHEL**: https://developers.redhat.com/products/nodejs/overview
- **SELinux Guide**: https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/7/html/selinux_users_and_administrators_guide/
- **Firewalld Documentation**: https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/7/html/security_guide/sec-using_firewalls 