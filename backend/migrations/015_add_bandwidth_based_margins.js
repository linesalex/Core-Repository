/**
 * Migration: Add Bandwidth-Based Margin Pricing (v3.4.0)
 * 
 * This migration transitions from flat contract term margins to bandwidth-tiered margins.
 * 
 * OLD STRUCTURE:
 *   contractTerms.12.minMargin = 40
 *   contractTerms.12.suggestedMargin = 60
 *   contractTerms.24.minMargin = 37.5
 *   etc.
 * 
 * NEW STRUCTURE:
 *   contractTerms.12.bandwidthTiers.under_100mb.minMargin = 50
 *   contractTerms.12.bandwidthTiers.under_100mb.suggestedMargin = 65
 *   contractTerms.24.discountPercent = 5
 *   etc.
 * 
 * The migration:
 * 1. Reads existing 12-month margins
 * 2. Applies them to ALL bandwidth tiers (preserving current behavior)
 * 3. Converts 24/36-month margins to discount percentages (approximate)
 * 4. Does not delete old entries (keeps backward compatibility)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../network_routes.db');

function runMigration(callback) {
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return callback(err);
    }
  });

  console.log('Starting migration 015: Add Bandwidth-Based Margin Pricing...');

  // Create pricing_logic_config table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS pricing_logic_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT UNIQUE NOT NULL,
      config_value TEXT NOT NULL,
      updated_by INTEGER,
      updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      db.close();
      return callback(err);
    }

    console.log('  ✓ pricing_logic_config table ready');

    // Read existing configuration
    db.all('SELECT * FROM pricing_logic_config', [], (err, configs) => {
      if (err) {
        db.close();
        return callback(err);
      }

      // Parse existing config
      const existingConfig = {};
      configs.forEach(config => {
        existingConfig[config.config_key] = parseFloat(config.config_value);
      });

      console.log('  Existing configuration loaded');

      // Check if migration already run
      const hasBandwidthTiers = configs.some(c => c.config_key.includes('bandwidthTiers'));
      if (hasBandwidthTiers) {
        console.log('  Migration already applied - bandwidth tiers found. Skipping.');
        db.close();
        return callback(null);
      }

      console.log('  Creating bandwidth tier configuration...');

      // Get existing 12-month margins (or use defaults)
      const base12MinMargin = existingConfig['contractTerms.12.minMargin'] || 40;
      const base12SuggestedMargin = existingConfig['contractTerms.12.suggestedMargin'] || 60;
      const protectedBase12MinMargin = existingConfig['protectedServiceMargins.12.minMargin'] || 50;
      const protectedBase12SuggestedMargin = existingConfig['protectedServiceMargins.12.suggestedMargin'] || 70;

      console.log(`  Base 12-month margins: ${base12MinMargin}% / ${base12SuggestedMargin}%`);
      console.log(`  Protected 12-month margins: ${protectedBase12MinMargin}% / ${protectedBase12SuggestedMargin}%`);

      // Prepare new bandwidth tier entries
      const bandwidthTiers = ['under_100mb', 'from_100_to_999mb', 'from_1000_to_2999mb', 'over_3000mb'];
      const newEntries = [];

      // Contract Terms - 12 month bandwidth tiers (apply existing margin to all tiers)
      bandwidthTiers.forEach(tier => {
        newEntries.push({
          key: `contractTerms.12.bandwidthTiers.${tier}.minMargin`,
          value: base12MinMargin
        });
        newEntries.push({
          key: `contractTerms.12.bandwidthTiers.${tier}.suggestedMargin`,
          value: base12SuggestedMargin
        });
      });

      // Contract Terms - 24 and 36 month discount percentages
      newEntries.push({
        key: 'contractTerms.24.discountPercent',
        value: 5 // Default 5% discount
      });
      newEntries.push({
        key: 'contractTerms.36.discountPercent',
        value: 10 // Default 10% discount
      });

      // Protected Service Margins - 12 month bandwidth tiers (apply existing margin to all tiers)
      bandwidthTiers.forEach(tier => {
        newEntries.push({
          key: `protectedServiceMargins.12.bandwidthTiers.${tier}.minMargin`,
          value: protectedBase12MinMargin
        });
        newEntries.push({
          key: `protectedServiceMargins.12.bandwidthTiers.${tier}.suggestedMargin`,
          value: protectedBase12SuggestedMargin
        });
      });

      // Protected Service Margins - 24 and 36 month discount percentages
      newEntries.push({
        key: 'protectedServiceMargins.24.discountPercent',
        value: 5 // Default 5% discount
      });
      newEntries.push({
        key: 'protectedServiceMargins.36.discountPercent',
        value: 10 // Default 10% discount
      });

      console.log(`  Inserting ${newEntries.length} new configuration entries...`);

      // Insert new entries
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          db.close();
          return callback(err);
        }

        let completed = 0;
        let hasError = false;

        newEntries.forEach(entry => {
          db.run(
            'INSERT OR REPLACE INTO pricing_logic_config (config_key, config_value, updated_by, updated_date) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
            [entry.key, entry.value.toString(), 1], // user_id = 1 (system)
            function(err) {
              if (err && !hasError) {
                hasError = true;
                db.run('ROLLBACK');
                db.close();
                return callback(err);
              }

              completed++;
              if (completed === newEntries.length && !hasError) {
                db.run('COMMIT', (err) => {
                  if (err) {
                    db.close();
                    return callback(err);
                  }

                  console.log('  ✓ Bandwidth tier configuration created successfully');
                  console.log('  ✓ All bandwidth tiers initialized with existing 12-month margins');
                  console.log('  ✓ Contract term discounts set to defaults (5% / 10%)');
                  console.log('  ℹ Old configuration entries preserved for backward compatibility');
                  console.log('Migration 015 completed successfully!');
                  
                  db.close();
                  return callback(null);
                });
              }
            }
          );
        });
      });
    });
  });
}

// Run if called directly
if (require.main === module) {
  runMigration((err) => {
    if (err) {
      console.error('Migration failed:', err);
      process.exit(1);
    } else {
      console.log('Migration completed successfully');
      process.exit(0);
    }
  });
}

module.exports = { runMigration };
