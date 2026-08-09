# Network Inventory Management System

## Current Version: **3.5.0**

**Release Date:** August 9, 2026

---

## What's New in v3.5.0

### 📊 **Market Data & Extranet Module Merge**

**Exchange Data** and **Extranet Data** sidebars are consolidated into a single **Market Data & Extranet** parent module.

- **Contacts:** Exchange Contacts and Extranet Contacts merged into one submodule (**Market Data & Extranet Contacts**) with a unified `market_data_contacts` table (Exchange field set: country, daily contact, more info). Parent rows live in `market_data_organizations` (type exchange / extranet).
- **Kept under Market Data & Extranet:** Extranet Providers, Extranet Pricing Tool, Pricing Admin (admin-only).
- **Removed:** Exchange Feeds, Exchange Pricing Tool (and related exchange feed/pricing storage).
- **Permissions:** New `market_data_contacts` key; `extranet_providers` and `extranet_pricing` retained under the **Market Data & Extranet** permission group. Retired keys (`exchange_feeds`, `exchange_contacts`, `exchange_pricing`, `extranet_contacts`, legacy `exchange_data` / `extranet_data`) are migrated away.
- **Migrations:** `047_merge_market_data_contacts.js` merges contacts and drops only retired tables; Extrant Providers/products and Extrant pricing tables/permissions are **preserved** for production. `048_restore_extranet_pricing_providers.js` is a safety/no-op ensure step (creates missing tables only if absent; does not wipe production data).
- **Analytics:** Extranet Pricing analytics tab retained.
- **Dark mode:** Provider rate card grid in Pricing Admin uses theme tokens (`background.paper`, region tint `.50`s) so cells remain readable in dark mode.

**Files Added:**
- `frontend/src/MarketDataContactsManager.js`
- `backend/marketDataRoutes.js`
- `backend/migrations/047_merge_market_data_contacts.js`
- `backend/migrations/048_restore_extranet_pricing_providers.js`
- `backend/test_v350_market_data_extranet_merge.js`

**Files Removed:** `frontend/src/ExchangeDataManager.js`, `frontend/src/ExchangePricingTool.js`  
**Files Modified:** `frontend/src/App.js`, `frontend/src/UserManagement.js`, `frontend/src/api.js`, `frontend/src/ChangeLogsViewer.js`, `frontend/src/AnalyticsDashboard.js`, `frontend/src/ExtranetPricingAdmin.js`, `backend/routes.js`, `backend/auth.js`  
**Test:** `backend/test_v350_market_data_extranet_merge.js`

### 🌙 **Application Dark Mode**

App-wide **light/dark theme** toggle, defaulting to dark for new sessions.

- Toggle lives in the user menu **directly under Text Size** (light/dark only — no system-follow mode)
- Preference persists in browser `localStorage` (`themeMode`)
- MUI `ThemeProvider` with mode-aware soft tint tokens (`primary.50`, `success.50`, etc.) so tables, pricing cards, and analytics stay readable
- Hardcoded light surfaces and `.dark` text colors across pricing tools, outages, routes, analytics, and feedback updated to theme tokens
- Email / quote HTML exports remain light-themed by design

**Files Added:** `frontend/src/ThemeContext.js`, `backend/test_v350_dark_mode.js`  
**Files Modified:** `frontend/src/App.js`, pricing tools (One Directory, Extranet, Design, Allocated Cost, Route Finder), Analytics, Core Outages, Network Routes, Feedback, and related managers  
**Test:** `backend/test_v350_dark_mode.js`

### 🔌 **Network Routes Repository: Cross Connects Pricing Submodule**

New **Cross Connects Pricing** page under **Network Routes Repository**, giving sales users a read-only, sales-facing view of cross connect pricing sourced from **Manage Locations → Cross Connect Info**.

- Displays **POP Code, Datacenter Name, City, Country, NRC, MRC, Currency, Mandatory, Customer-Owned,** and **Datacenter Notes** (reuses the existing Cross Connect Notes field) for every active location, in a single table
- Prices apply the standard **Cross Connect margin** (from Pricing Logic Manager) — raw internal NRC/MRC cost is never shown, only the marked-up sell price
- **Currency selector** converts all rows to a single output currency, same conversion logic as CNX Ethernet Route Finder
- **Search** matches **POP Code**, **Datacenter Name**, or **Datacenter Notes** in one search box
- Access reuses the existing **Network Routes** module permission (no new permission to configure) — visible to any role with Network Routes Repository access, including Sales

**Files Modified:** `backend/routes.js`, `frontend/src/api.js`, `frontend/src/App.js`  
**Files Added:** `frontend/src/CrossConnectsPricing.js`  
**Test:** `backend/test_v350_cross_connects_pricing.js`

### 🚫 **Promo Pricing Manager: Excluded Circuit IDs**

Admins can now exclude specific circuits from promo pricing eligibility, in addition to the existing "required circuits" list.

- New **"Excluded Circuit IDs"** multi-select on the Add/Edit Promo Rule dialog — if a route uses ANY of these circuits, the promo will not apply
- Exclusion always takes precedence over a required-circuit match (if a circuit is listed in both, the promo can never apply via that circuit)
- Warning banner shown in the dialog if a circuit is listed in both the required and excluded lists
- New "Excluded Circuits" column in the promo rules table
- `POST /promo-pricing` and `PUT /promo-pricing/:id` now accept and persist `excluded_circuit_ids`
- `POST /route_finder/check-promo-match` now disqualifies a route if any of its circuits are in a rule's excluded list

**Files Added:** `backend/migrations/044_add_promo_excluded_circuits.js`  
**Files Modified:** `backend/routes.js`, `frontend/src/PromoPricingManager.js`

### 🔎 **CNX Ethernet Route Finder: "Find Promo Pricing" Button**

New button that actively searches for the best route between the selected source/destination for which promo pricing is valid at the chosen bandwidth, rather than only checking whether the default shortest-latency route happens to qualify.

