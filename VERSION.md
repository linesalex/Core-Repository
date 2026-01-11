# Network Inventory Management System

## Current Version: **3.4.5**

**Release Date:** January 11, 2026

---

## What's New in v3.4.5

### 🌐 **New Feature: Extranet Pricing Tool**

A comprehensive pricing calculator for extranet member-to-provider connectivity.

**User-Facing Pricing Tool:**
- Calculate extranet connectivity pricing between member and provider locations
- Provider Location: Primary and Secondary (optional) city selections
- Member Location: Primary and Secondary (optional) city selections
- Member Resiliency Types: Non-Resilient, Single Site Resilient, Split Site Resilient, Dual Site Resilient
- Member On/Off Net: On Net or Off Net (minimum 10Mb for Off Net)
- Member Cloud Option: Discount for members in AWS/GCP/Azure
- Bandwidth Selection: From existing rate card bandwidths
- Traffic Type: Live/Live or Live/Standby
- IPSec Option: Optional surcharge based on bandwidth tier and resiliency
- Contract Terms: 12, 24, or 36 months with configurable NRC and discounts
- Currency Conversion: All currencies from Exchange Rates module supported
- Discount Request: Users can request up to admin-configured maximum discount

**Pricing Calculation Logic:**
- Base price from rate card (higher tier of provider/member primary locations)
- Resiliency multiplier applied (configurable, e.g., 70% for Non-Resilient)
- Traffic type multiplier applied (e.g., 125% for Live/Live)
- Discounts applied INDEPENDENTLY (not compounding): Cloud + Contract Term + User Discount
- IPSec surcharge added as separate line item (not subject to discounts)
- Currency conversion using exchange rates
- NRC based on contract term

**Admin Pricing Configuration:**
- New "Parameters" tab in Extranet Pricing Admin
  - Resiliency Percentages (4 types)
  - Traffic Type Percentages (2 types)
  - Cloud Discount %
  - Contract Term Discounts and NRCs (12/24/36 month)
  - Maximum User Discount %
- New "IPSec Surcharges" tab
  - Configure surcharges by bandwidth tier (Under 10Mb, 10-99Mb, 100Mb+)
  - Separate rates for Non-Resilient vs Resilient connections

**Analytics Dashboard Enhancements:**
- Enhanced Extranet Pricing tab with new metrics:
  - IPSec Required count
  - Cloud Member count
  - Discount request statistics (count + average %)
  - Resiliency type distribution (pie chart)
  - Contract term distribution (bar chart)
  - Traffic type distribution (pie chart)
  - Currency distribution (horizontal bar chart)
  - Most searched city pairs (table)

**Database Changes:**
- New table: `extranet_pricing_parameters` (key-value pricing configuration)
- New table: `extranet_ipsec_surcharges` (IPSec surcharge rates by tier)
- Enhanced `extranet_pricing_lookups` with additional analytics columns

**Files Added:**
- `backend/migrations/022_extranet_pricing_tool.js`

**Files Modified:**
- `frontend/src/ExtranetPricingTool.js` - Complete rewrite with full pricing form
- `frontend/src/ExtranetPricingAdmin.js` - Added Parameters and IPSec tabs
- `frontend/src/AnalyticsDashboard.js` - Enhanced Extranet Pricing analytics
- `frontend/src/api.js` - Added extranetPricingApi functions
- `backend/routes.js` - Added pricing calculation and parameter endpoints

---

## What's New in v3.4.4

### 🔐 **Security & Permissions**

**Manage Carriers Module:**
- Fixed visibility of edit/delete action buttons for read_only users
- Contact edit and delete buttons now properly hidden for users without edit/delete permissions
- Overdue contacts approve and delete buttons now properly hidden for users without edit/delete permissions
- Previously, read_only users could see buttons but actions would fail - now buttons are hidden entirely

**KMZ Viewer - Location Pins Access:**
- Fixed 403 error for sales users when loading location pins
- Location pins download endpoint now accessible to all users with KMZ Viewer module access
- Previously restricted to administrators only - now uses module-based permissions

