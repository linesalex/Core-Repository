# 📘 Bulk Upload - User Guide

**Version**: 3.3.1 | **Last Updated**: January 2025

---

## Overview

The Bulk Upload module allows administrators to upload multiple records at once using CSV files. This is much faster than adding records one-by-one through the UI.

**Administrator access only.**

**What you can upload:**
- Network Routes
- Locations
- Carriers
- Cross-Connect Information
- Minimum Pricing

---

## Access & Permissions

**Administrators only** - This module is not visible to other roles.

---

## Quick Start

### Accessing the Module
1. Login as Administrator
2. Left sidebar → **"Admin"**
3. Click **"Bulk Upload"**

### Interface
- **Upload Type** selector: Choose what to upload
- **CSV Template** download: Get correct format
- **File Upload**: Select your CSV file
- **Upload** button: Process the file
- **Results**: Success/error messages

---

## General Process

### Standard Workflow
1. **Download Template**: Get CSV with correct column headers
2. **Fill Template**: Add your data in Excel or Google Sheets
3. **Save as CSV**: Export to CSV format
4. **Upload**: Select file and click Upload
5. **Review Results**: Check success/error messages

⚠️ **Important:** Use templates! They have correct headers and format.

---

## Uploading Network Routes

### Template Columns
- circuit_id (required)
- location_a (required)
- location_b (required)
- equipment_type
- region
- underlying_carrier (required)
- local_loop_carriers_a
- local_loop_carriers_b
- cable_system
- bandwidth (required)
- expected_latency (required)
- mtu
- capacity_usage_percent
- cost (required)
- currency (required)
- is_special (0 or 1)
- tor_network
- more_details

### Key Rules
- circuit_id: Must be unique, 6 letters + 6 digits
- location_a, location_b: Must exist in Locations database
- bandwidth: Numeric (Mbps) or 0 for dark fiber
- expected_latency: Numeric (ms)
- cost: Numeric only (no currency symbols)
- currency: 3-letter code (e.g., USD, EUR)
- is_special: 0 for No, 1 for Yes

### Example Row
```
circuit_id,location_a,location_b,underlying_carrier,bandwidth,expected_latency,cost,currency
LONNYC123456,LON,NYC,Tata Communications,10000,75.5,5000,USD
```

---

## Uploading Locations

### Template Columns
- location_code (required): 3 letters
- city (required): Full city name
- country (required): Full country name
- metro_area: Metro grouping
- region (required): APAC, EMEA, Americas, or Global

### Key Rules
- location_code: Must be unique, exactly 3 uppercase letters
- region: Must be one of: APAC, EMEA, Americas, Global

### Example Row
```
location_code,city,country,metro_area,region
LON,London,United Kingdom,London,EMEA
```

---

## Uploading Carriers

### Template Columns
- carrier_name (required): Full carrier name

### Key Rules
- carrier_name: Must be unique

### Example Row
```
carrier_name
Tata Communications
NTT Global
Level 3
```

---

## Uploading Cross-Connect Information

### Template Columns
- location_code (required): Must exist
- nrc (required): Non-recurring cost (numeric)
- mrc (required): Monthly recurring cost (numeric)
- currency (required): 3-letter code
- mandatory (required): 0 or 1

### Key Rules
- location_code: Must already exist in Locations
- nrc, mrc: Numeric only (no currency symbols)
- mandatory: 0 for No, 1 for Yes

### Example Row
```
location_code,nrc,mrc,currency,mandatory
LON,500,100,USD,1
NYC,750,150,USD,0
```

---

## Uploading Minimum Pricing

### Template Columns
- location_code (required): Must exist
- minimum_price (required): Numeric
- currency (required): 3-letter code

### Key Rules
- location_code: Must already exist in Locations
- minimum_price: Numeric only

### Example Row
```
location_code,minimum_price,currency
LON,1500,USD
NYC,2000,USD
```

