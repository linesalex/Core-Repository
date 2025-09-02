-- Consolidated Migration Script: Protection Fields + Live Latency Enhancement
-- Run this script to add protection fields and live latency tracking to the network routes system

-- Add protection fields to network_routes table
ALTER TABLE network_routes ADD COLUMN carrier_protected INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE network_routes ADD COLUMN carrier_protection_route TEXT DEFAULT '';

-- Add live latency tracking fields to network_routes table
ALTER TABLE network_routes ADD COLUMN live_latency_last_updated DATETIME;
ALTER TABLE network_routes ADD COLUMN live_latency_source TEXT DEFAULT 'manual';

-- Update existing protection field data
UPDATE network_routes SET carrier_protected = 0, carrier_protection_route = '' WHERE carrier_protected IS NULL;

-- Create live latency history table for daily snapshots and trends
CREATE TABLE IF NOT EXISTS live_latency_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    circuit_id TEXT NOT NULL,
    latency_ms REAL,
    sla_latency REAL,
    snapshot_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (circuit_id) REFERENCES network_routes(circuit_id) ON DELETE CASCADE,
    UNIQUE(circuit_id, snapshot_date)
);

-- Create index for faster queries on history table
CREATE INDEX IF NOT EXISTS idx_live_latency_history_circuit_date ON live_latency_history(circuit_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_live_latency_history_date ON live_latency_history(snapshot_date);

-- Insert comment for reference
INSERT OR IGNORE INTO change_logs (user_id, table_name, record_id, action, new_values, changes_summary, ip_address, user_agent) 
VALUES (NULL, 'database_migration', 'protection_and_live_latency', 'SCHEMA_UPDATE', 
        '{"protection_fields": ["carrier_protected", "carrier_protection_route"], "live_latency_fields": ["live_latency_last_updated", "live_latency_source"], "new_table": "live_latency_history"}', 
        'Added protection fields and live latency tracking enhancement', 'localhost', 'migration_script');
