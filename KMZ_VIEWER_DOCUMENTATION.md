# KMZ Viewer Module - Documentation

## 📦 Installation on Server

### **Prerequisites:**
- Node.js installed
- Backend and frontend already deployed
- Database accessible

### **Step 1: Install Cesium Assets**

The KMZ Viewer requires Cesium's static assets to be copied to the public folder.

**On Windows Server:**
```bash
cd frontend
setup-cesium.bat
```

**On Linux Server:**
```bash
cd frontend
chmod +x setup-cesium.sh
./setup-cesium.sh
```

This copies Cesium assets (~50MB) from `node_modules/cesium/Build/Cesium` to `public/cesium/`.

### **Step 2: Rebuild Frontend**

```bash
cd frontend
npm run build
```

### **Step 3: Deploy**

Ensure the `public/cesium/` folder is included in your deployment.

### **Step 4: Grant Permissions**

1. Log into application as admin
2. Go to **User Management**
3. For each user who needs access:
   - Select user
   - Grant **KMZ Viewer** permission (read_only, provisioner, or admin)
   - Save

### **Step 5: Verify**

1. Log in as a user with permission
2. Navigate to **Network Routes Repository → KMZ Viewer**
3. Viewer should load with CartoDB Light map
4. Dark Fiber and 100Gb routes should auto-load

---

## 📋 Module Summary

### **Purpose:**
View network route KMZ files overlaid on a 3D globe with filtering and search capabilities.

### **Key Features:**

**1. Primary Bandwidth Filters**
- Dark Fiber (auto-loaded) - Shows count: `Dark Fiber (5/45)` = 5 loaded out of 45 available
- 100Gb circuits (auto-loaded)
- 10-99Gb circuits (optional)
- <10Gb circuits (optional)
- **Check to load ALL routes** for that filter
- **Uncheck to remove ALL routes** for that filter

**2. Advanced Search**
- Search by site code (e.g., IPCLON7)
- Search by circuit ID
- Bulk add all routes for a location
- Example: Type "IPCLON" → option to add all London routes at once

**3. Route Management**
- Routes grouped by bandwidth category
- Individual visibility toggles
- Zoom to specific route
- Remove individual routes
- Clear all routes

**4. Route Details**
- Click any route on the map
- View popup with:
  - UCN (Circuit ID)
  - Source & Destination
  - Bandwidth
  - Expected Latency
  - Cable System
  - Underlying Carrier

**5. Map**
- CartoDB Light (clean street map with labels)
- City names visible for datacenter locations
- Full 3D globe navigation
- Zoom/rotate/pan controls

### **Permissions:**
- Module: `kmz_viewer`
- Levels: read_only, provisioner, admin (all have same access currently)
- Separate from `network_routes` permission

### **Performance:**
- Handles 300+ routes in database
- Auto-loads ~50-150 routes on startup (Dark Fiber + 100Gb)
- Individual route load: 1-2 seconds (cached after first load)
- Bulk location add: 5-10 seconds
- **Caching**: KMZ files cached for 1 hour in browser (reduces server load)

### **Browser Requirements:**
- Modern browser with WebGL support
- Chrome, Firefox, Edge, Safari (latest versions)
- ~200-300MB memory usage

### **Network Requirements:**
- Internet connection for map tiles (CartoDB)
- Backend API access for KMZ files
- HTTPS recommended for production

---

## 🔧 Troubleshooting

**Routes not loading:**
- Check user has `kmz_viewer` permission
- Verify `/public/cesium/` folder exists
- Check browser console for errors

**Map shows blue globe (no tiles):**
- Hard refresh: Ctrl+Shift+F5
- Check internet connection
- CartoDB tiles may be blocked by firewall

**Cesium errors:**
- Verify `setup-cesium` script ran successfully
- Check `/public/cesium/` contains files
- Re-run setup script and rebuild

---

## 📞 Support

For issues:
1. Check browser console (F12)
2. Verify Cesium assets copied
3. Confirm user permissions granted
4. Review backend logs for API errors