---

## CSV File Requirements

### Format Rules
- **File type**: Must be .csv (not .xlsx or .xls)
- **Encoding**: UTF-8 preferred
- **Headers**: First row must be column headers (from template)
- **No empty rows**: Remove blank rows
- **No extra columns**: Stick to template columns

### Common Excel/Sheets Issues
❌ **Don't:**
- Upload Excel files directly (.xlsx)
- Include formulas
- Add extra columns not in template
- Leave empty rows between data

✅ **Do:**
- Save as CSV format
- Use plain text/numbers only
- Remove all formulas before saving
- Clean up data (no extra spaces)

### Saving as CSV
**Excel:**
File → Save As → Choose "CSV (Comma delimited)" format

**Google Sheets:**
File → Download → Comma Separated Values (.csv)

---

## Understanding Results

### Success Messages
- "Successfully uploaded X records"
- Shows how many records were added
- No action needed

### Error Messages
Each error shows:
- **Row number**: Which row in CSV failed
- **Error reason**: What went wrong
- **Fix**: Correct the error and re-upload

### Common Errors
**"Circuit ID already exists (row 5)"**
- Fix: Change circuit ID to unique value or delete existing route

**"Location not found (row 3)"**
- Fix: Add location first, or check spelling

**"Invalid circuit ID format (row 7)"**
- Fix: Must be exactly 6 letters + 6 digits

**"Required field missing (row 10)"**
- Fix: Fill in all required fields

**"Invalid region (row 2)"**
- Fix: Must be APAC, EMEA, Americas, or Global

---

## Key Rules & Tips

✅ **Do:**
- Always use templates
- Test with small file first (5-10 rows)
- Backup existing data before bulk upload
- Review results carefully
- Fix errors and re-upload failed rows

❌ **Don't:**
- Upload without testing
- Ignore error messages
- Upload duplicate data
- Forget to save as CSV format
- Include extra columns

### Best Practices

**Before Upload:**
1. Download template
2. Fill with data
3. Review all required fields
4. Check for duplicates
5. Save as CSV
6. Open CSV in text editor to verify format

**During Upload:**
1. Select correct upload type
2. Choose your CSV file
3. Click Upload
4. Wait for processing (don't refresh page)

**After Upload:**
1. Review success/error messages
2. Fix any errors
3. Re-upload failed rows
4. Verify data in relevant module
5. Check a few records manually

**Large Uploads:**
- Break into smaller files (100-200 rows each)
- Upload in batches
- Test first batch thoroughly
- Proceed with rest if successful

---

## Troubleshooting

**"Invalid file format":**
- Verify it's .csv not .xlsx
- Check file isn't corrupted
- Try re-saving from Excel/Sheets

**"No data found":**
- Check first row has headers
- Verify data starts on row 2
- Remove empty rows

**All rows failing:**
- Check column headers match template exactly
- Verify required fields not blank
- Review CSV in text editor

**Some rows succeed, some fail:**
- Normal! Fix failed rows and re-upload
- Check error messages for specific issues

**Can't download template:**
- Check browser pop-up blocker
- Try different browser
- Contact administrator

---

## Quick Reference

| Upload Type | Required Fields | Key Rules |
|-------------|----------------|-----------|
| **Network Routes** | circuit_id, locations, carrier, bandwidth, latency, cost, currency | Circuit ID must be unique, 6+6 format |
| **Locations** | location_code, city, country, region | Code must be 3 letters, unique |
| **Carriers** | carrier_name | Name must be unique |
| **Cross-Connects** | location_code, nrc, mrc, currency, mandatory | Location must exist first |
| **Min Pricing** | location_code, minimum_price, currency | Location must exist first |

### Workflow Summary
1. Download Template
2. Fill with Data
3. Save as CSV
4. Upload File
5. Review Results
6. Fix Errors & Re-upload if Needed

---

**Questions?** Contact your system administrator

