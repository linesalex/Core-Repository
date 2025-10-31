# 📘 Manage Locations - User Guide

**Version**: 3.3.1 | **Last Updated**: January 2025

---

## Overview

The Manage Locations module is your master database of all network connection points worldwide. It stores location details, cross-connect costs, and minimum pricing rules.

**What you can do:**
- Add, edit, and delete locations
- Set cross-connect costs (NRC/MRC)
- Configure mandatory cross-connects
- Set minimum pricing per location
- Search and filter locations
- Export location data

---

## Access & Permissions

| Role | View | Add | Edit | Delete | Cross-Connects | Min Pricing |
|------|------|-----|------|--------|----------------|-------------|
| **Administrator** | ✅ | ✅ | ✅ | ✅ | Full access | Full access |
| **Provisioner** | ✅ | ✅ | ✅ | ✅ | Full access | Full access |
| **User** | ✅ | ❌ | ❌ | ❌ | View only | View only |
| **Read Only** | ✅ | ❌ | ❌ | ❌ | View only | View only |

---

## Quick Start

### Accessing the Module
1. Login → Left sidebar → **"Network Data"**
2. Click **"Manage Locations"**

### Interface Overview
- **Search Bar**: Filter by location code, city, or country
- **Metro Area Filter**: Filter by metro area
- **Region Filter**: Multi-select regions
- **Add Location** button (top right, if permitted)
- **Export** button: Download CSV

---

## Adding a Location

### Required Fields
1. **Location Code**: Exactly 3 uppercase letters (e.g., `LON`, `NYC`, `SNG`)
   - Must be unique
   - Use IATA airport codes when possible
2. **City**: Full city name (e.g., "London")
3. **Country**: Full country name (e.g., "United Kingdom")
4. **Region**: Select one:
   - **APAC**: Asia-Pacific
   - **EMEA**: Europe, Middle East, Africa
   - **Americas**: North and South America
   - **Global**: Multi-region

### Optional Fields
- **Metro Area**: Logical grouping (e.g., "London" for LON, SLO, REA)

### Steps
1. Click **"Add Location"**
2. Fill in required fields
3. Add metro area if applicable
4. Click **"Add"**

⚠️ **Important Rules:**
- Location code must be exactly 3 letters
- Must be unique (check if exists first)
- Cannot reuse deleted location codes
- Use consistent spelling for city/country

---

## Editing a Location

1. Find location in table
2. Click **"Edit"** button (pencil icon)
3. Modify any fields
4. Click **"Save"**

⚠️ **Warning:** Changing Location Code affects all routes using it - avoid unless necessary!

---

## Deleting a Location

1. Find location
2. Click **"Delete"** button (trash icon)
3. Confirm deletion

⚠️ **Cannot delete if:** Any routes use this location as Location A or B

⚠️ **Warning:** Deletion is permanent

---

## Managing Cross-Connect Information

### What It Is
Stores costs for physical connections at each location. Used by Design & Pricing Tool to automatically include in quotes.

### Components
- **NRC (Non-Recurring Cost)**: One-time installation fee
- **MRC (Monthly Recurring Cost)**: Ongoing monthly fee
- **Currency**: Cost currency
- **Mandatory Cross-Connect**: Enforce in Design Tool (checkbox)

### Accessing
Click **"Cross-Connect Info"** button in location row

### Setting Cross-Connect Info

1. Open Cross-Connect Info dialog
2. Enter:
   - **NRC**: Installation cost (numeric)
   - **MRC**: Monthly cost (numeric)
   - **Currency**: Select from dropdown
   - **Enforce Mandatory**: Check if always required
3. Click **"Save"**

### Mandatory Cross-Connects

**What it does:**
- Forces Design Tool to include cross-connect
- Users cannot disable it
- Appears as "(Mandatory)" in quotes

**When to use:**
- Locations that ALWAYS require cross-connects
- Facility policy mandates
- Regulatory requirements

---

## Managing Minimum Pricing

### What It Is
Sets location-specific price floors. Design Tool will never quote below these minimums.

### Why Set It
- Protect margins
- Account for expensive locations
- Market positioning
- Strategic pricing

### Accessing
Click **"Min Pricing"** button in location row

### Setting Minimum Pricing

1. Open Minimum Pricing dialog
2. Enter:
   - **Minimum Price**: Lowest monthly price (numeric)
   - **Currency**: Usually USD
3. Click **"Save"**

**Example minimums:**
- Major financial centers: $2,000/month
- Large metros: $1,000-1,500/month
- Secondary cities: $500/month

---

## Searching & Filtering

**Text Search:** Type in search box (searches code, city, country)

**Metro Area Filter:** Select metro from dropdown

**Region Filter:** Check one or more regions

**Combine filters:** All work together

**Clear filters:** Click "Clear Filters" button

---

## Key Rules & Tips

✅ **Do:**
- Use IATA airport codes for location codes
- Keep city/country spelling consistent
- Update cross-connect costs when rates change
- Set mandatory flags appropriately
- Review minimum pricing quarterly

❌ **Don't:**
- Use random 3-letter codes
- Change location codes unnecessarily
- Forget to set cross-connect info for new locations
- Set minimums arbitrarily
- Delete locations with existing routes

### Location Code Best Practices
- LON = London ✅
- NYC = New York City ✅
- SNG = Singapore ✅
- ABC = Random ❌

### Cross-Connect Tips
- Get official costs from facility provider
- Update annually or when rates change
- Use consistent currency within metro
- Set mandatory only when required

### Minimum Pricing Strategy
- Set for key markets
- Higher for premium locations
- Review quarterly
- Adjust based on market

---

## Troubleshooting

**Can't add location:**
- Check you have Admin/Provisioner role
- Verify location code is exactly 3 letters
- Ensure code isn't already used

**Can't delete location:**
- Check for routes using this location
- Delete or modify routes first
- Or check you have permission

**Cross-connects not working in Design Tool:**
- Verify NRC and MRC are set
- Check currency is selected
- Ensure values aren't zero

**Minimum pricing not enforcing:**
- Verify minimum is set and not zero
- Check currency matches
- Review pricing logs for actual quotes

---

## Quick Reference

### Common Actions

| Action | Steps |
|--------|-------|
| Add Location | Add Location → Fill form → Save |
| Edit Location | Edit button → Modify → Save |
| Delete Location | Delete button → Confirm |
| Set Cross-Connect | Cross-Connect Info → Enter costs → Save |
| Set Mandatory XC | Cross-Connect Info → Check box → Save |
| Set Min Pricing | Min Pricing → Enter amount → Save |
| Search | Type in search box |
| Export | Export button → CSV downloads |

### Field Formats

| Field | Format | Example |
|-------|--------|---------|
| Location Code | 3 uppercase letters | LON |
| City | Full name | London |
| Country | Full name | United Kingdom |
| Metro | Main city | London |
| NRC/MRC | Numeric only | 500 |

### Regions

| Region | Examples |
|--------|----------|
| APAC | Singapore, Hong Kong, Tokyo, Sydney |
| EMEA | London, Paris, Dubai, Frankfurt |
| Americas | New York, Los Angeles, São Paulo |
| Global | Multi-region hubs |

---

**Questions?** Contact your system administrator
