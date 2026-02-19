// Migration 037: Add customer_name column to bundle logs tables
// Adds customer_name to both extranet_bundle_pricing_logs and one_directory_bundle_logs

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 037: Add customer_name to bundle logs tables...');

  // Add to extranet bundle logs
  db.run(`ALTER TABLE extranet_bundle_pricing_logs ADD COLUMN customer_name TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Warning: Could not add customer_name to extranet_bundle_pricing_logs:', err.message);
    } else {
      console.log('✓ Added customer_name to extranet_bundle_pricing_logs');
    }

    // Add to one directory bundle logs
    db.run(`ALTER TABLE one_directory_bundle_logs ADD COLUMN customer_name TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Warning: Could not add customer_name to one_directory_bundle_logs:', err.message);
      } else {
        console.log('✓ Added customer_name to one_directory_bundle_logs');
      }

      // Add to one directory pricing logs (individual items)
      db.run(`ALTER TABLE one_directory_pricing_logs ADD COLUMN customer_name TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('Warning: Could not add customer_name to one_directory_pricing_logs:', err.message);
        } else {
          console.log('✓ Added customer_name to one_directory_pricing_logs');
        }

        console.log('Migration 037 completed successfully');
        callback(null);
      });
    });
  });
}

module.exports = { runMigration };
