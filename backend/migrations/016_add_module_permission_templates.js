// Migration: Add module_permission_templates table for template-based permission management
// Stores reusable permission templates that can be applied to users

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add module_permission_templates table');
  
  // Check if table exists
  db.all("PRAGMA table_info(module_permission_templates)", [], (err, columns) => {
    if (err) {
      console.error('Migration error: Failed to check module_permission_templates structure:', err);
      return callback(err);
    }

    // Check if table exists with correct schema
    const hasTemplateName = columns && columns.some(col => col.name === 'template_name');
    
    if (hasTemplateName) {
      console.log('✓ module_permission_templates table already exists with correct schema');
      return callback(null);
    }

    // Create table
    if (columns && columns.length > 0) {
      console.log('⚠️  module_permission_templates table exists with incorrect schema, recreating...');
    } else {
      console.log('Creating module_permission_templates table...');
    }

    // Drop old table if it exists
    db.run('DROP TABLE IF EXISTS module_permission_templates', [], (err) => {
      if (err) {
        console.error('Migration error: Failed to drop module_permission_templates table:', err);
        return callback(err);
      }

      // Create the table
      const createTableSql = `
        CREATE TABLE module_permission_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_name TEXT NOT NULL UNIQUE,
          permissions TEXT NOT NULL,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `;

      db.run(createTableSql, [], (err) => {
        if (err) {
          console.error('Migration error: Failed to create module_permission_templates table:', err);
          return callback(err);
        }

        console.log('✓ module_permission_templates table created successfully');

        // Create index for faster lookups
        const createIndexSql = 'CREATE INDEX IF NOT EXISTS idx_template_name ON module_permission_templates(template_name)';
        
        db.run(createIndexSql, [], (err) => {
          if (err) {
            console.error('Migration warning: Failed to create index on module_permission_templates:', err);
            // Don't fail migration if index creation fails
          } else {
            console.log('✓ Index on module_permission_templates.template_name created');
          }

          console.log('✓ Migration completed successfully');
          callback(null);
        });
      });
    });
  });
}

module.exports = { runMigration };

