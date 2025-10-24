// Migration: Add exchange_facing_infrastructure field to colocation racks

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add exchange_facing_infrastructure to cnx_colocation_racks');
  
  db.all("PRAGMA table_info(cnx_colocation_racks)", [], (err, columns) => {
    if (err) {
      console.error('Migration error: Failed to check cnx_colocation_racks table info:', err);
      return callback(err);
    }

    const columnsToAdd = [];
    const columnNames = columns.map(col => col.name);

    if (!columnNames.includes('exchange_facing_infrastructure')) {
      columnsToAdd.push("ALTER TABLE cnx_colocation_racks ADD COLUMN exchange_facing_infrastructure TEXT DEFAULT 'No'");
    }

    if (columnsToAdd.length === 0) {
      console.log('✓ exchange_facing_infrastructure column already exists');
      return callback(null);
    }

    let completed = 0;
    columnsToAdd.forEach(sql => {
      db.run(sql, [], (err) => {
        if (err) {
          console.error('Migration error: Failed to add exchange_facing_infrastructure column:', err);
          return callback(err);
        }
        completed++;
        if (completed === columnsToAdd.length) {
          console.log('✓ exchange_facing_infrastructure column added successfully');
          console.log('✓ Migration completed successfully');
          callback(null);
        }
      });
    });
  });
}

module.exports = { runMigration };

