// Migration 026: Add provider_region to extranet_rate_card for region-specific rate cards
// Creates 3 separate rate cards (APAC, AMERs, EMEA) based on provider location
// Existing rate card data becomes the APAC rate card, new AMERs and EMEA cards initialized as POA

const db = require('../db');

const bandwidths = ['64Kb', '128Kb', '256Kb', '512Kb', '1Mb', '1.5Mb', '2Mb', '3Mb', '4Mb', '5Mb', '6Mb', '8Mb', '10Mb', '20Mb', '50Mb', '100Mb'];
const regions = ['AMERs', 'APAC', 'EMEA'];
const tiers = ['Metro', 'Tier 1', 'Tier 2', 'Tier 3'];

// Seed AMERs and EMEA rate cards with POA using sequential inserts
function seedProviderRegions(callback) {
  const providerRegions = ['AMERs', 'EMEA']; // APAC already exists from copy
  const entries = [];

  for (const provRegion of providerRegions) {
    for (const bw of bandwidths) {
      for (const region of regions) {
        for (const tier of tiers) {
          entries.push([provRegion, bw, region, tier, 'POA']);
        }
      }
    }
  }

  let index = 0;
  let insertCount = 0;

  function insertNext() {
    if (index >= entries.length) {
      console.log(`✓ Seeded ${insertCount} entries for AMERs and EMEA provider rate cards (all POA)`);
      return callback(null);
    }

    const [provRegion, bw, region, tier, price] = entries[index];
    db.run(
      'INSERT OR IGNORE INTO extranet_rate_card (provider_region, bandwidth, region, tier, price_usd) VALUES (?, ?, ?, ?, ?)',
      [provRegion, bw, region, tier, price],
      function(err) {
        if (err) {
          console.error(`Failed to insert ${provRegion}/${bw}/${region}/${tier}:`, err);
          // Continue despite individual errors
        } else if (this.changes > 0) {
          insertCount++;
        }
        index++;
        insertNext();
      }
    );
  }

  insertNext();
}

function runMigration(callback) {
  console.log('Running migration 026: Add provider region rate cards...');

  // Check if provider_region column already exists
  db.all("PRAGMA table_info(extranet_rate_card)", [], (err, columns) => {
    if (err) return callback(err);

    const hasProviderRegion = columns.some(c => c.name === 'provider_region');

    if (hasProviderRegion) {
      // Column exists - check if AMERs and EMEA are seeded
      console.log('✓ provider_region column already exists on extranet_rate_card');
      db.get("SELECT COUNT(*) as count FROM extranet_rate_card WHERE provider_region IN ('AMERs', 'EMEA')", [], (err, row) => {
        if (err) return callback(err);
        
        if (row.count > 0) {
          console.log(`✓ AMERs/EMEA rate cards already seeded (${row.count} entries), skipping`);
          return callback(null);
        }

        // Column exists but AMERs/EMEA not seeded (partial migration recovery)
        console.log('⚠️  AMERs/EMEA rate cards not yet seeded, seeding now...');
        seedProviderRegions((err) => {
          if (err) return callback(err);
          console.log('Migration 026 completed successfully (partial recovery)');
          callback(null);
        });
      });
      return;
    }

    console.log('Adding provider_region column to extranet_rate_card...');

    // SQLite doesn't support adding columns with CHECK constraints directly,
    // so we need to recreate the table
    db.serialize(() => {
      // Step 1: Create new table with provider_region
      db.run(`
        CREATE TABLE extranet_rate_card_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider_region TEXT NOT NULL DEFAULT 'APAC' CHECK (provider_region IN ('AMERs', 'APAC', 'EMEA')),
          bandwidth TEXT NOT NULL,
          region TEXT NOT NULL CHECK (region IN ('AMERs', 'APAC', 'EMEA')),
          tier TEXT NOT NULL CHECK (tier IN ('Metro', 'Tier 1', 'Tier 2', 'Tier 3')),
          price_usd TEXT NOT NULL DEFAULT 'POA',
          created_by INTEGER,
          updated_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(provider_region, bandwidth, region, tier),
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `, (err) => {
        if (err) {
          console.error('Failed to create new rate card table:', err);
          return callback(err);
        }
        console.log('✓ Created extranet_rate_card_new table');

        // Step 2: Copy existing data as APAC provider region
        db.run(`
          INSERT INTO extranet_rate_card_new (provider_region, bandwidth, region, tier, price_usd, created_by, updated_by, created_at, updated_at)
          SELECT 'APAC', bandwidth, region, tier, price_usd, created_by, updated_by, created_at, updated_at
          FROM extranet_rate_card
        `, (err) => {
          if (err) {
            console.error('Failed to copy existing data:', err);
            return callback(err);
          }
          console.log('✓ Copied existing rate card data as APAC provider region');

          // Step 3: Drop old table
          db.run('DROP TABLE extranet_rate_card', (err) => {
            if (err) {
              console.error('Failed to drop old table:', err);
              return callback(err);
            }
            console.log('✓ Dropped old extranet_rate_card table');

            // Step 4: Rename new table
            db.run('ALTER TABLE extranet_rate_card_new RENAME TO extranet_rate_card', (err) => {
              if (err) {
                console.error('Failed to rename table:', err);
                return callback(err);
              }
              console.log('✓ Renamed new table to extranet_rate_card');

              // Step 5: Create indexes
              db.run('CREATE INDEX IF NOT EXISTS idx_extranet_rate_card_provider_lookup ON extranet_rate_card(provider_region, bandwidth, region, tier)', (err) => {
                if (err) {
                  console.error('Failed to create index:', err);
                  return callback(err);
                }
                console.log('✓ Created provider region index');

                // Step 6: Seed AMERs and EMEA rate cards with POA
                seedProviderRegions((err) => {
                  if (err) return callback(err);
                  console.log('Migration 026 completed successfully');
                  callback(null);
                });
              });
            });
          });
        });
      });
    });
  });
}

module.exports = { runMigration };
