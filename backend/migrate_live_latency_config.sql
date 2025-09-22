-- Live Latency API Configuration System Migration
-- Creates tables for admin-configurable live latency API integration

-- Main configuration table for per-circuit API settings
CREATE TABLE IF NOT EXISTS live_latency_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circuit_id TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  api_base_url TEXT NOT NULL,
  api_instance_name TEXT NOT NULL,
  api_indicator TEXT DEFAULT 'AnyVendor - Response Time (ms) - BPI',
  api_parameters TEXT, -- JSON string for custom params like displayRate
  auth_username TEXT,
  auth_password_encrypted TEXT, -- encrypted password storage
  update_interval_minutes INTEGER DEFAULT 15,
  failure_count INTEGER DEFAULT 0,
  disabled_until DATETIME NULL, -- when auto-disabled, when to retry
  last_test_at DATETIME,
  last_test_status TEXT, -- 'success', 'failed', 'timeout'
  last_test_response_time_ms INTEGER,
  last_test_error TEXT,
  last_successful_update DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  FOREIGN KEY (circuit_id) REFERENCES network_routes(circuit_id) ON DELETE CASCADE
);

-- Detailed logging table for API calls and responses
CREATE TABLE IF NOT EXISTS live_latency_api_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circuit_id TEXT NOT NULL,
  config_id INTEGER REFERENCES live_latency_config(id),
  request_type TEXT NOT NULL, -- 'scheduled', 'manual', 'test'
  request_url TEXT,
  request_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  response_status INTEGER,
  response_time_ms INTEGER,
  raw_response TEXT, -- Store raw API response for debugging
  extracted_values TEXT, -- JSON array of extracted latency values
  calculated_average REAL,
  latest_value REAL,
  final_latency_value REAL, -- What was actually stored (0 override logic)
  data_quality_score INTEGER,
  error_message TEXT,
  requested_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Global system settings for live latency management
CREATE TABLE IF NOT EXISTS live_latency_system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_name TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id)
);

-- Insert default system settings
INSERT OR REPLACE INTO live_latency_system_config (setting_name, setting_value, description) VALUES
('global_refresh_cooldown_minutes', '15', 'Minimum minutes between manual refresh requests'),
('last_global_refresh', '1970-01-01 00:00:00', 'Timestamp of last manual refresh request'),
('auto_disable_failure_threshold', '3', 'Number of consecutive failures before auto-disable'),
('auto_disable_retry_hours', '24', 'Hours to wait before retrying auto-disabled circuits'),
('api_request_timeout_seconds', '30', 'Timeout for external API requests'),
('default_data_retention_hours', '24', 'Hours of historical data to retain for averaging');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_live_latency_config_circuit_id ON live_latency_config(circuit_id);
CREATE INDEX IF NOT EXISTS idx_live_latency_config_enabled ON live_latency_config(enabled);
CREATE INDEX IF NOT EXISTS idx_live_latency_api_logs_circuit_id ON live_latency_api_logs(circuit_id);
CREATE INDEX IF NOT EXISTS idx_live_latency_api_logs_timestamp ON live_latency_api_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_live_latency_api_logs_config_id ON live_latency_api_logs(config_id);

-- Update the existing network_routes table to add status tracking
-- Note: This column may already exist, ALTER TABLE will fail gracefully if so

-- Add trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_live_latency_config_timestamp 
  AFTER UPDATE ON live_latency_config
  BEGIN
    UPDATE live_latency_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
