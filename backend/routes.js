const express = require('express');
const db = require('./db');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Parser } = require('json2csv');
const archiver = require('archiver');
const csv = require('csv-parser');

// Store active upload sessions for progress tracking
const activeUploads = new Map();
const { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  authenticateToken, 
  authorizeRole, 
  authorizePermission, 
  getUserModulePermissions,
  hasModulePermission,
  authorizeModulePermission,
  logUserActivity 
} = require('./auth');
const { 
  handleDatabaseError, 
  createSuccessResponse, 
  createPaginatedResponse 
} = require('./dbErrorHandler');
const LiveLatencyService = require('./liveLatencyService');
const outageMonitor = require('./outageMonitorService');

// Regex for circuit_id: 6 uppercase letters + 6 digits
const CIRCUIT_ID_REGEX = /^[A-Z]{6}[0-9]{6}$/;

// Helper: Validate circuit_id
function isValidCircuitId(id) {
  return CIRCUIT_ID_REGEX.test(id);
}

const kmzStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'kmz_files'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: kmzStorage });

// Ensure kmz_files directory exists
const kmzDir = path.join(__dirname, 'kmz_files');
if (!fs.existsSync(kmzDir)) {
  fs.mkdirSync(kmzDir);
}

// Test Results file upload and download - support multiple files
const testResultsStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'test_results_files'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const testResultsUpload = multer({ storage: testResultsStorage });

// Ensure test_results_files directory exists
const testResultsDir = path.join(__dirname, 'test_results_files');
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir);
}

// Helper function to log changes with enhanced error handling
const logChange = (userId, tableName, recordId, action, oldValues, newValues, req) => {
  // Validate required parameters
  if (!tableName || !action) {
    console.error('logChange: Missing required parameters (tableName, action)');
    return;
  }
  
  // Handle missing userId - skip logging if user_id is required but not provided
  if (!userId && !req?.user?.id) {
    console.warn(`logChange: No user_id available for ${tableName} ${action} operation - skipping log`);
    return;
  }
  
  // Use provided userId or extract from request
  const safeUserId = userId || req?.user?.id;
  
  // Handle missing recordId by providing a default value
  const safeRecordId = recordId || 'N/A';
  
  // Log warning for operations that should have record IDs but don't
  if ((recordId === null || recordId === undefined) && (action === 'CREATE' || action === 'UPDATE' || action === 'DELETE')) {
    console.warn(`logChange: No record_id provided for ${tableName} ${action} operation - using 'N/A'`);
  }
  
  const changes = [];
  if (oldValues && newValues) {
    Object.keys(newValues).forEach(key => {
      if (oldValues[key] !== newValues[key]) {
        changes.push(`${key}: ${oldValues[key]} → ${newValues[key]}`);
      }
    });
  }
  
  const changesSummary = changes.length > 0 ? changes.join(', ') : `${action} operation`;
  const ipAddress = req?.ip || req?.connection?.remoteAddress || 'Unknown';
  const userAgent = req?.get?.('User-Agent') || 'Unknown';
  
  db.run(
    'INSERT INTO change_logs (user_id, table_name, record_id, action, old_values, new_values, changes_summary, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [safeUserId, tableName, safeRecordId, action, JSON.stringify(oldValues), JSON.stringify(newValues), changesSummary, ipAddress, userAgent],
    function(err) {
      if (err) {
        console.error('Failed to log change:', err.message);
        console.error('logChange parameters:', { userId: safeUserId, tableName, recordId: safeRecordId, action });
        // Don't throw - logging failures shouldn't break the main operation
      }
    }
  );
};

// ====================================
// HEALTH CHECK ENDPOINTS
// ====================================

// Health check endpoint
router.get('/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Network Inventory Backend',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };

  // Check database connectivity
  db.healthCheck((err, dbHealth, userError) => {
    if (err) {
      return res.status(503).json({
        ...healthCheck,
        status: 'unhealthy',
        database: {
          status: 'disconnected',
          error: userError?.message || 'Database connection failed',
          type: userError?.type || 'CONNECTION_ERROR'
        }
      });
    }

    res.status(200).json({
      ...healthCheck,
      status: 'healthy',
      database: dbHealth
    });
  });
});

// Database-specific health check endpoint
router.get('/health/database', (req, res) => {
  db.healthCheck((err, dbHealth, userError) => {
    if (err) {
      return res.status(503).json({
        status: 'unhealthy',
        error: userError?.message || 'Database health check failed',
        type: userError?.type || 'CONNECTION_ERROR',
        retryable: userError?.retryable || true,
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      status: 'healthy',
      ...dbHealth,
      checks: {
        connectivity: 'passed',
        responsiveness: dbHealth.responseTime,
        readWrite: 'available'
      }
    });
  });
});

// ====================================
// AUTHENTICATION ENDPOINTS
// ====================================

// Login endpoint
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  try {
    db.get('SELECT * FROM users WHERE username = ? AND status = "active"', [username], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const validPassword = await comparePassword(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Check if password change is required
      const passwordResetRequired = user.password_reset_required === 1;
      
      // Update last login
      db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      
      // Generate token
      const token = generateToken(user);
      
      // Use new per-module permission system
      getUserModulePermissions(user.id, (err, modulePermissions) => {
        if (err) {
          console.error('Error getting permissions:', err);
          return res.status(500).json({ error: 'Failed to get permissions' });
        }
        
        // Derive visibility from permissions (if a user has permission, module is visible)
        const moduleVisibility = {};
        const allModules = [
          'network_routes', 'network_design', 'locations', 'carriers', 'cnx_colocation',
          'exchange_rates', 'exchange_data', 'change_logs', 'user_management', 
          'bulk_upload', 'core_outages', 'minimum_pricing', 'pricing_logic', 'promo_pricing'
        ];
        
        allModules.forEach(module => {
          // Module is visible if user has any permission level for it
          moduleVisibility[module] = !!modulePermissions[module];
        });
        
        // Convert per-module permissions to legacy format for frontend compatibility
        const legacyPermissions = {};
        Object.keys(modulePermissions).forEach(module => {
          const permLevel = modulePermissions[module];
          legacyPermissions[module] = {
            can_view: permLevel === 'read_only' || permLevel === 'provisioner',
            can_create: permLevel === 'provisioner',
            can_edit: permLevel === 'provisioner',
            can_delete: permLevel === 'provisioner'
          };
        });
        
        // Log login activity
        logUserActivity(user.id, 'LOGIN', {
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent')
        });
        
        res.json({
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.user_role
          },
          permissions: legacyPermissions,
          modulePermissions, // New per-module permissions
          moduleVisibility,
          passwordResetRequired
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user info
router.get('/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, full_name, user_role, password_reset_required FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Use new per-module permission system
    getUserModulePermissions(user.id, (err, modulePermissions) => {
      if (err) return res.status(500).json({ error: 'Failed to get permissions' });
      
      // Derive visibility from permissions (if a user has permission, module is visible)
      const moduleVisibility = {};
      const allModules = [
        'network_routes', 'network_design', 'locations', 'carriers', 'cnx_colocation',
        'exchange_rates', 'exchange_data', 'change_logs', 'user_management', 
        'bulk_upload', 'core_outages', 'minimum_pricing', 'pricing_logic', 'promo_pricing'
      ];
      
      allModules.forEach(module => {
        // Module is visible if user has any permission level for it
        moduleVisibility[module] = !!modulePermissions[module];
      });
      
      // Convert per-module permissions to legacy format for frontend compatibility
      const legacyPermissions = {};
      Object.keys(modulePermissions).forEach(module => {
        const permLevel = modulePermissions[module];
        legacyPermissions[module] = {
          can_view: permLevel === 'read_only' || permLevel === 'provisioner',
          can_create: permLevel === 'provisioner',
          can_edit: permLevel === 'provisioner',
          can_delete: permLevel === 'provisioner'
        };
      });
      
      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.user_role
        },
        permissions: legacyPermissions,
        modulePermissions, // New per-module permissions
        moduleVisibility,
        passwordResetRequired: user.password_reset_required === 1
      });
    });
  });
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }
  
  try {
    db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id], async (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      const validPassword = await comparePassword(currentPassword, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      
      const hashedNewPassword = await hashPassword(newPassword);
      
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hashedNewPassword, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update password' });
        
        logUserActivity(req.user.id, 'PASSWORD_CHANGE', {
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent')
        });
        
        res.json({ message: 'Password updated successfully' });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Password change failed' });
  }
});

// Forced password change (for reset passwords)
router.put('/forced-password-change', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }
  
  if (newPassword === 'abc123') {
    return res.status(400).json({ error: 'New password cannot be the default reset password' });
  }
  
  try {
    db.get('SELECT password_hash, password_reset_required FROM users WHERE id = ?', [req.user.id], async (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      // Verify current password
      const validPassword = await comparePassword(currentPassword, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      
      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);
      
      // Update password and clear reset flag
      db.run(
        'UPDATE users SET password_hash = ?, password_reset_required = 0 WHERE id = ?', 
        [hashedNewPassword, req.user.id], 
        function(err) {
          if (err) return res.status(500).json({ error: 'Failed to update password' });
          
          // Log the password change
          logUserActivity(req.user.id, 'FORCED_PASSWORD_CHANGE', {
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            reason: 'Password reset completion'
          });
          
          res.json({ 
            message: 'Password changed successfully. Please log in again with your new password.',
            logout: true
          });
        }
      );
    });
  } catch (error) {
    console.error('Forced password change error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

// ====================================
// USER REGISTRATION & APPROVAL
// ====================================

// User registration endpoint (public - no authentication required)
router.post('/register', async (req, res) => {
  const { username, full_name, email } = req.body;
  
  // Validate required fields
  if (!username || !full_name || !email) {
    return res.status(400).json({ error: 'Username, full name, and email are required' });
  }
  
  // Normalize username
  const normalizedUsername = username.toLowerCase().trim();
  const trimmedUsername = username.trim();
  
  // Check if username or email already exists
  db.get('SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?', 
    [normalizedUsername, email.toLowerCase().trim()], async (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    try {
      // Create user with pending approval status and default password
      const hashedPassword = await hashPassword('abc123');
      
      db.run(
        'INSERT INTO users (username, password_hash, email, full_name, user_role, status, password_reset_required, approval_status, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [trimmedUsername, hashedPassword, email.trim(), full_name.trim(), 'read_only', 'inactive', 1, 'pending', new Date().toISOString()],
        function (err) {
          if (err) {
            console.error('Error creating user registration:', err);
            return res.status(500).json({ error: 'Registration failed' });
          }
          
          // Log the registration request
          logChange(null, 'users', this.lastID, 'REGISTER_REQUEST', null, { 
            username: trimmedUsername, email: email.trim(), full_name: full_name.trim(),
            approval_status: 'pending'
          }, req);
          
          res.status(201).json({ 
            message: 'Registration request submitted successfully. An administrator will review your request.'
          });
        }
      );
    } catch (error) {
      console.error('Error hashing password for registration:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });
});

// Get pending user registrations (admin only)
router.get('/users/pending', authenticateToken, authorizeRole('administrator'), (req, res) => {
  db.all(
    'SELECT id, username, email, full_name, requested_at FROM users WHERE approval_status = ? ORDER BY requested_at ASC',
    ['pending'],
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(users);
    }
  );
});

// Approve user registration (admin only)
router.post('/users/:id/approve', authenticateToken, authorizeRole('administrator'), (req, res) => {
  const userId = req.params.id;
  const { user_role, module_visibility } = req.body;
  
  if (!user_role) {
    return res.status(400).json({ error: 'User role is required' });
  }
  
  // Get user details first
  db.get('SELECT * FROM users WHERE id = ? AND approval_status = ?', [userId, 'pending'], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Pending user not found' });
    
    // Update user with approved status
    db.run(
      'UPDATE users SET approval_status = ?, status = ?, user_role = ?, approved_by = ?, approved_at = ? WHERE id = ?',
      ['approved', 'active', user_role, req.user.id, new Date().toISOString(), userId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Set module visibility if provided
        if (module_visibility && typeof module_visibility === 'object') {
          const visibilityPromises = Object.entries(module_visibility).map(([moduleName, isVisible]) => {
            return new Promise((resolve, reject) => {
              db.run(
                'INSERT OR REPLACE INTO user_module_visibility (user_id, module_name, is_visible) VALUES (?, ?, ?)',
                [userId, moduleName, isVisible ? 1 : 0],
                function(err) {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
          });
          
          Promise.all(visibilityPromises)
            .then(() => {
              // Log the approval
              logChange(req.user.id, 'users', userId, 'APPROVE_REGISTRATION', 
                { approval_status: 'pending', status: 'inactive', user_role: 'read_only' },
                { approval_status: 'approved', status: 'active', user_role, approved_by: req.user.id, module_visibility }, req);
              
              res.json({ message: 'User approved successfully with module visibility settings' });
            })
            .catch((visErr) => {
              console.error('Failed to set module visibility:', visErr);
              res.json({ message: 'User approved successfully, but failed to set some module visibility settings' });
            });
        } else {
          // Log the approval without module visibility
          logChange(req.user.id, 'users', userId, 'APPROVE_REGISTRATION', 
            { approval_status: 'pending', status: 'inactive', user_role: 'read_only' },
            { approval_status: 'approved', status: 'active', user_role, approved_by: req.user.id }, req);
          
          res.json({ message: 'User approved successfully' });
        }
      }
    );
  });
});

// Reject user registration (admin only)
router.delete('/users/:id/reject', authenticateToken, authorizeRole('administrator'), (req, res) => {
  const userId = req.params.id;
  
  // Get user details first for logging
  db.get('SELECT * FROM users WHERE id = ? AND approval_status = ?', [userId, 'pending'], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Pending user not found' });
    
    // Delete the user registration
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Log the rejection
      logChange(req.user.id, 'users', userId, 'REJECT_REGISTRATION', user, null, req);
      
      res.json({ message: 'User registration rejected and removed' });
    });
  });
});



// ====================================
// USER MANAGEMENT ENDPOINTS
// ====================================

// Get all users (admin only)
router.get('/users', authenticateToken, authorizeModulePermission('user_management', 'read_only'), (req, res) => {
  db.all('SELECT id, username, email, full_name, user_role, status, created_at, last_login FROM users ORDER BY username', [], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(users);
  });
});

// Create user (admin only)
router.post('/users', authenticateToken, authorizeModulePermission('user_management', 'provisioner'), (req, res) => {
  const { username, email, full_name, user_role, status } = req.body;

  if (!username || !user_role) {
    return res.status(400).json({ error: 'Username and role are required' });
  }

  const trimmedUsername = username.trim();
  const normalizedUsername = trimmedUsername.toLowerCase();

  db.get('SELECT id FROM users WHERE LOWER(username) = ?', [normalizedUsername], async (err, existingUser) => {
    if (err) {
      console.error('Error checking for existing user:', err);
      return res.status(500).json({ error: 'Database error while checking for user.' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    try {
      // Always set default password to 'abc123' for new users
      const hashedPassword = await hashPassword('abc123');
      
      db.run(
        'INSERT INTO users (username, password_hash, email, full_name, user_role, status, password_reset_required) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [trimmedUsername, hashedPassword, email || null, full_name || null, user_role, status || 'active'],
        function (err) {
          if (err) {
            console.error('Error creating user:', err);
            if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('users.email')) {
                return res.status(400).json({ error: 'Email address already exists.' });
            }
            return res.status(500).json({ error: 'Failed to create user.' });
          }
          // Capture lastID to avoid context issues
          const recordId = this.lastID;
          
          // Use username as record ID if lastID is not available
          const logRecordId = recordId || trimmedUsername;
          
          // Log the change with proper error handling
          try {
            logChange(req.user?.id || null, 'users', logRecordId, 'CREATE', null, { 
              username: trimmedUsername, email, full_name, user_role, status, 
              default_password: 'abc123', password_reset_required: true 
            }, req);
          } catch (logError) {
            console.error('Failed to log user creation:', logError);
          }
          
          res.status(201).json({ 
            id: recordId, 
            username: trimmedUsername, 
            message: 'User created successfully with default password. User will be required to change password on first login.' 
          });
        }
      );
    } catch (error) {
      console.error('Error hashing password:', error);
      res.status(500).json({ error: 'User creation failed due to a server error.' });
    }
  });
});

// Update user (admin only)
router.put('/users/:id', authenticateToken, authorizeModulePermission('user_management', 'provisioner'), (req, res) => {
  const { email, full_name, user_role, status } = req.body;
  const userId = req.params.id;
  
  // Get current user data for change logging
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, oldUser) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldUser) return res.status(404).json({ error: 'User not found' });
    
    db.run(
      'UPDATE users SET email = ?, full_name = ?, user_role = ?, status = ? WHERE id = ?',
      [email, full_name, user_role, status, userId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
        
        logChange(req.user.id, 'users', oldUser.username, 'UPDATE', oldUser, { email, full_name, user_role, status }, req);
        
        res.json({ message: 'User updated successfully' });
      }
    );
  });
});

// Delete user (admin only)
router.delete('/users/:id', authenticateToken, authorizeModulePermission('user_management', 'provisioner'), (req, res) => {
  const userId = req.params.id;
  
  // Prevent deleting own account (use strict comparison to prevent type coercion bypass)
  if (userId === req.user.id.toString() || parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  // Get user data for change logging and protection checks
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Prevent deleting the protected 'linesa' user
    if (user.username && user.username.toLowerCase() === 'linesa') {
      return res.status(400).json({ error: 'User "linesa" cannot be deleted as it is a protected system account' });
    }
    
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
      
      logChange(req.user.id, 'users', user.username, 'DELETE', user, null, req);
      
      res.json({ message: 'User deleted successfully' });
    });
  });
});

// Reset user password (admin only)
router.post('/users/:id/reset-password', authenticateToken, authorizeModulePermission('user_management', 'provisioner'), async (req, res) => {
  const userId = req.params.id;
  
  // Get user data for logging
  db.get('SELECT username FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    try {
      // Hash the default password 'abc123'
      const hashedPassword = await hashPassword('abc123');
      
      // Update the user's password and mark for forced password change
      db.run(
        'UPDATE users SET password_hash = ?, password_reset_required = 1 WHERE id = ?', 
        [hashedPassword, userId], 
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
          
          // Log the password reset activity
          logChange(req.user.id, 'users', user.username, 'PASSWORD_RESET', null, {
            reset_by: req.user.username,
            action: 'Admin password reset to abc123',
            new_password: 'abc123',
            requires_password_change: true
          }, req);
          
          res.json({ 
            message: 'Password reset to abc123 successfully. User will be required to change password on next login.',
            username: user.username
          });
        }
      );
    
    } catch (error) {
      console.error('Error hashing password:', error);
      res.status(500).json({ error: 'Password reset failed due to a server error.' });
    }
  });
});

// ====================================
// PER-MODULE PERMISSIONS ENDPOINTS
// ====================================

// Get user module permissions (admin only)
router.get('/users/:id/module-permissions', authenticateToken, authorizeModulePermission('user_management', 'read_only'), (req, res) => {
  const userId = req.params.id;
  
  // First check if user is administrator
  db.get('SELECT user_role FROM users WHERE id = ?', [userId], (userErr, user) => {
    if (userErr) return res.status(500).json({ error: userErr.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Administrators don't have per-module permissions - they have full access
    if (user.user_role === 'administrator') {
      return res.json({
        isAdmin: true,
        permissions: {}
      });
    }
    
    // Non-admin users: get per-module permissions
    db.all(
      'SELECT module_name, permission_level FROM user_module_permissions WHERE user_id = ?',
      [userId],
      (err, permissions) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Convert to object format { module_name: permission_level }
        const permissionsMap = {};
        permissions.forEach(p => {
          permissionsMap[p.module_name] = p.permission_level;
        });
        
        res.json({
          isAdmin: false,
          permissions: permissionsMap
        });
      }
    );
  });
});

// Update user module permissions (admin only)
router.put('/users/:id/module-permissions', authenticateToken, authorizeModulePermission('user_management', 'provisioner'), (req, res) => {
  const userId = req.params.id;
  const permissionSettings = req.body; // { module_name: permission_level, ... }
  
  // First check if user is administrator
  db.get('SELECT user_role FROM users WHERE id = ?', [userId], (userErr, user) => {
    if (userErr) return res.status(500).json({ error: userErr.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Cannot modify permissions for administrators
    if (user.user_role === 'administrator') {
      return res.status(400).json({ error: 'Cannot modify permissions for administrators - they have full access to all modules' });
    }
    
    // Delete existing permissions for this user
    db.run('DELETE FROM user_module_permissions WHERE user_id = ?', [userId], (delErr) => {
      if (delErr) return res.status(500).json({ error: delErr.message });
      
      // Insert new permissions
      const operations = [];
      
      Object.entries(permissionSettings).forEach(([moduleName, permissionLevel]) => {
        // Skip if permission_level is null or empty (means no access)
        if (!permissionLevel) return;
        
        operations.push(new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO user_module_permissions 
             (user_id, module_name, permission_level, created_by, updated_by, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [userId, moduleName, permissionLevel, req.user.id, req.user.id],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        }));
      });
      
      Promise.all(operations)
        .then(() => {
          // Log each permission change separately
          Object.entries(permissionSettings).forEach(([moduleName, permissionLevel]) => {
            logChange(req.user.id, 'user_module_permissions', userId, 'UPDATE', null, {
              module_name: moduleName,
              permission_level: permissionLevel,
              user_id: userId
            }, req);
          });
          
          res.json({ message: 'Module permissions updated successfully' });
        })
        .catch(err => {
          console.error('Error updating module permissions:', err);
          res.status(500).json({ error: 'Failed to update module permissions' });
        });
    });
  });
});

// ====================================
// CHANGE LOGS ENDPOINTS
// ====================================

// Get change logs (admin, provisioner, and read-only can view with role-based filtering)
router.get('/change-logs', authenticateToken, authorizeModulePermission('change_logs', 'read_only'), (req, res) => {
  const { table_name, table_names, user_id, search, limit = 100, offset = 0 } = req.query;
  
  let query = `
    SELECT cl.*, u.username, u.full_name 
    FROM change_logs cl 
    LEFT JOIN users u ON cl.user_id = u.id
  `;
  let params = [];
  let conditions = [];
  
  // Role-based filtering: non-admin users can only see their own logs
  if (req.user.role !== 'administrator') {
    conditions.push('cl.user_id = ?');
    params.push(req.user.id);
  } else if (user_id) {
    // Admin users can filter by specific user_id if provided
    conditions.push('cl.user_id = ?');
    params.push(user_id);
  }
  
  // Handle single table_name (legacy support)
  if (table_name) {
    conditions.push('cl.table_name = ?');
    params.push(table_name);
  }
  
  // Handle multiple table_names (new module-based filtering)
  if (table_names) {
    const tableNamesArray = Array.isArray(table_names) ? table_names : [table_names];
    const placeholders = tableNamesArray.map(() => '?').join(',');
    conditions.push(`cl.table_name IN (${placeholders})`);
    params.push(...tableNamesArray);
  }
  
  if (search) {
    conditions.push(`(
      cl.record_id LIKE ? OR 
      cl.changes_summary LIKE ? OR 
      u.username LIKE ? OR 
      u.full_name LIKE ? OR
      cl.action LIKE ?
    )`);
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY cl.timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  db.all(query, params, (err, logs) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(logs);
  });
});

// ====================================
// CARRIERS ENDPOINTS
// ====================================

// Get all carriers
router.get('/carriers', authenticateToken, authorizeModulePermission('carriers', 'read_only'), (req, res) => {
  db.all('SELECT * FROM carriers ORDER BY carrier_name', [], (err, carriers) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Map database region values back to frontend values
    const regionMapping = {
      'North America': 'AMERs',
      'Asia Pacific': 'APAC',
      'Europe': 'EMEA'
    };
    
    const mappedCarriers = carriers.map(carrier => ({
      ...carrier,
      region: regionMapping[carrier.region] || carrier.region
    }));
    
    res.json(mappedCarriers);
  });
});

// Search carriers for underlying carrier selection
router.get('/carriers/search', authenticateToken, (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 2) {
    return res.json([]);
  }
  
  db.all(
    'SELECT id, carrier_name, region FROM carriers WHERE carrier_name LIKE ? AND status = "active" ORDER BY carrier_name LIMIT 10',
    [`%${q}%`],
    (err, carriers) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Map database region values back to frontend values and format display name
      const regionMapping = {
        'North America': 'AMERs',
        'Asia Pacific': 'APAC',
        'Europe': 'EMEA'
      };
      
      const mappedCarriers = carriers.map(carrier => ({
        ...carrier,
        region: regionMapping[carrier.region] || carrier.region,
        display_name: `${carrier.carrier_name} (${regionMapping[carrier.region] || carrier.region})`
      }));
      
      res.json(mappedCarriers);
    }
  );
});
// Create carrier
router.post('/carriers', authenticateToken, authorizeModulePermission('carriers', 'provisioner'), (req, res) => {
  const { carrier_name, previously_known_as, status, region } = req.body;
  
  if (!carrier_name) {
    return res.status(400).json({ error: 'Carrier name is required' });
  }
  
  // Trim whitespace and normalize for duplicate checking (including multiple internal spaces)
  const normalizedCarrierName = carrier_name.trim().replace(/\s+/g, ' ');
  
  if (!normalizedCarrierName) {
    return res.status(400).json({ error: 'Carrier name cannot be empty or only whitespace' });
  }
  
  // Map frontend region values to database values
  const regionMapping = {
    'AMERs': 'North America',
    'APAC': 'Asia Pacific', 
    'EMEA': 'Europe'
  };
  
  const dbRegion = regionMapping[region] || region;
  
  // Check for duplicates with case-insensitive and whitespace-normalized comparison
  // This handles multiple spaces by normalizing both the input and database values
  db.get(
    `SELECT id, carrier_name FROM carriers 
     WHERE TRIM(REPLACE(REPLACE(REPLACE(LOWER(carrier_name), '   ', ' '), '  ', ' '), '  ', ' ')) = ? 
     AND region = ?`,
    [normalizedCarrierName.toLowerCase(), dbRegion],
    (err, existingCarrier) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (existingCarrier) {
        return res.status(400).json({ 
          error: `Carrier already exists in this region. Found: "${existingCarrier.carrier_name}" in region "${region || dbRegion}". Same carrier names are allowed in different regions.` 
        });
      }
      
      // Insert new carrier using the trimmed name
      db.run(
        'INSERT INTO carriers (carrier_name, previously_known_as, status, region, created_by) VALUES (?, ?, ?, ?, ?)',
        [normalizedCarrierName, previously_known_as, status || 'active', dbRegion, req.user.id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          // Capture lastID to avoid this context issues
          const recordId = this.lastID;
          
          // Use carrier_name as record ID if lastID is not available
          const logRecordId = recordId || normalizedCarrierName;
          
          // Log the change with proper error handling (don't block if logging fails)
          try {
            logChange(req.user.id, 'carriers', logRecordId, 'CREATE', null, { 
              carrier_name: normalizedCarrierName, previously_known_as, status, region 
            }, req);
          } catch (logError) {
            console.error('Failed to log carrier creation:', logError);
          }
          
          res.status(201).json({ id: recordId, carrier_name: normalizedCarrierName, message: 'Carrier created successfully' });
        }
      );
    }
  );
});

// Update carrier
router.put('/carriers/:id', authenticateToken, authorizeModulePermission('carriers', 'provisioner'), (req, res) => {
  const { carrier_name, previously_known_as, status, region } = req.body;
  const carrierId = req.params.id;
  
  // Map frontend region values to database values
  const regionMapping = {
    'AMERs': 'North America',
    'APAC': 'Asia Pacific', 
    'EMEA': 'Europe'
  };
  
  const dbRegion = regionMapping[region] || region;
  
  // Get current carrier data for change logging
  db.get('SELECT * FROM carriers WHERE id = ?', [carrierId], (err, oldCarrier) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldCarrier) return res.status(404).json({ error: 'Carrier not found' });
    
    const oldCarrierName = oldCarrier.carrier_name;
    const carrierNameChanged = oldCarrierName !== carrier_name;
    
    db.run(
      'UPDATE carriers SET carrier_name = ?, previously_known_as = ?, status = ?, region = ?, updated_by = ? WHERE id = ?',
      [carrier_name, previously_known_as, status, dbRegion, req.user.id, carrierId],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: `Carrier '${carrier_name}' already exists in region '${region || dbRegion}'. Same carrier names are allowed in different regions.` });
          }
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) return res.status(404).json({ error: 'Carrier not found' });
        
        // If carrier name changed, cascade the update to all dependent tables
        if (carrierNameChanged) {
          console.log(`🔄 Cascading carrier name update from "${oldCarrierName}" to "${carrier_name}"`);
          
          // Update network_routes.underlying_carrier
          db.run(
            'UPDATE network_routes SET underlying_carrier = ? WHERE underlying_carrier = ?',
            [carrier_name, oldCarrierName],
            function(err) {
              if (err) console.error('Failed to update network_routes.underlying_carrier:', err);
              else if (this.changes > 0) console.log(`✅ Updated ${this.changes} network routes (underlying_carrier)`);
            }
          );
          
          // Update network_routes.local_loop_carriers_a
          db.run(
            'UPDATE network_routes SET local_loop_carriers_a = ? WHERE local_loop_carriers_a = ?',
            [carrier_name, oldCarrierName],
            function(err) {
              if (err) console.error('Failed to update network_routes.local_loop_carriers_a:', err);
              else if (this.changes > 0) console.log(`✅ Updated ${this.changes} network routes (local_loop_carriers_a)`);
            }
          );
          
          // Update network_routes.local_loop_carriers_b
          db.run(
            'UPDATE network_routes SET local_loop_carriers_b = ? WHERE local_loop_carriers_b = ?',
            [carrier_name, oldCarrierName],
            function(err) {
              if (err) console.error('Failed to update network_routes.local_loop_carriers_b:', err);
              else if (this.changes > 0) console.log(`✅ Updated ${this.changes} network routes (local_loop_carriers_b)`);
            }
          );
          
          // Update core_active_outages.underlying_carrier
          db.run(
            'UPDATE core_active_outages SET underlying_carrier = ? WHERE underlying_carrier = ?',
            [carrier_name, oldCarrierName],
            function(err) {
              if (err) console.error('Failed to update core_active_outages.underlying_carrier:', err);
              else if (this.changes > 0) console.log(`✅ Updated ${this.changes} active outages`);
            }
          );
          
          // Update core_outage_history.underlying_carrier
          db.run(
            'UPDATE core_outage_history SET underlying_carrier = ? WHERE underlying_carrier = ?',
            [carrier_name, oldCarrierName],
            function(err) {
              if (err) console.error('Failed to update core_outage_history.underlying_carrier:', err);
              else if (this.changes > 0) console.log(`✅ Updated ${this.changes} historical outages`);
            }
          );
          
          // Update latency_warnings_live.underlying_carrier
          db.run(
            'UPDATE latency_warnings_live SET underlying_carrier = ? WHERE underlying_carrier = ?',
            [carrier_name, oldCarrierName],
            function(err) {
              if (err) console.error('Failed to update latency_warnings_live.underlying_carrier:', err);
              else if (this.changes > 0) console.log(`✅ Updated ${this.changes} latency warnings`);
            }
          );
        }
        
        logChange(req.user.id, 'carriers', oldCarrier.carrier_name, 'UPDATE', oldCarrier, { carrier_name, previously_known_as, status, region }, req);
        
        res.json({ 
          message: 'Carrier updated successfully',
          cascaded: carrierNameChanged,
          oldName: carrierNameChanged ? oldCarrierName : undefined
        });
      }
    );
  });
});

// Delete carrier
router.delete('/carriers/:id', authenticateToken, authorizeModulePermission('carriers', 'provisioner'), (req, res) => {
  const carrierId = req.params.id;
  
  // First get the carrier name for usage checks
  db.get('SELECT * FROM carriers WHERE id = ?', [carrierId], (err, carrier) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!carrier) return res.status(404).json({ error: 'Carrier not found' });
    
    // Check if carrier has contacts
    db.get('SELECT COUNT(*) as count FROM carrier_contacts WHERE carrier_id = ?', [carrierId], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (result.count > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete carrier with existing contacts. Please delete all contacts first.' 
        });
      }
      
      // Check if carrier is used in network routes (case-insensitive)
      const carrierName = carrier.carrier_name;
      const query = `
        SELECT circuit_id, underlying_carrier, local_loop_carriers_a, local_loop_carriers_b 
        FROM network_routes 
        WHERE LOWER(underlying_carrier) = LOWER(?) 
           OR LOWER(local_loop_carriers_a) = LOWER(?) 
           OR LOWER(local_loop_carriers_b) = LOWER(?)
      `;
      
      db.all(query, [carrierName, carrierName, carrierName], (err, routes) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (routes && routes.length > 0) {
          // Limit examples to first 5 routes for readability
          const exampleRoutes = routes.slice(0, 5).map(route => route.circuit_id);
          const moreCount = routes.length > 5 ? routes.length - 5 : 0;
          
          let errorMessage = `Cannot delete carrier '${carrierName}'. It is currently used in ${routes.length} network route${routes.length > 1 ? 's' : ''}.`;
          errorMessage += `\n\nExample routes: ${exampleRoutes.join(', ')}`;
          if (moreCount > 0) {
            errorMessage += `\nand ${moreCount} more...`;
          }
          errorMessage += `\n\nPlease update or remove these network routes first.`;
          
          return res.status(400).json({ 
            error: errorMessage,
            usedInRoutes: routes.map(route => ({
              circuit_id: route.circuit_id,
              fields: [
                route.underlying_carrier && route.underlying_carrier.toLowerCase() === carrierName.toLowerCase() ? 'underlying_carrier' : null,
                route.local_loop_carriers_a && route.local_loop_carriers_a.toLowerCase() === carrierName.toLowerCase() ? 'local_loop_carriers_a' : null,
                route.local_loop_carriers_b && route.local_loop_carriers_b.toLowerCase() === carrierName.toLowerCase() ? 'local_loop_carriers_b' : null
              ].filter(Boolean)
            })),
            carrierName: carrierName
          });
        }
        
        // No usage found, proceed with deletion
        db.run('DELETE FROM carriers WHERE id = ?', [carrierId], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          if (this.changes === 0) return res.status(404).json({ error: 'Carrier not found' });
          
          logChange(req.user.id, 'carriers', carrier.carrier_name, 'DELETE', carrier, null, req);
          
          res.json({ message: 'Carrier deleted successfully' });
        });
      });
    });
  });
});

// ====================================
// CARRIER CONTACTS ENDPOINTS
// ====================================

// Get all contacts for a carrier
router.get('/carriers/:id/contacts', authenticateToken, authorizeModulePermission('carriers', 'read_only'), (req, res) => {
  const carrierId = req.params.id;
  db.all(
    `SELECT cc.*, u.username, u.full_name 
     FROM carrier_contacts cc 
     LEFT JOIN users u ON cc.updated_by = u.id 
     WHERE cc.carrier_id = ? 
     ORDER BY cc.contact_name`, 
    [carrierId], 
    (err, contacts) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(contacts);
    }
  );
});

// Create carrier contact
router.post('/carriers/:id/contacts', authenticateToken, authorizeModulePermission('carriers', 'provisioner'), (req, res) => {
  const carrierId = req.params.id;
  const { contact_type, contact_level, contact_name, contact_function, contact_email, contact_phone, notes } = req.body;
  
  db.run(
    'INSERT INTO carrier_contacts (carrier_id, contact_type, contact_level, contact_name, contact_function, contact_email, contact_phone, notes, created_by, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [carrierId, contact_type, contact_level, contact_name, contact_function, contact_email, contact_phone, notes, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Capture lastID to avoid context issues
      const recordId = this.lastID;
      
      // Use contact_name as record ID if lastID is not available
      const logRecordId = recordId || contact_name;
      
      // Log the change with proper error handling
      try {
        logChange(req.user.id, 'carrier_contacts', logRecordId, 'CREATE', null, { carrier_id: carrierId, contact_type, contact_level, contact_name, contact_function, contact_email, contact_phone, notes }, req);
      } catch (logError) {
        console.error('Failed to log carrier contact creation:', logError);
      }
      
      res.status(201).json({ id: recordId, message: 'Contact created successfully' });
    }
  );
});

// Update carrier contact
router.put('/carriers/:id/contacts/:contactId', authenticateToken, authorizeModulePermission('carriers', 'provisioner'), (req, res) => {
  const carrierId = req.params.id;
  const contactId = req.params.contactId;
  const { contact_type, contact_level, contact_name, contact_function, contact_email, contact_phone, notes } = req.body;
  
  // Get current contact data for change logging
  db.get('SELECT * FROM carrier_contacts WHERE id = ? AND carrier_id = ?', [contactId, carrierId], (err, oldContact) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldContact) return res.status(404).json({ error: 'Contact not found' });
    
    db.run(
      'UPDATE carrier_contacts SET contact_type = ?, contact_level = ?, contact_name = ?, contact_function = ?, contact_email = ?, contact_phone = ?, notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP, last_updated = CURRENT_TIMESTAMP WHERE id = ? AND carrier_id = ?',
      [contact_type, contact_level, contact_name, contact_function, contact_email, contact_phone, notes, req.user.id, contactId, carrierId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Contact not found' });
        
        logChange(req.user.id, 'carrier_contacts', contactId, 'UPDATE', oldContact, { contact_type, contact_level, contact_name, contact_function, contact_email, contact_phone, notes }, req);
        
        res.json({ message: 'Contact updated successfully' });
      }
    );
  });
});

// Delete carrier contact
router.delete('/carriers/:id/contacts/:contactId', authenticateToken, authorizeModulePermission('carriers', 'provisioner'), (req, res) => {
  const carrierId = req.params.id;
  const contactId = req.params.contactId;
  
  // Get contact data for change logging
  db.get('SELECT * FROM carrier_contacts WHERE id = ? AND carrier_id = ?', [contactId, carrierId], (err, contact) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    
    db.run('DELETE FROM carrier_contacts WHERE id = ? AND carrier_id = ?', [contactId, carrierId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Contact not found' });
      
      logChange(null, 'carrier_contacts', contactId, 'DELETE', contact, null, req);
      
      res.json({ message: 'Contact deleted successfully' });
    });
  });
});

// Get overdue carrier contacts (365+ days since last update)
router.get('/carriers/overdue-contacts', authenticateToken, authorizeModulePermission('carriers', 'provisioner'), (req, res) => {
  // Only provisioners and admins can see overdue contacts (enforced by middleware)
  
  const query = `
    SELECT cc.*, c.carrier_name, c.region,
           JULIANDAY('now') - JULIANDAY(cc.last_updated) as days_since_update,
           CASE 
             WHEN JULIANDAY('now') - JULIANDAY(cc.last_updated) >= 365 THEN 1 
             ELSE 0 
           END as is_overdue
    FROM carrier_contacts cc
    JOIN carriers c ON cc.carrier_id = c.id
    WHERE cc.last_updated IS NOT NULL 
      AND JULIANDAY('now') - JULIANDAY(cc.last_updated) >= 365
      AND cc.approved_at IS NULL
    ORDER BY days_since_update DESC, c.carrier_name, cc.contact_name
  `;
  
  db.all(query, [], (err, contacts) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Add user-friendly formatting
    const formattedContacts = contacts.map(contact => ({
      ...contact,
      days_since_update: Math.floor(contact.days_since_update),
      years_since_update: (contact.days_since_update / 365).toFixed(1)
    }));
    
    res.json(formattedContacts);
  });
});

// Approve carrier contact yearly update
router.post('/carriers/:id/contacts/:contactId/approve', authenticateToken, authorizeModulePermission('carriers', 'provisioner'), (req, res) => {
  // Only provisioners and admins can approve updates (enforced by middleware)
  
  const carrierId = req.params.id;
  const contactId = req.params.contactId;
  
  // Get current contact data for change logging
  db.get('SELECT * FROM carrier_contacts WHERE id = ? AND carrier_id = ?', [contactId, carrierId], (err, contact) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    
    db.run(
      'UPDATE carrier_contacts SET approved_by = ?, approved_at = CURRENT_TIMESTAMP, last_updated = CURRENT_TIMESTAMP WHERE id = ? AND carrier_id = ?',
      [req.user.id, contactId, carrierId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Contact not found' });
        
        logChange(null, 'carrier_contacts', contactId, 'YEARLY_APPROVE', contact, { approved_by: req.user.id, approved_at: new Date().toISOString() }, req);
        
        res.json({ message: 'Contact yearly update approved successfully' });
      }
    );
  });
});

// Repository Types endpoints
router.get('/repository_types', (req, res) => {
  db.all('SELECT * FROM repository_types ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get unique carriers from network routes (legacy endpoint - for backward compatibility)
router.get('/carriers-legacy', (req, res) => {
  db.all('SELECT DISTINCT underlying_carrier FROM network_routes WHERE underlying_carrier IS NOT NULL AND underlying_carrier != "" ORDER BY underlying_carrier', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(row => row.underlying_carrier));
  });
});

// ====================================
// ENHANCED CORE OUTAGES ENDPOINTS
// ====================================

// Get current outages (circuits with live_latency = 0)
router.get('/core_outages/current', authenticateToken, async (req, res) => {
  try {
    const { search = '' } = req.query;
    const currentOutages = await outageMonitor.getCurrentOutages(search);
    res.json(createSuccessResponse(currentOutages, 'Current outages retrieved successfully'));
  } catch (error) {
    console.error('Failed to get current outages:', error);
    res.status(500).json({ error: 'Failed to retrieve current outages' });
  }
});

// Get outage history
router.get('/core_outages/history', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // Changed default to 20 as requested
    const offset = (page - 1) * limit;
    const { search = '', start_date = '', end_date = '' } = req.query;
    
    const history = await outageMonitor.getOutageHistory(limit, offset, search, start_date, end_date);
    const total = await outageMonitor.getOutageHistoryCount(search, start_date, end_date);
    
    res.json(createPaginatedResponse(history, total, page, limit));
  } catch (error) {
    console.error('Failed to get outage history:', error);
    res.status(500).json({ error: 'Failed to retrieve outage history' });
  }
});

// Get outage statistics
router.get('/core_outages/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await outageMonitor.getOutageStats();
    res.json(createSuccessResponse(stats, 'Outage statistics retrieved successfully'));
  } catch (error) {
    console.error('Failed to get outage stats:', error);
    res.status(500).json({ error: 'Failed to retrieve outage statistics' });
  }
});

// Export outage history to Excel
router.get('/core_outages/history/export', authenticateToken, async (req, res) => {
  try {
    const { search = '', start_date = '', end_date = '' } = req.query;
    
    // Get all filtered history records (no pagination for export)
    const history = await outageMonitor.getOutageHistory(10000, 0, search, start_date, end_date);
    
    if (history.length === 0) {
      return res.status(404).json({ error: 'No outage history records found for the specified filters' });
    }

    // Define CSV fields for export
    const fields = [
      { label: 'Circuit ID', value: 'circuit_id' },
      { label: 'Location A', value: 'location_a' },
      { label: 'Location B', value: 'location_b' },
      { label: 'Bandwidth (Mbps)', value: 'bandwidth' },
      { label: 'Underlying Carrier', value: 'underlying_carrier' },
      { label: 'Outage Start Time', value: 'outage_start_time' },
      { label: 'Outage End Time', value: 'outage_end_time' },
      { label: 'Duration (Minutes)', value: 'outage_duration_minutes' },
      { label: 'Detected By', value: 'detected_by' }
    ];

    // Process data for export (format dates and handle nulls)
    const exportData = history.map(record => ({
      ...record,
      bandwidth: record.bandwidth ? `${record.bandwidth}` : 'N/A',
      location_a: record.location_a || 'N/A',
      location_b: record.location_b || 'N/A',
      underlying_carrier: record.underlying_carrier || 'N/A',
      outage_start_time: record.outage_start_time ? new Date(record.outage_start_time).toLocaleString() : 'N/A',
      outage_end_time: record.outage_end_time ? new Date(record.outage_end_time).toLocaleString() : 'N/A',
      outage_duration_minutes: record.outage_duration_minutes || 'N/A',
      detected_by: record.detected_by || 'System'
    }));

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(exportData);

    // Generate filename with current date and filter info
    const currentDate = new Date().toISOString().split('T')[0];
    let filename = `outage_history_${currentDate}`;
    
    if (search) {
      filename += `_search_${search.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
    if (start_date || end_date) {
      filename += `_${start_date || 'all'}_to_${end_date || 'all'}`;
    }
    filename += '.csv';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

    // Log the export activity
    logUserActivity(req.user.id, 'outage_history_export', {
      search,
      start_date,
      end_date,
      records_exported: history.length,
      filename,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    });

  } catch (error) {
    console.error('Failed to export outage history:', error);
    res.status(500).json({ error: 'Failed to export outage history' });
  }
});

// Get latency warnings (circuits exceeding expected latency by >5%)
router.get('/core_outages/latency-warnings', authenticateToken, async (req, res) => {
  try {
    const { search = '' } = req.query;
    const warnings = await outageMonitor.getLatencyWarnings(search);
    res.json(createSuccessResponse(warnings, 'Latency warnings retrieved successfully'));
  } catch (error) {
    console.error('Failed to get latency warnings:', error);
    res.status(500).json({ error: 'Failed to retrieve latency warnings' });
  }
});

// Update ticket and notes for current outages
router.put('/core_outages/current/:circuitId/ticket', authenticateToken, async (req, res) => {
  try {
    const { circuitId } = req.params;
    const { ticket_number, notes } = req.body;
    
    // Validate input
    if (ticket_number && ticket_number.length > 32) {
      return res.status(400).json({ error: 'Ticket number cannot exceed 32 characters' });
    }
    if (notes && notes.length > 1024) {
      return res.status(400).json({ error: 'Notes cannot exceed 1024 characters' });
    }

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE core_active_outages SET ticket_number = ?, notes = ? WHERE circuit_id = ?',
        [ticket_number || null, notes || null, circuitId],
        function(err) {
          if (err) reject(err);
          else if (this.changes === 0) reject(new Error('Circuit not found in active outages'));
          else resolve();
        }
      );
    });

    // Log the activity
    logUserActivity(req.user.id, 'outage_ticket_update', {
      circuit_id: circuitId,
      ticket_number,
      notes,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    });

    res.json(createSuccessResponse({ circuitId, ticket_number, notes }, 'Ticket and notes updated successfully'));
  } catch (error) {
    console.error('Failed to update outage ticket:', error);
    res.status(500).json({ error: error.message || 'Failed to update ticket and notes' });
  }
});

// Update ticket and notes for latency warnings
router.put('/core_outages/latency-warnings/:circuitId/ticket', authenticateToken, async (req, res) => {
  try {
    const { circuitId } = req.params;
    const { ticket_number, notes } = req.body;
    
    // Validate input
    if (ticket_number && ticket_number.length > 32) {
      return res.status(400).json({ error: 'Ticket number cannot exceed 32 characters' });
    }
    if (notes && notes.length > 1024) {
      return res.status(400).json({ error: 'Notes cannot exceed 1024 characters' });
    }

    const result = await outageMonitor.updateLatencyWarningTicket(circuitId, ticket_number, notes);

    // Log the activity
    logUserActivity(req.user.id, 'latency_warning_ticket_update', {
      circuit_id: circuitId,
      ticket_number,
      notes,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    });

    res.json(createSuccessResponse(result, 'Latency warning ticket and notes updated successfully'));
  } catch (error) {
    console.error('Failed to update latency warning ticket:', error);
    res.status(500).json({ error: 'Failed to update ticket and notes' });
  }
});

// Get latest live latency API call details for a specific circuit
router.get('/live-latency/:circuitId/latest-call', authenticateToken, async (req, res) => {
  try {
    const { circuitId } = req.params;
    
    if (!circuitId) {
      return res.status(400).json({ error: 'Circuit ID is required' });
    }
    
    // Get the most recent API call log for this circuit
    const query = `
      SELECT 
        lal.*,
        u.username as requested_by_username
      FROM live_latency_api_logs lal
      LEFT JOIN users u ON lal.requested_by = u.id
      WHERE lal.circuit_id = ?
        AND lal.response_status BETWEEN 200 AND 299
        AND lal.raw_response IS NOT NULL
      ORDER BY lal.created_at DESC
      LIMIT 1
    `;
    
    db.get(query, [circuitId], (err, logEntry) => {
      if (err) {
        console.error('Failed to get latest API call:', err);
        return res.status(500).json({ error: 'Failed to retrieve latest API call details' });
      }
      
      if (!logEntry) {
        return res.status(404).json({ error: 'No successful API call logs found for this circuit' });
      }
      
      // Parse the extracted values and format the response
      let extractedValues = [];
      let calculationDetails = {};
      
      try {
        if (logEntry.extracted_values) {
          extractedValues = JSON.parse(logEntry.extracted_values);
        }
        
        calculationDetails = {
          circuit_id: logEntry.circuit_id,
          request_timestamp: logEntry.created_at,
          request_type: logEntry.request_type,
          response_time_ms: logEntry.response_time_ms,
          data_points_found: extractedValues.length,
          extracted_values: extractedValues,
          calculated_average: logEntry.calculated_average,
          latest_value: logEntry.latest_value,
          final_latency_value: logEntry.final_latency_value,
          data_quality_score: logEntry.data_quality_score,
          calculation_method: logEntry.latest_value === 0 
            ? 'Circuit Down (Latest value = 0)' 
            : 'Average of non-zero values',
          requested_by: logEntry.requested_by_username || 'System'
        };
        
      } catch (parseError) {
        console.error('Failed to parse API log data:', parseError);
        return res.status(500).json({ error: 'Failed to parse API call data' });
      }
      
      res.json(createSuccessResponse(calculationDetails, 'Latest API call details retrieved successfully'));
    });
  } catch (error) {
    console.error('Failed to get latest API call details:', error);
    res.status(500).json({ error: 'Failed to retrieve latest API call details' });
  }
});

// Get outage monitor service status
router.get('/core_outages/monitor-status', authenticateToken, authorizeRole('administrator'), (req, res) => {
  const status = outageMonitor.getStatus();
  res.json(createSuccessResponse(status, 'Monitor status retrieved successfully'));
});

// Legacy endpoint for backward compatibility
router.get('/core_outages', authenticateToken, async (req, res) => {
  try {
    const currentOutages = await outageMonitor.getCurrentOutages();
    res.json(currentOutages);
  } catch (error) {
    console.error('Failed to get core outages (legacy):', error);
    res.status(500).json({ error: 'Failed to retrieve core outages' });
  }
});

router.post('/repository_types', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO repository_types (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name, description });
  });
});

// Old simulation endpoints removed - these were generating fake data
// The live latency system now uses:
// - /api/external/update-live-latency (for external data source)
// - /api/live-latency/refresh-all (manual refresh - currently returns no data source configured)
// - /api/live-latency/history/:circuit_id (historical data)
// - /api/live-latency/status (data freshness check)

// Enhanced Live Latency Management Endpoints

// External API endpoint for updating live latency data (for external monitoring systems)
router.post('/api/external/update-live-latency', (req, res) => {
  const updates = req.body;
  
  // Validate input format
  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'Expected array of latency updates' });
  }
  
  let processed = 0;
  let errors = [];
  
  const processUpdate = (update, callback) => {
    const { circuit_id, latency_ms, timestamp } = update;
    
    if (!circuit_id || latency_ms === undefined) {
      errors.push(`Invalid update: circuit_id and latency_ms required for ${JSON.stringify(update)}`);
      return callback();
    }
    
    // Check if circuit exists
    db.get('SELECT circuit_id FROM network_routes WHERE circuit_id = ?', [circuit_id], (err, route) => {
      if (err) {
        errors.push(`Database error for ${circuit_id}: ${err.message}`);
        return callback();
      }
      
      if (!route) {
        errors.push(`Circuit not found: ${circuit_id}`);
        return callback();
      }
      
      // Update live latency with timestamp and source
      db.run(
        'UPDATE network_routes SET live_latency = ?, live_latency_last_updated = ?, live_latency_source = ? WHERE circuit_id = ?',
        [latency_ms, timestamp || new Date().toISOString(), 'external_api', circuit_id],
        (updateErr) => {
          if (updateErr) {
            errors.push(`Update failed for ${circuit_id}: ${updateErr.message}`);
          } else {
            processed++;
          }
          callback();
        }
      );
    });
  };
  
  // Process all updates
  let pending = updates.length;
  updates.forEach(update => {
    processUpdate(update, () => {
      pending--;
      if (pending === 0) {
        res.json({
          success: true,
          processed,
          total: updates.length,
          errors: errors.length > 0 ? errors : undefined,
          timestamp: new Date().toISOString()
        });
      }
    });
  });
});

// Manual refresh endpoint - triggers fetch from external source
router.post('/api/live-latency/refresh-all', authenticateToken, authorizeModulePermission('network_routes', 'read_only'), (req, res) => {
  // TODO: When external API details are available, implement actual API calls here
  // For now, return a clear message that no external source is configured
  
  res.json({
    success: false,
    message: 'No external live latency data source configured. Please configure your external monitoring API first.',
    updated: 0,
    total: 0,
    timestamp: new Date().toISOString(),
    note: 'Use the /api/external/update-live-latency endpoint to push data from your monitoring system'
  });
});

// Get live latency history for a specific circuit
router.get('/api/live-latency/history/:circuit_id', authenticateToken, authorizeModulePermission('network_routes', 'read_only'), (req, res) => {
  const { circuit_id } = req.params;
  const { days = 30 } = req.query; // Default to 30 days
  
  // Validate days parameter
  const validDays = [7, 30, 90];
  const daysParsed = parseInt(days);
  if (!validDays.includes(daysParsed)) {
    return res.status(400).json({ error: 'Days must be 7, 30, or 90' });
  }
  
  // Get history data
  db.all(
    `SELECT snapshot_date, latency_ms, sla_latency, created_at 
     FROM live_latency_history 
     WHERE circuit_id = ? AND snapshot_date >= date('now', '-${daysParsed} days')
     ORDER BY snapshot_date ASC`,
    [circuit_id],
    (err, history) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Get current route info
      db.get(
        'SELECT circuit_id, live_latency, sla_latency, live_latency_last_updated, live_latency_source FROM network_routes WHERE circuit_id = ?',
        [circuit_id],
        (routeErr, route) => {
          if (routeErr) {
            return res.status(500).json({ error: routeErr.message });
          }
          
          if (!route) {
            return res.status(404).json({ error: 'Circuit not found' });
          }
          
          res.json({
            circuit_id,
            current: {
              latency_ms: route.live_latency,
              sla_latency: route.sla_latency,
              last_updated: route.live_latency_last_updated,
              source: route.live_latency_source
            },
            history,
            days: daysParsed,
            count: history.length
          });
        }
      );
    }
  );
});

// Daily snapshot job endpoint (to be called by scheduler)
router.post('/api/live-latency/create-daily-snapshot', (req, res) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Get all routes with live latency data
  db.all(
    'SELECT circuit_id, live_latency, sla_latency FROM network_routes WHERE live_latency IS NOT NULL',
    [],
    (err, routes) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      let processed = 0;
      let errors = [];
      
      if (routes.length === 0) {
        return res.json({ success: true, message: 'No routes with latency data to snapshot', processed: 0 });
      }
      
      routes.forEach(route => {
        db.run(
          `INSERT OR REPLACE INTO live_latency_history 
           (circuit_id, latency_ms, sla_latency, snapshot_date) 
           VALUES (?, ?, ?, ?)`,
          [route.circuit_id, route.live_latency, route.sla_latency, today],
          (snapshotErr) => {
            if (snapshotErr) {
              errors.push(`Failed to snapshot ${route.circuit_id}: ${snapshotErr.message}`);
            } else {
              processed++;
            }
            
            // When all done, clean up old data (>90 days) and respond
            if (processed + errors.length === routes.length) {
              db.run(
                'DELETE FROM live_latency_history WHERE snapshot_date < date("now", "-90 days")',
                [],
                (cleanupErr) => {
                  res.json({
                    success: true,
                    message: `Daily snapshot created for ${processed} circuits`,
                    processed,
                    total: routes.length,
                    errors: errors.length > 0 ? errors : undefined,
                    cleanup: cleanupErr ? `Cleanup warning: ${cleanupErr.message}` : 'Old data cleaned up'
                  });
                }
              );
            }
          }
        );
      });
    }
  );
});

// Check live latency data freshness (for frontend error banner)
router.get('/api/live-latency/status', authenticateToken, authorizeModulePermission('network_routes', 'read_only'), (req, res) => {
  // Check if any data is older than 24 hours
  db.get(
    `SELECT COUNT(*) as stale_count,
            (SELECT COUNT(*) FROM network_routes WHERE live_latency IS NOT NULL) as total_with_latency,
            (SELECT MAX(live_latency_last_updated) FROM network_routes) as latest_update
     FROM network_routes 
     WHERE live_latency_last_updated IS NULL 
        OR live_latency_last_updated < datetime('now', '-24 hours')`,
    [],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const isStale = result.stale_count > 0 || !result.latest_update;
      
      res.json({
        status: isStale ? 'stale' : 'fresh',
        stale_count: result.stale_count,
        total_with_latency: result.total_with_latency,
        latest_update: result.latest_update,
        message: isStale 
          ? `Live latency data is unavailable or stale for ${result.stale_count} circuits`
          : 'Live latency data is up to date'
      });
    }
  );
});

// Get all routes
router.get('/network_routes', authenticateToken, authorizeModulePermission('network_routes', 'read_only'), (req, res) => {
  const { repository_type_id } = req.query;
  let query = 'SELECT * FROM network_routes';
  let params = [];
  
  if (repository_type_id) {
    query += ' WHERE repository_type_id = ?';
    params.push(repository_type_id);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get single route by circuit_id
router.get('/network_routes/:circuit_id', authenticateToken, authorizeModulePermission('network_routes', 'read_only'), (req, res) => {
  const { circuit_id } = req.params;
  db.get('SELECT * FROM network_routes WHERE circuit_id = ?', [circuit_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
});

// Validate bandwidth field
function isValidBandwidth(bandwidth) {
  if (!bandwidth) return true; // Allow empty bandwidth
  
  // Allow 'Dark Fiber' as text
  if (bandwidth.toLowerCase() === 'dark fiber') return true;
  
  // Otherwise must be numeric (with optional Mbps suffix)
  const numericValue = parseFloat(bandwidth);
  return !isNaN(numericValue) && numericValue > 0;
}

// Validate underlying carrier field
function validateUnderlyingCarrier(carrierName, callback) {
  if (!carrierName || carrierName.trim() === '') {
    return callback(null, true); // Allow empty carrier
  }
  
  // First check if carriers table exists and has data
  db.get('SELECT COUNT(*) as count FROM carriers', [], (err, countResult) => {
    if (err) {
      console.error('Error checking carriers table:', err);
      return callback(null, true); // Allow if table check fails
    }
    
    if (countResult.count === 0) {
      console.warn('No carriers found in database, allowing all carrier names');
      return callback(null, true); // Allow if no carriers exist
    }
    
    // Check for specific carrier
    db.get(
      'SELECT id FROM carriers WHERE carrier_name = ? AND status = "active"',
      [carrierName],
      (err, row) => {
        if (err) {
          console.error('Error validating carrier:', err, 'for carrier:', carrierName);
          return callback(null, true); // Allow if validation fails
        }
                callback(null, !!row); // Return true if carrier exists
      }
    );
  });
}

// Comprehensive validation function for a single row - collects ALL errors
async function validateRowForeignKeys(row, module) {
  const errors = [];
  
  if (module === 'carrier_contacts') {
    if (row.carrier_id) {
      try {
        const result = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM carriers WHERE id = ?', [row.carrier_id], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        if (!result) {
          errors.push(`Invalid carrier_id: ${row.carrier_id} does not exist`);
        }
      } catch (err) {
        errors.push(`Database error validating carrier_id: ${err.message}`);
      }
    }
  } else if (module === 'pop_capabilities') {
    if (row.location_code) {
      try {
        const result = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM location_reference WHERE LOWER(TRIM(location_code)) = LOWER(TRIM(?))', [row.location_code], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        if (!result) {
          errors.push(`Invalid location_code: ${row.location_code} does not exist`);
        }
      } catch (err) {
        errors.push(`Database error validating location_code: ${err.message}`);
      }
    }
  } else if (module === 'exchange_feeds') {
    if (row.exchange_id) {
      try {
        const result = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM exchanges WHERE id = ?', [row.exchange_id], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        if (!result) {
          errors.push(`Invalid exchange_id: ${row.exchange_id} does not exist`);
        }
      } catch (err) {
        errors.push(`Database error validating exchange_id: ${err.message}`);
      }
    }
  } else if (module === 'exchange_contacts') {
    if (row.exchange_id) {
      try {
        const result = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM exchanges WHERE id = ?', [row.exchange_id], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        if (!result) {
          errors.push(`Invalid exchange_id: ${row.exchange_id} does not exist`);
        }
      } catch (err) {
        errors.push(`Database error validating exchange_id: ${err.message}`);
      }
    }
  } else if (module === 'network_routes') {
    // Validate underlying carrier
    if (row.underlying_carrier && row.underlying_carrier.trim() !== '') {
      try {
        const isValid = await new Promise((resolve, reject) => {
          validateUnderlyingCarrier(row.underlying_carrier, (err, isValid) => {
            if (err) reject(err);
            else resolve(isValid);
          });
        });
        if (!isValid) {
          errors.push(`Invalid underlying_carrier: '${row.underlying_carrier}' does not exist in carriers database`);
        }
      } catch (err) {
        errors.push(`Database error validating underlying_carrier: ${err.message}`);
      }
    }
    
    // Validate location_a
    if (row.location_a && row.location_a.trim() !== '') {
      try {
        const result = await new Promise((resolve, reject) => {
          db.get('SELECT location_code FROM location_reference WHERE location_code = ?', [row.location_a], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        if (!result) {
          errors.push(`Invalid location_a: '${row.location_a}' does not exist in locations database`);
        }
      } catch (err) {
        errors.push(`Database error validating location_a: ${err.message}`);
      }
    }
    
    // Validate location_b
    if (row.location_b && row.location_b.trim() !== '') {
      try {
        const result = await new Promise((resolve, reject) => {
          db.get('SELECT location_code FROM location_reference WHERE location_code = ?', [row.location_b], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        if (!result) {
          errors.push(`Invalid location_b: '${row.location_b}' does not exist in locations database`);
        }
      } catch (err) {
        errors.push(`Database error validating location_b: ${err.message}`);
      }
    }
    
    // Validate local_loop_carriers_a
    if (row.local_loop_carriers_a && row.local_loop_carriers_a.trim() !== '') {
      try {
        const isValid = await new Promise((resolve, reject) => {
          validateUnderlyingCarrier(row.local_loop_carriers_a, (err, isValid) => {
            if (err) reject(err);
            else resolve(isValid);
          });
        });
        if (!isValid) {
          errors.push(`Invalid local_loop_carriers_a: '${row.local_loop_carriers_a}' does not exist in carriers database`);
        }
      } catch (err) {
        errors.push(`Database error validating local_loop_carriers_a: ${err.message}`);
      }
    }
    
    // Validate local_loop_carriers_b
    if (row.local_loop_carriers_b && row.local_loop_carriers_b.trim() !== '') {
      try {
        const isValid = await new Promise((resolve, reject) => {
          validateUnderlyingCarrier(row.local_loop_carriers_b, (err, isValid) => {
            if (err) reject(err);
            else resolve(isValid);
          });
        });
        if (!isValid) {
          errors.push(`Invalid local_loop_carriers_b: '${row.local_loop_carriers_b}' does not exist in carriers database`);
        }
      } catch (err) {
        errors.push(`Database error validating local_loop_carriers_b: ${err.message}`);
      }
    }
  }
  
  return errors;
}

// Create new route  
router.post('/network_routes', authenticateToken, authorizeModulePermission('network_routes', 'provisioner'), (req, res) => {
  const data = req.body;

  
  if (!isValidCircuitId(data.circuit_id)) {
    return res.status(400).json({ error: 'Invalid circuit_id format' });
  }
  
  if (!isValidBandwidth(data.bandwidth)) {
    return res.status(400).json({ error: 'Bandwidth must be either "Dark Fiber" or a numeric value' });
  }
  
  // Validate underlying carrier
  validateUnderlyingCarrier(data.underlying_carrier, (err, isValid) => {
    if (err) {
      console.error('Database error validating carrier:', err);
      return res.status(500).json({ error: 'Database error validating carrier' });
    }
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid underlying carrier. Please select a valid carrier from the database.' });
    }
    
    const fields = [
      'circuit_id','repository_type_id','kmz_file_path','live_latency','expected_latency','test_results_link','cable_system','is_special','underlying_carrier','cost','currency','location_a','location_b','bandwidth','more_details','mtu','sla_latency','capacity_usage_percent','local_loop_carriers_a','local_loop_carriers_b','equipment_type','carrier_protected','carrier_protection_route','live_latency_last_updated','live_latency_source','updated_by','updated_date','region'
    ];
    const placeholders = fields.map(() => '?').join(',');
    const values = fields.map(f => {
      if (f === 'repository_type_id') return data[f] ?? 1;
      if (f === 'updated_by') return req.user.id;
      if (f === 'updated_date') return new Date().toISOString();
      return data[f] ?? null;
    });
    db.run(
      `INSERT OR REPLACE INTO network_routes (${fields.join(',')}) VALUES (${placeholders})`,
      values,
      function(err) {
        if (err) {
          console.error('Database insertion error:', err);
          return res.status(500).json({ error: err.message });
        }
        
        // Log the creation
        logChange(req.user.id, 'network_routes', data.circuit_id, 'CREATE', null, data, req);
        
        res.status(201).json({ circuit_id: data.circuit_id });
      }
    );
  });
});
// Update route
router.put('/network_routes/:circuit_id', authenticateToken, authorizeModulePermission('network_routes', 'provisioner'), (req, res) => {
  const { circuit_id } = req.params;
  const data = req.body;
  if (!isValidCircuitId(circuit_id)) {
    return res.status(400).json({ error: 'Invalid circuit_id format' });
  }
  
  if (!isValidBandwidth(data.bandwidth)) {
    return res.status(400).json({ error: 'Bandwidth must be either "Dark Fiber" or a numeric value' });
  }
  
      // Validate underlying carrier
    validateUnderlyingCarrier(data.underlying_carrier, (err, isValid) => {
      if (err) return res.status(500).json({ error: 'Database error validating carrier' });
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid underlying carrier. Please select a valid carrier from the database.' });
      }
      
      // Get old values for change logging
      db.get('SELECT * FROM network_routes WHERE circuit_id = ?', [circuit_id], (err, oldRoute) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!oldRoute) return res.status(404).json({ error: 'Route not found' });
        
        const fields = [
          'repository_type_id','kmz_file_path','live_latency','expected_latency','test_results_link','cable_system','is_special','underlying_carrier','cost','currency','location_a','location_b','bandwidth','more_details','mtu','sla_latency','capacity_usage_percent','local_loop_carriers_a','local_loop_carriers_b','equipment_type','carrier_protected','carrier_protection_route','live_latency_last_updated','live_latency_source','updated_by','updated_date','region'
        ];
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => {
          if (f === 'updated_by') return req.user.id;
          if (f === 'updated_date') return new Date().toISOString();
          return data[f] ?? null;
        });
        values.push(circuit_id);
        db.run(
          `UPDATE network_routes SET ${setClause} WHERE circuit_id = ?`,
          values,
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
            
            // Log the update
            logChange(req.user.id, 'network_routes', circuit_id, 'UPDATE', oldRoute, data, req);
            
            res.json({ message: 'Updated' });
          }
        );
      });
    });
});

// Get route tracking details
router.get('/network_routes/:circuit_id/tracking', authenticateToken, authorizeModulePermission('network_routes', 'read_only'), (req, res) => {
  const { circuit_id } = req.params;
  
  db.get(
    `SELECT nr.updated_by, nr.updated_date, u.username, u.full_name 
     FROM network_routes nr 
     LEFT JOIN users u ON nr.updated_by = u.id 
     WHERE nr.circuit_id = ?`,
    [circuit_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!result) return res.status(404).json({ error: 'Route not found' });
      
      res.json({
        updated_by: result.updated_by,
        updated_date: result.updated_date,
        username: result.username,
        full_name: result.full_name
      });
    }
  );
});

// Delete route
router.delete('/network_routes/:circuit_id', authenticateToken, authorizeModulePermission('network_routes', 'provisioner'), (req, res) => {
  const { circuit_id } = req.params;
  
  // First check if there are any dark fiber details associated with this circuit
  db.all('SELECT id, dwdm_wavelength, dwdm_ucn FROM dark_fiber_details WHERE circuit_id = ?', [circuit_id], (err, darkFiberDetails) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // If there are dark fiber details, prevent deletion and return details
    if (darkFiberDetails && darkFiberDetails.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete network route with existing dark fiber details',
        darkFiberDetails: darkFiberDetails,
        message: 'Please delete all dark fiber details first before deleting the network route.'
      });
    }
    
    // Get old values for change logging before deletion
    db.get('SELECT * FROM network_routes WHERE circuit_id = ?', [circuit_id], (err, oldRoute) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!oldRoute) return res.status(404).json({ error: 'Route not found' });
      
      db.run('DELETE FROM network_routes WHERE circuit_id = ?', [circuit_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
        
        // Log the deletion
        logChange(req.user.id, 'network_routes', circuit_id, 'DELETE', oldRoute, null, req);
        
        res.json({ message: 'Deleted' });
      });
    });
  });
});

// Upload KMZ file and update kmz_file_path for a circuit_id
router.post('/network_routes/:circuit_id/upload_kmz', authenticateToken, authorizeModulePermission('network_routes', 'provisioner'), upload.single('kmz_file'), (req, res) => {
  const { circuit_id } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const kmzPath = req.file.filename;
  
  // Get old values for change logging
  db.get('SELECT kmz_file_path FROM network_routes WHERE circuit_id = ?', [circuit_id], (err, oldRoute) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldRoute) return res.status(404).json({ error: 'Route not found' });
    
    db.run(
      'UPDATE network_routes SET kmz_file_path = ? WHERE circuit_id = ?',
      [kmzPath, circuit_id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
        
        // Log the KMZ file upload
        logChange(req.user.id, 'network_routes', circuit_id, 'UPDATE', 
          { kmz_file_path: oldRoute.kmz_file_path }, 
          { kmz_file_path: kmzPath, file_action: 'KMZ_UPLOAD', filename: req.file.originalname }, 
          req);
        
        res.json({ message: 'KMZ file uploaded', kmz_file_path: kmzPath });
      }
    );
  });
});

// Delete KMZ file for a circuit_id
router.delete('/network_routes/:circuit_id/delete_kmz', authenticateToken, authorizeModulePermission('network_routes', 'provisioner'), (req, res) => {
  const { circuit_id } = req.params;
  
  // Get current route data for logging and file deletion
  db.get('SELECT kmz_file_path FROM network_routes WHERE circuit_id = ?', [circuit_id], (err, route) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!route) return res.status(404).json({ error: 'Route not found' });
    if (!route.kmz_file_path) return res.status(400).json({ error: 'No KMZ file to delete' });
    
    const oldKmzPath = route.kmz_file_path;
    
    // Update database to remove KMZ file path
    db.run(
      'UPDATE network_routes SET kmz_file_path = NULL WHERE circuit_id = ?',
      [circuit_id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Route not found' });
        
        // Delete physical file from filesystem
        const filePath = path.join(kmzDir, oldKmzPath);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (fileErr) {
            console.error('Failed to delete KMZ file from filesystem:', fileErr);
            // Don't fail the request if file deletion fails
          }
        }
        
        // Log the KMZ file deletion
        logChange(req.user.id, 'network_routes', circuit_id, 'UPDATE', 
          { kmz_file_path: oldKmzPath }, 
          { kmz_file_path: null, file_action: 'KMZ_DELETE', deleted_filename: oldKmzPath }, 
          req);
        
        res.json({ message: 'KMZ file deleted successfully' });
      }
    );
  });
});

// Export network_routes as CSV
router.get('/network_routes_export', authenticateToken, authorizeModulePermission('network_routes', 'read_only'), (req, res) => {
  db.all(`SELECT circuit_id, kmz_file_path, live_latency, expected_latency, test_results_link, cable_system, 
          CASE 
            WHEN is_special = 1 THEN 'true'
            WHEN is_special = 0 THEN 'false'
            ELSE 'false'
          END as is_special,
          CASE 
            WHEN carrier_protected = 1 THEN 'Yes'
            WHEN carrier_protected = 0 THEN 'No'
            ELSE 'No'
          END as carrier_protected,
          underlying_carrier, location_a, location_b, bandwidth, more_details, mtu, sla_latency, capacity_usage_percent, carrier_protection_route, region 
          FROM network_routes`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const fields = ['circuit_id','kmz_file_path','live_latency','expected_latency','test_results_link','cable_system','is_special','carrier_protected','underlying_carrier','location_a','location_b','bandwidth','more_details','mtu','sla_latency','capacity_usage_percent','carrier_protection_route','region'];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);
    res.header('Content-Type', 'text/csv');
    res.attachment('network_routes.csv');
    res.send(csv);
  });
});

// Search/filter network_routes by query params (visible fields only)
router.get('/network_routes_search', authenticateToken, authorizeModulePermission('network_routes', 'read_only'), (req, res) => {
  const allowedFields = ['circuit_id','kmz_file_path','live_latency','expected_latency','test_results_link','cable_system','is_special','carrier_protected','carrier_protection_route','underlying_carrier','location_a','location_b','bandwidth','more_details','mtu','sla_latency','capacity_usage_percent'];
  const filters = [];
  const values = [];
  
  // Check if we need to search DWDM UCNs in dark fiber details
  // Search dark fiber for any circuit_id search term
  const searchTerm = req.query.circuit_id;
  const shouldSearchDarkFiber = searchTerm && searchTerm.trim() !== '';
  
  for (const key of allowedFields) {
    if (req.query[key]) {
      // Special handling for location fields - search both location_a and location_b
      if (key === 'location_a' || key === 'location_b') {
        // Check if we already added a location filter
        const existingLocationFilter = filters.find(f => f.includes('location_a') || f.includes('location_b'));
        if (!existingLocationFilter) {
          filters.push(`(location_a LIKE ? OR location_b LIKE ?)`);
          values.push(`%${req.query[key]}%`);
          values.push(`%${req.query[key]}%`);
        }
      } else {
        filters.push(`${key} LIKE ?`);
        values.push(`%${req.query[key]}%`);
      }
    }
  }
  
  if (shouldSearchDarkFiber) {
    // Build parameterized query to search both network_routes and dark_fiber_details
    let mainQuery = 'SELECT * FROM network_routes';
    let darkFiberQuery = `
      SELECT DISTINCT nr.* FROM network_routes nr
      INNER JOIN dark_fiber_details dfd ON nr.circuit_id = dfd.circuit_id
      WHERE dfd.dwdm_ucn LIKE ?
    `;
    
    if (filters.length > 0) {
      mainQuery += ' WHERE ' + filters.join(' AND ');
      
      // First search main network routes
      db.all(mainQuery, values, (err, mainRows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Then search dark fiber and get associated network routes
        db.all(darkFiberQuery, [`%${searchTerm}%`], (err2, darkRows) => {
          if (err2) return res.status(500).json({ error: err2.message });
          
          // Combine and deduplicate by circuit_id
          const allRows = [...mainRows, ...darkRows];
          const uniqueRows = allRows.filter((row, index, self) => 
            index === self.findIndex(r => r.circuit_id === row.circuit_id)
          );
          res.json(uniqueRows);
        });
      });
    } else {
      // No main filters, just search dark fiber
      db.all(darkFiberQuery, [`%${searchTerm}%`], (err, darkRows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Also get all main records and combine
        db.all('SELECT * FROM network_routes', [], (err2, mainRows) => {
          if (err2) return res.status(500).json({ error: err2.message });
          
          // Combine and deduplicate by circuit_id
          const allRows = [...mainRows, ...darkRows];
          const uniqueRows = allRows.filter((row, index, self) => 
            index === self.findIndex(r => r.circuit_id === row.circuit_id)
          );
          res.json(uniqueRows);
        });
      });
    }
  } else {
    // Standard search without dark fiber - use proper parameterized query
    if (filters.length > 0) {
      const query = 'SELECT * FROM network_routes WHERE ' + filters.join(' AND ');
      db.all(query, values, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      });
    } else {
      db.all('SELECT * FROM network_routes', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      });
    }
  }
});

// Dark Fiber Details CRUD with enhanced features
// Get all dark fiber details for a circuit_id
router.get('/dark_fiber_details/:circuit_id', (req, res) => {
  db.all('SELECT * FROM dark_fiber_details WHERE circuit_id = ? ORDER BY id', [req.params.circuit_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add a dark fiber detail
router.post('/dark_fiber_details', authenticateToken, (req, res) => {
  const { circuit_id, dwdm_wavelength, dwdm_ucn, equipment, in_use, capex_cost_to_light, bandwidth } = req.body;
  
  // Bandwidth validation: required when DWDM UCN has a value
  if (dwdm_ucn && dwdm_ucn.trim() !== '' && (!bandwidth || bandwidth.trim() === '')) {
    return res.status(400).json({ error: 'Bandwidth is required when DWDM UCN is specified' });
  }
  
  // Validate bandwidth options if provided
  const validBandwidths = ['1Gb', '10Gb', '100Gb', '200Gb', '400Gb', '800Gb'];
  if (bandwidth && !validBandwidths.includes(bandwidth)) {
    return res.status(400).json({ error: `Invalid bandwidth. Must be one of: ${validBandwidths.join(', ')}` });
  }
  
  db.run(
    'INSERT INTO dark_fiber_details (circuit_id, dwdm_wavelength, dwdm_ucn, equipment, in_use, capex_cost_to_light, bandwidth) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [circuit_id, dwdm_wavelength, dwdm_ucn, equipment, in_use ? 1 : 0, capex_cost_to_light, bandwidth || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Capture lastID to avoid context issues
      const recordId = this.lastID;
      
      // Use circuit_id as record ID if lastID is not available
      const logRecordId = recordId || circuit_id;
      
      // Log the creation with proper error handling
      try {
        logChange(req.user.id, 'dark_fiber_details', logRecordId, 'CREATE', null, {
          circuit_id, dwdm_wavelength, dwdm_ucn, equipment, in_use, capex_cost_to_light, bandwidth
        }, req);
      } catch (logError) {
        console.error('Failed to log dark fiber detail creation:', logError);
      }
      
      res.status(201).json({ id: recordId });
    }
  );
});
// Edit a dark fiber detail by id
router.put('/dark_fiber_details/:id', authenticateToken, (req, res) => {
  const { dwdm_wavelength, dwdm_ucn, equipment, in_use, capex_cost_to_light, bandwidth } = req.body;
  
  // Bandwidth validation: required when DWDM UCN has a value
  if (dwdm_ucn && dwdm_ucn.trim() !== '' && (!bandwidth || bandwidth.trim() === '')) {
    return res.status(400).json({ error: 'Bandwidth is required when DWDM UCN is specified' });
  }
  
  // Validate bandwidth options if provided
  const validBandwidths = ['1Gb', '10Gb', '100Gb', '200Gb', '400Gb', '800Gb'];
  if (bandwidth && !validBandwidths.includes(bandwidth)) {
    return res.status(400).json({ error: `Invalid bandwidth. Must be one of: ${validBandwidths.join(', ')}` });
  }
  
  // Get old values for change logging
  db.get('SELECT * FROM dark_fiber_details WHERE id = ?', [req.params.id], (err, oldValues) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldValues) return res.status(404).json({ error: 'Not found' });
    
    db.run(
      'UPDATE dark_fiber_details SET dwdm_wavelength = ?, dwdm_ucn = ?, equipment = ?, in_use = ?, capex_cost_to_light = ?, bandwidth = ? WHERE id = ?',
      [dwdm_wavelength, dwdm_ucn, equipment, in_use ? 1 : 0, capex_cost_to_light, bandwidth || null, req.params.id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
        
        // Log the update
        logChange(req.user.id, 'dark_fiber_details', req.params.id, 'UPDATE', oldValues, {
          dwdm_wavelength, dwdm_ucn, equipment, in_use, capex_cost_to_light, bandwidth
        }, req);
        
        res.json({ message: 'Updated' });
      }
    );
  });
});

// Delete a dark fiber detail by id
router.delete('/dark_fiber_details/:id', authenticateToken, (req, res) => {
  // Get old values for change logging
  db.get('SELECT * FROM dark_fiber_details WHERE id = ?', [req.params.id], (err, oldValues) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldValues) return res.status(404).json({ error: 'Not found' });
    
    db.run('DELETE FROM dark_fiber_details WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      
      // Log the deletion
      logChange(req.user.id, 'dark_fiber_details', req.params.id, 'DELETE', oldValues, null, req);
      
      res.json({ message: 'Deleted' });
    });
  });
});

// Reserve a DWDM UCN for 60 days
router.post('/dark_fiber_details/:id/reserve', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { reserved_by } = req.body;
  
  if (!reserved_by) {
    return res.status(400).json({ error: 'reserved_by is required' });
  }
  
  const reservedAt = new Date();
  const expiresAt = new Date(reservedAt.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days from now
  
  db.run(
    'UPDATE dark_fiber_details SET is_reserved = 1, reserved_at = ?, reserved_by = ?, reservation_expires_at = ? WHERE id = ? AND is_reserved = 0',
    [reservedAt.toISOString(), reserved_by, expiresAt.toISOString(), id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(400).json({ error: 'Cannot reserve - already reserved or not found' });
      
      // Log the reservation with standard logChange
      logChange(req.user.id, 'dark_fiber_details', id, 'RESERVE', null, {
        reserved_by, reserved_at: reservedAt.toISOString(), reservation_expires_at: expiresAt.toISOString(),
        action: 'RESERVE', duration: '60 days'
      }, req);
      
      res.json({ 
        message: 'Reserved successfully', 
        reserved_at: reservedAt.toISOString(),
        expires_at: expiresAt.toISOString()
      });
    }
  );
});

// Release a reservation
router.post('/dark_fiber_details/:id/release', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { released_by } = req.body;
  
  db.run(
    'UPDATE dark_fiber_details SET is_reserved = 0, reserved_at = NULL, reserved_by = NULL, reservation_expires_at = NULL WHERE id = ? AND is_reserved = 1',
    [id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(400).json({ error: 'Cannot release - not reserved or not found' });
      
      // Log the release with standard logChange
      logChange(req.user.id, 'dark_fiber_details', id, 'RELEASE', null, {
        released_by: released_by || req.user.username, released_at: new Date().toISOString(),
        action: 'RELEASE'
      }, req);
      
      res.json({ message: 'Released successfully' });
    }
  );
});

// Upload Test Results files (multiple files support)
router.post('/network_routes/:circuit_id/upload_test_results', authenticateToken, authorizeModulePermission('network_routes', 'provisioner'), testResultsUpload.array('test_results_files', 10), (req, res) => {
  const { circuit_id } = req.params;
  
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  
  // Check if circuit_id exists
  db.get('SELECT circuit_id FROM network_routes WHERE circuit_id = ?', [circuit_id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Circuit ID not found' });
    }
    
    const promises = req.files.map((file, index) => {
      return new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO test_results_files (circuit_id, filename, original_name, file_size) VALUES (?, ?, ?, ?)',
          [circuit_id, file.filename, file.originalname, file.size],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ id: this.lastID, filename: file.filename, original_name: file.originalname });
            }
          }
        );
      });
    });
    
    Promise.all(promises)
      .then(results => {
        // Update the main network_routes table to indicate test results exist
        const filesList = results.map(r => r.original_name).join(', ');
        db.run(
          'UPDATE network_routes SET test_results_file = ? WHERE circuit_id = ?',
          [filesList, circuit_id],
          function(updateErr) {
            if (updateErr) {
              console.error('Failed to update network_routes table:', updateErr);
            }
          }
        );
        
        // Log the test results file upload
        logChange(req.user.id, 'network_routes', circuit_id, 'UPDATE', 
          null, 
          { 
            file_action: 'TEST_RESULTS_UPLOAD', 
            files_uploaded: results.map(r => r.original_name),
            file_count: results.length
          }, 
          req);
        
        res.json({ message: 'Test Results files uploaded', files: results });
      })
      .catch(err => {
        res.status(500).json({ error: err.message });
      });
  });
});

// Get all test results files for a circuit
router.get('/network_routes/:circuit_id/test_results_files', authenticateToken, authorizeModulePermission('network_routes', 'read_only'), (req, res) => {
  const { circuit_id } = req.params;
  db.all('SELECT * FROM test_results_files WHERE circuit_id = ? ORDER BY uploaded_at DESC', [circuit_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Download Test Results files as ZIP
router.get('/network_routes/:circuit_id/download_test_results', authenticateToken, authorizeModulePermission('network_routes', 'read_only'), (req, res) => {
  const { circuit_id } = req.params;
  db.all('SELECT * FROM test_results_files WHERE circuit_id = ?', [circuit_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'No test results files found' });
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    res.attachment(`${circuit_id}_test_results.zip`);
    archive.pipe(res);
    
    rows.forEach(row => {
      const filePath = path.join(testResultsDir, row.filename);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: row.original_name });
      }
    });
    
    archive.finalize();
  });
});

// Delete a test results file
router.delete('/test_results_files/:id', authenticateToken, authorizeModulePermission('network_routes', 'provisioner'), (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM test_results_files WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'File not found' });
    
    const circuitId = row.circuit_id;
    const deletedFileInfo = {
      id: row.id,
      original_name: row.original_name,
      filename: row.filename,
      file_size: row.file_size
    };
    
    // Delete from filesystem
    const filePath = path.join(testResultsDir, row.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete from database
    db.run('DELETE FROM test_results_files WHERE id = ?', [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Log the test results file deletion
      logChange(req.user.id, 'network_routes', circuitId, 'UPDATE', 
        null, 
        { 
          file_action: 'TEST_RESULTS_DELETE', 
          deleted_file: deletedFileInfo.original_name,
          file_id: deletedFileInfo.id
        }, 
        req);
      
      // Update the main network_routes table to reflect remaining files
      db.all('SELECT original_name FROM test_results_files WHERE circuit_id = ?', [circuitId], (err, remainingFiles) => {
        if (err) {
          console.error('Failed to get remaining files:', err);
          return res.json({ message: 'File deleted' });
        }
        
        const filesList = remainingFiles.length > 0 ? remainingFiles.map(f => f.original_name).join(', ') : null;
        db.run(
          'UPDATE network_routes SET test_results_file = ? WHERE circuit_id = ?',
          [filesList, circuitId],
          function(updateErr) {
            if (updateErr) {
              console.error('Failed to update network_routes table:', updateErr);
            }
            res.json({ message: 'File deleted' });
          }
        );
      });
    });
  });
});

// ====================================
// NETWORK DESIGN & PRICING TOOL APIs
// ====================================

// ====================================
// LOCATION REFERENCE MANAGEMENT
// ====================================

// Get all locations
router.get('/locations', authenticateToken, authorizeModulePermission('locations', 'read_only'), (req, res) => {
  db.all(
    `SELECT lr.*, u.username, u.full_name 
     FROM location_reference lr 
     LEFT JOIN users u ON lr.updated_by = u.id 
     ORDER BY lr.location_code`, 
    [], 
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Process cross connect data - handle POA defaults and currency formatting
      const processedRows = rows.map(row => ({
        ...row,
        cross_connect_nrc_display: row.cross_connect_nrc ? row.cross_connect_nrc : 'POA',
        cross_connect_mrc_display: row.cross_connect_mrc ? row.cross_connect_mrc : 'POA',
        cross_connect_nrc_currency: row.cross_connect_nrc_currency || 'USD',
        cross_connect_mrc_currency: row.cross_connect_mrc_currency || 'USD',
        cross_connect_notes: row.cross_connect_notes || ''
      }));
      
      res.json(processedRows);
    }
  );
});

// Create location
router.post('/locations', authenticateToken, authorizeModulePermission('locations', 'provisioner'), (req, res) => {
  const { location_code, region, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info, 
          min_price_under_100mb, min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus,
          cross_connect_nrc, cross_connect_nrc_currency, cross_connect_mrc, cross_connect_mrc_currency, cross_connect_notes } = req.body;
  
  if (!location_code || !city || !country) {
    return res.status(400).json({ error: 'Location code, city, and country are required' });
  }
  
  // Process cross connect values - convert 'POA' string to NULL for database storage
  const processedCrossConnectNrc = (cross_connect_nrc === 'POA' || cross_connect_nrc === '' || cross_connect_nrc === undefined) ? null : parseFloat(cross_connect_nrc);
  const processedCrossConnectMrc = (cross_connect_mrc === 'POA' || cross_connect_mrc === '' || cross_connect_mrc === undefined) ? null : parseFloat(cross_connect_mrc);
  
  db.run(
    `INSERT OR REPLACE INTO location_reference (
      location_code, region, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info, 
      min_price_under_100mb, min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus,
      cross_connect_nrc, cross_connect_nrc_currency, cross_connect_mrc, cross_connect_mrc_currency, cross_connect_notes,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [location_code, region || 'AMERs', city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type || 'Tier 1', status || 'Active', provider, access_info, 
     min_price_under_100mb || 0, min_price_100_to_999mb || 0, min_price_1000_to_2999mb || 0, min_price_3000mb_plus || 0,
     processedCrossConnectNrc, cross_connect_nrc_currency || 'USD', processedCrossConnectMrc, cross_connect_mrc_currency || 'USD', cross_connect_notes || '',
     req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Capture lastID to avoid this context issues
      const recordId = this.lastID;
      
      // If lastID is not available, query the database to get the ID
      if (!recordId) {
        db.get('SELECT id FROM location_reference WHERE location_code = ? ORDER BY id DESC LIMIT 1', [location_code], (selectErr, row) => {
          if (selectErr) {
            console.error('Error querying for location ID:', selectErr);
            return res.status(500).json({ error: 'Failed to get location ID' });
          }
          
          const foundId = row ? row.id : null;
          
          // Use location_code as record ID for logging
          const logRecordId = foundId || location_code;
          
          // Log the change with proper error handling (don't block if logging fails)
          try {
            logChange(req.user.id, 'location_reference', logRecordId, 'CREATE', null, { 
              location_code, region, city, country, datacenter_name, datacenter_address, latitude, longitude, 
              time_zone, pop_type, status, provider, access_info, min_price_under_100mb, 
              min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus,
              cross_connect_nrc: processedCrossConnectNrc, cross_connect_nrc_currency, cross_connect_mrc: processedCrossConnectMrc, cross_connect_mrc_currency, cross_connect_notes 
            }, req);
          } catch (logError) {
            console.error('Failed to log location creation:', logError);
          }
          
          res.status(201).json({ id: foundId, location_code });
        });
      } else {
        // Use location_code as record ID if lastID is not available
        const logRecordId = recordId || location_code;
        
        // Log the change with proper error handling (don't block if logging fails)
        try {
          logChange(req.user.id, 'location_reference', logRecordId, 'CREATE', null, { 
            location_code, region, city, country, datacenter_name, datacenter_address, latitude, longitude, 
            time_zone, pop_type, status, provider, access_info, min_price_under_100mb, 
            min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus,
            cross_connect_nrc: processedCrossConnectNrc, cross_connect_nrc_currency, cross_connect_mrc: processedCrossConnectMrc, cross_connect_mrc_currency, cross_connect_notes 
          }, req);
        } catch (logError) {
          console.error('Failed to log location creation:', logError);
        }
        
        res.status(201).json({ id: recordId, location_code });
      }
    }
  );
});
// Update location
router.put('/locations/:id', authenticateToken, authorizeModulePermission('locations', 'provisioner'), (req, res) => {
  const { region, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info,
          min_price_under_100mb, min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus,
          cross_connect_nrc, cross_connect_nrc_currency, cross_connect_mrc, cross_connect_mrc_currency, cross_connect_notes } = req.body;
  const locationId = req.params.id;
  
  // Process cross connect values - convert 'POA' string to NULL for database storage
  const processedCrossConnectNrc = (cross_connect_nrc === 'POA' || cross_connect_nrc === '' || cross_connect_nrc === undefined) ? null : parseFloat(cross_connect_nrc);
  const processedCrossConnectMrc = (cross_connect_mrc === 'POA' || cross_connect_mrc === '' || cross_connect_mrc === undefined) ? null : parseFloat(cross_connect_mrc);
  
  // Get current location data for change logging
  db.get('SELECT * FROM location_reference WHERE id = ?', [locationId], (err, oldLocation) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldLocation) return res.status(404).json({ error: 'Location not found' });
    
    db.run(
      `UPDATE location_reference SET 
        region = ?, city = ?, country = ?, datacenter_name = ?, datacenter_address = ?, latitude = ?, longitude = ?, time_zone = ?, pop_type = ?, status = ?, provider = ?, access_info = ?, 
        min_price_under_100mb = ?, min_price_100_to_999mb = ?, min_price_1000_to_2999mb = ?, min_price_3000mb_plus = ?,
        cross_connect_nrc = ?, cross_connect_nrc_currency = ?, cross_connect_mrc = ?, cross_connect_mrc_currency = ?, cross_connect_notes = ?,
        updated_by = ?, updated_date = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [region, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info, 
       min_price_under_100mb, min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus,
       processedCrossConnectNrc, cross_connect_nrc_currency || 'USD', processedCrossConnectMrc, cross_connect_mrc_currency || 'USD', cross_connect_notes || '',
       req.user.id, locationId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Location not found' });
        
        logChange(req.user.id, 'location_reference', oldLocation.location_code, 'UPDATE', oldLocation, { 
          region, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info, 
          min_price_under_100mb, min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus,
          cross_connect_nrc: processedCrossConnectNrc, cross_connect_nrc_currency, cross_connect_mrc: processedCrossConnectMrc, cross_connect_mrc_currency, cross_connect_notes 
        }, req);
        
        res.json({ message: 'Location updated' });
      }
    );
  });
});

// Get cross connect information for a specific location
router.get('/locations/:id/cross-connect', authenticateToken, authorizeModulePermission('network_design', 'read_only'), (req, res) => {
  const locationId = req.params.id;
  
  db.get(
    `SELECT location_code, datacenter_name, 
     cross_connect_nrc, cross_connect_nrc_currency, cross_connect_mrc, cross_connect_mrc_currency, cross_connect_notes
     FROM location_reference WHERE id = ?`, 
    [locationId], 
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Location not found' });
      
      // Process data for display
      const crossConnectInfo = {
        ...row,
        cross_connect_nrc_display: row.cross_connect_nrc ? row.cross_connect_nrc : 'POA',
        cross_connect_mrc_display: row.cross_connect_mrc ? row.cross_connect_mrc : 'POA',
        cross_connect_nrc_currency: row.cross_connect_nrc_currency || 'USD',
        cross_connect_mrc_currency: row.cross_connect_mrc_currency || 'USD',
        cross_connect_notes: row.cross_connect_notes || ''
      };
      
      res.json(crossConnectInfo);
    }
  );
});

// Update cross connect information for a specific location
router.put('/locations/:id/cross-connect', authenticateToken, authorizeModulePermission('locations', 'provisioner'), (req, res) => {
  const { cross_connect_nrc, cross_connect_nrc_currency, cross_connect_mrc, cross_connect_mrc_currency, cross_connect_notes } = req.body;
  const locationId = req.params.id;
  
  // Process cross connect values - convert 'POA' string to NULL for database storage
  const processedCrossConnectNrc = (cross_connect_nrc === 'POA' || cross_connect_nrc === '' || cross_connect_nrc === undefined) ? null : parseFloat(cross_connect_nrc);
  const processedCrossConnectMrc = (cross_connect_mrc === 'POA' || cross_connect_mrc === '' || cross_connect_mrc === undefined) ? null : parseFloat(cross_connect_mrc);
  
  // Get current location data for change logging
  db.get('SELECT * FROM location_reference WHERE id = ?', [locationId], (err, oldLocation) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldLocation) return res.status(404).json({ error: 'Location not found' });
    
    db.run(
      `UPDATE location_reference SET 
        cross_connect_nrc = ?, cross_connect_nrc_currency = ?, cross_connect_mrc = ?, cross_connect_mrc_currency = ?, cross_connect_notes = ?,
        updated_by = ?, updated_date = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [processedCrossConnectNrc, cross_connect_nrc_currency || 'USD', processedCrossConnectMrc, cross_connect_mrc_currency || 'USD', cross_connect_notes || '', req.user.id, locationId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Location not found' });
        
        logChange(req.user.id, 'location_reference', oldLocation.location_code, 'CROSS_CONNECT_UPDATE', 
          { 
            cross_connect_nrc: oldLocation.cross_connect_nrc, 
            cross_connect_nrc_currency: oldLocation.cross_connect_nrc_currency, 
            cross_connect_mrc: oldLocation.cross_connect_mrc, 
            cross_connect_mrc_currency: oldLocation.cross_connect_mrc_currency, 
            cross_connect_notes: oldLocation.cross_connect_notes 
          }, 
          { 
            cross_connect_nrc: processedCrossConnectNrc, 
            cross_connect_nrc_currency, 
            cross_connect_mrc: processedCrossConnectMrc, 
            cross_connect_mrc_currency, 
            cross_connect_notes 
          }, req);
        
        res.json({ message: 'Cross connect information updated' });
      }
    );
  });
});

// Delete location
router.delete('/locations/:id', authenticateToken, authorizeModulePermission('locations', 'provisioner'), (req, res) => {
  const locationId = req.params.id;
  
  // Get location data for change logging
  db.get('SELECT * FROM location_reference WHERE id = ?', [locationId], (err, location) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!location) return res.status(404).json({ error: 'Location not found' });
    
    // Check if location is used in network routes
    const popCode = location.location_code;
    const query = `
      SELECT circuit_id, location_a, location_b
      FROM network_routes 
      WHERE location_a = ? OR location_b = ?
    `;
    
    db.all(query, [popCode, popCode], (err, routes) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (routes && routes.length > 0) {
        // Limit examples to first 5 routes for readability
        const exampleRoutes = routes.slice(0, 5).map(route => route.circuit_id);
        const moreCount = routes.length > 5 ? routes.length - 5 : 0;
        
        let errorMessage = `Cannot delete location '${popCode}'. It is currently used in ${routes.length} network route${routes.length > 1 ? 's' : ''}.`;
        errorMessage += `\n\nExample routes: ${exampleRoutes.join(', ')}`;
        if (moreCount > 0) {
          errorMessage += `\nand ${moreCount} more...`;
        }
        errorMessage += `\n\nPlease update or remove these network routes first.`;
        
        return res.status(400).json({ error: errorMessage });
      }
      
      // No dependencies found, proceed with deletion
      db.run('DELETE FROM location_reference WHERE id = ?', [locationId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Location not found' });
        
        logChange(req.user.id, 'location_reference', location.location_code, 'DELETE', location, null, req);
        
        res.json({ message: 'Location deleted' });
      });
    });
  });
});

// Update minimum pricing for a location (admin only)
router.put('/locations/:id/minimum-pricing', authenticateToken, authorizeRole('administrator'), (req, res) => {
  const { min_price_under_100mb, min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus } = req.body;
  const locationId = req.params.id;
  
  // Get current location data for change logging
  db.get('SELECT * FROM location_reference WHERE id = ?', [locationId], (err, oldLocation) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldLocation) return res.status(404).json({ error: 'Location not found' });
    
    db.run(
      'UPDATE location_reference SET min_price_under_100mb = ?, min_price_100_to_999mb = ?, min_price_1000_to_2999mb = ?, min_price_3000mb_plus = ?, updated_by = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ?',
      [min_price_under_100mb || 0, min_price_100_to_999mb || 0, min_price_1000_to_2999mb || 0, min_price_3000mb_plus || 0, req.user.id, locationId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Location not found' });
        
        logChange(req.user.id, 'location_reference', oldLocation.location_code, 'UPDATE_PRICING', 
          { min_price_under_100mb: oldLocation.min_price_under_100mb, min_price_100_to_999mb: oldLocation.min_price_100_to_999mb, 
            min_price_1000_to_2999mb: oldLocation.min_price_1000_to_2999mb, min_price_3000mb_plus: oldLocation.min_price_3000mb_plus }, 
          { min_price_under_100mb, min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus }, req);
        
        res.json({ message: 'Minimum pricing updated successfully' });
      }
    );
  });
});

// ====================================
// POP CAPABILITIES MANAGEMENT
// ====================================

// Get POP capabilities for a location
router.get('/locations/:id/capabilities', authenticateToken, authorizeModulePermission('locations', 'read_only'), (req, res) => {
  db.get('SELECT * FROM pop_capabilities WHERE location_id = ?', [req.params.id], (err, capabilities) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!capabilities) {
      // Return default capabilities if none exist
      res.json({
        location_id: req.params.id,
        cnx_extranet_wan: false,
        cnx_ethernet: false,
        cnx_voice: false,
        tdm_gateway: false,
        cnx_unigy: false,
        cnx_alpha: false,
        cnx_chrono: false,
        cnx_sdwan: false,
        csp_on_ramp: false,
        exchange_on_ramp: false,
        internet_on_ramp: false,
        transport_only_pop: false,
        cnx_colocation: false
      });
    } else {
      res.json(capabilities);
    }
  });
});

// Create or update POP capabilities
router.post('/locations/:id/capabilities', authenticateToken, authorizeModulePermission('locations', 'provisioner'), (req, res) => {
  const locationId = req.params.id;
  const capabilities = req.body;
  
  // Get current capabilities for change logging
  db.get('SELECT * FROM pop_capabilities WHERE location_id = ?', [locationId], (err, oldCapabilities) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (oldCapabilities) {
      // Update existing capabilities
      db.run(
        `UPDATE pop_capabilities SET 
         cnx_extranet_wan = ?, cnx_ethernet = ?, cnx_voice = ?, tdm_gateway = ?, 
         cnx_unigy = ?, cnx_alpha = ?, cnx_chrono = ?, cnx_sdwan = ?, 
         csp_on_ramp = ?, exchange_on_ramp = ?, internet_on_ramp = ?, transport_only_pop = ?, cnx_colocation = ?, exchange_pricing_in_region = ?,
         updated_by = ? WHERE location_id = ?`,
        [
          capabilities.cnx_extranet_wan, capabilities.cnx_ethernet, capabilities.cnx_voice, capabilities.tdm_gateway,
          capabilities.cnx_unigy, capabilities.cnx_alpha, capabilities.cnx_chrono, capabilities.cnx_sdwan,
          capabilities.csp_on_ramp, capabilities.exchange_on_ramp, capabilities.internet_on_ramp, capabilities.transport_only_pop, capabilities.cnx_colocation, capabilities.exchange_pricing_in_region,
          req.user.id, locationId
        ],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          logChange(req.user.id, 'pop_capabilities', locationId, 'UPDATE', oldCapabilities, capabilities, req);
          
          res.json({ message: 'POP capabilities updated' });
        }
      );
    } else {
      // Create new capabilities
      db.run(
        `INSERT INTO pop_capabilities (location_id, cnx_extranet_wan, cnx_ethernet, cnx_voice, tdm_gateway, 
         cnx_unigy, cnx_alpha, cnx_chrono, cnx_sdwan, csp_on_ramp, exchange_on_ramp, internet_on_ramp, transport_only_pop, cnx_colocation, exchange_pricing_in_region, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          locationId, capabilities.cnx_extranet_wan, capabilities.cnx_ethernet, capabilities.cnx_voice, capabilities.tdm_gateway,
          capabilities.cnx_unigy, capabilities.cnx_alpha, capabilities.cnx_chrono, capabilities.cnx_sdwan,
          capabilities.csp_on_ramp, capabilities.exchange_on_ramp, capabilities.internet_on_ramp, capabilities.transport_only_pop, capabilities.cnx_colocation, capabilities.exchange_pricing_in_region,
          req.user.id
        ],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          // Capture lastID to avoid context issues
          const recordId = this.lastID;
          
          // Use location_id as record ID if lastID is not available
          const logRecordId = recordId || locationId;
          
          // Log the creation with proper error handling
          try {
            logChange(req.user.id, 'pop_capabilities', logRecordId, 'CREATE', null, capabilities, req);
          } catch (logError) {
            console.error('Failed to log POP capabilities creation:', logError);
          }
          
          res.status(201).json({ id: recordId, message: 'POP capabilities created' });
        }
      );
    }
  });
});

// Exchange Rates Management
router.get('/exchange_rates', (req, res) => {
  db.all('SELECT * FROM exchange_rates ORDER BY currency_code', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/exchange_rates', authenticateToken, (req, res) => {
  const { currency_code, exchange_rate, updated_by } = req.body;
  
  // USD is the base currency and doesn't require monthly updates
  // Set next_update_due to NULL for USD, 30 days for other currencies
  let nextUpdate = null;
  if (currency_code !== 'USD') {
    nextUpdate = new Date();
    nextUpdate.setDate(nextUpdate.getDate() + 30);
    nextUpdate = nextUpdate.toISOString();
  }
  
  db.run(
    'INSERT INTO exchange_rates (currency_code, exchange_rate, next_update_due, updated_by) VALUES (?, ?, ?, ?)',
    [currency_code, exchange_rate, nextUpdate, updated_by || req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Capture lastID to avoid context issues
      const recordId = this.lastID;
      
      // Use currency_code as record ID if lastID is not available
      const logRecordId = recordId || currency_code;
      
      // Log the creation with proper error handling
      try {
        logChange(req.user.id, 'exchange_rates', logRecordId, 'CREATE', null, {
          currency_code, exchange_rate, next_update_due: nextUpdate, updated_by: updated_by || req.user.id
        }, req);
      } catch (logError) {
        console.error('Failed to log exchange rate creation:', logError);
      }
      
      res.status(201).json({ id: recordId, currency_code });
    }
  );
});

router.put('/exchange_rates/:id', authenticateToken, (req, res) => {
  const { exchange_rate, updated_by } = req.body;
  
  // Get old values for change logging
  db.get('SELECT * FROM exchange_rates WHERE id = ?', [req.params.id], (err, oldValues) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldValues) return res.status(404).json({ error: 'Exchange rate not found' });
    
    // USD is the base currency and doesn't require monthly updates
    // Set next_update_due to NULL for USD, 30 days for other currencies
    let nextUpdate = null;
    if (oldValues.currency_code !== 'USD') {
      nextUpdate = new Date();
      nextUpdate.setDate(nextUpdate.getDate() + 30);
      nextUpdate = nextUpdate.toISOString();
    }
    
    db.run(
      'UPDATE exchange_rates SET exchange_rate = ?, last_updated = CURRENT_TIMESTAMP, next_update_due = ?, updated_by = ? WHERE id = ?',
      [exchange_rate, nextUpdate, updated_by || req.user.id, req.params.id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Exchange rate not found' });
        
        // Log the update
        logChange(req.user.id, 'exchange_rates', req.params.id, 'UPDATE', oldValues, {
          exchange_rate, next_update_due: nextUpdate, updated_by: updated_by || req.user.id
        }, req);
        
        res.json({ message: 'Exchange rate updated' });
      }
    );
  });
});

router.delete('/exchange_rates/:id', authenticateToken, authorizeModulePermission('exchange_rates', 'provisioner'), (req, res) => {
  const rateId = req.params.id;
  
  // Get the exchange rate details for validation and logging
  db.get('SELECT * FROM exchange_rates WHERE id = ?', [rateId], (err, rate) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rate) return res.status(404).json({ error: 'Exchange rate not found' });
    
    // Prevent deletion of USD base currency
    if (rate.currency_code === 'USD') {
      return res.status(400).json({ error: 'USD is the base currency and cannot be deleted' });
    }
    
    // Check if exchange rate is used in network routes
    db.get('SELECT COUNT(*) as count FROM network_routes WHERE currency = ?', [rate.currency_code], (err, routeUsage) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (routeUsage.count > 0) {
        return res.status(400).json({ 
          error: 'Exchange Rate in use - Please remove from any live function before deletion'
        });
      }
      
      // Check if exchange rate is used in exchange feeds pass through fees
      db.get('SELECT COUNT(*) as count FROM exchange_feeds WHERE pass_through_currency = ?', [rate.currency_code], (err, feedUsage) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (feedUsage.count > 0) {
          return res.status(400).json({ 
            error: 'Exchange Rate in use - Please remove from any live function before deletion'
          });
        }
        
        // If not in use, proceed with deletion
        db.run('DELETE FROM exchange_rates WHERE id = ?', [rateId], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          if (this.changes === 0) return res.status(404).json({ error: 'Exchange rate not found' });
          
          // Log the deletion
          logChange(req.user.id, 'exchange_rates', rate.currency_code, 'DELETE', rate, null, req);
          
          res.json({ message: 'Exchange rate deleted successfully' });
        });
      });
    });
  });
});

// Exchange currencies endpoint for Exchange Data currency dropdowns
router.get('/exchange-currencies', (req, res) => {
  db.all('SELECT currency_code, CASE currency_code WHEN "USD" THEN "US Dollar" WHEN "EUR" THEN "Euro" WHEN "GBP" THEN "British Pound" WHEN "JPY" THEN "Japanese Yen" WHEN "AUD" THEN "Australian Dollar" WHEN "CAD" THEN "Canadian Dollar" ELSE currency_code END as currency_name FROM exchange_rates ORDER BY CASE currency_code WHEN "USD" THEN 0 ELSE 1 END, currency_code', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
// Network Design Path Finding with Dijkstra Algorithm
router.post('/network_design/find_path', authenticateToken, (req, res) => {
  const { source, destination, bandwidth, bandwidth_unit, constraints = {}, include_ull = false, use_cisco_only_routes = false, use_100gb_and_df_only = false, customerName, quoteRequestId } = req.body;
  const startTime = Date.now();
  
  // Validate inputs
  if (!source || !destination) {
    return res.status(400).json({ error: 'Source and destination are required' });
  }

  if (source === destination) {
    return res.status(400).json({ error: 'Source and destination cannot be the same' });
  }

  // Track exclusion reasons
  const exclusionReasons = {
    bandwidth: { count: 0, routes: [] },
    carrier_avoidance: { count: 0, routes: [], carriers: [] },
    local_loop_carrier_avoidance: { count: 0, routes: [], carriers: [] },
    mtu_requirement: { count: 0, routes: [] },
    ull_restriction: { count: 0, routes: [] },
    equipment_restriction: { count: 0, routes: [] },
    bandwidth_100gb_df_restriction: { count: 0, routes: [] },
    circuit_exclusion: { count: 0, routes: [], circuits: [] },
    decommission_pop: { count: 0, routes: [] },
    total_routes_available: 0,
    total_routes_excluded: 0
  };

  // First, get count of routes excluded due to decommissioned POPs
  db.all(`SELECT nr.circuit_id, nr.location_a, nr.location_b, lr_a.status as status_a, lr_b.status as status_b 
          FROM network_routes nr
          LEFT JOIN location_reference lr_a ON nr.location_a = lr_a.location_code
          LEFT JOIN location_reference lr_b ON nr.location_b = lr_b.location_code
          WHERE nr.location_a IS NOT NULL AND nr.location_b IS NOT NULL
          AND (lr_a.status = 'Under Decommission' OR lr_b.status = 'Under Decommission')`, [], (err, decommissionedRoutes) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Track decommissioned route exclusions
    decommissionedRoutes.forEach(route => {
      exclusionReasons.decommission_pop.count++;
      exclusionReasons.decommission_pop.routes.push({
        circuit_id: route.circuit_id,
        route: `${route.location_a} <-> ${route.location_b}`,
        decommissioned_location: route.status_a === 'Under Decommission' ? route.location_a : route.location_b
      });
    });

    // Get all network routes to build graph, excluding routes through decommissioned POPs
    db.all(`SELECT nr.* FROM network_routes nr
            LEFT JOIN location_reference lr_a ON nr.location_a = lr_a.location_code
            LEFT JOIN location_reference lr_b ON nr.location_b = lr_b.location_code
            WHERE nr.location_a IS NOT NULL AND nr.location_b IS NOT NULL
            AND (lr_a.status IS NULL OR lr_a.status != 'Under Decommission')
            AND (lr_b.status IS NULL OR lr_b.status != 'Under Decommission')`, [], (err, routes) => {
      if (err) return res.status(500).json({ error: err.message });
      
      console.log(`\n=== PATH FINDING DEBUG ===`);
      console.log(`Source: ${source}, Destination: ${destination}`);
      console.log(`Total routes found: ${routes.length}`);
      console.log(`Routes excluded due to decommissioned POPs: ${exclusionReasons.decommission_pop.count}`);
    
    exclusionReasons.total_routes_available = routes.length;
    
    // Build graph from routes
    const graph = {};
    const allLocations = new Set();
    let routesProcessed = 0;
    let routesSkipped = 0;
    
    routes.forEach(route => {
      const { location_a, location_b, expected_latency, cost, currency, bandwidth: routeBandwidth, underlying_carrier, circuit_id } = route;
      
      allLocations.add(location_a);
      allLocations.add(location_b);
      
      // Check if this route involves our source/destination
      const isRelevant = (location_a === source || location_b === source || 
                          location_a === destination || location_b === destination);
      
      if (isRelevant) {
        console.log(`Relevant route found: ${circuit_id} (${location_a} <-> ${location_b})`);
        console.log(`  Bandwidth: ${routeBandwidth}, Required: ${bandwidth}`);
        console.log(`  Carrier: ${underlying_carrier}`);
      }
      
      // Convert bandwidth to Mbps for comparison (all data is now in Mbps)
      let routeBandwidthMbps = routeBandwidth;
      if (routeBandwidth && routeBandwidth.toLowerCase().includes('dark fiber')) {
        routeBandwidthMbps = '200000'; // Dark fiber = 200 Gbps = 200,000 Mbps
      }
      
      // Skip routes that don't meet bandwidth requirements (now all in Mbps)
      if (bandwidth && routeBandwidthMbps && parseFloat(routeBandwidthMbps) < parseFloat(bandwidth)) {
        if (isRelevant) console.log(`  SKIPPED: Bandwidth too low (${routeBandwidthMbps} Mbps < ${bandwidth} Mbps)`);
        exclusionReasons.bandwidth.count++;
        exclusionReasons.bandwidth.routes.push({
          circuit_id,
          route: `${location_a} <-> ${location_b}`,
          available_bandwidth: routeBandwidthMbps,
          required_bandwidth: bandwidth
        });
        routesSkipped++;
        return;
      }
      
      // Skip routes with carrier constraints
      if (constraints.carrier_avoidance && underlying_carrier && 
          constraints.carrier_avoidance.some(avoidedCarrier => 
            underlying_carrier.toLowerCase().trim() === avoidedCarrier.toLowerCase().trim()
          )) {
        if (isRelevant) console.log(`  SKIPPED: Carrier avoided (${underlying_carrier})`);
        exclusionReasons.carrier_avoidance.count++;
        exclusionReasons.carrier_avoidance.routes.push({
          circuit_id,
          route: `${location_a} <-> ${location_b}`,
          carrier: underlying_carrier
        });
        if (!exclusionReasons.carrier_avoidance.carriers.includes(underlying_carrier)) {
          exclusionReasons.carrier_avoidance.carriers.push(underlying_carrier);
        }
        routesSkipped++;
        return;
      }

      // Skip routes with local loop carrier constraints
      if (constraints.carrier_avoidance && constraints.carrier_avoidance.length > 0) {
        const localLoopCarriersA = route.local_loop_carriers_a ? route.local_loop_carriers_a.split(',').map(c => c.trim()).filter(c => c) : [];
        const localLoopCarriersB = route.local_loop_carriers_b ? route.local_loop_carriers_b.split(',').map(c => c.trim()).filter(c => c) : [];
        const allLocalLoopCarriers = [...localLoopCarriersA, ...localLoopCarriersB];
        
        if (isRelevant && allLocalLoopCarriers.length > 0) {
          console.log(`  Local loop carriers: A-end=[${localLoopCarriersA.join(', ')}], B-end=[${localLoopCarriersB.join(', ')}]`);
          console.log(`  Avoiding: [${constraints.carrier_avoidance.join(', ')}]`);
        }
        
        // Use case-insensitive comparison for carrier avoidance
        const avoidedLocalCarriers = allLocalLoopCarriers.filter(carrier => 
          constraints.carrier_avoidance.some(avoidedCarrier => 
            carrier.toLowerCase().trim() === avoidedCarrier.toLowerCase().trim()
          )
        );
        
        if (avoidedLocalCarriers.length > 0) {
          if (isRelevant) console.log(`  SKIPPED: Local loop carrier(s) avoided (${avoidedLocalCarriers.join(', ')})`);
          exclusionReasons.local_loop_carrier_avoidance.count++;
          exclusionReasons.local_loop_carrier_avoidance.routes.push({
            circuit_id,
            route: `${location_a} <-> ${location_b}`,
            carriers: avoidedLocalCarriers,
            local_loop_a: localLoopCarriersA,
            local_loop_b: localLoopCarriersB
          });
          avoidedLocalCarriers.forEach(carrier => {
            if (!exclusionReasons.local_loop_carrier_avoidance.carriers.includes(carrier)) {
              exclusionReasons.local_loop_carrier_avoidance.carriers.push(carrier);
            }
          });
          routesSkipped++;
          return;
        }
      }

      // Skip routes with circuit exclusion constraints
      if (constraints.circuit_exclusion && constraints.circuit_exclusion.length > 0) {
        if (constraints.circuit_exclusion.includes(circuit_id)) {
          if (isRelevant) console.log(`  SKIPPED: Circuit excluded by user request (${circuit_id})`);
          exclusionReasons.circuit_exclusion.count++;
          exclusionReasons.circuit_exclusion.routes.push({
            circuit_id,
            route: `${location_a} <-> ${location_b}`,
            reason: 'User requested exclusion'
          });
          if (!exclusionReasons.circuit_exclusion.circuits.includes(circuit_id)) {
            exclusionReasons.circuit_exclusion.circuits.push(circuit_id);
          }
          routesSkipped++;
          return;
        }
      }

      // Skip routes based on equipment type filtering
      const equipmentType = route.equipment_type || 'Nokia'; // Default to Nokia for null values
      if (!use_cisco_only_routes) {
        // Default: Only use Nokia and Mixed routes
        if (equipmentType === 'Cisco') {
          if (isRelevant) console.log(`  SKIPPED: Cisco equipment excluded (equipment_type: ${equipmentType})`);
          exclusionReasons.equipment_restriction.count++;
          exclusionReasons.equipment_restriction.routes.push({
            circuit_id,
            route: `${location_a} <-> ${location_b}`,
            equipment_type: equipmentType,
            reason: 'Cisco equipment excluded (Include Cisco Only Routes disabled)'
          });
          routesSkipped++;
          return;
        }
      }
      // If use_cisco_only_routes is true, all equipment types (Nokia, Cisco, Mixed) are allowed

      // Skip routes that don't meet MTU requirements
      const mtuRequired = constraints.mtu_required || 1500; // Default to 1500 if not specified
      const routeMtu = route.mtu || 9212; // Default to 9212 if not specified in route
      
      if (routeMtu < mtuRequired) {
        if (isRelevant) console.log(`  SKIPPED: MTU too low (${routeMtu} < ${mtuRequired})`);
        exclusionReasons.mtu_requirement.count++;
        exclusionReasons.mtu_requirement.routes.push({
          circuit_id,
          route: `${location_a} <-> ${location_b}`,
          available_mtu: routeMtu,
          required_mtu: mtuRequired
        });
        routesSkipped++;
        return;
      }
      
      // Skip Special/ULL routes if not including ULL
      if (!include_ull && route.is_special) {
        if (isRelevant) console.log(`  SKIPPED: Special/ULL route excluded (Include ULL: ${include_ull})`);
        exclusionReasons.ull_restriction.count++;
        exclusionReasons.ull_restriction.routes.push({
          circuit_id,
          route: `${location_a} <-> ${location_b}`,
          is_special: route.is_special
        });
        routesSkipped++;
        return;
      }
      
      // Skip routes that are not 100Gb or Dark Fiber when filter is enabled
      if (use_100gb_and_df_only) {
        const bandwidth = route.bandwidth || '';
        const is100Gb = bandwidth === '100000';
        const isDarkFiber = bandwidth.includes('Dark Fiber');
        
        if (!is100Gb && !isDarkFiber) {
          if (isRelevant) console.log(`  SKIPPED: Not 100Gb or Dark Fiber (Use 100Gb and DF only: ${use_100gb_and_df_only}, bandwidth: ${bandwidth})`);
          exclusionReasons.bandwidth_100gb_df_restriction.count++;
          exclusionReasons.bandwidth_100gb_df_restriction.routes.push({
            circuit_id,
            route: `${location_a} <-> ${location_b}`,
            bandwidth: bandwidth
          });
          routesSkipped++;
          return;
        }
      }
      
      routesProcessed++;
      if (isRelevant) console.log(`  PROCESSED: Added to graph`);
      
      // Initialize graph nodes
      if (!graph[location_a]) graph[location_a] = {};
      if (!graph[location_b]) graph[location_b] = {};
      
      // Add bidirectional edges (assuming routes work both ways)
      const weight = parseFloat(expected_latency) || 100; // Default to 100ms if no latency
      const routeCost = parseFloat(cost) || 0;
      
      graph[location_a][location_b] = {
        weight,
        cost: routeCost,
        currency,
        bandwidth: routeBandwidthMbps + ' Mbps',
        carrier: underlying_carrier,
        circuit_id: route.circuit_id
      };
      
      graph[location_b][location_a] = {
        weight,
        cost: routeCost,
        currency,
        bandwidth: routeBandwidthMbps + ' Mbps',
        carrier: underlying_carrier,
        circuit_id: route.circuit_id
      };
    });
    
    exclusionReasons.total_routes_excluded = routesSkipped;
    
    console.log(`\n=== GRAPH CONSTRUCTION COMPLETE ===`);
    console.log(`Routes processed: ${routesProcessed}, Routes skipped: ${routesSkipped}`);
    console.log(`Total locations in graph: ${Object.keys(graph).length}`);
    console.log(`All locations: ${Object.keys(graph).join(', ')}`);
    console.log(`Exclusion reasons:`, JSON.stringify(exclusionReasons, null, 2));
    
    // Check if source and destination are in graph
    console.log(`\nSource (${source}) in graph: ${graph[source] ? 'YES' : 'NO'}`);
    console.log(`Destination (${destination}) in graph: ${graph[destination] ? 'YES' : 'NO'}`);
    
    if (graph[source]) {
      console.log(`Source connections: ${Object.keys(graph[source]).join(', ')}`);
    }
    if (graph[destination]) {
      console.log(`Destination connections: ${Object.keys(graph[destination]).join(', ')}`);
    }
    
    // Validate source and destination exist in graph
    if (!graph[source]) {
      console.log(`Returning 404 for source not found. Exclusion reasons:`, exclusionReasons);
      return res.status(404).json({ 
        error: `Source location ${source} not found in network`,
        exclusionReasons,
        details: 'No routes available from source location after applying constraints'
      });
    }
    
    if (!graph[destination]) {
      console.log(`Returning 404 for destination not found. Exclusion reasons:`, exclusionReasons);
      return res.status(404).json({ 
        error: `Destination location ${destination} not found in network`,
        exclusionReasons,
        details: 'No routes available to destination location after applying constraints'
      });
    }
    
    // Dijkstra's algorithm implementation
    const dijkstra = (graph, start, end) => {
      const distances = {};
      const previous = {};
      const unvisited = new Set(Object.keys(graph));
      
      // Initialize distances
      Object.keys(graph).forEach(node => {
        distances[node] = node === start ? 0 : Infinity;
        previous[node] = null;
      });
      
      while (unvisited.size > 0) {
        // Find unvisited node with minimum distance
        let current = null;
        let minDistance = Infinity;
        
        for (const node of unvisited) {
          if (distances[node] < minDistance) {
            minDistance = distances[node];
            current = node;
          }
        }
        
        if (current === null || distances[current] === Infinity) {
          break; // No path found
        }
        
        unvisited.delete(current);
        
        // If we reached the destination, we can stop
        if (current === end) {
          break;
        }
        
        // Update distances to neighbors
        Object.keys(graph[current]).forEach(neighbor => {
          if (unvisited.has(neighbor)) {
            const newDistance = distances[current] + graph[current][neighbor].weight;
            if (newDistance < distances[neighbor]) {
              distances[neighbor] = newDistance;
              previous[neighbor] = current;
            }
          }
        });
      }
      
      // Reconstruct path
      const path = [];
      let current = end;
      
      while (current !== null) {
        path.unshift(current);
        current = previous[current];
      }
      
      // Return null if no path found
      if (path[0] !== start) {
        return null;
      }
      
      return {
        path,
        totalLatency: distances[end],
        hops: path.length - 1
      };
    };
    
    // Find primary path
    const primaryPath = dijkstra(graph, source, destination);
    
    if (!primaryPath) {
      console.log(`Returning 404 for no path found. Exclusion reasons:`, exclusionReasons);
      return res.status(404).json({ 
        error: 'No possible route found between source and destination',
        exclusionReasons,
        details: 'No connected path exists between locations after applying routing constraints'
      });
    }
    
    // Calculate route details
    const routeDetails = [];
    let totalCost = 0;
    const currencies = new Set();
    
    for (let i = 0; i < primaryPath.path.length - 1; i++) {
      const from = primaryPath.path[i];
      const to = primaryPath.path[i + 1];
      const edge = graph[from][to];
      
      routeDetails.push({
        from,
        to,
        latency: edge.weight,
        cost: edge.cost,
        currency: edge.currency,
        bandwidth: edge.bandwidth,
        carrier: edge.carrier,
        circuit_id: edge.circuit_id
      });
      
      totalCost += edge.cost;
      if (edge.currency) currencies.add(edge.currency);
    }
    
    // Find diverse path (if protection required)
    let diversePath = null;
    let protectionFailureReasons = null;

    if (constraints.protection_required) {
      // Create modified graph ensuring complete POP and Circuit ID diversity
      const modifiedGraph = JSON.parse(JSON.stringify(graph));
      
      // Step 1: Remove all intermediate POPs from primary path (keep source and destination)
      const intermediatePOPs = primaryPath.path.slice(1, -1); // Exclude source and destination
      console.log(`Protection route analysis:`);
      console.log(`  Primary path POPs: ${primaryPath.path.join(' → ')}`);
      console.log(`  Removing intermediate POPs for diversity: ${intermediatePOPs.join(', ')}`);
      
      // Remove intermediate POPs entirely from the graph
      intermediatePOPs.forEach(pop => {
        if (modifiedGraph[pop]) {
          delete modifiedGraph[pop];
          
          // Remove references to this POP from all other nodes
          Object.keys(modifiedGraph).forEach(node => {
            if (modifiedGraph[node] && modifiedGraph[node][pop]) {
              delete modifiedGraph[node][pop];
            }
          });
        }
      });
      
      // Step 2: Collect all Circuit IDs used in primary path for exclusion
      const primaryCircuitIds = new Set();
      for (let i = 0; i < primaryPath.path.length - 1; i++) {
        const from = primaryPath.path[i];
        const to = primaryPath.path[i + 1];
        const edge = graph[from] && graph[from][to];
        if (edge && edge.circuit_id) {
          primaryCircuitIds.add(edge.circuit_id);
        }
      }
      
      // Step 3: Remove any remaining edges that use the same Circuit IDs as primary path
      Object.keys(modifiedGraph).forEach(fromNode => {
        Object.keys(modifiedGraph[fromNode]).forEach(toNode => {
          const edge = modifiedGraph[fromNode][toNode];
          if (edge && edge.circuit_id && primaryCircuitIds.has(edge.circuit_id)) {
            console.log(`  Removing edge ${fromNode}-${toNode} (Circuit ID: ${edge.circuit_id}) - shared with primary path`);
            delete modifiedGraph[fromNode][toNode];
          }
        });
      });
      
      // Check if source and destination still exist and are connected in modified graph
      const sourceStillConnected = modifiedGraph[source] && Object.keys(modifiedGraph[source]).length > 0;
      const destStillConnected = modifiedGraph[destination] && Object.keys(modifiedGraph[destination]).length > 0;
      
      console.log(`  Source (${source}) connections after diversity enforcement: ${sourceStillConnected ? Object.keys(modifiedGraph[source]).length : 0}`);
      console.log(`  Destination (${destination}) connections after diversity enforcement: ${destStillConnected ? Object.keys(modifiedGraph[destination]).length : 0}`);
      
      if (sourceStillConnected && destStillConnected) {
        console.log(`  Available connections from source: ${Object.keys(modifiedGraph[source]).join(', ')}`);
        console.log(`  Available connections to destination: ${Object.keys(modifiedGraph[destination]).join(', ')}`);
      }
      
      const diversePathResult = dijkstra(modifiedGraph, source, destination);
      
      if (diversePathResult) {
        // Calculate route details for diverse path
        const diverseRouteDetails = [];
        let diverseTotalCost = 0;
        const diverseCurrencies = new Set();
        
        for (let i = 0; i < diversePathResult.path.length - 1; i++) {
          const from = diversePathResult.path[i];
          const to = diversePathResult.path[i + 1];
          const edge = graph[from][to]; // Use original graph for edge details
          
          if (edge) {
            diverseRouteDetails.push({
              from,
              to,
              latency: edge.weight,
              cost: edge.cost,
              currency: edge.currency,
              bandwidth: edge.bandwidth,
              carrier: edge.carrier,
              circuit_id: edge.circuit_id
            });
            
            diverseTotalCost += edge.cost;
            if (edge.currency) diverseCurrencies.add(edge.currency);
          }
        }
        
        diversePath = {
          ...diversePathResult,
          route: diverseRouteDetails,
          totalCost: diverseTotalCost,
          currencies: Array.from(diverseCurrencies)
        };
        console.log(`  ✅ DIVERSE Protection route found: ${diversePathResult.path.join(' → ')}`);
        console.log(`  ✅ Diversity verified: No shared POPs or Circuit IDs between primary and protection paths`);
        
        // Verify diversity (additional safety check)
        const protectionPOPs = new Set(diversePathResult.path);
        const primaryPOPs = new Set(primaryPath.path);
        const sharedPOPs = [...protectionPOPs].filter(pop => primaryPOPs.has(pop) && pop !== source && pop !== destination);
        
        if (sharedPOPs.length > 0) {
          console.error(`  ⚠️  WARNING: Diversity violation detected! Shared POPs: ${sharedPOPs.join(', ')}`);
        }
      } else {
        // Analyze why protection route failed with enhanced diversity requirements
        protectionFailureReasons = {
          primary_path_used: primaryPath.path.join(' → '),
          diversity_enforcement: {
            excluded_intermediate_pops: intermediatePOPs,
            excluded_circuit_ids: Array.from(primaryCircuitIds),
            total_pops_excluded: intermediatePOPs.length,
            total_circuits_excluded: primaryCircuitIds.size
          },
          remaining_routes_analysis: {
            source_isolated: !sourceStillConnected,
            destination_isolated: !destStillConnected,
            total_remaining_edges: Object.keys(modifiedGraph).reduce((sum, node) => 
              sum + Object.keys(modifiedGraph[node] || {}).length, 0) / 2, // Divide by 2 since edges are bidirectional
            remaining_pops: Object.keys(modifiedGraph).length,
            affected_constraints: {
              bandwidth_still_excluding: exclusionReasons.bandwidth.count,
              carrier_avoidance_still_excluding: exclusionReasons.carrier_avoidance.count,
              mtu_still_excluding: exclusionReasons.mtu_requirement.count,
              ull_still_excluding: exclusionReasons.ull_restriction.count
            }
          },
          suggestion: sourceStillConnected && destStillConnected 
            ? "Insufficient diverse routes available. True protection requires completely separate POPs and circuits. Consider: 1) Adding more POPs to the network topology, 2) Relaxing bandwidth/carrier constraints, or 3) Using a different source/destination with more connectivity options."
            : `Network topology insufficient for diverse protection. After excluding intermediate POPs (${intermediatePOPs.join(', ')}) and shared circuits, no alternative path exists. Consider expanding network connectivity or using different endpoints.`
        };
        console.log(`  Protection route failed:`, protectionFailureReasons);
      }
    }
    
    const executionTime = Date.now() - startTime;
    
    // Log the search with enhanced details
    db.run(
      'INSERT INTO audit_logs (action_type, user_id, user_name, parameters, results, execution_time, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'PATH_SEARCH',
        req.user?.id || null,
        req.user?.username || 'Unknown User',
        JSON.stringify({ 
          source, 
          destination, 
          bandwidth, 
          bandwidth_unit, 
          constraints, 
          include_ull,
          use_cisco_only_routes,
          customerName: customerName || '',
          quoteRequestId: quoteRequestId || '',
          timestamp: new Date().toISOString()
        }),
        JSON.stringify({ 
          primaryPath, 
          diversePath, 
          totalCost,
          exclusionReasons,
          protectionStatus: constraints.protection_required ? {
            required: true,
            available: diversePath !== null,
            message: diversePath 
              ? 'Diverse protection route found - completely separate POPs and circuits' 
              : 'No diverse protection route available',
            diversityEnforced: true,
            failureReasons: protectionFailureReasons
          } : {
            required: false,
            message: 'Protection not requested',
            diversityEnforced: false
          }
        }),
        executionTime,
        req.ip || req.connection?.remoteAddress || 'unknown',
        req.get('User-Agent') || 'unknown'
      ],
      function(err) {
        if (err) {
          console.error('Failed to log PATH_SEARCH to audit_logs:', err);
        }
      }
    );
    
    const response = {
      request: {
        source,
        destination,
        bandwidth,
        bandwidth_unit,
        constraints,
        include_ull
      },
      primaryPath: {
        ...primaryPath,
        route: routeDetails,
        totalCost,
        currencies: Array.from(currencies)
      },
      diversePath,
      exclusionReasons,
      protectionStatus: constraints.protection_required ? {
        required: true,
        available: diversePath !== null,
        message: diversePath 
          ? 'Diverse protection route found - completely separate POPs and circuits from primary path' 
          : 'No diverse protection route available - true protection requires separate POPs and circuits',
        diversityEnforced: true,
        failureReasons: protectionFailureReasons
      } : {
        required: false,
        available: null,
        message: 'Protection not requested',
        diversityEnforced: false
      },
      executionTime,
      timestamp: new Date().toISOString()
    };
    

    res.json(response);
    });
  });
});
// Helper function to round up to nearest $10
const roundUpToNearest10 = (amount) => {
  return Math.ceil(amount / 10) * 10;
};

// Network Design with Enhanced Pricing
router.post('/network_design/calculate_pricing', authenticateToken, async (req, res) => {
  const { paths, contract_term = 12, output_currency = 'USD', include_ull = false, use_100gb_and_df_only = false, bandwidth, source, destination, protection_required = false, customerName, quoteRequestId } = req.body;
  
  if (!paths || !Array.isArray(paths)) {
    return res.status(400).json({ error: 'Paths array is required' });
  }

  if (!bandwidth || !source || !destination) {
    return res.status(400).json({ error: 'Bandwidth, source, and destination are required for enhanced pricing' });
  }
  
  // Get exchange rates, location minimum prices, and pricing logic configuration
  const queries = [
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM exchange_rates WHERE status = "Active"', [], (err, rates) => {
        if (err) reject(err);
        else resolve(rates);
      });
    }),
    new Promise((resolve, reject) => {
      db.all('SELECT location_code, min_price_under_100mb, min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus FROM location_reference WHERE location_code IN (?, ?)', [source, destination], (err, locations) => {
        if (err) reject(err);
        else resolve(locations);
      });
    }),
    getPricingLogicConfig()
  ];

  try {
    const [rates, locations, pricingConfig] = await Promise.all(queries);
    const exchangeRates = {};
    rates.forEach(rate => {
      exchangeRates[rate.currency_code] = rate.exchange_rate;
    });

    // Helper function to convert currency
    const convertCurrency = (amount, fromCurrency, toCurrency) => {
      if (fromCurrency === toCurrency) return amount;
      
      let usdAmount = amount;
      if (fromCurrency !== 'USD' && exchangeRates[fromCurrency]) {
        usdAmount = amount / exchangeRates[fromCurrency];
      }
      
      if (toCurrency !== 'USD' && exchangeRates[toCurrency]) {
        return usdAmount * exchangeRates[toCurrency];
      }
      
      return usdAmount;
    };

    // Helper function to get minimum price for bandwidth tier
    const getMinimumPrice = (bandwidthMbps, locations) => {
      let tierField;
      if (bandwidthMbps < 100) {
        tierField = 'min_price_under_100mb';
      } else if (bandwidthMbps < 1000) {
        tierField = 'min_price_100_to_999mb';
      } else if (bandwidthMbps < 3000) {
        tierField = 'min_price_1000_to_2999mb';
      } else {
        tierField = 'min_price_3000mb_plus';
      }

      let maxMinPrice = 0;
      locations.forEach(location => {
        const minPrice = parseFloat(location[tierField]) || 0;
        maxMinPrice = Math.max(maxMinPrice, minPrice);
      });

      return convertCurrency(maxMinPrice, 'USD', output_currency);
    };

    // Helper function to calculate enhanced pricing for a path with contract term-based pricing
    const calculatePathPricing = async (path, isProtection = false) => {
      let totalAllocatedCost = 0;
      
      if (path.route) {
        path.route.forEach(segment => {
          let segmentCost = parseFloat(segment.cost) || 0;
          const segmentCurrency = segment.currency || 'USD';
          const segmentBandwidth = parseFloat(segment.bandwidth) || 1000; // Default 1000 if not specified
          
          // Convert segment cost to output currency
          segmentCost = convertCurrency(segmentCost, segmentCurrency, output_currency);
          
          // Calculate allocated cost based on bandwidth utilization with bandwidth-based factors
          let utilizationFactor;
          if (isProtection) {
            utilizationFactor = segmentBandwidth <= 10000 ? 
              pricingConfig.utilizationFactors.protectionUnder10000 : 
              pricingConfig.utilizationFactors.protectionOver10000;
          } else {
            utilizationFactor = segmentBandwidth <= 10000 ? 
              pricingConfig.utilizationFactors.primaryUnder10000 : 
              pricingConfig.utilizationFactors.primaryOver10000;
          }
          const allocationRatio = bandwidth / (segmentBandwidth * utilizationFactor);
          const allocatedCost = segmentCost * allocationRatio;
          
          totalAllocatedCost += allocatedCost;
        });
      }



      // Check for promo pricing first (applies to both primary and secondary paths)
        try {
          const promoPrice = await findPromoPrice(source, destination, bandwidth);
          if (promoPrice) {
            // Convert promo price from USD to output currency
            const promoPriceConverted = convertCurrency(promoPrice.price, 'USD', output_currency);
            
            // Apply contract term discount to promo price
            let discountedPromoPrice = promoPriceConverted;
            if (contract_term === 24) {
              discountedPromoPrice = promoPriceConverted * (1 - pricingConfig.promoPricing.discount24Month / 100);
            } else if (contract_term === 36) {
              discountedPromoPrice = promoPriceConverted * (1 - pricingConfig.promoPricing.discount36Month / 100);
            }
            
            // Check if promo pricing meets minimum margin requirement
            const promoMinMargin = pricingConfig.promoPricing.minimumMarginPercent;
            const requiredAllocatedCost = discountedPromoPrice * (1 - promoMinMargin / 100);
            
            if (totalAllocatedCost <= requiredAllocatedCost) {
              // Promo pricing meets margin requirements, use it
              const actualMargin = ((discountedPromoPrice - totalAllocatedCost) / discountedPromoPrice) * 100;
              
              // Calculate NRC charge based on contract term (same logic as regular pricing)
              const termConfig = pricingConfig.contractTerms[contract_term] || pricingConfig.contractTerms[12];
              const promoNrcCharge = convertCurrency(termConfig.nrcCharge, 'USD', output_currency);
              
              return {
                allocatedCost: roundUpToNearest10(totalAllocatedCost),
                minimumPrice: roundUpToNearest10(discountedPromoPrice),
                suggestedPrice: roundUpToNearest10(discountedPromoPrice),
                minimumMargin: Math.round(actualMargin * 10) / 10,
                suggestedMargin: Math.round(actualMargin * 10) / 10,
                locationMinimum: 0,
                marginEnforced: false,
                contractTerm: contract_term,
                targetMinMargin: promoMinMargin,
                targetSuggestedMargin: promoMinMargin,
                nrcCharge: Math.round(promoNrcCharge * 100) / 100,
                promoPricing: {
                  used: true,
                  ruleId: promoPrice.ruleId,
                  ruleName: promoPrice.ruleName,
                  originalPriceUSD: promoPrice.price,
                  priceField: promoPrice.priceField
                }
              };
            }
          }
        } catch (err) {
          console.error('Error checking promo pricing:', err);
          // Continue with regular pricing if promo pricing fails
        }

      // Fall back to regular contract term-based pricing model
      let minMarginPercent, suggestedMarginPercent, nrcCharge;
      
      const termConfig = pricingConfig.contractTerms[contract_term] || pricingConfig.contractTerms[12];
      minMarginPercent = termConfig.minMargin;
      suggestedMarginPercent = termConfig.suggestedMargin;
      nrcCharge = convertCurrency(termConfig.nrcCharge, 'USD', output_currency);

      // Calculate pricing with contract term-based margins
      const minPriceByMargin = totalAllocatedCost / (1 - minMarginPercent / 100);
      const suggestedPriceByMargin = totalAllocatedCost / (1 - suggestedMarginPercent / 100);

      // Get location-based minimum price
      const locationMinPrice = getMinimumPrice(bandwidth, locations);

      // Apply minimum price enforcement
      const finalMinPrice = Math.max(minPriceByMargin, locationMinPrice);
      const finalSuggestedPrice = Math.max(suggestedPriceByMargin, locationMinPrice);

      // Calculate actual margins
      const actualMinMargin = ((finalMinPrice - totalAllocatedCost) / finalMinPrice) * 100;
      const actualSuggestedMargin = ((finalSuggestedPrice - totalAllocatedCost) / finalSuggestedPrice) * 100;

      return {
        allocatedCost: roundUpToNearest10(totalAllocatedCost),
        minimumPrice: roundUpToNearest10(finalMinPrice),
        suggestedPrice: roundUpToNearest10(finalSuggestedPrice),
        minimumMargin: Math.round(actualMinMargin * 10) / 10,
        suggestedMargin: Math.round(actualSuggestedMargin * 10) / 10,
        locationMinimum: roundUpToNearest10(locationMinPrice),
        marginEnforced: finalMinPrice > minPriceByMargin || finalSuggestedPrice > suggestedPriceByMargin,
        contractTerm: contract_term,
        targetMinMargin: minMarginPercent,
        targetSuggestedMargin: suggestedMarginPercent,
        nrcCharge: Math.round(nrcCharge * 100) / 100,
        promoPricing: {
          used: false
        }
      };
    };

    // Calculate pricing for each path (now async)
    const pricingPromises = paths.map(async (path, index) => {
      const isProtection = index > 0; // First path is primary, others are protection
      const pathPricing = await calculatePathPricing(path, isProtection);

      return {
        path: path.path,
        totalLatency: path.totalLatency,
        hops: path.hops,
        pathType: isProtection ? 'protection' : 'primary',
        pricing: {
          ...pathPricing,
          currency: output_currency,
          bandwidth: bandwidth,
          includeULL: include_ull
        }
      };
    });

    const pricingResults = await Promise.all(pricingPromises);

    // Calculate protection pricing if required
    let protectionPricing = null;
    if (protection_required && pricingResults.length >= 2) {
      const primaryPricing = pricingResults[0].pricing;
      const secondaryPricing = pricingResults[1].pricing;
      
      const protectionMultiplier = pricingConfig.charges.protectionPathMultiplier;
      
      // Protection pricing = 100% primary + 70% secondary (simple addition)
      const protectedMinPrice = primaryPricing.minimumPrice + (secondaryPricing.minimumPrice * protectionMultiplier);
      const protectedSuggestedPrice = primaryPricing.suggestedPrice + (secondaryPricing.suggestedPrice * protectionMultiplier);
      const protectedAllocatedCost = primaryPricing.allocatedCost + (secondaryPricing.allocatedCost * protectionMultiplier);
      
      // Calculate actual margins achieved
      const actualProtectedMinMargin = ((protectedMinPrice - protectedAllocatedCost) / protectedMinPrice) * 100;
      const actualProtectedSuggestedMargin = ((protectedSuggestedPrice - protectedAllocatedCost) / protectedSuggestedPrice) * 100;
      
      // NRC charge for protection is only charged once (from primary path)
      const protectionNrcCharge = primaryPricing.nrcCharge;

      protectionPricing = {
        minimumPrice: roundUpToNearest10(protectedMinPrice),
        suggestedPrice: roundUpToNearest10(protectedSuggestedPrice),
        allocatedCost: roundUpToNearest10(protectedAllocatedCost),
        minimumMargin: Math.round(actualProtectedMinMargin * 10) / 10,
        suggestedMargin: Math.round(actualProtectedSuggestedMargin * 10) / 10,
        nrcCharge: protectionNrcCharge,
        contractTerm: contract_term,
        currency: output_currency,
        serviceType: 'protected',
        composition: {
          primary: {
            minimumPrice: primaryPricing.minimumPrice,
            suggestedPrice: primaryPricing.suggestedPrice,
            allocatedCost: primaryPricing.allocatedCost,
            weight: '100%'
          },
          secondary: {
            minimumPrice: roundUpToNearest10(secondaryPricing.minimumPrice * protectionMultiplier),
            suggestedPrice: roundUpToNearest10(secondaryPricing.suggestedPrice * protectionMultiplier),
            allocatedCost: roundUpToNearest10(secondaryPricing.allocatedCost * protectionMultiplier),
            weight: `${Math.round(protectionMultiplier * 100)}%`
          }
        }
      };
    }
    
    // Log pricing calculation with enhanced details
    db.run(
      'INSERT INTO audit_logs (action_type, user_id, user_name, parameters, pricing_data, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        'CONTRACT_TERM_PRICING_CALCULATION',
        req.user?.id || null,
        req.user?.username || 'Unknown User',
        JSON.stringify({ 
          contract_term, 
          output_currency, 
          include_ull, 
          bandwidth, 
          source, 
          destination, 
          protection_required,
          customerName: customerName || '',
          quoteRequestId: quoteRequestId || '',
          timestamp: new Date().toISOString()
        }),
        JSON.stringify({ 
          inputParameters: {
            contract_term,
            output_currency,
            include_ull,
            bandwidth,
            source,
            destination,
            protection_required,
            customerName: customerName || '',
            quoteRequestId: quoteRequestId || ''
          },
          calculationResults: {
            individual: pricingResults,
            protection: protectionPricing
          },
          contractTermRules: {
            term: contract_term,
            appliedRules: contract_term === 12 ? '40%/60% margins + $1000 NRC' :
                         contract_term === 24 ? '37.5%/55% margins + $500 NRC' :
                         contract_term === 36 ? '35%/50% margins + $0 NRC' : 'Default 12-month rules'
          },
          exchangeRates: exchangeRates
        }),
        req.ip || req.connection?.remoteAddress || 'unknown',
        req.get('User-Agent') || 'unknown'
      ],
      function(err) {
        if (err) {
          console.error('Failed to log CONTRACT_TERM_PRICING_CALCULATION to audit_logs:', err);
        }
      }
    );
    
    res.json({
      results: pricingResults,
      protectionPricing: protectionPricing,
      exchangeRates: exchangeRates,
      contractTermDetails: {
        term: contract_term,
        currency: output_currency,
        rules: {
          12: { minMargin: '40%', suggestedMargin: '60%', nrc: convertCurrency(1000, 'USD', output_currency) },
          24: { minMargin: '37.5%', suggestedMargin: '55%', nrc: convertCurrency(500, 'USD', output_currency) },
          36: { minMargin: '35%', suggestedMargin: '50%', nrc: 0 }
        },
        appliedRule: contract_term === 12 ? '40%/60% margins + $1000 NRC' :
                     contract_term === 24 ? '37.5%/55% margins + $500 NRC' :
                     contract_term === 36 ? '35%/50% margins + $0 NRC' : 'Default 12-month rules'
      },
      parameters: {
        bandwidth,
        source,
        destination,
        output_currency,
        include_ull,
        protection_required,
        contract_term
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Error in pricing calculation:', err);
    res.status(500).json({ error: 'Failed to calculate pricing: ' + err.message });
  }
});

// Generate KMZ file for network path
router.post('/network_design/generate_kmz', (req, res) => {
  const { paths, metadata = {} } = req.body;
  
  if (!paths || !Array.isArray(paths)) {
    return res.status(400).json({ error: 'Paths array is required' });
  }
  
  // Get location coordinates
  const locationCodes = [...new Set(paths.flatMap(path => path.path || []))];
  
  db.all('SELECT * FROM location_reference WHERE location_code IN (' + 
         locationCodes.map(() => '?').join(',') + ')', locationCodes, (err, locations) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const locationMap = {};
    locations.forEach(loc => {
      locationMap[loc.location_code] = {
        lat: loc.latitude,
        lng: loc.longitude,
        name: loc.datacenter_name || loc.location_code,
        address: loc.datacenter_address
      };
    });
    
    // Generate KML content
    const kmlContent = generateKMLFromPaths(paths, locationMap, metadata);
    
    // Save to file
    const filename = `network_path_${Date.now()}.kmz`;
    const filePath = path.join(kmzDir, filename);
    
    try {
      fs.writeFileSync(filePath, kmlContent);
      
      // Log KMZ generation
      db.run(
        'INSERT INTO audit_logs (action_type, parameters, kmz_files) VALUES (?, ?, ?)',
        [
          'KMZ_GENERATION',
          JSON.stringify({ paths, metadata }),
          filename
        ],
        function(err) {
          if (err) console.error('Failed to log KMZ generation:', err);
        }
      );
      
      res.json({
        message: 'KMZ file generated successfully',
        filename,
        downloadUrl: `/api/download_kmz/${filename}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate KMZ file: ' + error.message });
    }
  });
});

// Save/Load Network Design Searches
router.post('/network_design/save_search', authenticateToken, (req, res) => {
  const { search_name, source_location, destination_location, bandwidth_required, 
          bandwidth_unit, include_ull, protection_required, max_latency, 
          carrier_avoidance, output_currency, contract_term, search_results } = req.body;
  
  db.run(
    'INSERT INTO network_design_searches (search_name, source_location, destination_location, bandwidth_required, bandwidth_unit, include_ull, protection_required, max_latency, carrier_avoidance, output_currency, contract_term, search_results) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [search_name, source_location, destination_location, bandwidth_required, bandwidth_unit, include_ull, protection_required, max_latency, carrier_avoidance, output_currency, contract_term, JSON.stringify(search_results)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Capture lastID to avoid context issues
      const recordId = this.lastID;
      
      // Use search_name as record ID if lastID is not available
      const logRecordId = recordId || search_name;
      
      // Log the creation with proper error handling
      try {
        logChange(req.user.id, 'network_design_searches', logRecordId, 'CREATE', null, {
          search_name, source_location, destination_location, bandwidth_required, bandwidth_unit,
          include_ull, protection_required, max_latency, carrier_avoidance, output_currency, contract_term
        }, req);
      } catch (logError) {
        console.error('Failed to log network design search creation:', logError);
      }
      
      res.status(201).json({ id: recordId, message: 'Search saved successfully' });
    }
  );
});

router.get('/network_design/saved_searches', (req, res) => {
  db.all('SELECT * FROM network_design_searches ORDER BY created_date DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(row => ({
      ...row,
      search_results: row.search_results ? JSON.parse(row.search_results) : null
    })));
  });
});

router.get('/network_design/saved_searches/:id', (req, res) => {
  db.get('SELECT * FROM network_design_searches WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Search not found' });
    res.json({
      ...row,
      search_results: row.search_results ? JSON.parse(row.search_results) : null
    });
  });
});

router.delete('/network_design/saved_searches/:id', authenticateToken, (req, res) => {
  // Get old values for change logging
  db.get('SELECT * FROM network_design_searches WHERE id = ?', [req.params.id], (err, oldValues) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldValues) return res.status(404).json({ error: 'Search not found' });
    
    db.run('DELETE FROM network_design_searches WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Search not found' });
      
      // Log the deletion
      logChange(req.user.id, 'network_design_searches', req.params.id, 'DELETE', oldValues, null, req);
      
      res.json({ message: 'Search deleted successfully' });
    });
  });
});

// Get audit logs for Network Design Tool
router.get('/network_design/audit_logs', authenticateToken, authorizeModulePermission('network_design', 'read_only'), (req, res) => {
  const { limit = 100, offset = 0, action_type } = req.query;
  
  // Check user's permission level to determine filtering
  getUserModulePermissions(req.user.id, (err, permissions) => {
    if (err) {
      console.error('Error checking permissions:', err);
      return res.status(500).json({ error: 'Permission check failed' });
    }
    
    const userPermission = permissions['network_design'];
    const isReadOnly = userPermission === 'read_only';
    
    let query = 'SELECT * FROM audit_logs';
    let params = [];
    let conditions = [];
    
    // Read-only users can only see their own logs
    if (isReadOnly) {
      conditions.push('user_id = ?');
      params.push(req.user.id);
    }
    
    // Filter by action type if provided
    if (action_type) {
      conditions.push('action_type = ?');
      params.push(action_type);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error fetching audit logs:', err);
        return res.status(500).json({ error: err.message });
      }
      
      const logs = rows.map(row => ({
        ...row,
        parameters: row.parameters ? JSON.parse(row.parameters) : null,
        results: row.results ? JSON.parse(row.results) : null,
        pricing_data: row.pricing_data ? JSON.parse(row.pricing_data) : null
      }));
      res.json(logs);
    });
  });
});



// Clear audit logs (Admin only)
router.delete('/network_design/audit_logs', authenticateToken, authorizeRole('administrator'), (req, res) => {
  db.run('DELETE FROM audit_logs', [], function(err) {
    if (err) {
      console.error('Error clearing audit logs:', err);
      return res.status(500).json({ error: 'Failed to clear audit logs' });
    }
    
    // Log the clear action
    logChange(null, 'audit_logs', null, 'CLEAR_ALL', null, { 
      cleared_count: this.changes,
      action: 'Clear all audit logs'
    }, req);
    
    res.json({ 
      message: 'Audit logs cleared successfully',
      cleared_count: this.changes
    });
  });
});

// Export audit logs to CSV (Admin only)
router.get('/network_design/audit_logs/export', authenticateToken, authorizeRole('administrator'), (req, res) => {
  db.all('SELECT * FROM audit_logs ORDER BY timestamp DESC', [], (err, rows) => {
    if (err) {
      console.error('Error exporting audit logs:', err);
      return res.status(500).json({ error: 'Failed to export audit logs' });
    }
    
    // Convert to CSV format
    const csvHeaders = 'ID,Action Type,User ID,User Name,Timestamp,Parameters,Results,Pricing Data,Execution Time,IP Address,User Agent\n';
    const csvRows = rows.map(row => {
      const escapeCsv = (str) => {
        if (str === null || str === undefined) return '';
        return `"${String(str).replace(/"/g, '""')}"`;
      };
      
      return [
        row.id,
        escapeCsv(row.action_type),
        row.user_id || '',
        escapeCsv(row.user_name),
        escapeCsv(row.timestamp),
        escapeCsv(row.parameters),
        escapeCsv(row.results),
        escapeCsv(row.pricing_data),
        row.execution_time || '',
        escapeCsv(row.ip_address),
        escapeCsv(row.user_agent)
      ].join(',');
    });
    
    const csvContent = csvHeaders + csvRows.join('\n');
    
    // Log the export action
    logChange(null, 'audit_logs', null, 'EXPORT', null, { 
      exported_count: rows.length,
      action: 'Export audit logs to CSV'
    }, req);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  });
});

// Download KMZ file
router.get('/download_kmz/:filename', authenticateToken, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(kmzDir, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'KMZ file not found' });
  }
  
  res.download(filePath, filename, (err) => {
    if (err) {
      res.status(500).json({ error: 'Error downloading file' });
    }
  });
});

// Get circuit IDs for exclusion (searchable)
router.get('/network_design/circuit_ids', authenticateToken, (req, res) => {
  const { search } = req.query;
  
  let sql = 'SELECT DISTINCT circuit_id FROM network_routes WHERE circuit_id IS NOT NULL AND circuit_id != ""';
  let params = [];
  
  if (search && search.trim()) {
    sql += ' AND circuit_id LIKE ?';
    params.push(`%${search.trim()}%`);
  }
  
  sql += ' ORDER BY circuit_id LIMIT 50'; // Limit to 50 results to prevent overwhelming the UI
  
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const circuitIds = rows.map(row => row.circuit_id);
    res.json(circuitIds);
  });
});

// Helper function to generate KML from paths
function generateKMLFromPaths(paths, locationMap, metadata) {
  const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Network Route Analysis</name>
    <description>Generated by Network Design Tool - ${new Date().toISOString()}</description>
    <Style id="redLine">
      <LineStyle>
        <color>ff0000ff</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Style id="blueLine">
      <LineStyle>
        <color>ffff0000</color>
        <width>3</width>
      </LineStyle>
    </Style>`;
  
  let kmlContent = kmlHeader;
  
  // Add placemarks for each location
  const addedLocations = new Set();
  paths.forEach(path => {
    if (path.path) {
      path.path.forEach(location => {
        if (!addedLocations.has(location) && locationMap[location]) {
          addedLocations.add(location);
          const loc = locationMap[location];
          kmlContent += `
    <Placemark>
      <name>${location}</name>
      <description>${loc.name || location}${loc.address ? '\n' + loc.address : ''}</description>
      <Point>
        <coordinates>${loc.lng},${loc.lat},0</coordinates>
      </Point>
    </Placemark>`;
        }
      });
    }
  });
  
  // Add paths
  paths.forEach((path, index) => {
    if (path.path && path.path.length > 1) {
      const pathCoordinates = path.path.map(location => {
        const loc = locationMap[location];
        return loc ? `${loc.lng},${loc.lat},0` : null;
      }).filter(coord => coord !== null);
      
      if (pathCoordinates.length > 1) {
        kmlContent += `
    <Placemark>
      <name>Path ${index + 1}</name>
      <description>Latency: ${path.totalLatency}ms, Hops: ${path.hops}</description>
      <styleUrl>#${index === 0 ? 'redLine' : 'blueLine'}</styleUrl>
      <LineString>
        <coordinates>${pathCoordinates.join(' ')}</coordinates>
      </LineString>
    </Placemark>`;
      }
    }
  });
  
  kmlContent += `
  </Document>
</kml>`;
  
  return kmlContent;
}

// ====================================
// CNX COLOCATION ENDPOINTS
// ====================================

// Configure multer for CNX Colocation file uploads
const colocationStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'colocation_files');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `colocation_${req.params.id}_${uniqueSuffix}${extension}`);
  }
});

const colocationUpload = multer({ 
  storage: colocationStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    if (file.fieldname === 'design_file' && file.mimetype === 'application/pdf') {
      cb(null, true);
    } else if (file.fieldname === 'pricing_info_file' && file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true);
    } else if (file.fieldname === 'client_design_file' && file.mimetype === 'application/pdf') {
      cb(null, true);
    } else if (file.fieldname === 'design_file') {
      cb(new Error('Design file must be a PDF'), false);
    } else if (file.fieldname === 'pricing_info_file') {
      cb(new Error('Pricing info file must be an Excel file (.xlsx)'), false);
    } else if (file.fieldname === 'client_design_file') {
      cb(new Error('Client design file must be a PDF'), false);
    } else {
      cb(new Error('Invalid file field'), false);
    }
  }
});

// Get all locations with CNX Colocation enabled
router.get('/cnx-colocation/locations', authenticateToken, authorizeModulePermission('cnx_colocation', 'read_only'), (req, res) => {
  const query = `
    SELECT lr.*, pc.cnx_colocation
    FROM location_reference lr
    LEFT JOIN pop_capabilities pc ON lr.id = pc.location_id
    WHERE pc.cnx_colocation = 1
    ORDER BY lr.location_code
  `;
  
  db.all(query, [], (err, locations) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(locations);
  });
});

// Update CNX Colocation location (design file and more info only)
router.put('/cnx-colocation/locations/:id', authenticateToken, authorizeModulePermission('cnx_colocation', 'provisioner'), colocationUpload.single('design_file'), (req, res) => {
  const locationId = req.params.id;
  const { more_info } = req.body;
  
  // Get current location data
  db.get('SELECT * FROM location_reference WHERE id = ?', [locationId], (err, location) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!location) return res.status(404).json({ error: 'Location not found' });
    
    // Check if this location has CNX Colocation enabled
    db.get('SELECT cnx_colocation FROM pop_capabilities WHERE location_id = ?', [locationId], (capErr, capabilities) => {
      if (capErr) return res.status(500).json({ error: capErr.message });
      if (!capabilities || !capabilities.cnx_colocation) {
        return res.status(403).json({ error: 'CNX Colocation is not enabled for this location' });
      }
      
      // Prepare update data
      let updateData = { more_info: more_info || null };
      
      // Handle design file upload
      if (req.file) {
        // Delete old design file if it exists
        if (location.design_file) {
          const oldFilePath = path.join(__dirname, 'colocation_files', location.design_file);
          fs.unlink(oldFilePath, (unlinkErr) => {
            if (unlinkErr) console.error('Failed to delete old design file:', unlinkErr);
          });
        }
        updateData.design_file = req.file.filename;
      }
      
      // Update location
      const updateFields = Object.keys(updateData);
      const updateValues = Object.values(updateData);
      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      
      db.run(
        `UPDATE location_reference SET ${setClause}, updated_date = CURRENT_TIMESTAMP WHERE id = ?`,
        [...updateValues, locationId],
        function(updateErr) {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          if (this.changes === 0) return res.status(404).json({ error: 'Location not found' });
          
          // Log the change
          logChange(req.user.id, 'location_reference', location.location_code, 'UPDATE_CNX_COLOCATION', 
            { more_info: location.more_info, design_file: location.design_file }, 
            updateData, req);
          
          res.json({ 
            message: 'CNX Colocation location updated successfully',
            updated_fields: updateFields
          });
                 }
       );
     });
   });
 });
// ====================================
// CNX COLOCATION RACKS ENDPOINTS
// ====================================

// Get racks for a location
router.get('/cnx-colocation/locations/:locationId/racks', authenticateToken, authorizeModulePermission('cnx_colocation', 'read_only'), (req, res) => {
  const locationId = req.params.locationId;
  
  const query = `
    SELECT r.*, 
           COUNT(c.id) as client_count,
           COALESCE(SUM(c.power_purchased), 0) as allocated_power,
           COALESCE(SUM(c.ru_purchased), 0) as ru_allocated,
           u.username, u.full_name
    FROM cnx_colocation_racks r
    LEFT JOIN cnx_colocation_clients c ON r.id = c.rack_id
    LEFT JOIN users u ON r.updated_by = u.id
    WHERE r.location_id = ?
    GROUP BY r.id
    ORDER BY r.rack_id
  `;
  
  db.all(query, [locationId], (err, racks) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(racks);
  });
});

// Create rack
router.post('/cnx-colocation/locations/:locationId/racks', authenticateToken, authorizeModulePermission('cnx_colocation', 'provisioner'), colocationUpload.single('pricing_info_file'), (req, res) => {
  const locationId = req.params.locationId;
  const { rack_id, total_power_kva, network_infrastructure, more_info } = req.body;
  
  if (!rack_id || !total_power_kva || !network_infrastructure) {
    return res.status(400).json({ error: 'Rack ID, Total Power, and Network Infrastructure are required' });
  }
  
  // Check if rack_id already exists for this location
  db.get('SELECT id FROM cnx_colocation_racks WHERE location_id = ? AND rack_id = ?', [locationId, rack_id], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(400).json({ error: 'Rack ID already exists for this location' });
    
    const pricingInfoFile = req.file ? req.file.filename : null;
    
    db.run(
      'INSERT OR REPLACE INTO cnx_colocation_racks (location_id, rack_id, total_power_kva, network_infrastructure, pricing_info_file, more_info, created_by, updated_by, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [locationId, rack_id, parseFloat(total_power_kva), network_infrastructure, pricingInfoFile, more_info || null, req.user.id, req.user.id, new Date().toISOString()],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Capture lastID to avoid context issues
        const recordId = this.lastID;
        
        // Use rack_id as record ID if lastID is not available
        const logRecordId = recordId || rack_id;
        
        // Log the creation with proper error handling
        try {
          logChange(req.user.id, 'cnx_colocation_racks', logRecordId, 'CREATE', null, 
            { locationId, rack_id, total_power_kva, network_infrastructure, pricing_info_file: pricingInfoFile, more_info }, req);
        } catch (logError) {
          console.error('Failed to log CNX colocation rack creation:', logError);
        }
        
        res.status(201).json({ id: recordId, rack_id, message: 'Rack created successfully' });
      }
    );
  });
});

// Update rack
router.put('/cnx-colocation/racks/:rackId', authenticateToken, authorizeModulePermission('cnx_colocation', 'provisioner'), colocationUpload.single('pricing_info_file'), (req, res) => {
  const rackId = req.params.rackId;
  const { rack_id, total_power_kva, network_infrastructure, more_info } = req.body;
  
  if (!rack_id || !total_power_kva || !network_infrastructure) {
    return res.status(400).json({ error: 'Rack ID, Total Power, and Network Infrastructure are required' });
  }
  
  // Get current rack data
  db.get('SELECT * FROM cnx_colocation_racks WHERE id = ?', [rackId], (err, rack) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rack) return res.status(404).json({ error: 'Rack not found' });
    
    // Check if rack_id conflicts with other racks (excluding current)
    db.get('SELECT id FROM cnx_colocation_racks WHERE location_id = ? AND rack_id = ? AND id != ?', 
      [rack.location_id, rack_id, rackId], (conflictErr, conflict) => {
      if (conflictErr) return res.status(500).json({ error: conflictErr.message });
      if (conflict) return res.status(400).json({ error: 'Rack ID already exists for this location' });
      
      let updateData = {
        rack_id,
        total_power_kva: parseFloat(total_power_kva),
        network_infrastructure,
        more_info: more_info || null
      };
      
      // Handle pricing info file
      if (req.file) {
        if (rack.pricing_info_file) {
          const oldFilePath = path.join(__dirname, 'colocation_files', rack.pricing_info_file);
          fs.unlink(oldFilePath, (unlinkErr) => {
            if (unlinkErr) console.error('Failed to delete old pricing file:', unlinkErr);
          });
        }
        updateData.pricing_info_file = req.file.filename;
      }
      
      const updateFields = Object.keys(updateData);
      const updateValues = Object.values(updateData);
      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      
      db.run(
        `UPDATE cnx_colocation_racks SET ${setClause}, updated_by = ?, updated_date = ? WHERE id = ?`,
        [...updateValues, req.user.id, new Date().toISOString(), rackId],
        function(updateErr) {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          if (this.changes === 0) return res.status(404).json({ error: 'Rack not found' });
          
          logChange(req.user.id, 'cnx_colocation_racks', rack.rack_id, 'UPDATE', rack, updateData, req);
          
          res.json({ message: 'Rack updated successfully' });
        }
      );
    });
  });
});

// Delete rack
router.delete('/cnx-colocation/racks/:rackId', authenticateToken, authorizeModulePermission('cnx_colocation', 'provisioner'), (req, res) => {
  const rackId = req.params.rackId;
  
  // Get rack data before deletion
  db.get('SELECT * FROM cnx_colocation_racks WHERE id = ?', [rackId], (err, rack) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rack) return res.status(404).json({ error: 'Rack not found' });
    
    // Check if rack has clients
    db.get('SELECT COUNT(*) as client_count FROM cnx_colocation_clients WHERE rack_id = ?', [rackId], (clientErr, clientCount) => {
      if (clientErr) return res.status(500).json({ error: clientErr.message });
      if (clientCount.client_count > 0) {
        return res.status(400).json({ error: `Cannot delete rack. It has ${clientCount.client_count} clients. Delete clients first.` });
      }
      
      // Delete rack
      db.run('DELETE FROM cnx_colocation_racks WHERE id = ?', [rackId], function(deleteErr) {
        if (deleteErr) return res.status(500).json({ error: deleteErr.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Rack not found' });
        
        // Delete associated files
        if (rack.pricing_info_file) {
          const filePath = path.join(__dirname, 'colocation_files', rack.pricing_info_file);
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) console.error('Failed to delete pricing file:', unlinkErr);
          });
        }
        
        logChange(req.user.id, 'cnx_colocation_racks', rack.rack_id, 'DELETE', rack, null, req);
        
        res.json({ message: 'Rack deleted successfully' });
      });
    });
  });
});

// ====================================
// CNX COLOCATION CLIENTS ENDPOINTS
// ====================================

// Get clients for a rack
router.get('/cnx-colocation/racks/:rackId/clients', authenticateToken, authorizeModulePermission('cnx_colocation', 'read_only'), (req, res) => {
  const rackId = req.params.rackId;
  
  db.all(
    `SELECT cc.*, u.username, u.full_name 
     FROM cnx_colocation_clients cc 
     LEFT JOIN users u ON cc.updated_by = u.id 
     WHERE cc.rack_id = ? 
     ORDER BY cc.client_name`, 
    [rackId], 
    (err, clients) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(clients);
    }
  );
});

// Create client
router.post('/cnx-colocation/racks/:rackId/clients', authenticateToken, authorizeModulePermission('cnx_colocation', 'provisioner'), colocationUpload.single('client_design_file'), (req, res) => {
  const rackId = req.params.rackId;
  const { client_name, power_purchased, ru_purchased, more_info } = req.body;
  
  if (!client_name || power_purchased === undefined || ru_purchased === undefined) {
    return res.status(400).json({ error: 'Client Name, Power Purchased, and RU Purchased are required' });
  }
  
  // Validate RU allocation doesn't exceed 30
  const ruPurchasedInt = parseInt(ru_purchased);
  if (ruPurchasedInt <= 0) {
    return res.status(400).json({ error: 'RU Purchased must be greater than 0' });
  }
  
  // Check current RU allocation for this rack
  db.get('SELECT COALESCE(SUM(ru_purchased), 0) as current_ru FROM cnx_colocation_clients WHERE rack_id = ?', [rackId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const currentRU = result.current_ru;
    const totalRU = currentRU + ruPurchasedInt;
    
    if (totalRU > 30) {
      return res.status(400).json({ 
        error: `Cannot add client: Total RU would exceed 30 (currently ${currentRU}/30 allocated, trying to add ${ruPurchasedInt} RU)` 
      });
    }
    
    const clientDesignFile = req.file ? req.file.filename : null;
  
    db.run(
      'INSERT OR REPLACE INTO cnx_colocation_clients (rack_id, client_name, power_purchased, ru_purchased, more_info, design_file, created_by, updated_by, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [rackId, client_name, parseFloat(power_purchased), parseInt(ru_purchased), more_info || null, clientDesignFile, req.user.id, req.user.id, new Date().toISOString()],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Capture lastID to avoid context issues
        const recordId = this.lastID;
        
        // Use client_name as record ID if lastID is not available
        const logRecordId = recordId || client_name;
        
        // Log the creation with proper error handling
        try {
          logChange(req.user.id, 'cnx_colocation_clients', logRecordId, 'CREATE', null, 
            { rackId, client_name, power_purchased, ru_purchased, more_info, design_file: clientDesignFile }, req);
        } catch (logError) {
          console.error('Failed to log CNX colocation client creation:', logError);
        }
        
        res.status(201).json({ id: recordId, client_name, message: 'Client created successfully' });
      }
    );
  });
});

// Update client
router.put('/cnx-colocation/clients/:clientId', authenticateToken, authorizeModulePermission('cnx_colocation', 'provisioner'), colocationUpload.single('client_design_file'), (req, res) => {
  const clientId = req.params.clientId;
  const { client_name, power_purchased, ru_purchased, more_info } = req.body;
  
  if (!client_name || power_purchased === undefined || ru_purchased === undefined) {
    return res.status(400).json({ error: 'Client Name, Power Purchased, and RU Purchased are required' });
  }
  
  // Get current client data
  db.get('SELECT * FROM cnx_colocation_clients WHERE id = ?', [clientId], (err, client) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    
    // Validate RU allocation doesn't exceed 30
    const ruPurchasedInt = parseInt(ru_purchased);
    if (ruPurchasedInt <= 0) {
      return res.status(400).json({ error: 'RU Purchased must be greater than 0' });
    }
    
    // Check current RU allocation for this rack (excluding current client)
    db.get('SELECT COALESCE(SUM(ru_purchased), 0) as current_ru FROM cnx_colocation_clients WHERE rack_id = ? AND id != ?', 
      [client.rack_id, clientId], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const currentRU = result.current_ru;
      const totalRU = currentRU + ruPurchasedInt;
      
      if (totalRU > 30) {
        return res.status(400).json({ 
          error: `Cannot update client: Total RU would exceed 30 (currently ${currentRU + client.ru_purchased}/30 allocated, trying to change to ${ruPurchasedInt} RU)` 
        });
      }
      
      // Prepare update data
      let updateData = {
        client_name,
        power_purchased: parseFloat(power_purchased),
        ru_purchased: ruPurchasedInt,
        more_info: more_info || null
      };
    
    // Handle design file upload
    if (req.file) {
      // Delete old design file if it exists
      if (client.design_file) {
        const oldFilePath = path.join(__dirname, 'colocation_files', client.design_file);
        fs.unlink(oldFilePath, (unlinkErr) => {
          if (unlinkErr) console.error('Failed to delete old client design file:', unlinkErr);
        });
      }
      updateData.design_file = req.file.filename;
    }
    
    const updateFields = Object.keys(updateData);
    const updateValues = Object.values(updateData);
    const setClause = updateFields.map(field => `${field} = ?`).join(', ');
    
      db.run(
        `UPDATE cnx_colocation_clients SET ${setClause}, updated_by = ?, updated_date = ? WHERE id = ?`,
        [...updateValues, req.user.id, new Date().toISOString(), clientId],
        function(updateErr) {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          if (this.changes === 0) return res.status(404).json({ error: 'Client not found' });
          
          logChange(req.user.id, 'cnx_colocation_clients', client.client_name, 'UPDATE', client, updateData, req);
          
          res.json({ message: 'Client updated successfully' });
        }
      );
    });
  });
});

// Delete client
router.delete('/cnx-colocation/clients/:clientId', authenticateToken, authorizeModulePermission('cnx_colocation', 'provisioner'), (req, res) => {
  const clientId = req.params.clientId;
  
  // Get client data before deletion
  db.get('SELECT * FROM cnx_colocation_clients WHERE id = ?', [clientId], (err, client) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    
    db.run('DELETE FROM cnx_colocation_clients WHERE id = ?', [clientId], function(deleteErr) {
      if (deleteErr) return res.status(500).json({ error: deleteErr.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Client not found' });
      
      // Delete associated design file
      if (client.design_file) {
        const filePath = path.join(__dirname, 'colocation_files', client.design_file);
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) console.error('Failed to delete client design file:', unlinkErr);
        });
      }
      
      logChange(req.user.id, 'cnx_colocation_clients', client.client_name, 'DELETE', client, null, req);
      
      res.json({ message: 'Client deleted successfully' });
    });
  });
});

// ====================================
// CNX COLOCATION FILE DOWNLOAD ENDPOINTS
// ====================================

// Download location design file
router.get('/cnx-colocation/locations/:id/download', authenticateToken, authorizeModulePermission('cnx_colocation', 'read_only'), (req, res) => {
  const locationId = req.params.id;
  
  db.get('SELECT design_file FROM location_reference WHERE id = ?', [locationId], (err, location) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!location) return res.status(404).json({ error: 'Location not found' });
    if (!location.design_file) return res.status(404).json({ error: 'No design file found for this location' });
    
    const filePath = path.join(__dirname, 'colocation_files', location.design_file);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Design file not found on server' });
    }
    
    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${location.design_file}"`);
    res.setHeader('Content-Type', 'application/pdf');
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('Error streaming location design file:', err);
      res.status(500).json({ error: 'Failed to download file' });
    });
  });
});

// Download rack pricing file
router.get('/cnx-colocation/racks/:id/download', authenticateToken, authorizeModulePermission('cnx_colocation', 'read_only'), (req, res) => {
  const rackId = req.params.id;
  
  db.get('SELECT pricing_info_file FROM cnx_colocation_racks WHERE id = ?', [rackId], (err, rack) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rack) return res.status(404).json({ error: 'Rack not found' });
    if (!rack.pricing_info_file) return res.status(404).json({ error: 'No pricing file found for this rack' });
    
    const filePath = path.join(__dirname, 'colocation_files', rack.pricing_info_file);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Pricing file not found on server' });
    }
    
    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${rack.pricing_info_file}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('Error streaming rack pricing file:', err);
      res.status(500).json({ error: 'Failed to download file' });
    });
  });
});

// Download client design file
router.get('/cnx-colocation/clients/:id/download', authenticateToken, authorizeModulePermission('cnx_colocation', 'read_only'), (req, res) => {
  const clientId = req.params.id;
  
  db.get('SELECT design_file FROM cnx_colocation_clients WHERE id = ?', [clientId], (err, client) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (!client.design_file) return res.status(404).json({ error: 'No design file found for this client' });
    
    const filePath = path.join(__dirname, 'colocation_files', client.design_file);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Design file not found on server' });
    }
    
    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${client.design_file}"`);
    res.setHeader('Content-Type', 'application/pdf');
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('Error streaming client design file:', err);
      res.status(500).json({ error: 'Failed to download file' });
    });
  });
});

// Delete location design file
router.delete('/cnx-colocation/locations/:id/design-file', authenticateToken, authorizeModulePermission('cnx_colocation', 'provisioner'), (req, res) => {
  const locationId = req.params.id;
  
  db.get('SELECT design_file FROM location_reference WHERE id = ?', [locationId], (err, location) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!location) return res.status(404).json({ error: 'Location not found' });
    if (!location.design_file) return res.status(404).json({ error: 'No design file to delete' });
    
    // Delete the file from filesystem
    const filePath = path.join(__dirname, 'colocation_files', location.design_file);
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) console.error('Failed to delete location design file:', unlinkErr);
    });
    
    // Remove file reference from database
    db.run('UPDATE location_reference SET design_file = NULL WHERE id = ?', [locationId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      res.json({ message: 'Design file deleted successfully' });
    });
  });
});
// Delete rack pricing file
router.delete('/cnx-colocation/racks/:id/pricing-file', authenticateToken, authorizeModulePermission('cnx_colocation', 'provisioner'), (req, res) => {
  const rackId = req.params.id;
  
  db.get('SELECT pricing_info_file FROM cnx_colocation_racks WHERE id = ?', [rackId], (err, rack) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rack) return res.status(404).json({ error: 'Rack not found' });
    if (!rack.pricing_info_file) return res.status(404).json({ error: 'No pricing file to delete' });
    
    // Delete the file from filesystem
    const filePath = path.join(__dirname, 'colocation_files', rack.pricing_info_file);
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) console.error('Failed to delete rack pricing file:', unlinkErr);
    });
    
    // Remove file reference from database
    db.run('UPDATE cnx_colocation_racks SET pricing_info_file = NULL WHERE id = ?', [rackId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      res.json({ message: 'Pricing file deleted successfully' });
    });
  });
});

// Delete client design file
router.delete('/cnx-colocation/clients/:id/design-file', authenticateToken, authorizeModulePermission('cnx_colocation', 'provisioner'), (req, res) => {
  const clientId = req.params.id;
  
  db.get('SELECT design_file FROM cnx_colocation_clients WHERE id = ?', [clientId], (err, client) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (!client.design_file) return res.status(404).json({ error: 'No design file to delete' });
    
    // Delete the file from filesystem
    const filePath = path.join(__dirname, 'colocation_files', client.design_file);
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) console.error('Failed to delete client design file:', unlinkErr);
    });
    
    // Remove file reference from database
    db.run('UPDATE cnx_colocation_clients SET design_file = NULL WHERE id = ?', [clientId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      res.json({ message: 'Design file deleted successfully' });
    });
  });
});

// ====================================
// EXCHANGE DATA ENDPOINTS
// ====================================

// Configure multer for PDF uploads
const exchangeStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'exchange_files');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'exchange_design_' + uniqueSuffix + '.pdf');
  }
});

const exchangeUpload = multer({ 
  storage: exchangeStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Get all exchanges
router.get('/exchanges', authenticateToken, authorizeModulePermission('exchange_data', 'read_only'), (req, res) => {
  const { search, region, available } = req.query;
  
  let sql = 'SELECT * FROM exchanges WHERE 1=1';
  let params = [];
  
  if (search) {
    sql += ' AND exchange_name LIKE ?';
    params.push(`%${search}%`);
  }
  
  if (region) {
    sql += ' AND region = ?';
    params.push(region);
  }
  
  if (available !== undefined) {
    sql += ' AND available = ?';
    params.push(available === 'true' ? 1 : 0);
  }
  
  sql += ' ORDER BY region, exchange_name';
  
  db.all(sql, params, (err, exchanges) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(exchanges);
  });
});

// Create exchange (admin only)
router.post('/exchanges', authenticateToken, authorizeModulePermission('exchange_data', 'provisioner'), (req, res) => {
  const { exchange_name, region, available, salesperson_assigned } = req.body;
  
  if (!exchange_name || !region) {
    return res.status(400).json({ error: 'Exchange name and region are required' });
  }
  
  db.run(
    'INSERT OR REPLACE INTO exchanges (exchange_name, region, salesperson_assigned, available, created_by) VALUES (?, ?, ?, ?, ?)',
    [exchange_name, region, salesperson_assigned || null, available !== false ? 1 : 0, req.user.id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: `Exchange '${exchange_name}' already exists in region '${region}'` });
        }
        return res.status(500).json({ error: err.message });
      }
      
      // Capture lastID to avoid this context issues
      const recordId = this.lastID;
      
      // Use exchange_name as record ID if lastID is not available
      const logRecordId = recordId || exchange_name;
      
      // Log the change with proper error handling (don't block if logging fails)
      try {
        logChange(req.user.id, 'exchanges', logRecordId, 'CREATE', null, { 
          exchange_name, region, salesperson_assigned, available 
        }, req);
      } catch (logError) {
        console.error('Failed to log exchange creation:', logError);
      }
      
      res.status(201).json({ id: recordId, exchange_name, message: 'Exchange created successfully' });
    }
  );
});

// Update exchange (admin only)
router.put('/exchanges/:id', authenticateToken, authorizeModulePermission('exchange_data', 'provisioner'), (req, res) => {
  const { exchange_name, region, available, salesperson_assigned } = req.body;
  const exchangeId = req.params.id;
  
  // Check if exchange has feeds or contacts (prevent deletion if it does)
  db.get('SELECT COUNT(*) as feed_count FROM exchange_feeds WHERE exchange_id = ?', [exchangeId], (err, feedResult) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get('SELECT COUNT(*) as contact_count FROM exchange_contacts WHERE exchange_id = ?', [exchangeId], (err, contactResult) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Get current exchange data for change logging
      db.get('SELECT * FROM exchanges WHERE id = ?', [exchangeId], (err, oldExchange) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!oldExchange) return res.status(404).json({ error: 'Exchange not found' });
        
        db.run(
          'INSERT OR REPLACE INTO exchanges (id, exchange_name, region, salesperson_assigned, available, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
          [exchangeId, exchange_name, region, salesperson_assigned || null, available !== false ? 1 : 0, req.user.id],
          function(err) {
            if (err) {
              if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: `Exchange '${exchange_name}' already exists in region '${region}'` });
              }
              return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) return res.status(404).json({ error: 'Exchange not found' });
            
            logChange(req.user.id, 'exchanges', exchangeId, 'UPDATE', oldExchange, { exchange_name, region, salesperson_assigned, available }, req);
            
            res.json({ message: 'Exchange updated successfully' });
          }
        );
      });
    });
  });
});

// Delete exchange (admin only, only if no feeds or contacts)
router.delete('/exchanges/:id', authenticateToken, authorizeModulePermission('exchange_data', 'provisioner'), (req, res) => {
  const exchangeId = req.params.id;
  
  // Check if exchange has feeds or contacts
  db.get('SELECT COUNT(*) as feed_count FROM exchange_feeds WHERE exchange_id = ?', [exchangeId], (err, feedResult) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get('SELECT COUNT(*) as contact_count FROM exchange_contacts WHERE exchange_id = ?', [exchangeId], (err, contactResult) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (feedResult.feed_count > 0 || contactResult.contact_count > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete exchange with existing feeds or contacts',
          details: `Exchange has ${feedResult.feed_count} feeds and ${contactResult.contact_count} contacts`
        });
      }
      
      // Get current exchange data for change logging
      db.get('SELECT * FROM exchanges WHERE id = ?', [exchangeId], (err, oldExchange) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!oldExchange) return res.status(404).json({ error: 'Exchange not found' });
        
        db.run('DELETE FROM exchanges WHERE id = ?', [exchangeId], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          if (this.changes === 0) return res.status(404).json({ error: 'Exchange not found' });
          
          logChange(req.user.id, 'exchanges', exchangeId, 'DELETE', oldExchange, null, req);
          
          res.json({ message: 'Exchange deleted successfully' });
        });
      });
    });
  });
});

// Get exchange feeds for a specific exchange
router.get('/exchanges/:id/feeds', authenticateToken, authorizeModulePermission('exchange_data', 'read_only'), (req, res) => {
  const exchangeId = req.params.id;
  const { search } = req.query;
  
  let sql = 'SELECT * FROM exchange_feeds WHERE exchange_id = ?';
  let params = [exchangeId];
  
  if (search) {
    sql += ' AND feed_name LIKE ?';
    params.push(`%${search}%`);
  }
  
  sql += ' ORDER BY feed_name';
  
  db.all(sql, params, (err, feeds) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(feeds);
  });
});
// Create exchange feed
router.post('/exchanges/:id/feeds', authenticateToken, authorizeModulePermission('exchange_data', 'provisioner'), exchangeUpload.single('design_file'), (req, res) => {
  const exchangeId = req.params.id;
  const {
    feed_name, feed_delivery, feed_type, isf_enabled, 
    isf_a, isf_b, isf_site_code_a, isf_site_code_b,
    isf_dr_a, isf_dr_b, isf_dr_site_code_a, isf_dr_site_code_b, 
    dr_type, order_entry_isf, dr_order_entry_isf, unicast_isf,
    dr_available, bandwidth_1ms, available_now, quick_quote, pass_through_fees, 
    pass_through_currency, pass_through_fees_info, more_info,
    quick_quote_min_cost, order_entry_cost
  } = req.body;
  
  if (!feed_name) {
    return res.status(400).json({ error: 'Feed name is required' });
  }
  
  if (!feed_delivery) {
    return res.status(400).json({ error: 'Feed delivery is required' });
  }
  
  if (!feed_type) {
    return res.status(400).json({ error: 'Feed type is required' });
  }
  
  // ISF validation: if enabled, at least one field must be filled
  if (isf_enabled === 'true' || isf_enabled === true) {
    const isfFields = [isf_a, isf_b, isf_site_code_a, isf_site_code_b, isf_dr_a, isf_dr_b, 
                       isf_dr_site_code_a, isf_dr_site_code_b, order_entry_isf, dr_order_entry_isf, unicast_isf];
    const hasISFData = isfFields.some(field => field && field.trim() !== '');
    
    if (!hasISFData) {
      return res.status(400).json({ error: 'Please enter ISF details or disable ISF' });
    }
  }
  
  // Validate feed type - now using direct frontend values
  const validFeedTypes = ['Equities', 'Futures', 'Options', 'Fixed Income', 'FX', 'Commodities', 'Indices', 'ETFs', 'Alternative Data', 'Reference Data', 'Mixed'];
  
  if (!validFeedTypes.includes(feed_type)) {
    return res.status(400).json({ error: `Invalid feed type. Must be one of: ${validFeedTypes.join(', ')}` });
  }

  // Quick Quote validation: if enabled, minimum cost is required
  if (quick_quote === 'true' || quick_quote === true) {
    if (!quick_quote_min_cost || parseFloat(quick_quote_min_cost) <= 0) {
      return res.status(400).json({ error: 'A & B Feed Minimum Cost is required when Quick Quote is enabled' });
    }
  }
  
  const designFilePath = req.file ? req.file.filename : null;
  
  db.run(
    `INSERT OR REPLACE INTO exchange_feeds (
      exchange_id, feed_name, feed_delivery, feed_type, isf_enabled, 
      isf_a, isf_b, isf_site_code_a, isf_site_code_b,
      isf_dr_a, isf_dr_b, isf_dr_site_code_a, isf_dr_site_code_b, 
      dr_type, order_entry_isf, dr_order_entry_isf, unicast_isf,
      dr_available, bandwidth_1ms, available_now, quick_quote, pass_through_fees, 
      pass_through_currency, pass_through_fees_info, design_file_path, more_info,
      quick_quote_min_cost, order_entry_cost, created_by, updated_by, updated_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exchangeId, feed_name, feed_delivery, feed_type, isf_enabled === 'true' ? 1 : 0,
      isf_a || null, isf_b || null, isf_site_code_a || null, isf_site_code_b || null,
      isf_dr_a || null, isf_dr_b || null, isf_dr_site_code_a || null, isf_dr_site_code_b || null,
      dr_type || null, order_entry_isf || null, dr_order_entry_isf || null, unicast_isf || null,
      dr_available === 'true' ? 1 : 0, bandwidth_1ms,
      available_now === 'true' ? 1 : 0, quick_quote === 'true' ? 1 : 0,
      parseInt(pass_through_fees) || 0, pass_through_currency || 'USD', 
      pass_through_fees_info || '', designFilePath, more_info,
      quick_quote_min_cost ? parseFloat(quick_quote_min_cost) : null,
      order_entry_cost ? parseFloat(order_entry_cost) : null, req.user.id, req.user.id, new Date().toISOString()
    ],
    function(err) {
      if (err) {
        console.error('Exchange feed creation database error:', err);
        return res.status(500).json({ error: err.message });
      }
      
      // Capture lastID to avoid this context issues
      const recordId = this.lastID;
      
      // If file was uploaded, record it in exchange_files table
      if (req.file && recordId) {
        db.run(
          'INSERT OR REPLACE INTO exchange_files (exchange_feed_id, filename, original_name, file_size) VALUES (?, ?, ?, ?)',
          [recordId, req.file.filename, req.file.originalname, req.file.size],
          (err) => {
            if (err) console.error('Failed to record file upload:', err);
          }
        );
      }
      
      // Use feed_name as record ID if lastID is not available
      const logRecordId = recordId || feed_name;
      
      // Log the change with proper error handling (don't block if logging fails)
      try {
        logChange(req.user.id, 'exchange_feeds', logRecordId, 'CREATE', null, {
          exchange_id: exchangeId, feed_name, feed_delivery, feed_type, isf_enabled, 
          isf_a, isf_b, isf_site_code_a, isf_site_code_b, isf_dr_a, isf_dr_b,
          isf_dr_site_code_a, isf_dr_site_code_b, dr_type, order_entry_isf, unicast_isf,
          dr_available, bandwidth_1ms, available_now, quick_quote, pass_through_fees, 
          pass_through_currency, pass_through_fees_info, more_info
        }, req);
      } catch (logError) {
        console.error('Failed to log exchange feed creation:', logError);
      }
      
      res.status(201).json({ id: recordId, feed_name, message: 'Exchange feed created successfully' });
    }
  );
});

// Update exchange feed
router.put('/exchanges/:exchangeId/feeds/:feedId', authenticateToken, authorizeModulePermission('exchange_data', 'provisioner'), exchangeUpload.single('design_file'), (req, res) => {
  const { exchangeId, feedId } = req.params;
  const {
    feed_name, feed_delivery, feed_type, isf_enabled,
    isf_a, isf_b, isf_site_code_a, isf_site_code_b,
    isf_dr_a, isf_dr_b, isf_dr_site_code_a, isf_dr_site_code_b,
    dr_type, order_entry_isf, dr_order_entry_isf, unicast_isf,
    dr_available, bandwidth_1ms, available_now, quick_quote, pass_through_fees, 
    pass_through_currency, pass_through_fees_info, more_info,
    quick_quote_min_cost, order_entry_cost
  } = req.body;
  
  // ISF validation: if enabled, at least one field must be filled
  if (isf_enabled === 'true' || isf_enabled === true) {
    const isfFields = [isf_a, isf_b, isf_site_code_a, isf_site_code_b, isf_dr_a, isf_dr_b, 
                       isf_dr_site_code_a, isf_dr_site_code_b, order_entry_isf, dr_order_entry_isf, unicast_isf];
    const hasISFData = isfFields.some(field => field && field.trim() !== '');
    
    if (!hasISFData) {
      return res.status(400).json({ error: 'Please enter ISF details or disable ISF' });
    }
  }
  
  // Validate feed type - now using direct frontend values
  if (feed_type) {
    const validFeedTypes = ['Equities', 'Futures', 'Options', 'Fixed Income', 'FX', 'Commodities', 'Indices', 'ETFs', 'Alternative Data', 'Reference Data', 'Mixed'];
    
    if (!validFeedTypes.includes(feed_type)) {
      return res.status(400).json({ error: `Invalid feed type. Must be one of: ${validFeedTypes.join(', ')}` });
    }
  }

  // Quick Quote validation: if enabled, minimum cost is required
  if (quick_quote === 'true' || quick_quote === true) {
    if (!quick_quote_min_cost || parseFloat(quick_quote_min_cost) <= 0) {
      return res.status(400).json({ error: 'A & B Feed Minimum Cost is required when Quick Quote is enabled' });
    }
  }
  
  // Get current feed data for change logging
  db.get('SELECT * FROM exchange_feeds WHERE id = ? AND exchange_id = ?', [feedId, exchangeId], (err, oldFeed) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldFeed) return res.status(404).json({ error: 'Exchange feed not found' });
    
    let designFilePath = oldFeed.design_file_path;
    
    // Handle new file upload
    if (req.file) {
      // Delete old file if it exists
      if (oldFeed.design_file_path) {
        const oldFilePath = path.join(__dirname, 'exchange_files', oldFeed.design_file_path);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      designFilePath = req.file.filename;
      
      // Record new file
      db.run(
        'INSERT OR REPLACE INTO exchange_files (exchange_feed_id, filename, original_name, file_size) VALUES (?, ?, ?, ?)',
        [feedId, req.file.filename, req.file.originalname, req.file.size],
        (err) => {
          if (err) console.error('Failed to record file upload:', err);
        }
      );
    }
    
    db.run(
      `INSERT OR REPLACE INTO exchange_feeds (
        id, exchange_id, feed_name, feed_delivery, feed_type, isf_enabled, 
        isf_a, isf_b, isf_site_code_a, isf_site_code_b,
        isf_dr_a, isf_dr_b, isf_dr_site_code_a, isf_dr_site_code_b,
        dr_type, order_entry_isf, dr_order_entry_isf, unicast_isf,
        dr_available, bandwidth_1ms, available_now, quick_quote, 
        pass_through_fees, pass_through_currency, pass_through_fees_info, 
        design_file_path, more_info, quick_quote_min_cost, order_entry_cost, updated_by, updated_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        feedId, exchangeId, feed_name, feed_delivery, feed_type, isf_enabled === 'true' ? 1 : 0, 
        isf_a || null, isf_b || null, isf_site_code_a || null, isf_site_code_b || null,
        isf_dr_a || null, isf_dr_b || null, isf_dr_site_code_a || null, isf_dr_site_code_b || null,
        dr_type || null, order_entry_isf || null, dr_order_entry_isf || null, unicast_isf || null,
        dr_available === 'true' ? 1 : 0, bandwidth_1ms,
        available_now === 'true' ? 1 : 0, quick_quote === 'true' ? 1 : 0,
        parseInt(pass_through_fees) || 0, pass_through_currency || 'USD', 
        pass_through_fees_info || '', designFilePath, more_info,
        quick_quote_min_cost ? parseFloat(quick_quote_min_cost) : null,
        order_entry_cost ? parseFloat(order_entry_cost) : null, req.user.id, new Date().toISOString()
      ],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Exchange feed not found' });
        
        logChange(req.user.id, 'exchange_feeds', feedId, 'UPDATE', oldFeed, {
          feed_name, feed_delivery, feed_type, isf_enabled, isf_a, isf_b, isf_site_code_a, isf_site_code_b,
          isf_dr_a, isf_dr_b, isf_dr_site_code_a, isf_dr_site_code_b, dr_type, order_entry_isf, dr_order_entry_isf, unicast_isf,
          dr_available, bandwidth_1ms, available_now, quick_quote, pass_through_fees, 
          pass_through_currency, pass_through_fees_info, more_info, quick_quote_min_cost, order_entry_cost
        }, req);
        
        res.json({ message: 'Exchange feed updated successfully' });
      }
    );
  });
});

// Get exchange feed tracking details
router.get('/exchanges/:exchangeId/feeds/:feedId/tracking', authenticateToken, authorizeModulePermission('exchange_data', 'read_only'), (req, res) => {
  const { exchangeId, feedId } = req.params;
  
  db.get(
    `SELECT ef.updated_by, ef.updated_date, u.username, u.full_name 
     FROM exchange_feeds ef 
     LEFT JOIN users u ON ef.updated_by = u.id 
     WHERE ef.id = ? AND ef.exchange_id = ?`,
    [feedId, exchangeId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!result) return res.status(404).json({ error: 'Exchange feed not found' });
      
      res.json({
        updated_by: result.updated_by,
        updated_date: result.updated_date,
        username: result.username,
        full_name: result.full_name
      });
    }
  );
});

// Delete exchange feed
router.delete('/exchanges/:exchangeId/feeds/:feedId', authenticateToken, authorizeModulePermission('exchange_data', 'provisioner'), (req, res) => {
  const { exchangeId, feedId } = req.params;
  
  // Get current feed data for change logging and file cleanup
  db.get('SELECT * FROM exchange_feeds WHERE id = ? AND exchange_id = ?', [feedId, exchangeId], (err, oldFeed) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldFeed) return res.status(404).json({ error: 'Exchange feed not found' });
    
    // Delete associated file if it exists
    if (oldFeed.design_file_path) {
      const filePath = path.join(__dirname, 'exchange_files', oldFeed.design_file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    db.run('DELETE FROM exchange_feeds WHERE id = ? AND exchange_id = ?', [feedId, exchangeId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Exchange feed not found' });
      
              logChange(req.user.id, 'exchange_feeds', feedId, 'DELETE', oldFeed, null, req);
      
      res.json({ message: 'Exchange feed deleted successfully' });
    });
  });
});

// Download exchange design file
router.get('/exchanges/:exchangeId/feeds/:feedId/download', authenticateToken, authorizeModulePermission('exchange_data', 'read_only'), (req, res) => {
  const { exchangeId, feedId } = req.params;
  
  db.get('SELECT design_file_path FROM exchange_feeds WHERE id = ? AND exchange_id = ?', [feedId, exchangeId], (err, feed) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!feed || !feed.design_file_path) {
      return res.status(404).json({ error: 'Design file not found' });
    }
    
    const filePath = path.join(__dirname, 'exchange_files', feed.design_file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Design file not found on server' });
    }
    
    res.download(filePath, `exchange_design_${feedId}.pdf`);
  });
});

// Delete exchange feed design file only
router.delete('/exchanges/:exchangeId/feeds/:feedId/design-file', authenticateToken, authorizeModulePermission('exchange_data', 'provisioner'), (req, res) => {
  const { exchangeId, feedId } = req.params;
  
  db.get('SELECT design_file_path FROM exchange_feeds WHERE id = ? AND exchange_id = ?', [feedId, exchangeId], (err, feed) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!feed) return res.status(404).json({ error: 'Exchange feed not found' });
    if (!feed.design_file_path) return res.status(404).json({ error: 'No design file to delete' });
    
    // Delete the file from filesystem
    const filePath = path.join(__dirname, 'exchange_files', feed.design_file_path);
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) console.error('Failed to delete exchange design file:', unlinkErr);
    });
    
    // Remove file reference from database
    db.run('UPDATE exchange_feeds SET design_file_path = NULL WHERE id = ? AND exchange_id = ?', [feedId, exchangeId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Also remove from exchange_files table
      db.run('DELETE FROM exchange_files WHERE exchange_feed_id = ?', [feedId], function(err) {
        if (err) console.error('Failed to remove exchange file record:', err);
      });
      
      res.json({ message: 'Design file deleted successfully' });
    });
  });
});

// Get exchange contacts for a specific exchange
router.get('/exchanges/:id/contacts', authenticateToken, authorizeModulePermission('exchange_data', 'read_only'), (req, res) => {
  const exchangeId = req.params.id;
  
  db.all(
    `SELECT ec.*, u.username, u.full_name 
     FROM exchange_contacts ec 
     LEFT JOIN users u ON ec.updated_by = u.id 
     WHERE ec.exchange_id = ? 
     ORDER BY ec.contact_name`, 
    [exchangeId], 
    (err, contacts) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(contacts);
    }
  );
});

// Create exchange contact
router.post('/exchanges/:id/contacts', authenticateToken, authorizeModulePermission('exchange_data', 'provisioner'), (req, res) => {
  const exchangeId = req.params.id;
  const {
    contact_name, job_title, country, phone_number, email,
    contact_type, daily_contact, more_info
  } = req.body;
  
  if (!contact_name) {
    return res.status(400).json({ error: 'Contact name is required' });
  }
  
  db.run(
    `INSERT OR REPLACE INTO exchange_contacts (
      exchange_id, contact_name, job_title, country, phone_number, email,
      contact_type, daily_contact, more_info, created_by, updated_by, updated_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exchangeId, contact_name, job_title, country, phone_number, email,
      contact_type, (daily_contact === 'true' || daily_contact === true) ? 1 : 0, more_info, req.user.id, req.user.id, new Date().toISOString()
    ],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Capture lastID to avoid this context issues
      const recordId = this.lastID;
      
      // Use contact_name as record ID if lastID is not available
      const logRecordId = recordId || contact_name;
      
      // Log the change with proper error handling (don't block if logging fails)
      try {
        logChange(req.user.id, 'exchange_contacts', logRecordId, 'CREATE', null, {
          exchange_id: exchangeId, contact_name, job_title, country, phone_number,
          email, contact_type, daily_contact, more_info
        }, req);
      } catch (logError) {
        console.error('Failed to log exchange contact creation:', logError);
      }
      
      res.status(201).json({ id: recordId, contact_name, message: 'Exchange contact created successfully' });
    }
  );
});

// Update exchange contact
router.put('/exchanges/:exchangeId/contacts/:contactId', authenticateToken, authorizeModulePermission('exchange_data', 'provisioner'), (req, res) => {
  const { exchangeId, contactId } = req.params;
  const {
    contact_name, job_title, country, phone_number, email,
    contact_type, daily_contact, more_info
  } = req.body;
  
  // Get current contact data for change logging
  db.get('SELECT * FROM exchange_contacts WHERE id = ? AND exchange_id = ?', [contactId, exchangeId], (err, oldContact) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldContact) return res.status(404).json({ error: 'Exchange contact not found' });
    
    db.run(
      `INSERT OR REPLACE INTO exchange_contacts (
        id, exchange_id, contact_name, job_title, country, phone_number, email,
        contact_type, daily_contact, more_info, updated_date, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contactId, exchangeId, contact_name, job_title, country, phone_number, email,
        contact_type, (daily_contact === 'true' || daily_contact === true) ? 1 : 0, more_info, new Date().toISOString(), req.user.id
      ],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Exchange contact not found' });
        
        logChange(req.user.id, 'exchange_contacts', contactId, 'UPDATE', oldContact, {
          contact_name, job_title, country, phone_number, email,
          contact_type, daily_contact, more_info
        }, req);
        
        res.json({ message: 'Exchange contact updated successfully' });
      }
    );
  });
});

// Delete exchange contact
router.delete('/exchanges/:exchangeId/contacts/:contactId', authenticateToken, authorizeModulePermission('exchange_data', 'provisioner'), (req, res) => {
  const { exchangeId, contactId } = req.params;
  
  // Get current contact data for change logging
  db.get('SELECT * FROM exchange_contacts WHERE id = ? AND exchange_id = ?', [contactId, exchangeId], (err, oldContact) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldContact) return res.status(404).json({ error: 'Exchange contact not found' });
    
    db.run('DELETE FROM exchange_contacts WHERE id = ? AND exchange_id = ?', [contactId, exchangeId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Exchange contact not found' });
      
              logChange(req.user.id, 'exchange_contacts', contactId, 'DELETE', oldContact, null, req);
      
      res.json({ message: 'Exchange contact deleted successfully' });
    });
  });
});

// Get overdue exchange contacts (365+ days without update)
router.get('/exchanges/overdue-contacts', authenticateToken, authorizeModulePermission('exchange_data', 'read_only'), (req, res) => {
  const sql = `
    SELECT 
      ec.*,
      e.exchange_name,
      e.region,
      julianday('now') - julianday(COALESCE(ec.last_updated, ec.created_at)) as days_since_update
    FROM exchange_contacts ec
    JOIN exchanges e ON ec.exchange_id = e.id
    WHERE julianday('now') - julianday(COALESCE(ec.last_updated, ec.created_at)) >= 365
    ORDER BY days_since_update DESC, e.exchange_name, ec.contact_name
  `;
  
  db.all(sql, [], (err, contacts) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(contacts);
  });
});
// Approve exchange contact yearly update
router.post('/exchanges/:exchangeId/contacts/:contactId/approve', authenticateToken, authorizeModulePermission('exchange_data', 'provisioner'), (req, res) => {
  const { exchangeId, contactId } = req.params;
  
  // Get current contact data for change logging
  db.get('SELECT * FROM exchange_contacts WHERE id = ? AND exchange_id = ?', [contactId, exchangeId], (err, contact) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!contact) return res.status(404).json({ error: 'Exchange contact not found' });
    
    db.run(
      `INSERT OR REPLACE INTO exchange_contacts (id, exchange_id, contact_name, job_title, country, phone_number, email,
        contact_type, daily_contact, more_info, last_updated, updated_by, approved_by, approved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP)`,
      [contactId, exchangeId, contact.contact_name, contact.job_title, contact.country, contact.phone_number, contact.email,
        contact.contact_type, contact.daily_contact, contact.more_info, req.user.id, req.user.id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Exchange contact not found' });
        
        logChange(null, 'exchange_contacts', contactId, 'APPROVE_YEARLY_UPDATE', contact, {
          approved_by: req.user.id,
          approved_at: new Date().toISOString()
        }, req);
        
        res.json({ message: 'Exchange contact yearly update approved successfully' });
      }
    );
  });
});

// Get available currencies from exchange_rates table
router.get('/exchange-currencies', authenticateToken, authorizeModulePermission('exchange_data', 'read_only'), (req, res) => {
  db.all('SELECT currency_code, currency_name FROM exchange_rates ORDER BY currency_code', [], (err, currencies) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(currencies);
  });
});

// ====================================
// BULK UPLOAD FACILITY (ADMIN ONLY)
// ====================================

// Configure multer for CSV uploads
const csvStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'bulk_uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bulk_upload_' + uniqueSuffix + '.csv');
  }
});

const csvUpload = multer({ 
  storage: csvStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// Module configurations for bulk upload
const bulkUploadModules = {
  network_routes: {
    table: 'network_routes',
    templateFields: [
      'circuit_id', 'repository_type_id',
      'kmz_file_path', 'mtu', 'sla_latency', 'live_latency', 'expected_latency', 'test_results_link',
      'cable_system', 'is_special', 'underlying_carrier', 'cost', 'currency',
      'location_a', 'location_b', 'bandwidth', 'more_details', 'capacity_usage_percent',
      'local_loop_carriers_a', 'local_loop_carriers_b', 'equipment_type', 'carrier_protected', 'carrier_protection_route', 'region'
    ],
    requiredFields: ['circuit_id', 'location_a', 'location_b', 'underlying_carrier', 'carrier_protected', 'region'],
    sampleData: {
      circuit_id: 'SAMPLE123456',
      repository_type_id: '1',
      kmz_file_path: '',
      mtu: '1500',
      sla_latency: '10',
      live_latency: '8.5',
      expected_latency: '8',
      test_results_link: 'http://example.com/test-results',
      cable_system: 'Sample Cable System',
      is_special: 'false',
      underlying_carrier: 'Sample Carrier',
      cost: '1000',
      currency: 'USD',
      location_a: 'LONLON',
      location_b: 'NYCNYC',
      bandwidth: '10 Gbps',
      more_details: 'Sample route details',
      capacity_usage_percent: '75.5',
      local_loop_carriers_a: 'Carrier A',
      local_loop_carriers_b: 'Carrier B',
      equipment_type: 'Optical',
      carrier_protected: '0',
      carrier_protection_route: '',
      region: 'APAC'
    }
  },
  exchange_feeds: {
    table: 'exchange_feeds',
    templateFields: [
      'exchange_id', 'feed_name', 'feed_delivery', 'feed_type', 'isf_enabled',
      'isf_a', 'isf_b', 'isf_site_code_a', 'isf_site_code_b',
      'isf_dr_a', 'isf_dr_b', 'isf_dr_site_code_a', 'isf_dr_site_code_b',
      'dr_type', 'order_entry_isf', 'dr_order_entry_isf', 'unicast_isf',
      'dr_available', 'bandwidth_1ms', 'available_now', 'quick_quote',
      'pass_through_fees', 'pass_through_currency', 'pass_through_fees_info',
      'quick_quote_min_cost', 'order_entry_cost', 'more_info'
    ],
    requiredFields: ['exchange_id', 'feed_name', 'feed_delivery', 'feed_type', 'isf_enabled'],
    sampleData: {
      exchange_id: '1',
      feed_name: 'Sample Feed',
      feed_delivery: 'Unicast',
      feed_type: 'Equities',
      isf_enabled: 'true',
      isf_a: 'ISF_A_SAMPLE',
      isf_b: 'ISF_B_SAMPLE',
      isf_site_code_a: 'SITE_A_CODE',
      isf_site_code_b: 'SITE_B_CODE',
      isf_dr_a: 'DR_ISF_A',
      isf_dr_b: 'DR_ISF_B',
      isf_dr_site_code_a: 'DR_SITE_A',
      isf_dr_site_code_b: 'DR_SITE_B',
      dr_type: 'Cold',
      order_entry_isf: 'ORDER_ENTRY_ISF',
      dr_order_entry_isf: 'DR_ORDER_ENTRY',
      unicast_isf: 'UNICAST_ISF',
      dr_available: 'true',
      bandwidth_1ms: '100',
      available_now: 'true',
      quick_quote: 'true',
      pass_through_fees: '500',
      pass_through_currency: 'USD',
      pass_through_fees_info: 'Sample fee info',
      quick_quote_min_cost: '1000',
      order_entry_cost: '250',
      more_info: 'Sample additional info'
    }
  },
  exchange_contacts: {
    table: 'exchange_contacts',
    templateFields: [
      'exchange_id', 'contact_name', 'job_title', 'country', 'phone_number',
      'email', 'contact_type', 'daily_contact', 'more_info'
    ],
    requiredFields: ['exchange_id', 'contact_name', 'email'],
    sampleData: {
      exchange_id: '1',
      contact_name: 'John Doe',
      job_title: 'Technical Director',
      country: 'United States',
      phone_number: '+1-555-0123',
      email: 'john.doe@example.com',
      contact_type: 'Technical',
      daily_contact: 'false',
      more_info: 'Primary technical contact for exchange operations'
    }
  },
  exchange_rates: {
    table: 'exchange_rates',
    templateFields: ['currency_code', 'exchange_rate'],
    requiredFields: ['currency_code', 'exchange_rate'],
    sampleData: {
      currency_code: 'EUR',
      exchange_rate: '1.08'
    }
  },
    locations: {
    table: 'location_reference',
    templateFields: [
      'location_code', 'region', 'city', 'country', 'datacenter_name', 'datacenter_address',
      'latitude', 'longitude', 'time_zone', 'pop_type', 'status', 'provider', 'access_info',
      'min_price_under_100mb', 'min_price_100_to_999mb', 'min_price_1000_to_2999mb', 'min_price_3000mb_plus',
      'cross_connect_nrc', 'cross_connect_nrc_currency', 'cross_connect_mrc', 'cross_connect_mrc_currency', 'cross_connect_notes'
    ],
    requiredFields: ['location_code', 'city', 'country', 'datacenter_name', 'pop_type', 'status'],
    sampleData: {
      location_code: 'LONLON',
      region: 'Europe',
      city: 'London',
      country: 'United Kingdom',
      datacenter_name: 'London Data Center 1',
      datacenter_address: '123 Tech Street, London, UK',
      latitude: '51.5074',
      longitude: '-0.1278',
      time_zone: 'GMT',
      pop_type: 'Primary',
      status: 'Active',
      provider: 'Sample Provider',
      access_info: 'Secure access, 24/7 support available',
      min_price_under_100mb: '100',
      min_price_100_to_999mb: '200',
      min_price_1000_to_2999mb: '500',
      min_price_3000mb_plus: '1000',
      cross_connect_nrc: '500',
      cross_connect_nrc_currency: 'USD',
      cross_connect_mrc: '100',
      cross_connect_mrc_currency: 'USD',
      cross_connect_notes: 'Standard cross connect pricing, 24/7 support available'
    }
  },
  carriers: {
    table: 'carriers',
    templateFields: ['carrier_name', 'previously_known_as', 'status', 'region'],
    requiredFields: ['carrier_name', 'region', 'status'],
    sampleData: {
      carrier_name: 'Sample Carrier Inc.',
      previously_known_as: 'Old Carrier Name',
      status: 'active',
      region: 'AMERs'
    }
  },
  users: {
    table: 'users',
    templateFields: ['username', 'password_hash', 'email', 'full_name', 'user_role', 'status', 'password_reset_required'],
    requiredFields: ['username', 'password_hash', 'email', 'full_name', 'user_role'],
    sampleData: {
      username: 'newuser',
      password_hash: 'temppassword123',
      email: 'newuser@example.com',
      full_name: 'New User',
      user_role: 'read_only',
      status: 'active',
      password_reset_required: 'true'
    }
  },
  live_latency_config: {
    table: 'live_latency_config',
    templateFields: [
      'circuit_id', 'enabled', 'api_base_url', 'api_instance_name', 'api_indicator',
      'auth_username', 'auth_password', 'update_interval_minutes', 'api_parameters'
    ],
    requiredFields: ['circuit_id', 'api_base_url', 'api_instance_name'],
    sampleData: {
      circuit_id: 'LONNYC123456',
      enabled: 'true',
      api_base_url: 'https://api.example.com/latency',
      api_instance_name: 'LONNYC_Circuit_1',
      api_indicator: 'AnyVendor - Response Time (ms) - BPI',
      auth_username: 'api_user',
      auth_password: 'your_api_password',
      update_interval_minutes: '15',
      api_parameters: ''
    }
  },
  // Add missing bulk upload modules
  carrier_contacts: {
    table: 'carrier_contacts',
    templateFields: [
      'carrier_id', 'contact_type', 'contact_level', 'contact_name', 'contact_function', 'contact_email', 'contact_phone', 'notes'
    ],
    requiredFields: ['carrier_id', 'contact_name', 'contact_email'],
    sampleData: {
      carrier_id: '1',
      contact_type: 'Business',
      contact_level: 'Manager',
      contact_name: 'John Smith',
      contact_function: 'Account Management',
      contact_email: 'john.smith@carrier.com',
      contact_phone: '+1-555-0789',
      notes: 'Primary contact for technical issues'
    }
  },
  pop_capabilities: {
    table: 'pop_capabilities',
    templateFields: [
      'location_code', 'region', 'city', 'country', 'datacenter_name', 'datacenter_address',
      'latitude', 'longitude', 'time_zone', 'pop_type', 'status', 'provider', 'access_info',
      'min_price_under_100mb', 'min_price_100_to_999mb', 'min_price_1000_to_2999mb', 'min_price_3000mb_plus',
      'location_id', 'cnx_extranet_wan', 'cnx_ethernet', 'cnx_voice', 'tdm_gateway',
      'cnx_unigy', 'cnx_alpha', 'cnx_chrono', 'cnx_sdwan', 'csp_on_ramp',
      'exchange_on_ramp', 'internet_on_ramp', 'transport_only_pop', 'cnx_colocation', 'exchange_pricing_in_region'
    ],
    requiredFields: ['location_code'],
    sampleData: {
      location_code: 'LONLON',
      region: 'Europe',
      city: 'London',
      country: 'United Kingdom',
      datacenter_name: 'London Data Center 1',
      datacenter_address: '123 Tech Street, London, UK',
      latitude: '51.5074',
      longitude: '-0.1278',
      time_zone: 'GMT',
      pop_type: 'Primary',
      status: 'Active',
      provider: 'Sample Provider',
      access_info: 'Secure access, 24/7 support available',
      min_price_under_100mb: '100',
      min_price_100_to_999mb: '200',
      min_price_1000_to_2999mb: '500',
      min_price_3000mb_plus: '1000',
      location_id: '1',
      cnx_extranet_wan: 'true',
      cnx_ethernet: 'true',
      cnx_voice: 'false',
      tdm_gateway: 'false',
      cnx_unigy: 'true',
      cnx_alpha: 'false',
      cnx_chrono: 'true',
      cnx_sdwan: 'false',
      csp_on_ramp: 'true',
      exchange_on_ramp: 'true',
      internet_on_ramp: 'false',
      transport_only_pop: 'false',
      cnx_colocation: 'false',
      exchange_pricing_in_region: 'false'
    }
  },
  exchanges: {
    table: 'exchanges',
    templateFields: ['exchange_name', 'region', 'salesperson_assigned', 'available'],
    requiredFields: ['exchange_name', 'region'],
    sampleData: {
      exchange_name: 'Sample Exchange',
      region: 'North America',
      salesperson_assigned: 'John Smith',
      available: 'true'
    }
  },
  promo_pricing: {
    table: 'promo_pricing_rules',
    templateFields: [
      'rule_name', 'source_locations', 'destination_locations',
      'price_under_100mb', 'price_100_to_999mb', 'price_1000_to_2999mb', 'price_3000mb_plus'
    ],
    requiredFields: ['rule_name', 'source_locations', 'destination_locations'],
    sampleData: {
      rule_name: 'Sample Promo Rule',
      source_locations: 'LONLON,NYCNYC',
      destination_locations: 'TOKTOK,HKGHKG',
      price_under_100mb: '100',
      price_100_to_999mb: '500',
      price_1000_to_2999mb: '1500',
      price_3000mb_plus: '3000'
    }
  },
};

// Download CSV template for a module
router.get('/bulk-upload/template/:module', authenticateToken, authorizeRole('administrator'), (req, res) => {
  const { module } = req.params;
  
  if (!bulkUploadModules[module]) {
    return res.status(400).json({ error: 'Invalid module specified' });
  }
  
  const config = bulkUploadModules[module];
  const csvData = [config.sampleData];
  
  try {
    const parser = new Parser({ fields: config.templateFields });
    const csv = parser.parse(csvData);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${module}_template.csv"`);
    res.send(csv);
    
    // Log template download
    logChange(null, 'bulk_upload_templates', null, 'DOWNLOAD', null, { module }, req);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate template: ' + error.message });
  }
});
// Get database data for a module (to help with template creation)
router.get('/bulk-upload/database/:module', authenticateToken, authorizeRole('administrator'), (req, res) => {
  const { module } = req.params;
  
  if (!bulkUploadModules[module]) {
    return res.status(400).json({ error: 'Invalid module specified' });
  }
  
  const config = bulkUploadModules[module];
  const limit = parseInt(req.query.limit) || 10000; // Default to 10,000 records (effectively all for most tables)
  
  let query = `SELECT * FROM ${config.table} LIMIT ?`;
  let queryParams = [limit];
  
  // Special handling for certain modules
  if (module === 'carrier_contacts') {
    // Add carrier_name to the export
    query = `SELECT cc.*, c.carrier_name 
             FROM carrier_contacts cc 
             LEFT JOIN carriers c ON cc.carrier_id = c.id 
             LIMIT ?`;
  } else if (module === 'pop_capabilities') {
    // Add comprehensive location info to the export for bulk updating
    // Use lr.id as location_id to ensure all locations have a location_id value
    query = `SELECT lr.location_code, lr.region, lr.city, lr.country, lr.datacenter_name, lr.datacenter_address,
             lr.latitude, lr.longitude, lr.time_zone, lr.pop_type, lr.status, lr.provider, lr.access_info,
             lr.min_price_under_100mb, lr.min_price_100_to_999mb, lr.min_price_1000_to_2999mb, lr.min_price_3000mb_plus,
             lr.id as location_id, 
             COALESCE(pc.cnx_extranet_wan, 0) as cnx_extranet_wan, 
             COALESCE(pc.cnx_ethernet, 0) as cnx_ethernet, 
             COALESCE(pc.cnx_voice, 0) as cnx_voice, 
             COALESCE(pc.tdm_gateway, 0) as tdm_gateway,
             COALESCE(pc.cnx_unigy, 0) as cnx_unigy, 
             COALESCE(pc.cnx_alpha, 0) as cnx_alpha, 
             COALESCE(pc.cnx_chrono, 0) as cnx_chrono, 
             COALESCE(pc.cnx_sdwan, 0) as cnx_sdwan, 
             COALESCE(pc.csp_on_ramp, 0) as csp_on_ramp,
             COALESCE(pc.exchange_on_ramp, 0) as exchange_on_ramp, 
             COALESCE(pc.internet_on_ramp, 0) as internet_on_ramp, 
             COALESCE(pc.transport_only_pop, 0) as transport_only_pop, 
             COALESCE(pc.cnx_colocation, 0) as cnx_colocation,
             COALESCE(pc.exchange_pricing_in_region, 0) as exchange_pricing_in_region
             FROM location_reference lr 
             LEFT JOIN pop_capabilities pc ON lr.id = pc.location_id 
             LIMIT ?`;
  } else if (module === 'carriers') {
    // Map database regions to frontend values for export
    query = `SELECT carrier_name, previously_known_as, status,
             CASE 
               WHEN region = 'North America' THEN 'AMERs'
               WHEN region = 'Asia Pacific' THEN 'APAC'
               WHEN region = 'Europe' THEN 'EMEA'
               ELSE region
             END as region
             FROM ${config.table} LIMIT ?`;
  } else if (module === 'exchange_feeds') {
    // Add exchange_name to the export
    query = `SELECT ef.*, e.exchange_name 
             FROM exchange_feeds ef 
             LEFT JOIN exchanges e ON ef.exchange_id = e.id 
             LIMIT ?`;
  } else if (module === 'exchange_contacts') {
    // Add exchange_name to the export
    query = `SELECT ec.*, e.exchange_name 
             FROM exchange_contacts ec 
             LEFT JOIN exchanges e ON ec.exchange_id = e.id 
             LIMIT ?`;
  } else if (module === 'network_routes') {
    // Convert is_special from integer (0/1) to boolean string (false/true)
    // Convert carrier_protected from integer (0/1) to text (No/Yes)
    query = `SELECT circuit_id, repository_type_id, kmz_file_path, mtu, sla_latency, 
             live_latency, expected_latency, test_results_link, cable_system,
             CASE 
               WHEN is_special = 1 THEN 'true'
               WHEN is_special = 0 THEN 'false'
               ELSE 'false'
             END as is_special,
             underlying_carrier, cost, currency, location_a, location_b, 
             bandwidth, more_details, capacity_usage_percent, local_loop_carriers_a, 
             local_loop_carriers_b, equipment_type,
             CASE 
               WHEN carrier_protected = 1 THEN 'Yes'
               WHEN carrier_protected = 0 THEN 'No'
               ELSE 'No'
             END as carrier_protected,
             carrier_protection_route, region
             FROM ${config.table} LIMIT ?`;
  } else if (module === 'live_latency_config') {
    // Export configs with password placeholder (never expose actual passwords)
    query = `SELECT 
             circuit_id, 
             CASE WHEN enabled = 1 THEN 'true' ELSE 'false' END as enabled,
             api_base_url, api_instance_name, api_indicator,
             auth_username, 
             CASE 
               WHEN auth_password_encrypted IS NOT NULL THEN '****ENCRYPTED****'
               ELSE ''
             END as auth_password,
             update_interval_minutes, api_parameters
             FROM ${config.table} 
             ORDER BY circuit_id 
             LIMIT ?`;
  } else if (module === 'promo_pricing') {
    // Export promo pricing rules with comma-separated locations
    query = `SELECT 
             pr.rule_name,
             GROUP_CONCAT(CASE WHEN pl.location_type = 'source' THEN pl.location_code END) as source_locations,
             GROUP_CONCAT(CASE WHEN pl.location_type = 'destination' THEN pl.location_code END) as destination_locations,
             pr.price_under_100mb, pr.price_100_to_999mb, pr.price_1000_to_2999mb, pr.price_3000mb_plus
             FROM promo_pricing_rules pr
             LEFT JOIN promo_pricing_locations pl ON pr.id = pl.promo_rule_id
             WHERE pr.is_active = 1
             GROUP BY pr.id
             ORDER BY pr.rule_name
             LIMIT ?`;
  }
  
  db.all(query, queryParams, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    try {
      // Determine fields for CSV based on module
      let csvFields = config.templateFields;
      
      if (module === 'carrier_contacts') {
        csvFields = [...config.templateFields, 'carrier_name'];
      } else if (module === 'pop_capabilities') {
        csvFields = [
          'location_code', 'region', 'city', 'country', 'datacenter_name', 'datacenter_address',
          'latitude', 'longitude', 'time_zone', 'pop_type', 'status', 'provider', 'access_info',
          'min_price_under_100mb', 'min_price_100_to_999mb', 'min_price_1000_to_2999mb', 'min_price_3000mb_plus',
          ...config.templateFields
        ];
      } else if (module === 'exchange_feeds') {
        csvFields = [...config.templateFields, 'exchange_name'];
      } else if (module === 'exchange_contacts') {
        csvFields = [...config.templateFields, 'exchange_name'];
      }
      
      const parser = new Parser({ fields: csvFields });
      const csv = parser.parse(rows);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${module}_database_export.csv"`);
      res.send(csv);
      
      // Log database export
      logChange(null, 'bulk_upload_database', null, 'EXPORT', null, { module, rows_exported: rows.length }, req);
    } catch (error) {
      res.status(500).json({ error: 'Failed to export database: ' + error.message });
    }
  });
});

// Bulk upload data for a module
router.post('/bulk-upload/:module', authenticateToken, authorizeRole('administrator'), csvUpload.single('csv_file'), async (req, res) => {
  const { module } = req.params;
  
  if (!bulkUploadModules[module]) {
    return res.status(400).json({ error: 'Invalid module specified' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file uploaded' });
  }
  
  const config = bulkUploadModules[module];
  const filePath = req.file.path;
  const results = [];
  const errors = [];
  const startTime = Date.now();
  const sessionId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Initialize progress tracking
  activeUploads.set(sessionId, {
    module,
    filename: req.file.originalname,
    status: 'parsing',
    stage: 'Reading CSV file...',
    progress: 0,
    totalRows: 0,
    processedRows: 0,
    validRows: 0,
    errorRows: 0,
    startTime,
    errors: []
  });
  
  console.log(`[BULK UPLOAD] Starting bulk upload for module: ${module}, file: ${req.file.originalname}, user: ${req.user.username}, session: ${sessionId}`);
  
  // Parse CSV file
  const allRows = []; // Store all parsed rows first
  const parseErrors = []; // Store only CSV parsing errors
  
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      const currentRow = allRows.length + parseErrors.length + 1; // CSV row number
      
      // Update progress tracking
      let uploadInfo = activeUploads.get(sessionId);
      if (uploadInfo) {
        uploadInfo.processedRows = currentRow;
        uploadInfo.stage = `Reading row ${currentRow}...`;
      }
      
      // Log progress every 100 rows
      if (currentRow % 100 === 0) {
        console.log(`[BULK UPLOAD] Reading row ${currentRow} for module: ${module}`);
      }
      
      // Only store the row with its original row number - no validation yet
      const rawRow = { ...row };
      rawRow._originalRowNumber = currentRow;
      allRows.push(rawRow);
    })
    .on('end', async () => {
      const parseTime = Date.now() - startTime;
      const totalRows = allRows.length + parseErrors.length;
      
      console.log(`[BULK UPLOAD] CSV parsing completed for module: ${module}`);
      console.log(`[BULK UPLOAD] Parse time: ${parseTime}ms, Total rows: ${totalRows}`);
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      
      // Update progress tracking
      uploadInfo = activeUploads.get(sessionId);
      if (uploadInfo) {
        uploadInfo.totalRows = totalRows;
        uploadInfo.stage = 'CSV parsing completed - starting comprehensive validation';
        uploadInfo.progress = 20; // 20% after parsing
      }
      
      // NOW perform comprehensive validation on ALL rows at once
      console.log(`[BULK UPLOAD] Starting comprehensive validation for ${allRows.length} rows...`);
      const allValidationErrors = [...parseErrors]; // Start with parsing errors
      const validRows = [];
      
      // Process ALL rows for validation
      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        const originalRowNumber = row._originalRowNumber;
        const allRowErrors = [];
        
        try {
          // Step 1: Required fields validation
          const missingFields = config.requiredFields.filter(field => !row[field] || row[field].trim() === '');
          if (missingFields.length > 0) {
            allRowErrors.push(`Missing required fields: ${missingFields.join(', ')}`);
          }
          
          // Step 2: Clean and prepare data
          const cleanedRow = {};
          config.templateFields.forEach(field => {
            if (row[field] !== undefined) {
              cleanedRow[field] = row[field].trim();
            }
          });
          cleanedRow._originalRowNumber = originalRowNumber;
          
          // Step 3: Data format validation
          const validationErrors = [];
          if (module === 'users') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (cleanedRow.email && !emailRegex.test(cleanedRow.email)) {
              validationErrors.push('Invalid email format');
            }
            const validRoles = ['administrator', 'provisioner', 'read_only'];
            if (cleanedRow.user_role && !validRoles.includes(cleanedRow.user_role)) {
              validationErrors.push('Invalid user role. Must be: administrator, provisioner, or read_only');
            }
            if (cleanedRow.password && cleanedRow.password.length < 8) {
              validationErrors.push('Password must be at least 8 characters long');
            }
          } else if (module === 'exchange_rates') {
            if (cleanedRow.currency_code && !/^[A-Z]{3}$/.test(cleanedRow.currency_code)) {
              validationErrors.push('Currency code must be 3 uppercase letters (e.g., USD, EUR)');
            }
            if (cleanedRow.exchange_rate && (isNaN(cleanedRow.exchange_rate) || parseFloat(cleanedRow.exchange_rate) <= 0)) {
              validationErrors.push('Exchange rate must be a positive number');
            }
          } else if (module === 'network_routes') {
            if (cleanedRow.cost && cleanedRow.cost !== '' && isNaN(cleanedRow.cost)) {
              validationErrors.push('Cost must be a valid number');
            }
            if (cleanedRow.is_special && !['true', 'false', '1', '0'].includes(cleanedRow.is_special.toLowerCase())) {
              validationErrors.push('is_special must be true/false or 1/0');
            }
          }
          allRowErrors.push(...validationErrors);
          
          // Step 4: Module-specific validations
          const moduleValidationErrors = [];
          if (module === 'network_routes') {
            if (cleanedRow.circuit_id && !isValidCircuitId(cleanedRow.circuit_id)) {
              moduleValidationErrors.push('Invalid circuit_id format. Must be 6 uppercase letters + 6 digits');
            }
            
            // Set default values for required fields
            if (!cleanedRow.repository_type_id || cleanedRow.repository_type_id === '') {
              cleanedRow.repository_type_id = 1; // Default repository type
            }
            if (!cleanedRow.currency || cleanedRow.currency === '') {
              cleanedRow.currency = 'USD'; // Default currency
            }
            if (!cleanedRow.carrier_protection_route || cleanedRow.carrier_protection_route === '') {
              cleanedRow.carrier_protection_route = ''; // Default empty protection route
            }
            if (!cleanedRow.live_latency_source || cleanedRow.live_latency_source === '') {
              cleanedRow.live_latency_source = 'manual'; // Default source
            }
            
            // is_special is INTEGER field: 1 for special, 0 for normal (DEFAULT 0)
            if (cleanedRow.is_special !== undefined && cleanedRow.is_special !== null && cleanedRow.is_special !== '') {
              const value = cleanedRow.is_special.toString().toLowerCase();
              cleanedRow.is_special = (value === 'true' || value === '1') ? 1 : 0;
            } else {
              cleanedRow.is_special = 0; // Default to normal when null/empty
            }
            // carrier_protected is INTEGER field: 1 for protected, 0 for not protected (DEFAULT 0)
            if (cleanedRow.carrier_protected !== undefined && cleanedRow.carrier_protected !== null && cleanedRow.carrier_protected !== '') {
              const value = cleanedRow.carrier_protected.toString().toLowerCase();
              cleanedRow.carrier_protected = (value === 'yes' || value === 'true' || value === '1') ? 1 : 0;
            } else {
              cleanedRow.carrier_protected = 0; // Default to not protected when null/empty
            }
            
            // Validate region field (required)
            if (!cleanedRow.region || cleanedRow.region.trim() === '') {
              moduleValidationErrors.push('Region is required. Must be one of: APAC, EMEA, AMERs, INTER');
            } else {
              const validRegions = ['APAC', 'EMEA', 'AMERs', 'INTER'];
              if (!validRegions.includes(cleanedRow.region)) {
                moduleValidationErrors.push(`Invalid region: '${cleanedRow.region}'. Must be one of: APAC, EMEA, AMERs, INTER`);
              }
            }
          } else if (module === 'users') {
            if (cleanedRow.user_role && !['administrator', 'provisioner', 'read_only'].includes(cleanedRow.user_role)) {
              moduleValidationErrors.push('Invalid user_role. Must be administrator, provisioner, or read_only');
            }
            
            // Set default values for required fields
            if (!cleanedRow.status || cleanedRow.status === '') {
              cleanedRow.status = 'active'; // Default user status
            }
            
            // Convert boolean fields
            ['password_reset_required'].forEach(field => {
              if (cleanedRow[field] !== undefined && cleanedRow[field] !== null && cleanedRow[field] !== '') {
                const val = cleanedRow[field].toString().toLowerCase();
                cleanedRow[field] = (val === 'true' || val === '1') ? 1 : 0;
              } else {
                cleanedRow[field] = 0;
              }
            });
          } else if (module === 'carriers') {
            // Set default values for required fields
            if (!cleanedRow.status || cleanedRow.status === '') {
              cleanedRow.status = 'active'; // Default carrier status
            }
          } else if (module === 'carrier_contacts') {
            // Convert boolean fields
            ['is_primary'].forEach(field => {
              if (cleanedRow[field] !== undefined && cleanedRow[field] !== null && cleanedRow[field] !== '') {
                const val = cleanedRow[field].toString().toLowerCase();
                cleanedRow[field] = (val === 'true' || val === '1') ? 1 : 0;
              } else {
                cleanedRow[field] = 0;
              }
            });
          } else if (module === 'pop_capabilities') {
            // Convert all capability boolean fields
            const booleanFields = [
              'cnx_extranet_wan', 'cnx_ethernet', 'cnx_voice', 'tdm_gateway',
              'cnx_unigy', 'cnx_alpha', 'cnx_chrono', 'cnx_sdwan', 'csp_on_ramp',
              'exchange_on_ramp', 'internet_on_ramp', 'transport_only_pop', 'cnx_colocation'
            ];
            booleanFields.forEach(field => {
              if (cleanedRow[field] !== undefined && cleanedRow[field] !== null && cleanedRow[field] !== '') {
                const val = cleanedRow[field].toString().toLowerCase();
                cleanedRow[field] = (val === 'true' || val === '1') ? 1 : 0;
              } else {
                cleanedRow[field] = 0;
              }
            });
          } else if (module === 'exchange_contacts') {
            // Convert boolean fields
            ['is_primary'].forEach(field => {
              if (cleanedRow[field] !== undefined && cleanedRow[field] !== null && cleanedRow[field] !== '') {
                const val = cleanedRow[field].toString().toLowerCase();
                cleanedRow[field] = (val === 'true' || val === '1') ? 1 : 0;
              } else {
                cleanedRow[field] = 0;
              }
            });
          } else if (module === 'exchange_feeds') {
            if (cleanedRow.feed_delivery && !['Unicast', 'Multicast'].includes(cleanedRow.feed_delivery)) {
              moduleValidationErrors.push('Invalid feed_delivery. Must be Unicast or Multicast');
            }
            const validFeedTypes = ['Equities', 'Futures', 'Options', 'Fixed Income', 'FX', 'Commodities', 'Indices', 'ETFs', 'Alternative Data', 'Reference Data', 'Mixed'];
            if (cleanedRow.feed_type && !validFeedTypes.includes(cleanedRow.feed_type)) {
              moduleValidationErrors.push(`Invalid feed_type. Must be one of: ${validFeedTypes.join(', ')}`);
            }
            
            // Set default values for fields that might be required
            if (!cleanedRow.pass_through_currency || cleanedRow.pass_through_currency === '') {
              cleanedRow.pass_through_currency = 'USD'; // Default currency
            }
            if (cleanedRow.pass_through_fees === undefined || cleanedRow.pass_through_fees === null || cleanedRow.pass_through_fees === '') {
              cleanedRow.pass_through_fees = 0; // Default fees
            }
            
            // Convert boolean fields - handle '1', 'true', true, 1 as true values
            ['dr_available', 'available_now', 'quick_quote', 'isf_enabled'].forEach(field => {
              if (cleanedRow[field] !== undefined && cleanedRow[field] !== null && cleanedRow[field] !== '') {
                const val = cleanedRow[field].toString().toLowerCase();
                cleanedRow[field] = (val === 'true' || val === '1') ? 1 : 0;
              } else {
                cleanedRow[field] = 0; // Default to false for boolean fields
              }
            });
          }
          allRowErrors.push(...moduleValidationErrors);
          
          // Step 5: Foreign key validation
          const foreignKeyErrors = await validateRowForeignKeys(cleanedRow, module);
          allRowErrors.push(...foreignKeyErrors);
          
          // Add ALL errors for this row at once
          if (allRowErrors.length > 0) {
            allValidationErrors.push(`Row ${originalRowNumber}: ${allRowErrors.join(', ')}`);
          } else {
            validRows.push(cleanedRow);
          }
          
        } catch (validationError) {
          allValidationErrors.push(`Row ${originalRowNumber}: Validation failed - ${validationError.message}`);
        }
        
        // Update progress during validation
        if ((i + 1) % 50 === 0 || i === allRows.length - 1) {
          uploadInfo = activeUploads.get(sessionId);
          if (uploadInfo) {
            const validationProgress = Math.floor((i + 1) / allRows.length * 60); // 60% for validation
            uploadInfo.progress = 20 + validationProgress;
            uploadInfo.stage = `Validating row ${originalRowNumber} (${i + 1} of ${allRows.length})...`;
          }
        }
      }
      
      console.log(`[BULK UPLOAD] Comprehensive validation completed for module: ${module}. Total errors: ${allValidationErrors.length}, Valid rows: ${validRows.length}`);
      
      // Update progress tracking
      uploadInfo = activeUploads.get(sessionId);
      if (uploadInfo) {
        uploadInfo.stage = 'Comprehensive validation completed';
        uploadInfo.progress = 80;
      }
      
      // If there are ANY validation errors, return them ALL at once
      if (allValidationErrors.length > 0) {
        console.log(`[BULK UPLOAD] Validation failed for module: ${module}, ${allValidationErrors.length} total errors found`);
        
        // Update progress tracking
        uploadInfo = activeUploads.get(sessionId);
        if (uploadInfo) {
          uploadInfo.status = 'error';
          uploadInfo.stage = 'Validation failed';
          uploadInfo.errors = allValidationErrors;
          setTimeout(() => activeUploads.delete(sessionId), 60000);
        }
        
        return res.status(400).json({ 
          error: 'Validation failed', 
          errors: allValidationErrors,
          total_rows: totalRows,
          valid_rows: validRows.length,
          invalid_rows: allValidationErrors.length,
          sessionId
        });
      }
      
      if (validRows.length === 0) {
        console.log(`[BULK UPLOAD] No valid data found in CSV file for module: ${module}`);
        
        uploadInfo = activeUploads.get(sessionId);
        if (uploadInfo) {
          uploadInfo.status = 'error';
          uploadInfo.stage = 'No valid data found';
          setTimeout(() => activeUploads.delete(sessionId), 60000);
        }
        
        return res.status(400).json({ error: 'No valid data found in CSV file', sessionId });
      }
      
      // Replace results with validRows for database insertion
      results.length = 0;
      results.push(...validRows);
      
      console.log(`[BULK UPLOAD] Starting database transaction for module: ${module}, ${results.length} rows`);
      const dbStartTime = Date.now();
      
      // Update progress tracking
      uploadInfo = activeUploads.get(sessionId);
      if (uploadInfo) {
        uploadInfo.status = 'inserting';
        uploadInfo.stage = 'Starting database transaction...';
        uploadInfo.progress = 85;
      }
      
      // Return sessionId immediately so frontend can start polling for progress
      res.json({
        message: 'Upload processing started',
        sessionId,
        status: 'processing'
      });
      
      // Set a timeout to prevent hanging uploads
      const uploadTimeout = setTimeout(() => {
        console.log(`[BULK UPLOAD] Upload timeout reached for session: ${sessionId}`);
        uploadInfo = activeUploads.get(sessionId);
        if (uploadInfo && uploadInfo.status !== 'completed') {
          uploadInfo.status = 'error';
          uploadInfo.stage = 'Upload timed out';
          uploadInfo.errors = ['Upload process timed out after 5 minutes'];
          setTimeout(() => activeUploads.delete(sessionId), 60000);
        }
      }, 5 * 60 * 1000);
      
      // Begin transaction for bulk insert
      db.run('BEGIN TRANSACTION', async (err) => {
        if (err) {
          console.log(`[BULK UPLOAD] Failed to begin transaction for module: ${module}, error: ${err.message}`);
          clearTimeout(uploadTimeout);
          uploadInfo = activeUploads.get(sessionId);
          if (uploadInfo) {
            uploadInfo.status = 'error';
            uploadInfo.stage = 'Failed to begin transaction';
            uploadInfo.errors = [err.message];
            setTimeout(() => activeUploads.delete(sessionId), 60000);
          }
          return;
        }
        
        console.log(`[BULK UPLOAD] Transaction started for module: ${module}`);
        console.log(`[BULK UPLOAD] About to process ${results.length} rows`);
        
        let completed = 0;
        let failed = false;
        const insertErrors = [];
        
        // Process rows sequentially to handle async operations for exchange_feeds
        for (let index = 0; index < results.length; index++) {
          const row = results[index];
          
          // Log progress every 50 inserts and update progress tracking
          if ((index + 1) % 50 === 0) {
            console.log(`[BULK UPLOAD] Inserting row ${index + 1}/${results.length} for module: ${module}`);
            
            // Update progress tracking
            uploadInfo = activeUploads.get(sessionId);
            if (uploadInfo) {
              const insertProgress = Math.floor((index + 1) / results.length * 15);
              uploadInfo.progress = 85 + insertProgress;
              uploadInfo.stage = `Inserting row ${index + 1} of ${results.length}...`;
            }
          }
          
          let sql, values;
          
          // Note: All validation (including foreign keys) has been completed upfront
          // We can proceed directly to insertion since all data is validated
          
          // Clean up internal properties before database insertion
          const cleanRow = { ...row };
          delete cleanRow._originalRowNumber;
          delete cleanRow._needsForeignKeyValidation;
          
          // Generate SQL for each module
          if (module === 'network_routes') {
            try {
              // Apply default values for network_routes before database operations
              if (cleanRow.carrier_protected === null || cleanRow.carrier_protected === undefined) {
                cleanRow.carrier_protected = 0;
              }
              if (cleanRow.is_special === null || cleanRow.is_special === undefined) {
                cleanRow.is_special = 0;
              }
              if (!cleanRow.repository_type_id) {
                cleanRow.repository_type_id = 1;
              }
              if (!cleanRow.currency) {
                cleanRow.currency = 'USD';
              }
              if (!cleanRow.carrier_protection_route) {
                cleanRow.carrier_protection_route = '';
              }
              if (!cleanRow.live_latency_source) {
                cleanRow.live_latency_source = 'manual';
              }
              // Region is required - no default value
              if (!cleanRow.region || cleanRow.region.trim() === '') {
                throw new Error('Region is required');
              }
              
              // Check for existing route with same circuit_id
              const existingRoute = await new Promise((resolve, reject) => {
                db.get(
                  'SELECT circuit_id FROM network_routes WHERE LOWER(TRIM(circuit_id)) = LOWER(TRIM(?))',
                  [cleanRow.circuit_id],
                  (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                  }
                );
              });
              
              if (existingRoute) {
                // Update existing route - skip circuit_id as it identifies the record
                const updateFields = config.templateFields.slice(1); // Skip circuit_id
                sql = `UPDATE network_routes SET ${updateFields.map(field => `${field} = ?`).join(', ')}, updated_by = ?, updated_date = ? WHERE circuit_id = ?`;
                values = [
                  ...updateFields.map(field => cleanRow[field]),
                  req.user.id, new Date().toISOString(), cleanRow.circuit_id
                ];
              } else {
                // Insert new route
                sql = `INSERT INTO network_routes (${config.templateFields.join(', ')}, updated_by, updated_date) VALUES (${config.templateFields.map(() => '?').join(', ')}, ?, ?)`;
                values = [...config.templateFields.map(field => cleanRow[field]), req.user.id, new Date().toISOString()];
              }
            } catch (dbError) {
              insertErrors.push(`Row ${index + 1}: Database error checking for duplicates - ${dbError.message}`);
              continue; // Skip this row and continue with next
            }
          } else if (module === 'users') {
            try {
              // Apply default values for users before database operations
              if (!cleanRow.status) {
                cleanRow.status = 'active';
              }
              if (cleanRow.password_reset_required === null || cleanRow.password_reset_required === undefined) {
                cleanRow.password_reset_required = 0;
              }
              
              // Check for existing user with same username or email
              const existingUser = await new Promise((resolve, reject) => {
                db.get(
                  'SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?))',
                  [cleanRow.username, cleanRow.email],
                  (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                  }
                );
              });
              
              if (existingUser) {
                // Update existing user - skip username as it identifies the record
                const updateFields = config.templateFields.filter(field => field !== 'username');
                sql = `UPDATE users SET ${updateFields.map(field => `${field} = ?`).join(', ')} WHERE username = ?`;
                values = [
                  ...updateFields.map(field => {
                    if (field === 'password_hash' && cleanRow[field] && !cleanRow[field].startsWith('$2b$')) {
                      return hashPassword(cleanRow[field]);
                    }
                    return cleanRow[field];
                  }),
                  cleanRow.username
                ];
              } else {
                // Insert new user
                sql = `INSERT INTO users (${config.templateFields.join(', ')}) VALUES (${config.templateFields.map(() => '?').join(', ')})`;
                values = config.templateFields.map(field => {
                  if (field === 'password_hash' && cleanRow[field] && !cleanRow[field].startsWith('$2b$')) {
                    return hashPassword(cleanRow[field]);
                  }
                  return cleanRow[field];
                });
              }
            } catch (dbError) {
              insertErrors.push(`Row ${index + 1}: Database error checking for duplicates - ${dbError.message}`);
              continue; // Skip this row and continue with next
            }
          } else if (module === 'carriers') {
            try {
              // Apply default values for carriers before database operations
              if (!cleanRow.status) {
                cleanRow.status = 'active';
              }
              
              // Check for existing carrier with same name
              const existingCarrier = await new Promise((resolve, reject) => {
                db.get(
                  'SELECT id FROM carriers WHERE LOWER(TRIM(carrier_name)) = LOWER(TRIM(?))',
                  [cleanRow.carrier_name],
                  (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                  }
                );
              });
              
              if (existingCarrier) {
                // Update existing carrier
                const updateFields = config.templateFields.slice(1); // Skip carrier_name (or use all fields)
                sql = `UPDATE carriers SET ${updateFields.map(field => `${field} = ?`).join(', ')} WHERE LOWER(TRIM(carrier_name)) = LOWER(TRIM(?))`;
                values = [
                  ...updateFields.map(field => cleanRow[field]),
                  cleanRow.carrier_name
                ];
              } else {
                // Insert new carrier
                sql = `INSERT INTO carriers (${config.templateFields.join(', ')}) VALUES (${config.templateFields.map(() => '?').join(', ')})`;
                values = config.templateFields.map(field => cleanRow[field]);
              }
            } catch (dbError) {
              insertErrors.push(`Row ${index + 1}: Database error checking for duplicates - ${dbError.message}`);
              continue; // Skip this row and continue with next
            }
          } else if (module === 'live_latency_config') {
            try {
              const LiveLatencyService = require('./liveLatencyService');
              const latencyService = new LiveLatencyService();
              
              // Validate circuit_id format
              if (!isValidCircuitId(cleanRow.circuit_id)) {
                insertErrors.push(`Row ${index + 1}: Invalid circuit_id format. Must be 6 uppercase letters followed by 6 digits.`);
                continue;
              }
              
              // Check if circuit exists in network_routes
              const routeExists = await new Promise((resolve, reject) => {
                db.get('SELECT circuit_id FROM network_routes WHERE circuit_id = ?', [cleanRow.circuit_id], (err, row) => {
                  if (err) reject(err);
                  else resolve(!!row);
                });
              });
              
              if (!routeExists) {
                insertErrors.push(`Row ${index + 1}: Circuit ID "${cleanRow.circuit_id}" not found in network routes database.`);
                continue;
              }
              
              // Convert enabled string to integer
              if (cleanRow.enabled === 'true' || cleanRow.enabled === '1' || cleanRow.enabled === 1) {
                cleanRow.enabled = 1;
              } else {
                cleanRow.enabled = 0;
              }
              
              // Set defaults
              if (!cleanRow.api_indicator) {
                cleanRow.api_indicator = 'AnyVendor - Response Time (ms) - BPI';
              }
              if (!cleanRow.update_interval_minutes) {
                cleanRow.update_interval_minutes = 15;
              }
              
              // Encrypt password if provided and not already placeholder
              let encryptedPassword = null;
              if (cleanRow.auth_password && cleanRow.auth_password !== '****ENCRYPTED****' && cleanRow.auth_password.trim() !== '') {
                encryptedPassword = latencyService.encryptPassword(cleanRow.auth_password);
              }
              
              // Check for existing configuration
              const existingConfig = await new Promise((resolve, reject) => {
                db.get(
                  'SELECT id, auth_password_encrypted FROM live_latency_config WHERE circuit_id = ?',
                  [cleanRow.circuit_id],
                  (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                  }
                );
              });
              
              if (existingConfig) {
                // Update existing configuration
                const updateFields = [];
                const updateValues = [];
                
                if (cleanRow.enabled !== undefined) {
                  updateFields.push('enabled = ?');
                  updateValues.push(cleanRow.enabled);
                }
                if (cleanRow.api_base_url) {
                  updateFields.push('api_base_url = ?');
                  updateValues.push(cleanRow.api_base_url);
                }
                if (cleanRow.api_instance_name) {
                  updateFields.push('api_instance_name = ?');
                  updateValues.push(cleanRow.api_instance_name);
                }
                if (cleanRow.api_indicator) {
                  updateFields.push('api_indicator = ?');
                  updateValues.push(cleanRow.api_indicator);
                }
                if (cleanRow.auth_username !== undefined) {
                  updateFields.push('auth_username = ?');
                  updateValues.push(cleanRow.auth_username);
                }
                if (encryptedPassword) {
                  updateFields.push('auth_password_encrypted = ?');
                  updateValues.push(encryptedPassword);
                } else if (cleanRow.auth_password === '') {
                  // Clear password if empty string provided
                  updateFields.push('auth_password_encrypted = ?');
                  updateValues.push(null);
                }
                if (cleanRow.update_interval_minutes) {
                  updateFields.push('update_interval_minutes = ?');
                  updateValues.push(cleanRow.update_interval_minutes);
                }
                if (cleanRow.api_parameters !== undefined) {
                  updateFields.push('api_parameters = ?');
                  updateValues.push(cleanRow.api_parameters);
                }
                
                updateFields.push('updated_by = ?', 'updated_at = CURRENT_TIMESTAMP');
                updateValues.push(req.user.id);
                updateValues.push(existingConfig.id);
                
                sql = `UPDATE live_latency_config SET ${updateFields.join(', ')} WHERE id = ?`;
                values = updateValues;
              } else {
                // Insert new configuration
                sql = `INSERT INTO live_latency_config 
                       (circuit_id, enabled, api_base_url, api_instance_name, api_indicator, 
                        auth_username, auth_password_encrypted, update_interval_minutes, api_parameters,
                        created_by, updated_by) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                values = [
                  cleanRow.circuit_id,
                  cleanRow.enabled,
                  cleanRow.api_base_url,
                  cleanRow.api_instance_name,
                  cleanRow.api_indicator,
                  cleanRow.auth_username,
                  encryptedPassword,
                  cleanRow.update_interval_minutes,
                  cleanRow.api_parameters,
                  req.user.id,
                  req.user.id
                ];
              }
            } catch (dbError) {
              insertErrors.push(`Row ${index + 1}: Database error - ${dbError.message}`);
              continue; // Skip this row and continue with next
            }
          } else if (module === 'promo_pricing') {
            try {
              // Validate required fields
              if (!cleanRow.rule_name || !cleanRow.source_locations || !cleanRow.destination_locations) {
                insertErrors.push(`Row ${index + 1}: Missing required fields (rule_name, source_locations, destination_locations)`);
                continue;
              }
              
              // Parse comma-separated locations
              const sourceLocations = cleanRow.source_locations.split(',').map(loc => loc.trim()).filter(loc => loc);
              const destinationLocations = cleanRow.destination_locations.split(',').map(loc => loc.trim()).filter(loc => loc);
              
              if (sourceLocations.length === 0 || destinationLocations.length === 0) {
                insertErrors.push(`Row ${index + 1}: Source and destination locations cannot be empty`);
                continue;
              }
              
              // Parse prices (default to 0 if not provided)
              const priceUnder100mb = parseFloat(cleanRow.price_under_100mb) || 0;
              const price100to999mb = parseFloat(cleanRow.price_100_to_999mb) || 0;
              const price1000to2999mb = parseFloat(cleanRow.price_1000_to_2999mb) || 0;
              const price3000mbPlus = parseFloat(cleanRow.price_3000mb_plus) || 0;
              
              // Check if rule with this name already exists
              const existingRule = await new Promise((resolve, reject) => {
                db.get(
                  'SELECT id FROM promo_pricing_rules WHERE rule_name = ? AND is_active = 1',
                  [cleanRow.rule_name],
                  (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                  }
                );
              });
              
              if (existingRule) {
                // Update existing rule
                await new Promise((resolve, reject) => {
                  db.run(
                    `UPDATE promo_pricing_rules 
                     SET price_under_100mb = ?, price_100_to_999mb = ?, price_1000_to_2999mb = ?, price_3000mb_plus = ?,
                         updated_by = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [priceUnder100mb, price100to999mb, price1000to2999mb, price3000mbPlus, req.user.id, existingRule.id],
                    (err) => {
                      if (err) reject(err);
                      else resolve();
                    }
                  );
                });
                
                // Delete existing location mappings
                await new Promise((resolve, reject) => {
                  db.run('DELETE FROM promo_pricing_locations WHERE promo_rule_id = ?', [existingRule.id], (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                });
                
                // Insert new location mappings
                for (const location of sourceLocations) {
                  await new Promise((resolve, reject) => {
                    db.run(
                      'INSERT INTO promo_pricing_locations (promo_rule_id, location_code, location_type) VALUES (?, ?, ?)',
                      [existingRule.id, location, 'source'],
                      (err) => {
                        if (err) reject(err);
                        else resolve();
                      }
                    );
                  });
                }
                
                for (const location of destinationLocations) {
                  await new Promise((resolve, reject) => {
                    db.run(
                      'INSERT INTO promo_pricing_locations (promo_rule_id, location_code, location_type) VALUES (?, ?, ?)',
                      [existingRule.id, location, 'destination'],
                      (err) => {
                        if (err) reject(err);
                        else resolve();
                      }
                    );
                  });
                }
                
                // Skip INSERT - we updated instead
                continue;
              } else {
                // Insert new rule
                await new Promise((resolve, reject) => {
                  db.run(
                    `INSERT INTO promo_pricing_rules 
                     (rule_name, price_under_100mb, price_100_to_999mb, price_1000_to_2999mb, price_3000mb_plus, 
                      is_active, created_by, updated_by) 
                     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
                    [cleanRow.rule_name, priceUnder100mb, price100to999mb, price1000to2999mb, price3000mbPlus, req.user.id, req.user.id],
                    function(err) {
                      if (err) reject(err);
                      else resolve();
                    }
                  );
                });
                
                // Query back to get the actual inserted ID (this.lastID doesn't work reliably in bulk uploads)
                const ruleId = await new Promise((resolve, reject) => {
                  db.get(
                    'SELECT id FROM promo_pricing_rules WHERE rule_name = ? AND created_by = ? ORDER BY id DESC LIMIT 1',
                    [cleanRow.rule_name, req.user.id],
                    (err, result) => {
                      if (err) reject(err);
                      else if (!result || !result.id) reject(new Error('Could not retrieve inserted rule ID'));
                      else resolve(result.id);
                    }
                  );
                });
                
                // Insert location mappings
                for (const location of sourceLocations) {
                  await new Promise((resolve, reject) => {
                    db.run(
                      'INSERT INTO promo_pricing_locations (promo_rule_id, location_code, location_type) VALUES (?, ?, ?)',
                      [ruleId, location, 'source'],
                      (err) => {
                        if (err) reject(err);
                        else resolve();
                      }
                    );
                  });
                }
                
                for (const location of destinationLocations) {
                  await new Promise((resolve, reject) => {
                    db.run(
                      'INSERT INTO promo_pricing_locations (promo_rule_id, location_code, location_type) VALUES (?, ?, ?)',
                      [ruleId, location, 'destination'],
                      (err) => {
                        if (err) reject(err);
                        else resolve();
                      }
                    );
                  });
                }
                
                // Skip the default INSERT logic - we've handled it
                continue;
              }
            } catch (dbError) {
              insertErrors.push(`Row ${index + 1}: Database error - ${dbError.message}`);
              continue; // Skip this row and continue with next
            }
          } else if (module === 'pop_capabilities') {
            try {
              // First, lookup or update the location using location_code
              let locationId = cleanRow.location_id;
              
              if (cleanRow.location_code) {
                // Look up location by location_code
                const location = await new Promise((resolve, reject) => {
                  db.get(
                    'SELECT id FROM location_reference WHERE LOWER(TRIM(location_code)) = LOWER(TRIM(?))',
                    [cleanRow.location_code],
                    (err, row) => {
                      if (err) reject(err);
                      else resolve(row);
                    }
                  );
                });
                
                if (location) {
                  locationId = location.id;
                  // Update location data if provided
                  const locationFields = [
                    'region', 'city', 'country', 'datacenter_name', 'datacenter_address',
                    'latitude', 'longitude', 'time_zone', 'pop_type', 'status', 'provider', 'access_info',
                    'min_price_under_100mb', 'min_price_100_to_999mb', 'min_price_1000_to_2999mb', 'min_price_3000mb_plus'
                  ];
                  const locationValues = locationFields.filter(field => cleanRow[field] !== undefined && cleanRow[field] !== null);
                  if (locationValues.length > 0) {
                    const updateLocationSql = `UPDATE location_reference SET ${locationValues.map(field => `${field} = ?`).join(', ')} WHERE id = ?`;
                    const updateLocationValues = [...locationValues.map(field => cleanRow[field]), locationId];
                    await new Promise((resolve, reject) => {
                      db.run(updateLocationSql, updateLocationValues, (err) => {
                        if (err) reject(err);
                        else resolve();
                      });
                    });
                  }
                }
              }
              
              if (!locationId) {
                insertErrors.push(`Row ${index + 1}: Could not find location for location_code: ${cleanRow.location_code}`);
                continue;
              }
              
              // Apply default values for pop_capabilities boolean fields
              const booleanFields = [
                'cnx_extranet_wan', 'cnx_ethernet', 'cnx_voice', 'tdm_gateway',
                'cnx_unigy', 'cnx_alpha', 'cnx_chrono', 'cnx_sdwan', 'csp_on_ramp',
                'exchange_on_ramp', 'internet_on_ramp', 'transport_only_pop', 'cnx_colocation', 'exchange_pricing_in_region'
              ];
              booleanFields.forEach(field => {
                if (cleanRow[field] === null || cleanRow[field] === undefined) {
                  cleanRow[field] = 0;
                }
              });
              
              // Check for existing capabilities for same location
              const existingCapabilities = await new Promise((resolve, reject) => {
                db.get(
                  'SELECT location_id FROM pop_capabilities WHERE location_id = ?',
                  [locationId],
                  (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                  }
                );
              });
              
              // Only update/insert the POP capability fields
              const capabilityFields = [
                'location_id', 'cnx_extranet_wan', 'cnx_ethernet', 'cnx_voice', 'tdm_gateway',
                'cnx_unigy', 'cnx_alpha', 'cnx_chrono', 'cnx_sdwan', 'csp_on_ramp',
                'exchange_on_ramp', 'internet_on_ramp', 'transport_only_pop', 'cnx_colocation', 'exchange_pricing_in_region'
              ];
              
              if (existingCapabilities) {
                // Update existing capabilities
                const updateFields = capabilityFields.slice(1); // Skip location_id
                sql = `UPDATE pop_capabilities SET ${updateFields.map(field => `${field} = ?`).join(', ')} WHERE location_id = ?`;
                values = [
                  ...updateFields.map(field => cleanRow[field]),
                  locationId
                ];
              } else {
                // Insert new capabilities
                sql = `INSERT INTO pop_capabilities (${capabilityFields.join(', ')}) VALUES (${capabilityFields.map(() => '?').join(', ')})`;
                values = capabilityFields.map(field => field === 'location_id' ? locationId : cleanRow[field]);
              }
            } catch (dbError) {
              insertErrors.push(`Row ${index + 1}: Database error checking for duplicates - ${dbError.message}`);
              continue; // Skip this row and continue with next
            }
          } else if (module === 'exchange_feeds') {
            try {
              // Apply default values for exchange_feeds before database operations
              if (!cleanRow.pass_through_currency) {
                cleanRow.pass_through_currency = 'USD';
              }
              if (cleanRow.pass_through_fees === null || cleanRow.pass_through_fees === undefined || cleanRow.pass_through_fees === '') {
                cleanRow.pass_through_fees = 0;
              }
              
              // Handle constrained fields - dr_type is optional, set to NULL if empty
              if (!cleanRow.dr_type || cleanRow.dr_type === '' || cleanRow.dr_type === undefined) {
                cleanRow.dr_type = null; // dr_type is optional, allow NULL
              }
              
              // Required fields with defaults
              if (!cleanRow.feed_delivery || cleanRow.feed_delivery === '') {
                cleanRow.feed_delivery = 'Multicast'; // Default feed delivery type
              }
              if (!cleanRow.feed_type || cleanRow.feed_type === '') {
                cleanRow.feed_type = 'Equities'; // Default feed type
              }
              
              // Boolean fields defaults
              const booleanFields = ['dr_available', 'available_now', 'quick_quote', 'isf_enabled'];
              booleanFields.forEach(field => {
                if (cleanRow[field] === null || cleanRow[field] === undefined) {
                  cleanRow[field] = 0;
                }
              });
              
              // Check for existing feed with same exchange_id and feed_name
              const existingFeed = await new Promise((resolve, reject) => {
                db.get(
                  'SELECT id FROM exchange_feeds WHERE exchange_id = ? AND LOWER(TRIM(feed_name)) = LOWER(TRIM(?))',
                  [cleanRow.exchange_id, cleanRow.feed_name],
                  (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                  }
                );
              });
              
              if (existingFeed) {
                // Update existing feed - skip exchange_id and feed_name as they identify the record
                const updateFields = config.templateFields.slice(2); // Skip exchange_id and feed_name
                sql = `UPDATE exchange_feeds SET ${updateFields.map(field => `${field} = ?`).join(', ')}, updated_by = ?, updated_date = ? WHERE id = ?`;
                values = [
                  ...updateFields.map(field => cleanRow[field]),
                  req.user.id, new Date().toISOString(), existingFeed.id
                ];
              } else {
                // Insert new feed
                sql = `INSERT INTO exchange_feeds (${config.templateFields.join(', ')}, created_by, updated_by, updated_date) VALUES (${config.templateFields.map(() => '?').join(', ')}, ?, ?, ?)`;
                values = [...config.templateFields.map(field => cleanRow[field]), req.user.id, req.user.id, new Date().toISOString()];
              }
            } catch (dbError) {
              insertErrors.push(`Row ${index + 1}: Database error checking for duplicates - ${dbError.message}`);
              continue; // Skip this row and continue with next
            }
          } else if (module === 'exchange_contacts') {
            try {
              // Check for existing contact with same exchange_id and contact_name
              const existingContact = await new Promise((resolve, reject) => {
                db.get(
                  'SELECT id FROM exchange_contacts WHERE exchange_id = ? AND LOWER(TRIM(contact_name)) = LOWER(TRIM(?))',
                  [cleanRow.exchange_id, cleanRow.contact_name],
                  (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                  }
                );
              });
              
              if (existingContact) {
                // Update existing contact - skip exchange_id and contact_name as they identify the record
                const updateFields = config.templateFields.filter(field => field !== 'exchange_id' && field !== 'contact_name');
                sql = `UPDATE exchange_contacts SET ${updateFields.map(field => `${field} = ?`).join(', ')}, updated_by = ?, updated_date = ? WHERE id = ?`;
                values = [
                  ...updateFields.map(field => cleanRow[field]),
                  req.user.id, new Date().toISOString(), existingContact.id
                ];
              } else {
                // Insert new contact
                sql = `INSERT INTO exchange_contacts (${config.templateFields.join(', ')}, created_by, updated_by, updated_date) VALUES (${config.templateFields.map(() => '?').join(', ')}, ?, ?, ?)`;
                values = [...config.templateFields.map(field => cleanRow[field] || null), req.user.id, req.user.id, new Date().toISOString()];
              }
            } catch (dbError) {
              insertErrors.push(`Row ${index + 1}: Database error checking for duplicates - ${dbError.message}`);
              continue; // Skip this row and continue with next
            }
          } else if (module === 'exchange_rates') {
            sql = `INSERT OR REPLACE INTO exchange_rates (${config.templateFields.join(', ')}) VALUES (${config.templateFields.map(() => '?').join(', ')})`;
            values = config.templateFields.map(field => cleanRow[field] || null);
          } else if (module === 'locations') {
            // Process cross connect values - convert 'POA' string to NULL for database storage
            const processedRow = { ...cleanRow };
            if (processedRow.cross_connect_nrc === 'POA' || processedRow.cross_connect_nrc === '' || processedRow.cross_connect_nrc === undefined) {
              processedRow.cross_connect_nrc = null;
            } else if (processedRow.cross_connect_nrc) {
              processedRow.cross_connect_nrc = parseFloat(processedRow.cross_connect_nrc);
            }
            
            if (processedRow.cross_connect_mrc === 'POA' || processedRow.cross_connect_mrc === '' || processedRow.cross_connect_mrc === undefined) {
              processedRow.cross_connect_mrc = null;
            } else if (processedRow.cross_connect_mrc) {
              processedRow.cross_connect_mrc = parseFloat(processedRow.cross_connect_mrc);
            }
            
            // Ensure currency defaults
            processedRow.cross_connect_nrc_currency = processedRow.cross_connect_nrc_currency || 'USD';
            processedRow.cross_connect_mrc_currency = processedRow.cross_connect_mrc_currency || 'USD';
            processedRow.cross_connect_notes = processedRow.cross_connect_notes || '';
            
            sql = `INSERT OR REPLACE INTO location_reference (${config.templateFields.join(', ')}) VALUES (${config.templateFields.map(() => '?').join(', ')})`;
            values = config.templateFields.map(field => processedRow[field] || null);
          } else if (module === 'carrier_contacts') {
            try {
              // Check for existing contact with same carrier_id and contact_name
              const existingContact = await new Promise((resolve, reject) => {
                db.get(
                  'SELECT id FROM carrier_contacts WHERE carrier_id = ? AND LOWER(TRIM(contact_name)) = LOWER(TRIM(?))',
                  [cleanRow.carrier_id, cleanRow.contact_name],
                  (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                  }
                );
              });
              
              if (existingContact) {
                // Update existing contact - skip carrier_id and contact_name as they identify the record
                const updateFields = config.templateFields.filter(field => field !== 'carrier_id' && field !== 'contact_name');
                sql = `UPDATE carrier_contacts SET ${updateFields.map(field => `${field} = ?`).join(', ')}, updated_by = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?`;
                values = [
                  ...updateFields.map(field => cleanRow[field]),
                  req.user.id, existingContact.id
                ];
              } else {
                // Insert new contact
                sql = `INSERT INTO carrier_contacts (${config.templateFields.join(', ')}, created_by, last_updated) VALUES (${config.templateFields.map(() => '?').join(', ')}, ?, CURRENT_TIMESTAMP)`;
                values = [...config.templateFields.map(field => cleanRow[field] || null), req.user.id];
              }
            } catch (dbError) {
              insertErrors.push(`Row ${index + 1}: Database error checking for duplicates - ${dbError.message}`);
              continue; // Skip this row and continue with next
            }
          } else if (module === 'exchanges') {
            sql = `INSERT OR REPLACE INTO exchanges (${config.templateFields.join(', ')}) VALUES (${config.templateFields.map(() => '?').join(', ')})`;
            values = config.templateFields.map(field => cleanRow[field] || null);
          }
          
          try {
            await new Promise((resolve, reject) => {
              db.run(sql, values, function(err) {
                if (err) {
                  insertErrors.push(`Row ${index + 1}: ${err.message}`);
                  console.error(`[BULK UPLOAD] Insert error for row ${index + 1} in module ${module}:`, err.message);
                  console.error(`[BULK UPLOAD] SQL:`, sql);
                  console.error(`[BULK UPLOAD] Values:`, values);
                  reject(err);
                } else {
                  console.log(`[BULK UPLOAD] Successfully inserted row ${index + 1}/${results.length} for module: ${module}`);
                  resolve();
                }
              });
            });
          } catch (insertError) {
            // Error already logged above, continue with next row
          }
          
          completed++;
          
          // Update progress tracking for each insert
          uploadInfo = activeUploads.get(sessionId);
          if (uploadInfo) {
            const insertProgress = Math.floor(completed / results.length * 15); // 15% for insertion
            uploadInfo.progress = 85 + insertProgress; // Start from 85%
            uploadInfo.stage = `Inserting row ${completed} of ${results.length}...`;
          }
        }
        
        // All operations complete
        const dbTime = Date.now() - dbStartTime;
        const totalTime = Date.now() - startTime;
        
        if (insertErrors.length > 0) {
          console.log(`[BULK UPLOAD] Database insert completed with errors for module: ${module}, ${insertErrors.length} errors, rolling back transaction`);
          
          // Clear the timeout since upload failed
          clearTimeout(uploadTimeout);
          
          // Update progress tracking
          uploadInfo = activeUploads.get(sessionId);
          if (uploadInfo) {
            uploadInfo.status = 'error';
            uploadInfo.stage = 'Database insert failed - rolling back';
            uploadInfo.errors = insertErrors;
            setTimeout(() => activeUploads.delete(sessionId), 60000);
          }
          
          // Rollback transaction
          db.run('ROLLBACK', (rollbackErr) => {
            if (rollbackErr) console.error(`[BULK UPLOAD] Rollback failed for module: ${module}:`, rollbackErr);
            console.log(`[BULK UPLOAD] Transaction rolled back for module: ${module}, total time: ${totalTime}ms`);
          });
        } else {
          console.log(`[BULK UPLOAD] All rows inserted successfully for module: ${module}, committing transaction`);
          
          // Update progress tracking
          uploadInfo = activeUploads.get(sessionId);
          if (uploadInfo) {
            uploadInfo.progress = 95;
            uploadInfo.stage = 'Committing transaction...';
          }
          
          // Commit transaction
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              console.log(`[BULK UPLOAD] Failed to commit transaction for module: ${module}, error: ${commitErr.message}`);
              
              // Clear the timeout since commit failed
              clearTimeout(uploadTimeout);
              
              // Update progress tracking
              uploadInfo = activeUploads.get(sessionId);
              if (uploadInfo) {
                uploadInfo.status = 'error';
                uploadInfo.stage = 'Failed to commit transaction';
                uploadInfo.errors = [commitErr.message];
                setTimeout(() => activeUploads.delete(sessionId), 60000);
              }
              return;
            }
            
            console.log(`[BULK UPLOAD] Transaction committed successfully for module: ${module}`);
            console.log(`[BULK UPLOAD] Database time: ${dbTime}ms, Total time: ${totalTime}ms, Rows imported: ${results.length}`);
            
            // Log successful bulk upload
            logChange(null, 'bulk_upload', null, 'BULK_IMPORT', null, {
              module,
              rows_imported: results.length,
              filename: req.file.originalname
            }, req);
            
            console.log(`[BULK UPLOAD] Bulk upload completed successfully for module: ${module}, file: ${req.file.originalname}`);
            
            // Clear the timeout since upload completed successfully
            clearTimeout(uploadTimeout);
            
            // Update progress tracking - completed
            uploadInfo = activeUploads.get(sessionId);
            if (uploadInfo) {
              uploadInfo.status = 'completed';
              uploadInfo.stage = 'Upload completed successfully';
              uploadInfo.progress = 100;
              uploadInfo.result = {
                message: 'Bulk upload successful',
                module,
                rows_imported: results.length,
                total_rows: results.length
              };
              // Clean up after 5 minutes
              setTimeout(() => activeUploads.delete(sessionId), 300000);
            }
          });
        }
      });
    })
    .on('error', (error) => {
      console.error(`[BULK UPLOAD] CSV processing error for module: ${module}, file: ${req.file.originalname}, error: ${error.message}`);
      
      // Update progress tracking
      uploadInfo = activeUploads.get(sessionId);
      if (uploadInfo) {
        uploadInfo.status = 'error';
        uploadInfo.stage = 'CSV processing failed';
        uploadInfo.errors = [error.message];
        setTimeout(() => activeUploads.delete(sessionId), 60000);
      }
      
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.status(500).json({ error: 'Failed to process CSV file: ' + error.message, sessionId });
    });
});

// Get upload progress
router.get('/bulk-upload/progress/:sessionId', authenticateToken, authorizeRole('administrator'), (req, res) => {
  const { sessionId } = req.params;
  const uploadInfo = activeUploads.get(sessionId);
  
  if (!uploadInfo) {
    return res.status(404).json({ error: 'Upload session not found' });
  }
  
  res.json(uploadInfo);

  // Automatically clean up sessions that have finished processing to avoid unnecessary backend work
  if (uploadInfo.status === 'completed' || uploadInfo.status === 'error') {
    activeUploads.delete(sessionId);
  }
});

// Get bulk upload history (admin only)
router.get('/bulk-upload/history', authenticateToken, authorizeRole('administrator'), (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  
  db.all(
    `SELECT * FROM change_logs 
     WHERE action IN ('BULK_IMPORT', 'DOWNLOAD', 'EXPORT') 
     ORDER BY timestamp DESC 
     LIMIT ? OFFSET ?`,
    [limit, offset],
    (err, logs) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get(
        `SELECT COUNT(*) as total FROM change_logs WHERE action IN ('BULK_IMPORT', 'DOWNLOAD', 'EXPORT')`,
        [],
        (countErr, countResult) => {
          if (countErr) return res.status(500).json({ error: countErr.message });
          
          res.json({
            history: logs,
            pagination: {
              current_page: page,
              total_pages: Math.ceil(countResult.total / limit),
              total_records: countResult.total,
              per_page: limit
            }
          });
        }
      );
    }
  );
});

// Get pricing logic configuration 
router.get('/pricing_logic/config', authenticateToken, (req, res) => {
  db.all('SELECT * FROM pricing_logic_config', [], (err, configs) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Convert flat config array to nested object structure
    const configData = {
      contractTerms: {
        12: { minMargin: 40, suggestedMargin: 60, nrcCharge: 1000 },
        24: { minMargin: 37.5, suggestedMargin: 55, nrcCharge: 500 },
        36: { minMargin: 35, suggestedMargin: 50, nrcCharge: 0 }
      },
      protectedServiceMargins: {
        12: { minMargin: 50, suggestedMargin: 70 },
        24: { minMargin: 47.5, suggestedMargin: 65 },
        36: { minMargin: 45, suggestedMargin: 60 }
      },
      charges: {
        protectionPathMultiplier: 0.7
      },
      utilizationFactors: {
        primaryUnder10000: 0.9,
        primaryOver10000: 0.9,
        protectionUnder10000: 1.0,
        protectionOver10000: 1.0
      },
      promoPricing: {
        minimumMarginPercent: 35,
        discount24Month: 5,
        discount36Month: 10
      },
      crossConnect: {
        nrcMargin: 10,
        mrcMargin: 10
      }
    };
    
    // Override with database values
    configs.forEach(config => {
      const parts = config.config_key.split('.');
      if (parts.length === 3 && parts[0] === 'contractTerms') {
        const term = parts[1];
        const field = parts[2];
        if (!configData.contractTerms[term]) configData.contractTerms[term] = {};
        configData.contractTerms[term][field] = parseFloat(config.config_value);
      } else if (parts.length === 3 && parts[0] === 'protectedServiceMargins') {
        const term = parts[1];
        const field = parts[2];
        if (!configData.protectedServiceMargins[term]) configData.protectedServiceMargins[term] = {};
        configData.protectedServiceMargins[term][field] = parseFloat(config.config_value);
      } else if (parts.length === 2 && parts[0] === 'charges') {
        configData.charges[parts[1]] = parseFloat(config.config_value);
      } else if (parts.length === 2 && parts[0] === 'utilizationFactors') {
        configData.utilizationFactors[parts[1]] = parseFloat(config.config_value);
      } else if (parts.length === 2 && parts[0] === 'promoPricing') {
        configData.promoPricing[parts[1]] = parseFloat(config.config_value);
      } else if (parts.length === 2 && parts[0] === 'crossConnect') {
        configData.crossConnect[parts[1]] = parseFloat(config.config_value);
      }
    });
    
    res.json({
      success: true,
      data: configData,
      lastUpdated: new Date().toISOString()
    });
  });
});

// Update pricing logic configuration
router.put('/pricing_logic/config', authenticateToken, authorizeRole('administrator'), (req, res) => {
  const { contractTerms, protectedServiceMargins, charges, utilizationFactors, promoPricing, crossConnect } = req.body;

  // Validate input
  if (!contractTerms || !protectedServiceMargins || !charges || !utilizationFactors || !promoPricing || !crossConnect) {
    return res.status(400).json({ error: 'All configuration sections are required' });
  }

  // Prepare update operations
  const updateOperations = [];

  // Contract terms
  Object.keys(contractTerms).forEach(term => {
    const termConfig = contractTerms[term];
    ['minMargin', 'suggestedMargin', 'nrcCharge'].forEach(field => {
      updateOperations.push({
        key: `contractTerms.${term}.${field}`,
        value: termConfig[field]
      });
    });
  });

  // Protected service margins
  Object.keys(protectedServiceMargins).forEach(term => {
    const termConfig = protectedServiceMargins[term];
    ['minMargin', 'suggestedMargin'].forEach(field => {
      updateOperations.push({
        key: `protectedServiceMargins.${term}.${field}`,
        value: termConfig[field]
      });
    });
  });

  // Charges
  Object.keys(charges).forEach(chargeType => {
    updateOperations.push({
      key: `charges.${chargeType}`,
      value: charges[chargeType]
    });
  });

  // Utilization factors
  Object.keys(utilizationFactors).forEach(factorType => {
    updateOperations.push({
      key: `utilizationFactors.${factorType}`,
      value: utilizationFactors[factorType]
    });
  });

  // Promo pricing
  Object.keys(promoPricing).forEach(settingType => {
    updateOperations.push({
      key: `promoPricing.${settingType}`,
      value: promoPricing[settingType]
    });
  });

  // Cross connect settings
  Object.keys(crossConnect).forEach(settingType => {
    updateOperations.push({
      key: `crossConnect.${settingType}`,
      value: crossConnect[settingType]
    });
  });

  // Execute all updates
  const dbInstance = db.getInstance();
  if (!dbInstance) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  dbInstance.run('BEGIN TRANSACTION');

  let completed = 0;
  let hasError = false;

  updateOperations.forEach(operation => {
    dbInstance.run(
      'INSERT OR REPLACE INTO pricing_logic_config (config_key, config_value, updated_by, updated_date) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [operation.key, operation.value.toString(), req.user.id],
      function(err) {
        if (err && !hasError) {
          hasError = true;
          dbInstance.run('ROLLBACK');
          return res.status(500).json({ error: 'Failed to update pricing configuration: ' + err.message });
        }

        completed++;
          if (completed === updateOperations.length && !hasError) {
            dbInstance.run('COMMIT');

            // Log the configuration change
            logChange(req.user.id, 'pricing_logic_config', 'config', 'UPDATE', null, {
              contractTerms, protectedServiceMargins, charges, utilizationFactors, promoPricing
            }, req);

            res.json({
              success: true,
              message: 'Pricing logic configuration updated successfully'
            });
          }
        }
      );
    });
  });

// Find matching promo pricing rules for a route
const findPromoPrice = (sourceLocation, destinationLocation, bandwidth) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT pr.*, 
             pls.location_code as source_match, 
             pld.location_code as dest_match
      FROM promo_pricing_rules pr
      INNER JOIN promo_pricing_locations pls ON pr.id = pls.promo_rule_id AND pls.location_type = 'source'
      INNER JOIN promo_pricing_locations pld ON pr.id = pld.promo_rule_id AND pld.location_type = 'destination'
      WHERE pr.is_active = 1
        AND ((pls.location_code = ? AND pld.location_code = ?) 
             OR (pls.location_code = ? AND pld.location_code = ?))
      ORDER BY pr.created_at ASC
    `;

    db.all(query, [sourceLocation, destinationLocation, destinationLocation, sourceLocation], (err, rules) => {
      if (err) {
        reject(err);
        return;
      }

      if (rules.length === 0) {
        resolve(null);
        return;
      }

      // Determine which pricing tier to use based on bandwidth
      const bandwidthMbps = parseFloat(bandwidth);
      let priceField;
      if (bandwidthMbps < 100) {
        priceField = 'price_under_100mb';
      } else if (bandwidthMbps < 1000) {
        priceField = 'price_100_to_999mb';
      } else if (bandwidthMbps < 3000) {
        priceField = 'price_1000_to_2999mb';
      } else {
        priceField = 'price_3000mb_plus';
      }

      // Find the rule with the lowest price for this bandwidth tier
      let lowestPrice = Infinity;
      let selectedRule = null;

      rules.forEach(rule => {
        const price = parseFloat(rule[priceField]);
        if (price > 0 && price < lowestPrice) {
          lowestPrice = price;
          selectedRule = rule;
        }
      });

      if (selectedRule) {
        resolve({
          ruleId: selectedRule.id,
          ruleName: selectedRule.rule_name,
          price: lowestPrice,
          priceField: priceField,
          createdAt: selectedRule.created_at
        });
      } else {
        resolve(null);
      }
    });
  });
};

// Get pricing logic configuration for calculations (internal use)
const getPricingLogicConfig = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM pricing_logic_config', [], (err, configs) => {
      if (err) {
        reject(err);
        return;
      }

      // Default configuration
      const configData = {
        contractTerms: {
          12: { minMargin: 40, suggestedMargin: 60, nrcCharge: 1000 },
          24: { minMargin: 37.5, suggestedMargin: 55, nrcCharge: 500 },
          36: { minMargin: 35, suggestedMargin: 50, nrcCharge: 0 }
        },
        protectedServiceMargins: {
          12: { minMargin: 50, suggestedMargin: 70 },
          24: { minMargin: 47.5, suggestedMargin: 65 },
          36: { minMargin: 45, suggestedMargin: 60 }
        },
              charges: {
        protectionPathMultiplier: 0.7
      },
      utilizationFactors: {
        primaryUnder10000: 0.9,
        primaryOver10000: 0.9,
        protectionUnder10000: 1.0,
        protectionOver10000: 1.0
      },
      promoPricing: {
        minimumMarginPercent: 35,
        discount24Month: 5,
        discount36Month: 10
      },
      crossConnect: {
        nrcMargin: 10,
        mrcMargin: 10
      }
    };

      // Override with database values
      configs.forEach(config => {
        const parts = config.config_key.split('.');
        if (parts.length === 3 && parts[0] === 'contractTerms') {
          const term = parts[1];
          const field = parts[2];
          if (!configData.contractTerms[term]) configData.contractTerms[term] = {};
          configData.contractTerms[term][field] = parseFloat(config.config_value);
        } else if (parts.length === 3 && parts[0] === 'protectedServiceMargins') {
          const term = parts[1];
          const field = parts[2];
          if (!configData.protectedServiceMargins[term]) configData.protectedServiceMargins[term] = {};
          configData.protectedServiceMargins[term][field] = parseFloat(config.config_value);
        } else if (parts.length === 2 && parts[0] === 'charges') {
          configData.charges[parts[1]] = parseFloat(config.config_value);
        } else if (parts.length === 2 && parts[0] === 'utilizationFactors') {
          configData.utilizationFactors[parts[1]] = parseFloat(config.config_value);
        } else if (parts.length === 2 && parts[0] === 'promoPricing') {
          configData.promoPricing[parts[1]] = parseFloat(config.config_value);
        } else if (parts.length === 2 && parts[0] === 'crossConnect') {
          configData.crossConnect[parts[1]] = parseFloat(config.config_value);
        }
      });

      resolve(configData);
    });
  });
};

// ====================================
// PROMO PRICING MANAGEMENT APIs (Admin Only)
// ====================================

// Helper function to get promo rules with their locations
const getPromoRulesWithLocations = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        pr.*,
        u1.username as created_by_username,
        u2.username as updated_by_username,
        GROUP_CONCAT(CASE WHEN pl.location_type = 'source' THEN pl.location_code END) as source_locations,
        GROUP_CONCAT(CASE WHEN pl.location_type = 'destination' THEN pl.location_code END) as destination_locations
      FROM promo_pricing_rules pr
      LEFT JOIN users u1 ON pr.created_by = u1.id
      LEFT JOIN users u2 ON pr.updated_by = u2.id
      LEFT JOIN promo_pricing_locations pl ON pr.id = pl.promo_rule_id
      WHERE pr.is_active = 1
      GROUP BY pr.id
      ORDER BY pr.created_at DESC
    `;
    
    db.all(query, [], (err, rules) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Parse locations strings into arrays
      const rulesWithLocations = rules.map(rule => ({
        ...rule,
        source_locations: rule.source_locations ? rule.source_locations.split(',') : [],
        destination_locations: rule.destination_locations ? rule.destination_locations.split(',') : []
      }));
      
      resolve(rulesWithLocations);
    });
  });
};

// Get all promo pricing rules
router.get('/promo-pricing', authenticateToken, authorizeRole('administrator'), async (req, res) => {
  try {
    const { search } = req.query;
    const rules = await getPromoRulesWithLocations();
    
    // Apply search filter if provided
    let filteredRules = rules;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredRules = rules.filter(rule =>
        rule.rule_name?.toLowerCase().includes(searchLower) ||
        rule.description?.toLowerCase().includes(searchLower) ||
        rule.source_locations.some(loc => loc.toLowerCase().includes(searchLower)) ||
        rule.destination_locations.some(loc => loc.toLowerCase().includes(searchLower))
      );
    }
    
    res.json({
      success: true,
      data: filteredRules,
      message: `Found ${filteredRules.length} promo pricing rules`
    });
  } catch (err) {
    console.error('Error loading promo pricing rules:', err);
    res.status(500).json({ error: 'Failed to load promo pricing rules: ' + err.message });
  }
});

// Create new promo pricing rule
router.post('/promo-pricing', authenticateToken, authorizeRole('administrator'), (req, res) => {
  const {
    rule_name, source_locations, destination_locations,
    price_under_100mb, price_100_to_999mb, price_1000_to_2999mb, price_3000mb_plus
  } = req.body;
  
  // Validate required fields
  if (!rule_name || !source_locations || !destination_locations) {
    return res.status(400).json({ error: 'Rule name, source locations, and destination locations are required' });
  }
  
  if (!Array.isArray(source_locations) || source_locations.length === 0) {
    return res.status(400).json({ error: 'Source locations must be a non-empty array' });
  }
  
  if (!Array.isArray(destination_locations) || destination_locations.length === 0) {
    return res.status(400).json({ error: 'Destination locations must be a non-empty array' });
  }

  // Helper function to insert locations
  const insertLocations = (ruleId, callback) => {
    db.run('BEGIN TRANSACTION', (transErr) => {
      if (transErr) return callback(transErr);
      
      const allLocationInserts = [];
      
      // Add all locations to insert array
      source_locations.forEach(location => {
        allLocationInserts.push({ ruleId, locationCode: location, locationType: 'source' });
      });
      destination_locations.forEach(location => {
        allLocationInserts.push({ ruleId, locationCode: location, locationType: 'destination' });
      });
      
      // Insert locations sequentially
      let insertCount = 0;
      const insertNext = () => {
        if (insertCount >= allLocationInserts.length) {
          // All inserts complete, commit
          db.run('COMMIT', callback);
          return;
        }
        
        const loc = allLocationInserts[insertCount];
        console.log(`Inserting location ${insertCount + 1}/${allLocationInserts.length}:`, loc);
        db.run(
          'INSERT OR IGNORE INTO promo_pricing_locations (promo_rule_id, location_code, location_type) VALUES (?, ?, ?)',
          [loc.ruleId, loc.locationCode, loc.locationType],
          function(err) {
            if (err) {
              console.error('Location insert error:', err);
              db.run('ROLLBACK');
              return callback(err);
            }
            console.log('Location inserted successfully, changes:', this.changes);
            insertCount++;
            insertNext();
          }
        );
      };
      
      insertNext();
    });
  };

  // Insert the main rule
  db.run(
    `INSERT INTO promo_pricing_rules (rule_name, price_under_100mb, price_100_to_999mb, 
     price_1000_to_2999mb, price_3000mb_plus, is_active, created_by) 
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [rule_name, parseFloat(price_under_100mb) || 0, parseFloat(price_100_to_999mb) || 0, 
     parseFloat(price_1000_to_2999mb) || 0, parseFloat(price_3000mb_plus) || 0, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Promo pricing insert error: ' + err.message });
      }
      
      console.log('INSERT result - this.lastID:', this.lastID, 'this.changes:', this.changes);
      
      // Query back to get the actual inserted ID using rule_name and created_by
      db.get(
        'SELECT id FROM promo_pricing_rules WHERE rule_name = ? AND created_by = ? ORDER BY id DESC LIMIT 1',
        [rule_name, req.user.id],
        (selectErr, result) => {
          if (selectErr) {
            return res.status(500).json({ error: 'Error retrieving inserted rule ID: ' + selectErr.message });
          }
          
          if (!result || !result.id) {
            return res.status(500).json({ error: 'Could not find inserted rule ID' });
          }
          
          const ruleId = result.id;
          console.log('Retrieved rule ID from database:', ruleId);
          
          // Insert all locations
          insertLocations(ruleId, (locErr) => {
            if (locErr) {
              return res.status(500).json({ error: 'Failed to insert locations: ' + locErr.message });
            }
            
            // Log the change
            logChange(req.user.id, 'promo_pricing_rules', ruleId, 'CREATE', null, {
              rule_name, source_locations, destination_locations, 
              price_under_100mb, price_100_to_999mb, price_1000_to_2999mb, price_3000mb_plus
            }, req);
            
            res.json({ message: 'Promo pricing rule created successfully', id: ruleId });
          });
        }
      );
    }
  );
});

// Update promo pricing rule
router.put('/promo-pricing/:id', authenticateToken, authorizeRole('administrator'), (req, res) => {
  const ruleId = req.params.id;
  const {
    rule_name, source_locations, destination_locations,
    price_under_100mb, price_100_to_999mb, price_1000_to_2999mb, price_3000mb_plus
  } = req.body;
  
  db.run('BEGIN TRANSACTION', (err) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Get old values for change logging
    db.get('SELECT * FROM promo_pricing_rules WHERE id = ?', [ruleId], (err, oldRule) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      
      if (!oldRule) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Promo pricing rule not found' });
      }
      
      // Update the promo rule
      db.run(
        `UPDATE promo_pricing_rules SET rule_name = ?, price_under_100mb = ?, price_100_to_999mb = ?, 
         price_1000_to_2999mb = ?, price_3000mb_plus = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [rule_name, parseFloat(price_under_100mb) || 0, parseFloat(price_100_to_999mb) || 0, 
         parseFloat(price_1000_to_2999mb) || 0, parseFloat(price_3000mb_plus) || 0, req.user.id, ruleId],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
          
          // Delete existing location mappings
          db.run('DELETE FROM promo_pricing_locations WHERE promo_rule_id = ?', [ruleId], (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }
            
            // Insert new location mappings
            const sourceInserts = source_locations.map(location => 
              new Promise((resolve, reject) => {
                db.run(
                  'INSERT INTO promo_pricing_locations (promo_rule_id, location_code, location_type) VALUES (?, ?, ?)',
                  [ruleId, location, 'source'],
                  (err) => err ? reject(err) : resolve()
                );
              })
            );
            
            const destInserts = destination_locations.map(location => 
              new Promise((resolve, reject) => {
                db.run(
                  'INSERT INTO promo_pricing_locations (promo_rule_id, location_code, location_type) VALUES (?, ?, ?)',
                  [ruleId, location, 'destination'],
                  (err) => err ? reject(err) : resolve()
                );
              })
            );
            
            Promise.all([...sourceInserts, ...destInserts])
              .then(() => {
                db.run('COMMIT', (err) => {
                  if (err) return res.status(500).json({ error: err.message });
                  
                  logChange(req.user.id, 'promo_pricing_rules', ruleId, 'UPDATE', oldRule, {
                    rule_name, source_locations, destination_locations,
                    price_under_100mb, price_100_to_999mb, price_1000_to_2999mb, price_3000mb_plus
                  }, req);
                  
                  res.json({ message: 'Promo pricing rule updated successfully' });
                });
              })
              .catch(err => {
                db.run('ROLLBACK');
                res.status(500).json({ error: 'Failed to update promo pricing rule: ' + err.message });
              });
          });
        }
      );
    });
  });
});

// Delete promo pricing rule
router.delete('/promo-pricing/:id', authenticateToken, authorizeRole('administrator'), (req, res) => {
  const ruleId = req.params.id;
  
  db.run('BEGIN TRANSACTION', (err) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Get rule details for change logging
    db.get('SELECT * FROM promo_pricing_rules WHERE id = ?', [ruleId], (err, rule) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      
      if (!rule) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Promo pricing rule not found' });
      }
      
      // First delete associated location records
      db.run('DELETE FROM promo_pricing_locations WHERE promo_rule_id = ?', [ruleId], (locErr) => {
        if (locErr) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Error deleting location associations: ' + locErr.message });
        }
        
        // Then hard delete the promo pricing rule
        db.run('DELETE FROM promo_pricing_rules WHERE id = ?', [ruleId], function(deleteErr) {
          if (deleteErr) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Error deleting promo rule: ' + deleteErr.message });
          }
          
          if (this.changes === 0) {
            db.run('ROLLBACK');
            return res.status(404).json({ error: 'Promo pricing rule not found' });
          }
          
          db.run('COMMIT', (commitErr) => {
            if (commitErr) return res.status(500).json({ error: commitErr.message });
            
            logChange(req.user.id, 'promo_pricing_rules', ruleId, 'DELETE', rule, null, req);
            
            res.json({ message: 'Promo pricing rule permanently deleted' });
          });
        });
      });
    });
  });
});

// ====================================
// EXCHANGE PRICING TOOL DATA ENDPOINTS
// ====================================

// Get available regions from exchanges
router.get('/exchange-pricing/regions', authenticateToken, (req, res) => {
  db.all('SELECT DISTINCT region FROM exchanges WHERE region IS NOT NULL ORDER BY region', [], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    const regions = results.map(row => row.region);
    res.json(regions);
  });
});

// Get available currencies
router.get('/exchange-pricing/currencies', authenticateToken, (req, res) => {
  db.all('SELECT currency_code, CASE currency_code WHEN "USD" THEN "US Dollar" WHEN "EUR" THEN "Euro" WHEN "GBP" THEN "British Pound" WHEN "JPY" THEN "Japanese Yen" WHEN "AUD" THEN "Australian Dollar" WHEN "CAD" THEN "Canadian Dollar" ELSE currency_code END as currency_name FROM exchange_rates ORDER BY CASE currency_code WHEN "USD" THEN 0 ELSE 1 END, currency_code', [], (err, currencies) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(currencies);
  });
});

// Get exchanges for a specific region
router.get('/exchange-pricing/exchanges/:region', authenticateToken, (req, res) => {
  const { region } = req.params;
  
  db.all(
    'SELECT id, exchange_name, region, available FROM exchanges WHERE region = ? AND available = 1 ORDER BY exchange_name',
    [region],
    (err, exchanges) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(exchanges);
    }
  );
});

// Get feeds for a specific exchange
router.get('/exchange-pricing/feeds/:exchangeId', authenticateToken, (req, res) => {
  const { exchangeId } = req.params;
  
  db.all(
    'SELECT id, feed_name, quick_quote_min_cost, order_entry_cost, bandwidth_1ms FROM exchange_feeds WHERE exchange_id = ? ORDER BY feed_name',
    [exchangeId],
    (err, feeds) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(feeds);
    }
  );
});

// Get datacenters (locations) for a specific region
router.get('/exchange-pricing/datacenters/:region', authenticateToken, (req, res) => {
  const { region } = req.params;
  
  db.all(
    `SELECT lr.location_code, lr.datacenter_name, lr.region 
     FROM location_reference lr
     LEFT JOIN pop_capabilities pc ON lr.id = pc.location_id
     WHERE lr.region = ? AND COALESCE(pc.exchange_pricing_in_region, 0) = 1 
     ORDER BY lr.datacenter_name`,
    [region],
    (err, datacenters) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(datacenters);
    }
  );
});

// Create new quote request
router.post('/exchange-pricing/quotes', authenticateToken, (req, res) => {
  const {
    customer_name, region, exchange_name, feed_name, desired_sell_price,
    currency_requested, order_entry_required, delivery_datacenter, 
    feed_id, exchange_id
  } = req.body;

  // Validate required fields
  if (!customer_name || !region || !exchange_name || !feed_name || 
      !desired_sell_price || !currency_requested || !delivery_datacenter || 
      order_entry_required === undefined || order_entry_required === null) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Get feed pricing data
  db.get(`
    SELECT ef.quick_quote_min_cost, ef.order_entry_cost, ef.isf_a, ef.isf_b, 
           ef.bandwidth_1ms, ef.order_entry_isf, ef.pass_through_fees, e.exchange_name, e.region
    FROM exchange_feeds ef
    INNER JOIN exchanges e ON ef.exchange_id = e.id
    WHERE ef.id = ? AND ef.exchange_id = ? AND ef.quick_quote = 1
  `, [feed_id, exchange_id], (err, feed) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!feed) return res.status(404).json({ error: 'Feed not found or Quick Quote not enabled' });

    // Get exchange rate for currency conversion
    db.get(`
      SELECT exchange_rate FROM exchange_rates WHERE currency_code = ?
    `, [currency_requested], (err, rate) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rate) return res.status(400).json({ error: 'Invalid currency selected' });

      // Convert desired sell price to USD
      const desiredSellPriceUSD = parseFloat(desired_sell_price) / parseFloat(rate.exchange_rate);
      
      // Check if price meets minimum
      const feedMinCost = parseFloat(feed.quick_quote_min_cost);
      const isApproved = desiredSellPriceUSD >= feedMinCost;
      const priceDifference = desiredSellPriceUSD - feedMinCost;

      // Get user's full name for requestor
      db.get('SELECT full_name FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });

        // Insert quote request
        db.run(`
          INSERT INTO quote_requests (
            requestor_name, customer_name, region, exchange_name, feed_name,
            desired_sell_price, currency_requested, desired_sell_price_usd,
            order_entry_required, delivery_datacenter, feed_min_cost, order_entry_cost,
            is_approved, price_difference, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          user ? user.full_name : 'Unknown User',
          customer_name, region, exchange_name, feed_name,
          parseFloat(desired_sell_price), currency_requested, desiredSellPriceUSD,
          order_entry_required ? 1 : 0, delivery_datacenter, feedMinCost,
          feed.order_entry_cost ? parseFloat(feed.order_entry_cost) : null,
          isApproved ? 1 : 0, priceDifference, req.user.id
        ], function(err) {
          if (err) return res.status(500).json({ error: err.message });

          const quoteResult = {
            quote_id: this.lastID,
            requestor_name: user ? user.full_name : 'Unknown User',
            customer_name,
            region,
            exchange_name,
            feed_name,
            desired_sell_price: parseFloat(desired_sell_price),
            currency_requested,
            desired_sell_price_usd: desiredSellPriceUSD,
            order_entry_required: order_entry_required ? true : false,
            delivery_datacenter,
            feed_min_cost: feedMinCost,
            order_entry_cost: feed.order_entry_cost ? parseFloat(feed.order_entry_cost) : null,
            is_approved: isApproved,
            price_difference: priceDifference,
            approval_status: isApproved ? 'Approved' : 'Price too Low - Not Approved',
            // Additional feed data
            isf_a: feed.isf_a || null,
            isf_b: feed.isf_b || null,
            bandwidth: feed.bandwidth_1ms || null,
            order_entry_isf: feed.order_entry_isf || null,
            pass_through_fees: feed.pass_through_fees || 0,
            // Exchange rate for currency conversion
            exchange_rate: parseFloat(rate.exchange_rate)
          };

          // Log the exchange pricing quote with enhanced details
          db.run(
            'INSERT INTO audit_logs (action_type, user_id, user_name, parameters, pricing_data, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              'EXCHANGE_PRICING_QUOTE',
              req.user?.id || null,
              req.user?.username || 'Unknown User',
              JSON.stringify({
                customer_name,
                region,
                exchange_name,
                feed_name,
                desired_sell_price: parseFloat(desired_sell_price),
                currency_requested,
                order_entry_required,
                delivery_datacenter,
                feed_id,
                exchange_id,
                timestamp: new Date().toISOString()
              }),
              JSON.stringify({
                inputParameters: {
                  customer_name,
                  region,
                  exchange_name,
                  feed_name,
                  desired_sell_price: parseFloat(desired_sell_price),
                  currency_requested,
                  order_entry_required,
                  delivery_datacenter
                },
                calculationResults: {
                  quote_id: this.lastID,
                  desired_sell_price_usd: desiredSellPriceUSD,
                  feed_min_cost: feedMinCost,
                  price_difference: priceDifference,
                  is_approved: isApproved,
                  approval_status: isApproved ? 'Approved' : 'Price too Low - Not Approved'
                },
                feedData: {
                  isf_a: feed.isf_a,
                  isf_b: feed.isf_b,
                  bandwidth: feed.bandwidth_1ms,
                  order_entry_isf: feed.order_entry_isf,
                  pass_through_fees: feed.pass_through_fees,
                  order_entry_cost: feed.order_entry_cost
                },
                exchangeRate: parseFloat(rate.exchange_rate)
              }),
              req.ip || req.connection?.remoteAddress || 'unknown',
              req.get('User-Agent') || 'unknown'
            ],
            function(logErr) {
              if (logErr) console.error('Failed to log exchange pricing quote:', logErr);
            }
          );

          // Return quote results
          res.json(quoteResult);
        });
      });
    });
  });
});

// Get quote requests history
router.get('/exchange-pricing/quotes', authenticateToken, (req, res) => {
  const { page = 1, limit = 50, search = '' } = req.query;
  const offset = (page - 1) * limit;
  
  let whereClause = 'WHERE 1=1';
  let params = [];
  
  if (search) {
    whereClause += ` AND (customer_name LIKE ? OR exchange_name LIKE ? OR feed_name LIKE ? OR requestor_name LIKE ?)`;
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }
  
  db.all(`
    SELECT * FROM quote_requests 
    ${whereClause}
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `, [...params, parseInt(limit), parseInt(offset)], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Get total count for pagination
    db.get(`SELECT COUNT(*) as total FROM quote_requests ${whereClause}`, params, (err, count) => {
      if (err) return res.status(500).json({ error: err.message });
      
      res.json({
        quotes: rows,
        totalCount: count.total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count.total / limit)
      });
    });
  });
});

// Get exchange pricing audit logs
router.get('/exchange-pricing/audit_logs', authenticateToken, authorizeModulePermission('exchange_data', 'read_only'), (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  
  // Check user's permission level to determine filtering
  getUserModulePermissions(req.user.id, (err, permissions) => {
    if (err) {
      console.error('Error checking permissions:', err);
      return res.status(500).json({ error: 'Permission check failed' });
    }
    
    const userPermission = permissions['exchange_data'];
    const isReadOnly = userPermission === 'read_only';
    
    let query = 'SELECT * FROM audit_logs WHERE action_type = ?';
    let params = ['EXCHANGE_PRICING_QUOTE'];
    
    // Read-only users can only see their own logs
    if (isReadOnly) {
      query += ' AND user_id = ?';
      params.push(req.user.id);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const logs = rows.map(row => ({
        ...row,
        parameters: row.parameters ? JSON.parse(row.parameters) : null,
        pricing_data: row.pricing_data ? JSON.parse(row.pricing_data) : null
      }));
      res.json(logs);
    });
  });
});

// Clear exchange pricing audit logs (Admin only)
router.delete('/exchange-pricing/audit_logs', authenticateToken, authorizeRole('administrator'), (req, res) => {
  db.run('DELETE FROM audit_logs WHERE action_type = ?', ['EXCHANGE_PRICING_QUOTE'], function(err) {
    if (err) {
      console.error('Error clearing exchange pricing audit logs:', err);
      return res.status(500).json({ error: 'Failed to clear exchange pricing audit logs' });
    }
    
    // Log the clear action
    logChange(null, 'audit_logs', null, 'CLEAR_EXCHANGE_PRICING', null, { 
      cleared_count: this.changes,
      action: 'Clear exchange pricing audit logs'
    }, req);
    
    res.json({ 
      message: 'Exchange pricing audit logs cleared successfully',
      cleared_count: this.changes
    });
  });
});

// Clear exchange pricing quote history (Admin only)
router.delete('/exchange-pricing/quotes/clear', authenticateToken, authorizeRole('administrator'), (req, res) => {
  db.run('DELETE FROM quote_requests', [], function(err) {
    if (err) {
      console.error('Error clearing quote history:', err);
      return res.status(500).json({ error: 'Failed to clear quote history' });
    }
    
    // Log the clear action
    logChange(null, 'quote_requests', null, 'CLEAR_ALL_QUOTES', null, { 
      cleared_count: this.changes,
      action: 'Clear all exchange pricing quote history'
    }, req);
    
    res.json({ 
      message: 'Quote history cleared successfully',
      cleared_count: this.changes
    });
  });
});

// Export exchange pricing audit logs to CSV (Admin only)
router.get('/exchange-pricing/audit_logs/export', authenticateToken, authorizeRole('administrator'), (req, res) => {
  db.all('SELECT * FROM audit_logs WHERE action_type = ? ORDER BY timestamp DESC', ['EXCHANGE_PRICING_QUOTE'], (err, rows) => {
    if (err) {
      console.error('Error exporting exchange pricing audit logs:', err);
      return res.status(500).json({ error: 'Failed to export exchange pricing audit logs' });
    }
    
    // Convert to CSV format
    const csvHeaders = 'ID,Action Type,User ID,User Name,Timestamp,Customer Name,Exchange,Feed,Desired Price,Currency,Approved,Price Difference,IP Address\n';
    const csvRows = rows.map(row => {
      const escapeCsv = (str) => {
        if (str === null || str === undefined) return '';
        return `"${String(str).replace(/"/g, '""')}"`;
      };
      
      const params = row.parameters ? JSON.parse(row.parameters) : {};
      const pricingData = row.pricing_data ? JSON.parse(row.pricing_data) : {};
      
      return [
        row.id,
        escapeCsv(row.action_type),
        row.user_id || '',
        escapeCsv(row.user_name),
        escapeCsv(row.timestamp),
        escapeCsv(params.customer_name),
        escapeCsv(params.exchange_name),
        escapeCsv(params.feed_name),
        params.desired_sell_price || '',
        escapeCsv(params.currency_requested),
        pricingData.calculationResults?.is_approved ? 'Yes' : 'No',
        pricingData.calculationResults?.price_difference || '',
        escapeCsv(row.ip_address)
      ].join(',');
    });
    
    const csvContent = csvHeaders + csvRows.join('\n');
    
    // Log the export action
    logChange(null, 'audit_logs', null, 'EXPORT_EXCHANGE_PRICING', null, { 
      exported_count: rows.length,
      action: 'Export exchange pricing audit logs to CSV'
    }, req);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="exchange_pricing_logs_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  });
});

// ========================================
// ADMIN: LIVE LATENCY API MANAGEMENT
// ========================================

// Get dashboard overview
router.get('/admin/live-latency/overview', authenticateToken, authorizeRole(['administrator']), async (req, res) => {
  try {
    const latencyService = new LiveLatencyService();
    
    // Get overall statistics
    const stats = await Promise.all([
      // Total circuits with configurations
      new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as total FROM live_latency_config', [], (err, row) => {
          if (err) reject(err);
          else resolve(row.total);
        });
      }),
      
      // Active configurations
      new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as active FROM live_latency_config WHERE enabled = 1 AND (disabled_until IS NULL OR disabled_until < CURRENT_TIMESTAMP)', [], (err, row) => {
          if (err) reject(err);
          else resolve(row.active);
        });
      }),
      
      // Failed configurations
      new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as failed FROM live_latency_config WHERE failure_count >= 3', [], (err, row) => {
          if (err) reject(err);
          else resolve(row.failed);
        });
      }),
      
      // Last successful refresh
      new Promise((resolve, reject) => {
        db.get('SELECT MAX(last_successful_update) as last_success FROM live_latency_config', [], (err, row) => {
          if (err) reject(err);
          else resolve(row.last_success);
        });
      }),
      
      // Recent API call success rate
      new Promise((resolve, reject) => {
        db.get(`
          SELECT 
            COUNT(*) as total_calls,
            SUM(CASE WHEN response_status BETWEEN 200 AND 299 THEN 1 ELSE 0 END) as successful_calls
          FROM live_latency_api_logs 
          WHERE created_at > datetime('now', '-24 hours')
        `, [], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      }),
      
      // Check global cooldown status
      latencyService.isGlobalRefreshOnCooldown()
    ]);

    const [totalConfigs, activeConfigs, failedConfigs, lastSuccess, apiStats, onCooldown] = stats;
    const successRate = apiStats.total_calls > 0 ? Math.round((apiStats.successful_calls / apiStats.total_calls) * 100) : 0;

    res.json({
      success: true,
      data: {
        total_configurations: totalConfigs,
        active_configurations: activeConfigs,
        failed_configurations: failedConfigs,
        disabled_configurations: totalConfigs - activeConfigs,
        last_successful_update: lastSuccess,
        api_success_rate_24h: successRate,
        total_api_calls_24h: apiStats.total_calls,
        global_refresh_on_cooldown: onCooldown,
        system_status: failedConfigs > (totalConfigs * 0.5) ? 'degraded' : 'healthy'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting live latency overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load overview data',
      message: error.message
    });
  }
});

// Get all circuit configurations
router.get('/admin/live-latency/configurations', authenticateToken, authorizeRole(['administrator']), (req, res) => {
  const query = `
    SELECT 
      lc.*,
      nr.circuit_id as route_exists,
      u1.username as created_by_username,
      u2.username as updated_by_username
    FROM live_latency_config lc
    LEFT JOIN network_routes nr ON lc.circuit_id = nr.circuit_id
    LEFT JOIN users u1 ON lc.created_by = u1.id
    LEFT JOIN users u2 ON lc.updated_by = u2.id
    ORDER BY lc.circuit_id
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching configurations:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch configurations'
      });
    }
    
    // Remove encrypted passwords from response
    const configurations = rows.map(row => ({
      ...row,
      auth_password_encrypted: undefined,
      has_password: !!row.auth_password_encrypted
    }));
    
    res.json({
      success: true,
      data: configurations,
      count: configurations.length
    });
  });
});

// Get specific circuit configuration
router.get('/admin/live-latency/configurations/:circuitId', authenticateToken, authorizeRole(['administrator']), (req, res) => {
  const { circuitId } = req.params;
  
  const query = `
    SELECT 
      lc.*,
      nr.circuit_id as route_exists,
      u1.username as created_by_username,
      u2.username as updated_by_username
    FROM live_latency_config lc
    LEFT JOIN network_routes nr ON lc.circuit_id = nr.circuit_id
    LEFT JOIN users u1 ON lc.created_by = u1.id
    LEFT JOIN users u2 ON lc.updated_by = u2.id
    WHERE lc.circuit_id = ?
  `;
  
  db.get(query, [circuitId], (err, row) => {
    if (err) {
      console.error('Error fetching configuration:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch configuration'
      });
    }
    
    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }
    
    // Remove encrypted password from response
    const configuration = {
      ...row,
      auth_password_encrypted: undefined,
      has_password: !!row.auth_password_encrypted
    };
    
    res.json({
      success: true,
      data: configuration
    });
  });
});

// Create new circuit configuration
router.post('/admin/live-latency/configurations', authenticateToken, authorizeRole(['administrator']), async (req, res) => {
  try {
    const {
      circuit_id,
      enabled = true,
      api_base_url,
      api_instance_name,
      api_indicator = 'AnyVendor - Response Time (ms) - BPI',
      api_parameters,
      auth_username,
      auth_password,
      update_interval_minutes = 15
    } = req.body;

    // Validate required fields
    if (!circuit_id || !api_base_url || !api_instance_name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: circuit_id, api_base_url, api_instance_name'
      });
    }

    // Validate circuit_id format
    if (!isValidCircuitId(circuit_id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid circuit ID format. Must be 6 uppercase letters followed by 6 digits.'
      });
    }

    // Check if circuit exists in network_routes
    const routeExists = await new Promise((resolve, reject) => {
      db.get('SELECT circuit_id FROM network_routes WHERE circuit_id = ?', [circuit_id], (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      });
    });

    if (!routeExists) {
      return res.status(400).json({
        success: false,
        error: 'Circuit ID not found in network routes database'
      });
    }

    // Encrypt password if provided
    let encryptedPassword = null;
    if (auth_password) {
      const latencyService = new LiveLatencyService();
      encryptedPassword = latencyService.encryptPassword(auth_password);
    }

    // Insert configuration
    db.run(
      `INSERT INTO live_latency_config 
       (circuit_id, enabled, api_base_url, api_instance_name, api_indicator, 
        api_parameters, auth_username, auth_password_encrypted, update_interval_minutes,
        created_by, updated_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        circuit_id, enabled, api_base_url, api_instance_name, api_indicator,
        api_parameters, auth_username, encryptedPassword, update_interval_minutes,
        req.user.id, req.user.id
      ],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({
              success: false,
              error: 'Configuration already exists for this circuit'
            });
          }
          console.error('Error creating configuration:', err);
          return res.status(500).json({
            success: false,
            error: 'Failed to create configuration'
          });
        }

        // Log the change
        logChange(req.user.id, 'live_latency_config', this.lastID, 'CREATE', null, {
          circuit_id,
          enabled,
          api_base_url,
          api_instance_name
        }, req);

        res.status(201).json({
          success: true,
          message: 'Configuration created successfully',
          data: {
            id: this.lastID,
            circuit_id
          }
        });
      }
    );

  } catch (error) {
    console.error('Error creating configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create configuration',
      message: error.message
    });
  }
});

// Update circuit configuration
router.put('/admin/live-latency/configurations/:configId', authenticateToken, authorizeRole(['administrator']), async (req, res) => {
  try {
    const { configId } = req.params;
    const {
      enabled,
      api_base_url,
      api_instance_name,
      api_indicator,
      api_parameters,
      auth_username,
      auth_password,
      update_interval_minutes
    } = req.body;

    // Get existing configuration for logging
    const existingConfig = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM live_latency_config WHERE id = ?', [configId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(enabled);
    }
    if (api_base_url) {
      updates.push('api_base_url = ?');
      values.push(api_base_url);
    }
    if (api_instance_name) {
      updates.push('api_instance_name = ?');
      values.push(api_instance_name);
    }
    if (api_indicator) {
      updates.push('api_indicator = ?');
      values.push(api_indicator);
    }
    if (api_parameters !== undefined) {
      updates.push('api_parameters = ?');
      values.push(api_parameters);
    }
    if (auth_username !== undefined) {
      updates.push('auth_username = ?');
      values.push(auth_username);
    }
    if (auth_password) {
      const latencyService = new LiveLatencyService();
      const encryptedPassword = latencyService.encryptPassword(auth_password);
      updates.push('auth_password_encrypted = ?');
      values.push(encryptedPassword);
    }
    if (update_interval_minutes) {
      updates.push('update_interval_minutes = ?');
      values.push(update_interval_minutes);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    // Add updated_by and updated_at
    updates.push('updated_by = ?', 'updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.id, configId);

    const query = `UPDATE live_latency_config SET ${updates.join(', ')} WHERE id = ?`;

    db.run(query, values, function(err) {
      if (err) {
        console.error('Error updating configuration:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to update configuration'
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found'
        });
      }

      // Log the change
      logChange(req.user.id, 'live_latency_config', configId, 'UPDATE', existingConfig, req.body, req);

      res.json({
        success: true,
        message: 'Configuration updated successfully'
      });
    });

  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration',
      message: error.message
    });
  }
});

// Delete circuit configuration
router.delete('/admin/live-latency/configurations/:configId', authenticateToken, authorizeRole(['administrator']), (req, res) => {
  const { configId } = req.params;

  // Get existing configuration for logging
  db.get('SELECT * FROM live_latency_config WHERE id = ?', [configId], (err, existingConfig) => {
    if (err) {
      console.error('Error fetching configuration for deletion:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch configuration'
      });
    }

    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    // Delete the configuration
    db.run('DELETE FROM live_latency_config WHERE id = ?', [configId], function(err) {
      if (err) {
        console.error('Error deleting configuration:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to delete configuration'
        });
      }

      // Log the change
      logChange(req.user.id, 'live_latency_config', configId, 'DELETE', existingConfig, null, req);

      res.json({
        success: true,
        message: 'Configuration deleted successfully'
      });
    });
  });
});

// Test connection for specific circuit
router.post('/admin/live-latency/test/:circuitId', authenticateToken, authorizeRole(['administrator']), async (req, res) => {
  try {
    const { circuitId } = req.params;
    const latencyService = new LiveLatencyService();

    console.log(`🧪 Connection test requested for ${circuitId} by admin: ${req.user?.username}`);

    const result = await latencyService.testCircuitConnection(circuitId, req.user.id);

    if (result.success) {
      res.json({
        success: true,
        message: `Connection test successful for circuit ${circuitId}`,
        data: {
          circuit_id: result.circuit_id,
          latency_ms: result.latency_ms,
          response_time_ms: result.response_time_ms,
          data_points: result.data_points,
          quality_score: result.quality_score,
          timestamp: result.timestamp
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Connection test failed for circuit ${circuitId}`,
        error: result.error,
        data: {
          circuit_id: result.circuit_id,
          response_time_ms: result.response_time_ms,
          failure_count: result.failure_count,
          auto_disabled: result.auto_disabled,
          timestamp: result.timestamp
        }
      });
    }

  } catch (error) {
    console.error(`Error testing connection for ${req.params.circuitId}:`, error);
    
    // Return structured error without crashing
    res.status(500).json({
      success: false,
      error: 'Internal server error during connection test',
      message: error.message || 'Unknown error occurred',
      data: {
        circuit_id: req.params.circuitId,
        timestamp: new Date().toISOString()
      },
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get API call logs for circuit
router.get('/admin/live-latency/logs/:circuitId', authenticateToken, authorizeRole(['administrator']), (req, res) => {
  const { circuitId } = req.params;
  const { limit = 50 } = req.query;

  const query = `
    SELECT 
      lal.*,
      u.username as requested_by_username
    FROM live_latency_api_logs lal
    LEFT JOIN users u ON lal.requested_by = u.id
    WHERE lal.circuit_id = ?
    ORDER BY lal.created_at DESC
    LIMIT ?
  `;

  db.all(query, [circuitId, limit], (err, rows) => {
    if (err) {
      console.error('Error fetching API logs:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch API logs'
      });
    }

    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  });
});

// Update existing refresh endpoint to use new service
router.post('/api/live-latency/refresh-all', authenticateToken, authorizeModulePermission('network_routes', 'read_only'), async (req, res) => {
  try {
    const latencyService = new LiveLatencyService();
    console.log(`🔄 Manual live latency refresh requested by user: ${req.user?.username}`);
    
    const results = await latencyService.refreshAllCircuits(req.user.id);
    
    res.json({
      success: true,
      message: `Live latency refresh completed. Updated ${results.updated} of ${results.total} circuits.`,
      updated: results.updated,
      total: results.total,
      processed: results.processed,
      failed: results.failed,
      errors: results.errors.length,
      duration_ms: results.duration,
      timestamp: new Date().toISOString(),
      error_details: results.errors.length > 0 ? results.errors.slice(0, 5) : undefined
    });
    
  } catch (error) {
    console.error('❌ Live latency refresh failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh live latency data',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router; 