// Migration: Add mandatory cross connect flag to location_reference table
// Allows enforcing cross connects in Design Tool for specific locations

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add mandatory cross connect flag');
  
  db.all("PRAGMA table_info(location_reference)", [], (err, columns) => {
    if (err) {
      console.error('Migration error: Failed to check location_reference table info:', err);
      return callback(err);
    }

    const columnNames = columns.map(col => col.name);

    if (columnNames.includes('cross_connect_mandatory')) {
      console.log('✓ cross_connect_mandatory column already exists');
      return callback(null);
    }

    const sql = "ALTER TABLE location_reference ADD COLUMN cross_connect_mandatory INTEGER DEFAULT 0";

    db.run(sql, [], (err) => {
      if (err) {
        console.error('Migration error: Failed to add cross_connect_mandatory column:', err);
        return callback(err);
      }
      console.log('✓ cross_connect_mandatory column added successfully');
      console.log('  - Default value: 0 (not mandatory)');
      console.log('  - Set to 1 to enforce cross connect in Design Tool');
      console.log('✓ Migration completed successfully');
      callback(null);
    });
  });
}

module.exports = { runMigration };

