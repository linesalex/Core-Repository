// Migration: Add feedback read tracking
// Tracks when users last viewed feedback to show unread comments

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add feedback read tracking');
  
  // Check if feedback_views table already exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback_views'", [], (err, table) => {
    if (err) {
      console.error('Migration error: Failed to check for feedback_views table:', err);
      return callback(err);
    }
    
    if (table) {
      console.log('✓ Feedback views table already exists');
      return callback(null);
    }
    
    // Create feedback_views table to track when users last viewed each feedback
    const createViewsTable = `
      CREATE TABLE feedback_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feedback_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        last_viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (feedback_id) REFERENCES feedback_submissions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(feedback_id, user_id)
      )
    `;
    
    db.run(createViewsTable, [], (err) => {
      if (err) {
        console.error('Migration error: Failed to create feedback_views table:', err);
        return callback(err);
      }
      console.log('✓ Created feedback_views table');
      console.log('✓ Feedback read tracking migration completed successfully');
      callback(null);
    });
  });
}

module.exports = { runMigration };

