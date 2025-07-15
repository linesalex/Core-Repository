# Network Inventory Frontend

Modern React-based user interface for the Network Inventory Management System, featuring comprehensive telecommunications infrastructure management with advanced pricing calculations, user authentication, and enterprise-grade UI components.

## 🚀 Features

### 🔐 Authentication & User Management
- **Secure Login System**: JWT-based authentication with role validation
- **Role-Based UI**: Dynamic interface based on user permissions
- **User Profile Management**: Password changes and profile information
- **Session Management**: Automatic token handling and logout
- **Access Control**: UI elements shown/hidden based on permissions

### 🌐 Network Design & Pricing Tool
- **Advanced Path Finding**: Interactive network routing with visual results
- **Dynamic Pricing Calculator**:
  - Real-time pricing with bandwidth allocation
  - 4-tier minimum pricing enforcement
  - 40% minimum and 60% suggested margin display
  - Multi-currency support with live conversion
  - Protection path pricing visualization
- **Interactive Location Selection**: Autocomplete with geographic data
- **Pricing Breakdown**: Detailed cost analysis and margin information

### 🔧 Network Routes Management
- **Comprehensive CRUD Interface**: Add, edit, delete, and view routes
- **Advanced Search & Filtering**: Multi-criteria search with real-time results
- **Data Export**: CSV export with customizable fields
- **File Management**: KMZ and test results file upload/download
- **Dark Fiber Integration**: DWDM channel management interface

### 📊 Location & Carrier Management
- **Location Data Manager**: 
  - Tabbed interface for locations and minimum pricing
  - POP capabilities matrix (12 service types)
  - Access information and provider details
  - Geographic filtering and search
- **Carrier Management**: Multi-regional carrier database with contacts
- **Minimum Pricing Editor**: Admin-only interface for pricing tiers

### 💰 Exchange Rates & Financial Tools
- **Exchange Rate Management**: Admin interface for currency rates
- **Multi-currency Display**: Real-time conversion in pricing tools
- **Financial Analytics**: Cost breakdowns and margin analysis
- **Currency Selection**: User-configurable output currency

### 📋 Administrative Features
- **User Management**: Admin interface for user lifecycle
- **Change Logs Viewer**: Complete audit trail visualization
- **Core Outages Tracking**: Incident management interface
- **System Configuration**: Administrative controls and settings

## 🛠 Technical Architecture

### Core Framework
- **React 18**: Modern component-based architecture with hooks
- **Material-UI v5**: Enterprise-grade component library
- **React Router**: Client-side routing and navigation
- **Context API**: Global state management for authentication

### Key Libraries
- **Axios**: HTTP client with interceptors and global configuration
- **Material-UI Icons**: Comprehensive icon library
- **React CSV**: Data export functionality
- **Date Utilities**: Date formatting and manipulation

### Styling & Theming
- **Emotion**: CSS-in-JS styling engine
- **Material-UI Theming**: Consistent design system
- **Responsive Design**: Mobile-first responsive layouts
- **Custom Components**: Reusable business logic components

## 📋 Prerequisites

### System Requirements
- **Node.js**: Version 16 or later (v18+ recommended)
- **npm**: Version 8 or later
- **Modern Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Screen Resolution**: Minimum 1024x768 (optimized for 1920x1080)

### Development Environment
- **Code Editor**: VS Code with React extensions recommended
- **Browser DevTools**: Chrome DevTools or Firefox Developer Tools
- **Git**: For version control (if contributing)

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Environment Configuration
Create a `.env` file in the frontend directory:
```env
REACT_APP_API_URL=http://localhost:4000
REACT_APP_VERSION=2.0
REACT_APP_ENVIRONMENT=development
```

### 3. Start Development Server
```bash
npm start
```
- Development server runs on `http://localhost:3000`
- Automatic browser opening
- Hot module replacement for instant updates
- Source map support for debugging

### 4. Build for Production
```bash
npm run build
```
- Creates optimized production build in `build/` directory
- Code splitting and minification
- Asset optimization and hashing
- Service worker for caching (if enabled)

## 🎯 Component Architecture

### Authentication Components
- **AuthContext**: Global authentication state management
- **LoginForm**: Secure login interface with validation
- **ProtectedRoute**: Route guards based on permissions
- **UserMenu**: User profile and logout functionality

### Core Business Components
- **App**: Main application shell with navigation
- **NetworkDesignTool**: Advanced pricing and path finding
- **LocationDataManager**: Location and minimum pricing management
- **NetworkRoutesTable**: Network routes CRUD interface
- **CarriersManager**: Carrier and contact management

