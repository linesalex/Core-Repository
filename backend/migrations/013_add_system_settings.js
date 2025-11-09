// Migration: Add system_settings table for application-wide configuration
// Stores key-value pairs for system-level settings

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add system_settings table');
  
  // Check if table already exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'", [], (err, table) => {
    if (err) {
      console.error('Migration error: Failed to check for system_settings table:', err);
      return callback(err);
    }

    if (table) {
      console.log('✓ system_settings table already exists');
      return callback(null);
    }

    // Create system_settings table (without foreign key for simplicity)
    const createTableSql = 'CREATE TABLE system_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, setting_key TEXT UNIQUE NOT NULL, setting_value TEXT, description TEXT, updated_by INTEGER, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)';

    db.run(createTableSql, [], (err) => {
      if (err) {
        console.error('Migration error: Failed to create system_settings table:', err);
        return callback(err);
      }

      console.log('✓ system_settings table created successfully');

      // Insert default documentation_url setting
      db.run(
        "INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)",
        ['documentation_url', 'https://docs.example.com', 'URL for the Documentation button in the top navigation bar'],
        (err) => {
          if (err) {
            console.error('Migration warning: Failed to insert default documentation_url:', err);
            // Don't fail migration if default insert fails
          } else {
            console.log('✓ Default documentation_url setting created');
          }

          console.log('✓ Migration completed successfully');
          callback(null);
        }
      );
    });
  });
}

module.exports = { runMigration };

