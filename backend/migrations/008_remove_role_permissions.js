// Migration: Remove legacy role_permissions table
// The system now uses user_module_permissions for all access control
// Admins get automatic full access (hardcoded), regular users use per-module permissions

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Remove legacy role_permissions table');
  
  // Check if role_permissions table exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='role_permissions'", [], (err, table) => {
    if (err) {
      console.error('Migration error: Failed to check for role_permissions table:', err);
      return callback(err);
    }
    
    if (!table) {
      console.log('✓ role_permissions table does not exist (already removed)');
      return callback(null);
    }
    
    // Drop the role_permissions table
    db.run('DROP TABLE role_permissions', [], (err) => {
      if (err) {
        console.error('Migration error: Failed to drop role_permissions table:', err);
        return callback(err);
      }
      
      console.log('✓ Dropped role_permissions table');
      console.log('✓ Migration completed successfully');
      console.log('  System now uses:');
      console.log('  - Administrators: Automatic full access (hardcoded)');
      console.log('  - Regular users: user_module_permissions table');
      callback(null);
    });
  });
}

module.exports = { runMigration };