### Utility Components
- **SearchExportBar**: Advanced search and export functionality
- **RouteFormDialog**: Route creation/editing modal
- **DarkFiberModal**: DWDM channel management
- **UserManagement**: Admin user management interface

## 🔑 User Interface Features

### Navigation & Layout
- **Responsive Sidebar**: Collapsible navigation with role-based items
- **Tabbed Interfaces**: Organized content with tab navigation
- **Breadcrumb Navigation**: Clear location within the application
- **Loading States**: Smooth loading indicators throughout

### Data Management
- **Advanced Tables**: Sortable, filterable data grids
- **Search Functionality**: Real-time search with highlighting
- **Pagination**: Efficient handling of large datasets
- **Export Options**: CSV export with customizable columns

### Forms & Validation
- **Dynamic Forms**: Context-aware form fields
- **Real-time Validation**: Instant feedback on user input
- **File Upload**: Drag-and-drop file handling with progress
- **Autocomplete**: Smart suggestions for location and carrier selection

### Visual Feedback
- **Toast Notifications**: Success and error messages
- **Progress Indicators**: Visual feedback for long operations
- **Status Chips**: Color-coded status indicators
- **Confirmation Dialogs**: Safe operation confirmations

## 🔐 Authentication Flow

### Login Process
1. **User Input**: Username and password validation
2. **API Authentication**: Secure backend authentication
3. **Token Storage**: Secure local storage of JWT tokens
4. **Permission Loading**: Role-based permission retrieval
5. **UI Configuration**: Dynamic interface based on permissions

### Session Management
```javascript
// Authentication context usage
const { user, permissions, isAuthenticated, login, logout } = useAuth();

// Permission checking
const canEdit = hasPermission('locations', 'edit');
const isAdmin = hasRole('administrator');
```

### Role-Based Interface
- **Administrator**: Full access to all features
- **Provisioner**: Create/edit access with view permissions
- **Read-Only**: View-only access with limited functionality

## 💰 Pricing Tool Features

### Path Finding Interface
- **Source/Destination Selection**: Geographic location picker
- **Bandwidth Configuration**: Flexible bandwidth input
- **Protection Options**: Primary and diverse path selection
- **Constraint Settings**: Carrier avoidance and MTU requirements

### Pricing Display
```javascript
// Pricing calculation result structure
{
  minimumPrice: 2500.00,      // 40% margin
  suggestedPrice: 3750.00,    // 60% margin
  allocatedCost: 1500.00,     // Bandwidth allocation
  locationMinimum: 2000.00,   // Location-based minimum
  marginEnforced: true,       // Minimum price enforcement
  currency: "USD"             // Output currency
}
```

### Multi-Currency Support
- **Real-time Conversion**: Live exchange rate integration
- **Currency Selection**: User-configurable output currency
- **Rate Management**: Admin interface for exchange rates

## 📊 Location Management Interface

### Location Data Grid
- **Comprehensive View**: All location information in sortable table
- **Advanced Filtering**: Country, status, and text-based search
- **Bulk Operations**: Multi-select actions and operations
- **Export Functionality**: CSV export with custom fields

### Minimum Pricing Management
- **Tabbed Interface**: Separate tab for pricing administration
- **Tier-Based Pricing**: 4 bandwidth tiers per location
- **Currency Display**: USD-based pricing with conversion
- **Admin Security**: Role-based access control

### POP Capabilities Matrix
- **12 Service Types**: Comprehensive capability tracking
- **Visual Indicators**: Clear enabled/disabled status
- **Bulk Updates**: Efficient capability management
- **History Tracking**: Change audit for capabilities

## 🔧 Development Guide

### Component Development
```jsx
// Standard component structure
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from './api';

const MyComponent = () => {
  const { hasPermission } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const result = await api.getData();
      setData(result);
    } catch (error) {
      console.error('Load failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    // JSX implementation
  );
};
```

### API Integration
```javascript
// API call with authentication
import { api } from './api';

// GET request
const data = await api.get('/endpoint').then(res => res.data);

// POST with authentication header
const result = await api.post('/endpoint', data);

// Error handling
try {
  const response = await api.call();
} catch (error) {
  console.error('API Error:', error.response?.data?.error);
}
```

### State Management
- **Context API**: Global authentication and user state
- **Component State**: Local component data management
- **Form State**: Controlled components with validation
- **Error Boundaries**: Graceful error handling

## 🎨 Styling & Theming

### Material-UI Theme
```javascript
// Theme configuration
const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
    background: { default: '#f5f5f5' }
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif'
  }
});
```