### ✨ **Enhancements**

**CNX Ethernet Route Finder - Route Results:**
- Added Bandwidth column to Route Results table for both Primary and Secondary paths
- Bandwidth displays in readable format (e.g., 10 Gbps, 100 Gbps, Dark Fiber)
- Column order: Circuit ID | Segment | Bandwidth | Latency | Cable System

**CNX ETH Design & Pricing Tool - Location Dropdowns:**
- Changed Source and Destination location dropdown display format
- Now shows: `POP Code - Datacenter Name` (e.g., "IPCSNG - Equinix SG1")
- If no datacenter name available, shows only POP Code
- Previously showed: `POP Code - City, Country`

### 🐛 **Bug Fixes**

**KMZ Viewer - AMERs Route Count:**
- Fixed AMERs region displaying 0/0 routes in the route count filters
- Added case-insensitive region normalization (AMERS → AMERs)
- All region counts now display correctly regardless of database case formatting

**CNX ETH Design & Pricing Tool - Pricing Logs Pagination:**
- Fixed pagination not loading correctly on page 1 with stale data
- Search and filter changes now properly reset pagination to page 1
- Eliminated race condition where initial load and useEffect both triggered API calls
- Fixed fallback case that left pagination in stale state when API returned unexpected format
- Pagination now syncs page number from server response to prevent state drift

**Allocated Cost Calculator - Pricing Logs Pagination:**
- Fixed API function `getAllChangeLogs` that was stripping pagination data from responses
- Applied same pagination fixes as Network Design Tool
- Added proper `handleLogSearchChange` handler with page reset

**Feedback Module - File Attachments:**
- Fixed SQLITE_CONSTRAINT error when attaching files to bug reports/feature requests
- Corrected SQLite callback pattern: `statement?.lastID` → `this.lastID` (SQLite3 Node.js API)
- Also fixed same issue in CNX Colocation rack/client creation and feedback comments

---

## What's New in v3.4.3

### 🐛 **Bug Fixes & Improvements**

**Promo Pricing Manager:**
- Removed same-city validation restriction for destination locations
- Destinations can now span multiple cities (displayed as "London, Paris, etc.")
- Source locations still require same-city validation

**Route Finder:**
- Fixed promo pricing state preservation when navigating to/from KMZ Viewer
- Updated promo pricing note: "Note: Promo pricing is budgetary and subject to capacity confirmation."
- Email export now includes "12 Month Contract - $1,000 NRC Applies to each option" under promo pricing headers

**KMZ Viewer:**
- Fixed location pin display - now shows all pins when opened from Route Finder
- Automatically zooms to source location when opened from Route Finder

**Allocated Cost Calculator:**
- Fixed "Reload Search" to properly restore incremental costs as editable (not locked)
- Users can now review and save restored incremental costs to push them into routes
- Improved success message guidance for reloaded searches

**Route Updates:**
- Circuit IDs are now clickable links
- Clicking navigates to Network Routes table filtered by that circuit
- Works for all sections: Under Direct Replacement, Under Decommission, New Provisioning

**Carrier Contacts & Bulk Upload:**
- Changed validation: Either Contact Name OR Contact Job Title is required (not both)
- Updated bulk upload validation to match

---

## What's New in v3.4.2

### 🌐 **New Module: Extranet Data**
A comprehensive new module for managing extranet provider information, products, contacts, and pricing. Designed for financial extranet services (Layer 3 IP MPVPN networks connecting providers to members).

**Extranet Providers:**
- Provider management with region, salesperson, and availability tracking
- Provider Resiliency options: Multi-Site Resilient, Split-Site Resilient, Single-Site Resilient, Single-Site Non-Resilient
- Website link integration (click-through for users)
- "Previously Known As" field with info popup and search filter support
- More Info field for additional notes

