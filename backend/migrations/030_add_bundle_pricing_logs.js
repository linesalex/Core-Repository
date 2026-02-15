// Migration 030: Add bundle pricing logs table
// Tracks bundle-level pricing calculations with references to individual items

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 030: Add bundle pricing logs table...');

  db.serialize(() => {
    // Check if table already exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='extranet_bundle_logs'", [], (err, table) => {
      if (err) {
        console.error('Migration error:', err);
        return callback(err);
      }

      if (table) {
        console.log('✓ extranet_bundle_logs table already exists, skipping');
        addBundleIdColumn();
        return;
      }

      // Create bundle logs table
      db.run(`
        CREATE TABLE extranet_bundle_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          item_count INTEGER NOT NULL,
          contract_term INTEGER,
          currency TEXT DEFAULT 'USD',
          mrc_discount_percent REAL DEFAULT 0,
          nrc_discount_percent REAL DEFAULT 0,
          total_mrc REAL,
          total_nrc REAL,
          total_mrc_usd_before_discount REAL,
          total_nrc_usd_before_discount REAL,
          exchange_rate REAL DEFAULT 1,
          has_poa_items INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) {
          console.error('Failed to create extranet_bundle_logs table:', err);
          return callback(err);
        }
        console.log('✓ Created extranet_bundle_logs table');
        addBundleIdColumn();
      });
    });

    function addBundleIdColumn() {
      // Add bundle_id column to extranet_pricing_lookups to link individual items to bundles
      db.run(`ALTER TABLE extranet_pricing_lookups ADD COLUMN bundle_id INTEGER REFERENCES extranet_bundle_logs(id)`, (err) => {
        if (err) {
          if (err.message.includes('duplicate column name')) {
            console.log('✓ bundle_id column already exists on extranet_pricing_lookups');
          } else {
            console.error('Failed to add bundle_id column:', err);
            return callback(err);
          }
        } else {
          console.log('✓ Added bundle_id column to extranet_pricing_lookups');
        }

        // Add provider_name column if missing (for analytics tracking)
        db.run(`ALTER TABLE extranet_pricing_lookups ADD COLUMN provider_name TEXT`, (err) => {
          if (err) {
            if (err.message.includes('duplicate column name')) {
              console.log('✓ provider_name column already exists');
            } else {
              console.error('Failed to add provider_name column:', err);
              return callback(err);
            }
          } else {
            console.log('✓ Added provider_name column to extranet_pricing_lookups');
          }

          // Add product_name column if missing
          db.run(`ALTER TABLE extranet_pricing_lookups ADD COLUMN product_name TEXT`, (err) => {
            if (err) {
              if (err.message.includes('duplicate column name')) {
                console.log('✓ product_name column already exists');
              } else {
                console.error('Failed to add product_name column:', err);
                return callback(err);
              }
            } else {
              console.log('✓ Added product_name column to extranet_pricing_lookups');
            }

            // Add isf_code column if missing
            db.run(`ALTER TABLE extranet_pricing_lookups ADD COLUMN isf_code TEXT`, (err) => {
              if (err) {
                if (err.message.includes('duplicate column name')) {
                  console.log('✓ isf_code column already exists');
                } else {
                  console.error('Failed to add isf_code column:', err);
                  return callback(err);
                }
              } else {
                console.log('✓ Added isf_code column to extranet_pricing_lookups');
              }

              // Create indexes
              db.run(`CREATE INDEX IF NOT EXISTS idx_bundle_logs_user ON extranet_bundle_logs(user_id)`, (err) => {
                if (err) console.error('Warning: Failed to create bundle_logs user index:', err);
                
                db.run(`CREATE INDEX IF NOT EXISTS idx_bundle_logs_created ON extranet_bundle_logs(created_at)`, (err) => {
                  if (err) console.error('Warning: Failed to create bundle_logs created index:', err);
                  
                  db.run(`CREATE INDEX IF NOT EXISTS idx_lookups_bundle_id ON extranet_pricing_lookups(bundle_id)`, (err) => {
                    if (err) console.error('Warning: Failed to create lookups bundle_id index:', err);
                    
                    console.log('Migration 030 completed successfully');
                    callback(null);
                  });
                });
              });
            });
          });
        });
      });
    }
  });
}

module.exports = { runMigration };
