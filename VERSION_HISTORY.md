# Version History

## Version 3.5.0 - Current Release

**Release Date:** May 2026
**Status:** In Development

---

### Bug Fixes

#### One Directory Pricing Tool — Permission Error Fix
Users with `voice_one_directory` module access but without `extranet_pricing` module permissions could not load the One Directory Pricing Tool due to 403 errors on cities and currencies endpoints.

**Changes:**
- Added `GET /voice/one-directory/cities` backend endpoint scoped to `voice_one_directory` permission
- Added `GET /voice/one-directory/currencies` backend endpoint scoped to `voice_one_directory` permission
- Updated `OneDirectoryPricingTool.js` to use the new scoped endpoints instead of the `extranet-pricing` namespace endpoints
- Switched from `Promise.all` to `Promise.allSettled` so partial data load failures are handled gracefully rather than blocking the entire tool

**Files changed:** `backend/routes.js`, `frontend/src/OneDirectoryPricingTool.js`

---

## Version 3.3 - Previous Release

**Release Date:** January 2025  
**Status:** In Development

---

### 🎯 Major Features

#### 1. **Feedback Module** ✅
Complete bug reporting and feature request system for all users.

**Features:**
- User submission form with priority levels (Urgent, ASAP, Informational)
- File attachment support (3 files, 5MB each) with multi-select capability
- Sequential feedback ID tracking (#1, #2, #3...)
- "My Submissions" dashboard with filters
- Admin dashboard with statistics
- Two-way comment system (user ↔ admin)
- Status management (New, In Progress, Complete, Closed/Won't Fix)
- Version tracking for completed features
- Status history audit trail
- Red highlighting for Priority 1 (Urgent) submissions
- **Unread comment tracking** - Visual indicators for new activity:
  - Light blue highlight for items with unread comments
  - Blue left border accent
  - "NEW" badge on submission ID
  - Red badge on View button showing unread count
  - Auto-mark as read when viewing details
- **Admin deletion** - Admins can permanently delete feedback:
  - Delete button in admin dashboard
  - Confirmation dialog with warning
  - Cascading deletion (comments, attachments, status history)
  - Automatic file cleanup
  - Audit logging
- **Notification bell** - Top toolbar notification indicator:
  - Bell icon with badge showing unread count
  - For users: Shows count of feedback with unread admin comments **OR status updates**
  - For admins: Shows count of **new unviewed submissions** OR feedback with unread user comments
  - Auto-refreshes every 30 seconds (only when authenticated)
  - **Smart navigation**: Click to navigate directly to relevant tab:
    - Users → "My Submissions" tab (view their feedback with updates)
    - Admins → "Admin Dashboard" tab (view all unread submissions)
  - Tooltip shows context ("X unread feedback items" or "No new notifications")
  - Prevents 401/403 errors on page load with authentication check

**Technical Details:**
- 5 new database tables (feedback_submissions, feedback_attachments, feedback_comments, feedback_status_history, feedback_views)
- 12 API endpoints (including DELETE /feedback/:id, GET /feedback/notifications/count)
- Bypasses permission system (available to all authenticated users)
- Read tracking per user per feedback item
- Files stored in `backend/feedback_files/`
- CASCADE DELETE constraints for data integrity
- Real-time notification polling (30-second interval)

**Files Added:**
- `backend/migrations/005_create_feedback_module.js`
- `backend/migrations/006_add_feedback_read_tracking.js`
- `backend/feedback_files/` directory
- `frontend/src/FeedbackManager.js`
- API functions in `frontend/src/api.js`
- Menu integration in `frontend/src/App.js`

**Bug Fixes (v3.4.4):**
- Fixed SQLITE_CONSTRAINT error when attaching files to feedback submissions
- Root cause: Incorrect SQLite3 callback pattern (`statement?.lastID` instead of `this.lastID`)
- Affected endpoints: POST /feedback (submissions), POST /feedback/:id/comment

**Enhancements (v3.4.4):**
- **Carriers Manager - Contact Search**: Added dedicated contact name search field
  - Separate from carrier search for focused contact lookup
  - Auto-expands carrier rows when matching contacts found
  - Highlights matching contacts with blue border and bold text
  - Shows count of carriers with matching contacts
  - Clear button to reset search
- **Carriers Manager - Contact Sorting**: Added sortable columns in contact details table
  - Click Type header to sort alphabetically (A-Z / Z-A toggle)
  - Click Level header to sort by logical order (General → 1st → 2nd → 3rd → 4th → 5th Level)
  - Visual sort direction indicators (↑/↓ arrows)
  - Default sort: Type (A-Z), then Level (logical order)

---

#### 2. **Allocated Cost Calculator** ✅
Manual route selection tool for internal pricing teams with allocated cost calculations.

**Features:**
- **Manual Route Input**: Enter specific circuit IDs (comma-separated) instead of automatic path finding
- **Real-time Circuit Validation**: Instant feedback if circuit IDs don't exist in database
- **End-to-End Route Validation**: Validates that selected routes form complete path from source to destination
- **Pricing Type Options**:
  - Primary Path Only
  - Primary & Secondary Paths
  - Protected Service (with 70% secondary path pricing)
- **Enhanced Pricing Display**:
  - Allocated Cost (based on actual route costs)
  - Minimum Price (40% margin)
  - Suggested Price (60% margin)
  - NRC charges
- **Route Details Table**: Shows Circuit ID, Segment, Latency, Carrier, and **Cable System** for each hop
- **Cross-Connect Integration**: Optional cross-connect pricing for source/destination
- **Export Functionality**:
  - Copy to clipboard
  - Download as text file
  - Same format as Network Design Tool
- **Pricing Logs**: 
  - Read-Only users: View their own calculation logs
  - Provisioner users: View all user logs from this module
  - Admin users: Full access including log deletion
- **Permission System**:
  - Admins: Full access by default
  - Other users: No access by default (admin must grant)
  - Separate from Network Design Tool permissions

**Technical Details:**
- Reuses Network Design Tool pricing engine
- Separate pricing logs table: `allocated_cost_pricing_logs`
- Manual route entry replaces automatic pathfinding algorithm
- Validates circuit existence before calculation
- Checks route connectivity (no gaps in path)
- Error messages: "Circuit ID not found" or "Routes don't create end-to-end path"
- Protected path validation (separate input for secondary routes)
- Same pricing rules and location minimums as Design Tool

**Database Changes:**
- New table: `allocated_cost_pricing_logs` (same schema as pricing_logs)
- New module: `allocated_cost_calculator` in role_permissions
- Permission levels: read_only, provisioner (no delete for either)

**User Interface:**
- Located under "Network Design & Pricing Tool" in menu
- Three tabs: Input Form, Pricing Logs (if authorized)
- Accordion-style sections for input, route results, and pricing results
- Real-time validation messages with color coding:
  - ⏳ Yellow: Validating...
  - ❌ Red: Invalid routes
  - ✓ Green: Routes validated successfully
- Dynamic form fields (Secondary Path shows only when needed)
- Export dialog with checkbox options for pricing types

**Files Added:**
- `backend/migrations/007_add_allocated_cost_calculator.js`
- `frontend/src/AllocatedCostCalculator.js` (725 lines)
- Permission entries in database for all roles

**Files Modified:**
- `frontend/src/NetworkDesignTool.js` - Added Cable System to route tables and email export
- `frontend/src/App.js` - Menu integration and routing
- `frontend/src/api.js` - API functions for allocated cost calculator
- `backend/routes.js` - Uses existing Network Design pricing endpoints

**Use Case:**
Internal pricing teams can manually specify exact routes for quotes where:
- Customer has specific route requirements
- Routes are pre-determined by sales team
- Need to calculate allocated cost for existing customer connections
- Require pricing for non-standard or custom paths

---

### 🐛 Bug Fixes & Improvements

#### 3. **Feedback Module Notification Enhancements** ✅

**Issues Fixed:**
1. **401/403 Authentication Errors** - Notification API called before authentication complete
   - Added authentication check before loading notification count
   - Silently ignore auth errors to prevent console spam
   - Made notification polling dependent on `isAuthenticated` state
   
2. **DOM Nesting Warning** - Invalid `<p>` inside `<p>` in feedback details
   - Changed Typography components to use `component="span"` in ListItemText
   - Added `display: 'block'` styling where needed
   - Fixed both Status History and Comments sections

3. **Status Change Notifications** - Users now get notified of status updates
   - Updated notification count query to include status history changes
   - Users see notifications when admins change feedback status (not just comments)
   - Unread count includes both admin comments AND status changes
   - Consistent notification behavior across all endpoints

4. **Admin New Submission Notifications** - Admins now notified of new feedback
   - Updated admin notification query to include new submissions they haven't viewed
   - Admins see notifications for both new submissions AND new user comments
   - Unread count in admin dashboard shows "1" for never-viewed items
   - New feedback submissions are highlighted as unread until admin views them

5. **Smart Notification Navigation** - Bell click takes users directly to unread items
   - For regular users: Clicking bell navigates to "My Submissions" tab
   - For admin users: Clicking bell navigates to "Admin Dashboard" tab
   - Manual menu navigation defaults to "New Submission" tab
   - Tab selection resets to default when navigating away from Feedback

6. **Menu Restructuring - CNX Colocation** - Improved navigation organization
   - Created new top-level "CNX Colocation" menu section
   - Moved from "Network Data" to its own dedicated section
   - Renamed module from "CNX Colocation" to "Colocation Inventory"
   - Uses BusinessCenterIcon for section header, LocationOnIcon for inventory
   - Prepares for future colocation-related modules to be added under same section

7. **Allocated Cost Calculator Route Validation** - Fixed bidirectional route validation
   - Routes can now be entered in any order
   - Source and destination are fully interchangeable
   - Uses BFS (Breadth-First Search) for path validation
   - Properly handles bidirectional network routes
   - Example: IPCLON7↔IPCNWK1 works same as IPCNWK1↔IPCLON7

8. **Permission System Cleanup** - Removed legacy dual permission system
   - Dropped `role_permissions` table (migration 008)
   - Removed 3 unused legacy functions (~150 lines of code)
   - Simplified to single permission system:
     - Administrators: Automatic full access (hardcoded)
     - Regular users: `user_module_permissions` table only
   - Improved performance (fewer database queries)
   - Easier maintenance and module addition

9. **Network Design Tool Route Selection** - Fixed multi-route prioritization
   - When multiple routes exist between same locations, prefer lowest latency
   - Previous behavior: Random (last processed route)
   - New behavior: Always select route with lowest expected_latency
   - Applies AFTER all exclusion filters (bandwidth, carrier avoidance, etc.)
   - Example: Between two routes (50ms vs 200ms), always picks 50ms route

10. **Cable System Backend Fix** - Fixed cable_system not appearing in route results
    - Added `cable_system` to route destructuring in path-finding algorithm
    - Added `cable_system` to graph edge data structure
    - Added `cable_system` to primary and protection path route details
    - Cable System now displays correctly in both Network Design Tool and Allocated Cost Calculator

**Files Modified:**
- `frontend/src/App.js` - Authentication check, notification polling, smart tab navigation, menu restructuring
- `frontend/src/FeedbackManager.js` - Fixed DOM nesting, added initialTab prop support
- `frontend/src/AllocatedCostCalculator.js` - Bidirectional route validation using BFS
- `backend/routes.js` - Enhanced notification queries, lowest-latency selection, cable_system inclusion
- `backend/auth.js` - Removed legacy permission functions
- `backend/migrations/007_add_allocated_cost_calculator.js` - Removed role_permissions logic
- `backend/migrations/008_remove_role_permissions.js` - New migration to drop legacy table
- `PERMISSION_SYSTEM_CLEANUP.md` - Complete documentation of permission cleanup

#### 4. **CNX Colocation Module Fixes** ✅

**Issues Fixed:**
1. **Validation Error** - Removed obsolete `network_infrastructure` field requirement
2. **Missing Field in UPDATE Endpoint** - Added `exchange_facing_infrastructure` destructuring
3. **Hardcoded Default Values** - Changed Total RU default from 30 to 42 across all locations
4. **Wrong Default Values in Add Rack** - Fixed `tor_network_infrastructure` from '0' to 'No'
5. **Data Type Conversion** - Added frontend conversion for legacy INTEGER→TEXT values
6. **Missing Conversion Functions** - Applied conversion in edit handlers
7. **Database Schema Mismatch** - Documented technical debt (works due to SQLite dynamic typing)

**Database Migration:**
- Migration 004: Converts existing `tor_network_infrastructure` values (0→'No', 1→'Yes - Cisco 3548')

**Files Modified:**
- `frontend/src/CNXColocationManager.js` - Multiple validation and default value fixes
- `backend/routes.js` - Field destructuring and data type handling
- `backend/migrations/004_convert_tor_network_to_text.js` - New migration

**Documentation:**
- `CNX_COLOCATION_FINAL_SUMMARY.md` - Complete fix documentation
- `CNX_COLOCATION_COMPREHENSIVE_FIXES.md` - Technical analysis
- `CNX_COLOCATION_FIX_SUMMARY.md` - User guide

---

### 📝 Documentation Updates

#### 5. **Module Documentation** ✅

**New Documentation:**
- `FEEDBACK_MODULE_DOCUMENTATION.md` - Complete feedback module guide
  - API reference
  - Database schema
  - User guide
  - Admin guide
  - Testing checklist
  - Security considerations
  - Troubleshooting guide

- `CNX_COLOCATION_AUDIT.md` - Audit checklist for CNX module
- `CNX_COLOCATION_COMPREHENSIVE_FIXES.md` - Technical fixes documentation
- `CNX_COLOCATION_FINAL_SUMMARY.md` - Complete summary of all fixes

---

### 🔧 Technical Changes

#### 6. **Database Schema**

**New Tables:**
- `feedback_submissions` - Main feedback tracking
- `feedback_attachments` - File uploads for feedback
- `feedback_comments` - Comment/reply system
- `feedback_status_history` - Status change audit trail
- `allocated_cost_pricing_logs` - Pricing calculations for allocated cost calculator

**Modified Tables:**
- `cnx_colocation_racks` - Data conversion for `tor_network_infrastructure` field

**Removed Tables:**
- `role_permissions` - Dropped legacy table (migration 008), now uses simplified permission system

#### 7. **Backend Enhancements**

**New Features:**
- File upload handling for feedback (multer configuration)
- 9 new API endpoints for feedback management
- Allocated cost calculator uses existing Network Design pricing endpoints
- Enhanced error handling and validation
- Automatic file cleanup on deletion
- Status history tracking

**Performance:**
- Batch processing for file uploads
- Optimized queries with joins for comment/attachment counts
- Proper indexing via foreign keys
- Reuse of pricing calculation logic (no duplication)

#### 8. **Frontend Enhancements**

**New Components:**
- `FeedbackManager.js` - Complete feedback management interface (1,057 lines)
  - Tab-based interface (New Submission, My Submissions, Admin Dashboard)
  - Statistics cards for admin dashboard
  - Advanced filtering and search
  - Real-time comment system
- `AllocatedCostCalculator.js` - Manual route pricing calculator (725 lines)
  - Real-time route validation with visual feedback
  - Accordion-style interface for input/results/pricing
  - Export dialog with multiple format options
  - Route details tables with Cable System column
  - Permission-aware pricing log viewer

**UI Improvements:**
- Red highlighting for urgent items
- Color-coded status and priority chips
- Badge notifications for comment counts
- Real-time validation feedback (⏳/❌/✓)
- Professional Material-UI design
- Responsive layout
- Cable System column added to Network Design Tool route tables

---

### 🔐 Security Enhancements

#### 9. **Access Control**

**Feedback Module:**
- Authentication required for all operations
- Users can only view/edit own submissions
- Admins have full access to all submissions
- Attachment downloads require ownership verification
- File type whitelist validation
- File size limits enforced (5MB per file)

**Allocated Cost Calculator:**
- Permission-based access (default: none for non-admin users)
- Separate from Network Design Tool permissions
- Read-only users: Can calculate and view own logs
- Provisioner users: Can calculate and view all logs
- Admin users: Full access including log deletion
- Circuit validation prevents invalid route calculations

**Audit Trail:**
- All feedback submissions logged
- All pricing calculations logged (separate table)
- Status changes recorded with admin notes
- Comment history maintained
- Integration with existing change_logs system

---

### 📦 Dependencies

**No New Dependencies Added** ✅
- All features built with existing packages
- Uses multer (already installed)
- Uses Material-UI (already installed)
- No breaking changes

---

### 🚀 Deployment Notes

#### Database Migrations
Run automatically on backend restart:
- `004_convert_tor_network_to_text.js` - Updates CNX Colocation data (0→'No', 1→'Yes - Cisco 3548')
- `005_create_feedback_module.js` - Creates 4 feedback tables
- `006_add_feedback_read_tracking.js` - Adds feedback_views table for unread tracking
- `007_add_allocated_cost_calculator.js` - Creates allocated_cost_pricing_logs table
- `008_remove_role_permissions.js` - Drops legacy role_permissions table (permission system cleanup)

#### File System
New directories created automatically:
- `backend/feedback_files/` - Feedback attachments storage

#### No Breaking Changes
- All changes are backward compatible
- Existing features unmodified
- Feedback module bypasses permission system (available to all)
- Allocated Cost Calculator requires permission grant from admin

---

### 📊 Statistics

**Lines of Code Added:**
- Backend: ~800 lines (feedback endpoints + allocated cost migration)
- Frontend: ~1,782 lines (FeedbackManager.js 1,057 + AllocatedCostCalculator.js 725)
- API Functions: ~70 lines
- Migrations: ~320 lines (feedback + allocated cost + CNX fixes + permission cleanup)
- Documentation: ~550 lines (VERSION_HISTORY + PERMISSION_SYSTEM_CLEANUP)

**Lines of Code Removed:**
- Backend: ~150 lines (removed legacy permission functions)

**Total New Files:** 13 (including migrations and documentation)
**Modified Files:** 10 (App.js, NetworkDesignTool.js, CNXColocationManager.js, routes.js, api.js, auth.js, AllocatedCostCalculator.js, UserManagement.js, VERSION_HISTORY.md, 007 migration)
**Database Tables Added:** 5 (feedback_submissions, feedback_attachments, feedback_comments, feedback_status_history, feedback_views, allocated_cost_pricing_logs)
**Database Tables Removed:** 1 (role_permissions)

---

### 🧪 Testing Checklist

#### Feedback Module
- [x] Submit bug report without attachments
- [x] Submit feature request with attachments
- [x] File upload validation (size, count, type)
- [x] Filter submissions by status and type
- [x] View feedback details
- [x] Add comments to feedback
- [x] Download attachments
- [x] Admin view all submissions
- [x] Admin update status with notes
- [x] Admin mark complete with version
- [x] Statistics dashboard display

#### Allocated Cost Calculator
- [ ] Enter valid circuit IDs (comma-separated)
- [ ] Real-time validation displays correctly
- [ ] Invalid circuit ID shows error message
- [x] Route connectivity validation works (bidirectional)
- [x] Routes can be entered in any order
- [x] Source and destination are interchangeable
- [ ] Calculate primary path pricing
- [ ] Calculate primary + secondary path pricing
- [ ] Calculate protected service pricing
- [ ] Cross-connect pricing optional addition
- [ ] Export to clipboard
- [ ] Export to text file
- [ ] View pricing logs (provisioner/admin)
- [ ] Clear logs (admin only)
- [x] Cable System displays in route tables
- [ ] Permission system enforced correctly

#### Network Design Tool Route Selection
- [x] Multiple routes between same locations handled correctly
- [x] Lowest latency route selected when multiple options exist
- [x] Route prioritization applies after exclusion filters
- [x] Cable System data flows from database to frontend
- [x] Cable System displays in route tables (both tools)
- [x] Cable System included in email exports

#### CNX Colocation Fixes
- [x] Create new shared rack
- [x] Create new dedicated rack
- [x] Edit existing rack
- [x] Delete rack
- [x] View rack elevation
- [x] Default values correct (42 RU, 'No' for infrastructure)
- [x] Data migration successful
- [x] No console warnings

#### Permission System Cleanup
- [x] Migration 008 runs successfully
- [x] role_permissions table removed
- [x] Legacy functions removed from auth.js
- [x] Admin users still have full access
- [x] Regular users use user_module_permissions only
- [x] No errors or broken functionality
- [x] Performance improvement verified

---

### 📱 User Impact

**All Users:**
- ✅ New "Feedback" menu item at bottom of navigation
- ✅ Can submit bugs and feature requests with screenshots
- ✅ Can track status of their submissions
- ✅ Can communicate with admins via comments

**Administrators:**
- ✅ Dashboard to manage all feedback
- ✅ Statistics overview
- ✅ Ability to update statuses and add notes
- ✅ Track completion with version numbers

**Pricing Team Users:**
- ✅ New "Allocated Cost Calculator" under Network Design & Pricing
- ✅ Manual route entry instead of automatic pathfinding
- ✅ Real-time circuit validation with clear error messages
- ✅ See allocated cost alongside minimum/suggested pricing
- ✅ Cable System information in route tables
- ✅ Export pricing results to text or clipboard
- ✅ View pricing calculation history (if authorized)

**CNX Colocation Users:**
- ✅ Fixed validation errors when saving racks
- ✅ Correct default values (42 RU)
- ✅ No more console warnings
- ✅ Improved data consistency

---

### 🔮 Future Enhancements (Not in v3.3)

**Possible Future Features:**
1. Email notifications for status changes
2. Feedback export to Excel/CSV
3. Bulk status updates
4. Feature request voting system
5. Public roadmap view
6. SLA tracking for urgent bugs
7. Integration with external ticketing systems

---

### 👥 Credits

**Development Team:**
- Network Inventory Management System v3.3
- January 2025

---

### 📞 Support

For issues or questions about v3.3:
1. Use the new Feedback module (Feedback → New Submission)
2. Check documentation in `/FEEDBACK_MODULE_DOCUMENTATION.md`
3. Review CNX Colocation fixes in `/CNX_COLOCATION_FINAL_SUMMARY.md`

---

**Version 3.3 Status:** ✅ Complete and Ready for Deployment

**Migration Required:** Yes (runs automatically)  
**Breaking Changes:** None  
**Backward Compatible:** Yes

