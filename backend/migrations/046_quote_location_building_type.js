// Migration 046: Building type + structured address fields for quote custom locations,
// plus Nominatim geocode cache table

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 046: Quote location building type & geocode cache...');

  db.all('PRAGMA table_info(quote_custom_locations)', [], (err, columns) => {
    if (err) return callback(err);

    const existingCols = (columns || []).map(c => c.name);
    const newCols = [
      { name: 'building_type', type: 'TEXT' },
      { name: 'street_name', type: 'TEXT' },
      { name: 'street_number', type: 'TEXT' },
      { name: 'postal_code', type: 'TEXT' }
    ];

    const colsToAdd = newCols.filter(c => !existingCols.includes(c.name));

    const addColumns = (idx) => {
      if (idx >= colsToAdd.length) {
        createGeocodeCache();
        return;
      }
      const col = colsToAdd[idx];
      db.run(`ALTER TABLE quote_custom_locations ADD COLUMN ${col.name} ${col.type}`, (alterErr) => {
        if (alterErr) return callback(alterErr);
        console.log(`  Added column quote_custom_locations.${col.name}`);
        addColumns(idx + 1);
      });
    };

    const createGeocodeCache = () => {
      db.run(`
        CREATE TABLE IF NOT EXISTS quote_geocode_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query_hash TEXT NOT NULL UNIQUE,
          query_type TEXT NOT NULL,
          request_json TEXT,
          response_json TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `, (cacheErr) => {
        if (cacheErr) return callback(cacheErr);
        console.log('  Ensured quote_geocode_cache table exists');
        db.run(
          'CREATE INDEX IF NOT EXISTS idx_quote_geocode_cache_hash ON quote_geocode_cache(query_hash)',
          (idxErr) => {
            if (idxErr) return callback(idxErr);
            console.log('✓ Migration 046 completed');
            callback(null);
          }
        );
      });
    };

    if (colsToAdd.length === 0) {
      console.log('  quote_custom_locations columns already present');
      createGeocodeCache();
      return;
    }

    addColumns(0);
  });
}

module.exports = { runMigration };
