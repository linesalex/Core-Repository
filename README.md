# Network Inventory Management System

A comprehensive enterprise-grade application for managing global telecommunications network infrastructure, featuring advanced pricing calculations, user authentication, and multi-tier location management.

## 🚀 Quick Start

**For detailed Windows setup instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md)**

```bash
# Backend Setup
cd backend
npm install
node init_db.js
node migration_script.js  # Run database migrations
npm start

# Frontend Setup (new terminal)
cd frontend
npm install
npm start
```

**Default Login**: Username: `admin`, Password: `admin123`

⚠️ **IMPORTANT**: Change the default password immediately after first login!

## ✨ Key Features

### 🔐 Authentication & Authorization
- **Role-based Access Control**: Administrator, Provisioner, and Read-only roles
- **Permission System**: Granular permissions for each module and action
- **User Management**: Complete user lifecycle management with activity logging
- **Secure Authentication**: JWT-based authentication with session management

### 🌐 Network Design & Pricing Tool
- **Advanced Path Finding**: Intelligent routing with protection path calculations
- **Dynamic Pricing Engine**: 
  - Layer 2 pricing with bandwidth allocation
  - Minimum price enforcement by location and bandwidth tier
  - 40% minimum and 60% suggested margin calculations
  - Multi-currency support with real-time exchange rates
- **Location Management**: Comprehensive POP database with capabilities tracking
- **Carrier Management**: Multi-regional carrier database with contact management

### 🔧 Network Routes Management
- **CRUD Operations**: Full lifecycle management of network routes
- **Advanced Search**: Multi-criteria filtering and search capabilities
- **File Management**: KMZ uploads and test results file handling
- **CSV Export**: Comprehensive data export functionality
- **Dark Fiber Support**: DWDM channel management with reservation system

### 📊 Core Outages & Monitoring
- **Outage Tracking**: Incident management and tracking
- **Status Monitoring**: Real-time status updates and notifications
- **Reporting**: Comprehensive outage reporting and analytics

### 💰 Exchange Rates & Pricing Management
- **Multi-currency Support**: Real-time currency conversion across all pricing tools
- **Rate Management**: Administrative control over exchange rates
- **Exchange Pricing Tool**: Quick quote system for exchange feed pricing
- **Enhanced Pricing Logs**: Comprehensive audit trails with user tracking and export capabilities
- **Pricing Integration**: Seamless integration with all pricing calculations

### 🏢 CNX Colocation Management
- **Multi-level Expandable Interface**: 
  - Location → Rack → Client hierarchy with inline expansion
  - Real-time calculations and data visualization
- **Comprehensive Rack Management**:
  - Total power allocation and consumption tracking
  - RU (Rack Unit) utilization with 30U rack capacity display
  - Network infrastructure and pricing file management
- **Client Management**:
  - Individual client power and space allocation
  - Design file uploads (PDF) for each client
  - Automatic calculation updates when clients are modified
- **File Management**:
  - Location design files (PDF)
  - Rack pricing information (Excel)
  - Client design documentation (PDF)
- **Role-based Permissions**: Full CRUD operations with proper authorization
- **Data Integrity**: Prevents deletion of racks with active clients

### 📋 Advanced Data Management
- **Location Reference**: 
  - POP capabilities matrix (12 different service types)
  - Minimum pricing tiers (4 bandwidth categories)
  - Access information and provider details
- **Bulk Upload System**: 
  - CSV templates for all major data types (network routes, locations, carriers, users, exchanges, etc.)
  - Comprehensive field mapping including all database fields
  - Data validation and error reporting
  - Template generation and database export capabilities
- **Exchange Data Management**: 
  - Complete exchange and feed management
  - ISF (Infrastructure Service Fee) tracking
  - Pass-through fees and pricing management
- **Change Auditing**: Complete audit trail of all system changes
- **Data Validation**: Strict validation rules and format enforcement

## 🛠 Technical Architecture

### Frontend Stack
- **React 18**: Modern component-based UI framework
- **Material-UI v5**: Enterprise-grade UI component library
- **Axios**: HTTP client for API communication
- **React Router**: Client-side routing and navigation

### Backend Stack
- **Node.js**: Server runtime environment
- **Express.js**: Web application framework
- **SQLite3**: Embedded database engine
- **JWT**: JSON Web Token authentication
- **Multer**: File upload handling
- **Bcrypt**: Password hashing and security

### Key Integrations
- **CSV Export**: Advanced data export capabilities
- **KMZ File Handling**: Geographic data management
- **Multi-file Uploads**: Batch file processing
- **PDF File Management**: Secure design document storage and management
- **Excel File Processing**: Pricing spreadsheet uploads and validation
- **Real-time Validation**: Client and server-side validation

