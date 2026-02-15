# Network Inventory Management System

## Current Version: **3.4.6**

**Release Date:** February 15, 2026

---

## What's New in v3.4.6

### 🛒 **Extranet Pricing — Shopping Basket & Bundle Pricing**

Major overhaul of the Extranet Pricing Tool with provider/product selection, shopping basket functionality, and tiered bundle discounts.

**Provider & Product Selection:**
- Provider Region field moved to the top of the pricing form
- Select from available extranet providers filtered by region
- Select from products associated with the chosen provider
- Auto-populate provider primary and secondary locations from product data
- Auto-populate suggested bandwidth from the product (user can override)
- ISF code displayed in pricing results output
- Manual entry still supported when provider/product not in the extranet list

**Shopping Basket / Bundle Pricing:**
- Add multiple connections to a single pricing bundle (shopping basket)
- "Add Additional Connection" button reopens the quote parameters after adding an item
- Items in the basket can have different member locations, resiliency types, and providers
- All items share the same contract term and currency
- Session-only basket (one active basket per user)
- Bundle discount replaces per-item discount
- Tiered MRC discount based on item count:
  - 1–3 items: configurable maximum discount % (default 20%)
  - 4–5 items: configurable maximum discount % (default 35%)
  - 6+ items: configurable maximum discount % (default 50%)
- NRC charged per item with automatic configurable bundle NRC discount (not displayed to users)
- Bundle discount tiers configurable in Extranet Pricing Admin
- Basket submitted when user selects a discount %

**Datacenter Field Update:**
- `source_datacenters` replaced with `primary_datacenter` and `secondary_datacenters` in extranet products
- POP codes resolved to city locations via `location_reference` table
- `primary_pricing_city` field added to products for manual city override
- Legacy `source_datacenters` field fully removed from codebase

**Analytics & Pricing Logs — Bundle Support:**
- Analytics Dashboard rebuilt with bundle-specific metrics: total bundles, total items in bundles, MRC/NRC from bundles, discount statistics, POA count
- Pricing Logs rebuilt to display bundles as expandable parent rows with individual items nested
- Bundle logs stored in new `extranet_bundle_logs` table
- Individual item lookups linked to bundles via `bundle_id`
- CSV export includes both standalone lookups and bundles with nested items
- Clear logs now clears both individual lookups and bundle logs

**Database Migrations:**
- Migration 028: Splits `source_datacenters` into `primary_datacenter`, `secondary_datacenters`, and `primary_pricing_city` columns in `extranet_products`
- Migration 029: Adds bundle discount parameters (MRC and NRC tiers) to `extranet_parameters`
- Migration 030: Creates `extranet_bundle_logs` table and adds `bundle_id` column to `extranet_pricing_lookups`

**Backend:**
- New endpoint: `/extranet-pricing/resolve-pop-city` — resolves POP codes to city names
- New endpoint: `/extranet-pricing/calculate-bundle` — calculates bundle pricing with tiered discounts and logs to `extranet_bundle_logs`
- New endpoint: `/extranet-pricing/bundle-discounts` — fetches configurable bundle discount tiers
- Updated `/extranet-pricing/logs` — returns both individual lookups and bundle logs with nested items
- Updated `/extranet-pricing/logs/export` — exports bundles and items in structured CSV
- Updated `/analytics/extranet-pricing` — includes bundle-specific metrics
- Fixed 0% discount override bug (JavaScript falsy `0` handled with explicit `undefined` checks)
- Product CRUD endpoints updated for new datacenter fields

**Files Modified:**
- `frontend/src/ExtranetPricingTool.js` — Provider/product selection, shopping basket, bundle UI, pricing logs with expandable bundles
- `frontend/src/ExtranetPricingAdmin.js` — Bundle discount tier configuration (MRC only; NRC hidden from users)
- `frontend/src/ExtranetDataManager.js` — Updated product form for new datacenter fields, removed legacy `source_datacenters`
- `frontend/src/AnalyticsDashboard.js` — Rebuilt Extranet Pricing analytics with bundle metrics
- `backend/routes.js` — New bundle endpoints, updated logs/analytics/export, fixed discount defaults

---

### 🌐 **Extranet Pricing — Provider Region Rate Cards**

The Extranet Pricing Tool now supports 3 separate rate cards based on the provider's region (APAC, AMERs, EMEA). When a provider is located in a specific region, the corresponding rate card is used for all member connectivity pricing.

