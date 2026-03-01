const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Convert exchange_data/extranet_data to granular sub-module permissions');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('Migration error: Failed to begin transaction:', err);
        return callback(err);
      }

      // Step 1: For each user with exchange_data, create exchange_feeds, exchange_contacts, exchange_pricing
      db.all(
        "SELECT user_id, permission_level, created_by, updated_by FROM user_module_permissions WHERE module_name = 'exchange_data'",
        [],
        (err, exchangeRows) => {
          if (err) {
            console.error('Migration error: Failed to read exchange_data permissions:', err);
            return db.run('ROLLBACK', () => callback(err));
          }

          const exchangeModules = ['exchange_feeds', 'exchange_contacts', 'exchange_pricing'];
          let exchangeInserts = 0;

          const insertExchangePerms = (idx) => {
            if (idx >= (exchangeRows || []).length) {
              console.log(`✓ Created ${exchangeInserts} exchange sub-module permission entries`);
              return processExtranet();
            }

            const row = exchangeRows[idx];
            let moduleIdx = 0;

            const insertModule = () => {
              if (moduleIdx >= exchangeModules.length) {
                return insertExchangePerms(idx + 1);
              }

              const moduleName = exchangeModules[moduleIdx];
              db.run(
                `INSERT OR IGNORE INTO user_module_permissions (user_id, module_name, permission_level, created_by, updated_by)
                 VALUES (?, ?, ?, ?, ?)`,
                [row.user_id, moduleName, row.permission_level, row.created_by, row.updated_by],
                function(err) {
                  if (err) {
                    console.warn(`Warning: Failed to insert ${moduleName} for user ${row.user_id}:`, err.message);
                  } else if (this.changes > 0) {
                    exchangeInserts++;
                  }
                  moduleIdx++;
                  insertModule();
                }
              );
            };
            insertModule();
          };

          // Step 2: For each user with extranet_data, create extranet_providers, extranet_contacts, extranet_pricing
          const processExtranet = () => {
            db.all(
              "SELECT user_id, permission_level, created_by, updated_by FROM user_module_permissions WHERE module_name = 'extranet_data'",
              [],
              (err, extranetRows) => {
                if (err) {
                  console.error('Migration error: Failed to read extranet_data permissions:', err);
                  return db.run('ROLLBACK', () => callback(err));
                }

                let extranetInserts = 0;

                const insertExtranetPerms = (idx) => {
                  if (idx >= (extranetRows || []).length) {
                    console.log(`✓ Created ${extranetInserts} extranet sub-module permission entries`);
                    return processCleanup();
                  }

                  const row = extranetRows[idx];
                  const modules = ['extranet_providers', 'extranet_contacts', 'extranet_pricing'];

                  let moduleIdx = 0;
                  const insertModule = () => {
                    if (moduleIdx >= modules.length) {
                      return insertExtranetPerms(idx + 1);
                    }

                    const moduleName = modules[moduleIdx];
                    db.run(
                      `INSERT OR IGNORE INTO user_module_permissions (user_id, module_name, permission_level, created_by, updated_by)
                       VALUES (?, ?, ?, ?, ?)`,
                      [row.user_id, moduleName, row.permission_level, row.created_by, row.updated_by],
                      function(err) {
                        if (err) {
                          console.warn(`Warning: Failed to insert ${moduleName} for user ${row.user_id}:`, err.message);
                        } else if (this.changes > 0) {
                          extranetInserts++;
                        }
                        moduleIdx++;
                        insertModule();
                      }
                    );
                  };
                  insertModule();
                };

                insertExtranetPerms(0);
              }
            );
          };

          // Step 3: Remove voice_one_directory_admin entries and update templates
          const processCleanup = () => {
            db.run(
              "DELETE FROM user_module_permissions WHERE module_name = 'voice_one_directory_admin'",
              [],
              function(err) {
                if (err) {
                  console.warn('Warning: Failed to delete voice_one_directory_admin entries:', err.message);
                } else {
                  console.log(`✓ Removed ${this.changes} voice_one_directory_admin permission entries`);
                }

                // Update module_permission_templates to use new keys
                db.all('SELECT id, permissions FROM module_permission_templates', [], (err, templates) => {
                  if (err) {
                    console.warn('Warning: Failed to read module_permission_templates:', err.message);
                    return commitTransaction();
                  }

                  let templatesUpdated = 0;
                  const updateTemplate = (idx) => {
                    if (idx >= (templates || []).length) {
                      console.log(`✓ Updated ${templatesUpdated} permission templates`);
                      return commitTransaction();
                    }

                    const template = templates[idx];
                    try {
                      const perms = JSON.parse(template.permissions);
                      let changed = false;

                      // Convert exchange_data to sub-modules
                      if (perms.exchange_data) {
                        perms.exchange_feeds = perms.exchange_data;
                        perms.exchange_contacts = perms.exchange_data;
                        perms.exchange_pricing = perms.exchange_data;
                        delete perms.exchange_data;
                        changed = true;
                      }

                      // Convert extranet_data to sub-modules
                      if (perms.extranet_data) {
                        perms.extranet_providers = perms.extranet_data;
                        perms.extranet_contacts = perms.extranet_data;
                        perms.extranet_pricing = perms.extranet_data;
                        delete perms.extranet_data;
                        changed = true;
                      }

                      // Remove voice_one_directory_admin
                      if (perms.voice_one_directory_admin) {
                        delete perms.voice_one_directory_admin;
                        changed = true;
                      }

                      if (changed) {
                        db.run(
                          'UPDATE module_permission_templates SET permissions = ? WHERE id = ?',
                          [JSON.stringify(perms), template.id],
                          (err) => {
                            if (err) {
                              console.warn(`Warning: Failed to update template ${template.id}:`, err.message);
                            } else {
                              templatesUpdated++;
                            }
                            updateTemplate(idx + 1);
                          }
                        );
                      } else {
                        updateTemplate(idx + 1);
                      }
                    } catch (e) {
                      console.warn(`Warning: Failed to parse template ${template.id} permissions:`, e.message);
                      updateTemplate(idx + 1);
                    }
                  };

                  updateTemplate(0);
                });
              }
            );
          };

          const commitTransaction = () => {
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('Migration error: Failed to commit transaction:', err);
                return db.run('ROLLBACK', () => callback(err));
              }

              console.log('✓ Migration completed: Granular market data permissions');
              callback(null);
            });
          };

          insertExchangePerms(0);
        }
      );
    });
  });
}

module.exports = { runMigration };
