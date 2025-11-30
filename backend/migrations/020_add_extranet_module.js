// Migration: Create Extranet Data Module tables
// Allows management of extranet providers, products, contacts, and tiered pricing

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Create Extranet Data Module tables');
  
  db.serialize(() => {
    // Check if extranet_providers table already exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='extranet_providers'", [], (err, table) => {
      if (err) {
        console.error('Migration error: Failed to check for extranet_providers table:', err);
        return callback(err);
      }
      
      if (table) {
        console.log('✓ Extranet module tables already exist');
        return callback(null);
      }
      
      // Create extranet_providers table
      const createProvidersTable = `
        CREATE TABLE extranet_providers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider_name TEXT NOT NULL,
          region TEXT NOT NULL CHECK (region IN ('AMERs', 'APAC', 'EMEA')),
          salesperson_assigned TEXT,
          provider_resiliency TEXT CHECK (provider_resiliency IN ('Resilient', 'Non-Resilient', 'Split Site Resilient', 'Multi-Region Resilient')),
          website_link TEXT,
          available INTEGER NOT NULL DEFAULT 1,
          more_info TEXT,
          created_by INTEGER,
          updated_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(provider_name, region),
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `;
      
      // Create extranet_products table
      const createProductsTable = `
        CREATE TABLE extranet_products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          isf TEXT,
          suggested_bandwidth TEXT,
          source_datacenters TEXT,
          isf_resiliency TEXT CHECK (isf_resiliency IN ('Resilient', 'Non-Resilient', 'Split Site Resilient', 'Multi-Region Resilient')),
          design_file_path TEXT,
          more_info TEXT,
          created_by INTEGER,
          updated_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (provider_id) REFERENCES extranet_providers(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `;
      
      // Create extranet_contacts table
      const createContactsTable = `
        CREATE TABLE extranet_contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider_id INTEGER NOT NULL,
          contact_name TEXT NOT NULL,
          job_title TEXT,
          country TEXT,
          phone_number TEXT,
          email TEXT,
          contact_type TEXT,
          daily_contact INTEGER NOT NULL DEFAULT 0,
          more_info TEXT,
          last_contact_updated TEXT DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER,
          updated_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (provider_id) REFERENCES extranet_providers(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `;
      
      // Create extranet_pricing_cities table (city to tier mapping)
      const createCitiesTable = `
        CREATE TABLE extranet_pricing_cities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          city_name TEXT NOT NULL,
          region TEXT NOT NULL CHECK (region IN ('AMERs', 'APAC', 'EMEA')),
          tier TEXT NOT NULL CHECK (tier IN ('Metro', 'Tier 1', 'Tier 2', 'Tier 3')),
          created_by INTEGER,
          updated_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(city_name, region),
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `;
      
      // Create extranet_rate_card table (bandwidth x tier-region pricing)
      const createRateCardTable = `
        CREATE TABLE extranet_rate_card (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bandwidth TEXT NOT NULL,
          region TEXT NOT NULL CHECK (region IN ('AMERs', 'APAC', 'EMEA')),
          tier TEXT NOT NULL CHECK (tier IN ('Metro', 'Tier 1', 'Tier 2', 'Tier 3')),
          price_usd REAL NOT NULL DEFAULT 0,
          created_by INTEGER,
          updated_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(bandwidth, region, tier),
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `;
      
      // Create extranet_pricing_lookups table (analytics tracking)
      const createLookupsTable = `
        CREATE TABLE extranet_pricing_lookups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          city_name TEXT,
          region TEXT,
          tier TEXT,
          provider_id INTEGER,
          provider_name TEXT,
          product_id INTEGER,
          product_name TEXT,
          bandwidth TEXT,
          price_usd REAL,
          lookup_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (provider_id) REFERENCES extranet_providers(id)
        )
      `;
      
      // Create index for faster lookups
      const createIndexes = `
        CREATE INDEX IF NOT EXISTS idx_extranet_products_provider ON extranet_products(provider_id);
        CREATE INDEX IF NOT EXISTS idx_extranet_contacts_provider ON extranet_contacts(provider_id);
        CREATE INDEX IF NOT EXISTS idx_extranet_pricing_cities_region ON extranet_pricing_cities(region);
        CREATE INDEX IF NOT EXISTS idx_extranet_rate_card_lookup ON extranet_rate_card(bandwidth, region, tier);
        CREATE INDEX IF NOT EXISTS idx_extranet_pricing_lookups_user ON extranet_pricing_lookups(user_id);
        CREATE INDEX IF NOT EXISTS idx_extranet_pricing_lookups_timestamp ON extranet_pricing_lookups(lookup_timestamp);
      `;
      
      // Execute table creation sequentially
      db.run(createProvidersTable, [], (err) => {
        if (err) {
          console.error('Migration error: Failed to create extranet_providers table:', err);
          return callback(err);
        }
        console.log('✓ Created extranet_providers table');
        
        db.run(createProductsTable, [], (err) => {
          if (err) {
            console.error('Migration error: Failed to create extranet_products table:', err);
            return callback(err);
          }
          console.log('✓ Created extranet_products table');
          
          db.run(createContactsTable, [], (err) => {
            if (err) {
              console.error('Migration error: Failed to create extranet_contacts table:', err);
              return callback(err);
            }
            console.log('✓ Created extranet_contacts table');
            
            db.run(createCitiesTable, [], (err) => {
              if (err) {
                console.error('Migration error: Failed to create extranet_pricing_cities table:', err);
                return callback(err);
              }
              console.log('✓ Created extranet_pricing_cities table');
              
              db.run(createRateCardTable, [], (err) => {
                if (err) {
                  console.error('Migration error: Failed to create extranet_rate_card table:', err);
                  return callback(err);
                }
                console.log('✓ Created extranet_rate_card table');
                
                db.run(createLookupsTable, [], (err) => {
                  if (err) {
                    console.error('Migration error: Failed to create extranet_pricing_lookups table:', err);
                    return callback(err);
                  }
                  console.log('✓ Created extranet_pricing_lookups table');
                  
                  // Create indexes
                  db.exec(createIndexes, (err) => {
                    if (err) {
                      console.error('Migration error: Failed to create indexes:', err);
                      return callback(err);
                    }
                    console.log('✓ Created indexes');
                    
                    // Seed the rate card with default bandwidths (all prices start at 0)
                    const bandwidths = ['64Kb', '128Kb', '256Kb', '512Kb', '1Mb', '1.5Mb', '2Mb', '3Mb', '4Mb', '5Mb', '6Mb', '8Mb', '10Mb', '20Mb', '50Mb', '100Mb'];
                    const regions = ['AMERs', 'APAC', 'EMEA'];
                    const tiers = ['Metro', 'Tier 1', 'Tier 2', 'Tier 3'];
                    
                    // Build all insert values
                    const insertValues = [];
                    bandwidths.forEach(bandwidth => {
                      regions.forEach(region => {
                        tiers.forEach(tier => {
                          insertValues.push(`('${bandwidth}', '${region}', '${tier}', 0)`);
                        });
                      });
                    });
                    
                    // Insert all rate card entries in a single statement
                    const insertSql = `INSERT OR IGNORE INTO extranet_rate_card (bandwidth, region, tier, price_usd) VALUES ${insertValues.join(', ')}`;
                    
                    db.run(insertSql, [], (err) => {
                      if (err) {
                        console.error('Error seeding rate card:', err);
                        return callback(err);
                      }
                      console.log('✓ Seeded rate card with default bandwidths');
                      console.log('✓ Extranet module migration completed successfully');
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
}

module.exports = { runMigration };

