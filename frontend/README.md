# Network Inventory Frontend

Modern React-based frontend for the Network Inventory management system, featuring comprehensive telecommunications inventory management with advanced UI components and user experience.

## Features

### Core UI Components
- **Responsive Design**: Modern Material-UI components with mobile support
- **Sidebar Navigation**: Expandable repository structure with organized sections
- **Advanced Modals**: Large, clear displays for detailed information management
- **Real-time Notifications**: Popup alerts for actions and status updates
- **Data Tables**: Sortable, filterable tables with advanced search capabilities

### Network Inventory Features
- **Multiple Repository Support**: Organized sidebar with expandable sections
- **Circuit ID Management**: Non-editable display during editing with visual indicators
- **Dark Fiber Management**: Enhanced modal with DWDM channel tracking
- **Reservation System**: One-click reservations with 60-day tracking
- **File Management**: Multiple file uploads with visual progress indicators
- **Search & Export**: Advanced filtering and CSV export functionality

### User Experience
- **Visual Status Indicators**: Chips and badges for reservation status
- **Form Validation**: Real-time validation with helpful error messages
- **Loading States**: Smooth loading indicators for all operations
- **Confirmation Dialogs**: Safe deletion and action confirmations
- **Accessibility**: ARIA labels and keyboard navigation support

## Requirements
- Node.js (v16 or later recommended)
- npm (comes with Node.js)
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Dependencies

### Core Framework
- **react**: Frontend framework (v18.2.0)
- **react-dom**: DOM manipulation
- **react-scripts**: Build tools and development server

### UI Components
- **@mui/material**: Material-UI component library
- **@mui/icons-material**: Material Design icons
- **@emotion/react**: CSS-in-JS styling
- **@emotion/styled**: Styled components

### Utilities
- **axios**: HTTP client for API communication
- **react-csv**: CSV export functionality

## Setup

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Development Server
```bash
npm start
```

### 3. Build for Production
```bash
npm run build
```
The production build will be in the `build/` directory.

### 4. Access the Application
- **Development**: http://localhost:3000
- **Production**: Serve the `build/` directory with a web server

## Application Structure

### Core Components
```
src/
├── App.js                 # Main application component
├── api.js                # API communication layer
├── NetworkRoutesTable.js # Main data table component
├── RouteFormDialog.js    # Add/Edit route dialog
├── DarkFiberModal.js     # Dark fiber management modal
├── SearchExportBar.js    # Search and export functionality
└── index.js              # Application entry point
```

### Key Features
- **Modular Design**: Reusable components for easy maintenance
- **State Management**: React hooks for efficient state handling
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Responsive Layout**: Adaptive design for all screen sizes

## User Interface

### Sidebar Navigation
- **Network Routes Repository**: Expandable section with dropdown
- **Add/Edit/Delete**: Context-aware actions based on selection
- **Future Repositories**: Ready for additional inventory types
- **Visual Indicators**: Clear active state and selection feedback

### Main Dashboard
- **Data Grid**: Comprehensive table with sorting and filtering
- **Search Bar**: Real-time search with multiple field support
- **Export Options**: CSV download with custom field selection
- **Action Buttons**: Context-sensitive operations

### Dark Fiber Modal
- **Enhanced Layout**: Extra-large modal (xl) for better visibility
- **DWDM UCN Tracking**: Individual circuit identification
- **Reservation System**: One-click booking with visual status
- **Status Indicators**: Color-coded chips for reserved/expired items
- **Audit Trail**: Complete history of reservation activities

### File Management
- **Multiple Upload**: Drag-and-drop or click to select multiple files
- **Progress Indicators**: Visual feedback during upload process
- **File Chips**: Removable tags showing selected files
- **ZIP Downloads**: Automatic archive creation for bulk downloads

## API Integration

### Connection Configuration
- **Base URL**: http://localhost:4000 (configurable)
- **CORS**: Cross-origin requests enabled
- **Error Handling**: Comprehensive error catching and user feedback
- **Loading States**: UI feedback for all API operations

### Key API Endpoints
- **Network Routes**: Full CRUD operations with search
- **Dark Fiber**: DWDM channel management
- **Reservations**: 60-day booking system
- **File Management**: Multiple file handling
- **Repository Types**: Multi-repository support

## Form Validation

### Circuit ID (UCN) Rules
- **Format**: 6 uppercase letters + 6 digits (e.g., LONLON123456)
- **Editing**: Non-editable during edit mode with visual indication
- **Adding**: Blank field with format validation
- **Error Messages**: Clear, helpful validation feedback

### File Upload Validation
- **KMZ Files**: Single file per circuit
- **Test Results**: Multiple files with size limits
- **File Types**: Restricted to allowed formats
- **Visual Feedback**: Progress bars and success indicators

## Responsive Design

### Breakpoints
- **Mobile**: < 768px - Stacked layout with collapsible sidebar
- **Tablet**: 768px - 1024px - Responsive grid with adjusted spacing
- **Desktop**: > 1024px - Full layout with expanded sidebar

### Accessibility
- **ARIA Labels**: Screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: WCAG compliant color schemes
- **Focus Management**: Clear focus indicators

## Development

### Available Scripts
- `npm start`: Development server with hot reload
- `npm run build`: Production build optimization
- `npm test`: Run test suite
- `npm run eject`: Eject from Create React App (irreversible)

### Environment Variables
- `REACT_APP_API_URL`: Backend API URL (default: http://localhost:4000)
- `REACT_APP_VERSION`: Application version display

### Customization
- **Themes**: Material-UI theming system
- **Colors**: Centralized color palette
- **Typography**: Consistent font sizing and spacing
- **Components**: Reusable component library

## Performance Optimization

### Code Splitting
- **Lazy Loading**: Dynamic imports for large components
- **Route Splitting**: Separate bundles for different sections
- **Asset Optimization**: Minified CSS and JavaScript

### Caching
- **Service Worker**: Offline functionality support
- **Browser Caching**: Optimized cache headers
- **API Caching**: Smart request caching

## Testing

### Test Coverage
- **Unit Tests**: Component testing with Jest
- **Integration Tests**: API integration testing
- **E2E Tests**: End-to-end user workflow testing
- **Accessibility Tests**: ARIA and keyboard navigation

### Testing Commands
```bash
npm test              # Run all tests
npm test -- --watch  # Watch mode for development
npm test -- --coverage  # Generate coverage report
```

## Deployment

### Build Process
```bash
npm run build
```

### Deployment Options
- **Static Hosting**: Netlify, Vercel, GitHub Pages
- **CDN**: CloudFront, CloudFlare
- **Server**: Nginx, Apache, Express static
- **Container**: Docker with multi-stage builds

## Troubleshooting

### Common Issues
- **API Connection**: Verify backend server is running on port 4000
- **CORS Errors**: Check backend CORS configuration
- **Build Errors**: Clear `node_modules` and reinstall dependencies
- **Performance**: Check for memory leaks in component lifecycle

### Debug Mode
- **Development Tools**: React DevTools browser extension
- **Console Logging**: Comprehensive error logging
- **Network Tab**: API request/response monitoring
- **State Inspection**: Redux DevTools for state management

## Migration Guide

### From Network Routes Repository v1.0
1. **Update Dependencies**: `npm install` to get latest packages
2. **Clear Cache**: Delete `node_modules` and `package-lock.json`
3. **Reinstall**: `npm install` for clean dependency installation
4. **Test Features**: Verify all new UI components work correctly

---

**Network Inventory Frontend** - Delivering exceptional user experience for telecommunications inventory management 