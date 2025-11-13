# Route Finder Module - Documentation

**Version:** 3.3.3  
**Release Date:** November 13, 2024  
**Module Type:** Sales & Route Discovery

---

## **Overview**

The Route Finder is a lightweight, sales-focused module that allows users to quickly find the fastest or standard routes between two locations. It's designed as a simplified version of the Network Design Tool without pricing elements, specifically tailored for sales teams.

---

## **Features**

### **1. Route Search**
- **Two Route Modes:**
  - **Fastest Route**: Includes all available routes (Cisco routes, special routes, etc.)
  - **Standard Route**: Excludes Cisco-only and special routes
  
- **Search Parameters:**
  - Source Location (with POP Code - Datacenter Name display)
  - Destination Location (with POP Code - Datacenter Name display)
  - Bandwidth (Mbps) - Optional, validates between 10 and 10,000 Mbps
  - MTU Required - Defaults to 1500, maximum 9000

- **Results Display:**
  - Primary Path with route segments
  - Secondary Diverse Path (if available)
  - For each path:
    - Circuit ID
    - Route Segments (Location A → Location B)
    - Latency per segment
    - Cable System
    - Total Latency
    - Total Hops

### **2. Export Functionality**
- Export results as `.eml` email file
- **Email Subject Format**: `Route Finder - [Source] to [Destination] - [Date]`
- Contains complete route details in formatted tables
- Includes both primary and secondary paths

### **3. Permissions**
- **read_only**: Can view and search routes
- **provisioner**: Can view and search routes
- **admin**: Full access
- Module permissions managed via "Manage Module Permissions" UI

### **4. Analytics Tracking**
- All searches logged to audit system
- Tracked metrics:
  - Total searches
  - Route pairs searched
  - City codes
  - Individual locations
  - Bandwidth ranges
  - Route mode distribution (Fastest vs Standard)
  - User activity
  - Average response time

---

## **Technical Implementation**

### **Frontend Components**

#### **RouteFinder.js**
- Location: `frontend/src/RouteFinder.js`
- React component with:
  - Autocomplete dropdowns for source/destination
  - Radio buttons for route mode selection
  - Results display with Accordion UI
  - Email export functionality

#### **Location Display Format**
```javascript
// Example: "IPCLON9 - Equinix LD5"
const getLocationLabel = (location) => {
  return `${location.location_code} - ${location.datacenter_name || location.city}`;
};
```

### **Backend Endpoints**

#### **POST /route_finder/find_routes**
- **Authentication**: Required
- **Permission**: `route_finder` module, `read_only` level
- **Request Body**:
```json
{
  "source": "IPCLON9",
  "destination": "IPCNYC4",
  "bandwidth": 10000,
  "mtu_required": 1500,
  "route_mode": "fastest",
  "include_ull": true,
  "use_cisco_only_routes": true,
  "constraints": {
    "protection_required": true
  }
}
```
- **Response**:
```json
{
  "primaryPath": {
    "path": ["IPCLON9", "IPCAMS4", "IPCNYC4"],
    "route": [
      {
        "circuit_id": "LON-AMS-001",
        "from": "IPCLON9",
        "to": "IPCAMS4",
        "latency": 5.2,
        "cable_system": "Hibernia Express"
      }
    ],
    "totalLatency": 15.6,
    "hops": 2
  },
  "diversePath": { /* ... */ },
  "executionTime": 125
}
```

#### **GET /analytics/route-finder**
- **Authentication**: Required (Admin only)
- **Query Parameters**: `start_date`, `end_date` (optional)
- **Response**:
```json
{
  "totalSearches": 42,
  "routePairs": [{"route": "IPCLON9 ↔ IPCNYC4", "count": 12}],
  "cityCodes": [{"city": "IPCLON", "count": 24}],
  "bandwidthRanges": [{"range": "10-100 Gbps", "count": 18}],
  "routeModes": [{"mode": "fastest", "count": 30}],
  "topUsers": [{"username": "john.doe", "count": 15}],
  "averageResponseTime": "120"
}
```

### **Database & Logging**

#### **Audit Logs**
All Route Finder searches are logged with:
- `action_type`: `'ROUTE_FINDER_SEARCH'`
- `parameters`: Search parameters (source, destination, bandwidth, etc.)
- `results`: Primary and secondary path summaries
- `execution_time`: Query performance in milliseconds
- `user_id`, `user_name`: Tracking who performed the search
- `ip_address`, `user_agent`: Security and audit trail

### **Module Permissions**

#### **Added to:**
1. `backend/auth.js` - Administrator module list
2. `frontend/src/UserManagement.js` - Module permissions UI
3. `frontend/src/App.js` - Sidebar navigation and access control

#### **Permission Levels:**
- `read_only`: View and search routes
- `provisioner`: View and search routes (same as read_only for this module)
- No access: Module hidden

---

## **Analytics Dashboard Integration**

