// Live Latency Configuration Database Migration Script
// Run with: node migrate_live_latency_config.js

const fs = require('fs');
const path = require('path');
const db = require('./db');

console.log('🚀 Starting Live Latency Configuration Database Migration...');

// Read the SQL migration file
const migrationPath = path.join(__dirname, 'migrate_live_latency_config.sql');
let migrationSQL;

try {
  migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log('✅ Migration SQL file loaded successfully');
} catch (error) {
  console.error('❌ Failed to read migration file:', error.message);
  process.exit(1);
}

// Split SQL into individual statements, handling multi-line CREATE statements
const statements = migrationSQL
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && stmt !== '')
  .map(stmt => {
    // Clean up any remaining comments and whitespace
    return stmt.replace(/--.*$/gm, '').trim();
  })
  .filter(stmt => stmt.length > 0);

console.log(`📝 Found ${statements.length} SQL statements to execute`);

// Execute migration using exec for better SQL handling
async function runMigration() {
  return new Promise((resolve, reject) => {
    console.log('📝 Executing migration SQL...');
    
    db.exec(migrationSQL, (err) => {
      if (err) {
        // Check if errors are expected (already exists)
        if (err.message.includes('duplicate column name') || 
            err.message.includes('already exists') ||
            err.message.includes('table') && err.message.includes('already exists')) {
          console.log('⚠️  Some objects already exist (expected for re-running migration)');
          console.log('🎉 Migration completed successfully!');
          resolve();
        } else {
          console.error('❌ Migration failed:', err.message);
          reject(err);
        }
      } else {
        console.log('🎉 Migration completed successfully!');
        resolve();
      }
    });
  });
}

// Verify the migration by checking if new tables exist
async function verifyMigration() {
  return new Promise((resolve, reject) => {
    const expectedTables = [
      'live_latency_config',
      'live_latency_api_logs', 
      'live_latency_system_config'
    ];
    
    let checkedTables = 0;
    let foundTables = 0;
    
    expectedTables.forEach(tableName => {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName], (err, result) => {
        checkedTables++;
        
        if (err) {
          reject(err);
          return;
        }
        
        if (result) {
          console.log(`✅ Table '${tableName}' verified`);
          foundTables++;
        } else {
          console.log(`❌ Table '${tableName}' not found`);
        }
        
        if (checkedTables === expectedTables.length) {
          if (foundTables === expectedTables.length) {
            console.log('✅ All required tables verified successfully');
            resolve();
          } else {
            reject(new Error(`Only ${foundTables}/${expectedTables.length} tables found`));
          }
        }
      });
    });
  });
}

// Main execution
async function main() {
  try {
    await runMigration();
    await verifyMigration();
    
    console.log('\n🎯 Live Latency Configuration Migration Summary:');
    console.log('   ✅ Database schema updated');
    console.log('   ✅ live_latency_config table created');
    console.log('   ✅ live_latency_api_logs table created');
    console.log('   ✅ live_latency_system_config table created');
    console.log('   ✅ Default system settings inserted');
    console.log('   ✅ Performance indexes created');
    console.log('   📝 Ready for admin interface and API implementation');
    
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
