# Network Inventory Backend

Enterprise-grade Node.js backend for the Network Inventory Management System, featuring advanced pricing calculations, authentication, user management, and comprehensive network infrastructure data management.

## 🚀 Features

### 🔐 Authentication & Security
- **JWT Authentication**: Secure token-based authentication system
- **Role-Based Access Control**: Administrator, Provisioner, and Read-only roles
- **Permission System**: Granular module-level permissions (view, create, edit, delete)
- **Password Security**: Bcrypt hashing with salt rounds
- **Session Management**: Secure token handling with expiration
- **User Management**: Complete user lifecycle with audit trails

### 🌐 Network Design & Pricing Engine
- **Advanced Path Finding**: Intelligent network routing algorithms
- **Dynamic Pricing Calculations**:
  - Layer 2 bandwidth allocation with 90% utilization factor
  - 4-tier minimum pricing enforcement by location
  - 40% minimum and 60% suggested margin calculations
  - Protection path pricing (100% primary + 70% secondary)
- **Multi-currency Support**: Real-time currency conversion
- **Location Management**: Comprehensive POP database with capabilities matrix

### 🔧 Core Network Management
- **Network Routes**: Full CRUD operations with advanced filtering
- **Dark Fiber Support**: DWDM channel management and reservations
- **Carrier Management**: Multi-regional carrier database with contacts
- **File Management**: KMZ uploads, test results, and ZIP downloads
- **CSV Export**: Comprehensive data export functionality

### 🏢 CNX Colocation Management
- **Multi-tier Data Structure**: Location → Rack → Client hierarchy
- **Rack Management**: Power allocation, RU tracking (30U capacity), network infrastructure
- **Client Management**: Individual client power/space allocation with design file uploads
- **File Management**: 
  - Location design files (PDF uploads)
  - Rack pricing information (Excel files)  
  - Client design documentation (PDF uploads)
- **Real-time Calculations**: Automatic power and RU allocation updates
- **Data Integrity**: Prevents rack deletion when clients exist
- **Role-based Access**: Full CRUD operations with proper authorization

### 📊 Data Management & Auditing
- **Bulk Upload System**: 
  - CSV import for all major data types (network routes, locations, carriers, users, exchanges, etc.)
  - Template generation with sample data
  - Comprehensive field validation and error reporting
  - Database export functionality
- **Exchange Pricing Engine**:
  - Quick quote system for exchange feed pricing
  - Multi-currency quote calculations
  - Comprehensive feed and contact management
  - ISF (Infrastructure Service Fee) tracking
- **Enhanced Audit Logging**: 
  - Detailed pricing calculation logs with user tracking
  - IP address and user agent logging for security
  - CSV export capabilities for audit trails
  - Clear/manage functionality for administrators
- **Change Logging**: Complete audit trail of all system modifications
- **Location Capabilities**: 12-field POP capability matrix
- **Exchange Rates**: Administrative control over currency conversion
- **Core Outages**: Incident tracking and management
- **Data Validation**: Strict format validation and integrity checks

## 🛠 Technical Stack

### Core Technologies
- **Node.js**: v16+ server runtime
- **Express.js**: Web application framework
- **SQLite3**: Embedded database engine
- **JWT**: JSON Web Token authentication
- **Bcrypt**: Password hashing and security

### Key Dependencies
- **multer**: File upload handling and processing
- **archiver**: ZIP file creation for bulk downloads
- **json2csv**: CSV export functionality
- **cors**: Cross-origin resource sharing
- **path**: File system path utilities

## 📋 Prerequisites

### System Requirements
- **Node.js**: Version 16 or later (v18+ recommended)
- **npm**: Version 8 or later
- **Operating System**: Windows 10+, Linux, or macOS
- **Memory**: Minimum 2GB RAM (4GB+ recommended)
- **Storage**: At least 1GB free space

### Development Tools
- Code editor (VS Code recommended)
- Git for version control
- Postman or similar for API testing

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Database Initialization

#### New Installation
```bash
node init_db.js
```
This creates the SQLite database with all required tables and default data.

#### Database Migration (from older versions)
```bash
node migration_script.js
```
This safely upgrades existing databases to the latest schema.

### 3. Start the Server

#### Development Mode
```bash
npm run dev
```
- Uses nodemon for auto-restart on file changes
- Runs on port 4000 by default
- Enables detailed logging

#### Production Mode
```bash
npm start
```
- Optimized for production deployment
- Reduced logging
- Environment-specific configurations

## 🔑 Default Configuration

### Default Admin Account
- **Username**: `admin`
- **Password**: `admin123`
- **Role**: Administrator
- **Permissions**: Full access to all modules

⚠️ **SECURITY**: Change the default password immediately after first login!

### Server Configuration
- **Port**: 4000 (configurable via environment variables)
- **Database**: `network_routes.db` (SQLite file)
- **Upload Directory**: `kmz_files/` and `test_results_files/`
- **JWT Secret**: Configurable via environment variables

## 🗄 Database Schema

