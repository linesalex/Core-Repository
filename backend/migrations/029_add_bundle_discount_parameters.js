// Migration 029: Add bundle discount parameters for extranet pricing basket
// Adds configurable MRC and NRC discount tiers based on number of items in basket

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 029: Add bundle discount parameters...');

  // Check if bundle discount parameters already exist
  db.get("SELECT id FROM extranet_pricing_parameters WHERE param_key = 'bundle_discount_mrc_1_3'", [], (err, row) => {
    if (err) return callback(err);

    if (row) {
      console.log('✓ Bundle discount parameters already exist, skipping migration 029');
      return callback(null);
    }

    const bundleParams = [
      // MRC bundle discounts
      ['bundle_discount_mrc_1_3', '20', 'percentage', 'Maximum MRC discount for bundles with 1-3 items'],
      ['bundle_discount_mrc_4_5', '35', 'percentage', 'Maximum MRC discount for bundles with 4-5 items'],
      ['bundle_discount_mrc_6_plus', '50', 'percentage', 'Maximum MRC discount for bundles with 6+ items'],
      // NRC bundle discounts
      ['bundle_discount_nrc_1_3', '20', 'percentage', 'Automatic NRC discount for bundles with 1-3 items'],
      ['bundle_discount_nrc_4_5', '35', 'percentage', 'Automatic NRC discount for bundles with 4-5 items'],
      ['bundle_discount_nrc_6_plus', '50', 'percentage', 'Automatic NRC discount for bundles with 6+ items']
    ];

    let insertCount = 0;
    let completed = 0;

    bundleParams.forEach(([key, value, type, description]) => {
      db.run(
        'INSERT OR IGNORE INTO extranet_pricing_parameters (param_key, param_value, param_type, description) VALUES (?, ?, ?, ?)',
        [key, value, type, description],
        function(err) {
          if (err) {
            console.error(`Failed to insert ${key}:`, err);
            return callback(err);
          }
          if (this.changes > 0) insertCount++;
          completed++;

          if (completed === bundleParams.length) {
            console.log(`✓ Inserted ${insertCount} bundle discount parameters`);
            console.log('  MRC tiers: 1-3 items = 20%, 4-5 items = 35%, 6+ items = 50%');
            console.log('  NRC tiers: 1-3 items = 20%, 4-5 items = 35%, 6+ items = 50%');
            console.log('Migration 029 completed successfully');
            callback(null);
          }
        }
      );
    });
  });
}

module.exports = { runMigration };
