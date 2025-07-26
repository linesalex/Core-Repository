const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'network_routes.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Starting feed_type standardization migration...');

// Mapping from old database values to new frontend values
const feedTypeMapping = {
  'equities': 'Equities',
  'futures': 'Futures', 
  'options': 'Options',
  'treasuries': 'Fixed Income',
  'Forex': 'FX',
  'commodities': 'Commodities',
  'indices': 'Indices',
  'ETFs': 'ETFs',
  'crypto': 'Alternative Data',
  'mutual funds': 'Reference Data'
};

db.serialize(() => {
  console.log('📊 Checking current feed_type values...');
  
  // First, check if the table exists
  db.all('SELECT name FROM sqlite_master WHERE type="table" AND name="exchange_feeds"', [], (err, tables) => {
    if (err) {
      console.error('❌ Error checking for table:', err.message);
      return;
    }
    
    if (tables.length === 0) {
      console.log('ℹ️  exchange_feeds table does not exist yet. This migration is only needed if you have exchange feeds data.');
      console.log('🎯 Run this script after creating exchange feeds to standardize the feed_type values.');
      db.close();
      return;
    }
    
    // Now check what values we currently have
    db.all('SELECT DISTINCT feed_type, COUNT(*) as count FROM exchange_feeds GROUP BY feed_type ORDER BY feed_type', [], (err, rows) => {
      if (err) {
        console.error('❌ Error checking current values:', err.message);
        return;
      }
    
    console.log('Current feed_type values in database:');
    rows.forEach(row => {
      console.log(`  - "${row.feed_type}": ${row.count} records`);
    });
    
    console.log('\n🔄 Starting migration...');
    
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('❌ Error starting transaction:', err.message);
        return;
      }
      
      // Update existing data to use new values
      let updatePromises = [];
      Object.keys(feedTypeMapping).forEach(oldValue => {
        const newValue = feedTypeMapping[oldValue];
        updatePromises.push(new Promise((resolve, reject) => {
          db.run(
            'UPDATE exchange_feeds SET feed_type = ? WHERE feed_type = ?',
            [newValue, oldValue],
            function(err) {
              if (err) {
                console.error(`❌ Error updating ${oldValue} to ${newValue}:`, err.message);
                reject(err);
              } else {
                if (this.changes > 0) {
                  console.log(`✅ Updated ${this.changes} records from "${oldValue}" to "${newValue}"`);
                }
                resolve();
              }
            }
          );
        }));
      });
      
      Promise.all(updatePromises)
        .then(() => {
          console.log('\n🔄 Creating new table with updated constraints...');
          
          // Create new table with updated constraints
          db.run(`
            CREATE TABLE exchange_feeds_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              exchange_id INTEGER NOT NULL,
              feed_name TEXT NOT NULL,
              feed_delivery TEXT DEFAULT 'Unicast' CHECK(feed_delivery IN ('Unicast', 'Multicast')),
              feed_type TEXT DEFAULT 'Equities' CHECK(feed_type IN ('Equities', 'Futures', 'Options', 'Fixed Income', 'FX', 'Commodities', 'Indices', 'ETFs', 'Alternative Data', 'Reference Data', 'Mixed')),
              isf_enabled INTEGER DEFAULT 0,
              isf_a TEXT,
              isf_b TEXT,
              isf_site_code_a TEXT,
              isf_site_code_b TEXT,
              isf_dr_a TEXT,
              isf_dr_b TEXT,
              isf_dr_site_code_a TEXT,
              isf_dr_site_code_b TEXT,
              dr_type TEXT,
              order_entry_isf TEXT,
              dr_order_entry_isf TEXT,
              unicast_isf TEXT,
              dr_available INTEGER DEFAULT 0,
              bandwidth_1ms TEXT,
              available_now INTEGER DEFAULT 0,
              quick_quote INTEGER DEFAULT 0,
              pass_through_fees REAL DEFAULT 0,
              pass_through_currency TEXT DEFAULT 'USD',
              pass_through_fees_info TEXT,
              design_file_path TEXT,
              more_info TEXT,
              quick_quote_min_cost REAL,
              order_entry_cost REAL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              created_by INTEGER,
              updated_by INTEGER,
              FOREIGN KEY (exchange_id) REFERENCES exchanges(id) ON DELETE CASCADE,
              FOREIGN KEY (created_by) REFERENCES users(id),
              FOREIGN KEY (updated_by) REFERENCES users(id)
            )
          `, (err) => {
            if (err) {
              console.error('❌ Error creating new table:', err.message);
              db.run('ROLLBACK');
              return;
            }
            
            console.log('✅ New table created successfully');
            
            // Copy all data from old table to new table
            db.run(`
              INSERT INTO exchange_feeds_new 
              SELECT * FROM exchange_feeds
            `, (err) => {
              if (err) {
                console.error('❌ Error copying data:', err.message);
                db.run('ROLLBACK');
                return;
              }
              
              console.log('✅ Data copied to new table');
              
              // Drop old table and rename new one
              db.run('DROP TABLE exchange_feeds', (err) => {
                if (err) {
                  console.error('❌ Error dropping old table:', err.message);
                  db.run('ROLLBACK');
                  return;
                }
                
                db.run('ALTER TABLE exchange_feeds_new RENAME TO exchange_feeds', (err) => {
                  if (err) {
                    console.error('❌ Error renaming table:', err.message);
                    db.run('ROLLBACK');
                    return;
                  }
                  
                  console.log('✅ Table renamed successfully');
                  
                  // Recreate update trigger
                  db.run(`
                    CREATE TRIGGER IF NOT EXISTS update_exchange_feeds_timestamp 
                    AFTER UPDATE ON exchange_feeds
                    BEGIN
                      UPDATE exchange_feeds SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                    END
                  `, (err) => {
                    if (err) {
                      console.error('❌ Error creating trigger:', err.message);
                      db.run('ROLLBACK');
                      return;
                    }
                    
                    console.log('✅ Update trigger recreated');
                    
                    // Commit transaction
                    db.run('COMMIT', (err) => {
                      if (err) {
                        console.error('❌ Error committing transaction:', err.message);
                        return;
                      }
                      
                      console.log('\n🎉 Migration completed successfully!');
                      
                      // Verify the changes
                      db.all('SELECT DISTINCT feed_type, COUNT(*) as count FROM exchange_feeds GROUP BY feed_type ORDER BY feed_type', [], (err, rows) => {
                        if (err) {
                          console.error('❌ Error verifying changes:', err.message);
                        } else {
                          console.log('\n📊 Final feed_type values in database:');
                          rows.forEach(row => {
                            console.log(`  - "${row.feed_type}": ${row.count} records`);
                          });
                        }
                        
                        db.close((err) => {
                          if (err) {
                            console.error('❌ Error closing database:', err.message);
                          } else {
                            console.log('\n✅ Database connection closed');
                            console.log('🎯 You can now run this same script on your test server!');
                          }
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        })
        .catch((err) => {
          console.error('❌ Error during data updates:', err);
          db.run('ROLLBACK');
          });
      });
    });
  });
}); 