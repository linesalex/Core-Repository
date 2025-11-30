// Migration: Add route lifecycle fields to network_routes table
// Adds: route_status, replaced_by, replaces, expected_go_live_date, decommission_date

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add route lifecycle fields to network_routes');

  // Check current table structure
  db.all("PRAGMA table_info(network_routes)", [], (err, columns) => {
    if (err) {
      console.error('Migration error: Failed to check network_routes structure:', err);
      return callback(err);
    }

    const columnNames = columns.map(col => col.name);
    const columnsToAdd = [];

    // Check which columns need to be added
    if (!columnNames.includes('route_status')) {
      columnsToAdd.push({
        name: 'route_status',
        sql: `ALTER TABLE network_routes ADD COLUMN route_status TEXT NOT NULL DEFAULT 'Active'`
      });
    }

    if (!columnNames.includes('replaced_by')) {
      columnsToAdd.push({
        name: 'replaced_by',
        sql: `ALTER TABLE network_routes ADD COLUMN replaced_by TEXT DEFAULT NULL`
      });
    }

    if (!columnNames.includes('replaces')) {
      columnsToAdd.push({
        name: 'replaces',
        sql: `ALTER TABLE network_routes ADD COLUMN replaces TEXT DEFAULT NULL`
      });
    }

    if (!columnNames.includes('expected_go_live_date')) {
      columnsToAdd.push({
        name: 'expected_go_live_date',
        sql: `ALTER TABLE network_routes ADD COLUMN expected_go_live_date TEXT DEFAULT NULL`
      });
    }

    if (!columnNames.includes('decommission_date')) {
      columnsToAdd.push({
        name: 'decommission_date',
        sql: `ALTER TABLE network_routes ADD COLUMN decommission_date TEXT DEFAULT NULL`
      });
    }

    if (columnsToAdd.length === 0) {
      console.log('✓ All route lifecycle columns already exist');
      return callback(null);
    }

    console.log(`Adding ${columnsToAdd.length} new column(s) to network_routes...`);

    // Add columns one by one (SQLite doesn't support multiple ALTER TABLE in one statement)
    let addedCount = 0;
    let hasError = false;

    const addNextColumn = (index) => {
      if (index >= columnsToAdd.length || hasError) {
        if (!hasError) {
          console.log(`✓ Successfully added ${addedCount} column(s)`);
          console.log('✓ Migration completed successfully');
          console.log('  - route_status: Active, Provisioning, Under Decommission');
          console.log('  - replaced_by: circuit_id of replacement route');
          console.log('  - replaces: circuit_id of route being replaced');
          console.log('  - expected_go_live_date: for Provisioning routes');
          console.log('  - decommission_date: for Under Decommission routes');
        }
        return callback(hasError ? new Error('Migration partially failed') : null);
      }

      const column = columnsToAdd[index];
      console.log(`  Adding column: ${column.name}...`);

      db.run(column.sql, [], (err) => {
        if (err) {
          // Check if error is because column already exists (race condition)
          if (err.message && err.message.includes('duplicate column name')) {
            console.log(`  ✓ ${column.name} already exists (concurrent migration)`);
            addedCount++;
            addNextColumn(index + 1);
          } else {
            console.error(`  ✗ Failed to add ${column.name}:`, err.message);
            hasError = true;
            addNextColumn(index + 1);
          }
        } else {
          console.log(`  ✓ ${column.name} added`);
          addedCount++;
          addNextColumn(index + 1);
        }
      });
    };

    addNextColumn(0);
  });
}

module.exports = { runMigration };

