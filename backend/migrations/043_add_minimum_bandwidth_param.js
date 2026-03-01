// Migration 043: Add minimum_bandwidth_mb parameter for Voice One Directory
// Adds a configurable minimum directory bandwidth floor

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 043: Add minimum_bandwidth_mb parameter...');

  db.run(
    'INSERT OR IGNORE INTO one_directory_parameters (param_key, param_value, param_type, description) VALUES (?, ?, ?, ?)',
    ['minimum_bandwidth_mb', '0', 'number', 'Minimum bandwidth (Mb) for the One Directory ISF regardless of calculated amount. 0 = disabled.'],
    function(err) {
      if (err) {
        console.error('Warning: Failed to insert minimum_bandwidth_mb:', err);
      } else if (this.changes > 0) {
        console.log('✓ Inserted minimum_bandwidth_mb parameter');
      } else {
        console.log('✓ minimum_bandwidth_mb parameter already exists');
      }
      console.log('Migration 043 completed successfully');
      callback(null);
    }
  );
}

module.exports = { runMigration };