## 📁 Project Structure

```
network-inventory/
├── backend/                 # Node.js/Express API server
│   ├── routes.js           # Main API routes and endpoints
│   ├── auth.js             # Authentication middleware
│   ├── db.js               # Database connection and utilities
│   ├── init_db.js          # Database initialization script
│   ├── migration_script.js # Database migration utilities
│   └── package.json        # Backend dependencies
├── frontend/               # React application
│   ├── src/
│   │   ├── api.js          # API integration layer
│   │   ├── App.js          # Main application component
│   │   ├── AuthContext.js  # Authentication state management
│   │   ├── NetworkDesignTool.js     # Pricing and path finding
│   │   ├── LocationDataManager.js  # Location management
│   │   ├── NetworkRoutesTable.js   # Routes management
│   │   ├── CNXColocationManager.js # CNX Colocation management
│   │   └── [other components]
│   └── package.json        # Frontend dependencies
├── SETUP_GUIDE.md          # Comprehensive Windows setup guide
└── README.md               # This file
```

## 🔑 Default Permissions Matrix

| Role          | Network Routes | Locations | CNX Colocation | Pricing | Users | Change Logs |
|---------------|----------------|-----------|----------------|---------|-------|-------------|
| Administrator | Full Access    | Full      | Full Access    | Full    | Full  | View        |
| Provisioner   | Create/Edit    | Create/Edit| Create/Edit   | View    | None  | View        |
| Read Only     | View Only      | View      | View Only      | View    | None  | None        |

## 🎯 Core Business Logic

### Pricing Calculation Engine
- **Bandwidth Allocation**: Utilizes 90% capacity factor for cost distribution
- **Tiered Minimums**: 4-tier minimum pricing (<100Mb, 100-999Mb, 1000-2999Mb, 3000Mb+)
- **Protection Pricing**: 100% primary + 70% secondary path costs
- **Margin Enforcement**: Automatic enforcement of minimum margins by location

### Location Management
- **POP Capabilities**: 12 service capability flags per location
- **Status Tracking**: Active, Under Construction, Under Decommission
- **Provider Integration**: Full provider and access information tracking
- **Geographic Organization**: Country and city-based organization

### Security Features
- **Password Encryption**: Bcrypt with salt rounds for secure storage
- **Session Management**: JWT with configurable expiration
- **Permission Validation**: Server-side permission checking on all endpoints
- **Activity Logging**: Comprehensive audit trail of user actions

## 🚦 API Endpoints

### Authentication
- `POST /login` - User authentication
- `GET /me` - Current user profile
- `PUT /change-password` - Password modification

### Network Routes
- `GET /network_routes` - List all routes
- `POST /network_routes` - Create new route
- `PUT /network_routes/:id` - Update route
- `DELETE /network_routes/:id` - Delete route

### Network Design & Pricing
- `POST /network_design/find_path` - Path finding algorithm
- `POST /network_design/calculate_pricing` - Pricing calculations with contract terms
- `GET /network_design/audit_logs` - Pricing calculation audit logs
- `DELETE /network_design/audit_logs` - Clear pricing logs (Admin/Provisioner)
- `GET /network_design/audit_logs/export` - Export pricing logs to CSV

### Locations & Pricing
- `GET /locations` - List all locations
- `PUT /locations/:id/minimum-pricing` - Update minimum pricing (Admin only)
- `GET /locations/:id/capabilities` - Get POP capabilities

### CNX Colocation
- `GET /cnx-colocation/locations` - List CNX-enabled locations
- `PUT /cnx-colocation/locations/:id` - Update location design & info
- `GET /cnx-colocation/locations/:locationId/racks` - List racks for location
- `POST /cnx-colocation/locations/:locationId/racks` - Create rack with pricing file
- `PUT /cnx-colocation/racks/:rackId` - Update rack with file management
- `DELETE /cnx-colocation/racks/:rackId` - Delete rack (if no clients)
- `GET /cnx-colocation/racks/:rackId/clients` - List clients for rack
- `POST /cnx-colocation/racks/:rackId/clients` - Create client with design file
- `PUT /cnx-colocation/clients/:clientId` - Update client with design file
- `DELETE /cnx-colocation/clients/:clientId` - Delete client

