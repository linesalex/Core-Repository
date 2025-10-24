// Migration: Convert tor_network_infrastructure from INTEGER to TEXT
// Converts existing 0/1 values to 'No'/'Yes - Cisco 3548'

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Convert tor_network_infrastructure from INTEGER to TEXT');
  
  // First, check if there are any records to update
  db.all("SELECT id, tor_network_infrastructure FROM cnx_colocation_racks", [], (err, rows) => {
    if (err) {
      console.error('Migration error: Failed to query racks:', err);
      return callback(err);
    }
    
    if (rows.length === 0) {
      console.log('✓ No racks to update');
      return callback(null);
    }
    
    console.log(`📊 Found ${rows.length} racks to check`);
    
    let updated = 0;
    let processed = 0;
    
    rows.forEach(row => {
      // Convert INTEGER values to TEXT
      let newValue = row.tor_network_infrastructure;
      
      if (row.tor_network_infrastructure === 0 || row.tor_network_infrastructure === '0') {
        newValue = 'No';
      } else if (row.tor_network_infrastructure === 1 || row.tor_network_infrastructure === '1') {
        newValue = 'Yes - Cisco 3548'; // Default to Cisco for old "Yes" values
      }
      
      // Only update if the value changed
      if (newValue !== row.tor_network_infrastructure) {
        db.run(
          'UPDATE cnx_colocation_racks SET tor_network_infrastructure = ? WHERE id = ?',
          [newValue, row.id],
          function(updateErr) {
            if (updateErr) {
              console.error(`Failed to update rack ${row.id}:`, updateErr);
            } else {
              updated++;
            }
            
            processed++;
            if (processed === rows.length) {
              console.log(`✓ Updated ${updated} rack(s) with new tor_network_infrastructure values`);
              console.log('✓ Migration completed successfully');
              callback(null);
            }
          }
        );
      } else {
        processed++;
        if (processed === rows.length) {
          console.log(`✓ Updated ${updated} rack(s) with new tor_network_infrastructure values`);
          console.log('✓ Migration completed successfully');
          callback(null);
        }
      }
    });
  });
}

module.exports = { runMigration };

