// Migration: Create Feedback Module tables
// Allows users to submit bug reports and feature requests with file attachments

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Create Feedback Module tables');
  
  db.serialize(() => {
    // Check if feedback_submissions table already exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback_submissions'", [], (err, table) => {
      if (err) {
        console.error('Migration error: Failed to check for feedback_submissions table:', err);
        return callback(err);
      }
      
      if (table) {
        console.log('✓ Feedback module tables already exist');
        return callback(null);
      }
      
      // Create feedback_submissions table
      const createSubmissionsTable = `
        CREATE TABLE feedback_submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('Bug', 'Feature Request')),
          priority INTEGER NOT NULL CHECK (priority IN (1, 2, 3)),
          description TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'In Progress', 'Complete', 'Closed/Won''t Fix')),
          version_completed TEXT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `;
      
      // Create feedback_attachments table
      const createAttachmentsTable = `
        CREATE TABLE feedback_attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          feedback_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (feedback_id) REFERENCES feedback_submissions(id) ON DELETE CASCADE
        )
      `;
      
      // Create feedback_comments table
      const createCommentsTable = `
        CREATE TABLE feedback_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          feedback_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          comment TEXT NOT NULL,
          is_admin_note INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (feedback_id) REFERENCES feedback_submissions(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `;
      
      // Create feedback_status_history table
      const createStatusHistoryTable = `
        CREATE TABLE feedback_status_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          feedback_id INTEGER NOT NULL,
          old_status TEXT NOT NULL,
          new_status TEXT NOT NULL,
          admin_notes TEXT NULL,
          changed_by INTEGER NOT NULL,
          changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (feedback_id) REFERENCES feedback_submissions(id) ON DELETE CASCADE,
          FOREIGN KEY (changed_by) REFERENCES users(id)
        )
      `;
      
      // Execute table creation
      db.run(createSubmissionsTable, [], (err) => {
        if (err) {
          console.error('Migration error: Failed to create feedback_submissions table:', err);
          return callback(err);
        }
        console.log('✓ Created feedback_submissions table');
        
        db.run(createAttachmentsTable, [], (err) => {
          if (err) {
            console.error('Migration error: Failed to create feedback_attachments table:', err);
            return callback(err);
          }
          console.log('✓ Created feedback_attachments table');
          
          db.run(createCommentsTable, [], (err) => {
            if (err) {
              console.error('Migration error: Failed to create feedback_comments table:', err);
              return callback(err);
            }
            console.log('✓ Created feedback_comments table');
            
            db.run(createStatusHistoryTable, [], (err) => {
              if (err) {
                console.error('Migration error: Failed to create feedback_status_history table:', err);
                return callback(err);
              }
              console.log('✓ Created feedback_status_history table');
              console.log('✓ Feedback module migration completed successfully');
              callback(null);
            });
          });
        });
      });
    });
  });
}

module.exports = { runMigration };

