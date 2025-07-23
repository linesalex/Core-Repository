# PM2 Quick Reference - Network Inventory Management System

## 🚀 **Quick Start**

```bash
# 1. Deploy everything automatically
chmod +x deploy-pm2.sh && ./deploy-pm2.sh

# 2. Manual deployment
npm install -g pm2
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 📊 **Essential Commands**

### **Process Management**
```bash
pm2 start ecosystem.config.js     # Start all applications
pm2 restart all                   # Restart all processes
pm2 stop all                      # Stop all processes
pm2 delete all                    # Delete all processes
pm2 reload all                    # Zero-downtime reload
```

### **Monitoring**
```bash
pm2 list                          # Show all processes
pm2 monit                         # Real-time monitoring
pm2 show network-backend          # Detailed process info
pm2 logs                          # View all logs
pm2 logs network-backend          # View specific process logs
pm2 logs --err                    # View only errors
```

### **Individual Process Control**
```bash
pm2 restart network-backend       # Restart backend only
pm2 restart network-frontend      # Restart frontend only
pm2 stop network-backend          # Stop backend only
pm2 logs network-frontend --lines 50  # View last 50 frontend logs
```

---

## 🛠️ **Troubleshooting Commands**

### **Check Status**
```bash
pm2 list                          # Are processes running?
pm2 logs --err --lines 20         # What errors occurred?
pm2 show network-backend          # Detailed backend info
pm2 describe network-frontend     # Detailed frontend info
```

### **Fix Common Issues**
```bash
# Backend won't start
cd /root/Core-Repository/backend && npm install
pm2 restart network-backend
pm2 logs network-backend

# Frontend won't start  
cd /root/Core-Repository/frontend && npm install
pm2 restart network-frontend
pm2 logs network-frontend

# Port conflicts
netstat -tulpn | grep :4000
netstat -tulpn | grep :3000
sudo kill -9 <PID>
```

---

## 🔧 **Configuration Updates**

### **Update API URL**
```bash
# Edit ecosystem.config.js, then:
pm2 startOrReload ecosystem.config.js

# Or update environment:
pm2 set network-frontend:env.REACT_APP_API_URL "http://new-ip:4000"
pm2 restart network-frontend
```

### **Change Memory Limits**
```bash
pm2 restart network-backend --max-memory-restart 1G
pm2 restart network-frontend --max-memory-restart 2G
```

---

## 📈 **Performance & Scaling**

### **Scale Backend**
```bash
pm2 scale network-backend 2       # Run 2 backend instances
pm2 scale network-backend 4       # Scale to 4 instances
```

### **Monitor Performance**
```bash
pm2 monit                         # Real-time resource monitor
pm2 show network-backend          # Memory/CPU usage
```

---

## 🚨 **Emergency Recovery**

### **Complete Reset**
```bash
pm2 kill                          # Stop PM2 daemon
pm2 flush                         # Clear logs
cd /root/Core-Repository
./deploy-pm2.sh                   # Redeploy everything
```

### **Database Issues**
```bash
cd /root/Core-Repository
cp network_routes.db network_routes.db.backup
sqlite3 network_routes.db "PRAGMA integrity_check;"
pm2 restart network-backend
```

---

## 📝 **Auto-Startup Configuration**

### **Setup Auto-Start**
```bash
pm2 startup                       # Generate startup script
pm2 save                          # Save current process list
sudo reboot                       # Test auto-restart
```

### **Remove Auto-Start**
```bash
pm2 unstartup                     # Remove startup script
pm2 delete all                    # Clear all processes
```

---

## 📊 **Log Management**

### **View Logs**
```bash
pm2 logs                          # All logs (live)
pm2 logs --lines 100              # Last 100 lines
pm2 logs network-backend | grep ERROR  # Filter errors
pm2 flush                         # Clear all logs
```

### **Log Locations**
- PM2 logs: `~/.pm2/logs/`
- Application logs: `/root/Core-Repository/logs/`
- Backend: `./logs/backend-*.log`
- Frontend: `./logs/frontend-*.log`

---

## ⚡ **One-Line Solutions**

```bash
# Quick restart everything
pm2 restart all && pm2 logs --lines 10

# Check if everything is healthy
pm2 list && curl -s http://172.30.252.118:4000/health

# View recent errors
pm2 logs --err --lines 20

# Full redeploy
pm2 delete all && pm2 start ecosystem.config.js && pm2 save

# Monitor startup
pm2 start ecosystem.config.js && sleep 5 && pm2 list && pm2 logs --lines 5
```

---

## 🔗 **Access URLs**

- **Frontend**: `http://172.30.252.118:3000`
- **Backend**: `http://172.30.252.118:4000`
- **Health Check**: `http://172.30.252.118:4000/health`
- **PM2 Web UI**: `npm install -g pm2-web && pm2-web --port 8080`

---

## 📞 **Support Files**

- **Detailed Guide**: `pm2` (this directory)
- **Application Manual**: `APPLICATION_WALKTHROUGH.md`
- **Linux Setup**: `LINUX_DEV_SETUP.md`
- **Configuration**: `ecosystem.config.js`
- **Auto Deploy**: `./deploy-pm2.sh`

---

## 🎯 **Default Login**

- **Username**: `admin`
- **Password**: `admin123` 