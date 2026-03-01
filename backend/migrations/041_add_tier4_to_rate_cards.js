// Migration 041: Add Tier 4 to extranet_rate_card and extranet_pricing_cities
// Recreates tables with updated CHECK constraints to allow 'Tier 4'
// Seeds new Tier 4 rate card rows (all POA) for every provider_region/bandwidth/region combination

const db = require('../db');

const bandwidths = ['64Kb', '128Kb', '256Kb', '512Kb', '1Mb', '1.5Mb', '2Mb', '3Mb', '4Mb', '5Mb', '6Mb', '8Mb', '10Mb', '20Mb', '30Mb', '40Mb', '50Mb', '75Mb', '100Mb', '150Mb', '200Mb'];
const regions = ['AMERs', 'APAC', 'EMEA'];
const providerRegions = ['AMERs', 'APAC', 'EMEA'];

function seedTier4Rows(callback) {
  const entries = [];
  for (const provRegion of providerRegions) {
    for (const bw of bandwidths) {
      for (const region of regions) {
        entries.push([provRegion, bw, region, 'Tier 4', 'POA']);
      }
    }
  }

  let index = 0;
  let insertCount = 0;

  function insertNext() {
    if (index >= entries.length) {
      console.log(`  Seeded ${insertCount} Tier 4 rate card entries (all POA)`);
      return callback(null);
    }

    const [provRegion, bw, region, tier, price] = entries[index];
    db.run(
      'INSERT OR IGNORE INTO extranet_rate_card (provider_region, bandwidth, region, tier, price_usd) VALUES (?, ?, ?, ?, ?)',
      [provRegion, bw, region, tier, price],
      function(err) {
        if (err) {
          console.error(`  Failed to insert ${provRegion}/${bw}/${region}/${tier}:`, err.message);
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
  console.log('Running migration 041: Add Tier 4 to rate cards and pricing cities...');

  // Step 1: Recreate extranet_rate_card with updated CHECK constraint
  db.all("PRAGMA table_info(extranet_rate_card)", [], (err, columns) => {
    if (err) return callback(err);

    if (!columns || columns.length === 0) {
      console.log('  extranet_rate_card table not found, skipping');
      return callback(null);
    }

    console.log('  Recreating extranet_rate_card with Tier 4 CHECK constraint...');

    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS extranet_rate_card_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider_region TEXT NOT NULL DEFAULT 'APAC' CHECK (provider_region IN ('AMERs', 'APAC', 'EMEA')),
          bandwidth TEXT NOT NULL,
          region TEXT NOT NULL CHECK (region IN ('AMERs', 'APAC', 'EMEA')),
          tier TEXT NOT NULL CHECK (tier IN ('Metro', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4')),
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
        if (err) { console.error('  Failed to create new rate card table:', err); return callback(err); }

        db.run(`
          INSERT INTO extranet_rate_card_new (provider_region, bandwidth, region, tier, price_usd, created_by, updated_by, created_at, updated_at)
          SELECT provider_region, bandwidth, region, tier, price_usd, created_by, updated_by, created_at, updated_at
          FROM extranet_rate_card
        `, (err) => {
          if (err) { console.error('  Failed to copy rate card data:', err); return callback(err); }

          db.run('DROP TABLE extranet_rate_card', (err) => {
            if (err) { console.error('  Failed to drop old rate card table:', err); return callback(err); }

            db.run('ALTER TABLE extranet_rate_card_new RENAME TO extranet_rate_card', (err) => {
              if (err) { console.error('  Failed to rename rate card table:', err); return callback(err); }

              db.run('CREATE INDEX IF NOT EXISTS idx_extranet_rate_card_provider_lookup ON extranet_rate_card(provider_region, bandwidth, region, tier)', (err) => {
                if (err) console.error('  Failed to create rate card index:', err);
                console.log('  Recreated extranet_rate_card with Tier 4 support');

                // Step 2: Seed Tier 4 rows
                seedTier4Rows((err) => {
                  if (err) return callback(err);

                  // Step 3: Recreate extranet_pricing_cities with updated CHECK constraint
                  db.all("PRAGMA table_info(extranet_pricing_cities)", [], (err, cityColumns) => {
                    if (err) return callback(err);

                    if (!cityColumns || cityColumns.length === 0) {
                      console.log('  extranet_pricing_cities table not found, skipping');
                      console.log('Migration 041 completed successfully');
                      return callback(null);
                    }

                    db.serialize(() => {
                      db.run(`
                        CREATE TABLE IF NOT EXISTS extranet_pricing_cities_new (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          city_name TEXT NOT NULL,
                          region TEXT NOT NULL CHECK (region IN ('AMERs', 'APAC', 'EMEA')),
                          tier TEXT NOT NULL CHECK (tier IN ('Metro', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4')),
                          country TEXT,
                          created_by INTEGER,
                          updated_by INTEGER,
                          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                          UNIQUE(city_name, region),
                          FOREIGN KEY (created_by) REFERENCES users(id),
                          FOREIGN KEY (updated_by) REFERENCES users(id)
                        )
                      `, (err) => {
                        if (err) { console.error('  Failed to create new cities table:', err); return callback(err); }

                        db.run(`
                          INSERT INTO extranet_pricing_cities_new (id, city_name, region, tier, country, created_by, updated_by, created_at, updated_at)
                          SELECT id, city_name, region, tier, country, created_by, updated_by, created_at, updated_at
                          FROM extranet_pricing_cities
                        `, (err) => {
                          if (err) { console.error('  Failed to copy cities data:', err); return callback(err); }

                          db.run('DROP TABLE extranet_pricing_cities', (err) => {
                            if (err) { console.error('  Failed to drop old cities table:', err); return callback(err); }

                            db.run('ALTER TABLE extranet_pricing_cities_new RENAME TO extranet_pricing_cities', (err) => {
                              if (err) { console.error('  Failed to rename cities table:', err); return callback(err); }

                              console.log('  Recreated extranet_pricing_cities with Tier 4 support');
                              console.log('Migration 041 completed successfully');
                              callback(null);
                            });
                          });
                        });
                      });
                    });
                  });
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