- New **"Find Promo Pricing"** button next to "Find Route" (requires source, destination, and bandwidth)
- Backend evaluates all promo rules matching the location pair (cheapest tier price first), builds the routing graph with each rule's excluded circuits removed, and finds the lowest-latency path — routed through a required circuit if the rule specifies one
- Minimum margin requirement is enforced per candidate route/rule before it's accepted; if not met, the next-cheapest rule is tried
- Results panel shows the winning route's segments, latency, and promo price, or an explanatory message (no promo rule, no price configured for that tier, no route satisfies the constraints, or margin not met)
- New backend endpoint: `POST /route_finder/find_promo_route`
- New API helper: `findPromoRoute()` in `frontend/src/api.js`

**Files Modified:** `backend/routes.js`, `frontend/src/RouteFinder.js`, `frontend/src/api.js`  
**Test:** `backend/test_v350_promo_exclusions.js` — static verification of migration, backend endpoints, and frontend wiring (24 checks)

### 📋 **Extranet Pricing Logs: Manual Calculation Breakdown Expand**

In Extranet Pricing → Pricing Logs, expanding a **bundle** no longer auto-opens every item’s **Calculation Breakdown (JSON)**. Admins click an individual bundle item (chevron) to open/close its JSON, matching individual log behavior.

**Files Modified:** `frontend/src/ExtranetPricingTool.js`  
**Test:** `backend/test_v350_extranet_logs_breakdown_manual.js`

### 🧮 **Allocated Cost Calculator: Circuit ID Label & Location Display**

In Allocated Cost Calculator only:

- **Quote Request ID** renamed to **Circuit ID** across the form, results summary, email/CSV export, and history search/table (internal field key unchanged for stored logs)
- Source / destination display format is now **`POP Code - Datacenter Name`** (autocomplete options, email, and CSV)

**Files Modified:** `frontend/src/AllocatedCostCalculator.js`  
**Test:** `backend/test_v350_allocated_cost_labels.js`

### 📇 **Carrier Contacts: Region Column on Database Export**

Bulk **Download Database Export** for `carrier_contacts` now includes the parent carrier’s **`region`** (mapped to AMERs / APAC / EMEA) immediately after **`carrier_name`**.

**Files Modified:** `backend/routes.js`  
**Test:** `backend/test_v350_carrier_contacts_region_export.js`

### ⚡ **Colocation Availability: Full Racks Don't Count Toward Location Available Power**

On the Colocation availability dashboard API, **location-level available power** no longer includes remaining kVA from racks that have **no further RUs available**.

- Per-rack **Available Power** display is unchanged (`total_power_kva - allocated_power`)
- Location (and rolled-up) available power only sums racks with `available_ru > 0`

**Files Modified:** `backend/routes.js`  
**Test:** `backend/test_v350_colo_available_power.js`

### 🧹 **Network Routes: Delete Cascades Live Latency API Config**

Deleting a network route now also removes the matching **`live_latency_config`** row (by `circuit_id`) so Live Latency API admin no longer shows orphaned configurations for deleted circuits.

- Looks up and deletes `live_latency_config` after a successful route delete
- Change is logged; route delete still succeeds if no config exists or cleanup fails

**Files Modified:** `backend/routes.js`  
**Test:** `backend/test_v350_route_delete_live_latency.js`

### 📤 **Manage Carriers: Export carrier_id on Database Export**

Bulk **Download Database Export** for the `carriers` module now includes **`carrier_id`** (the carriers table `id`) as the first column so exports can be matched back to contacts and re-uploaded safely.

- Export CSV columns: `carrier_id`, `carrier_name`, `previously_known_as`, `status`, `region`
- Upload template unchanged (no `carrier_id` column required)
- Re-uploading an export that includes `carrier_id` updates the matching carrier by id; name-based match still works when `carrier_id` is omitted

**Files Modified:** `backend/routes.js`  
**Test:** `backend/test_v350_carrier_id_export.js`

### 📍 **Carrier Quote Repository — Site Validation, Building Types, Analytics & Horizontal Bulk**

Major Carrier Quote Repository enhancements for address data quality, pricing insight, and faster multi-quote import.

