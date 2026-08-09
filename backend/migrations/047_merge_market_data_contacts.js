// Migration: Merge Exchange/Extranet contacts into Market Data & Extranet
// - Creates market_data_organizations + market_data_contacts
// - Migrates exchanges/providers as organizations and both contact tables
// - Consolidates contact permissions to market_data_contacts
// - Removes only retired Exchange Feeds/Pricing + Extranet Contacts modules
// - PRESERVES extranet_providers, extranet_products, and all extranet pricing tables/permissions

const db = require('../db');

// Modules being retired (contacts merge into market_data_contacts; exchange feeds/pricing removed)
const RETIRED_PERMISSION_MODULES = [
  'exchange_feeds',
  'exchange_contacts',
  'exchange_pricing',
  'extranet_contacts',
  'exchange_data',
  'extranet_data'
];

// Kept under Market Data & Extranet — do not delete these permissions
const PRESERVED_PERMISSION_MODULES = [
  'extranet_providers',
  'extranet_pricing'
];

const PERMISSION_RANK = { sales: 1, read_only: 2, provisioner: 3 };

function higherPermission(a, b) {
  return (PERMISSION_RANK[a] || 0) >= (PERMISSION_RANK[b] || 0) ? a : b;
}

function runMigration(callback) {
  console.log('Running migration: Merge Market Data & Extranet contacts');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) {
        console.error('Migration error: Failed to begin transaction:', beginErr);
        return callback(beginErr);
      }

      db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='market_data_contacts'",
        [],
        (checkErr, existing) => {
          if (checkErr) {
            return rollback(checkErr);
          }
          if (existing) {
            console.log('✓ market_data_contacts already exists — ensuring permissions/cleanup only');
            return migratePermissions(() => dropLegacyTables(() => commit()));
          }
          createTables();
        }
      );

      function rollback(err) {
        console.error('Migration error:', err);
        db.run('ROLLBACK', () => callback(err));
      }

      function commit() {
        db.run('COMMIT', (err) => {
          if (err) {
            console.error('Migration error: Failed to commit:', err);
            return db.run('ROLLBACK', () => callback(err));
          }
          console.log('✓ Migration completed: Market Data & Extranet contacts merge');
          callback(null);
        });
      }

      function createTables() {
        db.run(
          `CREATE TABLE market_data_organizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_name TEXT NOT NULL,
            organization_type TEXT NOT NULL CHECK (organization_type IN ('exchange', 'extranet')),
            region TEXT NOT NULL CHECK (region IN ('AMERs', 'APAC', 'EMEA')),
            salesperson_assigned TEXT,
            available INTEGER NOT NULL DEFAULT 1,
            created_by INTEGER,
            updated_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(organization_name, organization_type, region),
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (updated_by) REFERENCES users(id)
          )`,
          (err) => {
            if (err) return rollback(err);
            db.run(
              `CREATE TABLE market_data_contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                organization_id INTEGER NOT NULL,
                contact_name TEXT NOT NULL,
                job_title TEXT,
                country TEXT,
                phone_number TEXT,
                email TEXT,
                contact_type TEXT,
                daily_contact INTEGER NOT NULL DEFAULT 0,
                more_info TEXT,
                last_updated TEXT,
                updated_date TEXT,
                created_by INTEGER,
                updated_by INTEGER,
                approved_by INTEGER,
                approved_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (organization_id) REFERENCES market_data_organizations(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (updated_by) REFERENCES users(id),
                FOREIGN KEY (approved_by) REFERENCES users(id)
              )`,
              (err2) => {
                if (err2) return rollback(err2);
                console.log('✓ Created market_data_organizations and market_data_contacts');
                migrateOrganizationsAndContacts();
              }
            );
          }
        );
      }

      function migrateOrganizationsAndContacts() {
        const exchangeIdMap = {};
        const providerIdMap = {};

        db.all('SELECT * FROM exchanges', [], (err, exchanges) => {
          if (err) {
            console.warn('Warning reading exchanges:', err.message);
            return migrateProviders();
          }

          let idx = 0;
          const insertNext = () => {
            if (idx >= (exchanges || []).length) {
              console.log(`✓ Migrated ${(exchanges || []).length} exchanges → organizations`);
              return migrateProviders();
            }
            const row = exchanges[idx++];
            db.run(
              `INSERT INTO market_data_organizations
                (organization_name, organization_type, region, salesperson_assigned, available, created_by, updated_by, created_at, updated_at)
               VALUES (?, 'exchange', ?, ?, ?, ?, ?, ?, ?)`,
              [
                row.exchange_name,
                row.region,
                row.salesperson_assigned || null,
                row.available ? 1 : 0,
                row.created_by || null,
                row.updated_by || null,
                row.created_at || null,
                row.updated_at || null
              ],
              function(insertErr) {
                if (insertErr) {
                  console.warn(`Warning migrating exchange ${row.id}:`, insertErr.message);
                } else {
                  exchangeIdMap[row.id] = this.lastID;
                }
                insertNext();
              }
            );
          };
          insertNext();
        });

        function migrateProviders() {
          // Copy provider names into organizations for contacts nesting.
          // Do NOT drop extranet_providers — Providers UI and Pricing Tool still use that table.
          db.all('SELECT * FROM extranet_providers', [], (err, providers) => {
            if (err) {
              console.warn('Warning reading extranet_providers:', err.message);
              return migrateExchangeContacts();
            }

            let idx = 0;
            const insertNext = () => {
              if (idx >= (providers || []).length) {
                console.log(`✓ Migrated ${(providers || []).length} providers → organizations (providers table preserved)`);
                return migrateExchangeContacts();
              }
              const row = providers[idx++];
              db.run(
                `INSERT INTO market_data_organizations
                  (organization_name, organization_type, region, salesperson_assigned, available, created_by, updated_by, created_at, updated_at)
                 VALUES (?, 'extranet', ?, ?, ?, ?, ?, ?, ?)`,
                [
                  row.provider_name,
                  row.region,
                  row.salesperson_assigned || null,
                  row.available ? 1 : 0,
                  row.created_by || null,
                  row.updated_by || null,
                  row.created_at || null,
                  row.updated_at || null
                ],
                function(insertErr) {
                  if (insertErr) {
                    console.warn(`Warning migrating provider ${row.id}:`, insertErr.message);
                  } else {
                    providerIdMap[row.id] = this.lastID;
                  }
                  insertNext();
                }
              );
            };
            insertNext();
          });
        }

        function migrateExchangeContacts() {
          db.all('SELECT * FROM exchange_contacts', [], (err, contacts) => {
            if (err) {
              console.warn('Warning reading exchange_contacts:', err.message);
              return migrateExtranetContacts();
            }

            let idx = 0;
            let migrated = 0;
            const insertNext = () => {
              if (idx >= (contacts || []).length) {
                console.log(`✓ Migrated ${migrated} exchange contacts`);
                return migrateExtranetContacts();
              }
              const row = contacts[idx++];
              const orgId = exchangeIdMap[row.exchange_id];
              if (!orgId) {
                console.warn(`Skipping exchange contact ${row.id}: missing organization mapping`);
                return insertNext();
              }
              db.run(
                `INSERT INTO market_data_contacts
                  (organization_id, contact_name, job_title, country, phone_number, email, contact_type,
                   daily_contact, more_info, last_updated, updated_date, created_by, updated_by,
                   approved_by, approved_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  orgId,
                  row.contact_name,
                  row.job_title || null,
                  row.country || null,
                  row.phone_number || null,
                  row.email || null,
                  row.contact_type || null,
                  row.daily_contact ? 1 : 0,
                  row.more_info || null,
                  row.last_updated || null,
                  row.updated_date || null,
                  row.created_by || null,
                  row.updated_by || null,
                  row.approved_by || null,
                  row.approved_at || null,
                  row.created_at || null,
                  row.updated_at || null
                ],
                (insertErr) => {
                  if (insertErr) {
                    console.warn(`Warning migrating exchange contact ${row.id}:`, insertErr.message);
                  } else {
                    migrated++;
                  }
                  insertNext();
                }
              );
            };
            insertNext();
          });
        }

        function migrateExtranetContacts() {
          db.all('SELECT * FROM extranet_contacts', [], (err, contacts) => {
            if (err) {
              console.warn('Warning reading extranet_contacts:', err.message);
              return migratePermissions(() => dropLegacyTables(() => commit()));
            }

            let idx = 0;
            let migrated = 0;
            const insertNext = () => {
              if (idx >= (contacts || []).length) {
                console.log(`✓ Migrated ${migrated} extranet contacts`);
                return migratePermissions(() => dropLegacyTables(() => commit()));
              }
              const row = contacts[idx++];
              const orgId = providerIdMap[row.provider_id];
              if (!orgId) {
                console.warn(`Skipping extranet contact ${row.id}: missing organization mapping`);
                return insertNext();
              }
              db.run(
                `INSERT INTO market_data_contacts
                  (organization_id, contact_name, job_title, country, phone_number, email, contact_type,
                   daily_contact, more_info, last_updated, updated_date, created_by, updated_by,
                   created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  orgId,
                  row.contact_name,
                  row.job_title || null,
                  row.country || null,
                  row.phone_number || null,
                  row.email || null,
                  row.contact_type || null,
                  row.daily_contact ? 1 : 0,
                  row.more_info || row.notes || null,
                  row.last_contact_updated || null,
                  row.updated_at || null,
                  row.created_by || null,
                  row.updated_by || null,
                  row.created_at || null,
                  row.updated_at || null
                ],
                (insertErr) => {
                  if (insertErr) {
                    console.warn(`Warning migrating extranet contact ${row.id}:`, insertErr.message);
                  } else {
                    migrated++;
                  }
                  insertNext();
                }
              );
            };
            insertNext();
          });
        }
      }

      function migratePermissions(done) {
        db.all(
          `SELECT user_id, module_name, permission_level, created_by, updated_by
           FROM user_module_permissions
           WHERE module_name IN ('exchange_contacts', 'extranet_contacts', 'exchange_data', 'extranet_data')`,
          [],
          (err, rows) => {
            if (err) {
              console.warn('Warning reading permissions:', err.message);
              return updateTemplates(done);
            }

            const byUser = {};
            (rows || []).forEach((row) => {
              if (!byUser[row.user_id]) {
                byUser[row.user_id] = {
                  level: row.permission_level,
                  created_by: row.created_by,
                  updated_by: row.updated_by
                };
              } else {
                byUser[row.user_id].level = higherPermission(byUser[row.user_id].level, row.permission_level);
              }
            });

            const userIds = Object.keys(byUser);
            let idx = 0;
            const insertNext = () => {
              if (idx >= userIds.length) {
                console.log(`✓ Migrated market_data_contacts permissions for ${userIds.length} users`);
                return deleteRetiredPermissions(() => updateTemplates(done));
              }
              const userId = userIds[idx++];
              const info = byUser[userId];
              db.run(
                `INSERT OR IGNORE INTO user_module_permissions (user_id, module_name, permission_level, created_by, updated_by)
                 VALUES (?, 'market_data_contacts', ?, ?, ?)`,
                [userId, info.level, info.created_by || null, info.updated_by || null],
                (insertErr) => {
                  if (insertErr) {
                    console.warn(`Warning inserting market_data_contacts for user ${userId}:`, insertErr.message);
                  }
                  db.run(
                    `UPDATE user_module_permissions
                     SET permission_level = ?
                     WHERE user_id = ? AND module_name = 'market_data_contacts'
                       AND CASE permission_level
                             WHEN 'sales' THEN 1 WHEN 'read_only' THEN 2 WHEN 'provisioner' THEN 3 ELSE 0
                           END
                         < CASE ?
                             WHEN 'sales' THEN 1 WHEN 'read_only' THEN 2 WHEN 'provisioner' THEN 3 ELSE 0
                           END`,
                    [info.level, userId, info.level],
                    () => insertNext()
                  );
                }
              );
            };
            insertNext();
          }
        );
      }

      function deleteRetiredPermissions(done) {
        const placeholders = RETIRED_PERMISSION_MODULES.map(() => '?').join(', ');
        db.run(
          `DELETE FROM user_module_permissions WHERE module_name IN (${placeholders})`,
          RETIRED_PERMISSION_MODULES,
          function(err) {
            if (err) {
              console.warn('Warning deleting retired permissions:', err.message);
            } else {
              console.log(`✓ Removed ${this.changes} retired Market Data permission rows`);
              console.log(`✓ Preserved permissions: ${PRESERVED_PERMISSION_MODULES.join(', ')}`);
            }
            done();
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
              let contactsLevel = null;

              ['exchange_contacts', 'extranet_contacts', 'exchange_data', 'extranet_data'].forEach((key) => {
                if (perms[key]) {
                  contactsLevel = contactsLevel ? higherPermission(contactsLevel, perms[key]) : perms[key];
                  delete perms[key];
                  changed = true;
                }
              });

              // Only strip truly retired keys — keep extranet_providers / extranet_pricing
              ['exchange_feeds', 'exchange_pricing'].forEach((key) => {
                if (perms[key]) {
                  delete perms[key];
                  changed = true;
                }
              });

              if (contactsLevel) {
                perms.market_data_contacts = contactsLevel;
                changed = true;
              }

              if (!changed) return next();

              db.run(
                'UPDATE module_permission_templates SET permissions = ? WHERE id = ?',
                [JSON.stringify(perms), template.id],
                (updateErr) => {
                  if (updateErr) {
                    console.warn(`Warning updating template ${template.id}:`, updateErr.message);
                  } else {
                    updated++;
                  }
                  next();
                }
              );
            } catch (e) {
              console.warn(`Warning parsing template ${template.id}:`, e.message);
              next();
            }
          };
          next();
        });
      }

      function dropLegacyTables(done) {
        // Drop only retired Exchange Data + Extranet Contacts storage.
        // Keep: extranet_providers, extranet_products, extranet_pricing_*,
        //       extranet_rate_card, extranet_ipsec_surcharges, extranet_bundle_logs
        const tablesToDrop = [
          'exchange_files',
          'exchange_feeds',
          'exchange_contacts',
          'exchanges',
          'extranet_contacts'
        ];

        let idx = 0;
        const dropNext = () => {
          if (idx >= tablesToDrop.length) {
            console.log('✓ Dropped retired Exchange/Extranet Contacts tables (providers & pricing preserved)');
            return done();
          }
          const table = tablesToDrop[idx++];
          db.run(`DROP TABLE IF EXISTS ${table}`, (err) => {
            if (err) {
              console.warn(`Warning dropping ${table}:`, err.message);
            }
            dropNext();
          });
        };
        dropNext();
      }
    });
  });
}

module.exports = { runMigration };