**Changes:**
- **3 Provider Rate Cards:** Separate rate cards for APAC, AMERs, and EMEA providers. The existing rate card data becomes the APAC provider rate card. AMERs and EMEA rate cards are initialized as POA.
- **Admin Panel:** Provider region sub-tabs (APAC / AMERs / EMEA) on the Rate Card tab allow administrators to view, edit, import, and export each rate card independently.
- **Pricing Calculator:** Provider Region dropdown (auto-populated from provider city) determines which rate card is used. Clearly labeled to indicate rate card selection.
- **Calculation Logic:** The provider's region selects which of the 3 rate cards to use, then the highest tier between provider and member determines the tier, and the pricing region determines the region column within that rate card.
- **Results Display:** Shows which provider rate card was used (e.g., "APAC Rate Card") in the pricing result details and exported quotes.

**Database:**
- Migration 026: Adds `provider_region` column to `extranet_rate_card` table. Recreates table with `UNIQUE(provider_region, bandwidth, region, tier)` constraint. Seeds AMERs and EMEA rate cards with POA values. Existing data assigned to APAC provider region.

**Backend:**
- All rate card endpoints (GET, PUT, POST bulk) support `provider_region` filtering
- Calculate endpoint accepts explicit `provider_region` from the frontend, falls back to provider city's region
- Bulk upload validation includes `provider_region` field

---

### 💰 **Price Negotiation Tracking**

Track price changes throughout the quote negotiation lifecycle with a new `quote_price_stages` table.

**New Feature:**
- **Automatic Initial Offer:** When a quote is created with MRC or NRC values, an "Initial Offer" price stage is automatically added to the negotiation history (uses the quote date as the stage date)
- Record each stage of price negotiation: Initial Offer → Counter Offer → Discounted → Best and Final → Accepted/Rejected
- Stage presets: "Initial Offer", "Counter Offer", "Discounted", "Best and Final", "Accepted", "Rejected" — or type a custom stage name
- Each stage records: MRC, NRC, currency, date, notes, and who added it
- Price change deltas shown between stages (green for decreases, red for increases)
- Overall MRC percentage change summary from first to latest stage
- Latest stage highlighted in the table
- Available in both the Add Quote page (edit mode) and the Quote Repository view dialog
- Price stages are automatically deleted when a quote is deleted (CASCADE)

**Database:**
- Migration 025: Creates `quote_price_stages` table with indexes on `quote_id` and `stage_date`

**Quote Repository Table:**
- Removed "Term" and "Latency" columns from the main quotes table for a cleaner layout
- Both fields remain visible in the quote detail view dialog

### 📋 **Carrier Quote Repository — UX Improvements & Enhanced Search**

**Add Quote Form Redesign (`AddCarrierQuote.js`):**
- Completely redesigned layout with logical sections: Carrier & Service, Route, Bandwidth & Pricing, Additional Details, References, KMZ Route Data, Notes, Attachments
- More spacious and user-friendly layout (max 1100px container, wider fields)
- Carrier dropdown now shows region in brackets — e.g. "Zayo (AMERs)", "Singtel (APAC)"
- Protection dropdown: removed "None" option (leave empty for no selection)
- Dark Fiber bandwidth: when "Dark Fiber" is selected as unit, bandwidth value is not required and field is disabled
- "Scan KMZ" button renamed to "Upload KMZ"
- Internal reference (QR) now allows the same QR code across multiple quotes
- Migration 024 removes UNIQUE constraint on quote_reference column

**Quote Repository Enhanced Search (`CarrierQuoteRepository.js`):**
- **Route Search (City-to-City):** Search quotes by route — e.g. "London" → "Singapore" — using Location A and Location B fields in the primary filter bar
  - Matches POP codes, custom location names, POP city names, and datacenter names
  - Bidirectional arrow icon separates the two location fields
  - General "Any Location" filter still available in advanced filters (matches either side)
- Primary filters: free-text search, region, service type, carrier, route search (Location A → B)
- Collapsible "Advanced Filters" panel with filter count badge:
  - Protection type filter
  - Bandwidth unit filter
  - Currency filter
  - Contract term filter
  - Cable system text filter
  - Any Location filter (matches either side of route)
  - Quote date range (from/to)
  - MRC range (min/max)
  - NRC range (min/max)
