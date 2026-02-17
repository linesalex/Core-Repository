// Migration 035: Add One Control ISF and off-net parameters for Voice One Directory
// Adds one_control_mrc, one_control_bandwidth, off_net_min_bandwidth_mb parameters
// Also removes deprecated split_site and dual_site resiliency parameters

const db = require('../db');

function runMigration(callback) {
  console.log('Running migration 035: Add One Control ISF and off-net parameters...');

  const newParams = [
    // One Control ISF
    { key: 'one_control_mrc', value: '100', type: 'amount', desc: 'One Control ISF fixed MRC (USD) — deducted from One Directory rate card price, not discountable' },
    { key: 'one_control_bandwidth', value: '5Mb', type: 'json', desc: 'One Control ISF fixed bandwidth' },

    // Off-net minimum
    { key: 'off_net_min_bandwidth_mb', value: '10', type: 'number', desc: 'Minimum total bandwidth (Mb) for Off Net connections (excludes One Control)' },

    // ISF display names
    { key: 'isf_name_directory', value: 'One Directory ISF', type: 'json', desc: 'Display name for the directory bandwidth service' },
    { key: 'isf_name_b2b_agility', value: 'B2B Agility ISF', type: 'json', desc: 'Display name for the B2B Agility service' },
    { key: 'isf_name_safe_connect', value: 'Safe Connect ISF', type: 'json', desc: 'Display name for the Safe Connect service' },
    { key: 'isf_name_one_control', value: 'One Control ISF', type: 'json', desc: 'Display name for the One Control service' }
  ];

  let insertCount = 0;
  let completedInserts = 0;

  function insertNext() {
    if (insertCount >= newParams.length) {
      console.log(`✓ Inserted ${completedInserts} new One Control/ISF parameters`);
      removeDeprecatedParams();
      return;
    }

    const p = newParams[insertCount];
    db.run(
      'INSERT OR IGNORE INTO one_directory_parameters (param_key, param_value, param_type, description) VALUES (?, ?, ?, ?)',
      [p.key, p.value, p.type, p.desc],
      function(err) {
        if (err) {
          console.error(`Warning: Failed to insert ${p.key}:`, err);
        } else if (this.changes > 0) {
          completedInserts++;
        }
        insertCount++;
        insertNext();
      }
    );
  }

  function removeDeprecatedParams() {
    // Remove split_site and dual_site resiliency params (no longer used)
    db.run(
      "DELETE FROM one_directory_parameters WHERE param_key IN ('resiliency_split_site', 'resiliency_dual_site')",
      function(err) {
        if (err) {
          console.error('Warning: Failed to remove deprecated resiliency params:', err);
        } else if (this.changes > 0) {
          console.log(`✓ Removed ${this.changes} deprecated resiliency parameters`);
        }
        console.log('Migration 035 completed successfully');
        callback(null);
      }
    );
  }

  insertNext();
}

module.exports = { runMigration };
