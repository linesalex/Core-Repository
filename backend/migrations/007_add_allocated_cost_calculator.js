// Migration: Add Allocated Cost Calculator module
// Creates pricing logs table and adds module to permissions

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add Allocated Cost Calculator module');
  
  db.serialize(() => {
    // Step 1: Create allocated_cost_pricing_logs table
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='allocated_cost_pricing_logs'", [], (err, table) => {
      if (err) {
        console.error('Migration error: Failed to check for allocated_cost_pricing_logs table:', err);
        return callback(err);
      }
      
      if (table) {
        console.log('✓ allocated_cost_pricing_logs table already exists');
        proceedToPermissions();
        return;
      }
      
      const createLogsTable = `
        CREATE TABLE allocated_cost_pricing_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          table_name TEXT NOT NULL DEFAULT 'allocated_cost_calculator',
          record_id TEXT NOT NULL,
          action TEXT NOT NULL DEFAULT 'CALCULATE',
          old_values TEXT,
          new_values TEXT,
          changes_summary TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          ip_address TEXT,
          user_agent TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `;
      
      db.run(createLogsTable, [], (err) => {
        if (err) {
          console.error('Migration error: Failed to create allocated_cost_pricing_logs table:', err);
          return callback(err);
        }
        console.log('✓ Created allocated_cost_pricing_logs table');
        proceedToPermissions();
      });
    });
    
    function proceedToPermissions() {
      // Note: role_permissions table is legacy and will be removed in migration 008
      // This migration only creates the pricing logs table
      // Permissions are handled by user_module_permissions for regular users
      // Admins automatically get full access (hardcoded in backend/auth.js)
      console.log('✓ Skipping role_permissions (legacy table, will be removed)');
      console.log('✓ Migration completed successfully');
      callback(null);
    }
  });
}

module.exports = { runMigration };