- "Clear all filters" button to reset everything at once
- Server-side sorting support (sortable columns now sort on the backend)
- Full-text search now also searches transit_countries
- Dark Fiber quotes display "Dark Fiber" instead of empty bandwidth value
- Location display now shows city names in brackets — e.g. "LONDC01 (London)", "SINGT01 (Singapore)"

**Backend Enhancements:**
- `GET /carrier_quotes` now supports `location_a` and `location_b` query parameters for directional route search
- Route search joins against `location_reference` table to match POP city names and datacenter names
- `GET /carrier_quotes/:id` now returns `location_a_city`, `location_a_datacenter`, `location_b_city`, `location_b_datacenter` from POP location data
- Count query includes proper JOINs for accurate totals with location filters

**Migration Fixes:**
- Migrations 024 and 025 rewritten to use correct `runMigration(callback)` export format matching the migration runner
- Both migrations now include idempotency checks (skip if already applied)

### 🏢 **CNX Colocation Manager — Major Overhaul**

Comprehensive improvements to the CNX Colocation Manager including bug fixes, new features, and a complete colocation pricing tool.

**Bug Fixes:**
- **RU Allocation Calculation**: Fixed `ru_allocated` not counting `ru_purchased` for shared rack clients. Previously only counted explicit `ru_ranges`; now includes `COALESCE(SUM(c.ru_purchased), 0)` so purchased RUs are marked as allocated even without specific rack elevation assignments
- **TOR Network Infrastructure Display**: Fixed display showing boolean Yes/No instead of actual text value (e.g., "Yes - Cisco 3548", "Yes - Extranet")
- **Duplicate `sx` Prop**: Fixed React warning from duplicate `sx` prop in More Info dialog Typography component

**Rack Elevation Dialog Enhancements (`RackElevationDialog.js`):**
- Client dropdown selector when adding/editing devices (replaces free-text client_id input)
- Manual RU range assignment to clients via drag/click interaction on the rack elevation visual
- IPC Reserved RU range management within the rack elevation dialog
- Proper range selector for `ipc_reserved_ru_ranges` in the rack form

**New: Colocation Availability Dashboard (separate sidebar module):**
- Dedicated sidebar navigation item under CNX Colocation
- Summary cards: total locations, available RU, available power (kVA), clients & devices
- Per-location table with RU utilization and power utilization progress bars
- Color-coded utilization indicators (green <70%, orange 70-90%, red >90%)
- Expandable rows showing per-rack details: RU allocated, IPC reserved, available RU, power, clients, devices, TOR infrastructure

**New: Colocation Pricing Tool (separate sidebar module):**
- Dedicated sidebar navigation item under CNX Colocation
- **Pricing Configuration** (Provisioner access): Per-location configurable pricing elements:
  - Currency selection (USD, GBP, EUR, JPY, SGD, HKD, AUD)
  - Price per RU / month (MRC)
  - Price per kW / month (MRC)
  - RU per kW ratio (informational)
  - TOR port and premium TOR port pricing
  - Internet access pricing (fixed 10Mb per connection)
  - Cross connect NRC and MRC
  - Setup/installation NRC (one-time)
  - Contract term discounts (12/24/36 months configurable %)
- **Quote Builder** (Read-Only access): Sales users can generate colocation quotes:
  - Select location (only locations with pricing config are shown)
  - Client details: name, contact, email, rack type (shared/dedicated)
  - Space & power: RU count, power kW (with unit pricing helper text)
  - Add-on services: TOR ports, premium TOR ports, internet access, managed cross connects
  - Contract term selection with discount display
  - Live quote summary panel: MRC breakdown, term discount, NRC, total contract value (TCV)
  - Save quotes to database with auto-generated reference numbers
- **Saved Quotes**: Searchable table of all saved quotes with reference, location, client, type, term, MRC, NRC, created by, and date

**Granular Permission Restructure:**
- Old single `cnx_colocation` permission replaced with three independent module permissions:
  - `cnx_colocation_inventory` — Colocation Inventory (racks, clients, devices, rack elevation)
  - `cnx_colocation_availability` — Availability Dashboard
  - `cnx_colocation_pricing` — Pricing Tool (quote builder + pricing config)
- Sidebar navigation: three sub-items under "CNX Colocation" parent, each gated by its own permission
- Pricing Config tab now accessible to Provisioner-level users (previously admin-only)
- User Management dialog: CNX Colocation permissions visually grouped under a "CNX Colocation" section header
- **Action Required**: Existing users with old `cnx_colocation` permission will need to be re-assigned the new granular permissions by an administrator

