// Migration 031: Add configurable bundle tier boundary parameters
// Allows admins to configure the item count ranges for each bundle discount tier

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 031: Add bundle tier boundary parameters...');

  // Check if bundle tier boundary parameters already exist
  db.get("SELECT id FROM extranet_pricing_parameters WHERE param_key = 'bundle_tier_1_max'", [], (err, row) => {
    if (err) return callback(err);

    if (row) {
      console.log('✓ Bundle tier boundary parameters already exist, skipping migration 031');
      return callback(null);
    }

    const tierParams = [
      ['bundle_tier_1_max', '3', 'number', 'Upper bound of Tier 1 item count (1 to this value)'],
      ['bundle_tier_2_max', '5', 'number', 'Upper bound of Tier 2 item count (Tier1+1 to this value). Tier 3 is above this.']
    ];

    let completed = 0;
    let insertCount = 0;

    tierParams.forEach(([key, value, type, description]) => {
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

          if (completed === tierParams.length) {
            console.log(`✓ Inserted ${insertCount} bundle tier boundary parameters`);
            console.log('  Tier 1: 1-3 items, Tier 2: 4-5 items, Tier 3: 6+ items (defaults)');
            console.log('Migration 031 completed successfully');
            callback(null);
          }
        }
      );
    });
  });
}

module.exports = { runMigration };
