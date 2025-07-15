const fs = require('fs');
const path = require('path');
const db = require('./db');

console.log('🚀 Starting Network Inventory Database Migration...');

const migrations = [
  {
    name: 'Create Users Table',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT UNIQUE,
        full_name TEXT,
        user_role TEXT NOT NULL DEFAULT 'read_only', -- 'administrator', 'provisioner', 'read_only'
        status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      );
    `
  },
  {
    name: 'Create Role Permissions Table',
    sql: `
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_name TEXT NOT NULL,
        module_name TEXT NOT NULL,
        can_view BOOLEAN DEFAULT 0,
        can_create BOOLEAN DEFAULT 0,
        can_edit BOOLEAN DEFAULT 0,
        can_delete BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role_name, module_name)
      );
    `
  },
  {
    name: 'Create Change Logs Table',
    sql: `
      CREATE TABLE IF NOT EXISTS change_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
        old_values TEXT, -- JSON of old values
        new_values TEXT, -- JSON of new values
        changes_summary TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `
  },
  {
    name: 'Create Carriers Table',
    sql: `
      CREATE TABLE IF NOT EXISTS carriers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        carrier_name TEXT UNIQUE NOT NULL,
        previously_known_as TEXT,
        status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive'
        region TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id)
      );
    `
  },
  {
    name: 'Update Location Reference Table',
    sql: `
      -- Add new columns to location_reference table
      ALTER TABLE location_reference ADD COLUMN provider TEXT;
      ALTER TABLE location_reference ADD COLUMN access_info TEXT;
      ALTER TABLE location_reference ADD COLUMN created_by INTEGER;
      ALTER TABLE location_reference ADD COLUMN updated_by INTEGER;
      
      -- Add foreign key constraints (will be enforced in application logic for SQLite)
      -- FOREIGN KEY (created_by) REFERENCES users(id)
      -- FOREIGN KEY (updated_by) REFERENCES users(id)
    `
  },
  {
    name: 'Create POP Capabilities Table',
    sql: `
      CREATE TABLE IF NOT EXISTS pop_capabilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location_id INTEGER NOT NULL,
        cnx_extranet_wan BOOLEAN DEFAULT 0,
        cnx_ethernet BOOLEAN DEFAULT 0,
        cnx_voice BOOLEAN DEFAULT 0,
        tdm_gateway BOOLEAN DEFAULT 0,
        cnx_unigy BOOLEAN DEFAULT 0,
        cnx_alpha BOOLEAN DEFAULT 0,
        cnx_chrono BOOLEAN DEFAULT 0,
        cnx_sdwan BOOLEAN DEFAULT 0,
        csp_on_ramp BOOLEAN DEFAULT 0,
        exchange_on_ramp BOOLEAN DEFAULT 0,
        internet_on_ramp BOOLEAN DEFAULT 0,
        transport_only_pop BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_by INTEGER,
        FOREIGN KEY (location_id) REFERENCES location_reference(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id)
      );
    `
  },
  {
    name: 'Add User Tracking to Network Routes',
    sql: `
      -- Add user tracking columns to network_routes
      ALTER TABLE network_routes ADD COLUMN created_by INTEGER;
      ALTER TABLE network_routes ADD COLUMN updated_by INTEGER;
      
      -- Add foreign key constraints (will be enforced in application logic for SQLite)
      -- FOREIGN KEY (created_by) REFERENCES users(id)
      -- FOREIGN KEY (updated_by) REFERENCES users(id)
    `
  },
  {
    name: 'Add User Tracking to Dark Fiber Details',
    sql: `
      -- Add user tracking columns to dark_fiber_details
      ALTER TABLE dark_fiber_details ADD COLUMN created_by INTEGER;
      ALTER TABLE dark_fiber_details ADD COLUMN updated_by INTEGER;
      
      -- Add foreign key constraints (will be enforced in application logic for SQLite)
      -- FOREIGN KEY (created_by) REFERENCES users(id)
      -- FOREIGN KEY (updated_by) REFERENCES users(id)
    `
  },
  {
    name: 'Insert Default Admin User',
    sql: `
      INSERT OR IGNORE INTO users (username, password_hash, email, full_name, user_role, status)
      VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMye9gUYQNpjpgfcnUFbOXQqJdHYcVgJXZK', 'admin@company.com', 'System Administrator', 'administrator', 'active');
      -- Default password is 'admin123' - should be changed on first login
    `
  },
  {
    name: 'Insert Default Role Permissions',
    sql: `
      -- Administrator permissions (full access)
      INSERT OR IGNORE INTO role_permissions (role_name, module_name, can_view, can_create, can_edit, can_delete) VALUES
      ('administrator', 'network_routes', 1, 1, 1, 1),
      ('administrator', 'carriers', 1, 1, 1, 1),
      ('administrator', 'locations', 1, 1, 1, 1),
      ('administrator', 'network_design', 1, 1, 1, 1),
      ('administrator', 'exchange_rates', 1, 1, 1, 1),
      ('administrator', 'change_logs', 1, 0, 0, 0),
      ('administrator', 'user_management', 1, 1, 1, 1);
      
      -- Provisioner permissions (create/edit data)
      INSERT OR IGNORE INTO role_permissions (role_name, module_name, can_view, can_create, can_edit, can_delete) VALUES
      ('provisioner', 'network_routes', 1, 1, 1, 0),
      ('provisioner', 'carriers', 1, 1, 1, 0),
      ('provisioner', 'locations', 1, 1, 1, 0),
      ('provisioner', 'network_design', 1, 1, 1, 0),
      ('provisioner', 'exchange_rates', 1, 0, 0, 0),
      ('provisioner', 'change_logs', 1, 0, 0, 0),
      ('provisioner', 'user_management', 0, 0, 0, 0);
      
      -- Read-only permissions
      INSERT OR IGNORE INTO role_permissions (role_name, module_name, can_view, can_create, can_edit, can_delete) VALUES
      ('read_only', 'network_routes', 1, 0, 0, 0),
      ('read_only', 'carriers', 1, 0, 0, 0),
      ('read_only', 'locations', 1, 0, 0, 0),
      ('read_only', 'network_design', 1, 1, 1, 0),
      ('read_only', 'exchange_rates', 1, 0, 0, 0),
      ('read_only', 'change_logs', 0, 0, 0, 0),
      ('read_only', 'user_management', 0, 0, 0, 0);
    `
  },
  {
    name: 'Insert Sample Carriers Data',
    sql: `
      INSERT OR IGNORE INTO carriers (carrier_name, previously_known_as, status, region) VALUES
      ('Verizon', 'MCI', 'active', 'North America'),
      ('AT&T', 'SBC Communications', 'active', 'North America'),
      ('BT', 'British Telecom', 'active', 'Europe'),
      ('Orange', 'France Telecom', 'active', 'Europe'),
      ('NTT', 'Nippon Telegraph and Telephone', 'active', 'Asia Pacific'),
      ('Singtel', 'Singapore Telecom', 'active', 'Asia Pacific'),
      ('Telstra', NULL, 'active', 'Asia Pacific'),
      ('Deutsche Telekom', NULL, 'active', 'Europe'),
      ('Vodafone', NULL, 'active', 'Global'),
      ('PCCW', NULL, 'active', 'Asia Pacific');
    `
  },
  {
    name: 'Create Update Triggers for User Tracking',
    sql: `
      -- Update trigger for users table
      CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
      AFTER UPDATE ON users
      BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
      
      -- Update trigger for carriers table
      CREATE TRIGGER IF NOT EXISTS update_carriers_timestamp 
      AFTER UPDATE ON carriers
      BEGIN
        UPDATE carriers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
      
      -- Update trigger for location_reference table
      CREATE TRIGGER IF NOT EXISTS update_location_reference_timestamp 
      AFTER UPDATE ON location_reference
      BEGIN
        UPDATE location_reference SET updated_date = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
      
      -- Update trigger for pop_capabilities table
      CREATE TRIGGER IF NOT EXISTS update_pop_capabilities_timestamp 
      AFTER UPDATE ON pop_capabilities
      BEGIN
        UPDATE pop_capabilities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `
  },
  {
    name: 'Add Minimum Pricing to Location Reference',
    sql: `
      -- Add minimum pricing columns to location_reference table
      ALTER TABLE location_reference ADD COLUMN min_price_under_100mb DECIMAL DEFAULT 0;
      ALTER TABLE location_reference ADD COLUMN min_price_100_to_999mb DECIMAL DEFAULT 0;
      ALTER TABLE location_reference ADD COLUMN min_price_1000_to_2999mb DECIMAL DEFAULT 0;
      ALTER TABLE location_reference ADD COLUMN min_price_3000mb_plus DECIMAL DEFAULT 0;
    `
  },
  {
    name: 'Fix Carriers Unique Constraint for Regional Duplicates',
    sql: `
      -- Create new carriers table with proper constraints
      CREATE TABLE IF NOT EXISTS carriers_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        carrier_name TEXT NOT NULL,
        previously_known_as TEXT,
        status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive'
        region TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id),
        UNIQUE(carrier_name, region) -- Allow same carrier in different regions
      );
      
      -- Copy data from old table
      INSERT INTO carriers_new (id, carrier_name, previously_known_as, status, region, created_at, updated_at, created_by, updated_by)
      SELECT id, carrier_name, previously_known_as, status, region, created_at, updated_at, created_by, updated_by
      FROM carriers;
      
      -- Drop old table and rename new one
      DROP TABLE carriers;
      ALTER TABLE carriers_new RENAME TO carriers;
      
      -- Recreate the update trigger
      CREATE TRIGGER IF NOT EXISTS update_carriers_timestamp 
      AFTER UPDATE ON carriers
      BEGIN
        UPDATE carriers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `
  }
];

// Function to run migrations
function runMigrations() {
  return new Promise((resolve, reject) => {
    let completedMigrations = 0;
    
    function runNextMigration() {
      if (completedMigrations >= migrations.length) {
        console.log('✅ All migrations completed successfully!');
        console.log('📊 Migration Summary:');
        console.log('   - User management system created');
        console.log('   - Change logging system implemented');
        console.log('   - Carriers database created with sample data');
        console.log('   - Location management updated with new fields');
        console.log('   - POP capabilities system added');
        console.log('   - Default admin user created (username: admin, password: admin123)');
        console.log('⚠️  IMPORTANT: Change the default admin password on first login!');
        resolve();
        return;
      }
      
      const migration = migrations[completedMigrations];
      console.log(`🔄 Running migration: ${migration.name}`);
      
      db.exec(migration.sql, (err) => {
        if (err) {
          console.error(`❌ Migration failed: ${migration.name}`);
          console.error(err.message);
          reject(err);
          return;
        }
        
        console.log(`✅ Migration completed: ${migration.name}`);
        completedMigrations++;
        runNextMigration();
      });
    }
    
    runNextMigration();
  });
}

// Run the migration
runMigrations()
  .then(() => {
    console.log('🎉 Database migration completed successfully!');
    db.close();
  })
  .catch((err) => {
    console.error('💥 Migration failed:', err);
    db.close();
    process.exit(1);
  }); 