# 📘 CNX Eth Design & Pricing Tool - User Guide

**Version**: 3.3.1 | **Last Updated**: January 2025

---

## Overview

The Design & Pricing Tool automatically finds optimal network routes and calculates accurate pricing quotes. It's your intelligent assistant for creating professional customer quotes.

**What it does:**
- Finds best routes between locations (Auto mode)
- Validates custom routes (Manual mode)
- Calculates pricing with margins
- Includes cross-connect costs
- Exports professional quotes
- Logs all calculations for audit

---

## Access & Permissions

**All roles have the same access** - this is a read-only calculation tool that doesn't modify inventory.

✅ Everyone can: Search routes, calculate pricing, export quotes, view pricing logs*

*Note: Read Only users can't see detailed cost breakdowns in logs

---

## Quick Start

### Accessing the Module
1. Login → Left sidebar → **"CNX Eth Design & Pricing Tool"**
2. Click **"Design & Pricing"**

### Two Main Tabs
- **Network Design**: Create quotes (main work area)
- **Pricing Logs**: View historical quotes

---

## Auto Design Mode (Recommended)

Use when you want the system to automatically find the best route.

### Basic Steps

1. **Set Design Mode**: Select "Auto Design" (default)

2. **Enter Basic Info** (recommended):
   - Customer Name: e.g., "Acme Corporation"
   - Quote Request ID: Your tracking number

3. **Required Fields**:
   - **Source Location**: Start point (searchable dropdown)
   - **Destination Location**: End point (must be different)
   - **Bandwidth**: 10-10,000 Mbps (e.g., 1000 = 1 Gbps)

4. **Protection Required** (toggle):
   - OFF: Single path (lower cost)
   - ON: Two diverse paths (higher cost, automatic failover)

5. **Optional Constraints**:
   - **Carrier Avoidance**: Exclude specific carriers
   - **Circuit Exclusion**: Avoid specific circuits
   - **MTU Required**: Minimum MTU (leave blank for 1500)
   - **Include ULL**: Allow Ultra-Low Latency routes (premium)
   - **Include Cisco Only**: Use only Cisco equipment
   - **Use 100Gb and DF only**: High-capacity routes only

6. **Output Settings**:
   - **Currency**: Select customer's currency
   - **Contract Term**: 12, 24, or 36 months

7. **Find Route**: Click blue button

8. **Add Cross-Connects**: Enable source and destination cross-connects

9. **Export Quote**: Email or CSV

### Parameter Locking
⚠️ After clicking "Find Route", all fields lock (grayed out) to prevent accidental changes.

**To start over:** Click **"Refresh"** button at top of Search Parameters.

---

## Manual Design Mode

Use when you need to specify exact circuits.

### Steps

1. **Set Design Mode**: Select "Manual Route Entry"
2. **Enter Basic Info**: Customer Name, Quote ID (optional)
3. **Select Locations**: Source and Destination
4. **Enter Bandwidth**: Required capacity
5. **Enter Primary Routes**:
   - Format: Circuit IDs separated by commas
   - Example: `LONPAR123456, PARSNG789012, SNGHKG345678`
   - System validates as you type
6. **Protection** (optional): Enable and enter Secondary Routes
7. **Output Settings**: Currency and Contract Term
8. **Calculate Pricing**: Click blue button

**Helper Buttons:**
- **Find Suggestions**: System shows available circuits
- **Suggest Secondary Path**: Auto-finds diverse backup path

---

## Understanding Results

### Search Results
Shows the route path with:
- Circuit IDs for each segment
- Latency per segment and total
- Carriers and cable systems
- Number of hops

### Pricing Results

**Without Protection:**
- Primary Path Pricing: Monthly cost for single path

**With Protection:**
- Primary Path Pricing: Main route cost
- Diverse Path Pricing: Backup route cost
- Protected Service Pricing: **TOTAL** (quote this to customer)

**Each shows:**
```
Monthly Recurring Cost: $5,000.00 USD
(Base: $4,000.00 + Margin: $1,000.00)
Contract Term: 12 Months
```

### Cross-Connect Costs

