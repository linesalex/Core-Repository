// Migration: Remove deprecated POP capability fields
// Removes: tdm_gateway, cnx_alpha, cnx_sdwan, transport_only_pop
// These fields are no longer needed for POP capabilities tracking

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Remove deprecated POP capability fields');
  
  // Check if pop_capabilities table exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='pop_capabilities'", [], (err, table) => {
    if (err) {
      console.error('Migration error: Failed to check for pop_capabilities table:', err);
      return callback(err);
    }
    
    if (!table) {
      console.log('✓ pop_capabilities table does not exist (nothing to migrate)');
      return callback(null);
    }
    
    // Check if any of the deprecated columns exist
    db.all("PRAGMA table_info(pop_capabilities)", [], (err, columns) => {
      if (err) {
        console.error('Migration error: Failed to check pop_capabilities table info:', err);
        return callback(err);
      }

      const columnNames = columns.map(col => col.name);
      const deprecatedColumns = ['tdm_gateway', 'cnx_alpha', 'cnx_sdwan', 'transport_only_pop'];
      const foundDeprecated = deprecatedColumns.filter(col => columnNames.includes(col));

      if (foundDeprecated.length === 0) {
        console.log('✓ Deprecated columns already removed');
        return callback(null);
      }

      console.log(`Found deprecated columns to remove: ${foundDeprecated.join(', ')}`);

      // SQLite doesn't support DROP COLUMN in older versions
      // We need to recreate the table without the deprecated columns
      const sql = `
        BEGIN TRANSACTION;

        -- Create new table without deprecated columns
        CREATE TABLE pop_capabilities_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          location_id INTEGER NOT NULL UNIQUE,
          cnx_extranet_wan INTEGER DEFAULT 0,
          cnx_ethernet INTEGER DEFAULT 0,
          cnx_voice INTEGER DEFAULT 0,
          cnx_unigy INTEGER DEFAULT 0,
          cnx_chrono INTEGER DEFAULT 0,
          csp_on_ramp INTEGER DEFAULT 0,
          exchange_on_ramp INTEGER DEFAULT 0,
          internet_on_ramp INTEGER DEFAULT 0,
          cnx_colocation INTEGER DEFAULT 0,
          exchange_pricing_in_region INTEGER DEFAULT 0,
          created_by INTEGER,
          updated_by INTEGER,
          FOREIGN KEY (location_id) REFERENCES location_reference(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        );

        -- Copy data from old table to new table (excluding deprecated columns)
        INSERT INTO pop_capabilities_new (
          id, location_id, cnx_extranet_wan, cnx_ethernet, cnx_voice,
          cnx_unigy, cnx_chrono, csp_on_ramp, exchange_on_ramp,
          internet_on_ramp, cnx_colocation, exchange_pricing_in_region,
          created_by, updated_by
        )
        SELECT 
          id, location_id, cnx_extranet_wan, cnx_ethernet, cnx_voice,
          cnx_unigy, cnx_chrono, csp_on_ramp, exchange_on_ramp,
          internet_on_ramp, cnx_colocation, exchange_pricing_in_region,
          created_by, updated_by
        FROM pop_capabilities;

        -- Drop old table
        DROP TABLE pop_capabilities;

        -- Rename new table to original name
        ALTER TABLE pop_capabilities_new RENAME TO pop_capabilities;

        COMMIT;
      `;

      db.exec(sql, (err) => {
        if (err) {
          console.error('Migration error: Failed to remove deprecated columns:', err);
          db.run('ROLLBACK', () => {
            return callback(err);
          });
          return;
        }
        
        console.log('✓ Removed deprecated columns from pop_capabilities table:');
        console.log('  - tdm_gateway');
        console.log('  - cnx_alpha');
        console.log('  - cnx_sdwan');
        console.log('  - transport_only_pop');
        console.log('✓ Migration completed successfully');
        callback(null);
      });
    });
  });
}

module.exports = { runMigration };

