// Migration 036: Add customer_name to extranet_bundle_logs and extranet_pricing_lookups
// Allows tracking which customer a pricing quote is for

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 036: Add customer_name columns...');

  // Add customer_name to extranet_bundle_logs
  db.run('ALTER TABLE extranet_bundle_logs ADD COLUMN customer_name TEXT', (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ customer_name column already exists in extranet_bundle_logs');
      } else {
        console.error('Failed to add customer_name to extranet_bundle_logs:', err);
        return callback(err);
      }
    } else {
      console.log('✓ Added customer_name column to extranet_bundle_logs');
    }

    // Add customer_name to extranet_pricing_lookups
    db.run('ALTER TABLE extranet_pricing_lookups ADD COLUMN customer_name TEXT', (err2) => {
      if (err2) {
        if (err2.message.includes('duplicate column name')) {
          console.log('✓ customer_name column already exists in extranet_pricing_lookups');
        } else {
          console.error('Failed to add customer_name to extranet_pricing_lookups:', err2);
          return callback(err2);
        }
      } else {
        console.log('✓ Added customer_name column to extranet_pricing_lookups');
      }

      console.log('Migration 036 completed successfully');
      callback(null);
    });
  });
}

module.exports = { runMigration };