**NRC (Non-Recurring):** One-time installation fee
**MRC (Monthly Recurring):** Ongoing monthly fee

MRC is included in total monthly pricing.

**Mandatory Cross-Connects:**
- Some locations require cross-connects (auto-enabled)
- Cannot be disabled
- Labeled "(Mandatory)" in results

---

## Exporting Quotes

### Email Export
1. Click **"Email Quote"** button
2. Select pricing options to include:
   - For protected service: Check "Protected Service Pricing"
   - For unprotected: Check "Primary Path Pricing"
3. Click **"Generate Email"**
4. Your email client opens with formatted quote
5. Add recipient and send

### CSV Export
1. Click **"Export to CSV"** button
2. Select same options
3. Click **"Export CSV"**
4. File downloads for Excel/Sheets

---

## Pricing Logs

View all historical pricing calculations.

### Accessing
Click **"Pricing Logs"** tab at top

### What's Shown
- Date/Time and User who created quote
- Customer Name and Quote Request ID
- Source, Destination, Bandwidth
- Total MRC, Currency, Contract Term
- Protection status

### Viewing Details
- Click expand arrow for full details (if you have permission)
- Read Only users see logs but not cost breakdowns

### Searching Logs
- Filter by text (customer, quote ID, location)
- Filter by date range
- Filter by user

---

## Key Rules & Tips

✅ **Do:**
- Always include Customer Name and Quote Request ID
- Enable cross-connects for realistic quotes
- Use Refresh button to start new search
- Review path before sending quote
- Save CSV backups of important quotes

❌ **Don't:**
- Forget cross-connects (very common mistake!)
- Send wrong pricing option (Protected vs Primary)
- Try to change locked parameters (use Refresh instead)
- Quote without reviewing route path
- Create duplicate quotes unnecessarily

### Auto Design vs Manual

**Use Auto Design when:**
- ✅ You want fastest results
- ✅ Standard service offering
- ✅ No special routing requirements

**Use Manual Design when:**
- ✅ Specific carrier required
- ✅ Need to match existing design
- ✅ "What-if" analysis

### Protection Decisions

**Include Protection when:**
- ✅ Critical customer services
- ✅ SLA requires uptime
- ✅ Customer willing to pay premium

**Skip Protection when:**
- ✅ Non-critical services
- ✅ Budget constraints
- ✅ Development/test environments

---

## Troubleshooting

**"No route available":**
- Check bandwidth requirement (reduce if too high)
- Remove carrier/circuit exclusions
- Lower MTU requirement
- Try different locations
- Error message explains specific reasons

**Manual route validation fails:**
- Verify circuit IDs are spelled correctly
- Use "Find Suggestions" for available circuits
- Ensure circuits connect end-to-end
- Check bandwidth compatibility

**Cross-connect won't disable:**
- Location is marked as mandatory (correct behavior)
- Pricing will always include it

**Parameters locked:**
- Click **Refresh** button to unlock and reset

**Pricing seems wrong:**
- Verify correct currency selected
- Check contract term (12/24/36 months)
- Ensure cross-connects are enabled
- Confirm looking at correct pricing card

---

## Quick Reference

### Auto Design Workflow
1. Customer Name + Quote ID
2. Source + Destination + Bandwidth
3. Protection? (Yes/No)
4. Constraints (if any)
5. Currency + Contract Term
6. Click "Find Route"
7. Enable Cross-Connects
8. Export Quote

### Manual Design Workflow
1. Customer Name + Quote ID
2. Source + Destination + Bandwidth
3. Enter Primary Routes (circuit IDs)
4. Protection? Enter Secondary Routes
5. Currency + Contract Term
6. Click "Calculate Pricing"
7. Enable Cross-Connects
8. Export Quote

### Important Buttons
- **Refresh**: Unlock fields and reset (top of Search Parameters)
- **Find Route**: Run search in Auto mode
- **Calculate Pricing**: Run calculation in Manual mode
- **Find Suggestions**: Help build circuit path (Manual mode)

### Common Values
- 100 Mbps = 100
- 1 Gbps = 1000
- 10 Gbps = 10000

---

**Questions?** Contact your system administrator
