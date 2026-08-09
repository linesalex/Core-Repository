// Migration 050: Customer Routes submodule
//
// Adds `customer_routes` (Customer Service KMZ / Customer Aggregate KMZ
// database, one row per Circuit ID/UCN) and `customer_route_kmz_files`
// (append-only upload history so every KMZ file ever uploaded for a route
// stays downloadable with its upload date). Locations reuse the same
// POP (location_reference) / custom (quote_custom_locations) model as the
// Carrier Quote Repository.

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 050: Customer Routes submodule...');

  db.run(`
    CREATE TABLE IF NOT EXISTS customer_routes (
      circuit_id TEXT PRIMARY KEY,
      route_type TEXT NOT NULL CHECK (route_type IN ('Aggregate', 'Service')),
      customer_id INTEGER,
      customer_name TEXT NOT NULL,
      location_a_type TEXT NOT NULL DEFAULT 'pop' CHECK (location_a_type IN ('pop', 'custom')),
      location_a_pop_code TEXT,
      location_a_custom_id INTEGER,
      location_b_type TEXT NOT NULL DEFAULT 'pop' CHECK (location_b_type IN ('pop', 'custom')),
      location_b_pop_code TEXT,
      location_b_custom_id INTEGER,
      notes TEXT,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (location_a_custom_id) REFERENCES quote_custom_locations(id),
      FOREIGN KEY (location_b_custom_id) REFERENCES quote_custom_locations(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (updated_by) REFERENCES users(id)
    )
  `, (err) => {
    if (err) return callback(err);
    console.log('✓ Ensured customer_routes table exists');

    db.run(`
      CREATE TABLE IF NOT EXISTS customer_route_kmz_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        circuit_id TEXT NOT NULL,
        stored_filename TEXT NOT NULL,
        original_filename TEXT,
        uploaded_by INTEGER,
        uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (circuit_id) REFERENCES customer_routes(circuit_id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      )
    `, (err2) => {
      if (err2) return callback(err2);
      console.log('✓ Ensured customer_route_kmz_files table exists');

      db.run(
        'CREATE INDEX IF NOT EXISTS idx_customer_route_kmz_circuit ON customer_route_kmz_files(circuit_id)',
        (idxErr) => {
          if (idxErr) return callback(idxErr);
          console.log('✓ Migration 050 completed');
          callback(null);
        }
      );
    });
  });
}

module.exports = { runMigration };