**New: Bulk Upload for CNX Colocation:**
- Extended Bulk Upload module to support CNX Colocation data:
  - **Racks**: Upload via CSV with POP code reference to match locations
  - **Clients**: Upload via CSV with rack ID reference
  - **Devices**: Upload via CSV with rack ID reference
- Validation includes POP code lookup, rack ID existence check, and field validation

**Database:**
- Migration 027: Creates `cnx_colocation_pricing_config` table (per-location pricing elements) and `cnx_colocation_quotes` table (saved quotes with pricing breakdowns)

**Backend:**
- New endpoints: `/cnx-colocation/availability`, `/cnx-colocation/pricing-config`, `/cnx-colocation/pricing-locations`, `/cnx-colocation/quotes`
- Updated rack GET endpoint to correctly calculate `ru_allocated` from `ru_purchased`
- New endpoints for client RU range updates and IPC reserved RU range management
- Bulk upload validation and insert logic for racks, clients, and devices

**Files Added:**
- `frontend/src/components/ColocationAvailabilityDashboard.js`
- `frontend/src/components/ColocationPricingTool.js`
- `backend/migrations/027_add_colocation_pricing.js`

**Files Modified:**
- `frontend/src/CNXColocationManager.js` — Added tab navigation (Inventory, Availability, Pricing Tool), bug fixes
- `frontend/src/components/RackElevationDialog.js` — Client dropdown, RU range management
- `frontend/src/api.js` — New API functions for availability, pricing, quotes, RU ranges
- `backend/routes.js` — New endpoints, fixed RU allocation calculation, bulk upload support

---

### Previous in v3.4.5

**Carrier Quote Repository — Split into Two Modules:**

The Carrier Quote system is split into two dedicated modules under the "Carrier Quote Repository" sidebar section:

**1. Add Quote** (`AddCarrierQuote.js`) — Dedicated full-page form
- Standalone page for creating and editing carrier quotes (no longer a popup dialog)
- Store carrier quotes with full details: carrier, service type, bandwidth, MRC/NRC, currency, contract term, latency, protection, cable system
- Internal quote reference (QR) with auto-generation (`QR-YYYYMMDD-XXXX`) or manual entry
- Service types: MPLS, Ethernet, Dark Fiber, Wavelength
- Regions: AMERs, APAC, EMEA, INTER (inter-regional)
- Bandwidth with unit selector (Mbps, Gbps, Dark Fiber)
- Shared currency field for MRC and NRC from Exchange Rates module
- Route Distance (km) removed from the form fields
- "Back to Repository" button for easy navigation
- Supports both add and edit modes (edit navigated from Quote Repository)

**2. Quote Repository** (`CarrierQuoteRepository.js`) — Searchable quote database
- Search and browse all stored carrier quotes with historical data
- Full-text search, filter by region/service/carrier/date range
- Sortable columns with pagination
- CSV export with current filters applied
- "Add Quote" button navigates to the Add Quote page
- "Edit" button navigates to Add Quote page in edit mode
- View quote details dialog with attachments
- Delete quotes with confirmation

**Location Management:**
- Autocomplete from existing POP locations (location_reference table)
- Autocomplete from previously saved custom locations (e.g., "Equinix CH3", "ABCLON1")
- Free-form location entry for new sites - no format restrictions
- Custom locations saved to hidden table for reuse across quotes
- New custom locations prompt for address entry

**KMZ Route Data:**
- KMZ file upload and parsing for automatic route data extraction
- Auto-suggest transit cities from KMZ scan (user can edit)
- Route distance calculation from KMZ coordinates (Haversine formula)
- Transit cities and transit countries fields

**File Attachments:**
- KMZ/KML file upload support
- Document upload support (PDF, EML, DOC, DOCX, XLS, XLSX, PNG, JPG, MSG, TXT, CSV)
- Up to 10 files per upload, 50MB max per file
- Download and delete attachments from quote details view
- Upload additional files to existing quotes

**Sidebar Navigation:**
- "Carrier Quote Repository" parent section with two sub-items:
  - "Add Quote" (NoteAddIcon) — opens the Add Quote page
  - "Quote Repository" (RequestQuoteIcon) — opens the searchable repository

**Audit Trail:**
- Created By / Created Date
- Last Updated By / Updated Date
- All changes logged to Change Logs

