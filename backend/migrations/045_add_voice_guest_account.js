// Migration 045: Add a hidden "Voice Guest" system account
// Backs the no-credential "Continue as Voice Guest" login button, which lets
// anonymous visitors run the One Directory tool as a read-only user without
// a username/password. Reuses the existing per-module permission engine so
// all normal read_only restrictions/behaviour apply automatically.

const db = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const VOICE_GUEST_USERNAME = 'voice_guest';

function runMigration(callback) {
  console.log('Running migration 045: Add Voice Guest system account...');

  db.get('SELECT id FROM users WHERE username = ?', [VOICE_GUEST_USERNAME], (err, existingUser) => {
    if (err) {
      console.error('Migration 045 error checking for existing voice_guest user:', err);
      return callback(err);
    }

    if (existingUser) {
      console.log('✓ voice_guest user already exists, skipping creation');
      return ensureModulePermission(existingUser.id, callback);
    }

    // Random, never-used password - the guest login endpoint bypasses password
    // verification entirely for this account, so this hash is unreachable in practice.
    const randomPassword = crypto.randomBytes(32).toString('hex');

    bcrypt.hash(randomPassword, 10, (hashErr, passwordHash) => {
      if (hashErr) {
        console.error('Migration 045 error hashing password:', hashErr);
        return callback(hashErr);
      }

      db.run(
        `INSERT INTO users (username, password_hash, email, full_name, user_role, status, password_reset_required)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [VOICE_GUEST_USERNAME, passwordHash, 'voice-guest@system.local', 'Voice Module Guest', 'user', 'active', 0],
        function(insertErr) {
          if (insertErr) {
            console.error('Migration 045 error creating voice_guest user:', insertErr);
            return callback(insertErr);
          }
          console.log('✓ Created voice_guest system user (id: ' + this.lastID + ')');
          ensureModulePermission(this.lastID, callback);
        }
      );
    });
  });
}

function ensureModulePermission(userId, callback) {
  db.get(
    'SELECT id FROM user_module_permissions WHERE user_id = ? AND module_name = ?',
    [userId, 'voice_one_directory'],
    (err, existingPerm) => {
      if (err) {
        console.error('Migration 045 error checking for existing module permission:', err);
        return callback(err);
      }

      if (existingPerm) {
        console.log('✓ voice_guest module permission already exists');
        console.log('Migration 045 completed successfully');
        return callback(null);
      }

      db.run(
        `INSERT INTO user_module_permissions
         (user_id, module_name, permission_level, created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, 'voice_one_directory', 'read_only', null, null],
        (permErr) => {
          if (permErr) {
            console.error('Migration 045 error creating module permission:', permErr);
            return callback(permErr);
          }
          console.log('✓ Granted voice_guest read_only access to voice_one_directory');
          console.log('Migration 045 completed successfully');
          callback(null);
        }
      );
    }
  );
}

module.exports = { runMigration };
