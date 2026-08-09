// Migration 049: Shared customers master table
//
// Creates a `customers` table used as the single source of truth for customer
// names across the app (Network Design, Allocated Cost Calculator, Extranet
// Pricing, One Directory, Exchange Pricing, and the new Customer Routes
// module). Backfills existing free-text customer names from structured
// columns where they exist, and adds a `customer_id` link column to those
// tables so future writes can reference the master record while keeping a
// denormalized name snapshot for historical accuracy.
//
// All source tables are checked for existence/columns before use since some
// (e.g. extranet_pricing_lookups, extranet_bundle_logs) may have been
// removed by a later cleanup migration on some databases.

const db = require('../db');

const SOURCE_TABLES = [
  { table: 'quote_requests', column: 'customer_name' },
  { table: 'extranet_pricing_lookups', column: 'customer_name' },
  { table: 'extranet_bundle_logs', column: 'customer_name' },
  { table: 'one_directory_bundle_logs', column: 'customer_name' },
  { table: 'one_directory_pricing_logs', column: 'customer_name' }
];

function tableExists(tableName, callback) {
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName], (err, row) => {
    if (err) return callback(err, false);
    callback(null, !!row);
  });
}

function columnExists(tableName, columnName, callback) {
  db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
    if (err) return callback(err, false);
    callback(null, (columns || []).some(c => c.name === columnName));
  });
}

function runMigration(callback) {
  console.log('Running migration 049: Shared customers master table...');

  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_normalized TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `, (err) => {
    if (err) return callback(err);
    console.log('✓ Ensured customers table exists');

    db.run('CREATE INDEX IF NOT EXISTS idx_customers_name_normalized ON customers(name_normalized)', (idxErr) => {
      if (idxErr) return callback(idxErr);

      backfillFromSources(0, () => {
        addCustomerIdColumns(0, (colErr) => {
          if (colErr) return callback(colErr);
          console.log('✓ Migration 049 completed');
          callback(null);
        });
      });
    });
  });

  function backfillFromSources(index, done) {
    if (index >= SOURCE_TABLES.length) {
      console.log('✓ Finished backfilling customers from existing sources');
      return done();
    }
    const { table, column } = SOURCE_TABLES[index];

    tableExists(table, (existsErr, exists) => {
      if (existsErr || !exists) {
        return backfillFromSources(index + 1, done);
      }
      columnExists(table, column, (colErr, hasColumn) => {
        if (colErr || !hasColumn) {
          return backfillFromSources(index + 1, done);
        }
        db.all(
          `SELECT DISTINCT ${column} as name FROM ${table} WHERE ${column} IS NOT NULL AND TRIM(${column}) != ''`,
          [],
          (selErr, rows) => {
            if (selErr) {
              console.warn(`Warning reading distinct customer names from ${table}:`, selErr.message);
              return backfillFromSources(index + 1, done);
            }
            insertNames((rows || []).map(r => r.name), () => backfillFromSources(index + 1, done));
          }
        );
      });
    });
  }

  function insertNames(names, done) {
    let i = 0;
    const next = () => {
      if (i >= names.length) return done();
      const name = String(names[i++]).trim();
      if (!name) return next();
      const normalized = name.toLowerCase();
      db.run(
        'INSERT OR IGNORE INTO customers (name, name_normalized) VALUES (?, ?)',
        [name, normalized],
        (insErr) => {
          if (insErr) console.warn(`Warning inserting customer "${name}":`, insErr.message);
          next();
        }
      );
    };
    next();
  }

  function addCustomerIdColumns(index, done) {
    if (index >= SOURCE_TABLES.length) return done(null);
    const { table } = SOURCE_TABLES[index];

    tableExists(table, (existsErr, exists) => {
      if (existsErr || !exists) {
        return addCustomerIdColumns(index + 1, done);
      }
      columnExists(table, 'customer_id', (colErr, hasColumn) => {
        if (colErr) return done(colErr);
        if (hasColumn) {
          return addCustomerIdColumns(index + 1, done);
        }
        db.run(`ALTER TABLE ${table} ADD COLUMN customer_id INTEGER REFERENCES customers(id)`, (alterErr) => {
          if (alterErr) {
            console.warn(`Warning adding customer_id to ${table}:`, alterErr.message);
            return addCustomerIdColumns(index + 1, done);
          }
          console.log(`  Added customer_id column to ${table}`);
          addCustomerIdColumns(index + 1, done);
        });
      });
    });
  }
}

module.exports = { runMigration };
