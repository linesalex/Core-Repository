# 📘 Network Routes Repository - User Guide

**Version**: 3.3.1 | **Last Updated**: January 2025

---

## Overview

The Network Routes Repository is your central database for managing all network circuit inventory. Track circuits, costs, carriers, latency, files, and dark fiber wavelengths all in one place.

**What you can do:**
- Add, edit, and delete network routes
- Upload KMZ files and test results
- Monitor live latency
- Search and filter routes
- Export data to CSV

---

## Access & Permissions

| Role | View | Add | Edit | Delete | Files |
|------|------|-----|------|--------|-------|
| **Administrator** | ✅ | ✅ | All routes | ✅ | Full access |
| **Provisioner** | ✅ | ✅ | All routes | ✅ | Full access |
| **User** | ✅ | ✅ | Own routes only | ❌ | Upload/Download |
| **Read Only** | ✅ | ❌ | ❌ | ❌ | Download only |

---

## Quick Start

### Accessing the Module
1. Login → Left sidebar → **"Network Routes Repository"**
2. Click **"Network Routes"**

### Interface Overview
- **Search Bar** (top): Filter routes
- **Action Buttons** (left sidebar): Add, Edit, Delete
- **Main Table**: All routes with details
- **Actions Column**: More Details button

---

## Adding a Route

### Required Information
1. **Circuit ID**: 6 letters + 6 digits (e.g., `LONNYC123456`)
   - First 3 letters = Location A code
   - Next 3 letters = Location B code
2. **Location A & B**: Select from dropdown (must be different)
3. **Underlying Carrier**: Carrier name
4. **Bandwidth**: In Mbps (or 0 for Dark Fiber)
5. **Expected Latency**: Round-trip time in ms
6. **Cost**: Monthly cost (numeric only, no symbols)
7. **Currency**: Select from dropdown

### Optional Information
- Equipment Type, Region, Cable System
- Local Loop Carriers (A-End and B-End)
- MTU, Capacity Usage %
- Special/ULL designation
- KMZ file, Test results files
- Notes in "More Details" field

### Steps
1. Click **"Add Route"** in sidebar
2. Fill in required fields
3. Upload files if needed
4. Click **"Add"**
5. System validates and saves

⚠️ **Important Rules:**
- Circuit ID must be unique
- Location A and B must be different
- Cost must be numeric only (no $ signs)
- Circuit ID format must be exact: 6 letters + 6 digits

---

## Editing a Route

1. Click on route row to select it (highlights blue)
2. Click **"Edit Route"** in sidebar
3. Modify any fields
4. Upload new files or delete existing ones
5. Click **"Save"**

**Who can edit:**
- Admins/Provisioners: Any route
- Users: Only routes they created

---

## Deleting a Route

1. Select route
2. Click **"Delete Route"** in sidebar
3. Confirm deletion

⚠️ **Warning:** Deletion is permanent - all files are also deleted

---

## Searching & Filtering

**Available Filters:**
- **Circuit ID**: Partial or full ID
- **Location**: City, country, or location code
- **Cable System**: System name
- **Bandwidth**: Capacity amount
- **Special/ULL**: All / Yes / No
- **Region**: Select one or multiple

**Tips:**
- All filters work together
- Partial matches work for most fields
- Click **Refresh** to clear filters

---

## File Management

### Uploading Files
- **KMZ Files**: One per route (replaces existing)
- **Test Results**: Multiple files supported (PDF, Excel, images)
- Upload during Add or Edit

### Downloading Files
- Click filename in Edit dialog to download

### Deleting Files
- Click trash icon next to filename (Admin/Provisioner only)
- Deletion is permanent

---

## Key Rules & Tips

✅ **Do:**
- Use proper Circuit ID format (6 letters + 6 digits)
- Upload all relevant documentation
- Update costs when contracts renew
- Include notes in "More Details" for important info

❌ **Don't:**
- Use spaces or special characters in Circuit ID
- Delete routes without checking for dark fiber details
- Enter currency symbols in cost field
- Forget to select equipment type and region

---

## Troubleshooting

**Can't add route:** Check Circuit ID format and uniqueness

**Can't edit route:** You may only be able to edit routes you created (User role)

**Can't delete route:** Verify you have Administrator or Provisioner role

**File won't upload:** Check file size and format

---

## Quick Reference

| Task | Steps |
|------|-------|
| Add Route | Sidebar → Add Route → Fill form → Add |
| Edit Route | Select row → Edit Route → Modify → Save |
| Delete Route | Select row → Delete Route → Confirm |
| Search | Enter criteria in search bar |
| Export | Click Export button → CSV downloads |

**Circuit ID Format:** `LONNYC123456` (6 letters + 6 digits)

---

**Questions?** Contact your system administrator
