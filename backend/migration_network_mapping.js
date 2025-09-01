const db = require('./db');

// Migration script for Network Mapping features
console.log('Starting database migration for Network Mapping features...');

// Array of SQL commands to execute
const migrationQueries = [
  // Create geocoding_cache table
  `CREATE TABLE IF NOT EXISTS geocoding_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_code TEXT UNIQUE NOT NULL,
    address TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    geocoded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    geocoding_status TEXT DEFAULT 'pending' -- pending, success, failed
  )`,

  // Add index for faster lookups
  `CREATE INDEX IF NOT EXISTS idx_geocoding_cache_location_code ON geocoding_cache(location_code)`,

  // Add approval status to users table if it doesn't exist
  `ALTER TABLE users ADD COLUMN approval_status TEXT DEFAULT 'approved'`,

  // Add requested_at timestamp for registration requests
  `ALTER TABLE users ADD COLUMN requested_at DATETIME`,

  // Add approved_by field to track who approved the user
  `ALTER TABLE users ADD COLUMN approved_by INTEGER`,

  // Add approved_at timestamp 
  `ALTER TABLE users ADD COLUMN approved_at DATETIME`,

  // Update existing users to have 'approved' status (for backward compatibility)
  `UPDATE users SET approval_status = 'approved', approved_at = created_at WHERE approval_status IS NULL OR approval_status = ''`
];

// Execute migrations
async function runMigrations() {
  for (let i = 0; i < migrationQueries.length; i++) {
    const query = migrationQueries[i];
    console.log(`\nExecuting migration ${i + 1}/${migrationQueries.length}...`);
    
    try {
      await new Promise((resolve, reject) => {
        db.run(query, function(err) {
          if (err) {
            // Some ALTER TABLE commands might fail if column already exists
            if (err.message.includes('duplicate column name')) {
              console.log(`  ℹ️  Column already exists, skipping...`);
              resolve();
            } else {
              reject(err);
            }
          } else {
            console.log(`  ✅ Migration ${i + 1} completed successfully`);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(`  ❌ Migration ${i + 1} failed:`, error.message);
      // Continue with other migrations
    }
  }
}

// Run migrations and close database
runMigrations()
  .then(() => {
    console.log('\n🎉 All migrations completed!');
    console.log('\nSummary of changes:');
    console.log('  - Added geocoding_cache table for location coordinates');
    console.log('  - Added approval system columns to users table');
    console.log('  - Updated existing users to approved status');
    
    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('\n✅ Database connection closed.');
      }
      process.exit(0);
    });
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });