# 📘 Change Logs - User Guide

**Version**: 3.3.1 | **Last Updated**: January 2025

---

## Overview

The Change Logs module provides a complete audit trail of all changes made in the system. Every add, edit, and delete operation is logged with details about who made the change and when.

**What you can view:**
- Network route changes
- Location changes
- Carrier changes
- Exchange rate changes
- User management changes
- Cross-connect and minimum pricing changes

---

## Access & Permissions

**All roles can access Change Logs** - no special permissions required.

✅ Everyone can:
- View all change logs
- Search and filter logs
- Export log data
- See who made changes and when

---

## Quick Start

### Accessing the Module
1. Login → Left sidebar → **"Change Logs"**
2. Main log viewer opens

### Interface
- **Search Bar**: Filter by username, module, or details
- **Date Filters**: Filter by date range
- **Module Filter**: Filter by specific module
- **Logs Table**: All changes with pagination
- **Page Size**: Select 10, 25, 50, 100, or 200 logs per page

---

## Understanding Log Entries

Each log entry shows:
- **Timestamp**: When the change was made
- **Username**: Who made the change
- **Module**: Which part of system (Network Routes, Locations, etc.)
- **Action**: What was done (Create, Update, Delete)
- **Details**: Specific changes made

### Action Types
- **Create**: New record added
- **Update**: Existing record modified
- **Delete**: Record removed

### Module Types
- Network Routes
- Locations
- Carriers
- Exchange Rates
- Users
- Cross-Connect Info
- Minimum Pricing

---

## Searching & Filtering Logs

### Text Search
- Search by: Username, module name, or any detail text
- Example: Search "LONNYC" to find changes to that circuit
- Example: Search "John" to see changes by user John

### Date Filtering
1. **Start Date**: Show logs from this date forward
2. **End Date**: Show logs up to this date
3. Leave blank to show all dates
4. Use together for specific date range

**Common uses:**
- Last 30 days changes
- Changes during specific maintenance window
- Monthly audit reports
- Quarterly compliance reviews

### Module Filtering
1. Click **Module** dropdown
2. Select specific module (e.g., "Network Routes")
3. Only shows logs for that module
4. Select "All" to clear filter

### Combining Filters
All filters work together:
- Text + Date + Module
- Example: User "John" + Module "Network Routes" + Last 7 days

### Clearing Filters
Click **"Clear Filters"** button to reset all filters and show all logs.

---

## Viewing Log Details

### Log Details Show:
- **Who**: Username and user role
- **When**: Exact date and time (with timezone)
- **What module**: Which part of system
- **What action**: Create, Update, or Delete
- **Specific changes**: Field-by-field changes

### Example Log Entry
```
Timestamp: 2025-01-15 14:30:45 GMT
User: john.smith (Provisioner)
Module: Network Routes
Action: Update
Details: Updated circuit LONNYC123456
- Cost changed from $4,000 to $4,500
- Carrier changed from "Tata" to "NTT Global"
```

---

## Pagination

### Page Navigation
- **Page Size**: Select how many logs per page (10-200)
- **Navigation**: Use "Previous" and "Next" buttons
- **Page Numbers**: Click specific page number
- **Total**: Shows total number of matching logs

**Tip:** Use larger page size (100-200) for searching, smaller (10-25) for browsing.

---

## Exporting Logs

1. Apply any filters you want
2. Click **"Export"** button
3. CSV file downloads with all matching logs
4. Opens in Excel, Google Sheets, etc.

**Export includes:**
- All filtered results (not just current page)
- All columns
- Formatted for reporting

**Use cases:**
- Compliance audits
- Monthly reports
- Investigation of specific changes
- Backup of change history

---

## Common Use Cases

### Compliance Audit
1. Set date range (e.g., last quarter)
2. Export to CSV
3. Review all changes
4. Document for compliance

### Investigating Change
1. Search for affected record (e.g., circuit ID)
2. Review all related log entries
3. Identify who made change and when
4. Determine what was changed

### User Activity Review
1. Search by username
2. Set date range (e.g., last 30 days)
3. Review all their changes
4. Export for performance review

### Module-Specific Audit
1. Filter by module (e.g., "Locations")
2. Set date range if needed
3. Review all changes to that module
4. Identify patterns or issues

---

## Key Rules & Tips

✅ **Do:**
- Review logs regularly for audit purposes
- Use specific date ranges for focused searching
- Export logs for important audits
- Check logs when troubleshooting issues

❌ **Don't:**
- Rely on memory - check logs for exact changes
- Ignore logs - they're your audit trail
- Delete logs (they're permanent and cannot be deleted)

### Best Practices
- **Monthly review**: Quick scan of all changes
- **Quarterly audit**: Export and formal review
- **Incident investigation**: Use logs to trace issues
- **Training**: Show new users how to check their changes

### Understanding Timestamps
- All timestamps in GMT/UTC
- Convert to your local time as needed
- Exact time down to seconds
- Useful for sequence of events

---

## Troubleshooting

**No logs showing:**
- Check date filters aren't too restrictive
- Clear all filters
- Verify you're looking at correct module
- Check search term spelling

**Can't find specific change:**
- Try broader search terms
- Expand date range
- Clear module filter
- Search by username instead

**Export not working:**
- Check browser pop-up blocker
- Verify you have results to export
- Try different browser

---

## Quick Reference

| Task | Steps |
|------|-------|
| View All Logs | Access module, no filters |
| Search by User | Enter username in search |
| Filter by Date | Set start/end dates |
| Filter by Module | Select from dropdown |
| Export Logs | Set filters → Export button |
| Clear Filters | Clear Filters button |

### Common Search Examples

| Search For | Filter Setup |
|------------|--------------|
| Changes by John | Text: "john" |
| Last 30 days | End date: today, Start date: 30 days ago |
| Route changes only | Module: "Network Routes" |
| Specific circuit | Text: "LONNYC123456" |
| Deletions | Text: "Delete" |

---

**Questions?** Contact your system administrator

