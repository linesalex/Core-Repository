/**
 * Migration: Extranet Module Updates
 * 
 * Adds:
 * - design_template_path to extranet_products
 * - previously_known_as to extranet_providers
 * - contact_level to extranet_contacts and exchange_contacts
 * - country column to extranet_pricing_cities
 * - Updates rate card default to 'POA'
 * - Updates resiliency CHECK constraints to new values
 */

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Extranet Module Updates');
  
  // Step 1: Recreate extranet_providers table with new constraints and columns
  const recreateProviders = () => {
    console.log('Updating extranet_providers table...');
    
    // Check if table needs updating by trying to insert a test value
    db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='extranet_providers'`, [], (err, result) => {
      if (err) {
        console.error('Error checking extranet_providers schema:', err.message);
        return continueWithColumns();
      }
      
      // Check if already has new constraints
      if (result && result.sql && result.sql.includes('Multi-Site Resilient')) {
        console.log('✓ extranet_providers already has updated constraints');
        return recreateProducts();
      }
      
      // Create new table with updated constraints
      db.run(`
        CREATE TABLE IF NOT EXISTS extranet_providers_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider_name TEXT NOT NULL,
          region TEXT NOT NULL CHECK (region IN ('AMERs', 'APAC', 'EMEA')),
          salesperson_assigned TEXT,
          provider_resiliency TEXT CHECK (provider_resiliency IN ('Multi-Site Resilient', 'Split-Site Resilient', 'Single-Site Resilient', 'Single-Site Non-Resilient')),
          website_link TEXT,
          available INTEGER NOT NULL DEFAULT 1,
          more_info TEXT,
          previously_known_as TEXT,
          created_by INTEGER,
          updated_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(provider_name, region),
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `, [], (err) => {
        if (err) {
          console.error('Error creating extranet_providers_new:', err.message);
          return continueWithColumns();
        }
        
        // Get column list from old table
        db.all(`PRAGMA table_info(extranet_providers)`, [], (err, columns) => {
          if (err) {
            console.error('Error getting column info:', err.message);
            return continueWithColumns();
          }
          
          const columnNames = columns.map(c => c.name);
          const hasPreviouslyKnownAs = columnNames.includes('previously_known_as');
          
          // Build INSERT statement based on available columns
          let insertColumns = 'id, provider_name, region, salesperson_assigned, provider_resiliency, website_link, available, more_info, created_by, updated_by, created_at, updated_at';
          let selectColumns = insertColumns;
          
          if (hasPreviouslyKnownAs) {
            insertColumns += ', previously_known_as';
            selectColumns += ', previously_known_as';
          }
          
          // Copy data, converting old resiliency values
          db.run(`
            INSERT INTO extranet_providers_new (${insertColumns})
            SELECT ${selectColumns.replace('provider_resiliency', `
              CASE provider_resiliency
                WHEN 'Non-Resilient' THEN 'Single-Site Non-Resilient'
                WHEN 'Split Site Resilient' THEN 'Split-Site Resilient'
                WHEN 'Resilient' THEN NULL
                WHEN 'Multi-Region Resilient' THEN NULL
                ELSE provider_resiliency
              END`)}
            FROM extranet_providers
          `, [], (err) => {
            if (err) {
              console.error('Error copying extranet_providers data:', err.message);
              // Drop the new table and continue
              db.run(`DROP TABLE IF EXISTS extranet_providers_new`, [], () => continueWithColumns());
              return;
            }
            
            // Drop old table and rename new
            db.run(`DROP TABLE extranet_providers`, [], (err) => {
              if (err) {
                console.error('Error dropping old extranet_providers:', err.message);
                return continueWithColumns();
              }
              
              db.run(`ALTER TABLE extranet_providers_new RENAME TO extranet_providers`, [], (err) => {
                if (err) {
                  console.error('Error renaming extranet_providers_new:', err.message);
                  return continueWithColumns();
                }
                
                console.log('✓ Updated extranet_providers with new constraints');
                recreateProducts();
              });
            });
          });
        });
      });
    });
  };
  
  // Step 2: Recreate extranet_products table with new constraints and columns
  const recreateProducts = () => {
    console.log('Updating extranet_products table...');
    
    db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='extranet_products'`, [], (err, result) => {
      if (err) {
        console.error('Error checking extranet_products schema:', err.message);
        return continueWithColumns();
      }
      
      // Check if already has new constraints
      if (result && result.sql && result.sql.includes('Multi-Site Resilient')) {
        console.log('✓ extranet_products already has updated constraints');
        return continueWithColumns();
      }
      
      db.run(`
        CREATE TABLE IF NOT EXISTS extranet_products_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          isf TEXT,
          suggested_bandwidth TEXT,
          source_datacenters TEXT,
          isf_resiliency TEXT CHECK (isf_resiliency IN ('Single-Site Resilient', 'Multi-Site Resilient', 'Split-Site Resilient', 'Non-Resilient', 'Multi-Region Resilient')),
          design_file_path TEXT,
          design_template_path TEXT,
          more_info TEXT,
          created_by INTEGER,
          updated_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (provider_id) REFERENCES extranet_providers(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `, [], (err) => {
        if (err) {
          console.error('Error creating extranet_products_new:', err.message);
          return continueWithColumns();
        }
        
        // Get column list from old table
        db.all(`PRAGMA table_info(extranet_products)`, [], (err, columns) => {
          if (err) {
            console.error('Error getting column info:', err.message);
            return continueWithColumns();
          }
          
          const columnNames = columns.map(c => c.name);
          const hasDesignTemplate = columnNames.includes('design_template_path');
          
          let insertColumns = 'id, provider_id, product_name, isf, suggested_bandwidth, source_datacenters, isf_resiliency, design_file_path, more_info, created_by, updated_by, created_at, updated_at';
          let selectColumns = 'id, provider_id, product_name, isf, suggested_bandwidth, source_datacenters, isf_resiliency, design_file_path, more_info, created_by, updated_by, created_at, updated_at';
          
          if (hasDesignTemplate) {
            insertColumns += ', design_template_path';
            selectColumns += ', design_template_path';
          }
          
          // Copy data, converting old resiliency values
          db.run(`
            INSERT INTO extranet_products_new (${insertColumns})
            SELECT ${selectColumns.replace('isf_resiliency', `
              CASE isf_resiliency
                WHEN 'Resilient' THEN 'Non-Resilient'
                WHEN 'Split Site Resilient' THEN 'Split-Site Resilient'
                ELSE isf_resiliency
              END`)}
            FROM extranet_products
          `, [], (err) => {
            if (err) {
              console.error('Error copying extranet_products data:', err.message);
              db.run(`DROP TABLE IF EXISTS extranet_products_new`, [], () => continueWithColumns());
              return;
            }
            
            db.run(`DROP TABLE extranet_products`, [], (err) => {
              if (err) {
                console.error('Error dropping old extranet_products:', err.message);
                return continueWithColumns();
              }
              
              db.run(`ALTER TABLE extranet_products_new RENAME TO extranet_products`, [], (err) => {
                if (err) {
                  console.error('Error renaming extranet_products_new:', err.message);
                  return continueWithColumns();
                }
                
                console.log('✓ Updated extranet_products with new constraints');
                continueWithColumns();
              });
            });
          });
        });
      });
    });
  };
  
  // Step 3: Add new columns to other tables
  const continueWithColumns = () => {
    const alterStatements = [
      { sql: `ALTER TABLE extranet_products ADD COLUMN design_template_path TEXT`, name: 'design_template_path to extranet_products' },
      { sql: `ALTER TABLE extranet_providers ADD COLUMN previously_known_as TEXT`, name: 'previously_known_as to extranet_providers' },
      { sql: `ALTER TABLE extranet_contacts ADD COLUMN contact_level TEXT`, name: 'contact_level to extranet_contacts' },
      { sql: `ALTER TABLE extranet_contacts ADD COLUMN notes TEXT`, name: 'notes to extranet_contacts' },
      { sql: `ALTER TABLE exchange_contacts ADD COLUMN contact_level TEXT`, name: 'contact_level to exchange_contacts' },
      { sql: `ALTER TABLE exchange_contacts ADD COLUMN notes TEXT`, name: 'notes to exchange_contacts' },
      { sql: `ALTER TABLE extranet_pricing_cities ADD COLUMN country TEXT`, name: 'country to extranet_pricing_cities' }
    ];
    
    let index = 0;
    
    const runNextAlter = () => {
      if (index >= alterStatements.length) {
        runUpdates();
        return;
      }
      
      const stmt = alterStatements[index];
      db.run(stmt.sql, [], (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error(`Error adding ${stmt.name}:`, err.message);
        } else {
          console.log(`✓ Added ${stmt.name}`);
        }
        index++;
        runNextAlter();
      });
    };
    
    runNextAlter();
  };
  
  // Step 4: Run data updates
  const runUpdates = () => {
    db.run(`UPDATE extranet_contacts SET notes = more_info WHERE more_info IS NOT NULL AND (notes IS NULL OR notes = '')`, [], (err) => {
      if (err) console.error('Error copying more_info to notes:', err.message);
      else console.log('✓ Copied existing more_info to notes for extranet contacts');
      
      db.run(`UPDATE exchange_contacts SET notes = more_info WHERE more_info IS NOT NULL AND (notes IS NULL OR notes = '')`, [], (err) => {
        if (err) console.error('Error copying more_info to notes for exchange:', err.message);
        else console.log('✓ Copied existing more_info to notes for exchange contacts');
        
        db.run(`UPDATE extranet_rate_card SET price_usd = 'POA' WHERE price_usd = '0' OR price_usd = 0`, [], (err) => {
          if (err) console.error('Error updating rate card defaults:', err.message);
          else console.log('✓ Updated rate card defaults to POA');
          
          console.log('✓ Extranet module updates migration completed');
          callback(null);
        });
      });
    });
  };
  
  // Start migration
  recreateProviders();
}

module.exports = { runMigration };