### Responsive Design
- **Breakpoints**: Mobile, tablet, and desktop layouts
- **Grid System**: Material-UI grid for responsive layouts
- **Flexible Components**: Adaptive component sizing
- **Touch-Friendly**: Mobile-optimized interactions

### Custom Styling
- **Emotion CSS**: CSS-in-JS for component styling
- **sx Prop**: Inline styling with theme integration
- **Custom Components**: Reusable styled components
- **CSS Variables**: Dynamic theming support

## 📱 User Experience Features

### Performance Optimization
- **Code Splitting**: Lazy loading of route components
- **Memoization**: React.memo for expensive components
- **Virtual Scrolling**: Efficient large list rendering
- **Image Optimization**: Responsive image loading

### Accessibility
- **ARIA Labels**: Screen reader compatibility
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: WCAG-compliant color schemes
- **Focus Management**: Logical tab order

### Error Handling
- **Error Boundaries**: Component-level error isolation
- **User-Friendly Messages**: Clear error communication
- **Retry Mechanisms**: Automatic and manual retry options
- **Fallback UI**: Graceful degradation

## 🔧 Configuration Options

### Environment Variables
```env
# API Configuration
REACT_APP_API_URL=http://localhost:4000
REACT_APP_API_TIMEOUT=30000

# Application Settings
REACT_APP_VERSION=2.0
REACT_APP_ENVIRONMENT=production
REACT_APP_DEBUG=false

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_PWA=false
```

### Build Configuration
```javascript
// package.json scripts
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "analyze": "npm run build && npx webpack-bundle-analyzer build/static/js/*.js"
  }
}
```

## 🚀 Deployment

### Production Build
```bash
# Create optimized build
npm run build

# Serve static files
npx serve -s build -l 3000
```

### Web Server Configuration
```nginx
# Nginx configuration example
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/build;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Performance Monitoring
- **Bundle Analysis**: Webpack bundle analyzer
- **Lighthouse Audits**: Performance and accessibility scoring
- **React DevTools**: Component profiling and debugging
- **Network Monitoring**: API call performance tracking

## 🔄 Maintenance & Updates

### Regular Maintenance
- **Dependency Updates**: Keep packages current
- **Security Patches**: Regular security updates
- **Performance Monitoring**: Bundle size and load time tracking
- **User Feedback**: Interface improvement based on usage

### Testing Strategy
```bash
# Unit testing
npm test

# Component testing
npm run test:components

# Integration testing
npm run test:integration

# End-to-end testing
npm run test:e2e
```

### Code Quality
- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting consistency
- **TypeScript**: Optional type safety (if migrated)
- **Code Reviews**: Systematic code review process

## 📞 Support & Troubleshooting

### Common Issues

**Build Failures**:
- Clear node_modules and package-lock.json
- Run `npm install` fresh installation
- Check Node.js version compatibility

**API Connection Issues**:
- Verify backend server is running
- Check CORS configuration
- Validate API URLs in environment variables

**Authentication Problems**:
- Clear browser local storage
- Check JWT token expiration
- Verify user credentials and permissions

**Performance Issues**:
- Analyze bundle size with webpack-bundle-analyzer
- Check for memory leaks in components
- Optimize large lists with virtualization

### Debug Tools
```javascript
// Browser console debugging
console.log('Component state:', state);
console.log('API response:', response);

// React DevTools
// Available as browser extension for component inspection

// Network tab analysis
// Monitor API calls and response times
```

## 📄 Browser Compatibility

### Supported Browsers
- **Chrome**: 90+ (recommended)
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+
- **Mobile Safari**: iOS 14+
- **Chrome Mobile**: Android 10+

### Polyfills & Fallbacks
- **Promise Support**: Built-in polyfill for older browsers
- **Fetch API**: Axios provides consistent HTTP interface
- **ES6 Features**: Babel transpilation for compatibility
- **CSS Grid**: Fallback to flexbox where needed

## 📊 Analytics & Monitoring

### User Analytics
- **Usage Tracking**: Feature usage and user flows
- **Performance Metrics**: Load times and user interactions
- **Error Tracking**: Client-side error monitoring
- **User Feedback**: In-app feedback collection

### Technical Monitoring
- **Bundle Size**: Track application size over time
- **Load Performance**: First contentful paint and time to interactive
- **API Performance**: Request/response time monitoring
- **Error Rates**: Client-side error frequency tracking

## 📄 License & Version

- **Version**: 2.0
- **React Version**: 18.2.0
- **Material-UI Version**: 5.x
- **Last Updated**: January 2025
- **Browser Support**: Modern browsers (ES6+)

---

For backend API documentation and complete setup instructions, see the main [README.md](../README.md) and [SETUP_GUIDE.md](../SETUP_GUIDE.md). 