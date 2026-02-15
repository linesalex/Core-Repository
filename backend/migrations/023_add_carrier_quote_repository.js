// Migration: Create Carrier Quote Repository tables
// Stores carrier network bandwidth quotes with KMZ route data, attachments, and custom locations

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Create Carrier Quote Repository tables');
  
  db.serialize(() => {
    // Check if carrier_quotes table already exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='carrier_quotes'", [], (err, table) => {
      if (err) {
        console.error('Migration error: Failed to check for carrier_quotes table:', err);
        return callback(err);
      }
      
      if (table) {
        console.log('✓ Carrier Quote Repository tables already exist');
        return callback(null);
      }
      
      // Create carrier_quotes table
      const createQuotesTable = `
        CREATE TABLE carrier_quotes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quote_reference TEXT NOT NULL UNIQUE,
          carrier_id INTEGER,
          carrier_name TEXT NOT NULL,
          carrier_quote_ref TEXT,
          service_type TEXT NOT NULL CHECK (service_type IN ('MPLS', 'Ethernet', 'Dark Fiber', 'Wavelength')),
          region TEXT NOT NULL CHECK (region IN ('AMERs', 'APAC', 'EMEA', 'INTER')),
          location_a_type TEXT NOT NULL CHECK (location_a_type IN ('pop', 'custom')),
          location_a_pop_code TEXT,
          location_a_custom_id INTEGER,
          location_b_type TEXT NOT NULL CHECK (location_b_type IN ('pop', 'custom')),
          location_b_pop_code TEXT,
          location_b_custom_id INTEGER,
          bandwidth_value REAL NOT NULL,
          bandwidth_unit TEXT NOT NULL CHECK (bandwidth_unit IN ('Mbps', 'Gbps', 'Dark Fiber')),
          mrc REAL,
          nrc REAL,
          currency TEXT NOT NULL DEFAULT 'USD',
          contract_term INTEGER CHECK (contract_term IN (12, 24, 36)),
          expected_latency REAL,
          protection TEXT CHECK (protection IN ('Unprotected', 'Protected', 'Diverse')),
          cable_system TEXT,
          quote_date TEXT,
          expiry_date TEXT,
          transit_cities TEXT,
          transit_countries TEXT,
          route_distance_km REAL,
          kmz_file_path TEXT,
          notes TEXT,
          created_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_by INTEGER,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (carrier_id) REFERENCES carriers(id),
          FOREIGN KEY (location_a_custom_id) REFERENCES quote_custom_locations(id),
          FOREIGN KEY (location_b_custom_id) REFERENCES quote_custom_locations(id),
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `;
      
      // Create quote_custom_locations table (hidden table for reusable custom locations)
      const createCustomLocationsTable = `
        CREATE TABLE quote_custom_locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          location_name TEXT NOT NULL,
          address TEXT,
          city TEXT,
          country TEXT,
          latitude REAL,
          longitude REAL,
          created_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `;
      
      // Create quote_attachments table (for KMZ, PDF, eml, documents)
      const createAttachmentsTable = `
        CREATE TABLE quote_attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quote_id INTEGER NOT NULL,
          file_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_size INTEGER,
          attachment_type TEXT NOT NULL CHECK (attachment_type IN ('kmz', 'document')),
          uploaded_by INTEGER,
          uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (quote_id) REFERENCES carrier_quotes(id) ON DELETE CASCADE,
          FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
      `;
      
      // Create indexes for common queries
      const createIndexes = [
        'CREATE INDEX idx_carrier_quotes_carrier_id ON carrier_quotes(carrier_id)',
        'CREATE INDEX idx_carrier_quotes_region ON carrier_quotes(region)',
        'CREATE INDEX idx_carrier_quotes_service_type ON carrier_quotes(service_type)',
        'CREATE INDEX idx_carrier_quotes_quote_reference ON carrier_quotes(quote_reference)',
        'CREATE INDEX idx_carrier_quotes_location_a_pop ON carrier_quotes(location_a_pop_code)',
        'CREATE INDEX idx_carrier_quotes_location_b_pop ON carrier_quotes(location_b_pop_code)',
        'CREATE INDEX idx_carrier_quotes_created_at ON carrier_quotes(created_at)',
        'CREATE INDEX idx_quote_attachments_quote_id ON quote_attachments(quote_id)',
        'CREATE INDEX idx_quote_custom_locations_name ON quote_custom_locations(location_name)'
      ];
      
      // Execute table creation
      db.run(createQuotesTable, (err) => {
        if (err) {
          console.error('Migration error: Failed to create carrier_quotes table:', err);
          return callback(err);
        }
        console.log('✓ Created carrier_quotes table');
        
        db.run(createCustomLocationsTable, (err) => {
          if (err) {
            console.error('Migration error: Failed to create quote_custom_locations table:', err);
            return callback(err);
          }
          console.log('✓ Created quote_custom_locations table');
          
          db.run(createAttachmentsTable, (err) => {
            if (err) {
              console.error('Migration error: Failed to create quote_attachments table:', err);
              return callback(err);
            }
            console.log('✓ Created quote_attachments table');
            
            // Create indexes
            let indexCount = 0;
            const totalIndexes = createIndexes.length;
            
            createIndexes.forEach((indexSql) => {
              db.run(indexSql, (err) => {
                if (err) {
                  console.warn('Warning: Index creation issue:', err.message);
                }
                indexCount++;
                if (indexCount === totalIndexes) {
                  console.log(`✓ Created ${totalIndexes} indexes for carrier quote repository`);
                  console.log('✓ Migration complete: Carrier Quote Repository tables created');
                  callback(null);
                }
              });
            });
          });
        });
      });
    });
  });
}

module.exports = { runMigration };
