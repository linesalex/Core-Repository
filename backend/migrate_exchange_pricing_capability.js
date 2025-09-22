// Exchange Pricing Capability Database Migration Script
// Run with: node migrate_exchange_pricing_capability.js

const fs = require('fs');
const path = require('path');
const db = require('./db');

console.log('🚀 Starting Exchange Pricing Capability Database Migration...');

// Read the SQL migration file
const migrationPath = path.join(__dirname, 'migrate_exchange_pricing_capability.sql');
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
  .filter(stmt => stmt.length > 0);

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

// Verify the migration by checking if new column exists
async function verifyMigration() {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(pop_capabilities)", [], (err, columns) => {
      if (err) {
        reject(err);
        return;
      }

      const expectedColumn = 'exchange_pricing_in_region';
      const existingColumns = columns.map(col => col.name);
      const hasNewColumn = existingColumns.includes(expectedColumn);

      if (hasNewColumn) {
        console.log('✅ exchange_pricing_in_region column verified in pop_capabilities table');
        
        // Check the column details
        const columnInfo = columns.find(col => col.name === expectedColumn);
        console.log(`✅ Column details: type=${columnInfo.type}, default=${columnInfo.dflt_value}`);
        
        resolve();
      } else {
        console.log(`❌ Missing column: ${expectedColumn}`);
        reject(new Error(`Missing required column: ${expectedColumn}`));
      }
    });
  });
}

// Main execution
async function main() {
  try {
    await runMigration();
    await verifyMigration();
    
    console.log('\n🎯 Exchange Pricing Capability Migration Summary:');
    console.log('   ✅ Database schema updated');
    console.log('   ✅ exchange_pricing_in_region field added to pop_capabilities');
    console.log('   ✅ Default value set to false (0) for all existing locations');
    console.log('   📝 Ready for frontend and API updates');
    
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