**Extranet Products:**
- Product creation under providers with Product Name and mandatory ISF field
- ISF Resiliency options: Single-Site Resilient, Multi-Site Resilient, Split-Site Resilient, Non-Resilient, Multi-Region Resilient
- Suggested Bandwidth (Mb) field
- Source Datacenters with dual validation:
  - Existing locations from Manage Locations
  - External locations in format: 6 uppercase letters + numbers (e.g., EQXLON4, CYXNYC2)
- Design file upload (PDF only)
- Design Template upload (any file type up to 10MB)
- Download naming convention: `Region_Provider_ISF.extension`

**Extranet Contacts:**
- Contact management matching Manage Carriers format
- Fields: Contact Type (dropdown), Contact Level (dropdown), Contact Name, Job Title, Email, Phone Number, Notes (info popup)
- Overdue contact tracking (365+ days)
- Last updated user tracking

**Extranet Pricing Admin (Role Restricted):**
- Rate card matrix: Bandwidths (64Kb to 100Mb) × Tiers (Metro, Tier 1, Tier 2, Tier 3) × Regions (AMERs, APAC, EMEA)
- POA (Price On Application) support as default value
- City tier management with City and Country fields
- City search via Autocomplete from Manage Locations
- CSV import/export for rate card data
- Compact table layout without horizontal scrolling

**Extranet Pricing Tool:**
- User-facing price lookup interface
- Region-filtered provider/product selection
- Cascading dropdowns: Region → Provider → Product → Bandwidth
- POA display for unavailable pricing

### 🔄 **Updated Modules**

**Exchange Contacts:**
- Updated to match Manage Carriers contact format
- Added Contact Level dropdown
- Added Notes field (info popup)
- Removed Daily Contact checkbox and Country field

**Manage Carriers:**
- Notes field changed from text display to info popup

### 🔐 **Permissions & Access**
- Single `extranet_data` permission covers all extranet functionality
- Admin users automatically have full access to all modules
- Added to User Management permission templates

### 📊 **Analytics Integration**
- Extranet Pricing tab in Analytics Dashboard
- Track price lookups by user, date, and region
- Most searched bandwidths and tiers reporting
- Most searched providers tracking

### 📝 **Change Logging**
- All extranet operations logged:
  - Provider create/update/delete
  - Product create/update/delete
  - Contact create/update/delete
  - Rate card updates
  - City tier assignments

### 📤 **Bulk Upload**
- Extended to support extranet data:
  - Extranet Providers
  - Extranet Products
  - Extranet Contacts
  - Rate Card data

### 🗄️ **Database**
- New tables: `extranet_providers`, `extranet_products`, `extranet_contacts`, `extranet_rate_card`, `extranet_pricing_cities`, `extranet_pricing_analytics`
- Migration files: `020_add_extranet_module.js`, `021_extranet_updates.js`

---

## What's New in v3.4.1

### 🔧 **Bug Fix: Protected Pricing with Promo Pricing**
Fixed an issue where protected pricing calculation did not account for promo pricing being used on individual paths, which could lead to protected pricing being cheaper than both individual primary or secondary routes.

**New Protected Pricing Logic:**
- **Both paths use promo**: Protected = Max(Primary Promo, Secondary Promo) × 1.7 (if meets 35% margin requirement)
- **Only Primary uses promo**: Protected = Primary Promo Price + Secondary Regular Price
- **Only Secondary uses promo**: Protected = Primary Regular Price + Secondary Promo Price  
- **Neither path uses promo**: Standard margin-based calculation (unchanged)
- **Margin fallback**: If the 1.7x calculation doesn't meet 35% minimum margin, falls back to margin-based calculation

---

## What's New in v3.3.3

### 🎉 **Route Finder Module**
A new lightweight route search tool designed for sales teams to quickly find network paths between locations without the complexity of pricing calculations.

**Key Features:**
- Two search modes: Fastest Route & Standard Route (excludes Cisco/Special)
- Simple input: Source, Destination, Bandwidth, MTU
- Results: Primary + Diverse Secondary paths
- Email export (`.eml` format)
- Full analytics tracking

