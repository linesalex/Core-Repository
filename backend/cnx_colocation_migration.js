const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting CNX Colocation Database Migration...');

// Database path - adjust if needed for your server
const dbPath = path.join(__dirname, '../network_routes.db');

// Check if database exists
if (!fs.existsSync(dbPath)) {
    console.error('❌ Database file not found at:', dbPath);
    console.error('Please ensure the database file exists and update the path in this script if needed.');
    process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to SQLite database:', dbPath);
});

// Migration functions
const migrations = [
    {
        name: 'Add CNX Colocation columns to location_reference table',
        check: `PRAGMA table_info(location_reference);`,
        migrate: `
            ALTER TABLE location_reference ADD COLUMN more_info TEXT;
            ALTER TABLE location_reference ADD COLUMN design_file TEXT;
        `,
        rollback: `
            -- Note: SQLite doesn't support DROP COLUMN easily
            -- Manual rollback would require recreating the table
            -- This is why we check for existing columns first
        `
    }
];

// Function to check if column exists
function checkColumnExists(tableName, columnName) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName});`, [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            const columnExists = rows.some(row => row.name === columnName);
            resolve(columnExists);
        });
    });
}

// Function to run a single migration
async function runMigration(migration) {
    console.log(`\n🔄 Checking migration: ${migration.name}`);
    
    try {
        // Check if columns already exist
        const moreInfoExists = await checkColumnExists('location_reference', 'more_info');
        const designFileExists = await checkColumnExists('location_reference', 'design_file');
        
        if (moreInfoExists && designFileExists) {
            console.log('✅ Migration already applied: Columns already exist');
            return true;
        }
        
        console.log(`📋 Current status:`);
        console.log(`   - more_info column exists: ${moreInfoExists}`);
        console.log(`   - design_file column exists: ${designFileExists}`);
        
        // Split the migration into individual statements
        const statements = migration.migrate
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);
        
        console.log(`🔨 Running ${statements.length} SQL statement(s)...`);
        
        // Run each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`   ${i + 1}. ${statement.substring(0, 50)}...`);
            
            await new Promise((resolve, reject) => {
                db.run(statement, [], function(err) {
                    if (err) {
                        // Check if error is because column already exists
                        if (err.message.includes('duplicate column name')) {
                            console.log(`   ⚠️  Column already exists, skipping...`);
                            resolve();
                        } else {
                            reject(err);
                        }
                    } else {
                        console.log(`   ✅ Statement executed successfully`);
                        resolve();
                    }
                });
            });
        }
        
        console.log('✅ Migration completed successfully:', migration.name);
        return true;
        
    } catch (error) {
        console.error('❌ Migration failed:', migration.name);
        console.error('Error details:', error.message);
        return false;
    }
}

// Function to verify migration results
async function verifyMigration() {
    console.log('\n🔍 Verifying migration results...');
    
    try {
        const moreInfoExists = await checkColumnExists('location_reference', 'more_info');
        const designFileExists = await checkColumnExists('location_reference', 'design_file');
        
        console.log('📊 Final verification:');
        console.log(`   ✅ more_info column: ${moreInfoExists ? 'EXISTS' : 'MISSING'}`);
        console.log(`   ✅ design_file column: ${designFileExists ? 'EXISTS' : 'MISSING'}`);
        
        if (moreInfoExists && designFileExists) {
            console.log('\n🎉 Migration completed successfully!');
            console.log('✅ CNX Colocation is now ready with full file and info support');
            return true;
        } else {
            console.log('\n❌ Migration verification failed');
            console.log('Some columns are still missing. Please check the error messages above.');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        return false;
    }
}

// Main migration process
async function runMigrations() {
    console.log(`📋 Found ${migrations.length} migration(s) to process\n`);
    
    let success = true;
    
    for (const migration of migrations) {
        const result = await runMigration(migration);
        if (!result) {
            success = false;
            break;
        }
    }
    
    if (success) {
        const verified = await verifyMigration();
        if (verified) {
            console.log('\n🏆 All migrations completed and verified successfully!');
            console.log('\n📝 Next steps:');
            console.log('   1. Restart your backend server');
            console.log('   2. Test CNX Colocation file upload/download functionality');
            console.log('   3. Verify RU validation (max 30 per rack)');
        } else {
            success = false;
        }
    }
    
    // Close database connection
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('\n🔐 Database connection closed');
        }
        
        // Exit with appropriate code
        process.exit(success ? 0 : 1);
    });
}

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Start the migration
runMigrations().catch(error => {
    console.error('❌ Fatal error during migration:', error);
    process.exit(1);
}); 