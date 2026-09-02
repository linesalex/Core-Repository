// Migration: Track which module permission template a user was last set from
// Enables "drift" detection (has this user's permissions diverged from the
// template they were assigned?) and bulk "resync" of users back to a template.

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add applied_template_id to users');

  db.all("PRAGMA table_info(users)", [], (err, columns) => {
    if (err) {
      console.error('Migration error: Failed to check users table info:', err);
      return callback(err);
    }

    const columnNames = columns.map(col => col.name);

    if (columnNames.includes('applied_template_id')) {
      console.log('✓ applied_template_id column already exists');
      return callback(null);
    }

    const sql = "ALTER TABLE users ADD COLUMN applied_template_id INTEGER DEFAULT NULL";

    db.run(sql, [], (err) => {
      if (err) {
        console.error('Migration error: Failed to add applied_template_id column:', err);
        return callback(err);
      }
      console.log('✓ applied_template_id column added successfully');
      console.log('  - Set whenever a module permission template is applied to a user');
      console.log('  - Used to detect drift between a user\'s current permissions and the template');
      console.log('✓ Migration completed successfully');
      callback(null);
    });
  });
}

module.exports = { runMigration };
