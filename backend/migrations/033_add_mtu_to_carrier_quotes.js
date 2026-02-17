const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 033: Add MTU column to carrier_quotes...');

  // Check if column already exists
  db.all("PRAGMA table_info(carrier_quotes)", [], (err, columns) => {
    if (err) return callback(err);

    const hasMtu = columns.some(col => col.name === 'mtu');
    if (hasMtu) {
      console.log('✓ Migration 033: mtu column already exists, skipping');
      return callback(null);
    }

    db.run('ALTER TABLE carrier_quotes ADD COLUMN mtu INTEGER', (err) => {
      if (err) return callback(err);
      console.log('✓ Migration 033 completed: Added mtu column to carrier_quotes');
      callback(null);
    });
  });
}

module.exports = { runMigration };
