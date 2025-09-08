-- User Change Tracking Migration Script
-- This script adds user change tracking fields to various tables
-- Run this script to add updated_by and updated_date fields where missing

-- Add tracking fields to network_routes table
ALTER TABLE network_routes ADD COLUMN updated_by INTEGER;
ALTER TABLE network_routes ADD COLUMN updated_date DATETIME;

-- Add tracking fields to exchange_feeds table  
ALTER TABLE exchange_feeds ADD COLUMN updated_by INTEGER;
ALTER TABLE exchange_feeds ADD COLUMN updated_date DATETIME;

-- Add tracking fields to exchange_contacts table
ALTER TABLE exchange_contacts ADD COLUMN updated_by INTEGER;
ALTER TABLE exchange_contacts ADD COLUMN updated_date DATETIME;

-- Add tracking fields to carrier_contacts table (updated_by only, as last_updated already exists)
ALTER TABLE carrier_contacts ADD COLUMN updated_by INTEGER;

-- Add tracking fields to cnx_colocation_racks table
ALTER TABLE cnx_colocation_racks ADD COLUMN updated_by INTEGER;
ALTER TABLE cnx_colocation_racks ADD COLUMN updated_date DATETIME;

-- Add tracking fields to cnx_colocation_clients table
ALTER TABLE cnx_colocation_clients ADD COLUMN updated_by INTEGER;
ALTER TABLE cnx_colocation_clients ADD COLUMN updated_date DATETIME;

-- Create foreign key indexes for better performance
CREATE INDEX IF NOT EXISTS idx_network_routes_updated_by ON network_routes(updated_by);
CREATE INDEX IF NOT EXISTS idx_exchange_feeds_updated_by ON exchange_feeds(updated_by);
CREATE INDEX IF NOT EXISTS idx_exchange_contacts_updated_by ON exchange_contacts(updated_by);
CREATE INDEX IF NOT EXISTS idx_carrier_contacts_updated_by ON carrier_contacts(updated_by);
CREATE INDEX IF NOT EXISTS idx_cnx_colocation_racks_updated_by ON cnx_colocation_racks(updated_by);
CREATE INDEX IF NOT EXISTS idx_cnx_colocation_clients_updated_by ON cnx_colocation_clients(updated_by);

-- Insert comment for reference
INSERT OR IGNORE INTO change_logs (user_id, table_name, record_id, action, new_values, changes_summary, ip_address, user_agent) 
VALUES (NULL, 'database_migration', 'user_change_tracking', 'SCHEMA_UPDATE', 
        '{"migration": "user_change_tracking", "tables_updated": ["network_routes", "exchange_feeds", "exchange_contacts", "carrier_contacts", "cnx_colocation_racks", "cnx_colocation_clients"]}', 
        'Added user change tracking fields for better audit trail', 
        'migration_script', 'Migration Script');
