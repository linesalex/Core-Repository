// Migration: Add design mode fields to network_design_searches table
// Supports Manual Route Entry mode alongside Auto Design mode

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add design mode to network_design_searches');
  
  db.all("PRAGMA table_info(network_design_searches)", [], (err, columns) => {
    if (err) {
      console.error('Migration error: Failed to check network_design_searches table info:', err);
      return callback(err);
    }

    const columnNames = columns.map(col => col.name);
    const columnsToAdd = [];

    if (!columnNames.includes('design_mode')) {
      columnsToAdd.push("ALTER TABLE network_design_searches ADD COLUMN design_mode TEXT DEFAULT 'auto'");
    }
    if (!columnNames.includes('manual_primary_routes')) {
      columnsToAdd.push("ALTER TABLE network_design_searches ADD COLUMN manual_primary_routes TEXT NULL");
    }
    if (!columnNames.includes('manual_secondary_routes')) {
      columnsToAdd.push("ALTER TABLE network_design_searches ADD COLUMN manual_secondary_routes TEXT NULL");
    }

    if (columnsToAdd.length === 0) {
      console.log('✓ design_mode columns already exist');
      return callback(null);
    }

    let completed = 0;
    columnsToAdd.forEach(sql => {
      db.run(sql, [], (err) => {
        if (err) {
          console.error('Migration error: Failed to add design_mode columns:', err);
          return callback(err);
        }
        completed++;
        if (completed === columnsToAdd.length) {
          console.log('✓ design_mode columns added successfully');
          console.log('  - design_mode: Stores "auto" or "manual"');
          console.log('  - manual_primary_routes: Stores comma-separated circuit IDs');
          console.log('  - manual_secondary_routes: Stores comma-separated circuit IDs for protection');
          console.log('✓ Migration completed successfully');
          callback(null);
        }
      });
    });
  });
}

module.exports = { runMigration };

