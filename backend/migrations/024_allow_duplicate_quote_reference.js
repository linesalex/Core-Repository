// Migration 024: Allow duplicate quote_reference values in carrier_quotes
// SQLite doesn't support ALTER TABLE to drop constraints, so we recreate the table

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 024: Allow duplicate quote_reference...');
  
  // Check if the UNIQUE constraint still exists by trying to read the schema
  db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='carrier_quotes'", [], (err, row) => {
    if (err) return callback(err);
    
    if (!row) {
      console.log('carrier_quotes table not found, skipping migration 024');
      return callback(null);
    }
    
    // Check if UNIQUE constraint is present
    if (!row.sql.includes('UNIQUE')) {
      console.log('✓ Migration 024: UNIQUE constraint already removed, skipping');
      return callback(null);
    }
    
    db.serialize(() => {
      // Step 1: Create new table without UNIQUE constraint on quote_reference
      db.run(`
        CREATE TABLE carrier_quotes_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quote_reference TEXT NOT NULL,
          carrier_id INTEGER,
          carrier_name TEXT NOT NULL,
          carrier_quote_ref TEXT,
          service_type TEXT NOT NULL,
          region TEXT NOT NULL,
          location_a_type TEXT DEFAULT 'pop',
          location_a_pop_code TEXT,
          location_a_custom_id INTEGER,
          location_b_type TEXT DEFAULT 'pop',
          location_b_pop_code TEXT,
          location_b_custom_id INTEGER,
          bandwidth_value REAL,
          bandwidth_unit TEXT NOT NULL,
          mrc REAL,
          nrc REAL,
          currency TEXT DEFAULT 'USD',
          contract_term INTEGER,
          expected_latency REAL,
          protection TEXT,
          cable_system TEXT,
          quote_date TEXT,
          expiry_date TEXT,
          transit_cities TEXT,
          transit_countries TEXT,
          route_distance_km REAL,
          kmz_file_path TEXT,
          notes TEXT,
          created_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_by INTEGER,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (location_a_custom_id) REFERENCES quote_custom_locations(id),
          FOREIGN KEY (location_b_custom_id) REFERENCES quote_custom_locations(id),
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `, (err) => {
        if (err) return callback(err);
        
        // Step 2: Copy all data
        db.run(`INSERT INTO carrier_quotes_new SELECT * FROM carrier_quotes`, (err) => {
          if (err) return callback(err);
          
          // Step 3: Drop old table
          db.run(`DROP TABLE carrier_quotes`, (err) => {
            if (err) return callback(err);
            
            // Step 4: Rename new table
            db.run(`ALTER TABLE carrier_quotes_new RENAME TO carrier_quotes`, (err) => {
              if (err) return callback(err);
              
              // Step 5: Recreate indexes
              const indexes = [
                'CREATE INDEX idx_carrier_quotes_region ON carrier_quotes(region)',
                'CREATE INDEX idx_carrier_quotes_service_type ON carrier_quotes(service_type)',
                'CREATE INDEX idx_carrier_quotes_quote_reference ON carrier_quotes(quote_reference)',
                'CREATE INDEX idx_carrier_quotes_location_a_pop ON carrier_quotes(location_a_pop_code)',
                'CREATE INDEX idx_carrier_quotes_location_b_pop ON carrier_quotes(location_b_pop_code)',
                'CREATE INDEX idx_carrier_quotes_carrier_name ON carrier_quotes(carrier_name)',
                'CREATE INDEX idx_carrier_quotes_quote_date ON carrier_quotes(quote_date)',
                'CREATE INDEX idx_carrier_quotes_created_at ON carrier_quotes(created_at)'
              ];
              
              let completed = 0;
              indexes.forEach(idx => {
                db.run(idx, (err) => {
                  if (err) console.warn('Index creation warning:', err.message);
                  completed++;
                  if (completed === indexes.length) {
                    console.log('✓ Migration 024 completed: quote_reference is no longer UNIQUE');
                    callback(null);
                  }
                });
              });
            });
          });
        });
      });
    });
  });
}

module.exports = { runMigration };
