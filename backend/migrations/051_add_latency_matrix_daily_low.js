// Migration 051: 30-Day Low Latency Matrix
//
// Adds `latency_matrix_daily_low`, which tracks - per calendar day (UTC) and
// per source/destination POP pair - the lowest 1Gb-tier latency observed
// across that day's hourly latency_matrix_cache computations. Rows are
// upserted with a MIN() on every hourly computeMatrix() run, so once a day's
// UTC date rolls over its row is naturally frozen at that day's true low.
// Rows older than 30 days are pruned by latencyMatrixService, so this table
// always holds a rolling ~30-day window used to compute the "lowest latency
// available within the last 30 days" shown on the Home page's 30-Day Low tab
// and its PDF export.

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 051: Add latency_matrix_daily_low table...');

  db.run(`CREATE TABLE IF NOT EXISTS latency_matrix_daily_low (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_date TEXT NOT NULL,
    source_pop TEXT NOT NULL,
    destination_pop TEXT NOT NULL,
    source_city TEXT NOT NULL,
    destination_city TEXT NOT NULL,
    lowest_latency_1g REAL NOT NULL,
    last_updated TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(record_date, source_pop, destination_pop)
  )`, (err) => {
    if (err) {
      console.error('Failed to create latency_matrix_daily_low:', err.message);
      return callback(err);
    }
    console.log('✓ Created latency_matrix_daily_low table');

    db.run(`CREATE INDEX IF NOT EXISTS idx_matrix_daily_low_pair_date 
            ON latency_matrix_daily_low(source_pop, destination_pop, record_date)`, (idxErr) => {
      if (idxErr) {
        console.error('Warning: Could not create index:', idxErr.message);
      } else {
        console.log('✓ Created index on latency_matrix_daily_low');
      }

      console.log('Migration 051 completed successfully');
      callback(null);
    });
  });
}

module.exports = { runMigration };
