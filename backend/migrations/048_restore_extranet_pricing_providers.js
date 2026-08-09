// Migration: Safety net for Extranet Providers / pricing tables
//
// Production path: migration 047 preserves these tables and permissions, so this
// migration is a no-op when they already exist.
//
// Dev-only recovery: if an earlier draft of 047 dropped providers/pricing tables
// or permissions, this recreates missing tables and restores permissions without
// deleting existing production data.

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Ensure extranet providers and pricing log tables exist');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) {
        console.error('Migration error: Failed to begin transaction:', beginErr);
        return callback(beginErr);
      }

      const rollback = (err) => {
        console.error('Migration error:', err);
        db.run('ROLLBACK', () => callback(err));
      };

      const commit = () => {
        db.run('COMMIT', (err) => {
          if (err) return rollback(err);
          console.log('✓ Migration completed: Extranet providers/pricing tables verified');
          callback(null);
        });
      };

      ensureProviders(() => {
        ensureProducts(() => {
          ensureLookups(() => {
            ensureBundleLogs(() => {
              // Only seed providers if the table exists but is empty (dev recovery).
              // Never wipe or replace existing production provider rows.
              seedProvidersIfEmpty(() => {
                ensurePermissions(commit);
              });
            });
          });
        });
      });

      function ensureProviders(done) {
        db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='extranet_providers'",
          [],
          (err, table) => {
            if (err) return rollback(err);
            if (table) {
              console.log('✓ extranet_providers already exists (preserved)');
              return done();
            }

            db.run(
              `CREATE TABLE extranet_providers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_name TEXT NOT NULL,
                region TEXT NOT NULL CHECK (region IN ('AMERs', 'APAC', 'EMEA')),
                salesperson_assigned TEXT,
                provider_resiliency TEXT CHECK (provider_resiliency IN ('Multi-Site Resilient', 'Split-Site Resilient', 'Single-Site Resilient', 'Single-Site Non-Resilient')),
                website_link TEXT,
                available INTEGER NOT NULL DEFAULT 1,
                more_info TEXT,
                previously_known_as TEXT,
                created_by INTEGER,
                updated_by INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(provider_name, region),
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (updated_by) REFERENCES users(id)
              )`,
              (createErr) => {
                if (createErr) return rollback(createErr);
                console.log('✓ Created missing extranet_providers (recovery)');
                done();
              }
            );
          }
        );
      }

      function ensureProducts(done) {
        db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='extranet_products'",
          [],
          (err, table) => {
            if (err) return rollback(err);
            if (table) {
              console.log('✓ extranet_products already exists (preserved)');
              return done();
            }

            db.run(
              `CREATE TABLE extranet_products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                isf TEXT,
                suggested_bandwidth TEXT,
                source_datacenters TEXT,
                isf_resiliency TEXT CHECK (isf_resiliency IN ('Single-Site Resilient', 'Multi-Site Resilient', 'Split-Site Resilient', 'Non-Resilient', 'Multi-Region Resilient')),
                design_file_path TEXT,
                design_template_path TEXT,
                more_info TEXT,
                created_by INTEGER,
                updated_by INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (provider_id) REFERENCES extranet_providers(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (updated_by) REFERENCES users(id)
              )`,
              (createErr) => {
                if (createErr) return rollback(createErr);
                db.run(
                  'CREATE INDEX IF NOT EXISTS idx_extranet_products_provider ON extranet_products(provider_id)',
                  () => {
                    console.log('✓ Created missing extranet_products (recovery)');
                    done();
                  }
                );
              }
            );
          }
        );
      }

      function ensureLookups(done) {
        db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='extranet_pricing_lookups'",
          [],
          (err, table) => {
            if (err) return rollback(err);
            if (table) {
              console.log('✓ extranet_pricing_lookups already exists (preserved)');
              return done();
            }

            db.run(
              `CREATE TABLE extranet_pricing_lookups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                city_name TEXT,
                region TEXT,
                tier TEXT,
                provider_id INTEGER,
                provider_name TEXT,
                product_id INTEGER,
                product_name TEXT,
                isf_code TEXT,
                bandwidth TEXT,
                price_usd REAL,
                provider_primary_city TEXT,
                provider_secondary_city TEXT,
                member_primary_city TEXT,
                member_secondary_city TEXT,
                member_resiliency TEXT,
                member_on_off_net TEXT,
                member_cloud INTEGER DEFAULT 0,
                traffic_type TEXT,
                ipsec_required INTEGER DEFAULT 0,
                contract_term INTEGER,
                currency_requested TEXT,
                discount_requested INTEGER DEFAULT 0,
                discount_percent REAL,
                base_price_usd REAL,
                final_mrc REAL,
                final_nrc REAL,
                calculation_breakdown TEXT,
                customer_name TEXT,
                bundle_id INTEGER,
                lookup_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (provider_id) REFERENCES extranet_providers(id)
              )`,
              (createErr) => {
                if (createErr) return rollback(createErr);
                db.exec(
                  `CREATE INDEX IF NOT EXISTS idx_extranet_pricing_lookups_user ON extranet_pricing_lookups(user_id);
                   CREATE INDEX IF NOT EXISTS idx_extranet_pricing_lookups_timestamp ON extranet_pricing_lookups(lookup_timestamp);
                   CREATE INDEX IF NOT EXISTS idx_extranet_lookups_resiliency ON extranet_pricing_lookups(member_resiliency);
                   CREATE INDEX IF NOT EXISTS idx_extranet_lookups_contract ON extranet_pricing_lookups(contract_term);`,
                  () => {
                    console.log('✓ Created missing extranet_pricing_lookups (recovery)');
                    done();
                  }
                );
              }
            );
          }
        );
      }

      function ensureBundleLogs(done) {
        db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='extranet_bundle_logs'",
          [],
          (err, table) => {
            if (err) return rollback(err);
            if (table) {
              console.log('✓ extranet_bundle_logs already exists (preserved)');
              return done();
            }

            db.run(
              `CREATE TABLE extranet_bundle_logs (
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
                customer_name TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
              )`,
              (createErr) => {
                if (createErr) return rollback(createErr);
                db.exec(
                  `CREATE INDEX IF NOT EXISTS idx_bundle_logs_user ON extranet_bundle_logs(user_id);
                   CREATE INDEX IF NOT EXISTS idx_bundle_logs_created ON extranet_bundle_logs(created_at);
                   CREATE INDEX IF NOT EXISTS idx_lookups_bundle_id ON extranet_pricing_lookups(bundle_id);`,
                  () => {
                    console.log('✓ Created missing extranet_bundle_logs (recovery)');
                    done();
                  }
                );
              }
            );
          }
        );
      }

      function seedProvidersIfEmpty(done) {
        db.get('SELECT COUNT(*) AS c FROM extranet_providers', [], (err, row) => {
          if (err) {
            console.warn('Warning counting extranet_providers:', err.message);
            return done();
          }
          if ((row && row.c) > 0) {
            console.log('✓ extranet_providers already has data — skipping seed');
            return done();
          }

          db.all(
            `SELECT organization_name, region, salesperson_assigned, available, created_by, updated_by, created_at, updated_at
             FROM market_data_organizations
             WHERE organization_type = 'extranet'`,
            [],
            (orgErr, rows) => {
              if (orgErr) {
                console.warn('Warning reading market_data_organizations:', orgErr.message);
                return done();
              }

              let idx = 0;
              let inserted = 0;
              const next = () => {
                if (idx >= (rows || []).length) {
                  console.log(`✓ Seeded ${inserted} extranet providers from organizations (empty-table recovery)`);
                  return done();
                }
                const org = rows[idx++];
                db.run(
                  `INSERT OR IGNORE INTO extranet_providers
                    (provider_name, region, salesperson_assigned, available, created_by, updated_by, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    org.organization_name,
                    org.region,
                    org.salesperson_assigned || null,
                    org.available ? 1 : 0,
                    org.created_by || null,
                    org.updated_by || null,
                    org.created_at || null,
                    org.updated_at || null
                  ],
                  function(insertErr) {
                    if (!insertErr && this.changes > 0) inserted++;
                    next();
                  }
                );
              };
              next();
            }
          );
        });
      }

      function ensurePermissions(done) {
        // Restore missing extranet_providers / extranet_pricing grants only when absent.
        // Prefer users who already have market_data_contacts (same Market Data & Extranet family).
        db.all(
          `SELECT user_id, permission_level, created_by, updated_by
           FROM user_module_permissions
           WHERE module_name = 'market_data_contacts'`,
          [],
          (err, rows) => {
            if (err) {
              console.warn('Warning reading market_data_contacts permissions:', err.message);
              return done();
            }

            const modules = ['extranet_providers', 'extranet_pricing'];
            let userIdx = 0;
            let inserts = 0;

            const nextUser = () => {
              if (userIdx >= (rows || []).length) {
                console.log(`✓ Ensured ${inserts} missing extranet permission rows (existing grants untouched)`);
                return updateTemplates(done);
              }
              const row = rows[userIdx++];
              let moduleIdx = 0;
              const nextModule = () => {
                if (moduleIdx >= modules.length) return nextUser();
                const moduleName = modules[moduleIdx++];
                db.run(
                  `INSERT OR IGNORE INTO user_module_permissions
                    (user_id, module_name, permission_level, created_by, updated_by)
                   VALUES (?, ?, ?, ?, ?)`,
                  [row.user_id, moduleName, row.permission_level, row.created_by || null, row.updated_by || null],
                  function(insertErr) {
                    if (!insertErr && this.changes > 0) inserts++;
                    nextModule();
                  }
                );
              };
              nextModule();
            };
            nextUser();
          }
        );
      }

      function updateTemplates(done) {
        db.all('SELECT id, permissions FROM module_permission_templates', [], (err, templates) => {
          if (err) {
            console.warn('Warning reading templates:', err.message);
            return done();
          }

          let updated = 0;
          let idx = 0;
          const next = () => {
            if (idx >= (templates || []).length) {
              console.log(`✓ Updated ${updated} permission templates`);
              return done();
            }
            const template = templates[idx++];
            try {
              const perms = JSON.parse(template.permissions || '{}');
              let changed = false;
              if (perms.market_data_contacts) {
                if (!perms.extranet_providers) {
                  perms.extranet_providers = perms.market_data_contacts;
                  changed = true;
                }
                if (!perms.extranet_pricing) {
                  perms.extranet_pricing = perms.market_data_contacts;
                  changed = true;
                }
              }
              if (!changed) return next();
              db.run(
                'UPDATE module_permission_templates SET permissions = ? WHERE id = ?',
                [JSON.stringify(perms), template.id],
                (updateErr) => {
                  if (!updateErr) updated++;
                  next();
                }
              );
            } catch (e) {
              next();
            }
          };
          next();
        });
      }
    });
  });
}

module.exports = { runMigration };
