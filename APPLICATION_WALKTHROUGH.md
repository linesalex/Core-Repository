# Network Inventory Management System - Application Walkthrough

## 🌟 **Overview**

The Network Inventory Management System is a comprehensive web application designed for telecommunications companies to manage their network infrastructure, pricing, exchanges, and routing data. This walkthrough covers all major features and how to use them effectively.

---

## 🔐 **Authentication & Access Control**

### **Login System**
- **Default Credentials**: 
  - Username: `admin`
  - Password: `admin123`
- **Role-Based Access**: Different user roles have access to different modules
- **Module Visibility**: Administrators can control which sidebar modules users can see

### **User Roles**
- **Administrator**: Full access to all features
- **Provisioner**: Access to most features except user management
- **Read-Only**: View-only access to most data

---

## 📋 **Main Application Features**

## 1. 🌐 **Network Routes Management**

**Purpose**: Manage network circuit information and routing data.

### **Key Features:**
- **Circuit Database**: Store and manage network circuit details
- **Search & Filter**: Find circuits by ID, type, status, carrier, etc.
- **Route Details**: View complete routing information for each circuit
- **File Management**: Upload KMZ files and test results
- **Export Data**: Export circuit data to CSV format

### **How to Use:**
1. Navigate to "Network Routes" from the sidebar
2. Use the search bar to filter circuits
3. Click on a circuit to view detailed information
4. Use "Add Route" button to create new circuits
5. Edit existing routes by selecting and clicking "Edit"

---

## 2. 🎯 **Network Design Tool**

**Purpose**: Design network paths and calculate pricing for customer quotes.

### **Key Features:**
- **Path Finding**: Automatically find optimal routes between locations
- **Pricing Calculation**: Calculate costs based on bandwidth, distance, and protection
- **KMZ Generation**: Create visual route maps
- **Saved Searches**: Store frequently used route configurations
- **Audit Logs**: Track all pricing calculations with full details

### **How to Use:**
1. Select "Network Design Tool" from sidebar
2. Choose source and destination locations
3. Set bandwidth requirements (10M to 100G)
4. Select protection requirements (if needed)
5. Click "Find Path" to see available routes
6. Click "Calculate Pricing" for cost estimates
7. Save successful searches for future reference

### **Pricing Components:**
- **Monthly Recurring Charges (MRC)**: Monthly service fees
- **Non-Recurring Charges (NRC)**: One-time setup costs
- **Protection Charges**: Additional cost for backup routes
- **Contract Terms**: Pricing varies by 12, 24, or 36-month terms

---

## 3. 📍 **Location Data Manager**

**Purpose**: Manage data center and POP (Point of Presence) locations.

### **Key Features:**
- **Location Database**: Store all data center and POP information
- **POP Capabilities**: Define what services are available at each location
- **Regional Organization**: Group locations by Americas, EMEA, APAC
- **Access Information**: Store data center access procedures
- **Minimum Pricing**: Set location-specific pricing floors

### **How to Use:**
1. Go to "Location Data Manager"
2. View all locations in the main table
3. Click "POP Capabilities" to see/edit available services
4. Use "Access Info" to view data center access procedures
5. Add new locations with "Add Location" button

### **POP Capabilities Include:**
- CNX Ethernet, Extranet, Voice
- SDWAN and Unigy services
- Exchange and Internet on-ramps
- Colocation services

---

## 4. 🏢 **CNX Colocation Manager**

**Purpose**: Manage colocation facilities, racks, and client allocations.

### **Key Features:**
- **Facility Management**: Track colocation-enabled locations
- **Rack Inventory**: Manage individual racks and their specifications
- **Client Allocation**: Track which clients use which racks
- **Power Management**: Monitor power allocation and availability
- **Space Tracking**: Track rack unit (RU) usage

### **How to Use:**
1. Select "CNX Colocation Manager"
2. Click on a location to expand and see racks
3. Click on a rack to see client allocations
4. Use "Add Rack" to create new rack entries
5. Use "Add Client" to allocate space to customers

