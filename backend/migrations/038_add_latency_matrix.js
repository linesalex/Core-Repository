// Migration 038: Add latency matrix tables
// Creates tables for configurable city/POP locations and cached matrix results

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 038: Add latency matrix tables...');

  db.run(`CREATE TABLE IF NOT EXISTS latency_matrix_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city_name TEXT NOT NULL UNIQUE,
    pop_code TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Failed to create latency_matrix_locations:', err.message);
      return callback(err);
    }
    console.log('✓ Created latency_matrix_locations table');

    db.run(`CREATE TABLE IF NOT EXISTS latency_matrix_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_city TEXT NOT NULL,
      source_pop TEXT NOT NULL,
      destination_city TEXT NOT NULL,
      destination_pop TEXT NOT NULL,
      latency_1g REAL,
      latency_10g REAL,
      route_1g TEXT,
      route_10g TEXT,
      last_computed TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source_pop, destination_pop)
    )`, (err) => {
      if (err) {
        console.error('Failed to create latency_matrix_cache:', err.message);
        return callback(err);
      }
      console.log('✓ Created latency_matrix_cache table');

      db.run(`CREATE INDEX IF NOT EXISTS idx_matrix_cache_lookup 
              ON latency_matrix_cache(source_pop, destination_pop)`, (err) => {
        if (err) {
          console.error('Warning: Could not create index:', err.message);
        } else {
          console.log('✓ Created index on latency_matrix_cache');
        }

        console.log('Migration 038 completed successfully');
        callback(null);
      });
    });
  });
}

module.exports = { runMigration };
