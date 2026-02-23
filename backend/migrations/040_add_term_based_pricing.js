const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 040: Add term-based pricing columns to carrier_quotes...');

  db.all("PRAGMA table_info(carrier_quotes)", [], (err, columns) => {
    if (err) return callback(err);

    const existingCols = columns.map(c => c.name);
    const newCols = [
      { name: 'mrc_12', type: 'REAL' },
      { name: 'nrc_12', type: 'REAL' },
      { name: 'mrc_24', type: 'REAL' },
      { name: 'nrc_24', type: 'REAL' },
      { name: 'mrc_36', type: 'REAL' },
      { name: 'nrc_36', type: 'REAL' }
    ];

    const colsToAdd = newCols.filter(c => !existingCols.includes(c.name));

    const addColumns = (idx) => {
      if (idx >= colsToAdd.length) {
        addContractTermToStages();
        return;
      }
      const col = colsToAdd[idx];
      db.run(`ALTER TABLE carrier_quotes ADD COLUMN ${col.name} ${col.type}`, (err) => {
        if (err) return callback(err);
        console.log(`  Added column ${col.name}`);
        addColumns(idx + 1);
      });
    };

    const addContractTermToStages = () => {
      db.all("PRAGMA table_info(quote_price_stages)", [], (err, stageCols) => {
        if (err) return callback(err);

        const hasContractTerm = stageCols.some(c => c.name === 'contract_term');
        if (hasContractTerm) {
          migrateExistingData();
          return;
        }

        db.run('ALTER TABLE quote_price_stages ADD COLUMN contract_term INTEGER', (err) => {
          if (err) return callback(err);
          console.log('  Added contract_term column to quote_price_stages');
          migrateExistingData();
        });
      });
    };

    const migrateExistingData = () => {
      db.all('SELECT id, mrc, nrc, contract_term FROM carrier_quotes WHERE contract_term IS NOT NULL AND (mrc IS NOT NULL OR nrc IS NOT NULL)', [], (err, quotes) => {
        if (err) return callback(err);

        if (!quotes || quotes.length === 0) {
          console.log('  No existing data to migrate');
          finalize();
          return;
        }

        let migrated = 0;
        const migrateNext = (idx) => {
          if (idx >= quotes.length) {
            console.log(`  Migrated pricing data for ${migrated} existing quotes`);
            migrateStages();
            return;
          }

          const q = quotes[idx];
          const term = parseInt(q.contract_term, 10);
          if (![12, 24, 36].includes(term)) {
            migrateNext(idx + 1);
            return;
          }

          const mrcCol = `mrc_${term}`;
          const nrcCol = `nrc_${term}`;
          db.run(
            `UPDATE carrier_quotes SET ${mrcCol} = ?, ${nrcCol} = ? WHERE id = ? AND ${mrcCol} IS NULL`,
            [q.mrc, q.nrc, q.id],
            (err) => {
              if (err) console.warn(`  Warning: failed to migrate quote ${q.id}:`, err.message);
              else migrated++;
              migrateNext(idx + 1);
            }
          );
        };

        migrateNext(0);
      });
    };

    const migrateStages = () => {
      db.run(`
        UPDATE quote_price_stages
        SET contract_term = (
          SELECT cq.contract_term FROM carrier_quotes cq WHERE cq.id = quote_price_stages.quote_id
        )
        WHERE contract_term IS NULL
          AND EXISTS (
            SELECT 1 FROM carrier_quotes cq
            WHERE cq.id = quote_price_stages.quote_id
              AND cq.contract_term IN (12, 24, 36)
          )
      `, (err) => {
        if (err) console.warn('  Warning: failed to migrate price stages:', err.message);
        else console.log('  Migrated contract_term on existing price stages');
        finalize();
      });
    };

    const finalize = () => {
      console.log('✓ Migration 040 completed: term-based pricing columns added');
      callback(null);
    };

    if (colsToAdd.length === 0) {
      console.log('  Pricing columns already exist, checking stages...');
      addContractTermToStages();
    } else {
      addColumns(0);
    }
  });
}

module.exports = { runMigration };
