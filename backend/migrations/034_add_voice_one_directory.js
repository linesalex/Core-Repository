// Migration 034: Add Voice One Directory module tables
// Creates parameters table, pricing logs table, and bundle logs table for the One Directory pricing module

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 034: Add Voice One Directory module tables...');

  db.serialize(() => {
    // Check if tables already exist
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='one_directory_parameters'", [], (err, table) => {
      if (err) {
        console.error('Migration error:', err);
        return callback(err);
      }

      if (table) {
        console.log('✓ one_directory_parameters table already exists, skipping migration 034');
        return callback(null);
      }

      // 1. Create one_directory_parameters table (key-value store)
      db.run(`
        CREATE TABLE one_directory_parameters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          param_key TEXT NOT NULL UNIQUE,
          param_value TEXT NOT NULL,
          param_type TEXT NOT NULL CHECK (param_type IN ('percentage', 'amount', 'number', 'json')),
          description TEXT,
          created_by INTEGER,
          updated_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `, (err) => {
        if (err) {
          console.error('Failed to create one_directory_parameters table:', err);
          return callback(err);
        }
        console.log('✓ Created one_directory_parameters table');

        // 2. Create one_directory_pricing_logs table
        db.run(`
          CREATE TABLE one_directory_pricing_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            directory_users INTEGER,
            calculated_bandwidth TEXT,
            customer_location TEXT,
            customer_region TEXT,
            customer_tier TEXT,
            member_resiliency TEXT,
            member_on_off_net TEXT,
            b2b_agility INTEGER DEFAULT 0,
            safe_connect_bandwidth TEXT,
            bandwidth TEXT,
            contract_term INTEGER,
            currency_requested TEXT DEFAULT 'USD',
            base_price_usd REAL,
            final_mrc REAL,
            final_nrc REAL,
            calculation_breakdown TEXT,
            bundle_id INTEGER,
            lookup_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (bundle_id) REFERENCES one_directory_bundle_logs(id)
          )
        `, (err) => {
          if (err) {
            console.error('Failed to create one_directory_pricing_logs table:', err);
            return callback(err);
          }
          console.log('✓ Created one_directory_pricing_logs table');

          // 3. Create one_directory_bundle_logs table
          db.run(`
            CREATE TABLE one_directory_bundle_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              item_count INTEGER NOT NULL,
              contract_term INTEGER,
              currency TEXT DEFAULT 'USD',
              mrc_discount_percent REAL DEFAULT 0,
              nrc_discount_percent REAL DEFAULT 0,
              total_mrc REAL,
              total_nrc REAL,
              total_mrc_usd_before_discount REAL,
              total_nrc_usd_before_discount REAL,
              exchange_rate REAL DEFAULT 1,
              has_poa_items INTEGER DEFAULT 0,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id)
            )
          `, (err) => {
            if (err) {
              console.error('Failed to create one_directory_bundle_logs table:', err);
              return callback(err);
            }
            console.log('✓ Created one_directory_bundle_logs table');

            // Seed default parameters
            seedParameters();
          });
        });
      });

      function seedParameters() {
        const defaultParams = [
          // Bandwidth calculation multipliers
          { key: 'avg_calls_per_user', value: '2', type: 'number', desc: 'Average concurrent calls per directory user' },
          { key: 'call_bandwidth_kbps', value: '100', type: 'number', desc: 'Bandwidth per call in kbps' },
          { key: 'growth_percentage', value: '20', type: 'percentage', desc: 'Growth percentage applied to calculated bandwidth (e.g. 20 = multiply by 1.2)' },

          // Resiliency multipliers (separate from extranet)
          { key: 'resiliency_non_resilient', value: '70', type: 'percentage', desc: 'Non-Resilient pricing multiplier (%)' },
          { key: 'resiliency_single_site', value: '100', type: 'percentage', desc: 'Single Site Resilient pricing multiplier (%)' },
          { key: 'resiliency_split_site', value: '110', type: 'percentage', desc: 'Split Site Resilient pricing multiplier (%)' },
          { key: 'resiliency_dual_site', value: '125', type: 'percentage', desc: 'Dual Site Resilient pricing multiplier (%)' },

          // Contract terms
          { key: 'nrc_12_month', value: '1000', type: 'amount', desc: '12-month contract NRC (USD)' },
          { key: 'nrc_24_month', value: '500', type: 'amount', desc: '24-month contract NRC (USD)' },
          { key: 'nrc_36_month', value: '0', type: 'amount', desc: '36-month contract NRC (USD)' },
          { key: 'contract_24_discount', value: '5', type: 'percentage', desc: '24-month contract MRC discount (%)' },
          { key: 'contract_36_discount', value: '10', type: 'percentage', desc: '36-month contract MRC discount (%)' },

          // Bundle discount tiers
          { key: 'bundle_tier_1_max', value: '3', type: 'number', desc: 'Upper bound of Tier 1 item count' },
          { key: 'bundle_tier_2_max', value: '5', type: 'number', desc: 'Upper bound of Tier 2 item count' },
          { key: 'bundle_discount_mrc_1_3', value: '0', type: 'percentage', desc: 'Tier 1 max MRC discount (%)' },
          { key: 'bundle_discount_nrc_1_3', value: '0', type: 'percentage', desc: 'Tier 1 auto NRC discount (%)' },
          { key: 'bundle_discount_mrc_4_5', value: '5', type: 'percentage', desc: 'Tier 2 max MRC discount (%)' },
          { key: 'bundle_discount_nrc_4_5', value: '5', type: 'percentage', desc: 'Tier 2 auto NRC discount (%)' },
          { key: 'bundle_discount_mrc_6_plus', value: '10', type: 'percentage', desc: 'Tier 3 max MRC discount (%)' },
          { key: 'bundle_discount_nrc_6_plus', value: '10', type: 'percentage', desc: 'Tier 3 auto NRC discount (%)' },

          // B2B Agility / Safe Connect config
          { key: 'b2b_agility_bandwidth', value: '10Mb', type: 'json', desc: 'Fixed bandwidth for B2B Agility add-on' },
          { key: 'safe_connect_bandwidths', value: '["3Mb","5Mb","10Mb"]', type: 'json', desc: 'Available bandwidth options for Safe Connect add-on' }
        ];

        let paramIndex = 0;
        function insertNextParam() {
          if (paramIndex >= defaultParams.length) {
            console.log(`✓ Seeded ${defaultParams.length} One Directory default parameters`);
            createIndexes();
            return;
          }

          const p = defaultParams[paramIndex];
          db.run(
            'INSERT INTO one_directory_parameters (param_key, param_value, param_type, description) VALUES (?, ?, ?, ?)',
            [p.key, p.value, p.type, p.desc],
            (err) => {
              if (err) {
                console.error('Error seeding parameter:', p.key, err);
                return callback(err);
              }
              paramIndex++;
              insertNextParam();
            }
          );
        }

        insertNextParam();
      }

      function createIndexes() {
        db.run('CREATE INDEX IF NOT EXISTS idx_od_params_key ON one_directory_parameters(param_key)', (err) => {
          if (err) console.error('Warning: Failed to create od params index:', err);

          db.run('CREATE INDEX IF NOT EXISTS idx_od_pricing_logs_user ON one_directory_pricing_logs(user_id)', (err) => {
            if (err) console.error('Warning: Failed to create od pricing logs user index:', err);

            db.run('CREATE INDEX IF NOT EXISTS idx_od_pricing_logs_timestamp ON one_directory_pricing_logs(lookup_timestamp)', (err) => {
              if (err) console.error('Warning: Failed to create od pricing logs timestamp index:', err);

              db.run('CREATE INDEX IF NOT EXISTS idx_od_pricing_logs_bundle ON one_directory_pricing_logs(bundle_id)', (err) => {
                if (err) console.error('Warning: Failed to create od pricing logs bundle index:', err);

                db.run('CREATE INDEX IF NOT EXISTS idx_od_bundle_logs_user ON one_directory_bundle_logs(user_id)', (err) => {
                  if (err) console.error('Warning: Failed to create od bundle logs user index:', err);

                  db.run('CREATE INDEX IF NOT EXISTS idx_od_bundle_logs_created ON one_directory_bundle_logs(created_at)', (err) => {
                    if (err) console.error('Warning: Failed to create od bundle logs created index:', err);

                    console.log('✓ Created indexes for One Directory tables');
                    console.log('Migration 034 completed successfully');
                    callback(null);
                  });
                });
              });
            });
          });
        });
      }
    });
  });
}

module.exports = { runMigration };
