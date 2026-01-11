// Migration: Add Extranet Pricing Tool tables and columns
// Adds pricing parameters, IPSec surcharges, and enhanced analytics tracking

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add Extranet Pricing Tool tables');
  
  db.serialize(() => {
    // Check if extranet_pricing_parameters table already exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='extranet_pricing_parameters'", [], (err, table) => {
      if (err) {
        console.error('Migration error: Failed to check for extranet_pricing_parameters table:', err);
        return callback(err);
      }
      
      if (table) {
        console.log('✓ Extranet pricing tool tables already exist');
        return callback(null);
      }
      
      // Create extranet_pricing_parameters table (key-value store for configurable parameters)
      const createParametersTable = `
        CREATE TABLE extranet_pricing_parameters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          param_key TEXT NOT NULL UNIQUE,
          param_value TEXT NOT NULL,
          param_type TEXT NOT NULL CHECK (param_type IN ('percentage', 'amount', 'json')),
          description TEXT,
          created_by INTEGER,
          updated_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `;
      
      // Create extranet_ipsec_surcharges table
      const createIPSecTable = `
        CREATE TABLE extranet_ipsec_surcharges (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bandwidth_tier TEXT NOT NULL UNIQUE CHECK (bandwidth_tier IN ('under_10mb', '10_to_99mb', '100mb_plus')),
          non_resilient_mrc REAL NOT NULL DEFAULT 0,
          resilient_mrc REAL NOT NULL DEFAULT 0,
          created_by INTEGER,
          updated_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `;
      
      // Execute table creation
      db.run(createParametersTable, [], (err) => {
        if (err) {
          console.error('Migration error: Failed to create extranet_pricing_parameters table:', err);
          return callback(err);
        }
        console.log('✓ Created extranet_pricing_parameters table');
        
        db.run(createIPSecTable, [], (err) => {
          if (err) {
            console.error('Migration error: Failed to create extranet_ipsec_surcharges table:', err);
            return callback(err);
          }
          console.log('✓ Created extranet_ipsec_surcharges table');
          
          // Seed default parameters
          const defaultParameters = [
            // Resiliency percentages
            { key: 'resiliency_non_resilient', value: '70', type: 'percentage', desc: 'Non-Resilient pricing multiplier (%)' },
            { key: 'resiliency_single_site', value: '100', type: 'percentage', desc: 'Single Site Resilient pricing multiplier (%)' },
            { key: 'resiliency_split_site', value: '110', type: 'percentage', desc: 'Split Site Resilient pricing multiplier (%)' },
            { key: 'resiliency_dual_site', value: '125', type: 'percentage', desc: 'Dual Site Resilient (3 or 4 Line) pricing multiplier (%)' },
            // Traffic type percentages
            { key: 'traffic_live_live', value: '125', type: 'percentage', desc: 'Live/Live traffic type multiplier (%)' },
            { key: 'traffic_live_standby', value: '100', type: 'percentage', desc: 'Live/Standby traffic type multiplier (%)' },
            // Discount percentages
            { key: 'cloud_discount', value: '5', type: 'percentage', desc: 'Discount for member in public cloud (AWS/GCP/Azure) (%)' },
            { key: 'contract_24_discount', value: '5', type: 'percentage', desc: '24-month contract discount (%)' },
            { key: 'contract_36_discount', value: '10', type: 'percentage', desc: '36-month contract discount (%)' },
            { key: 'max_user_discount', value: '15', type: 'percentage', desc: 'Maximum user-requested discount allowed (%)' },
            // NRC amounts
            { key: 'nrc_12_month', value: '1000', type: 'amount', desc: '12-month contract NRC (USD)' },
            { key: 'nrc_24_month', value: '500', type: 'amount', desc: '24-month contract NRC (USD)' },
            { key: 'nrc_36_month', value: '0', type: 'amount', desc: '36-month contract NRC (USD)' }
          ];
          
          const insertParamSql = 'INSERT INTO extranet_pricing_parameters (param_key, param_value, param_type, description) VALUES (?, ?, ?, ?)';
          
          let paramIndex = 0;
          const insertNextParam = () => {
            if (paramIndex >= defaultParameters.length) {
              console.log('✓ Seeded default pricing parameters');
              seedIPSecSurcharges();
              return;
            }
            
            const param = defaultParameters[paramIndex];
            db.run(insertParamSql, [param.key, param.value, param.type, param.desc], (err) => {
              if (err) {
                console.error('Error seeding parameter:', param.key, err);
                return callback(err);
              }
              paramIndex++;
              insertNextParam();
            });
          };
          
          const seedIPSecSurcharges = () => {
            // Seed default IPSec surcharges
            const defaultIPSec = [
              { tier: 'under_10mb', non_resilient: 100, resilient: 150 },
              { tier: '10_to_99mb', non_resilient: 200, resilient: 300 },
              { tier: '100mb_plus', non_resilient: 400, resilient: 600 }
            ];
            
            const insertIPSecSql = 'INSERT INTO extranet_ipsec_surcharges (bandwidth_tier, non_resilient_mrc, resilient_mrc) VALUES (?, ?, ?)';
            
            let ipsecIndex = 0;
            const insertNextIPSec = () => {
              if (ipsecIndex >= defaultIPSec.length) {
                console.log('✓ Seeded default IPSec surcharges');
                alterLookupsTable();
                return;
              }
              
              const ipsec = defaultIPSec[ipsecIndex];
              db.run(insertIPSecSql, [ipsec.tier, ipsec.non_resilient, ipsec.resilient], (err) => {
                if (err) {
                  console.error('Error seeding IPSec surcharge:', ipsec.tier, err);
                  return callback(err);
                }
                ipsecIndex++;
                insertNextIPSec();
              });
            };
            
            insertNextIPSec();
          };
          
          const alterLookupsTable = () => {
            // Add new columns to extranet_pricing_lookups for enhanced analytics
            const newColumns = [
              { name: 'provider_primary_city', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN provider_primary_city TEXT' },
              { name: 'provider_secondary_city', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN provider_secondary_city TEXT' },
              { name: 'member_primary_city', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN member_primary_city TEXT' },
              { name: 'member_secondary_city', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN member_secondary_city TEXT' },
              { name: 'member_resiliency', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN member_resiliency TEXT' },
              { name: 'member_on_off_net', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN member_on_off_net TEXT' },
              { name: 'member_cloud', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN member_cloud INTEGER DEFAULT 0' },
              { name: 'traffic_type', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN traffic_type TEXT' },
              { name: 'ipsec_required', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN ipsec_required INTEGER DEFAULT 0' },
              { name: 'contract_term', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN contract_term INTEGER' },
              { name: 'currency_requested', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN currency_requested TEXT' },
              { name: 'discount_requested', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN discount_requested INTEGER DEFAULT 0' },
              { name: 'discount_percent', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN discount_percent REAL' },
              { name: 'base_price_usd', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN base_price_usd REAL' },
              { name: 'final_mrc', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN final_mrc REAL' },
              { name: 'final_nrc', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN final_nrc REAL' },
              { name: 'calculation_breakdown', sql: 'ALTER TABLE extranet_pricing_lookups ADD COLUMN calculation_breakdown TEXT' }
            ];
            
            let colIndex = 0;
            const addNextColumn = () => {
              if (colIndex >= newColumns.length) {
                console.log('✓ Added new columns to extranet_pricing_lookups');
                createIndexes();
                return;
              }
              
              const col = newColumns[colIndex];
              db.run(col.sql, [], (err) => {
                if (err) {
                  // Ignore "duplicate column name" errors - column may already exist
                  if (err.message.includes('duplicate column name')) {
                    console.log(`  Column ${col.name} already exists, skipping`);
                  } else {
                    console.error('Error adding column:', col.name, err);
                    return callback(err);
                  }
                }
                colIndex++;
                addNextColumn();
              });
            };
            
            addNextColumn();
          };
          
          const createIndexes = () => {
            const indexSql = `
              CREATE INDEX IF NOT EXISTS idx_extranet_pricing_params_key ON extranet_pricing_parameters(param_key);
              CREATE INDEX IF NOT EXISTS idx_extranet_lookups_resiliency ON extranet_pricing_lookups(member_resiliency);
              CREATE INDEX IF NOT EXISTS idx_extranet_lookups_contract ON extranet_pricing_lookups(contract_term);
            `;
            
            db.exec(indexSql, (err) => {
              if (err) {
                console.error('Error creating indexes:', err);
                return callback(err);
              }
              console.log('✓ Created indexes');
              console.log('✓ Extranet pricing tool migration completed successfully');
              callback(null);
            });
          };
          
          // Start the seeding process
          insertNextParam();
        });
      });
    });
  });
}

module.exports = { runMigration };
