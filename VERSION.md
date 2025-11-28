# Network Inventory Management System

## Current Version: **3.4.1**

**Release Date:** November 28, 2024

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
| **Route Finder** | 3.3.3 | ✅ New |
| **KMZ Viewer** | 3.3.3 | ✅ Enhanced |
| **Network Routes Repository** | 3.3.3 | ✅ Active |
| **Network Design & Pricing** | 3.3.3 | ✅ Active |
| **Allocated Cost Calculator** | 3.3.3 | ✅ Active |
| **Analytics Dashboard** | 3.3.3 | ✅ Enhanced |
| **User Management** | 3.3.3 | ✅ Active |
| **Module Permissions** | 3.3.3 | ✅ Enhanced |

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

- **v3.3.3** (Nov 13, 2024): Route Finder module, KMZ caching, analytics enhancements
- **v3.3.2** (Nov 13, 2024): KMZ Viewer optimizations
- **v3.3.1** (Nov 2024): KMZ Viewer initial release
- **v3.3.0** (Oct 2024): Core inventory management

---

## Support

For detailed documentation, troubleshooting, and technical specifications, refer to the individual module documentation files listed above.

**Current Status:** ✅ **Production Ready**

