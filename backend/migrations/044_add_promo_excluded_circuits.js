const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add excluded_circuit_ids to promo_pricing_rules');

  // Check if column already exists
  db.all("PRAGMA table_info(promo_pricing_rules)", [], (err, columns) => {
    if (err) {
      console.error('Migration error: Failed to check promo_pricing_rules structure:', err);
      return callback(err);
    }

    // Check if excluded_circuit_ids column already exists
    const hasExcludedCircuits = columns.some(col => col.name === 'excluded_circuit_ids');

    if (hasExcludedCircuits) {
      console.log('✓ excluded_circuit_ids column already exists');
      return callback(null);
    }

    console.log('Adding excluded_circuit_ids column to promo_pricing_rules...');

    // Add the new column (TEXT, nullable - stores comma-separated circuit IDs)
    db.run(
      `ALTER TABLE promo_pricing_rules ADD COLUMN excluded_circuit_ids TEXT DEFAULT NULL`,
      [],
      (err) => {
        if (err) {
          // Check if error is because column already exists (race condition)
          if (err.message && err.message.includes('duplicate column name')) {
            console.log('✓ excluded_circuit_ids column already exists (concurrent migration)');
            return callback(null);
          }
          console.error('Migration error: Failed to add excluded_circuit_ids column:', err);
          return callback(err);
        }

        console.log('✓ excluded_circuit_ids column added successfully');
        console.log('✓ Migration completed successfully');
        callback(null);
      }
    );
  });
}

module.exports = { runMigration };