---

## 5. 🚛 **Carriers Manager**

**Purpose**: Manage carrier relationships and contact information.

### **Key Features:**
- **Carrier Database**: Store all carrier information by region
- **Contact Management**: Maintain up-to-date contact details
- **Overdue Tracking**: Monitor when contact information needs updates
- **Relationship History**: Track carrier name changes and evolution

### **How to Use:**
1. Navigate to "Carriers Manager"
2. Browse carriers by region (Americas, EMEA, APAC)
3. Click on a carrier to see all contacts
4. Use "Add Contact" to add new carrier contacts
5. Check "Overdue Contacts" tab for contacts needing updates

---

## 6. 💱 **Exchange Data Manager**

**Purpose**: Manage financial exchanges, trading feeds, and connectivity options.

### **Key Features:**
- **Exchange Database**: Store exchange information by region
- **Feed Management**: Track trading feeds and their specifications
- **Contact Management**: Maintain exchange relationship contacts
- **Availability Tracking**: Monitor service availability
- **Design Files**: Store and manage exchange connectivity designs

### **How to Use:**
1. Go to "Exchange Data Manager"
2. Filter exchanges by region or availability
3. Expand an exchange to see available feeds
4. Click "Add Feed" to add new trading feeds
5. Manage contacts for business relationships

---

## 7. 💰 **Exchange Rates Manager**

**Purpose**: Manage currency exchange rates for international pricing.

### **Key Features:**
- **Multi-Currency Support**: Handle pricing in various currencies
- **Rate Management**: Update exchange rates for accurate pricing
- **Historical Tracking**: Maintain rate change history
- **Integration**: Rates feed into pricing calculations

### **How to Use:**
1. Select "Exchange Rates Manager"
2. View current rates for all supported currencies
3. Update rates by editing existing entries
4. Add new currencies as needed

---

## 8. 🎯 **Exchange Pricing Tool**

**Purpose**: Generate customer quotes for exchange connectivity.

### **Key Features:**
- **Quote Generation**: Create detailed pricing quotes
- **Multi-Currency**: Support quotes in customer's preferred currency
- **Feed Selection**: Choose specific trading feeds
- **Order Entry**: Include order entry service requirements
- **Quote History**: Track all generated quotes
- **Email Export**: Send quotes directly to customers

### **How to Use:**
1. Open "Exchange Pricing Tool"
2. Fill in customer and quote details
3. Select region, exchange, and specific feeds
4. Choose currency and pricing requirements
5. Generate quote and review results
6. Export to email or save for records

---

## 9. 📊 **Bulk Upload**

**Purpose**: Import large datasets efficiently.

### **Key Features:**
- **CSV Import**: Upload data via CSV files
- **Template Download**: Get properly formatted templates
- **Multiple Modules**: Support for routes, carriers, exchanges, etc.
- **Validation**: Automatic data validation during import
- **History Tracking**: Monitor all upload activities

### **How to Use:**
1. Navigate to "Bulk Upload" (Admin only)
2. Select the module you want to import data for
3. Download the CSV template
4. Fill in your data following the template format
5. Upload the completed CSV file
6. Review import results and fix any errors

---

## 10. 📈 **Change Logs Viewer**

**Purpose**: Track all system changes and modifications.

### **Key Features:**
- **Activity Tracking**: See all user actions in the system
- **Detailed Logs**: View what changed, when, and by whom
- **Filtering**: Search logs by user, date, or module
- **Audit Trail**: Complete audit trail for compliance

### **How to Use:**
1. Go to "Change Logs Viewer"
2. Filter by date range, user, or activity type
3. Click on entries to see detailed change information
4. Use pagination to browse through historical data

---

## 11. 👥 **User Management**

**Purpose**: Manage user accounts and permissions (Admin only).

