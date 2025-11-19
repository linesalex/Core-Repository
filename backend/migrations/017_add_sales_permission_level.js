const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add sales permission level to user_module_permissions');

  // Check if the constraint already allows 'sales'
  db.all("PRAGMA table_info(user_module_permissions)", [], (err, columns) => {
    if (err) {
      console.error('Migration error: Failed to check user_module_permissions structure:', err);
      return callback(err);
    }

    // Check if we need to run the migration by attempting to get a sales permission
    db.get("SELECT * FROM user_module_permissions WHERE permission_level = 'sales' LIMIT 1", [], (err, existingSales) => {
      // If there's no error trying to query for 'sales', the constraint likely already allows it
      if (existingSales) {
        console.log('✓ sales permission level already exists and is allowed');
        return callback(null);
      }

      console.log('Updating user_module_permissions table to allow sales permission level...');

      // SQLite doesn't support ALTER TABLE to modify CHECK constraints
      // We need to recreate the table with the new constraint
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('Migration error: Failed to begin transaction:', err);
            return callback(err);
          }

          // Step 1: Create new table with updated CHECK constraint
          const createNewTableSql = `
            CREATE TABLE user_module_permissions_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              module_name TEXT NOT NULL,
              permission_level TEXT NOT NULL CHECK(permission_level IN ('sales', 'read_only', 'provisioner')),
              created_by INTEGER,
              updated_by INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, module_name),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
              FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
            )
          `;

          db.run(createNewTableSql, [], (err) => {
            if (err) {
              console.error('Migration error: Failed to create new table:', err);
              return db.run('ROLLBACK', () => callback(err));
            }

            // Step 2: Copy data from old table to new table
            db.run(`
              INSERT INTO user_module_permissions_new 
              (id, user_id, module_name, permission_level, created_by, updated_by, created_at, updated_at)
              SELECT id, user_id, module_name, permission_level, created_by, updated_by, created_at, updated_at
              FROM user_module_permissions
            `, [], (err) => {
              if (err) {
                console.error('Migration error: Failed to copy data:', err);
                return db.run('ROLLBACK', () => callback(err));
              }

              // Step 3: Drop old table
              db.run('DROP TABLE user_module_permissions', [], (err) => {
                if (err) {
                  console.error('Migration error: Failed to drop old table:', err);
                  return db.run('ROLLBACK', () => callback(err));
                }

                // Step 4: Rename new table to original name
                db.run('ALTER TABLE user_module_permissions_new RENAME TO user_module_permissions', [], (err) => {
                  if (err) {
                    console.error('Migration error: Failed to rename table:', err);
                    return db.run('ROLLBACK', () => callback(err));
                  }

                  // Step 5: Recreate indexes
                  db.run('CREATE INDEX IF NOT EXISTS idx_user_module_permissions_user_id ON user_module_permissions(user_id)', [], (err) => {
                    if (err) {
                      console.warn('Migration warning: Failed to create user_id index:', err);
                    }

                    db.run('CREATE INDEX IF NOT EXISTS idx_user_module_permissions_module_name ON user_module_permissions(module_name)', [], (err) => {
                      if (err) {
                        console.warn('Migration warning: Failed to create module_name index:', err);
                      }

                      // Commit transaction
                      db.run('COMMIT', (err) => {
                        if (err) {
                          console.error('Migration error: Failed to commit transaction:', err);
                          return db.run('ROLLBACK', () => callback(err));
                        }

                        console.log('✓ user_module_permissions table updated successfully');
                        console.log('✓ sales permission level is now allowed');
                        console.log('✓ Migration completed successfully');
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
}

module.exports = { runMigration };