### **Route Finder Analytics Tab**
- Tab index: 5
- **Visualizations:**
  1. **Summary Cards:**
     - Total Searches
     - Average Response Time
  
  2. **Most Searched Route Pairs** (Table)
     - Top 20 route pairs with counts
     - CSV export available
  
  3. **Top City Codes** (Table)
     - Top 20 city codes with counts
  
  4. **Top Individual Locations** (Table)
     - Top 20 specific location codes
  
  5. **Bandwidth Distribution** (Pie Chart)
     - Visual breakdown by bandwidth range
  
  6. **Route Mode Distribution** (Bar Chart)
     - Fastest vs Standard mode usage
  
  7. **Most Active Users** (Table)
     - User activity tracking

- **Date Range Filters:** All, 7 days, 30 days, 90 days, Year, Custom

---

## **User Experience**

### **Workflow**
1. User navigates to **Network Routes Repository** → **Route Finder**
2. Selects Route Mode (Fastest or Standard)
3. Chooses Source and Destination locations from dropdown
4. Optionally enters Bandwidth and MTU requirements
5. Clicks "Find Route"
6. Views Primary and (if available) Secondary diverse paths
7. Reviews route segments, latency, and cable systems
8. Exports results via email if needed

### **UI Elements**
- **Accordion UI** for collapsible search parameters and results
- **Autocomplete Dropdowns** with search functionality
- **Radio Buttons** for route mode selection
- **Material-UI Cards** for results display
- **Tables** for route segment details
- **Refresh Button** to clear form and start new search

---

## **Files Modified/Created**

### **Frontend**
- ✅ `frontend/src/RouteFinder.js` - New component
- ✅ `frontend/src/api.js` - Added `getAnalyticsRouteFinder()`
- ✅ `frontend/src/App.js` - Sidebar integration and routing
- ✅ `frontend/src/AnalyticsDashboard.js` - New Route Finder tab
- ✅ `frontend/src/UserManagement.js` - Added to module permissions list

### **Backend**
- ✅ `backend/routes.js` - New endpoints:
  - `POST /route_finder/find_routes`
  - `GET /analytics/route-finder`
- ✅ `backend/auth.js` - Added `route_finder` to admin modules list

### **Documentation**
- ✅ `ROUTE_FINDER_DOCUMENTATION.md` - This file

---

## **Testing Checklist**

### **Functional Testing**
- [ ] Search for route with Fastest mode
- [ ] Search for route with Standard mode
- [ ] Verify Cisco routes excluded in Standard mode
- [ ] Test with various bandwidth values
- [ ] Test with custom MTU values
- [ ] Verify secondary diverse path finding
- [ ] Test export functionality
- [ ] Verify email file format and content

### **Permission Testing**
- [ ] Verify read_only user can access
- [ ] Verify provisioner user can access
- [ ] Verify admin user can access
- [ ] Verify users without permission see error

### **Analytics Testing**
- [ ] Verify search is logged in audit_logs
- [ ] Check Analytics Dashboard Route Finder tab
- [ ] Verify date range filtering works
- [ ] Test CSV exports from analytics

---

## **Performance Notes**

### **Expected Performance**
- **Search Response Time**: 100-500ms (depending on network complexity)
- **Analytics Loading**: 200-1000ms (depending on date range)
- **Export Generation**: < 100ms

### **Optimization**
- Uses existing `buildGraph()` and `findShortestPath()` functions from Network Design Tool
- Minimal database overhead (no pricing calculations)
- Results not cached (real-time route discovery)

---

## **Future Enhancements (Potential)**

1. **Route Comparison**: Compare multiple route options side-by-side
2. **Historical Tracking**: Track which routes were selected over time
3. **Saved Searches**: Allow users to save frequently searched route pairs
4. **Notification System**: Alert when new routes become available
5. **PDF Export**: Alternative to email export
6. **Latency Visualization**: Visual map of route segments

---

## **Support & Troubleshooting**

### **Common Issues**

1. **"No route found between source and destination"**
   - Verify both locations exist in the database
   - Check if bandwidth requirements are too high
   - Ensure MTU requirements are achievable

2. **"No diverse secondary path found"**
   - This is normal - not all route pairs have diverse paths
   - Primary path is still valid

3. **Module not visible in sidebar**
   - Check user has `route_finder` permission assigned
   - Verify permission level is `read_only` or higher

4. **Analytics not loading**
   - Verify user is administrator
   - Check backend console for errors
   - Ensure audit logs table exists

---

## **Comparison: Route Finder vs Network Design Tool**

| Feature | Route Finder | Network Design Tool |
|---------|-------------|-------------------|
| **Purpose** | Quick route discovery for sales | Full network design with pricing |
| **Pricing** | ❌ No | ✅ Yes |
| **Customer Info** | ❌ Not required | ✅ Required |
| **Contract Terms** | ❌ N/A | ✅ Yes (1-5 years) |
| **Protection Pricing** | ❌ N/A | ✅ Yes |
| **Constraints** | MTU, Bandwidth | MTU, Bandwidth, Carrier, Circuit |
| **Export** | Email (.eml) | Email (.eml) |
| **Analytics** | ✅ Yes | ✅ Yes |
| **Audit Logging** | ✅ Yes | ✅ Yes |
| **Target Users** | Sales teams | Provisioning & Engineering |

---

## **Conclusion**

The Route Finder module provides a streamlined, sales-friendly interface for route discovery without the complexity of pricing calculations. It leverages the same proven routing algorithms as the Network Design Tool while maintaining simplicity and speed for quick customer inquiries.

