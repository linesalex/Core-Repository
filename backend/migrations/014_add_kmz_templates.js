// Migration: Add kmz_templates table for KMZ template management
// Stores metadata for locations.kmz and disclaimer.kmz templates used in network design exports

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add kmz_templates table');
  
  // Check if table exists and its structure
  db.all("PRAGMA table_info(kmz_templates)", [], (err, columns) => {
    if (err) {
      console.error('Migration error: Failed to check kmz_templates structure:', err);
      return callback(err);
    }

    // Check if table exists and has correct schema
    const hasTemplateType = columns && columns.some(col => col.name === 'template_type');
    
    if (hasTemplateType) {
      console.log('✓ kmz_templates table already exists with correct schema');
      return callback(null);
    }

    // If table exists but with wrong schema, or doesn't exist, create/recreate it
    if (columns && columns.length > 0) {
      console.log('⚠️  kmz_templates table exists with incorrect schema, recreating...');
    } else {
      console.log('Creating kmz_templates table...');
    }

    // Drop the old table if it exists
    db.run('DROP TABLE IF EXISTS kmz_templates', [], (err) => {
      if (err) {
        console.error('Migration error: Failed to drop kmz_templates table:', err);
        return callback(err);
      }

      // Create the correct table
      const createTableSql = `
        CREATE TABLE kmz_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_type TEXT NOT NULL UNIQUE,
          filename TEXT NOT NULL,
          uploaded_by INTEGER NOT NULL,
          uploaded_at TEXT NOT NULL,
          FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
      `;

      db.run(createTableSql, [], (err) => {
        if (err) {
          console.error('Migration error: Failed to create kmz_templates table:', err);
          return callback(err);
        }

        console.log('✓ kmz_templates table created successfully');

        // Create index for faster lookups
        const createIndexSql = 'CREATE INDEX IF NOT EXISTS idx_kmz_templates_type ON kmz_templates(template_type)';
        
        db.run(createIndexSql, [], (err) => {
          if (err) {
            console.error('Migration warning: Failed to create index on kmz_templates:', err);
            // Don't fail migration if index creation fails
          } else {
            console.log('✓ Index on kmz_templates.template_type created');
          }

          console.log('✓ Migration completed successfully');
          callback(null);
        });
      });
    });
  });
}

module.exports = { runMigration };

