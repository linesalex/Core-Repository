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
    name: 'Create Pricing Logic Configuration Table',
    sql: `
      -- Create table for storing dynamic pricing logic configuration
      CREATE TABLE IF NOT EXISTS pricing_logic_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key TEXT NOT NULL UNIQUE,
        config_value TEXT NOT NULL,
        updated_by INTEGER NOT NULL,
        updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id)
      );
      
      -- Insert default pricing logic configuration
      INSERT OR IGNORE INTO pricing_logic_config (config_key, config_value, updated_by) VALUES
      ('contractTerms.12.minMargin', '40', 1),
      ('contractTerms.12.suggestedMargin', '60', 1),
      ('contractTerms.12.nrcCharge', '1000', 1),
      ('contractTerms.24.minMargin', '37.5', 1),
      ('contractTerms.24.suggestedMargin', '55', 1),
      ('contractTerms.24.nrcCharge', '500', 1),
      ('contractTerms.36.minMargin', '35', 1),
      ('contractTerms.36.suggestedMargin', '50', 1),
      ('contractTerms.36.nrcCharge', '0', 1),
      ('charges.ullPremiumPercent', '15', 1),
      ('charges.protectionPathMultiplier', '0.7', 1),
      ('utilizationFactors.primary', '0.9', 1),
      ('utilizationFactors.protection', '1.0', 1);
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
  },
  {
    name: 'Create Exchange Data Tables',
    sql: `
      -- Create exchanges table for main exchange information
      CREATE TABLE IF NOT EXISTS exchanges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exchange_name TEXT NOT NULL,
        region TEXT NOT NULL, -- 'AMERs', 'APAC', 'EMEA'
        available BOOLEAN DEFAULT 1, -- YES/NO
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id),
        UNIQUE(exchange_name, region) -- Allow same exchange in different regions
      );
      
      -- Create exchange_feeds table for individual feed details
      CREATE TABLE IF NOT EXISTS exchange_feeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exchange_id INTEGER NOT NULL,
        feed_name TEXT NOT NULL,
        isf_a TEXT,
        isf_b TEXT,
        dr_available BOOLEAN DEFAULT 0,
        bandwidth_1ms TEXT,
        available_now BOOLEAN DEFAULT 0,
        quick_quote BOOLEAN DEFAULT 0,
        pass_through_fees INTEGER DEFAULT 0, -- Amount in base currency units
        pass_through_currency TEXT DEFAULT 'USD',
        design_file_path TEXT, -- PDF file path
        more_info TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_by INTEGER,
        FOREIGN KEY (exchange_id) REFERENCES exchanges(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id)
      );
      
      -- Create exchange_contacts table for exchange contact information
      CREATE TABLE IF NOT EXISTS exchange_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exchange_id INTEGER NOT NULL,
        contact_name TEXT NOT NULL,
        job_title TEXT,
        country TEXT,
        phone_number TEXT,
        email TEXT,
        contact_type TEXT, -- Free text field
        daily_contact BOOLEAN DEFAULT 0,
        more_info TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_by INTEGER,
        FOREIGN KEY (exchange_id) REFERENCES exchanges(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id)
      );
      
      -- Create exchange_files table for PDF design files
      CREATE TABLE IF NOT EXISTS exchange_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exchange_feed_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_size INTEGER,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exchange_feed_id) REFERENCES exchange_feeds(id) ON DELETE CASCADE
      );
      
      -- Create triggers for timestamp updates
      CREATE TRIGGER IF NOT EXISTS update_exchanges_timestamp 
      AFTER UPDATE ON exchanges
      BEGIN
        UPDATE exchanges SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
      
      CREATE TRIGGER IF NOT EXISTS update_exchange_feeds_timestamp 
      AFTER UPDATE ON exchange_feeds
      BEGIN
        UPDATE exchange_feeds SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
      
      CREATE TRIGGER IF NOT EXISTS update_exchange_contacts_timestamp 
      AFTER UPDATE ON exchange_contacts
      BEGIN
        UPDATE exchange_contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `
  },
  {
    name: 'Add Exchange Data Permissions',
    sql: `
      -- Administrator permissions for exchange data
      INSERT OR IGNORE INTO role_permissions (role_name, module_name, can_view, can_create, can_edit, can_delete) VALUES
      ('administrator', 'exchange_data', 1, 1, 1, 1);
      
      -- Provisioner permissions (can only manage feeds and contacts, not exchanges)
      INSERT OR IGNORE INTO role_permissions (role_name, module_name, can_view, can_create, can_edit, can_delete) VALUES
      ('provisioner', 'exchange_data', 1, 0, 1, 0);
      
      -- Read-only permissions
      INSERT OR IGNORE INTO role_permissions (role_name, module_name, can_view, can_create, can_edit, can_delete) VALUES
      ('read_only', 'exchange_data', 1, 0, 0, 0);
    `
  },
  {
    name: 'Create User Module Visibility Table',
    sql: `
      CREATE TABLE IF NOT EXISTS user_module_visibility (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        module_name TEXT NOT NULL,
        is_visible BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_by INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id),
        UNIQUE(user_id, module_name)
      );
    `
  },
  {
    name: 'Add Feed Delivery and Feed Type to Exchange Feeds',
    sql: `
      -- Add Feed Delivery field (Unicast or Multicast)
      ALTER TABLE exchange_feeds ADD COLUMN feed_delivery TEXT DEFAULT 'Unicast' CHECK(feed_delivery IN ('Unicast', 'Multicast'));
      
      -- Add Feed Type field with multiple options
      ALTER TABLE exchange_feeds ADD COLUMN feed_type TEXT DEFAULT 'equities' CHECK(feed_type IN ('equities', 'futures', 'options', 'ETFs', 'indices', 'crypto', 'commodities', 'Forex', 'mutual funds', 'treasuries'));
    `
  },
  {
    name: 'Add Pass Through Fees Info to Exchange Feeds',
    sql: `
      -- Add Pass Through Fees Info field for additional fee details
      ALTER TABLE exchange_feeds ADD COLUMN pass_through_fees_info TEXT;
    `
  },
  {
    name: 'Add Last Updated Tracking to Carrier Contacts',
    sql: `
      -- Add last_updated field to track yearly contact updates
      ALTER TABLE carrier_contacts ADD COLUMN last_updated DATETIME DEFAULT CURRENT_TIMESTAMP;
      
      -- Add needs_yearly_update computed status (will be calculated in application)
      -- Add approval tracking
      ALTER TABLE carrier_contacts ADD COLUMN approved_by INTEGER;
      ALTER TABLE carrier_contacts ADD COLUMN approved_at DATETIME;
      
      -- Add foreign key for approved_by (enforced in application logic for SQLite)
      -- FOREIGN KEY (approved_by) REFERENCES users(id)
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