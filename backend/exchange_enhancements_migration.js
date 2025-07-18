const db = require('./db');

const enhancements = [
  {
    name: 'Add Yearly Tracking to Exchange Contacts',
    sql: `
      -- Add last_updated field to track yearly contact updates
      ALTER TABLE exchange_contacts ADD COLUMN last_updated DATETIME DEFAULT CURRENT_TIMESTAMP;
      
      -- Add approval tracking for yearly updates
      ALTER TABLE exchange_contacts ADD COLUMN approved_by INTEGER;
      ALTER TABLE exchange_contacts ADD COLUMN approved_at DATETIME;
      
      -- Update existing records to have last_updated as created_at
      UPDATE exchange_contacts SET last_updated = created_at WHERE last_updated IS NULL;
    `
  },
  {
    name: 'Add Salesperson Assigned Field to Exchanges',
    sql: `
      -- Add salesperson_assigned field between exchange_name and available
      ALTER TABLE exchanges ADD COLUMN salesperson_assigned TEXT;
    `
  },
  {
    name: 'Update Exchange Feeds ISF Structure',
    sql: `
      -- Add new ISF fields to replace isf_a and isf_b text fields
      ALTER TABLE exchange_feeds ADD COLUMN isf_enabled BOOLEAN DEFAULT 0;
      ALTER TABLE exchange_feeds ADD COLUMN isf_site_code_a TEXT;
      ALTER TABLE exchange_feeds ADD COLUMN isf_site_code_b TEXT;
      ALTER TABLE exchange_feeds ADD COLUMN isf_dr_site_code_a TEXT;
      ALTER TABLE exchange_feeds ADD COLUMN isf_dr_site_code_b TEXT;
      ALTER TABLE exchange_feeds ADD COLUMN isf_dr_type_a TEXT CHECK(isf_dr_type_a IN ('Cold', 'Live'));
      ALTER TABLE exchange_feeds ADD COLUMN isf_dr_type_b TEXT CHECK(isf_dr_type_b IN ('Cold', 'Live'));
      ALTER TABLE exchange_feeds ADD COLUMN order_entry_isf TEXT;
      
      -- Migrate existing isf_a and isf_b data
      UPDATE exchange_feeds SET 
        isf_enabled = 1, 
        isf_site_code_a = isf_a, 
        isf_site_code_b = isf_b 
      WHERE (isf_a IS NOT NULL AND isf_a != '') OR (isf_b IS NOT NULL AND isf_b != '');
    `
  },
  {
    name: 'Update Feed Type Options and Capitalization',
    sql: `
      -- Update feed_type constraint to include Mixed and proper capitalization
      -- Note: SQLite doesn't support ALTER COLUMN, so we'll handle validation in application
      -- Valid options: 'Equities', 'Futures', 'Options', 'Fixed Income', 'FX', 'Commodities', 'Indices', 'ETFs', 'Alternative Data', 'Reference Data', 'Mixed'
      
      -- Update existing data to proper capitalization
      UPDATE exchange_feeds SET feed_type = 'Equities' WHERE LOWER(feed_type) = 'equities';
      UPDATE exchange_feeds SET feed_type = 'Futures' WHERE LOWER(feed_type) = 'futures';
      UPDATE exchange_feeds SET feed_type = 'Options' WHERE LOWER(feed_type) = 'options';
      UPDATE exchange_feeds SET feed_type = 'ETFs' WHERE LOWER(feed_type) = 'etfs';
      UPDATE exchange_feeds SET feed_type = 'Indices' WHERE LOWER(feed_type) = 'indices';
      UPDATE exchange_feeds SET feed_type = 'Commodities' WHERE LOWER(feed_type) = 'commodities';
      UPDATE exchange_feeds SET feed_type = 'FX' WHERE LOWER(feed_type) = 'forex';
      UPDATE exchange_feeds SET feed_type = 'Fixed Income' WHERE LOWER(feed_type) = 'mutual funds';
      UPDATE exchange_feeds SET feed_type = 'Reference Data' WHERE LOWER(feed_type) = 'treasuries';
      UPDATE exchange_feeds SET feed_type = 'Alternative Data' WHERE LOWER(feed_type) = 'crypto';
    `
  }
];

function runEnhancements() {
  console.log('Starting Exchange Enhancements Migration...');
  
  let completed = 0;
  
  enhancements.forEach((enhancement, index) => {
    console.log(`Running: ${enhancement.name}`);
    
    db.exec(enhancement.sql, (err) => {
      if (err) {
        console.error(`Error in ${enhancement.name}:`, err.message);
      } else {
        console.log(`✅ Completed: ${enhancement.name}`);
      }
      
      completed++;
      if (completed === enhancements.length) {
        console.log('\n🎉 Exchange Enhancements Migration completed!');
        console.log('\nSummary:');
        console.log('- Added yearly tracking to Exchange Contacts');
        console.log('- Added Salesperson Assigned field to Exchanges');
        console.log('- Updated ISF structure in Exchange Feeds');
        console.log('- Updated Feed Type options and capitalization');
        
        db.close();
      }
    });
  });
}

// Run if called directly
if (require.main === module) {
  runEnhancements();
}

module.exports = { runEnhancements }; 