### Authentication Tables
- **users**: User accounts and role assignments
- **role_permissions**: Permission matrix for each role and module
- **change_logs**: Complete audit trail of all system changes

### Core Business Tables
- **network_routes**: Network route inventory and metadata
- **location_reference**: POP database with pricing and capabilities
- **carriers**: Carrier information with regional support
- **exchange_rates**: Currency conversion rates

### CNX Colocation Tables
- **cnx_colocation_racks**: Rack inventory with power allocation, RU tracking, and file management
- **cnx_colocation_clients**: Client details with power/RU allocation and design file storage
- **pop_capabilities**: Extended with CNX Colocation capability flag for location enablement

### Enhanced Features
- **Minimum Pricing**: 4-tier location-based pricing structure
- **POP Capabilities**: 12-field service capability matrix
- **Regional Support**: Multi-region carrier management
- **Audit System**: Comprehensive change tracking

## 🚦 API Documentation

### Authentication Endpoints
```
POST   /login                    # User authentication
GET    /me                       # Current user profile
PUT    /change-password          # Password modification
```

### User Management (Admin Only)
```
GET    /users                    # List all users
POST   /users                    # Create new user
PUT    /users/:id                # Update user
DELETE /users/:id                # Delete user
```

### Network Routes
```
GET    /network_routes           # List routes with filtering
POST   /network_routes           # Create new route
PUT    /network_routes/:id       # Update route
DELETE /network_routes/:id       # Delete route
GET    /network_routes_export    # CSV export
```

### Network Design & Pricing
```
POST   /network_design/find_path        # Path finding algorithm
POST   /network_design/calculate_pricing # Pricing calculations
POST   /network_design/generate_kmz     # KMZ file generation
```

### Location Management
```
GET    /locations                       # List all locations
POST   /locations                       # Create location
PUT    /locations/:id                   # Update location
DELETE /locations/:id                   # Delete location
PUT    /locations/:id/minimum-pricing   # Update pricing (Admin only)
GET    /locations/:id/capabilities      # Get POP capabilities
POST   /locations/:id/capabilities      # Update capabilities
```

### CNX Colocation Management
```
GET    /cnx-colocation/locations                  # List CNX-enabled locations
PUT    /cnx-colocation/locations/:id              # Update location design & info
GET    /cnx-colocation/locations/:locationId/racks # List racks for location
POST   /cnx-colocation/locations/:locationId/racks # Create rack with pricing file
PUT    /cnx-colocation/racks/:rackId              # Update rack with file management
DELETE /cnx-colocation/racks/:rackId              # Delete rack (if no clients)
GET    /cnx-colocation/racks/:rackId/clients      # List clients for rack
POST   /cnx-colocation/racks/:rackId/clients      # Create client with design file
PUT    /cnx-colocation/clients/:clientId          # Update client with design file
DELETE /cnx-colocation/clients/:clientId          # Delete client
```

### Carriers & Exchange Rates
```
GET    /carriers                 # List carriers
POST   /carriers                 # Create carrier
PUT    /carriers/:id             # Update carrier
DELETE /carriers/:id             # Delete carrier

GET    /exchange_rates           # List exchange rates
PUT    /exchange_rates/:id       # Update rate (Admin only)
```

## 🔧 Configuration Options

### Environment Variables
```bash
# Server Configuration
PORT=4000
NODE_ENV=production

# Security
JWT_SECRET=your-secure-secret-key
JWT_EXPIRES_IN=24h

# Database
DB_PATH=./network_routes.db

# File Upload
MAX_FILE_SIZE=50MB
UPLOAD_PATH=./uploads
```

### Development Configuration
```javascript
// config/development.js
module.exports = {
  port: 4000,
  database: {
    filename: './network_routes.db'
  },
  jwt: {
    secret: 'development-secret',
    expiresIn: '24h'
  }
};
```

## 🔍 API Usage Examples

### Authentication
```javascript
// Login
POST /login
{
  "username": "admin",
  "password": "admin123"
}

// Response
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "administrator"
  },
  "permissions": {
    "network_routes": { "can_view": true, "can_create": true, ... },
    "locations": { "can_view": true, "can_edit": true, ... }
  }
}
```

### Pricing Calculation
```javascript
// Calculate pricing
POST /network_design/calculate_pricing
{
  "paths": [
    {
      "routes": [
        { "circuit_id": "LONNYCABC123456", "cost": 1000, "bandwidth": 1000 }
      ]
    }
  ],
  "bandwidth": 100,
  "source": "LON",
  "destination": "NYC",
  "contract_term": 12,
  "output_currency": "USD"
}

// Response includes allocated costs, margins, and location minimums
```

### Location Management
```javascript
// Update minimum pricing (Admin only)
PUT /locations/1/minimum-pricing
{
  "min_price_under_100mb": 150.00,
  "min_price_100_to_999mb": 500.00,
  "min_price_1000_to_2999mb": 1200.00,
  "min_price_3000mb_plus": 2500.00
}
```

