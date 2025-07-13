-- Network Inventory Database Schema for SQLite
-- Supports multiple repositories with circuit_id (UCN) format: 6 uppercase letters followed by 6 digits (e.g., LONLON123456)

-- Repository types table
CREATE TABLE IF NOT EXISTS repository_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default repository type
INSERT OR IGNORE INTO repository_types (name, description) VALUES ('Network Routes', 'Network Routes Repository');

-- Main network_routes table
CREATE TABLE network_routes (
    circuit_id TEXT PRIMARY KEY, -- UCN, format: 6 letters + 6 digits
    repository_type_id INTEGER DEFAULT 1,
    outage_tickets_last_30d INTEGER,
    maintenance_tickets_last_30d INTEGER,
    kmz_file_path TEXT,
    live_latency REAL, -- mocked
    expected_latency REAL,
    test_results_link TEXT,
    cable_system TEXT,
    is_special BOOLEAN,
    underlying_carrier TEXT,
    cost REAL, -- hidden
    currency TEXT, -- hidden
    location_a TEXT,
    location_b TEXT,
    bandwidth TEXT,
    more_details TEXT,
    test_results_file TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repository_type_id) REFERENCES repository_types(id)
);

-- Note: Enforce circuit_id format validation in application logic (backend/frontend) as SQLite does not support regex constraints natively. 

-- Enhanced dark fiber details table with DWDM UCN and reservations
CREATE TABLE IF NOT EXISTS dark_fiber_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    circuit_id TEXT NOT NULL,
    dwdm_wavelength TEXT,
    dwdm_ucn TEXT, -- New DWDM UCN field
    equipment TEXT,
    in_use BOOLEAN DEFAULT 0,
    is_reserved BOOLEAN DEFAULT 0,
    reserved_at DATETIME,
    reserved_by TEXT,
    reservation_expires_at DATETIME,
    capex_cost_to_light REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (circuit_id) REFERENCES network_routes(circuit_id) ON DELETE CASCADE
);

-- KMZ files table (unchanged)
CREATE TABLE IF NOT EXISTS kmz_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    circuit_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (circuit_id) REFERENCES network_routes(circuit_id) ON DELETE CASCADE
);

-- Enhanced test results files table for multiple file support
CREATE TABLE IF NOT EXISTS test_results_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    circuit_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (circuit_id) REFERENCES network_routes(circuit_id) ON DELETE CASCADE
);

-- Reservations log table for tracking reservation history
CREATE TABLE IF NOT EXISTS reservation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dark_fiber_id INTEGER NOT NULL,
    circuit_id TEXT NOT NULL,
    dwdm_ucn TEXT,
    action TEXT NOT NULL, -- 'RESERVED', 'RELEASED', 'EXPIRED'
    reserved_by TEXT,
    reservation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    expiry_date DATETIME,
    notes TEXT,
    FOREIGN KEY (dark_fiber_id) REFERENCES dark_fiber_details(id) ON DELETE CASCADE,
    FOREIGN KEY (circuit_id) REFERENCES network_routes(circuit_id) ON DELETE CASCADE
);

-- Trigger to automatically update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_network_routes_timestamp 
    AFTER UPDATE ON network_routes
    BEGIN
        UPDATE network_routes SET updated_at = CURRENT_TIMESTAMP WHERE circuit_id = NEW.circuit_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_dark_fiber_timestamp 
    AFTER UPDATE ON dark_fiber_details
    BEGIN
        UPDATE dark_fiber_details SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger to automatically expire reservations
CREATE TRIGGER IF NOT EXISTS expire_reservations 
    AFTER INSERT ON dark_fiber_details
    WHEN NEW.is_reserved = 1 AND NEW.reservation_expires_at < CURRENT_TIMESTAMP
    BEGIN
        UPDATE dark_fiber_details 
        SET is_reserved = 0, reserved_at = NULL, reserved_by = NULL, reservation_expires_at = NULL 
        WHERE id = NEW.id;
        
        INSERT INTO reservation_logs (dark_fiber_id, circuit_id, dwdm_ucn, action, reserved_by, expiry_date, notes)
        VALUES (NEW.id, NEW.circuit_id, NEW.dwdm_ucn, 'EXPIRED', NEW.reserved_by, NEW.reservation_expires_at, 'Automatically expired after 60 days');
    END; 