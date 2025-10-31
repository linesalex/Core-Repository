# 📘 Manage Carriers - User Guide

**Version**: 3.3.1 | **Last Updated**: January 2025

---

## Overview

The Manage Carriers module is your database of all telecommunications carriers and service providers. Used for tracking carriers in routes and filtering in the Design & Pricing Tool.

**What you can do:**
- Add, edit, and delete carrier records
- Search and filter carriers
- Export carrier data

---

## Access & Permissions

| Role | View | Add | Edit | Delete |
|------|------|-----|------|--------|
| **Administrator** | ✅ | ✅ | ✅ | ✅ |
| **Provisioner** | ✅ | ✅ | ✅ | ✅ |
| **User** | ✅ | ❌ | ❌ | ❌ |
| **Read Only** | ✅ | ❌ | ❌ | ❌ |

---

## Quick Start

### Accessing the Module
1. Login → Left sidebar → **"Network Data"**
2. Click **"Manage Carriers"**

### Interface
- **Search Bar**: Filter carriers by name
- **Add Carrier** button (if permitted)
- **Carriers Table**: All carriers with Edit/Delete buttons
- **Export** button: Download CSV

---

## Adding a Carrier

### Required Field
- **Carrier Name**: Full carrier name (e.g., "Tata Communications", "NTT Global", "Level 3")

### Steps
1. Click **"Add Carrier"**
2. Enter carrier name
3. Click **"Add"**

⚠️ **Important:** Carrier name must be unique

---

## Editing a Carrier

1. Find carrier in table
2. Click **"Edit"** button
3. Modify carrier name
4. Click **"Save"**

⚠️ **Warning:** Changing name affects all routes using this carrier

---

## Deleting a Carrier

1. Find carrier
2. Click **"Delete"** button
3. Confirm deletion

⚠️ **Cannot delete if:** Routes reference this carrier

---

## Key Rules & Tips

✅ **Do:**
- Use official carrier names
- Keep spelling consistent
- Add carriers as needed for routes

❌ **Don't:**
- Use abbreviations or nicknames
- Create duplicates with slightly different spelling
- Delete carriers in use

### Naming Best Practices
- "Tata Communications" ✅
- "TATA" or "Tata" ❌ (inconsistent)
- "NTT Global" ✅
- "NTT" ❌ (incomplete)

---

## Quick Reference

| Action | Steps |
|--------|-------|
| Add Carrier | Add Carrier → Enter name → Add |
| Edit Carrier | Edit button → Modify name → Save |
| Delete Carrier | Delete button → Confirm |
| Search | Type in search box |

---

**Questions?** Contact your system administrator

