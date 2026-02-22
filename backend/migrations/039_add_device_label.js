// Migration 039: Add device_label column to cnx_rack_devices

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 039: Add device_label column...');

  db.run(`ALTER TABLE cnx_rack_devices ADD COLUMN device_label TEXT`, (err) => {
    if (err) {
      if (err.message && err.message.includes('duplicate column')) {
        console.log('✓ device_label column already exists, skipping');
      } else {
        console.error('Failed to add device_label column:', err.message);
        return callback(err);
      }
    } else {
      console.log('✓ Added device_label column to cnx_rack_devices');
    }

    console.log('Migration 039 completed successfully');
    callback(null);
  });
}

module.exports = { runMigration };