**Permissions:**
- Available to all users with `carrier_quote_repository` module access
- Read-only and provisioner permission levels
- Configurable per-user in User Management

**Database:**
- New tables: `carrier_quotes`, `quote_custom_locations`, `quote_attachments`
- Migration `023_add_carrier_quote_repository.js` runs automatically on startup
- Indexed for fast search and filtering

### 🔌 **Route Finder: Cross Connect Pricing Display**

- Automatically displays cross connect NRC and MRC pricing for source and destination locations when route results are shown
- Cross connect pricing incorporates configurable margins from Pricing Logic Manager (NRC margin, MRC margin)
- POA (Price On Application) cross connects are hidden — only locations with defined pricing are displayed
- Customer-owned cross connects shown with "Customer must provide X/C" note
- Mandatory cross connects shown with a "Required" badge
- Currency conversion applied based on selected output currency
- Cross connect pricing included in email export

### 🛡️ **Route Finder: Protected Promo Pricing**

- New third pricing card displayed when BOTH primary and secondary paths qualify for promo pricing
- Protected pricing base: Max(Primary Promo, Secondary Promo) × 1.7 for each bandwidth tier (10Mb, 100Mb, 1Gb, 10Gb)
- Enforces per-bandwidth-tier protected service minimum margins from Pricing Logic Manager
  - If 1.7× does not meet the tier's minimum margin %, the price is raised to satisfy the margin requirement
  - Final price = Max(1.7× price, margin-based price) — ensures both 1.7× floor and margin compliance
- Backend endpoint `/route_finder/calculate-protected-promo` handles per-tier cost allocation, margin validation, and price calculation
- Protected promo pricing included in email export

### 📝 **Route Finder: Search Logging to Pricing Logs**

- Every Route Finder search is automatically saved to the Pricing Logs tab in Network Design Tool
- Logged data includes: search parameters, primary/secondary route results, promo pricing, protected promo pricing, and cross connect pricing
- Displayed with a distinct "Route Finder Search" chip (info/blue color) to differentiate from Network Design pricing logs
- Action type filter dropdown added to Pricing Logs for filtering by log type (Contract Term Pricing, Path Search, Route Finder Search)
- Route Finder logs are view-only (historical display) — no Reload Search or Export buttons
- Route Finder logs only visible to users with `route_finder` permission
- Backend filters out `ROUTE_FINDER_SEARCH` logs for users without route_finder access
- Full route details, segment tables, promo pricing per tier, protected service pricing, and cross connect pricing displayed in expanded log view

### 🐛 **Route Finder: Per-Tier Promo Margin Validation Fix**

- **Critical fix**: Promo pricing margin check now validates ALL four bandwidth tiers independently (10Mb, 100Mb, 1Gb, 10Gb)
- Previously, only the tier matching the requested bandwidth was margin-checked — other tiers were returned unvalidated
- Each tier now calculates its own allocated cost at that tier's bandwidth and validates against the minimum promo margin (default 35%)
- Tiers that fail margin validation return `null` and display as "N/A" instead of showing incorrect prices
- Protected promo pricing correctly skips tiers where underlying individual promo prices are null
- Uses proper utilization factors from Pricing Logic Manager config (primaryUnder10000, primaryOver10000)
- Pricing Logs JSON view now correctly displays Route Finder search data instead of "No results data available"

### 📊 **Route Finder: Detailed Margin Analysis in Pricing Logs**

- Pricing Logs now display comprehensive "Margin Analysis & Pricing Logic" card for Route Finder searches
- **Primary/Secondary Path Margin Check**: Per-tier table showing promo price, allocated cost, actual margin %, required margin %, and pass/fail status for each bandwidth tier (10Mb, 100Mb, 1Gb, 10Gb)
- **Protected Service Pricing Logic**: Per-tier table showing combined allocated cost, 1.7x price, margin-based price, final price, required/actual margins, and which method was used (1.7x Base vs Margin Override)
- Ineligible protected tiers (where underlying promo failed) clearly marked
- Colour-coded rows: green for passing tiers, red for failing tiers
- Full margin details captured from backend responses and stored in pricing log data

### 💱 **Route Finder: Currency Selector**

- Added output currency selector to search parameters
- All promo pricing and cross connect pricing converted to selected currency
- Exchange rates loaded from system Exchange Rates module
- Defaults to USD

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

### 🐛 **Bug Fix: Live Latency Coloring Not Refreshing**

