-- Cross Connect Migration Script
-- Adds cross connect fields to location_reference table
-- Run this SQL script to update the database schema

-- Add cross connect fields to location_reference table
ALTER TABLE location_reference ADD COLUMN cross_connect_nrc DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE location_reference ADD COLUMN cross_connect_nrc_currency VARCHAR(3) DEFAULT 'USD';
ALTER TABLE location_reference ADD COLUMN cross_connect_mrc DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE location_reference ADD COLUMN cross_connect_mrc_currency VARCHAR(3) DEFAULT 'USD';
ALTER TABLE location_reference ADD COLUMN cross_connect_notes TEXT(256) DEFAULT NULL;

-- Add cross connect margin settings to pricing_logic_config table
INSERT OR IGNORE INTO pricing_logic_config (config_key, config_value, updated_by) 
VALUES ('cross_connect_nrc_margin', '10', 1);

INSERT OR IGNORE INTO pricing_logic_config (config_key, config_value, updated_by) 
VALUES ('cross_connect_mrc_margin', '10', 1);

-- Update schema version or add comment
-- This migration adds cross connect support to locations
-- Fields added: cross_connect_nrc, cross_connect_nrc_currency, cross_connect_mrc, cross_connect_mrc_currency, cross_connect_notes
-- Default margins: 10% for both NRC and MRC
