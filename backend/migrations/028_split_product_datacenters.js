// Migration 028: Split source_datacenters into primary_datacenter + secondary_datacenters
// Add primary_pricing_city for admin-set city mapping (when POP code isn't in location_reference)

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 028: Split product datacenters into primary/secondary...');

  // Check if primary_datacenter column already exists
  db.all("PRAGMA table_info(extranet_products)", [], (err, columns) => {
    if (err) return callback(err);

    const hasPrimaryDc = columns.some(c => c.name === 'primary_datacenter');

    if (hasPrimaryDc) {
      console.log('✓ primary_datacenter column already exists, skipping migration 028');
      return callback(null);
    }

    console.log('Adding primary_datacenter, secondary_datacenters, and primary_pricing_city columns...');

    // Add the new columns (SQLite supports simple ALTER TABLE ADD COLUMN)
    db.run('ALTER TABLE extranet_products ADD COLUMN primary_datacenter TEXT', (err) => {
      if (err) {
        console.error('Failed to add primary_datacenter column:', err);
        return callback(err);
      }
      console.log('✓ Added primary_datacenter column');

      db.run('ALTER TABLE extranet_products ADD COLUMN secondary_datacenters TEXT', (err) => {
        if (err) {
          console.error('Failed to add secondary_datacenters column:', err);
          return callback(err);
        }
        console.log('✓ Added secondary_datacenters column');

        db.run('ALTER TABLE extranet_products ADD COLUMN primary_pricing_city TEXT', (err) => {
          if (err) {
            console.error('Failed to add primary_pricing_city column:', err);
            return callback(err);
          }
          console.log('✓ Added primary_pricing_city column');

          // NOTE: We intentionally do NOT migrate existing source_datacenters data.
          // Existing products will have blank new fields - admins will re-enter them.
          // The old source_datacenters column is preserved for reference.

          console.log('Migration 028 completed successfully');
          console.log('  - Existing source_datacenters column preserved for reference');
          console.log('  - New fields left blank - admins should update products with new datacenter fields');
          callback(null);
        });
      });
    });
  });
}

module.exports = { runMigration };
