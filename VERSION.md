# Network Inventory Management System

## Current Version: **3.4.2**

**Release Date:** November 30, 2024

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