### Exchange Pricing
- `POST /exchange-pricing/quotes` - Create pricing quote
- `GET /exchange-pricing/quotes` - Quote history with search
- `GET /exchange-pricing/regions` - Available regions
- `GET /exchange-pricing/exchanges/:region` - Exchanges by region
- `GET /exchange-pricing/feeds/:exchangeId` - Feeds by exchange
- `GET /exchange-pricing/audit_logs` - Pricing quote audit logs
- `DELETE /exchange-pricing/audit_logs` - Clear pricing logs (Admin/Provisioner)
- `GET /exchange-pricing/audit_logs/export` - Export pricing logs to CSV

### Bulk Upload
- `GET /bulk-upload/modules` - Available upload modules
- `GET /bulk-upload/template/:module` - Download CSV template
- `POST /bulk-upload/:module` - Upload CSV data
- `GET /bulk-upload/history` - Upload history and status

## 📊 Database Schema

### Core Tables
- **users**: User accounts with roles and module visibility
- **role_permissions**: Granular permission matrix
- **network_routes**: Network route inventory with enhanced tracking
- **location_reference**: POP database with comprehensive location data
- **carriers**: Multi-regional carrier database
- **carrier_contacts**: Carrier contact management
- **exchange_rates**: Multi-currency conversion rates
- **change_logs**: Complete audit trail of all changes
- **audit_logs**: Pricing calculation and system activity logs

### Exchange Management Tables
- **exchanges**: Exchange provider information
- **exchange_feeds**: Feed details with ISF and pricing data
- **exchange_contacts**: Exchange contact information
- **quote_requests**: Exchange pricing quote history

### CNX Colocation Tables
- **cnx_colocation_racks**: Rack inventory with power, infrastructure, and pricing files
- **cnx_colocation_clients**: Client details with power/RU allocation and design files

### Enhanced Features
- **Comprehensive Pricing Logs**: Enhanced audit trails with user tracking and IP logging
- **Bulk Upload System**: CSV import for all major data types
- **Exchange Pricing**: Quick quote system with comprehensive feed management
- **POP Capabilities**: 12-field capability matrix per location
- **Regional Support**: Multi-regional carriers and exchanges
- **User Module Visibility**: Granular UI control per user

## 🔧 Development

### Prerequisites
- Node.js v16+ (v18+ recommended)
- npm v8+
- Modern web browser
- Windows 10+ (for production deployment)

### Development Setup
```bash
# Clone repository
git clone [repo-url]
cd network-inventory

# Backend development
cd backend
npm install
npm run dev  # Development server with auto-reload

# Frontend development
cd frontend
npm install
npm start    # React development server
```

### Build for Production
```bash
# Frontend production build
cd frontend
npm run build

# Backend production mode
cd backend
NODE_ENV=production npm start
```

## 🛡 Security Considerations

### Authentication Security
- JWT tokens with secure expiration
- Bcrypt password hashing (10 salt rounds)
- Role-based access control on all endpoints
- Session invalidation on logout

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- File upload restrictions and validation
- Cross-origin resource sharing (CORS) configuration

### Production Security
- Environment variable configuration
- Secure database file permissions
- Regular security updates for dependencies
- Audit logging for compliance

## 📈 Performance & Scalability

### Current Capacity
- SQLite database (suitable for thousands of records)
- File-based storage for uploads
- In-memory session management

### Optimization Features
- Database indexing on key fields
- Efficient query patterns
- Client-side data caching
- Compressed file uploads

### Scaling Considerations
- Database migration path to PostgreSQL/MySQL
- File storage migration to cloud services
- Load balancing for multiple instances
- Redis integration for session management

## 🔄 Maintenance & Updates

### Regular Maintenance
- Database optimization and cleanup
- File storage management
- Security patches and updates
- User access reviews

### Monitoring
- Application logs and error tracking
- Database performance monitoring
- File storage capacity tracking
- User activity analysis

## 📞 Support & Documentation

### Getting Help
1. Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for installation issues
2. Review component-specific README files in `/backend` and `/frontend`
3. Check application logs for error details
4. Consult the troubleshooting section in setup guide

### Documentation
- **Backend API**: See `/backend/README.md`
- **Frontend Components**: See `/frontend/README.md`
- **Database Schema**: See `network_routes_schema.sql`
- **Windows Setup**: See `SETUP_GUIDE.md`

## 📄 License & Usage

This is an enterprise network inventory management system designed for telecommunications infrastructure management. Ensure proper backup and security measures are in place before production deployment.

---

**Version**: 2.2  
**Last Updated**: January 2025  
**Latest Features**: Enhanced Pricing Logs, Comprehensive Bulk Upload System, Exchange Pricing Tool  
**Compatibility**: Windows 10+, Node.js 16+, Modern Browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+) 