Fixed live latency coloring in the Network Routes table not updating when expected latency is changed.

**Root Cause:** The `getLiveLatencyColor` function was comparing `live_latency` against `sla_latency` instead of `expected_latency`, and used a simple `<=` comparison instead of a 5% threshold. Editing expected latency had no effect on the coloring because the wrong field was being referenced.

**Fix:**
- Live latency coloring now compares `live_latency` vs `expected_latency` with a 5% threshold
- **Black**: Stale data (no update in 24+ hours)
- **Red**: Circuit down (0ms latency)
- **Orange**: >5% difference between live and expected latency
- **Green**: Within 5% of expected latency (normal)
- Live Latency Info popup now shows expected latency and percentage difference

**Files Modified:**
- `frontend/src/NetworkRoutesTable.js` - Updated `getLiveLatencyColor` logic and timestamp dialog

### 🚀 **Performance: KMZ Export Optimization**

Resolved KMZ export hanging or crashing the application when amalgamating circuit KMZ files containing many individual path segments.

**Root Cause:** Each route segment was being created as a separate `<Placemark>` element with its own duplicate `<Style>` block, causing massive XML documents. The synchronous XMLBuilder serialization blocked the Node.js event loop, and maximum ZIP compression (level 9) compounded processing time. The frontend had no way to cancel a long-running export.

**Optimizations Applied:**
- **MultiGeometry grouping:** All route segments per path type now grouped under a single `<Placemark>` with one shared `<Style>` block, dramatically reducing XML output size
- **Manual KML construction:** Replaced synchronous XMLBuilder with async string-based XML generation that yields to the event loop between batches of 50 segments
- **Parallel circuit loading:** Circuit KMZ files now loaded in parallel batches of 3 (previously sequential)
- **Balanced compression:** Reduced ZIP compression from level 9 to level 6 (~3-5x faster, minimal size difference)
- **Cancellation support:** Users can now cancel an in-progress KMZ export via the dialog Cancel button
- **Timeout protection:** Frontend API call now has a 5-minute timeout with clear error messaging
- **Performance logging:** Backend now logs generation timing and statistics for monitoring

**Files Modified:**
- `backend/kmzGenerator.js` - Rewrote buildKMZ with MultiGeometry, parallel processing, event loop yielding, and lower compression
- `frontend/src/api.js` - Added 5-minute timeout and AbortController signal to KMZ export API call
- `frontend/src/NetworkDesignTool.js` - Added cancel button during export, AbortController integration, timeout error handling

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
| **CNX Colocation Manager** | 3.4.5 | ✅ Enhanced |
| **Extranet Data** | 3.4.2 | ✅ Active |
| **Extranet Pricing** | 3.4.6 | ✅ Enhanced |
| **Carrier Quote Repository** | 3.4.5 | ✅ Enhanced |
| **Route Finder** | 3.4.5 | ✅ Active |
| **KMZ Viewer** | 3.3.3 | ✅ Active |
| **Network Routes Repository** | 3.3.3 | ✅ Active |
| **Network Design & Pricing** | 3.3.3 | ✅ Active |
| **Allocated Cost Calculator** | 3.3.3 | ✅ Active |
| **Analytics Dashboard** | 3.4.6 | ✅ Enhanced |
| **User Management** | 3.3.3 | ✅ Active |
| **Module Permissions** | 3.4.2 | ✅ Enhanced |
| **Bulk Upload** | 3.4.5 | ✅ Enhanced |

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

- **v3.4.6** (Feb 15, 2026): Extranet Pricing — Shopping basket/bundle pricing with tiered discounts, provider/product selection with auto-population, datacenter field split, analytics and pricing logs rebuilt for bundles, ISF display, "Add Additional Connection" button; Provider region rate cards (APAC/AMERs/EMEA)
- **v3.4.5** (Feb 15, 2026): CNX Colocation Manager overhaul - Fixed RU allocation calculation, granular permission restructure (inventory/availability/pricing as separate modules), availability dashboard, colocation pricing tool with per-location pricing config and quote builder, bulk upload for racks/clients/devices, rack elevation dialog enhancements; Extranet Pricing Tool - Full member-to-provider pricing calculator with configurable parameters, IPSec surcharges, resiliency types, traffic types, contract terms, and comprehensive analytics; Carrier Quote Repository redesign and enhanced search; KMZ Export performance optimization
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
