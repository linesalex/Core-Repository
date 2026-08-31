const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add protection_pricing_percent to promo_pricing_rules');

  // Check if column already exists
  db.all("PRAGMA table_info(promo_pricing_rules)", [], (err, columns) => {
    if (err) {
      console.error('Migration error: Failed to check promo_pricing_rules structure:', err);
      return callback(err);
    }

    // Check if protection_pricing_percent column already exists
    const hasProtectionPricingPercent = columns.some(col => col.name === 'protection_pricing_percent');

    if (hasProtectionPricingPercent) {
      console.log('✓ protection_pricing_percent column already exists');
      return callback(null);
    }

    console.log('Adding protection_pricing_percent column to promo_pricing_rules...');

    // Add the new column (REAL, nullable - optional additional % applied to promo price for protected pricing)
    db.run(
      `ALTER TABLE promo_pricing_rules ADD COLUMN protection_pricing_percent REAL DEFAULT NULL`,
      [],
      (err) => {
        if (err) {
          // Check if error is because column already exists (race condition)
          if (err.message && err.message.includes('duplicate column name')) {
            console.log('✓ protection_pricing_percent column already exists (concurrent migration)');
            return callback(null);
          }
          console.error('Migration error: Failed to add protection_pricing_percent column:', err);
          return callback(err);
        }

        console.log('✓ protection_pricing_percent column added successfully');
        console.log('✓ Migration completed successfully');
        callback(null);
      }
    );
  });
}

module.exports = { runMigration };
