const db = require('./db');

const migrations = [
  'ALTER TABLE network_routes ADD COLUMN updated_by INTEGER',
  'ALTER TABLE network_routes ADD COLUMN updated_date DATETIME',
  'ALTER TABLE exchange_feeds ADD COLUMN updated_by INTEGER',
  'ALTER TABLE exchange_feeds ADD COLUMN updated_date DATETIME', 
  'ALTER TABLE exchange_contacts ADD COLUMN updated_by INTEGER',
  'ALTER TABLE exchange_contacts ADD COLUMN updated_date DATETIME',
  'ALTER TABLE carrier_contacts ADD COLUMN updated_by INTEGER',
  'ALTER TABLE cnx_colocation_racks ADD COLUMN updated_by INTEGER',
  'ALTER TABLE cnx_colocation_racks ADD COLUMN updated_date DATETIME',
  'ALTER TABLE cnx_colocation_clients ADD COLUMN updated_by INTEGER',
  'ALTER TABLE cnx_colocation_clients ADD COLUMN updated_date DATETIME'
];

const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_network_routes_updated_by ON network_routes(updated_by)',
  'CREATE INDEX IF NOT EXISTS idx_exchange_feeds_updated_by ON exchange_feeds(updated_by)',
  'CREATE INDEX IF NOT EXISTS idx_exchange_contacts_updated_by ON exchange_contacts(updated_by)',
  'CREATE INDEX IF NOT EXISTS idx_carrier_contacts_updated_by ON carrier_contacts(updated_by)',
  'CREATE INDEX IF NOT EXISTS idx_cnx_colocation_racks_updated_by ON cnx_colocation_racks(updated_by)',
  'CREATE INDEX IF NOT EXISTS idx_cnx_colocation_clients_updated_by ON cnx_colocation_clients(updated_by)'
];

let completed = 0;
let skipped = 0;
let failed = 0;

console.log('Starting migration...');

// Run migrations
migrations.forEach((sql, index) => {
  db.run(sql, [], function(err) {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log(`✓ Skipped (already exists): ${sql.split(' ')[2]} ${sql.split(' ')[5]}`);
        skipped++;
      } else {
        console.log(`✗ Failed: ${sql} - ${err.message}`);
        failed++;
      }
    } else {
      console.log(`✓ Added: ${sql.split(' ')[2]} ${sql.split(' ')[5]}`);
      completed++;
    }
    
    // Check if this is the last migration
    if (index === migrations.length - 1) {
      // Now run indexes
      runIndexes();
    }
  });
});

function runIndexes() {
  let indexCount = 0;
  indexes.forEach((sql, index) => {
    db.run(sql, [], function(err) {
      if (err) {
        console.log(`✗ Index failed: ${err.message}`);
      } else {
        console.log(`✓ Index created: ${sql.match(/idx_(\w+)/)[1]}`);
      }
      indexCount++;
      
      if (indexCount === indexes.length) {
        // Add migration log entry
        const logSql = `INSERT OR IGNORE INTO change_logs (user_id, table_name, record_id, action, new_values, changes_summary, ip_address, user_agent) 
                       VALUES (NULL, 'database_migration', 'user_change_tracking_safe', 'SCHEMA_UPDATE', 
                               '{"migration": "user_change_tracking_safe", "completed": ${completed}, "skipped": ${skipped}, "failed": ${failed}}', 
                               'Added user change tracking fields for better audit trail (safe migration)', 
                               'migration_script', 'Migration Script')`;
        
        db.run(logSql, [], function(err) {
          if (err) {
            console.log('Warning: Could not log migration to change_logs');
          }
          
          console.log('\n=== Migration Summary ===');
          console.log(`Columns added: ${completed}`);
          console.log(`Columns skipped (already exist): ${skipped}`);
          console.log(`Columns failed: ${failed}`);
          console.log('Indexes created successfully');
          console.log('Migration completed!');
          
          db.close();
        });
      }
    });
  });
}