### **Key Features:**
- **User Accounts**: Create and manage user accounts
- **Role Assignment**: Assign roles (Admin, Provisioner, Read-Only)
- **Module Visibility**: Control which sidebar modules users see
- **Password Management**: Handle password changes and resets
- **Status Control**: Activate/deactivate user accounts

### **How to Use:**
1. Select "User Management" (Admin only)
2. Click "Add User" to create new accounts
3. Edit existing users by clicking the edit icon
4. Use "Module Visibility" to control sidebar access
5. Change user status to activate/deactivate accounts

---

## 12. 💵 **Minimum Pricing Manager**

**Purpose**: Set pricing floors for different locations and bandwidths.

### **Key Features:**
- **Location-Specific Pricing**: Set minimum prices per location
- **Bandwidth Tiers**: Different minimums for various bandwidth ranges
- **Override Protection**: Prevent pricing below configured minimums
- **Regional Variation**: Allow pricing variation by geographic region

### **How to Use:**
1. Navigate to "Minimum Pricing Manager"
2. Click on a location to set minimum pricing
3. Configure minimums for each bandwidth tier:
   - Under 100Mb
   - 100-999Mb  
   - 1000-2999Mb
   - 3000Mb+
4. Save settings to enforce minimums

---

## 13. ⚙️ **Pricing Logic Manager**

**Purpose**: Configure dynamic pricing parameters (Admin only).

### **Key Features:**
- **Contract Terms**: Set margins for 12, 24, 36-month contracts
- **Additional Charges**: Configure NRC and protection costs
- **Utilization Factors**: Set capacity multipliers
- **Dynamic Updates**: Change pricing without code modifications

### **How to Use:**
1. Go to "Pricing Logic Manager" (Admin only)
2. Adjust contract term margins
3. Modify additional charges (NRC, protection)
4. Update utilization factors
5. Save changes to apply new pricing logic

---

## 🔄 **Common Workflows**

### **Creating a Customer Quote:**
1. Use Network Design Tool to find optimal path
2. Calculate pricing based on requirements
3. Check Exchange Pricing Tool for additional services
4. Generate comprehensive quote
5. Save search for future reference

### **Managing Network Changes:**
1. Update routes in Network Routes Management
2. Check impact on pricing in Network Design Tool
3. Update carrier information if needed
4. Log changes in Change Logs Viewer

### **Onboarding New Locations:**
1. Add location in Location Data Manager
2. Configure POP capabilities
3. Set minimum pricing if required
4. Update CNX Colocation if applicable

---

## 🎛️ **System Administration**

### **Regular Maintenance:**
- Update exchange rates weekly
- Review and approve overdue contacts monthly
- Monitor change logs for unusual activity
- Backup data regularly
- Update user permissions as needed

### **Performance Optimization:**
- Use filters and search to limit large datasets
- Archive old data periodically
- Monitor system resources during bulk uploads
- Review pricing logic configurations quarterly

---

## 🆘 **Troubleshooting & Support**

### **Common Issues:**
- **Slow Loading**: Use search filters to limit data
- **Login Problems**: Check credentials and account status
- **Permission Errors**: Verify user role and module access
- **Data Export**: Ensure sufficient permissions for downloads

### **Getting Help:**
- Check Change Logs for recent system changes
- Verify user permissions in User Management
- Contact system administrator for access issues
- Review application logs for technical problems

---

## 🚀 **Best Practices**

1. **Regular Data Updates**: Keep carrier and exchange information current
2. **Use Search Filters**: Improve performance with targeted searches
3. **Save Frequent Searches**: Use saved searches for common route requests
4. **Monitor Pricing**: Review minimum pricing settings regularly
5. **Track Changes**: Use change logs to monitor system usage
6. **Backup Important Data**: Export critical data regularly
7. **Update Exchange Rates**: Keep currency rates current for accurate pricing

---

This comprehensive system provides all tools needed for effective network inventory management, pricing, and customer relationship management in the telecommunications industry. 