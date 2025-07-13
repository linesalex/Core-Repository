# Network Inventory Backend

Enterprise-grade Node.js backend for the Network Inventory management system, supporting multiple repositories, dark fiber management, and advanced reservation systems.

## Features

### Core API Functionality
- **Multiple Repository Support**: Extensible architecture for different inventory types
- **Network Routes Management**: Full CRUD operations with advanced filtering
- **Dark Fiber Management**: DWDM channel tracking with wavelength details
- **Reservation System**: 60-day automatic reservation system with audit trails
- **File Management**: Multiple file uploads with ZIP archive creation
- **Search & Export**: Advanced filtering and CSV export capabilities

### Advanced Features
- **Automatic Expiry**: Database triggers for reservation management
- **Audit Logging**: Complete reservation history tracking
- **File Handling**: KMZ uploads and multiple test results files
- **Data Validation**: Strict Circuit ID (UCN) format validation
- **CORS Support**: Configured for frontend integration

## Requirements
- Node.js (v16 or later recommended)
- npm (comes with Node.js)
- SQLite3

## Dependencies
- **express**: Web framework
- **sqlite3**: Database engine
- **multer**: File upload handling
- **archiver**: ZIP file creation for downloads
- **json2csv**: CSV export functionality
- **cors**: Cross-origin resource sharing

## Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Database Setup

#### For New Installation:
```bash
node init_db.js
```

#### For Existing Database Migration:
```bash
node migrate_db.js
```
This safely upgrades your existing database to support all Network Inventory features without data loss.

### 3. Start the Server

#### Development Mode (with auto-reload):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

### 4. API Access
- **Base URL**: http://localhost:4000
- **API Documentation**: See endpoints section below

## Database Schema

### Core Tables
- **repository_types**: Manages different inventory repository types
- **network_routes**: Main network route data with multi-repository support
- **dark_fiber_details**: DWDM channel management with reservation system
- **reservation_logs**: Complete audit trail for all reservation activities
- **test_results_files**: Multiple file tracking with metadata
- **kmz_files**: KMZ file management

### Key Features
- **Automatic Timestamps**: Created/updated tracking for all records
- **Foreign Key Constraints**: Data integrity enforcement
- **Database Triggers**: Automatic reservation expiry and logging
- **Extensible Design**: Easy addition of new repository types

## File Storage

### Directory Structure
```
backend/
├── kmz_files/          # KMZ file uploads
├── test_results_files/ # Test results file uploads
└── ...
```

### File Management
- **KMZ Files**: Single file per circuit with automatic naming
- **Test Results**: Multiple files per circuit with ZIP download
- **Automatic Cleanup**: Orphaned file management
- **File Validation**: Type and size restrictions

## API Endpoints

### Network Routes
- `GET /network_routes` - List all routes (with optional filtering)
- `GET /network_routes/:id` - Get specific route details
- `POST /network_routes` - Create new route
- `PUT /network_routes/:id` - Update existing route
- `DELETE /network_routes/:id` - Delete route
- `GET /network_routes_search` - Advanced search with filters
- `GET /network_routes_export` - Export routes to CSV

### Dark Fiber & Reservations
- `GET /dark_fiber_details/:circuit_id` - Get DWDM channel details
- `POST /dark_fiber_details` - Add new DWDM channel
- `PUT /dark_fiber_details/:id` - Update DWDM channel
- `DELETE /dark_fiber_details/:id` - Delete DWDM channel
- `POST /dark_fiber_details/:id/reserve` - Reserve DWDM UCN (60 days)
- `POST /dark_fiber_details/:id/release` - Release reservation

### File Management
- `POST /network_routes/:id/upload_kmz` - Upload KMZ file
- `POST /network_routes/:id/upload_test_results` - Upload multiple test results
- `GET /network_routes/:id/download_test_results` - Download test results as ZIP
- `GET /network_routes/:id/test_results_files` - List test results files
- `DELETE /test_results_files/:id` - Delete individual test results file

### Repository Management
- `GET /repository_types` - List all repository types
- `POST /repository_types` - Create new repository type

## Environment Variables
- `PORT`: Server port (default: 4000)
- `NODE_ENV`: Environment mode (development/production)

## Error Handling
- **Validation Errors**: Circuit ID format validation
- **File Upload Errors**: Size and type restrictions
- **Database Errors**: Constraint violations and data integrity
- **CORS Errors**: Cross-origin request handling

## Security Features
- **Input Validation**: All API inputs validated
- **File Type Restrictions**: Only allowed file types accepted
- **SQL Injection Protection**: Parameterized queries
- **Error Sanitization**: Sensitive information protection

## Performance Considerations
- **Database Indexing**: Optimized queries for large datasets
- **File Streaming**: Efficient file upload/download handling
- **Connection Pooling**: Database connection management
- **Caching**: Static file serving optimization

## Migration Guide

### From Network Routes Repository v1.0
1. **Backup your database**: Copy `network_routes.db`
2. **Install new dependencies**: `npm install`
3. **Run migration**: `node migrate_db.js`
4. **Verify data integrity**: Check all existing routes are preserved
5. **Test new features**: Reservations, file management, etc.

## Development

### Adding New Repository Types
1. **Database**: Add entry to `repository_types` table
2. **API**: Create specific endpoints if needed
3. **Frontend**: Add UI components for new repository type

### Custom Validation
- **Circuit ID Format**: Modify `CIRCUIT_ID_REGEX` in routes.js
- **File Types**: Update multer configuration
- **Business Rules**: Add custom validation middleware

## Troubleshooting

### Common Issues
- **Module not found**: Run `npm install` to install dependencies
- **Database locked**: Ensure no other processes are using the database
- **File permissions**: Check write permissions for upload directories
- **CORS errors**: Verify frontend URL in CORS configuration

### Log Files
- **Console output**: Server logs displayed in terminal
- **Error tracking**: Check console for detailed error messages
- **Database queries**: Enable SQLite logging for debugging

---

**Network Inventory Backend** - Powering comprehensive telecommunications inventory management 