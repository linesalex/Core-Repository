// Migration: Add customer owned cross connect flag to location_reference table
// Allows marking locations where customer must provide their own cross connects

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add customer owned cross connect flag');
  
  db.all("PRAGMA table_info(location_reference)", [], (err, columns) => {
    if (err) {
      console.error('Migration error: Failed to check location_reference table info:', err);
      return callback(err);
    }

    const columnNames = columns.map(col => col.name);

    if (columnNames.includes('customer_owned_xc')) {
      console.log('✓ customer_owned_xc column already exists');
      return callback(null);
    }

    const sql = "ALTER TABLE location_reference ADD COLUMN customer_owned_xc INTEGER DEFAULT 0";

    db.run(sql, [], (err) => {
      if (err) {
        console.error('Migration error: Failed to add customer_owned_xc column:', err);
        return callback(err);
      }
      console.log('✓ customer_owned_xc column added successfully');
      console.log('  - Default value: 0 (not customer owned)');
      console.log('  - Set to 1 to mark as customer-owned cross connect only');
      console.log('  - Mutually exclusive with cross_connect_mandatory');
      console.log('✓ Migration completed successfully');
      callback(null);
    });
  });
}

module.exports = { runMigration };

