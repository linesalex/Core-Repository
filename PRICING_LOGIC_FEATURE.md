# Pricing Logic Configuration Feature

## Overview

The **Pricing Logic** feature provides administrators with real-time control over the core pricing parameters used in network design calculations. This feature transforms hardcoded pricing rules into a dynamic, database-driven configuration system that can be modified through an intuitive admin interface.

## Current Pricing Logic Explained

### 1. **Contract Term-Based Pricing**

The system uses different margin structures based on contract duration:

| Contract Term | Minimum Margin | Suggested Margin | NRC Charge |
|---------------|----------------|------------------|------------|
| 12 months     | 40%           | 60%             | $1,000     |
| 24 months     | 37.5%         | 55%             | $500       |
| 36 months     | 35%           | 50%             | $0         |

### 2. **Bandwidth Tier Minimums**

Location-specific minimum pricing enforced by bandwidth tiers:
- **< 100 Mbps**: `min_price_under_100mb`
- **100-999 Mbps**: `min_price_100_to_999mb`
- **1000-2999 Mbps**: `min_price_1000_to_2999mb`
- **3000+ Mbps**: `min_price_3000mb_plus`

### 3. **Additional Charges**

- **ULL Premium**: 15% surcharge for Ultra Low Latency requirements
- **Protection Path**: 70% of secondary path cost added to primary path

### 4. **Utilization Factors**

- **Primary Path**: 90% expected utilization
- **Protection Path**: 100% expected utilization

## New Features

### ✅ **Admin-Only Pricing Logic Tab**

A new "Pricing Logic" tab appears in the Network Design & Pricing Tool section, visible only to administrators.

### ✅ **Real-Time Configuration Updates**

- Changes take effect immediately for new pricing calculations
- No server restart required
- Existing calculations remain unchanged

### ✅ **Comprehensive Parameter Control**

**Contract Terms Configuration:**
- Editable minimum and suggested margins for each contract term
- Configurable NRC charges per term
- Support for adding new contract terms

**Additional Charges:**
- ULL premium percentage control
- Protection path multiplier adjustment

**Utilization Factors:**
- Primary and protection path utilization rates
- Bandwidth allocation calculation parameters

### ✅ **Security & Audit**

- Administrator-only access control
- Full audit trail of configuration changes
- Change logs integration
- Validation and error handling

## Implementation Details

### Backend Changes

1. **New Database Table**: `pricing_logic_config`
   ```sql
   CREATE TABLE pricing_logic_config (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     config_key TEXT NOT NULL UNIQUE,
     config_value TEXT NOT NULL,
     updated_by INTEGER NOT NULL,
     updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **New API Endpoints**:
   - `GET /pricing_logic/config` - Fetch current configuration
   - `PUT /pricing_logic/config` - Update configuration (admin only)

3. **Dynamic Pricing Calculation**: The core pricing engine now loads configuration from the database instead of using hardcoded values.

### Frontend Changes

1. **New Component**: `PricingLogicManager.js`
   - Interactive configuration forms
   - Real-time validation
   - Success/error feedback

2. **Navigation Updates**: New tab in the Network Design & Pricing Tool section

3. **Permission Integration**: Leverages existing admin role checking

## Usage Instructions

### For Administrators

1. **Access the Feature**:
   - Log in with administrator credentials
   - Navigate to "Network Design & Pricing Tool"
   - Click on "Pricing Logic" tab

2. **Configure Contract Terms**:
   - Adjust minimum and suggested margins
   - Modify NRC charges
   - View changes in expandable table format

3. **Adjust Additional Charges**:
   - Modify ULL premium percentage
   - Update protection path multiplier

4. **Update Utilization Factors**:
   - Set primary path utilization rate
   - Configure protection path utilization

5. **Save Changes**:
   - Click "Save Changes" to apply configuration
   - View confirmation and timestamp

### Configuration Impact

- **Immediate Effect**: New pricing calculations use updated parameters
- **Historical Data**: Existing calculations remain unchanged
- **Audit Trail**: All changes are logged in the audit system

## Benefits

### 1. **Business Flexibility**
- Rapid response to market changes
- No development cycles for pricing adjustments
- Real-time competitive positioning

### 2. **Operational Efficiency**
- Self-service configuration for admins
- Reduced dependency on technical teams
- Immediate testing of pricing scenarios

### 3. **Risk Management**
- Audit trail for compliance
- Role-based access control
- Validation and error prevention

### 4. **Scalability**
- Easy addition of new contract terms
- Extensible configuration structure
- Database-driven approach

## Security Considerations

- **Access Control**: Only administrators can view/modify pricing logic
- **Validation**: Input validation prevents invalid configurations
- **Audit Logging**: All changes are tracked with user attribution
- **Transaction Safety**: Database transactions ensure consistency

## Future Enhancements

Potential extensions to the pricing logic system:

1. **Multi-Region Pricing**: Different configurations per geographical region
2. **Customer-Specific Rules**: Pricing overrides for specific customers
3. **Time-Based Rules**: Seasonal or promotional pricing adjustments
4. **Advanced Formulas**: Complex pricing calculations with custom formulas
5. **Approval Workflows**: Multi-step approval for pricing changes
6. **Version Control**: Historical configuration versions and rollback capability

## Technical Architecture

### Data Flow

1. **Configuration Load**: Pricing engine loads configuration on startup and caches it
2. **Real-Time Updates**: API changes trigger configuration reload
3. **Calculation Application**: New calculations use current configuration
4. **Audit Recording**: All changes logged to audit system

### Performance Considerations

- **Caching**: Configuration cached in memory for performance
- **Database Efficiency**: Indexed lookups for configuration retrieval
- **Minimal Overhead**: Configuration load adds negligible calculation time

## Migration & Deployment

### Database Migration

The `pricing_logic_config` table is created with default values matching the previous hardcoded configuration, ensuring seamless transition.

### Backward Compatibility

The system maintains full backward compatibility:
- Default values match previous hardcoded behavior
- Fallback to defaults if configuration is missing
- Existing API contracts unchanged

## Testing

### Recommended Test Scenarios

1. **Configuration Changes**: Verify pricing calculations update immediately
2. **Permission Testing**: Confirm non-admin users cannot access the feature
3. **Validation Testing**: Test invalid input handling
4. **Audit Verification**: Confirm all changes are properly logged
5. **Performance Testing**: Ensure configuration loading doesn't impact calculation speed

This feature represents a significant enhancement to the network design & pricing tool, providing administrators with the flexibility to respond quickly to business needs while maintaining security and audit compliance.