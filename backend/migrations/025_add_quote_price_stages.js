// Migration 025: Add price stage tracking for carrier quotes
// Tracks negotiation stages: Initial Offer, Discounted, Best and Final, etc.

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 025: Add quote price stages...');
  
  // Check if table already exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='quote_price_stages'", [], (err, table) => {
    if (err) return callback(err);
    
    if (table) {
      console.log('✓ quote_price_stages table already exists, skipping');
      return callback(null);
    }
    
    db.run(`
      CREATE TABLE quote_price_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id INTEGER NOT NULL,
        stage_name TEXT NOT NULL,
        mrc REAL,
        nrc REAL,
        currency TEXT DEFAULT 'USD',
        notes TEXT,
        stage_date TEXT DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quote_id) REFERENCES carrier_quotes(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `, (err) => {
      if (err) return callback(err);
      
      db.run('CREATE INDEX idx_quote_price_stages_quote_id ON quote_price_stages(quote_id)', (err) => {
        if (err) console.warn('Index creation warning:', err.message);
        
        db.run('CREATE INDEX idx_quote_price_stages_stage_date ON quote_price_stages(stage_date)', (err) => {
          if (err) console.warn('Index creation warning:', err.message);
          
          console.log('✓ Migration 025 completed: quote_price_stages table created');
          callback(null);
        });
      });
    });
  });
}

module.exports = { runMigration };