### CNX Colocation Management
```javascript
// Create rack with pricing file upload
POST /cnx-colocation/locations/1/racks
FormData:
{
  "rack_id": "RACK-001",
  "total_power_kva": "10.5",
  "network_infrastructure": "Cisco switches, Dell servers",
  "more_info": "Primary rack for colocation clients",
  "pricing_info_file": [Excel file]
}

// Create client with design file
POST /cnx-colocation/racks/1/clients
FormData:
{
  "client_name": "TechCorp Solutions",
  "power_purchased": "2.5",
  "ru_purchased": "4",
  "more_info": "Development environment setup",
  "client_design_file": [PDF file]
}

// Response includes updated calculations
{
  "id": 5,
  "client_name": "TechCorp Solutions", 
  "message": "Client created successfully"
}
```

## 🛡 Security Features

### Authentication Security
- **JWT Tokens**: Secure, stateless authentication
- **Password Hashing**: Bcrypt with configurable salt rounds
- **Session Management**: Token expiration and refresh
- **Role Validation**: Server-side permission checking

### Data Protection
- **Input Validation**: Strict validation on all endpoints
- **SQL Injection Prevention**: Parameterized queries
- **File Upload Security**: Type and size restrictions
- **CORS Configuration**: Proper cross-origin handling

### Audit & Compliance
- **Change Logging**: Complete audit trail of modifications
- **User Activity**: Login and action tracking
- **Data Integrity**: Foreign key constraints and validation
- **Access Control**: Role-based endpoint protection

## 📈 Performance Considerations

### Database Optimization
- **Indexing**: Strategic indexes on frequently queried fields
- **Query Optimization**: Efficient SQL patterns
- **Connection Pooling**: Reuse of database connections
- **Transaction Management**: Proper transaction boundaries

### File Management
- **Upload Limits**: Configurable file size restrictions (10MB for PDFs/Excel)
- **Storage Optimization**: Efficient file organization in dedicated directories
- **File Types**: KMZ, PDF (design files), Excel (pricing), test results
- **Cleanup Processes**: Automated temporary file removal and orphaned file cleanup
- **ZIP Compression**: Bulk download optimization
- **Security**: File type validation and secure storage paths

### Memory Management
- **Stream Processing**: Large file handling
- **Garbage Collection**: Proper resource cleanup
- **Connection Limits**: Configurable concurrency
- **Cache Management**: Efficient data caching

## 🔧 Development & Debugging

### Development Tools
```bash
# Start with debugging
npm run debug

# Run with specific log level
LOG_LEVEL=debug npm start

# Database inspection
sqlite3 network_routes.db ".tables"
sqlite3 network_routes.db ".schema"
```

### Logging
- **Winston**: Structured logging framework
- **Log Levels**: Error, warn, info, debug
- **Log Rotation**: Automatic log file management
- **Request Logging**: HTTP request/response tracking

### Testing
```bash
# Run tests (if available)
npm test

# API testing with curl
curl -X POST http://localhost:4000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 🚀 Deployment

### Production Checklist
- [ ] Change default admin password
- [ ] Set secure JWT secret
- [ ] Configure environment variables
- [ ] Set up database backups
- [ ] Configure log rotation
- [ ] Set up monitoring

### Windows Service Setup
```bash
# Install PM2 globally
npm install -g pm2 pm2-windows-service

# Setup service
pm2-service-install

# Start application
pm2 start index.js --name "network-inventory-backend"
pm2 save
```

### Docker Deployment (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
```

## 🔄 Maintenance

### Regular Tasks
- **Database Backup**: Regular SQLite file backup
- **Log Rotation**: Manage log file sizes
- **Security Updates**: Keep dependencies updated
- **Performance Monitoring**: Monitor resource usage

### Database Maintenance
```bash
# Backup database
cp network_routes.db network_routes_backup_$(date +%Y%m%d).db

# Optimize database
sqlite3 network_routes.db "VACUUM;"

# Check integrity
sqlite3 network_routes.db "PRAGMA integrity_check;"
```

## 📞 Support & Troubleshooting

### Common Issues

**Database locked errors**:
- Ensure only one application instance is running
- Check file permissions
- Restart the application

**Authentication failures**:
- Verify JWT secret configuration
- Check token expiration settings
- Validate user credentials

**File upload issues**:
- Check upload directory permissions
- Verify file size limits
- Ensure adequate disk space

### Debug Information
```bash
# Check application status
curl http://localhost:4000/health

# View recent logs
tail -f logs/application.log

# Database connection test
node -e "const db = require('./db'); console.log('Database connected');"
```

## 📄 License & Version

- **Version**: 2.1
- **Node.js Compatibility**: v16+
- **Database**: SQLite 3
- **Latest Features**: CNX Colocation Management with client design file uploads
- **Last Updated**: January 2025

---

For frontend integration and complete setup instructions, see the main [README.md](../README.md) and [SETUP_GUIDE.md](../SETUP_GUIDE.md). 