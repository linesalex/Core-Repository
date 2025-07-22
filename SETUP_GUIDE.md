# Network Inventory Application - Windows Setup Guide

This guide provides step-by-step instructions for setting up and running the Network Inventory application on a new Windows server or PC.

## System Requirements

### Hardware Requirements
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Disk Space**: At least 2GB free space
- **CPU**: Any modern x64 processor
- **Network**: Internet connection for initial setup

### Software Requirements
- **Operating System**: Windows 10, Windows 11, or Windows Server 2019+
- **Node.js**: Version 16 or later
- **Git** (optional but recommended)
- **Modern Web Browser**: Chrome, Firefox, Edge, or Safari

## Installation Steps

### Step 1: Install Node.js

1. **Download Node.js**:
   - Visit [https://nodejs.org/](https://nodejs.org/)
   - Download the LTS version (recommended)
   - Choose the Windows Installer (.msi)

2. **Install Node.js**:
   - Run the downloaded installer
   - Follow the installation wizard
   - Ensure "Add to PATH" is checked
   - Restart your computer after installation

3. **Verify Installation**:
   ```cmd
   node --version
   npm --version
   ```
   Both commands should return version numbers.

### Step 2: Download/Clone the Application

**Option A: Download ZIP (if you have the source)**
1. Extract the ZIP file to a directory like `C:\NetworkInventory`

**Option B: Clone from Git (if available)**
```cmd
git clone [repository-url] C:\NetworkInventory
cd C:\NetworkInventory
```

### Step 3: Setup Backend

1. **Open Command Prompt as Administrator**
2. **Navigate to backend directory**:
   ```cmd
   cd C:\NetworkInventory\backend
   ```

3. **Install dependencies**:
   ```cmd
   npm install
   ```

4. **Initialize database**:
   ```cmd
   node init_db.js
   ```

5. **Run database migrations** (required for full functionality):
   ```cmd
   node migration_script.js
   ```
   
   This step creates all necessary tables and applies the latest database schema updates.

### Step 4: Setup Frontend

1. **Navigate to frontend directory**:
   ```cmd
   cd C:\NetworkInventory\frontend
   ```

2. **Install dependencies**:
   ```cmd
   npm install
   ```

## Running the Application

### Method 1: Manual Start (Development)

1. **Start Backend Server**:
   ```cmd
   cd C:\NetworkInventory\backend
   npm start
   ```
   - Backend will run on `http://localhost:4000`
   - Keep this command prompt window open

2. **Start Frontend** (in a new command prompt):
   ```cmd
   cd C:\NetworkInventory\frontend
   npm start
   ```
   - Frontend will run on `http://localhost:3000`
   - Browser should open automatically

### Method 2: Production Build

1. **Build Frontend for Production**:
   ```cmd
   cd C:\NetworkInventory\frontend
   npm run build
   ```

2. **Serve Production Build**:
   ```cmd
   cd C:\NetworkInventory\backend
   npm run production
   ```

## Windows Service Setup (Optional)

To run the application as a Windows service:

### Using PM2 (Recommended)

1. **Install PM2 globally**:
   ```cmd
   npm install -g pm2
   npm install -g pm2-windows-service
   ```

2. **Setup PM2 as Windows Service**:
   ```cmd
   pm2-service-install
   ```

3. **Start applications with PM2**:
   ```cmd
   cd C:\NetworkInventory\backend
   pm2 start index.js --name "network-inventory-backend"
   
   cd C:\NetworkInventory\frontend
   pm2 serve build 3000 --name "network-inventory-frontend"
   
   pm2 save
   ```

## 🔐 Default Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **CRITICAL SECURITY**: Change the default password immediately after first login! Access User Management → Edit Profile to set a secure password.

## Application URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Backend Health Check**: http://localhost:4000/health

## Firewall Configuration

If accessing from other machines on the network:

1. **Open Windows Firewall**
2. **Add Inbound Rules** for:
   - Port 3000 (Frontend)
   - Port 4000 (Backend API)

## Troubleshooting

### Common Issues

**1. "npm is not recognized"**
- Ensure Node.js was installed correctly
- Restart command prompt/computer
- Add Node.js to PATH manually if needed

**2. "Port already in use"**
- Check if another application is using ports 3000 or 4000
- Kill existing processes: `taskkill /f /im node.exe`
- Or change ports in configuration files

**3. Database errors**
- Ensure you ran `node init_db.js` in the backend directory
- Check file permissions in the application directory
- Verify SQLite database file was created

**4. Permission errors**
- Run command prompt as Administrator
- Check folder permissions for the application directory

**5. Frontend not loading**
- Ensure backend is running first
- Check browser console for errors
- Verify API calls are reaching http://localhost:4000

### File Locations

- **Database**: `backend/network_routes.db`
- **Uploaded Files**: `backend/kmz_files/` and `backend/test_results_files/`
- **Logs**: Check command prompt windows for error messages

### Performance Optimization

For production environments:

1. **Use Production Build**: Always use `npm run build` for frontend
2. **Environment Variables**: Set `NODE_ENV=production`
3. **Database Optimization**: Regular database maintenance
4. **Memory Management**: Monitor Node.js memory usage

## Regular Maintenance

### Daily Tasks
- Monitor application logs
- Check disk space for uploaded files
- Verify backup processes

### Weekly Tasks
- Review user activity logs
- Clean up old temporary files
- Update application if newer versions available

### Monthly Tasks
- Database optimization and cleanup
- Security updates for Node.js and dependencies
- Review and rotate log files

## Security Considerations

1. **Change Default Passwords**: Update admin password immediately
2. **Regular Updates**: Keep Node.js and dependencies updated
3. **Network Security**: Configure firewall rules appropriately
4. **Data Backup**: Regular backup of database and uploaded files
5. **Access Control**: Review user permissions regularly

## Support

For technical support:
1. Check the troubleshooting section above
2. Review application logs for error messages
3. Consult individual component README files for detailed information

## 📊 Data Management

### Bulk Upload System
The application includes a comprehensive bulk upload system for importing data via CSV files:

1. **Access**: Navigate to "Bulk Upload" in the sidebar (Administrator only)
2. **Available Modules**: 
   - Network Routes (all route data)
   - Locations (POP information and pricing)
   - Carriers (carrier details)
   - Users (user accounts)
   - Exchange Feeds (financial data feeds)
   - Exchange Contacts (exchange contact information)
   - POP Capabilities (service capabilities per location)
   - And more...

3. **Process**:
   - Download CSV template for any module
   - Fill in your data following the template format
   - Upload the completed CSV file
   - Review results and error reports

### Data Templates
- Templates include all available database fields
- Sample data provided for reference
- Comprehensive field validation
- Error reporting for failed imports

## Next Steps

After successful installation:
1. **Change default admin password** (CRITICAL)
2. Create additional user accounts as needed
3. Configure network routes and locations using the UI or bulk upload
4. Set up exchange pricing data if using financial features
5. Configure POP capabilities for each location
6. Set up regular backup procedures
7. Train users on the application features

---

**Note**: This application manages critical network infrastructure data. Ensure proper backup and security measures are in place before production use. 