# Changelog

All notable changes to the Network Inventory Management System will be documented in this file.

---

## [3.3.3] - 2024-11-13

### 🎉 Major New Features

#### **Route Finder Module**
- **New lightweight route search module** designed for sales teams
- Quick route discovery without pricing complexity
- Two route modes:
  - **Fastest Route**: Includes all available routes (Cisco, Special routes, etc.)
  - **Standard Route** (default): Excludes Cisco-only and Special routes
- Search parameters:
  - Source and Destination locations (displayed as "POP Code - Datacenter Name")
  - Bandwidth (Mbps) with validation (10-10,000 Mbps)
  - MTU Required (defaults to 1500, max 9000)
- Results display:
  - Primary path with route segments
  - Diverse secondary path (when available)
  - Circuit ID, Segments, Latency, Cable System per route
  - Total latency and hop count
- **Export to Email**: Generate `.eml` files with complete route details
- **Full Analytics Integration**: New "Route Finder" tab in Analytics Dashboard
  - Tracks searches, route pairs, locations, bandwidth usage, route modes
  - User activity monitoring
  - Response time metrics
- **Module Permissions**: Integrated into permission management system
  - `read_only` and `provisioner` users can search routes
  - Administrators have full access

### ✨ Enhancements

#### **KMZ Viewer**
- Added KMZ Viewer to Module Permissions UI
- Permission levels: `read_only` = view, `provisioner` = view, `admin` = full access

#### **Performance Optimizations**
- **KMZ File Caching**: Browser caching for KMZ downloads (1 hour cache)
  - Reduces server bandwidth by 70-90% for repeat users
  - ETag-based change detection
- Caching headers: `Cache-Control: private, max-age=3600, must-revalidate`

#### **Analytics Dashboard**
- New **Route Finder Analytics** tab with comprehensive metrics:
  - Total searches and average response time
  - Most searched route pairs (Top 20)
  - Top city codes and locations
  - Bandwidth distribution (Pie Chart)
  - Route mode distribution (Bar Chart)
  - Most active users
  - CSV export for all analytics data
- Date range filtering: All, 7 days, 30 days, 90 days, Year, Custom

#### **User Management**
- Added Route Finder and KMZ Viewer to module permissions list
- Streamlined permission assignment for new modules

### 🔧 Technical Improvements

#### **Backend**
- New Route Finder endpoints:
  - `POST /route_finder/find_routes` - Main search endpoint with inline routing logic
  - `GET /analytics/route-finder` - Analytics data endpoint
- Inline Dijkstra's algorithm implementation for route pathfinding
- Diverse path finding with POP and Circuit ID diversity enforcement
- Full audit logging for all Route Finder searches (`ROUTE_FINDER_SEARCH` action type)
- Optimized graph building with equipment type, bandwidth, MTU, and ULL filtering

#### **Frontend**
- New `RouteFinder.js` component with Material-UI design
- Autocomplete dropdowns for location selection
- Radio button interface for route mode selection
- Accordion-based UI for search parameters and results
- Email export functionality (`.eml` format)
- Integration with existing navigation and permission system
- Added `SearchIcon` import to `App.js`

#### **Database & Logging**
- Route Finder searches logged to `audit_logs` table
- Tracks: user, parameters, results, execution time, IP, user agent
- Analytics queries optimized for date range filtering

### 📚 Documentation
- **`ROUTE_FINDER_DOCUMENTATION.md`**: Complete technical documentation
  - API specifications
  - Frontend component details
  - Analytics integration
  - Testing checklist
  - Troubleshooting guide
  - Comparison with Network Design Tool
- **`ROUTE_FINDER_IMPLEMENTATION_SUMMARY.md`**: Quick reference guide
- **`PERFORMANCE_NOTES.md`**: KMZ caching performance documentation
- **`KMZ_VIEWER_DOCUMENTATION.md`**: Updated with caching notes

### 🐛 Bug Fixes
- Fixed missing `SearchIcon` import in `App.js` causing Route Finder sidebar crash
- Fixed Route Finder default mode to "Standard Route" (was incorrectly defaulting to "Fastest")
- Fixed module import error by implementing inline routing logic instead of external module

### 🔐 Security
- Route Finder requires authentication and module-level permissions
- All searches audited with full user tracking
- KMZ caching uses private cache to prevent cross-user data exposure

---

## [3.3.2] - 2024-11-13

### ✨ Enhancements
- KMZ Viewer performance optimizations
- Browser caching implementation for static assets

---

## [3.3.1] - 2024-11-XX

### Previous Features
- KMZ Viewer module with Cesium.js integration
- Network Routes Repository enhancements
- Analytics Dashboard improvements
- Module-based permission system

---

## Version History Notes

- **v3.3.3**: Route Finder module, KMZ caching, analytics enhancements
- **v3.3.2**: KMZ Viewer optimizations
- **v3.3.1**: KMZ Viewer initial release
- **v3.3.0 and earlier**: Core inventory management features

---

## Upcoming Features (Planned)

### Route Finder Enhancements
- Route comparison (side-by-side)
- Historical tracking of selected routes
- Saved searches functionality
- PDF export option
- Latency visualization maps

### KMZ Viewer Enhancements
- Offline map support
- Enhanced filtering options
- Route grouping by cable system

---

**Note**: Dates use format YYYY-MM-DD. For detailed technical documentation, see individual module documentation files.