### 🚀 **Performance Enhancements**
- **KMZ File Caching**: 1-hour browser cache reduces server load by 70-90%
- ETag-based change detection for efficient updates

### 📊 **Analytics Dashboard**
- New "Route Finder" analytics tab
- Track searches, route pairs, bandwidth usage, user activity
- Beautiful charts and CSV exports

### 🔐 **Module Permissions**
- Route Finder and KMZ Viewer added to permission management
- Granular access control: read_only, provisioner, admin

---

## Module Overview

| Module | Version | Status |
|--------|---------|--------|
| **Extranet Data** | 3.4.2 | ✅ New |
| **Extranet Pricing** | 3.4.2 | ✅ New |
| **Route Finder** | 3.3.3 | ✅ Active |
| **KMZ Viewer** | 3.3.3 | ✅ Active |
| **Network Routes Repository** | 3.3.3 | ✅ Active |
| **Network Design & Pricing** | 3.3.3 | ✅ Active |
| **Allocated Cost Calculator** | 3.3.3 | ✅ Active |
| **Analytics Dashboard** | 3.4.2 | ✅ Enhanced |
| **User Management** | 3.3.3 | ✅ Active |
| **Module Permissions** | 3.4.2 | ✅ Enhanced |
| **Bulk Upload** | 3.4.2 | ✅ Enhanced |

---

## Quick Links

- 📘 **Full Changelog**: See `CHANGELOG.md`
- 📖 **Route Finder Docs**: See `ROUTE_FINDER_DOCUMENTATION.md`
- 🚀 **Quick Start**: See `ROUTE_FINDER_IMPLEMENTATION_SUMMARY.md`
- 📊 **Performance Notes**: See `PERFORMANCE_NOTES.md`
- 🗺️ **KMZ Viewer Docs**: See `KMZ_VIEWER_DOCUMENTATION.md`

---

## System Requirements

- **Node.js**: 14.x or higher
- **React**: 18.2.0
- **SQLite**: 3.x
- **Browser**: Chrome, Firefox, Edge (latest versions)
- **Cesium**: 1.135.0 (for KMZ Viewer)

---

## Installation

For new installations or updates:

1. **Backend**:
   ```powershell
   cd backend
   npm install
   node server.js
   ```

2. **Frontend**:
   ```powershell
   cd frontend
   npm install
   npm start
   ```

3. **Cesium Assets** (if using KMZ Viewer):
   ```powershell
   cd frontend
   ./setup-cesium.bat  # Windows
   # or
   ./setup-cesium.sh   # Linux/Mac
   ```

---

## Version History

- **v3.4.5** (Jan 11, 2026): Extranet Pricing Tool - Full member-to-provider pricing calculator with configurable parameters, IPSec surcharges, resiliency types, traffic types, contract terms, and comprehensive analytics
- **v3.4.4** (Jan 11, 2025): Carriers module - hide action buttons for read_only users; Route Finder - added Bandwidth column to route results; Fixed pricing logs pagination in Design & Pricing and Allocated Cost Calculator tools; Fixed feedback file attachment SQLITE_CONSTRAINT error
- **v3.4.3** (Dec 1, 2024): Bug fixes - Promo pricing, KMZ viewer, Route Updates clickable circuit IDs
- **v3.4.2** (Nov 30, 2024): Extranet Data module - providers, products, contacts, and pricing
- **v3.4.1** (Nov 28, 2024): Protected pricing promo fix - handles promo pricing scenarios correctly
- **v3.4.0** (Nov 2024): Bandwidth-based pricing tiers
- **v3.3.3** (Nov 13, 2024): Route Finder module, KMZ caching, analytics enhancements
- **v3.3.2** (Nov 13, 2024): KMZ Viewer optimizations
- **v3.3.1** (Nov 2024): KMZ Viewer initial release
- **v3.3.0** (Oct 2024): Core inventory management

---

## Support

For detailed documentation, troubleshooting, and technical specifications, refer to the individual module documentation files listed above.

**Current Status:** ✅ **Production Ready**
