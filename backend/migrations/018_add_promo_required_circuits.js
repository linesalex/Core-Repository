const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add required_circuit_ids to promo_pricing_rules');

  // Check if column already exists
  db.all("PRAGMA table_info(promo_pricing_rules)", [], (err, columns) => {
    if (err) {
      console.error('Migration error: Failed to check promo_pricing_rules structure:', err);
      return callback(err);
    }

    // Check if required_circuit_ids column already exists
    const hasRequiredCircuits = columns.some(col => col.name === 'required_circuit_ids');
    
    if (hasRequiredCircuits) {
      console.log('✓ required_circuit_ids column already exists');
      return callback(null);
    }

    console.log('Adding required_circuit_ids column to promo_pricing_rules...');

    // Add the new column (TEXT, nullable - stores comma-separated circuit IDs)
    db.run(
      `ALTER TABLE promo_pricing_rules ADD COLUMN required_circuit_ids TEXT DEFAULT NULL`,
      [],
      (err) => {
        if (err) {
          // Check if error is because column already exists (race condition)
          if (err.message && err.message.includes('duplicate column name')) {
            console.log('✓ required_circuit_ids column already exists (concurrent migration)');
            return callback(null);
          }
          console.error('Migration error: Failed to add required_circuit_ids column:', err);
          return callback(err);
        }

        console.log('✓ required_circuit_ids column added successfully');
        console.log('✓ Migration completed successfully');
        callback(null);
      }
    );
  });
}

module.exports = { runMigration };

