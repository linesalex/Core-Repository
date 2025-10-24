// Migration: Add rack types (Shared/Dedicated), RU fields, and devices table
// Supports non-contiguous RU allocations and Space & Power UCN tracking across racks

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration: Add rack types, RU fields, and devices table');
  
  db.serialize(() => {
    // Step 1: Add columns to cnx_colocation_racks
    db.all("PRAGMA table_info(cnx_colocation_racks)", [], (err, columns) => {
      if (err) {
        console.error('Migration error: Failed to check cnx_colocation_racks table info:', err);
        return callback(err);
      }
      
      const columnNames = columns.map(col => col.name);
      const columnsToAdd = [];
      
      if (!columnNames.includes('rack_type')) {
        columnsToAdd.push("ALTER TABLE cnx_colocation_racks ADD COLUMN rack_type TEXT NOT NULL DEFAULT 'shared' CHECK (rack_type IN ('shared', 'dedicated'))");
      }
      if (!columnNames.includes('total_ru')) {
        columnsToAdd.push("ALTER TABLE cnx_colocation_racks ADD COLUMN total_ru INTEGER NOT NULL DEFAULT 30");
      }
      if (!columnNames.includes('ipc_reserved_ru_ranges')) {
        columnsToAdd.push("ALTER TABLE cnx_colocation_racks ADD COLUMN ipc_reserved_ru_ranges TEXT NULL"); // JSON array of {start, end}
      }
      if (!columnNames.includes('tor_network_infrastructure')) {
        columnsToAdd.push("ALTER TABLE cnx_colocation_racks ADD COLUMN tor_network_infrastructure INTEGER NOT NULL DEFAULT 0");
      }
      if (!columnNames.includes('rack_design_file')) {
        columnsToAdd.push("ALTER TABLE cnx_colocation_racks ADD COLUMN rack_design_file TEXT NULL");
      }
      
      // Execute rack table alterations
      let rackAlterationsComplete = 0;
      const totalRackAlterations = columnsToAdd.length;
      
      if (totalRackAlterations === 0) {
        console.log('✓ cnx_colocation_racks columns already exist');
        proceedToClientsTable();
        return;
      }
      
      columnsToAdd.forEach(sql => {
        db.run(sql, [], (err) => {
          if (err) {
            console.error('Migration error: Failed to alter cnx_colocation_racks:', err);
            return callback(err);
          }
          rackAlterationsComplete++;
          if (rackAlterationsComplete === totalRackAlterations) {
            console.log('✓ cnx_colocation_racks columns added successfully');
            proceedToClientsTable();
          }
        });
      });
    });
    
    function proceedToClientsTable() {
      // Step 2: Add columns to cnx_colocation_clients
      db.all("PRAGMA table_info(cnx_colocation_clients)", [], (err, columns) => {
        if (err) {
          console.error('Migration error: Failed to check cnx_colocation_clients table info:', err);
          return callback(err);
        }
        
        const columnNames = columns.map(col => col.name);
        const columnsToAdd = [];
        
        if (!columnNames.includes('ru_ranges')) {
          columnsToAdd.push("ALTER TABLE cnx_colocation_clients ADD COLUMN ru_ranges TEXT NULL"); // JSON array of {start, end}
        }
        if (!columnNames.includes('space_power_ucn')) {
          columnsToAdd.push("ALTER TABLE cnx_colocation_clients ADD COLUMN space_power_ucn TEXT NULL");
        }
        if (!columnNames.includes('design_sharepoint_link')) {
          columnsToAdd.push("ALTER TABLE cnx_colocation_clients ADD COLUMN design_sharepoint_link TEXT NULL");
        }
        
        // Execute client table alterations
        let clientAlterationsComplete = 0;
        const totalClientAlterations = columnsToAdd.length;
        
        if (totalClientAlterations === 0) {
          console.log('✓ cnx_colocation_clients columns already exist');
          proceedToDevicesTable();
          return;
        }
        
        columnsToAdd.forEach(sql => {
          db.run(sql, [], (err) => {
            if (err) {
              console.error('Migration error: Failed to alter cnx_colocation_clients:', err);
              return callback(err);
            }
            clientAlterationsComplete++;
            if (clientAlterationsComplete === totalClientAlterations) {
              console.log('✓ cnx_colocation_clients columns added successfully');
              proceedToDevicesTable();
            }
          });
        });
      });
    }
    
    function proceedToDevicesTable() {
      // Step 3: Create cnx_rack_devices table
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='cnx_rack_devices'", [], (err, table) => {
        if (err) {
          console.error('Migration error: Failed to check for cnx_rack_devices table:', err);
          return callback(err);
        }
        
        if (table) {
          console.log('✓ cnx_rack_devices table already exists');
          return callback(null);
        }
        
        const createTableSQL = `
          CREATE TABLE cnx_rack_devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rack_id INTEGER NOT NULL,
            client_id INTEGER NULL,
            name TEXT NOT NULL,
            model TEXT NULL,
            serial TEXT NULL,
            start_ru INTEGER NOT NULL,
            height_ru INTEGER NOT NULL DEFAULT 1,
            position TEXT NOT NULL DEFAULT 'front' CHECK (position IN ('front', 'rear')),
            power_kw REAL NULL,
            notes TEXT NULL,
            created_by INTEGER,
            updated_by INTEGER,
            created_date TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_date TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (rack_id) REFERENCES cnx_colocation_racks(id) ON DELETE CASCADE,
            FOREIGN KEY (client_id) REFERENCES cnx_colocation_clients(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (updated_by) REFERENCES users(id)
          )
        `;
        
        db.run(createTableSQL, [], (err) => {
          if (err) {
            console.error('Migration error: Failed to create cnx_rack_devices table:', err);
            return callback(err);
          }
          
          console.log('✓ cnx_rack_devices table created successfully');
          console.log('✓ Migration completed successfully');
          callback(null);
        });
      });
    }
  });
}

module.exports = { runMigration };

