// Migration: Add region column to network_routes table
// This migration adds a region field with default value 'APAC'
// Regions: APAC, EMEA, AMERs, INTER

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add region to network_routes');
  
  // Check if region column already exists
  db.all("PRAGMA table_info(network_routes)", [], (err, columns) => {
    if (err) {
      console.error('Migration error: Failed to check table info:', err);
      return callback(err);
    }
    
    const regionColumnExists = columns.some(col => col.name === 'region');
    
    if (regionColumnExists) {
      console.log('✓ Migration skipped: region column already exists');
      return callback(null);
    }
    
    // Add region column with default value 'APAC'
    const alterTableSQL = `
      ALTER TABLE network_routes 
      ADD COLUMN region TEXT NOT NULL DEFAULT 'APAC' 
      CHECK (region IN ('APAC', 'EMEA', 'AMERs', 'INTER'))
    `;
    
    db.run(alterTableSQL, [], (err) => {
      if (err) {
        console.error('Migration error: Failed to add region column:', err);
        return callback(err);
      }
      
      console.log('✓ Migration completed: region column added successfully');
      console.log('  - Default value: APAC');
      console.log('  - Allowed values: APAC, EMEA, AMERs, INTER');
      callback(null);
    });
  });
}

module.exports = { runMigration };