- **Site Validation (OSM)**: Interactive map + structured address dialog (Leaflet / Carto tiles + Nominatim). Search again, drag pin to reverse-geocode, confirm canonical street/city/postcode/country/lat-lng. Internal fuzzy match suggests reuse of existing custom locations and POPs before creating duplicates — only custom locations actually attached to a quote in the Carrier Quote Repository (or POPs from Manage Locations) are ever suggested, never orphaned/unused rows. For a brand-new or edited (non-matched) address, **Confirm is disabled until "Search address" is clicked (or the pin is dragged)** so the address is checked against the official Nominatim database before it can be saved; picking an Existing match skips this since it's already verified. Public Nominatim is used only for interactive checks (cached + rate-limited); bulk never auto-geocodes every row.
- **Building type**: Custom locations require **Datacenter** or **Retail**. POP-linked endpoints always count as Datacenter. Flag available in Add Quote, CSV template, and bulk upload.
- **Quote Analytics**: New sidebar page under Carrier Quote Repository with averages by city pair, location, country pair, transit countries, DC–DC / DC–Retail / Retail–Retail, bandwidth, service, carrier, protection, region; term discount curve; latency vs price; carrier spread; quote freshness. Currency-normalized via exchange rates. Full filter panel supports multi-carrier selection plus advanced filters (locations, cities/countries, building pair/types, protection, bandwidth, cable/transit, MRC/NRC/latency ranges, exclude expired).
- **Horizontal bulk upload**: Carrier quote Excel template uses structured location columns. A **Processing bulk upload** dialog stays open while parsing and while **Site Validation runs for every non-POP custom address**. Quotes are created only after all addresses are confirmed. Sheet detection accepts a sheet named Quotes or any sheet with Carrier Name headers. Field / Instructions guide columns are ignored on upload.
- **Add Quote CSV**: Horizontal-only template (header + 5 blank quote rows). Vertical Field/Instructions section removed. Import supports one row (populate form) or multiple rows (create quotes). Every non-POP custom address — single or multi-row — must pass through **Site Validation** (with a **Processing CSV import** dialog for multi-row) before its location or quote is written to the database; nothing is created directly from the parsed CSV data. Building-type chip shows only after a location is selected (**Datacenter** / **Retail**). Selecting an existing POP caches address/pin for Site Validation. In Site Validation, POP codes are looked up only on **Enter** / **Lookup POP** (avoids IPCSNG1 vs IPCSNG11 mid-type matches); locked POP chip has an **X** to clear and re-enter.
- **Custom Locations — bulk Building Type fix-up, purge, merge & address correction**: **Custom Locations** page under Carrier Quote Repository lists every custom location with search + a Building Type filter (**All / Missing only / Datacenter / Retail**) and paging (100 per page). Changing Building Type on a row saves immediately via a lightweight endpoint that updates **only** `building_type` — address, city, country, and lat/lng are left untouched and Site Validation is not re-run — so a large backlog of existing locations can be fixed quickly without re-editing full location detail. A **Usage** filter (All / Unused only / Used by a quote) plus a per-row "used by N quotes" / "Unused" chip surface locations that were never actually attached to a quote (e.g. left over from a cancelled import); **Purge unused now** deletes every such orphaned location table-wide after a confirmation showing the exact count, and any single unused row can be deleted individually (blocked with a 409 if it's still referenced by a quote). Selecting 2+ rows and clicking **Merge selected** opens a dialog to pick the canonical record to keep — every quote referencing the other selected location(s) is repointed to it and the duplicates are deleted, standardizing addresses without losing quote history. A map-pin **Fix address** action per row reopens the same Site Validation (map + Nominatim) dialog in place to correct a location's address or geographic pin; picking one of the "Existing matches" while fixing an address triggers a merge into that match instead of a plain save. Any address field edited during Fix Address must be re-verified via **Search address** before saving, even for existing locations — closing the gap where in-place edits could previously skip verification.

**Backend:**
- Migration `046_quote_location_building_type.js` — `building_type`, `street_name`, `street_number`, `postal_code` on `quote_custom_locations`; `quote_geocode_cache` table
- `backend/quoteAddressUtils.js` — normalize / fuzzy score / Nominatim forward+reverse helpers
- `POST /carrier_quotes/locations/match|verify|reverse`, `GET /carrier_quotes/analytics`, extended custom location create + `PUT /carrier_quotes/custom_locations/:id`
- `GET /carrier_quotes/custom_locations` — opt-in `building_type` filter + `limit`/`offset` paging with a total count (stays a plain array for existing Autocomplete callers); `PATCH /carrier_quotes/custom_locations/:id/building_type` — building-type-only update

**Files Added:**
- `backend/migrations/046_quote_location_building_type.js`
- `backend/quoteAddressUtils.js`
- `backend/test_v350_carrier_quote_enhancements.js`
- `backend/test_v350_manage_custom_locations.js`
- `frontend/src/SiteValidationDialog.js`
- `frontend/src/CarrierQuoteAnalytics.js`
- `frontend/src/ManageCustomLocations.js`

**Files Modified:**
- `backend/routes.js`, `frontend/src/api.js`, `frontend/src/AddCarrierQuote.js`, `frontend/src/BulkUpload.js`, `frontend/src/App.js`, `frontend/package.json` (leaflet)

### 🔍 **Admin: Live Latency API — Search by Circuit ID**

The **Configurations** tab in Admin → Live Latency API Management now has a search box above the configurations table.

- Search filters the table by **Circuit ID** (case-insensitive, partial match, instant filtering)
- Clear icon to reset the search
- "Showing X of Y configurations" indicator while a search is active
- Empty-state message when no configurations match

### 🌐 **Network Routes: Self-Service Live Latency Probe Registration**

Users adding or editing a Network Route can now register a Live Latency probe themselves — without needing Administrator access to the Live Latency API admin module.

- New **"Live Latency Monitoring"** section in Add/Edit Network Route with a single **"Live Latency Probe Name (API Instance Name)"** field
- Leaving it blank makes no changes to any existing probe configuration
- Entering a probe name automatically creates (or updates) the circuit's Live Latency API configuration using the standard default connection details — the user only needs to know the probe name
- When editing a route that already has a probe configured, the field pre-fills with the existing probe name
- If the route save succeeds but the probe push fails, the user sees a warning without losing their route changes; Administrators can still review/override the full configuration from Admin → Live Latency API

**Backend:**
- New endpoint `GET /network_routes/:circuit_id/live_latency_probe` (requires `network_routes` read access) — returns the existing probe name/status for prefill
- New endpoint `POST /network_routes/:circuit_id/live_latency_probe` (requires `network_routes` create/edit permission, not admin-only) — creates or updates the `live_latency_config` row for the circuit using fixed defaults (API base URL, indicator, username `infovista_api_ro`, default password) plus the submitted probe name

**Files Modified:**
- `backend/routes.js` — New self-service probe endpoints
- `frontend/src/api.js` — `getLiveLatencyProbe`, `pushLiveLatencyProbe` helpers
- `frontend/src/RouteFormDialog.js` — Live Latency Monitoring section with probe name field
- `frontend/src/App.js` — Pushes probe configuration after route add/edit succeeds
- `frontend/src/LiveLatencyAdminManager.js` — Circuit ID search box in Configurations tab
- `user_guide_admin_live_latency.md`, `user_guide_network_routes.md` — Documentation updates

### 🗺️ **Network Routes: PDF Network Map Export**

An "Export Network Map" button is now available above the Network Routes table (next to Export CSV), letting users generate a large, auto-laid-out, automatically-paginated PDF network map diagram directly from network routes and location data.

- New popup lets users select which region(s) to include — **AMERs**, **EMEA**, **APAC**, or any combination — plus which detail fields to show on each route: **UCN**, **Expected Latency**, **Bandwidth**, and **Carrier**
- INTER routes are automatically included wherever either end touches a selected region
- Each POP code (from Manage Locations) is rendered as its own node, colored by region and sized by connection count, and automatically laid out per page (force-directed) — no manual arranging required
- **Automatic multi-page pagination for large exports (up to ~200 locations / ~350 routes)**: the export is split into one section per region (**AMERs**, **EMEA**, **APAC**), and a region is automatically further split into multiple sections (e.g. "AMERs — Page 1 of 2") whenever it exceeds a legible node budget per page. Connected clusters of locations are kept together on the same page wherever possible (region grouping → connected components → greedy bin-packing)
- **Each section spans two dedicated pages** — a full-page **network diagram** (kept free of any reference tables so it stays large and legible, with a compact title bar to maximize diagram space), immediately followed by a full-width **POP Code Reference + Route Schedule** page for that same section. Separating them lets both the diagram and the reference material use the full page rather than squeezing a table into a narrow sidebar
- **Diagram pages auto-expand well beyond A4/poster size** as node count grows, so a region only splits into multiple pages when it's genuinely too large to lay out legibly on one sheet (raised from a 45-location budget to 90+) — a 50-90 location region now stays on a single, larger page instead of being split
- **Guaranteed no text overlap**: full per-route detail (UCN, latency, bandwidth, carrier) no longer floats on the diagram as labels — every connecting line instead gets a small numbered tag, and the full detail for every route is listed in a **Route Schedule** table on that section's reference page. Numbered tags are collision-resolved (iterative pairwise separation against each other and against every node) so they never overlap, however dense the page. POP codes are shown directly inside each node circle (city name removed from the diagram to save space), sized to fit the code and rendered with a subtle dark outline behind the white text so thin characters like "I" and "1" stay legible against the colored fill
- **Cross-page and out-of-scope connections** are drawn as short labeled stub arrows at the local node (e.g. pointing to "IPCHKG1 (Pg 4)" for a connection continuing on another page's diagram, or "IPCHKG1 (not incl.)" for an INTER route's far end that falls outside the selected regions) instead of drawing the remote node in full; the underlying route is still fully listed on that section's Route Schedule
- The POP Code Reference and Route Schedule both flow across multiple columns (2-4, based on how many entries there are), so they scale to large exports without growing excessively tall
- The POP Code Reference lists the full datacenter name/address (including city) for every POP code in that section, including any off-page/external POP codes referenced by its stub arrows, so every stub is fully resolvable without flipping pages
- A new cover/index page lists every section's page range, region, sub-page number, and location/route counts
- Every page includes a compact title block with the IPC logo, generated date/time, and a fixed **"CONFIDENTIAL - NOT FOR DISTRIBUTION WITHOUT PERMISSION"** label that cannot be disabled
- Only Active routes and Active locations are included
- All pages in a single export share one physical page size (the largest page's natural size, individually capped if extreme) so Puppeteer can print the whole document in a single `page.pdf()` call; smaller pages simply get extra whitespace rather than being stretched or cropped

**Backend:**
- New endpoint `GET /network_routes_export_map?regions=...&details=...` (requires `network_routes` read access) — queries routes/locations for the selected scope, groups multi-route pairs into single edges, and streams back a generated PDF
- Reworked `backend/networkMapRenderer.js` — `partitionIntoPages` (region grouping, connected-component clustering, bin-packing), per-page `d3-force` layout, numbered-tag SVG rendering with collision resolution, multi-column `Route Schedule` and POP Code Reference tables rendered on their own dedicated page per section, cover/index page, and `renderMultiPageHtml`/`generateNetworkMapPdf` orchestration, all rendered to PDF via Puppeteer
- New `backend/utils/formatBandwidth.js` — converts stored Mbps values to Mb/Gb for display (values ≥1000 Mbps shown in Gb)
- New dependencies: `puppeteer`, `d3-force`
- New asset: `backend/assets/ipc-logo.png`

**Bug Fixes:**
- Fixed downloaded PDF failing to open ("We can't open this file"). Puppeteer's `page.pdf()` returns a plain `Uint8Array`, which fails Express's `Buffer.isBuffer()` check inside `res.send()`; Express silently fell back to `res.json()` and serialized the PDF bytes as JSON text instead of sending real binary data. Now explicitly wrapped in `Buffer.from(...)` before returning.
- Fixed the export request itself returning `404 Not Found`. The endpoint was originally registered at `/network_routes/export_map`, which was shadowed by the earlier, more generic `/network_routes/:circuit_id` route (Express matches in registration order). Renamed to the flat path `/network_routes_export_map` to match the existing `/network_routes_export` (CSV) / `/network_routes_search` sibling convention and avoid any route-ordering collision.
- Fixed large exports (~200 locations / ~350 routes) producing a single overcrowded page with overlapping route-detail labels. Reworked the renderer to automatically paginate by region/cluster and moved all route detail off the diagram into a per-page Route Schedule table, per the design above.
- Fixed POP codes being hard to read on the diagram (thin characters like "I" and "1" were getting lost) and the POP Code Reference/Route Schedule not scaling well next to the diagram. Moved the reference tables onto their own full-width page per section, shrank the page title bar to free up diagram space, removed the city name from node labels, and sized each node circle to fit its code with an outlined, high-contrast text style.
- Fixed cross-page/off-page stub tags occasionally getting clipped at the outer edge of the diagram. The diagram's canvas size was calculated only from node circle positions (with fixed padding smaller than a stub's reach), so a stub arrow on a node near the edge could extend past the canvas boundary. The canvas now expands to fit every node **and** every tag/stub position before rendering, so nothing at the edges is ever cut off.

**Files Added:**
- `backend/networkMapRenderer.js`
- `backend/utils/formatBandwidth.js`
- `backend/assets/ipc-logo.png`
- `frontend/src/NetworkMapExportDialog.js`

**Files Modified:**
- `backend/routes.js` — New `/network_routes_export_map` endpoint
- `backend/package.json` — Added `puppeteer`, `d3-force`
- `frontend/src/SearchExportBar.js` — "Export Network Map" button
- `frontend/src/App.js` — Dialog wiring, export/download handler
- `frontend/src/api.js` — `exportNetworkMapPDF()` helper

**🚨 RHEL 7 Production Fix:** The initial `puppeteer@^23.11.1` pin requires Node.js ≥18 (its `puppeteer-core`/`@puppeteer/browsers` deps declare `engines.node >=18`), which throws a `SyntaxError` on the Node 16 runtime `RHEL_PRODUCTION_DEPLOYMENT_V3.3.3.md` mandates for RHEL 7's glibc 2.17. Fixed by pinning `"puppeteer": "21.11.0"` (last release supporting Node ≥16.13.2) and adding `executablePath: process.env.PUPPETEER_EXECUTABLE_PATH` in `networkMapRenderer.js` so production can point at an OS-native, glibc-2.17-compatible Chromium instead of Puppeteer's bundled "Chrome for Testing" (which requires glibc ≥2.27 and won't launch on RHEL 7 regardless of Node version). See `RHEL_PRODUCTION_DEPLOYMENT_V3.5.0.md`.

### 🗣️ **Voice - One Directory: Guest Login, Custom Growth %, Bandwidth Calculator & Pricing Log Fixes**

A no-credential "Voice Guest" login, a per-quote Growth % override, a standalone Bandwidth Calculator tab, and fixes to bundle discount reconciliation and historical CSV export in Pricing Logs.

- **Voice Guest login**: "Continue as Voice Guest (Read-Only)" button on the login screen drops straight into a restricted shell showing only the One Directory tool — no username/password required. Backed by a hidden `voice_guest` system account with `read_only` access to `voice_one_directory` only.
- **Customizable Growth %**: New field below "Directory Users" on the quote form, pre-filled from the live admin default and overridable per quote (`/calculate` and `/calculate-bundle` both accept the override).
- **Bandwidth Calculator tab**: New 3rd tab — enter Number of Users, Growth %, and On/Off Net to get the required bandwidth, using the same rate-card tiers and admin parameters as the main pricing calculation (no pricing/customer data involved).
- **Bundle discount reconciliation**: Individual service lines within a bundle item now sum exactly to the item total (previously showed pre-discount prices); fixed retroactively for historical logs too. Pricing Logs show exact figures at the item/service level, with only the bundle total kept as a rounded "headline" figure.
- **Per-bundle CSV export**: New download icon on each bundle row in Pricing Logs re-exports that historical bundle to CSV at any time, using the same format as the live basket export.
- **Bug fix**: The admin-configured minimum bandwidth floor was incorrectly being applied to On Net quotes (should be Off Net only) — fixed across `/calculate`, `/calculate-bundle`, and the new `/calculate-bandwidth` endpoint.

**Files Added:** `backend/migrations/045_add_voice_guest_account.js`  
**Files Modified:** `backend/routes.js`, `frontend/src/App.js`, `frontend/src/AuthContext.js`, `frontend/src/LoginForm.js`, `frontend/src/OneDirectoryPricingTool.js`

---

## What's New in v3.4.8

### 📊 **Carrier Quote Repository — Fixed-Term Pricing & Workflow Improvements**

Quotes now support pricing for multiple contract terms (12, 24, 36 months) within a single quote entry, with per-term price negotiation tracking.

- **Term-Based Pricing Grid**: Replaced single MRC/NRC/Contract Term fields with a pricing grid showing 12/24/36 month columns. Each quote can have pricing for one, two, or all three terms.
- **Per-Term Price Negotiation**: Price negotiation stages (Initial Offer, Discounted, Best and Final, etc.) are now tracked independently per contract term. Term selector tabs filter the negotiation history.
- **Dual Submit Buttons**: "Create Quote & View" (saves and navigates to repository) and "Create Quote & Copy" (saves but keeps form populated for creating bandwidth variants under the same base reference).
- **Duplicate Quote Button**: New action button in the Quote Repository table to duplicate an existing quote into the Add Quote form with all fields pre-filled (carrier, route, pricing, etc.).
- **Updated CSV Template**: Template now includes `MRC (12 Month)`, `NRC (12 Month)`, `MRC (24 Month)`, `NRC (24 Month)`, `MRC (36 Month)`, `NRC (36 Month)` columns, replacing the old single Contract Term/MRC/NRC fields. Import auto-populates the pricing grid.
- **Repository Table Display**: MRC, NRC, and Term columns show actual values for single-term quotes, or a "Multiple" chip when multiple terms are quoted.
- **Detail View**: Pricing-by-term table and per-term negotiation history in the view details dialog.
- **Migration**: Existing quotes with `contract_term` of 12, 24, or 36 are automatically migrated to the new column structure.

---

## What's New in v3.4.7

### 🔒 **Extranet Pricing Logs — Role-Based Access Control**

Pricing Logs are now accessible to all users with `extranet_data` module permission, with visibility and features scoped by permission level:

- **read_only users**: Can view the Pricing Logs tab and see only their own logs. User filter, export, and clear controls are hidden.
- **provisioner users**: Can view all user logs, use the user filter dropdown, and export logs to CSV.
- **admin users**: Can view all user logs, export, clear logs, and access a new **Calculation Breakdown (JSON)** viewer showing full pricing math for bundles and individual lookups.

**Frontend:**
- Pricing Logs tab now visible to all users with `extranet_data` permission (previously admin-only)
- "Your Logs Only" indicator shown for read_only users
- User filter dropdown shown only for provisioner and admin users
- Export CSV button shown for provisioner and admin users
- Clear Logs button shown for admin users only
- New JSON Calculation Breakdown dialog for admin users — accessible via a code icon on each log row
- JSON dialog includes structured calculation data with copy-to-clipboard functionality

**Backend:**
- `/extranet-pricing/logs` endpoint now uses module-level permission (`extranet_data` read_only) instead of role-based admin check
- Backend enforces user-only filtering for read_only permission users (server-side, not just UI)
- `calculation_breakdown` field stripped from responses for non-admin users
- Response includes `caller_permission` and `can_see_all_logs` flags for frontend
- `/extranet-pricing/users` endpoint opened to provisioner-level extranet_data permission
- `/extranet-pricing/logs/export` endpoint opened to provisioner-level extranet_data permission
- Clear logs remains admin-only

---

### 🏠 **New Module: Home Page with Live Latency Matrix**

New Home page module replaces the previous welcome splash screen. Accessible to all authenticated users regardless of permissions. Includes a real-time latency matrix showing minimum latency paths between configurable key city locations.

**Home Page:**
- "Home" button added at the top of the left sidebar menu (above Network Routes Repository), always visible to all users
- Retains the existing welcome splash text ("Welcome to the Network Repository" / "Please use the left sidebar to view available modules")
- Live Latency Matrix displayed below the welcome text
- Two tabs: **1Gb** and **10Gb**
- Matrix shows minimum latency (ms, 2 decimal places) between all configured city pairs
- Hovering over a city name shows a tooltip with the POP code and datacenter name
- Clicking any latency value navigates to Route Finder displaying the exact pre-computed route with promo pricing across all tiers (10Mb, 100Mb, 1Gb, 10Gb), defaulting to USD with currency switcher available
- "N/A" shown when no path exists or 10Gb latency exceeds 120% of 1Gb latency for the same pair
- "Last updated" timestamp shown below the matrix
- Auto-refreshes data from backend every 5 minutes

**Latency Matrix Computation (Backend Service):**
- New hourly background service (`latencyMatrixService.js`) computes all-pairs shortest paths using Dijkstra's algorithm
- Uses **live latency** as edge weight, falling back to estimated latency only when live latency is N/A
- Circuits with live latency of 0ms (outage) are excluded from path computation
- **1Gb tab**: Includes all routes with bandwidth >= 1,000 Mbps. Uses fastest mode (includes ULL/Cisco routes)
- **10Gb tab**: Includes all routes with bandwidth >= 20,000 Mbps. If 10Gb latency > 1.2× the 1Gb latency for the same pair, displays N/A
- 1Gb computation runs first; 10Gb results validated against 1Gb results (20% rule)
- Full route details stored in cache (POP codes, circuit IDs, carriers, bandwidth, per-hop latency) for click-through display
- Registered alongside existing background services with graceful shutdown support

**Admin: Latency Matrix Locations:**
- New "Latency Matrix" item under Admin sidebar section (administrator only)
- CRUD management of city/POP code pairs (e.g., London → IPCLON7)
- Columns: City Name, POP Code, Display Order, Datacenter Name, Region
- POP code validated against `location_reference` table
- Display order controls the row/column ordering in the matrix
- Manual "Refresh Matrix" button to trigger immediate recomputation

**Route Finder Integration:**
- Route Finder accepts pre-computed route data from the latency matrix
- Enters "display mode" showing the exact cached route as the primary path
- Automatically runs promo pricing check against the specific circuit IDs in the pre-computed path
- Displays pricing across all fixed tiers (10Mb, 100Mb, 1Gb, 10Gb)
- Info banner indicates the matrix source (e.g., "Viewing pre-computed 1Gb route: London → Singapore")
- "Run New Search" button to exit display mode and return to normal Route Finder

**Database:**
- Migration 038: Creates `latency_matrix_locations` table (city/POP pairs with display order) and `latency_matrix_cache` table (computed latency values and full route JSON for all pairs)
- Unique index on `(source_pop, destination_pop)` for upsert efficiency

**API Endpoints:**
- `GET /api/latency-matrix` — Returns full matrix data from cache (all authenticated users)
- `GET /api/admin/latency-matrix/locations` — List configured cities (admin only)
- `POST /api/admin/latency-matrix/locations` — Add city/POP pair (admin only)
- `PUT /api/admin/latency-matrix/locations/:id` — Update city/POP pair (admin only)
- `DELETE /api/admin/latency-matrix/locations/:id` — Remove city and clean cache (admin only)
- `POST /api/admin/latency-matrix/refresh` — Trigger manual matrix recomputation (admin only)

**Files Added:**
- `frontend/src/HomePage.js` — Home page with welcome splash and tabbed latency matrix
- `frontend/src/LatencyMatrixAdmin.js` — Admin CRUD for city/POP locations
- `backend/latencyMatrixService.js` — Hourly background computation service
- `backend/migrations/038_add_latency_matrix.js` — Database migration

**Files Modified:**
- `frontend/src/App.js` — Home sidebar button, routing for home and admin pages, matrix route state management
- `frontend/src/RouteFinder.js` — Pre-computed route display mode with promo pricing
- `frontend/src/api.js` — Latency matrix API helper functions
- `backend/routes.js` — Matrix data and admin CRUD endpoints
- `backend/index.js` — Registered latency matrix service with graceful shutdown

---

### 🏢 **CNX Colocation — Exchange Facing Infrastructure, RU Fix & Bulk Upload Fixes**

**Exchange Facing Infrastructure Display:**
- Added "Exchange" column to Colocation Availability Dashboard expanded rack detail table (replaced "Devices" column)
- Added "Exchange" column to CNX Colocation Inventory Shared Racks table (next to TOR Network)
- Added "Exchange" column to CNX Colocation Inventory Dedicated Racks table
- Displays the exchange facing infrastructure value (e.g., "Yes - Cisco 3548", "Yes - Arista 7130", "No")

**Shared Rack RU Allocated Fix:**
- RU Allocated display now includes IPC reserved rack units in the total
- Previously showed only client-purchased RU; now shows `(client RU + IPC reserved RU) / total RU`
- Parses `ipc_reserved_ru_ranges` JSON to calculate IPC reserved count

**Bulk Upload Fixes:**
- Fixed CNX Colocation Racks bulk upload: `SQLITE_CONSTRAINT: NOT NULL constraint failed: cnx_colocation_racks.network_infrastructure` — added `network_infrastructure = 'N/A'` and `created_by` to INSERT statement
- Fixed CNX Colocation Clients bulk upload: `SQLITE_CONSTRAINT: NOT NULL constraint failed: cnx_colocation_clients.created_by` — added `created_by` to INSERT statement
- Added `created_by` to CNX Rack Devices bulk upload INSERT for consistency
- Changed default values for `tor_network_infrastructure` and `exchange_facing_infrastructure` from null to 'No' in bulk upload

**CNX Rack Devices Bulk Upload — Per-Rack Export:**
- New two-step dropdown when "CNX Rack Devices" is selected: first select location, then select rack
- Per-rack export generates CSV with all RU rows pre-populated (location_code, rack_id, start_ru 1-N already filled)
- Existing device data merged into the export where present
- Users only need to fill in device name, client name, model, serial, position, power, and notes

**Bulk Export Improvements:**
- Improved error handling for database export endpoint (null guard, better logging)
- Fixed frontend `downloadBulkUploadDatabase()` to properly handle error responses when using blob responseType

**Backend:**
- New endpoint: `GET /bulk-upload/cnx-racks-list` — returns locations with racks for dropdown selection
- New endpoint: `GET /bulk-upload/rack-device-export/:rackId` — generates per-rack CSV with pre-populated RU rows

**Files Modified:**
- `frontend/src/components/ColocationAvailabilityDashboard.js` — Exchange column, removed Devices column
- `frontend/src/CNXColocationManager.js` — Exchange column in Shared & Dedicated tables, RU allocated fix
- `frontend/src/BulkUpload.js` — Location/rack dropdown for rack device export
- `frontend/src/api.js` — New API functions for rack list and per-rack export, improved blob error handling
- `backend/routes.js` — Bulk upload INSERT fixes, new export endpoints, improved export error handling

---

### 🖥️ **CNX Colocation — Rack Elevation Add Device Enhancements**

**Device Type Dropdown:**
- Replaced free-text Device Type field with a dropdown menu
- Options: Switch, Router, Server - Client Owned, Server - IPC Owned, Patch Panel

**Device Label:**
- New optional "Device Label" text field in the Add/Edit Device form
- Label displayed on the rack elevation visual as "ClientName - DeviceType - Label"
- Label column added to the Devices list table (Tab 3)
- Label included in device tooltips on hover

**RU Selection from Allocated RUs:**
- Client selection is now required (no "unassigned" devices)
- "IPC Reserved" appears as a client option in the dropdown for IPC-owned devices
- When a client or IPC Reserved is selected, a multi-select RU picker shows only available (unoccupied) RUs from that allocation
- Users select multiple contiguous RUs to define device placement and height (replaces separate Start RU and Height fields)
- Contiguity validation prevents non-adjacent RU selection
- Save button disabled until all required fields are valid

**Backend:**
- Create/update device endpoints now accept `device_label` field
- IPC reserved RU validation: devices with IPC Reserved client are validated against `ipc_reserved_ru_ranges`
- Client selection required on device creation (backend validation)
- Database migration 039: Added `device_label` column to `cnx_rack_devices`

**Files Added:**
- `backend/migrations/039_add_device_label.js` — Database migration for device_label column

**Files Modified:**
- `frontend/src/components/RackElevationDialog.js` — Device Type dropdown, Device Label field, RU multi-select, IPC Reserved client option
- `backend/routes.js` — Device create/update endpoints updated for device_label and IPC validation

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
- Bundle discount replaces per-item discount (max user discount field removed from admin)
- Configurable bundle discount tier boundaries (item count ranges are editable, not hardcoded)
- Three configurable tiers with editable item count ranges (defaults: 1–3, 4–5, 6+)
- Each tier has configurable maximum MRC discount and automatic NRC discount
- NRC charged per item with automatic configurable bundle NRC discount (not displayed to users)
- Bundle discount tiers and tier boundaries configurable in Extranet Pricing Admin
- Basket submitted when user selects a discount %

**Datacenter Field Update:**
- `source_datacenters` replaced with `primary_datacenter` and `secondary_datacenters` in extranet products
- POP codes resolved to city locations via `location_reference` table
- `primary_pricing_city` field added to products for manual city override
- Legacy `source_datacenters` field fully removed from codebase

**Member Customer Name:**
- New "Member Customer Name" field added to Quote Parameters (locked once basket has items, shared across all items)
- Customer name stored in both `extranet_bundle_logs` and `extranet_pricing_lookups`
- Displayed in Pricing Logs table as a dedicated "Customer" column
- Included in CSV export and text file bundle quote export
- Restored when reloading a basket from Pricing Logs

**Analytics & Pricing Logs — Bundle Support:**
- Analytics Dashboard rebuilt with bundle-specific metrics: total bundles, total items in bundles, MRC/NRC from bundles, discount statistics, POA count
- Pricing Logs rebuilt to display bundles as expandable parent rows with individual items nested
- **Reload Basket**: Admins can reload a previous bundle from the Pricing Logs back into the shopping basket to re-price with a different discount %
- Bundle logs stored in new `extranet_bundle_logs` table
- Individual item lookups linked to bundles via `bundle_id`
- CSV export includes both standalone lookups and bundles with nested items
- Clear logs now clears both individual lookups and bundle logs

**Database Migrations:**
- Migration 028: Splits `source_datacenters` into `primary_datacenter`, `secondary_datacenters`, and `primary_pricing_city` columns in `extranet_products`
- Migration 029: Adds bundle discount parameters (MRC and NRC tiers) to `extranet_parameters`
- Migration 030: Creates `extranet_bundle_logs` table and adds `bundle_id` column to `extranet_pricing_lookups`
- Migration 031: Adds configurable bundle tier boundary parameters (`bundle_tier_1_max`, `bundle_tier_2_max`) to `extranet_parameters`
- Migration 032: Adds new bandwidth levels (30Mb, 40Mb, 75Mb, 150Mb, 200Mb) to all three provider region rate cards as POA
- Migration 036: Adds `customer_name` column to `extranet_bundle_logs` and `extranet_pricing_lookups`

**Backend:**
- New endpoint: `/extranet-pricing/resolve-pop-city` — resolves POP codes to city names
- New endpoint: `/extranet-pricing/calculate-bundle` — calculates bundle pricing with tiered discounts and logs to `extranet_bundle_logs`
- New endpoint: `/extranet-pricing/bundle-discounts` — fetches configurable bundle discount tiers
- Updated `/extranet-pricing/logs` — returns both individual lookups and bundle logs with nested items
- Updated `/extranet-pricing/logs/export` — exports bundles and items in structured CSV
- Updated `/analytics/extranet-pricing` — includes bundle-specific metrics with dynamic tier labels
- Updated `/extranet-pricing/bundle-discounts` — now returns configurable tier boundaries alongside discount values
- Updated `/extranet-pricing/bandwidths` — now sorts bandwidths by numeric value for correct ordering
- Fixed 0% discount override bug (JavaScript falsy `0` handled with explicit `undefined` checks)
- Fixed "Items in Bundle: undefined" in text export (was referencing `bundle_pricing.item_count` instead of `bundle.item_count`)
- Product CRUD endpoints updated for new datacenter fields
- Added 5 new bandwidth levels: 30Mb, 40Mb, 75Mb, 150Mb, 200Mb (all validated in bulk upload and rate card endpoints)

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

- Only available in Standard Route mode — protected pricing is skipped entirely when Fastest Route is selected
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
- All displayed prices (promo, cross connect, protected) are rounded up to the nearest 10 in any currency including USD (e.g. $421 → $430)

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

### 📋 **Carrier Quote Repository — CSV Template & Filter Improvements**

**CSV Template Fixes:**
- Added UTF-8 BOM to exported CSV template for correct character display in Excel
- Replaced em dash characters with regular dashes to prevent encoding issues
- POP code example changed to IPCLON7
- Reordered fields: Bandwidth Unit before Bandwidth Value; Currency, NRC, MRC order
- Removed Transit Cities and Transit Countries from template (auto-populated via KMZ upload)

**CSV Import Date Fix:**
- Added date normalization (`normaliseDateValue`) to handle various date formats (MM/DD/YYYY, DD-MMM-YYYY, etc.) and convert to YYYY-MM-DD for HTML date inputs
- Quote Date and Expiry Date now correctly populate when importing CSV files with Excel-formatted dates
- BOM character stripped from imported CSV files for robust parsing

**Transit Country & City Filters:**
- New "Transit Countries" text filter in Advanced Filters — searches quotes by transit country
- New "Transit Cities" text filter in Advanced Filters — searches quotes by transit city
- Both filters support comma-separated values for multiple search terms (e.g. "France, Germany")
- Each comma-separated term must match (AND logic) for a quote to appear in results
- Filters included in CSV export, active filter count badge, and clear filters action

**Quote Reference Auto-Suffix:**
- User-provided internal references now automatically receive a sequential suffix (-01, -02, -03, etc.)
- First quote with reference "1234" is stored as "1234-01", second as "1234-02", and so on
- System queries existing quotes with same base reference to determine next suffix number
- Auto-generated references (QR-YYYYMMDD-XXXX) are unaffected

**Files Modified:**
- `frontend/src/AddCarrierQuote.js` — CSV template field order/encoding fixes, date normalization, BOM stripping, transit field helper text
- `frontend/src/CarrierQuoteRepository.js` — Transit country/city filter state, UI fields, loadQuotes params, export params
- `backend/routes.js` — Quote reference auto-suffix logic, transit country/city filtering

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
| **Home Page** | 3.4.7 | ✅ New |
| **CNX Colocation Manager** | 3.4.7 | ✅ Enhanced |
| **Extranet Data** | 3.4.2 | ✅ Active |
| **Extranet Pricing** | 3.4.7 | ✅ Enhanced |
| **Carrier Quote Repository** | 3.5.0 | ✅ Enhanced |
| **Route Finder** | 3.5.0 | ✅ Enhanced |
| **KMZ Viewer** | 3.3.3 | ✅ Active |
| **Network Routes Repository** | 3.5.0 | ✅ Enhanced |
| **Network Design & Pricing** | 3.3.3 | ✅ Active |
| **Allocated Cost Calculator** | 3.3.3 | ✅ Active |
| **Analytics Dashboard** | 3.4.6 | ✅ Enhanced |
| **User Management** | 3.3.3 | ✅ Active |
| **Module Permissions** | 3.4.2 | ✅ Enhanced |
| **Bulk Upload** | 3.4.7 | ✅ Enhanced |

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

- **v3.5.0** (Aug 9, 2026): Application Dark Mode (user-menu toggle, localStorage persistence, default dark, app-wide contrast fixes; email exports stay light); Network Routes Repository — Cross Connects Pricing submodule; Carrier Quote Repository — Site Validation (OSM/Nominatim map dialog), Datacenter/Retail building types, Quote Analytics page, horizontal bulk upload, Custom Locations management (bulk Building Type fix-up, purge unused, merge duplicates, fix address/geo location); Admin Live Latency API — search Configurations by Circuit ID; Network Routes — self-service Live Latency probe registration in Add/Edit Route (defaults-based, no admin access required); Network Routes — PDF Network Map Export (region-selectable, auto-laid-out diagram with POP-level nodes, address annex, and confidentiality-marked title block); Voice - One Directory — no-credential Guest login, customizable per-quote Growth %, standalone Bandwidth Calculator tab, bundle discount reconciliation + exact Pricing Log figures, per-bundle CSV re-export, and On Net minimum-bandwidth bug fix; Promo Pricing Manager — Excluded Circuit IDs (takes precedence over required circuits); CNX Ethernet Route Finder — "Find Promo Pricing" constrained-pathfind button that finds the cheapest margin-valid promo-eligible route for a chosen bandwidth; Manage Carriers database export includes `carrier_id` (upload accepts id for match); network route delete cascades `live_latency_config`; Colocation location available power excludes racks with no remaining RUs; Carrier Contacts export adds parent `region`; Allocated Cost Calculator — Circuit ID label + `POP Code - Datacenter Name` display; Extranet Pricing Logs — Calculation Breakdown JSON opens manually per item
- **v3.4.7** (Feb 22, 2026): Home Page with live latency matrix (hourly Dijkstra using live latency, 1Gb/10Gb tabs, click-through to Route Finder); Extranet Pricing — role-based pricing logs access control
- **v3.4.7** (Feb 22, 2026): CNX Colocation — Exchange facing infrastructure display in Availability Dashboard and Inventory tables, RU allocated fix to include IPC reserved, bulk upload NOT NULL constraint fixes for racks/clients, per-rack device export with pre-populated RU rows, improved export error handling
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
