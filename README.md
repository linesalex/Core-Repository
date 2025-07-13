# Network Inventory

A comprehensive full-stack application for managing global telecommunications network inventory across multiple repositories, including network routes, dark fiber details, DWDM channel reservations, and more.

## Features

### Core Functionality
- **Multiple Repository Support**: Expandable architecture supporting different types of network inventories
- **Network Routes Repository**: Add, edit, delete, and view network routes with advanced filtering
- **Search & Export**: Powerful search functionality and CSV export capabilities
- **File Management**: KMZ file uploads and multiple test results file handling with ZIP downloads

### Advanced Features
- **Dark Fiber Management**: Comprehensive DWDM channel tracking with wavelength and equipment details
- **Reservation System**: 60-day reservation system for DWDM UCNs with automatic expiry
- **Real-time Notifications**: Popup notifications for reservation actions and status updates
- **Circuit ID Management**: Strict validation and non-editable circuit IDs (UCN format: 6 letters + 6 digits)

### User Interface
- **Modern React UI**: Clean, responsive interface with Material-UI components
- **Sidebar Navigation**: Organized repository structure with expandable sections
- **Enhanced Modals**: Large, clear displays for detailed information and actions
- **Status Indicators**: Visual chips and indicators for reservation status and expiry dates

## Technical Stack
- **Frontend**: React 18, Material-UI, Axios
- **Backend**: Node.js, Express, SQLite3
- **Features**: Multiple file uploads, ZIP archive creation, reservation tracking

## Requirements
- Node.js (v16 or later)
- npm
- SQLite3

## Database Schema
The application supports a multi-repository architecture with:
- **Repository Types**: Extensible repository management
- **Network Routes**: Core network route data with timestamps
- **Dark Fiber Details**: DWDM channel management with reservation system
- **File Management**: KMZ and test results file tracking
- **Reservation Logs**: Complete audit trail of reservation activities

## Installation & Setup

### 1. Backend Setup
```bash
cd backend
npm install
node init_db.js  # Initialize database with new schema
npm run dev      # Start development server on port 5000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm start        # Start development server on port 3000
```

### 3. Database Migration
If upgrading from the previous version, run the database initialization script to update the schema:
```bash
cd backend
node init_db.js
```

## New Features Added

### 1. Application Rebranding
- Renamed from "Network Routes Repository" to "Network Inventory"
- Updated sidebar navigation with expandable repository sections

### 2. Enhanced Circuit ID Management
- Circuit ID (UCN) shown as non-editable field during editing
- Clear visual indication that Circuit ID cannot be changed
- Blank fields ensured when adding new entries

### 3. Dark Fiber Enhancements
- **DWDM UCN Field**: Individual circuit ID for distinguishing DWDM channels
- **Reservation System**: 60-day reservation capability with one-click booking
- **Status Tracking**: Visual indicators for reserved, expired, and available channels
- **Larger Modal**: Expanded view for better data visibility

### 4. File Management Improvements
- **Multiple File Upload**: Support for uploading multiple test results files
- **ZIP Downloads**: Automatic ZIP file creation for downloading all test results
- **File Management**: Individual file deletion and management capabilities

### 5. Database Architecture
- **Multi-Repository Support**: Ready for additional repository types
- **Reservation Tracking**: Complete audit trail with automatic expiry handling
- **Enhanced Schema**: Timestamps, foreign key relationships, and data integrity

## Usage

### Adding Network Routes
1. Navigate to Network Routes Repository in the sidebar
2. Click "Add" to create a new route
3. All fields will be blank for new entries
4. Circuit ID must follow UCN format (6 letters + 6 digits)

### Managing Dark Fiber
1. Click "More Details" on any network route
2. Access the Dark Fiber modal for DWDM channel management
3. Add DWDM UCN for individual channel identification
4. Use one-click reservation system for 60-day bookings

### File Management
1. Upload multiple test results files during route creation/editing
2. Download all test results as a ZIP file using the download button
3. Individual file management available in the interface

## API Endpoints

### Network Routes
- `GET /api/network_routes` - List all routes
- `POST /api/network_routes` - Create new route
- `PUT /api/network_routes/:id` - Update route
- `DELETE /api/network_routes/:id` - Delete route

### Dark Fiber & Reservations
- `GET /api/dark_fiber_details/:circuit_id` - Get dark fiber details
- `POST /api/dark_fiber_details/:id/reserve` - Reserve DWDM UCN
- `POST /api/dark_fiber_details/:id/release` - Release reservation

### File Management
- `POST /api/network_routes/:id/upload_test_results` - Upload multiple files
- `GET /api/network_routes/:id/download_test_results` - Download ZIP archive
- `DELETE /api/test_results_files/:id` - Delete individual file

## Development Notes

### Future Expansion
The architecture supports easy addition of new repository types:
1. Add new repository type to database
2. Create corresponding UI components
3. Add to sidebar navigation structure

### Reservation System
- Automatic expiry after 60 days
- Complete audit trail in reservation_logs table
- Real-time status updates and notifications

---

**Network Inventory** - Comprehensive telecommunications network management solution 