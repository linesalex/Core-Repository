// Migration 032: Add new bandwidth levels to extranet rate cards
// Adds 30Mb, 40Mb, 75Mb, 150Mb, 200Mb to all three provider region rate cards (APAC, AMERs, EMEA)

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 032: Add new bandwidth levels to extranet rate cards...');

  const newBandwidths = ['30Mb', '40Mb', '75Mb', '150Mb', '200Mb'];
  const providerRegions = ['APAC', 'AMERs', 'EMEA'];
  const regions = ['AMERs', 'APAC', 'EMEA'];
  const tiers = ['Metro', 'Tier 1', 'Tier 2', 'Tier 3'];

  // Check if any of the new bandwidths already exist
  db.get("SELECT id FROM extranet_rate_card WHERE bandwidth = '30Mb' LIMIT 1", [], (err, row) => {
    if (err) return callback(err);

    if (row) {
      console.log('✓ New bandwidth levels already exist in rate card, skipping migration 032');
      return callback(null);
    }

    // Build all entries to insert (all POA)
    const entries = [];
    for (const provRegion of providerRegions) {
      for (const bw of newBandwidths) {
        for (const region of regions) {
          for (const tier of tiers) {
            entries.push([provRegion, bw, region, tier, 'POA']);
          }
        }
      }
    }

    console.log(`  Inserting ${entries.length} new rate card entries across ${providerRegions.length} provider regions...`);

    let insertCount = 0;
    let completed = 0;

    entries.forEach(([provRegion, bw, region, tier, price]) => {
      db.run(
        'INSERT OR IGNORE INTO extranet_rate_card (provider_region, bandwidth, region, tier, price_usd) VALUES (?, ?, ?, ?, ?)',
        [provRegion, bw, region, tier, price],
        function(err) {
          if (err) {
            console.error(`Failed to insert ${provRegion}/${bw}/${region}/${tier}:`, err);
          } else if (this.changes > 0) {
            insertCount++;
          }
          completed++;

          if (completed === entries.length) {
            console.log(`✓ Inserted ${insertCount} new rate card entries`);
            console.log(`  New bandwidths: ${newBandwidths.join(', ')}`);
            console.log(`  Provider regions: ${providerRegions.join(', ')}`);
            console.log('Migration 032 completed successfully');
            callback(null);
          }
        }
      );
    });
  });
}

module.exports = { runMigration };
