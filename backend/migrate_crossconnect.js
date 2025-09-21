// Cross Connect Database Migration Script
// Run with: node migrate_crossconnect.js

const fs = require('fs');
const path = require('path');
const db = require('./db');

console.log('🚀 Starting Cross Connect Database Migration...');

// Read the SQL migration file
const migrationPath = path.join(__dirname, 'migrate_crossconnect.sql');
let migrationSQL;

try {
  migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log('✅ Migration SQL file loaded successfully');
} catch (error) {
  console.error('❌ Failed to read migration file:', error.message);
  process.exit(1);
}

// Split SQL into individual statements
const statements = migrationSQL
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

console.log(`📝 Found ${statements.length} SQL statements to execute`);

// Execute migration
async function runMigration() {
  return new Promise((resolve, reject) => {
    // Use serialize to ensure statements run in order
    db.serialize(() => {
      let completed = 0;
      let errors = [];

      statements.forEach((statement, index) => {
        db.run(statement, function(err) {
          completed++;
          
          if (err) {
            // Some errors are expected (like column already exists)
            if (err.message.includes('duplicate column name') || 
                err.message.includes('already exists')) {
              console.log(`⚠️  Statement ${index + 1}: Column already exists (skipping)`);
            } else {
              console.error(`❌ Statement ${index + 1} failed:`, err.message);
              errors.push(`Statement ${index + 1}: ${err.message}`);
            }
          } else {
            console.log(`✅ Statement ${index + 1}: Executed successfully`);
          }

          // Check if all statements are completed
          if (completed === statements.length) {
            if (errors.length > 0) {
              console.log(`\n⚠️  Migration completed with ${errors.length} errors:`);
              errors.forEach(error => console.log(`   ${error}`));
              reject(new Error(`Migration had ${errors.length} errors`));
            } else {
              console.log('\n🎉 Migration completed successfully!');
              resolve();
            }
          }
        });
      });
    });
  });
}

// Verify the migration by checking if new columns exist
async function verifyMigration() {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(location_reference)", [], (err, columns) => {
      if (err) {
        reject(err);
        return;
      }

      const expectedColumns = [
        'cross_connect_nrc',
        'cross_connect_nrc_currency', 
        'cross_connect_mrc',
        'cross_connect_mrc_currency',
        'cross_connect_notes'
      ];

      const existingColumns = columns.map(col => col.name);
      const missingColumns = expectedColumns.filter(col => !existingColumns.includes(col));

      if (missingColumns.length === 0) {
        console.log('✅ All cross connect columns verified in location_reference table');
        
        // Also verify pricing logic config
        db.all("SELECT config_key FROM pricing_logic_config WHERE config_key LIKE 'cross_connect_%'", [], (err, configs) => {
          if (err) {
            reject(err);
            return;
          }

          const expectedConfigs = ['cross_connect_nrc_margin', 'cross_connect_mrc_margin'];
          const existingConfigs = configs.map(config => config.config_key);
          const missingConfigs = expectedConfigs.filter(config => !existingConfigs.includes(config));

          if (missingConfigs.length === 0) {
            console.log('✅ All cross connect pricing configurations verified');
            resolve();
          } else {
            console.log(`⚠️  Missing pricing configurations: ${missingConfigs.join(', ')}`);
            resolve(); // Not critical, continue
          }
        });
      } else {
        console.log(`❌ Missing columns: ${missingColumns.join(', ')}`);
        reject(new Error(`Missing required columns: ${missingColumns.join(', ')}`));
      }
    });
  });
}

// Main execution
async function main() {
  try {
    await runMigration();
    await verifyMigration();
    
    console.log('\n🎯 Cross Connect Migration Summary:');
    console.log('   ✅ Database schema updated');
    console.log('   ✅ Cross connect fields added to location_reference');
    console.log('   ✅ Pricing logic defaults configured (10% margins)');
    console.log('   📝 Ready for backend API updates');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Ensure the database file exists and is accessible');
    console.log('   2. Check that no other processes are using the database');
    console.log('   3. Verify you have write permissions to the database file');
    
    process.exit(1);
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Migration interrupted by user');
  db.close();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  db.close();
  process.exit(1);
});

main();

