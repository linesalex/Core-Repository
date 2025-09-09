# Network Inventory Management System - Module Features Documentation

## 📋 **Table of Contents**
1. [Authentication & User Management](#authentication--user-management)
2. [Network Routes Management](#network-routes-management)
3. [Network Design & Pricing Tool](#network-design--pricing-tool)
4. [Location Data Manager](#location-data-manager)
5. [CNX Colocation Manager](#cnx-colocation-manager)
6. [Carriers Manager](#carriers-manager)
7. [Exchange Data Manager](#exchange-data-manager)
8. [Exchange Rates Manager](#exchange-rates-manager)
9. [Exchange Pricing Tool](#exchange-pricing-tool)
10. [Bulk Upload](#bulk-upload)
11. [Change Logs Viewer](#change-logs-viewer)
12. [User Management](#user-management)
13. [Minimum Pricing Manager](#minimum-pricing-manager)
14. [Pricing Logic Manager](#pricing-logic-manager)
15. [Promo Pricing Manager](#promo-pricing-manager)

---

## 🔐 **Authentication & User Management**

### **Overview**
Secure authentication system with role-based access control and granular permissions.

### **Key Features**
- **JWT Authentication**: Secure token-based sessions with 24-hour expiration
- **Role-Based Access**: Three distinct user roles with different capabilities
- **Module Visibility Control**: Administrators can customize which modules users see
- **Password Security**: Bcrypt hashing with salt rounds for secure password storage
- **Session Management**: Automatic token refresh and activity tracking

### **User Roles**
1. **Administrator**: Full system access, can manage users and configure pricing logic
2. **Provisioner**: Access to most features except user management and pricing configuration
3. **Read-Only**: View-only access to data with limited modification rights

### **Security Features**
- Forced password changes for new accounts
- IP address and user agent logging for security auditing
- Session timeout and automatic logout
- Role validation on every API request

---

## 🌐 **Network Routes Management**

### **Overview**
Comprehensive database of network circuits with advanced search, filtering, and file management capabilities.

### **Key Features**
- **Circuit Database**: Store complete network route information including:
  - Circuit IDs, locations, bandwidth, carriers
  - Latency data (expected and live measurements)
  - Protection status and routes
  - Cost information and SLA parameters
  - Equipment types and MTU specifications

- **Advanced Search & Filtering**: Multi-criteria search with real-time filtering
- **File Management**: 
  - KMZ file uploads for route visualization
  - Test results file storage and management
  - Bulk file downloads in ZIP format
- **Live Latency Monitoring**: Real-time latency data with staleness indicators
- **CSV Export**: Complete data export functionality
- **Dark Fiber Management**: DWDM channel reservations and tracking

### **Data Tracking**
- Change history with user attribution
- File upload/download tracking
- Live latency measurement timestamps
- Circuit protection route relationships

---

## 🎯 **Network Design & Pricing Tool**

### **Overview**
Advanced network path finding and automated pricing engine with intelligent route selection and comprehensive cost calculations.

### **Core Capabilities**

#### **Path Finding Algorithm**
- **Dijkstra-based routing**: Intelligent path selection considering:
  - Latency optimization
  - Bandwidth requirements
  - Carrier constraints and avoidance rules
  - Circuit exclusion parameters
  - Protection requirements with diversity enforcement

#### **Advanced Search Parameters**
- **Source/Destination**: Location-based routing
- **Bandwidth Requirements**: 10Mb to 100Gb capacity planning
- **Protection Options**: Primary and diverse path routing
- **Carrier Controls**: Include/exclude specific carriers
- **Circuit Exclusions**: Avoid problematic routes
- **MTU Requirements**: Ensure compatibility across path

#### **Pricing Automation Engine**

##### **Multi-Tier Pricing Logic**
1. **Promo Pricing (Highest Priority)**
   - Rule-based promotional pricing with location pairs
   - Bandwidth-tier specific pricing (Under 100Mb, 100-999Mb, 1000-2999Mb, 3000Mb+)
   - **Contract Term Discounts**:
     - 12-month: Base promo price (no discount)
     - 24-month: Additional 5% discount from base promo price
     - 36-month: Additional 10% discount from base promo price
   - Margin validation to ensure profitability
   - Automatic fallback to regular pricing if margins not met

2. **Regular Pricing (Fallback)**
   - Cost allocation based on bandwidth utilization
   - **Bandwidth-Based Utilization Factors**:
     - Primary paths ≤10000Mbit: Configurable factor (default 0.9)
     - Primary paths >10000Mbit: Configurable factor (default 0.9)
     - Protection paths ≤10000Mbit: Configurable factor (default 1.0)
     - Protection paths >10000Mbit: Configurable factor (default 1.0)
   - Contract term margin adjustments
   - Location-specific minimum pricing enforcement

##### **Pricing Calculation Flow**
```
1. Path Discovery → Find optimal routes using Dijkstra algorithm
2. Cost Allocation → Calculate segment costs based on bandwidth utilization
3. Promo Check → Search for applicable promotional pricing rules
4. Contract Discount → Apply 24/36-month discounts to promo prices
5. Margin Validation → Verify minimum margin requirements
6. Fallback Logic → Use regular pricing if promo doesn't meet margins
7. Currency Conversion → Convert to requested output currency
8. Final Pricing → Present minimum and suggested prices with NRC
```

##### **Utilization Factor Logic**
Each circuit segment's cost is calculated as:
```javascript
allocationRatio = requestedBandwidth / (segmentBandwidth × utilizationFactor)
allocatedCost = segmentCost × allocationRatio
```

The system selects utilization factors based on:
- Path type (primary vs protection)
- Individual segment bandwidth (≤10000Mbit vs >10000Mbit)

##### **Protection Path Pricing**
- **Primary Path**: Uses primary utilization factors
- **Protection Path**: Uses protection utilization factors
- **Protection Multiplier**: Additional cost factor (default 0.7)
- **Diversity Enforcement**: Ensures completely separate POPs and circuits

#### **Advanced Features**
- **Multi-Currency Support**: Real-time currency conversion for international quotes
- **Location Minimum Pricing**: 4-tier bandwidth-based minimums per location
- **Audit Logging**: Complete pricing calculation tracking with user attribution
- **Saved Searches**: Store frequently used route configurations
- **KMZ Generation**: Visual route map creation
- **CSV Export**: Audit logs and pricing calculations

#### **Output & Reporting**
- **Pricing Results**: Minimum and suggested prices with margin analysis
- **Path Details**: Complete route information with latency calculations
- **Cost Breakdown**: Detailed segment-by-segment pricing
- **Protection Analysis**: Diversity validation and protection availability
- **Audit Trail**: Searchable history of all pricing calculations

---

## 📍 **Location Data Manager**

### **Overview**
Comprehensive Point of Presence (POP) database with service capabilities and access information management.

### **Key Features**
- **Location Database**: Global inventory of data centers and POPs
- **Regional Organization**: Americas, EMEA, APAC categorization
- **Service Capabilities Matrix**: 12-field capability tracking:
  - CNX Ethernet, Extranet, Voice services
  - SDWAN and Unigy offerings
  - Exchange and Internet connectivity
  - Colocation services availability

### **POP Capabilities Management**
- **Real-time Capability Updates**: Live editing of service availability
- **Access Information**: Data center access procedures and contact details
- **Status Tracking**: Active, inactive, and decommissioned location management
- **Geographic Data**: Latitude, longitude, timezone information

### **Pricing Integration**
- **Minimum Pricing Tiers**: 4-bandwidth-based pricing floors per location:
  - Under 100Mb tier
  - 100-999Mb tier  
  - 1000-2999Mb tier
  - 3000Mb+ tier
- **Integration with Pricing Engine**: Automatic minimum price enforcement

---

## 🏢 **CNX Colocation Manager**

### **Overview**
Multi-tier colocation facility management with power allocation, space tracking, and client management.

### **Hierarchical Structure**
```
Location → Rack → Client
```

### **Location Management**
- **CNX-Enabled Locations**: Filter for colocation-capable facilities
- **Design File Storage**: PDF uploads for facility layouts
- **Facility Information**: Comprehensive facility details and specifications

### **Rack Management**
- **Rack Inventory**: Individual rack tracking with specifications
- **Power Management**: 
  - Total KVA capacity tracking
  - Real-time power allocation calculations
  - Available power monitoring
- **Space Tracking**: 30RU capacity with allocation tracking
- **Network Infrastructure**: Equipment and connectivity documentation
- **Pricing Information**: Excel file storage for rack pricing details

### **Client Management**
- **Client Allocation**: Individual client space and power assignments
- **Resource Tracking**:
  - Power purchased (KVA)
  - Rack units purchased (RU)
  - Real-time availability calculations
- **Design Documentation**: PDF storage for client-specific designs
- **Allocation Validation**: Prevents over-allocation of resources

### **Real-time Calculations**
- **Available Power**: Total KVA - Sum of client allocations
- **Available Space**: 30 RU - Sum of client RU usage
- **Utilization Percentages**: Visual indicators for capacity management

### **File Management**
- **Location Design Files**: Facility layout PDFs
- **Rack Pricing Files**: Excel pricing information
- **Client Design Files**: Custom client layout documentation
- **Secure Storage**: Organized file structure with access controls

---

## 🚛 **Carriers Manager**

### **Overview**
Multi-regional carrier relationship management with contact tracking and communication history.

### **Key Features**
- **Regional Organization**: Separate carrier databases for Americas, EMEA, APAC
- **Contact Management**: Comprehensive contact information with role tracking
- **Relationship History**: Track carrier evolution and name changes
- **Communication Tracking**: Last contact dates and update requirements

### **Contact Management**
- **Role-based Contacts**: Different contact types (Sales, Technical, Billing)
- **Update Tracking**: Days since last contact with overdue indicators
- **Approval Workflow**: Contact verification and approval processes
- **Contact History**: Complete communication timeline

### **Regional Capabilities**
- **Americas**: North and South American carrier networks
- **EMEA**: European, Middle Eastern, and African providers
- **APAC**: Asia-Pacific regional carriers
- **Cross-regional Tracking**: Multi-region carrier relationship management

---

## 💱 **Exchange Data Manager**

### **Overview**
Financial trading exchange connectivity management with feed tracking and relationship management.

### **Key Features**
- **Exchange Database**: Global financial exchange inventory
- **Feed Management**: Trading feed specifications and pricing
- **Contact Management**: Exchange relationship contacts
- **Design File Storage**: Connectivity architecture documentation

### **Feed Management**
- **Feed Specifications**: Technical requirements and capabilities
- **Pricing Information**: ISF (Infrastructure Service Fee) tracking
- **Availability Status**: Service availability by region
- **Performance Metrics**: Latency and reliability specifications

### **Design File Management**
- **Connectivity Diagrams**: Technical architecture documentation
- **Upload/Download**: Secure file management for exchange designs
- **Version Control**: Design file revision tracking

---

## 💰 **Exchange Rates Manager**

### **Overview**
Multi-currency exchange rate management for international pricing calculations.

### **Key Features**
- **Currency Support**: Major global currencies (USD, EUR, GBP, JPY, AUD, CAD)
- **Rate Management**: Administrative control over exchange rates
- **Historical Tracking**: Rate change history and audit trail
- **Integration**: Seamless integration with pricing calculations

### **Rate Management**
- **Manual Updates**: Administrative control over currency conversion rates
- **Status Tracking**: Active/inactive currency management
- **Audit Trail**: Complete history of rate changes with user attribution

---

## 🎯 **Exchange Pricing Tool**

### **Overview**
Rapid quote generation system for exchange connectivity with multi-currency support.

### **Key Features**
- **Quick Quotes**: Fast pricing for exchange feed connectivity
- **Multi-Currency**: Customer currency preference support
- **Feed Selection**: Specific trading feed pricing
- **Order Entry**: Service requirement specification
- **Quote History**: Complete pricing history with search capabilities

### **Quote Management**
- **Customer Information**: Complete customer data capture
- **Regional Selection**: Exchange selection by geographic region
- **Feed Specification**: Individual feed pricing and requirements
- **Currency Conversion**: Real-time multi-currency quote generation
- **Email Export**: Direct quote delivery to customers

---

## 📊 **Bulk Upload**

### **Overview**
Comprehensive data import system supporting all major data types with validation and error handling.

### **Supported Modules**
- Network Routes
- Locations and POP Capabilities
- Carriers and Contacts
- Users
- Exchanges and Feeds
- Exchange Contacts
- CNX Colocation data

### **Key Features**
- **Template Generation**: Pre-formatted CSV templates with sample data
- **Data Validation**: Comprehensive field validation and format checking
- **Error Reporting**: Detailed error messages with line-by-line feedback
- **Progress Tracking**: Real-time upload progress monitoring
- **Database Export**: Current data export for template creation

### **Upload Process**
1. **Template Download**: Get properly formatted CSV template
2. **Data Preparation**: Fill template with validated data
3. **Upload Validation**: Automatic data validation and error checking
4. **Import Processing**: Batch data import with progress tracking
5. **Result Review**: Detailed success/error reporting

---

## 📈 **Change Logs Viewer**

### **Overview**
Comprehensive audit trail system tracking all system modifications with detailed change tracking.

### **Key Features**
- **Activity Tracking**: Complete user action monitoring
- **Detailed Logs**: What changed, when, and by whom
- **Filtering Options**: Search by user, date, module, or activity type
- **Audit Trail**: Complete compliance audit capabilities

### **Log Categories**
- **User Actions**: Login, logout, password changes
- **Data Modifications**: Create, update, delete operations
- **File Operations**: Upload, download, delete actions
- **System Changes**: Configuration modifications
- **Pricing Activities**: Quote generation and calculation logs

### **Audit Capabilities**
- **User Attribution**: Every change linked to specific user
- **Timestamp Tracking**: Precise change timing
- **Change Details**: Before/after values for modifications
- **Export Functionality**: CSV export for compliance reporting

---

## 👥 **User Management**

### **Overview**
Complete user lifecycle management with role assignment and module visibility control.

### **Key Features**
- **User Account Management**: Create, modify, activate/deactivate accounts
- **Role Assignment**: Administrator, Provisioner, Read-Only role management
- **Module Visibility**: Granular control over user interface access
- **Password Management**: Forced changes and reset capabilities

### **User Lifecycle**
1. **Registration**: User self-registration with approval workflow
2. **Approval**: Administrative approval with role assignment
3. **Module Access**: Customizable module visibility configuration
4. **Status Management**: Account activation/deactivation
5. **Role Changes**: Dynamic role modification capabilities

### **Access Control**
- **Role-based Permissions**: Hierarchical permission structure
- **Module Visibility**: Per-user interface customization
- **Action Logging**: Complete user activity audit trail

---

## 💵 **Minimum Pricing Manager**

### **Overview**
Location-specific pricing floor management with bandwidth-tiered minimum pricing.

### **Key Features**
- **Location-specific Minimums**: Individual location pricing controls
- **Bandwidth Tiers**: Four-tier pricing structure:
  - Under 100Mb
  - 100-999Mb
  - 1000-2999Mb
  - 3000Mb+
- **Override Protection**: Prevents pricing below configured minimums
- **Regional Variation**: Geographic pricing variation support

### **Integration with Pricing Engine**
- **Automatic Enforcement**: Pricing calculations respect location minimums
- **Tier Selection**: Bandwidth-based tier determination
- **Currency Conversion**: Multi-currency minimum enforcement
- **Margin Calculation**: Minimum integration with margin requirements

---

## ⚙️ **Pricing Logic Manager**

### **Overview**
Central configuration hub for all automated pricing parameters and business rules.

### **Contract Terms Configuration**
Configure pricing margins and charges for different contract lengths:
- **12-Month Contracts**: Minimum margin, suggested margin, NRC charge
- **24-Month Contracts**: Reduced margins and NRC for longer commitment
- **36-Month Contracts**: Lowest margins and NRC for longest commitment

### **Protected Service Margins**
Special margin configuration for protection path pricing:
- **Higher Margins**: Reflect additional value of protection services
- **Contract Variation**: Different margins by contract term
- **Risk Premium**: Account for protection path complexity

### **Additional Charges**
- **Protection Path Multiplier**: Cost multiplier for secondary paths (default 0.7)
- **NRC Variations**: Non-recurring charges by contract term

### **Utilization Factors (Enhanced)**
Bandwidth-based utilization factors for precise cost allocation:

#### **Primary Path Utilization**
- **≤10000Mbit circuits**: Configurable factor (default 0.9)
- **>10000Mbit circuits**: Configurable factor (default 0.9)

#### **Protection Path Utilization**
- **≤10000Mbit circuits**: Configurable factor (default 1.0)
- **>10000Mbit circuits**: Configurable factor (default 1.0)

#### **Utilization Logic**
```javascript
// Bandwidth-based factor selection
if (isProtection) {
  utilizationFactor = segmentBandwidth <= 10000 ? 
    protectionUnder10000 : protectionOver10000;
} else {
  utilizationFactor = segmentBandwidth <= 10000 ? 
    primaryUnder10000 : primaryOver10000;
}

// Cost allocation calculation
allocationRatio = requestedBandwidth / (segmentBandwidth × utilizationFactor);
allocatedCost = segmentCost × allocationRatio;
```

### **Promo Pricing Settings (Enhanced)**
Advanced promotional pricing controls:

#### **Minimum Margin Enforcement**
- **Minimum Margin Percentage**: Required margin for promo pricing (default 35%)
- **Fallback Logic**: Automatic switch to regular pricing if margins not met

#### **Contract Term Discounts (New)**
Additional discounts applied to base promotional prices:
- **24-Month Discount**: Additional 5% off base promo price
- **36-Month Discount**: Additional 10% off base promo price
- **12-Month**: No additional discount (base promo price)

#### **Discount Calculation Flow**
```javascript
// Step 1: Get base promo price
basePromoPrice = findPromoPrice(source, destination, bandwidth);

// Step 2: Apply contract term discount
if (contractTerm === 24) {
  finalPrice = basePromoPrice × (1 - 5%);
} else if (contractTerm === 36) {
  finalPrice = basePromoPrice × (1 - 10%);
} else {
  finalPrice = basePromoPrice; // 12-month, no discount
}

// Step 3: Validate margins
marginCheck = (finalPrice - allocatedCosts) / finalPrice >= minimumMargin;

// Step 4: Use promo if margin met, otherwise fallback to regular pricing
```

### **Dynamic Updates**
- **Real-time Effect**: Changes immediately impact new pricing calculations
- **Audit Trail**: All configuration changes logged with user attribution
- **Validation**: Input validation ensures system stability

---

## 🎯 **Promo Pricing Manager**

### **Overview**
Rule-based promotional pricing system with location pairs and bandwidth-tiered pricing.

### **Promotional Rules**
- **Location Pairs**: Source and destination location combinations
- **Bandwidth Tiers**: Four pricing tiers:
  - Under 100Mb
  - 100-999Mb
  - 1000-2999Mb
  - 3000Mb+
- **Rule Priority**: First-created rule takes precedence for conflicts

### **Enhanced Contract Integration**
- **Base Pricing**: Standard promotional prices per bandwidth tier
- **Contract Discounts**: Additional reductions for longer commitments:
  - 24-month: 5% additional discount
  - 36-month: 10% additional discount
- **Margin Validation**: Ensures profitability after all discounts applied

### **Rule Management**
- **Active/Inactive**: Enable/disable promotional rules
- **Search Functionality**: Find rules by location or name
- **Delete Protection**: Prevent accidental rule deletion
- **Audit Tracking**: Complete rule change history

### **Integration with Pricing Engine**
1. **Rule Matching**: Find applicable rules for route
2. **Tier Selection**: Determine bandwidth tier
3. **Base Price Lookup**: Get promotional price
4. **Contract Discount**: Apply term-based additional discount
5. **Margin Validation**: Check profitability requirements
6. **Fallback Logic**: Use regular pricing if margins insufficient

---

## 🔄 **Pricing Automation Integration**

### **System-wide Pricing Flow**
```
Request → Path Finding → Cost Calculation → Pricing Logic Application → Final Quote
```

### **Component Integration**
1. **Network Design Tool**: Initiates pricing requests
2. **Pricing Logic Manager**: Provides business rules and parameters
3. **Promo Pricing Manager**: Supplies promotional pricing rules
4. **Minimum Pricing Manager**: Enforces location-based minimums
5. **Exchange Rates Manager**: Provides currency conversion
6. **Utilization Factors**: Enable precise cost allocation

### **Advanced Automation Features**
- **Multi-tier Pricing**: Promo → Regular → Minimum fallback logic
- **Bandwidth-based Calculations**: Precise utilization factor selection
- **Contract Optimization**: Automatic best-price calculation
- **Currency Intelligence**: Real-time multi-currency support
- **Margin Protection**: Profitability validation at every step
- **Audit Compliance**: Complete calculation traceability

---

## 📊 **System Architecture**

### **Backend Technologies**
- **Node.js**: Server runtime with Express.js framework
- **SQLite3**: Embedded database with full CRUD operations
- **JWT Authentication**: Secure token-based sessions
- **Multer**: File upload handling and processing
- **JSON2CSV**: Data export functionality

### **Frontend Technologies**
- **React**: Modern UI component framework
- **Material-UI**: Comprehensive design system
- **Axios**: HTTP client for API communication
- **React Router**: Client-side routing

### **Database Design**
- **Normalized Schema**: Efficient relational data structure
- **Audit Tables**: Complete change tracking
- **File Management**: Secure file storage system
- **Performance Optimization**: Strategic indexing and query optimization

### **Security Architecture**
- **Role-based Access Control**: Hierarchical permission system
- **Input Validation**: Comprehensive data validation
- **SQL Injection Prevention**: Parameterized queries
- **File Upload Security**: Type and size restrictions
- **Audit Logging**: Complete security event tracking

---

This documentation provides a comprehensive overview of all system modules with special emphasis on the sophisticated pricing automation engine that powers the Network Inventory Management System.
