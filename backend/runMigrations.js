// Database Migration Runner
// Automatically runs all pending migrations on backend startup

const fs = require('fs');
const path = require('path');
const db = require('./db');

const migrationsDir = path.join(__dirname, 'migrations');

// Create migrations tracking table if it doesn't exist
function initializeMigrationsTable(callback) {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  db.run(createTableSQL, [], (err) => {
    if (err) {
      console.error('Failed to create migrations table:', err);
      return callback(err);
    }
    callback(null);
  });
}

// Check if a migration has already been applied
function isMigrationApplied(migrationName, callback) {
  db.get(
    'SELECT migration_name FROM migrations WHERE migration_name = ?',
    [migrationName],
    (err, row) => {
      if (err) return callback(err);
      callback(null, !!row);
    }
  );
}

// Record that a migration has been applied
function recordMigration(migrationName, callback) {
  db.run(
    'INSERT INTO migrations (migration_name) VALUES (?)',
    [migrationName],
    callback
  );
}

// Run all pending migrations
function runAllMigrations(callback) {
  console.log('🔄 Checking for database migrations...');
  
  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    console.log('✓ No migrations directory found, skipping migrations');
    return callback(null);
  }
  
  // Initialize migrations tracking table
  initializeMigrationsTable((err) => {
    if (err) return callback(err);
    
    // Get all migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort(); // Ensure migrations run in order
    
    if (files.length === 0) {
      console.log('✓ No migration files found');
      return callback(null);
    }
    
    // Run each migration sequentially
    let index = 0;
    
    function runNextMigration() {
      if (index >= files.length) {
        console.log('✓ All migrations completed successfully');
        return callback(null);
      }
      
      const file = files[index];
      const migrationName = file;
      const migrationPath = path.join(migrationsDir, file);
      
      // Check if migration has already been applied
      isMigrationApplied(migrationName, (err, applied) => {
        if (err) {
          console.error(`Failed to check migration status for ${migrationName}:`, err);
          return callback(err);
        }
        
        if (applied) {
          console.log(`⏩ Skipping ${migrationName} (already applied)`);
          index++;
          return runNextMigration();
        }
        
        console.log(`▶️  Running migration: ${migrationName}`);
        
        try {
          const migration = require(migrationPath);
          
          if (!migration.runMigration || typeof migration.runMigration !== 'function') {
            console.error(`Migration ${migrationName} does not export a runMigration function`);
            index++;
            return runNextMigration();
          }
          
          // Run the migration
          migration.runMigration((err) => {
            if (err) {
              console.error(`❌ Migration ${migrationName} failed:`, err);
              return callback(err);
            }
            
            // Record successful migration
            recordMigration(migrationName, (err) => {
              if (err) {
                console.error(`Failed to record migration ${migrationName}:`, err);
                return callback(err);
              }
              
              console.log(`✓ Migration ${migrationName} completed successfully`);
              index++;
              runNextMigration();
            });
          });
        } catch (error) {
          console.error(`Failed to load migration ${migrationName}:`, error);
          return callback(error);
        }
      });
    }
    
    runNextMigration();
  });
}

module.exports = { runAllMigrations };

