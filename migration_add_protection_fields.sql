-- Migration Script: Add Protection Fields to Network Routes
-- Date: January 2025
-- Description: Adds carrier_protected and carrier_protection_route fields to network_routes table

-- Add carrier_protected column (0 = No, 1 = Yes)
ALTER TABLE network_routes ADD COLUMN carrier_protected INTEGER DEFAULT 0 NOT NULL;

-- Add carrier_protection_route column (text field for protection route details)
ALTER TABLE network_routes ADD COLUMN carrier_protection_route TEXT DEFAULT '';

-- Update existing records to have default values
UPDATE network_routes SET carrier_protected = 0, carrier_protection_route = '' WHERE carrier_protected IS NULL;

-- Verify the changes
-- SELECT carrier_protected, carrier_protection_route FROM network_routes LIMIT 5;

-- Migration completed successfully