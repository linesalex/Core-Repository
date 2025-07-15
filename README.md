# Network Inventory Management System

A comprehensive enterprise-grade application for managing global telecommunications network infrastructure, featuring advanced pricing calculations, user authentication, and multi-tier location management.

## 🚀 Quick Start

**For detailed Windows setup instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md)**

```bash
# Backend Setup
cd backend
npm install
node init_db.js
npm start

# Frontend Setup (new terminal)
cd frontend
npm install
npm start
```

**Default Login**: Username: `admin`, Password: `admin123`

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

### 💰 Exchange Rates Management
- **Multi-currency Support**: Real-time currency conversion
- **Rate Management**: Administrative control over exchange rates
- **Pricing Integration**: Seamless integration with pricing calculations

### 📋 Advanced Data Management
- **Location Reference**: 
  - POP capabilities matrix (12 different service types)
  - Minimum pricing tiers (4 bandwidth categories)
  - Access information and provider details
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
│   │   └── [other components]
│   └── package.json        # Frontend dependencies
├── SETUP_GUIDE.md          # Comprehensive Windows setup guide
└── README.md               # This file
```

## 🔑 Default Permissions Matrix

| Role          | Network Routes | Locations | Pricing | Users | Change Logs |
|---------------|----------------|-----------|---------|-------|-------------|
| Administrator | Full Access    | Full      | Full    | Full  | View        |
| Provisioner   | Create/Edit    | Create/Edit| View   | None  | View        |
| Read Only     | View Only      | View      | View    | None  | None        |

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

### Network Design
- `POST /network_design/find_path` - Path finding algorithm
- `POST /network_design/calculate_pricing` - Pricing calculations
- `POST /network_design/generate_kmz` - KMZ file generation

### Locations & Pricing
- `GET /locations` - List all locations
- `PUT /locations/:id/minimum-pricing` - Update minimum pricing (Admin only)
- `GET /locations/:id/capabilities` - Get POP capabilities

## 📊 Database Schema

### Core Tables
- **users**: User accounts and roles
- **role_permissions**: Permission matrix
- **network_routes**: Network route inventory
- **location_reference**: POP database with pricing tiers
- **carriers**: Carrier information with regional support
- **exchange_rates**: Currency conversion rates
- **change_logs**: Complete audit trail

### Enhanced Features
- **Minimum Pricing**: 4-tier pricing structure per location
- **POP Capabilities**: 12-field capability matrix
- **Regional Carriers**: Support for same carrier in different regions
- **Flexible Capacity**: 0-1000% capacity usage range

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

**Version**: 2.0  
**Last Updated**: January 2025  
**Compatibility**: Windows 10+, Node.js 16+, Modern Browsers 