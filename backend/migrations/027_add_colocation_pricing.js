// Migration: Add colocation pricing configuration and quotes tables
// Supports per-location pricing config and quote generation

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add colocation pricing tables');
  
  db.serialize(() => {
    // Step 1: Create cnx_colocation_pricing_config table
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='cnx_colocation_pricing_config'", [], (err, table) => {
      if (err) {
        console.error('Migration error:', err);
        return callback(err);
      }
      
      if (table) {
        console.log('✓ cnx_colocation_pricing_config table already exists');
        proceedToQuotesTable();
        return;
      }
      
      const createConfigSQL = `
        CREATE TABLE cnx_colocation_pricing_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          location_id INTEGER NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          price_per_ru_month REAL NOT NULL DEFAULT 0,
          price_per_kw_month REAL NOT NULL DEFAULT 0,
          ru_per_kw_ratio REAL NOT NULL DEFAULT 4,
          tor_port_price_month REAL NOT NULL DEFAULT 0,
          premium_tor_port_price_month REAL NOT NULL DEFAULT 0,
          internet_access_price_month REAL NOT NULL DEFAULT 0,
          internet_access_bandwidth_mb INTEGER NOT NULL DEFAULT 10,
          setup_nrc REAL NOT NULL DEFAULT 0,
          cross_connect_nrc REAL NULL,
          cross_connect_mrc REAL NULL,
          discount_12_month REAL NOT NULL DEFAULT 0,
          discount_24_month REAL NOT NULL DEFAULT 5,
          discount_36_month REAL NOT NULL DEFAULT 10,
          notes TEXT NULL,
          updated_by INTEGER,
          updated_date TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (location_id) REFERENCES location_reference(id) ON DELETE CASCADE,
          FOREIGN KEY (updated_by) REFERENCES users(id),
          UNIQUE(location_id)
        )
      `;
      
      db.run(createConfigSQL, [], (err) => {
        if (err) {
          console.error('Migration error: Failed to create cnx_colocation_pricing_config:', err);
          return callback(err);
        }
        console.log('✓ cnx_colocation_pricing_config table created');
        proceedToQuotesTable();
      });
    });
    
    function proceedToQuotesTable() {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='cnx_colocation_quotes'", [], (err, table) => {
        if (err) {
          console.error('Migration error:', err);
          return callback(err);
        }
        
        if (table) {
          console.log('✓ cnx_colocation_quotes table already exists');
          return callback(null);
        }
        
        const createQuotesSQL = `
          CREATE TABLE cnx_colocation_quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quote_reference TEXT NOT NULL,
            location_id INTEGER NOT NULL,
            client_name TEXT NOT NULL,
            contact_name TEXT NULL,
            contact_email TEXT NULL,
            rack_type TEXT NOT NULL DEFAULT 'shared',
            ru_count INTEGER NOT NULL DEFAULT 0,
            power_kw REAL NOT NULL DEFAULT 0,
            tor_ports INTEGER NOT NULL DEFAULT 0,
            premium_tor_ports INTEGER NOT NULL DEFAULT 0,
            internet_access INTEGER NOT NULL DEFAULT 0,
            managed_cross_connects INTEGER NOT NULL DEFAULT 0,
            contract_term_months INTEGER NOT NULL DEFAULT 12,
            currency TEXT NOT NULL DEFAULT 'USD',
            mrc_total REAL NOT NULL DEFAULT 0,
            nrc_total REAL NOT NULL DEFAULT 0,
            pricing_breakdown TEXT NULL,
            notes TEXT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            created_by INTEGER,
            updated_by INTEGER,
            created_date TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_date TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (location_id) REFERENCES location_reference(id),
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (updated_by) REFERENCES users(id)
          )
        `;
        
        db.run(createQuotesSQL, [], (err) => {
          if (err) {
            console.error('Migration error: Failed to create cnx_colocation_quotes:', err);
            return callback(err);
          }
          console.log('✓ cnx_colocation_quotes table created');
          console.log('✓ Migration completed successfully');
          callback(null);
        });
      });
    }
  });
}

module.exports = { runMigration };
