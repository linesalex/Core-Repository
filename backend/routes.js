const express = require('express');
const db = require('./db');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Parser } = require('json2csv');
const archiver = require('archiver');
const csv = require('csv-parser');
const { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  authenticateToken, 
  authorizeRole, 
  authorizePermission, 
  getUserPermissions, 
  getUserPermissionsWithVisibility,
  logUserActivity 
} = require('./auth');
const { 
  handleDatabaseError, 
  createSuccessResponse, 
  createPaginatedResponse 
} = require('./dbErrorHandler');

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
    [userId, tableName, safeRecordId, action, JSON.stringify(oldValues), JSON.stringify(newValues), changesSummary, ipAddress, userAgent],
    function(err) {
      if (err) {
        console.error('Failed to log change:', err.message);
        console.error('logChange parameters:', { userId, tableName, recordId: safeRecordId, action });
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
      
      // Update last login
      db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      
      // Generate token
      const token = generateToken(user);
      
      // Get user permissions (fallback to old method for now)
      getUserPermissions(user.id, (err, permissions) => {
        if (err) {
          console.error('Error getting permissions:', err);
          return res.status(500).json({ error: 'Failed to get permissions' });
        }
        
        // Try to get visibility settings, but don't fail if table doesn't exist
        db.all(
          'SELECT module_name, is_visible FROM user_module_visibility WHERE user_id = ?',
          [user.id],
          (visErr, visibilitySettings) => {
            let moduleVisibility = {};
            
            if (!visErr && visibilitySettings) {
              // Build visibility map
              Object.keys(permissions).forEach(module => {
                moduleVisibility[module] = true; // Default to visible
              });
              
              visibilitySettings.forEach(vis => {
                moduleVisibility[vis.module_name] = !!vis.is_visible;
              });
            } else {
              // If visibility table doesn't exist or error, default all to visible
              Object.keys(permissions).forEach(module => {
                moduleVisibility[module] = true;
              });
            }
            
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
              permissions,
              moduleVisibility
            });
          }
        );
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user info
router.get('/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, full_name, user_role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    getUserPermissions(user.id, (err, permissions) => {
      if (err) return res.status(500).json({ error: 'Failed to get permissions' });
      
      // Try to get visibility settings, but don't fail if table doesn't exist
      db.all(
        'SELECT module_name, is_visible FROM user_module_visibility WHERE user_id = ?',
        [user.id],
        (visErr, visibilitySettings) => {
          let moduleVisibility = {};
          
          if (!visErr && visibilitySettings) {
            // Build visibility map
            Object.keys(permissions).forEach(module => {
              moduleVisibility[module] = true; // Default to visible
            });
            
            visibilitySettings.forEach(vis => {
              moduleVisibility[vis.module_name] = !!vis.is_visible;
            });
          } else {
            // If visibility table doesn't exist or error, default all to visible
            Object.keys(permissions).forEach(module => {
              moduleVisibility[module] = true;
            });
          }
          
          res.json({
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              full_name: user.full_name,
              role: user.user_role
            },
            permissions,
            moduleVisibility
          });
        }
      );
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

// ====================================
// USER MANAGEMENT ENDPOINTS
// ====================================

// Get all users (admin only)
router.get('/users', authenticateToken, authorizePermission('user_management', 'view'), (req, res) => {
  db.all('SELECT id, username, email, full_name, user_role, status, created_at, last_login FROM users ORDER BY username', [], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(users);
  });
});

// Create user (admin only)
router.post('/users', authenticateToken, authorizePermission('user_management', 'create'), (req, res) => {
  const { username, password, email, full_name, user_role } = req.body;

  if (!username || !password || !user_role) {
    return res.status(400).json({ error: 'Username, password, and role are required' });
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
      const hashedPassword = await hashPassword(password);
      db.run(
        'INSERT INTO users (username, password_hash, email, full_name, user_role) VALUES (?, ?, ?, ?, ?)',
        [trimmedUsername, hashedPassword, email || null, full_name || null, user_role],
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
            logChange(req.user?.id || null, 'users', logRecordId, 'CREATE', null, { username: trimmedUsername, email, full_name, user_role }, req);
          } catch (logError) {
            console.error('Failed to log user creation:', logError);
          }
          
          res.status(201).json({ id: recordId, username: trimmedUsername, message: 'User created successfully' });
        }
      );
    } catch (error) {
      console.error('Error hashing password:', error);
      res.status(500).json({ error: 'User creation failed due to a server error.' });
    }
  });
});

// Update user (admin only)
router.put('/users/:id', authenticateToken, authorizePermission('user_management', 'edit'), (req, res) => {
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
router.delete('/users/:id', authenticateToken, authorizePermission('user_management', 'delete'), (req, res) => {
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

// ====================================
// USER MODULE VISIBILITY ENDPOINTS
// ====================================

// Get user module visibility settings (admin only)
router.get('/users/:id/module-visibility', authenticateToken, authorizePermission('user_management', 'view'), (req, res) => {
  const userId = req.params.id;
  
  db.all(
    'SELECT module_name, is_visible FROM user_module_visibility WHERE user_id = ?',
    [userId],
    (err, visibility) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Convert to object format
      const visibilityMap = {};
      visibility.forEach(v => {
        visibilityMap[v.module_name] = !!v.is_visible;
      });
      
      res.json(visibilityMap);
    }
  );
});

// Update user module visibility (admin only)
router.put('/users/:id/module-visibility', authenticateToken, authorizePermission('user_management', 'edit'), (req, res) => {
  const userId = req.params.id;
  const visibilitySettings = req.body; // { module_name: boolean, ... }
  
  // Start transaction-like behavior by collecting all operations
  const operations = [];
  
  Object.entries(visibilitySettings).forEach(([moduleName, isVisible]) => {
    operations.push(new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO user_module_visibility 
         (user_id, module_name, is_visible, updated_by, updated_at) 
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [userId, moduleName, isVisible ? 1 : 0, req.user.id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    }));
  });
  
  Promise.all(operations)
    .then(() => {
      // Log the change
      logChange(req.user.id, 'user_module_visibility', userId, 'UPDATE', null, visibilitySettings, req);
      res.json({ message: 'Module visibility updated successfully' });
    })
    .catch(err => {
      console.error('Error updating module visibility:', err);
      res.status(500).json({ error: 'Failed to update module visibility' });
    });
});

// ====================================
// CHANGE LOGS ENDPOINTS
// ====================================

// Get change logs (admin and provisioner can view)
router.get('/change-logs', authenticateToken, authorizePermission('change_logs', 'view'), (req, res) => {
  const { table_name, table_names, user_id, search, limit = 100, offset = 0 } = req.query;
  
  let query = `
    SELECT cl.*, u.username, u.full_name 
    FROM change_logs cl 
    LEFT JOIN users u ON cl.user_id = u.id
  `;
  let params = [];
  let conditions = [];
  
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
  
  if (user_id) {
    conditions.push('cl.user_id = ?');
    params.push(user_id);
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
router.get('/carriers', authenticateToken, authorizePermission('carriers', 'view'), (req, res) => {
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
router.post('/carriers', authenticateToken, authorizePermission('carriers', 'create'), (req, res) => {
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
router.put('/carriers/:id', authenticateToken, authorizePermission('carriers', 'edit'), (req, res) => {
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
        
        logChange(req.user.id, 'carriers', oldCarrier.carrier_name, 'UPDATE', oldCarrier, { carrier_name, previously_known_as, status, region }, req);
        
        res.json({ message: 'Carrier updated successfully' });
      }
    );
  });
});

// Delete carrier
router.delete('/carriers/:id', authenticateToken, authorizePermission('carriers', 'delete'), (req, res) => {
  const carrierId = req.params.id;
  
  // Check if carrier has contacts
  db.get('SELECT COUNT(*) as count FROM carrier_contacts WHERE carrier_id = ?', [carrierId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (result.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete carrier with existing contacts. Please delete all contacts first.' 
      });
    }
    
    // Get carrier data for change logging
    db.get('SELECT * FROM carriers WHERE id = ?', [carrierId], (err, carrier) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!carrier) return res.status(404).json({ error: 'Carrier not found' });
      
      db.run('DELETE FROM carriers WHERE id = ?', [carrierId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Carrier not found' });
        
        logChange(req.user.id, 'carriers', carrier.carrier_name, 'DELETE', carrier, null, req);
        
        res.json({ message: 'Carrier deleted successfully' });
      });
    });
  });
});

// ====================================
// CARRIER CONTACTS ENDPOINTS
// ====================================

// Get all contacts for a carrier
router.get('/carriers/:id/contacts', authenticateToken, authorizePermission('carriers', 'view'), (req, res) => {
  const carrierId = req.params.id;
  db.all('SELECT * FROM carrier_contacts WHERE carrier_id = ? ORDER BY contact_name', [carrierId], (err, contacts) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(contacts);
  });
});

// Create carrier contact
router.post('/carriers/:id/contacts', authenticateToken, authorizePermission('carriers', 'create'), (req, res) => {
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
router.put('/carriers/:id/contacts/:contactId', authenticateToken, authorizePermission('carriers', 'edit'), (req, res) => {
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
router.delete('/carriers/:id/contacts/:contactId', authenticateToken, authorizePermission('carriers', 'delete'), (req, res) => {
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
router.get('/carriers/overdue-contacts', authenticateToken, authorizePermission('carriers', 'view'), (req, res) => {
  // Only admin and provisioner can see overdue contacts
  if (req.user.role !== 'administrator' && req.user.role !== 'provisioner') {
    return res.status(403).json({ error: 'Admin or Provisioner access required' });
  }
  
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
router.post('/carriers/:id/contacts/:contactId/approve', authenticateToken, authorizePermission('carriers', 'edit'), (req, res) => {
  // Only admin and provisioner can approve updates
  if (req.user.role !== 'administrator' && req.user.role !== 'provisioner') {
    return res.status(403).json({ error: 'Admin or Provisioner access required' });
  }
  
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

// Get core outages (routes with live_latency = 0)
router.get('/core_outages', (req, res) => {
  db.all('SELECT * FROM network_routes WHERE live_latency = 0 ORDER BY circuit_id', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/repository_types', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO repository_types (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name, description });
  });
});

// Live Latency API endpoint (placeholder for external data source)
router.get('/live_latency/:circuit_id', (req, res) => {
  const { circuit_id } = req.params;
  
  // Simulate external API call - in production this would call an actual monitoring API
  // For now, return simulated data with some random variation
  const baseLatency = 45; // Base latency in ms
  const variation = (Math.random() - 0.5) * 10; // Random variation ±5ms
  const liveLatency = Math.round((baseLatency + variation) * 10) / 10; // Round to 1 decimal
  
  // Simulate API response time
  setTimeout(() => {
    res.json({
      circuit_id,
      live_latency: liveLatency,
      timestamp: new Date().toISOString(),
      source: 'Network Monitoring API (Simulated)'
    });
  }, 200); // Simulate 200ms API response time
});

// Batch live latency for multiple circuits
router.post('/live_latency/batch', (req, res) => {
  const { circuit_ids } = req.body;
  
  if (!circuit_ids || !Array.isArray(circuit_ids)) {
    return res.status(400).json({ error: 'circuit_ids array is required' });
  }
  
  // Simulate batch API call
  const results = circuit_ids.map(circuit_id => {
    const baseLatency = 45;
    const variation = (Math.random() - 0.5) * 10;
    const liveLatency = Math.round((baseLatency + variation) * 10) / 10;
    
    return {
      circuit_id,
      live_latency: liveLatency,
      timestamp: new Date().toISOString()
    };
  });
  
  setTimeout(() => {
    res.json({
      results,
      source: 'Network Monitoring API (Simulated)',
      total: results.length
    });
  }, 300); // Simulate 300ms batch API response time
});

// Get all routes
router.get('/network_routes', authenticateToken, authorizePermission('network_routes', 'view'), (req, res) => {
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
router.get('/network_routes/:circuit_id', authenticateToken, authorizePermission('network_routes', 'view'), (req, res) => {
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

// Create new route  
router.post('/network_routes', authenticateToken, authorizePermission('network_routes', 'create'), (req, res) => {
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
      'circuit_id','repository_type_id','outage_tickets_last_30d','maintenance_tickets_last_30d','kmz_file_path','live_latency','expected_latency','test_results_link','cable_system','is_special','underlying_carrier','cost','currency','location_a','location_b','bandwidth','more_details','mtu','sla_latency','capacity_usage_percent','local_loop_carriers_a','local_loop_carriers_b','equipment_type'
    ];
    const placeholders = fields.map(() => '?').join(',');
    const values = fields.map(f => data[f] ?? (f === 'repository_type_id' ? 1 : null));
    db.run(
      `INSERT INTO network_routes (${fields.join(',')}) VALUES (${placeholders})`,
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
router.put('/network_routes/:circuit_id', authenticateToken, authorizePermission('network_routes', 'edit'), (req, res) => {
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
          'repository_type_id','outage_tickets_last_30d','maintenance_tickets_last_30d','kmz_file_path','live_latency','expected_latency','test_results_link','cable_system','is_special','underlying_carrier','cost','currency','location_a','location_b','bandwidth','more_details','mtu','sla_latency','capacity_usage_percent','local_loop_carriers_a','local_loop_carriers_b','equipment_type'
        ];
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => data[f] ?? null);
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

// Delete route
router.delete('/network_routes/:circuit_id', authenticateToken, authorizePermission('network_routes', 'delete'), (req, res) => {
  const { circuit_id } = req.params;
  
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

// Upload KMZ file and update kmz_file_path for a circuit_id
router.post('/network_routes/:circuit_id/upload_kmz', authenticateToken, authorizePermission('network_routes', 'edit'), upload.single('kmz_file'), (req, res) => {
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

// Export network_routes as CSV
router.get('/network_routes_export', authenticateToken, authorizePermission('network_routes', 'view'), (req, res) => {
  db.all('SELECT circuit_id, outage_tickets_last_30d, maintenance_tickets_last_30d, kmz_file_path, live_latency, expected_latency, test_results_link, cable_system, is_special, underlying_carrier, location_a, location_b, bandwidth, more_details, mtu, sla_latency, capacity_usage_percent FROM network_routes', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const fields = ['circuit_id','outage_tickets_last_30d','maintenance_tickets_last_30d','kmz_file_path','live_latency','expected_latency','test_results_link','cable_system','is_special','underlying_carrier','location_a','location_b','bandwidth','more_details','mtu','sla_latency','capacity_usage_percent'];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);
    res.header('Content-Type', 'text/csv');
    res.attachment('network_routes.csv');
    res.send(csv);
  });
});

// Search/filter network_routes by query params (visible fields only)
router.get('/network_routes_search', authenticateToken, authorizePermission('network_routes', 'view'), (req, res) => {
  const allowedFields = ['circuit_id','outage_tickets_last_30d','maintenance_tickets_last_30d','kmz_file_path','live_latency','expected_latency','test_results_link','cable_system','is_special','underlying_carrier','location_a','location_b','bandwidth','more_details','mtu','sla_latency','capacity_usage_percent'];
  const filters = [];
  const values = [];
  
  // Check if we need to search DWDM UCNs in dark fiber details
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
      
      // Combine both queries with UNION
      const combinedQuery = `${mainQuery} UNION ${darkFiberQuery}`;
      const allValues = [...values, `%${searchTerm}%`];
      
      db.all(combinedQuery, allValues, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
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
router.post('/network_routes/:circuit_id/upload_test_results', authenticateToken, authorizePermission('network_routes', 'edit'), testResultsUpload.array('test_results_files', 10), (req, res) => {
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
router.get('/network_routes/:circuit_id/test_results_files', authenticateToken, authorizePermission('network_routes', 'view'), (req, res) => {
  const { circuit_id } = req.params;
  db.all('SELECT * FROM test_results_files WHERE circuit_id = ? ORDER BY uploaded_at DESC', [circuit_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Download Test Results files as ZIP
router.get('/network_routes/:circuit_id/download_test_results', authenticateToken, authorizePermission('network_routes', 'view'), (req, res) => {
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
router.delete('/test_results_files/:id', authenticateToken, authorizePermission('network_routes', 'edit'), (req, res) => {
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
router.get('/locations', authenticateToken, authorizePermission('locations', 'view'), (req, res) => {
  db.all('SELECT * FROM location_reference ORDER BY location_code', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Create location
router.post('/locations', authenticateToken, authorizePermission('locations', 'create'), (req, res) => {
  const { location_code, region, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info, 
          min_price_under_100mb, min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus } = req.body;
  
  if (!location_code || !city || !country) {
    return res.status(400).json({ error: 'Location code, city, and country are required' });
  }
  
  db.run(
    'INSERT INTO location_reference (location_code, region, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info, min_price_under_100mb, min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [location_code, region || 'AMERs', city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type || 'Tier 1', status || 'Active', provider, access_info, 
     min_price_under_100mb || 0, min_price_100_to_999mb || 0, min_price_1000_to_2999mb || 0, min_price_3000mb_plus || 0, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Capture lastID to avoid this context issues
      const recordId = this.lastID;
      
      // Use location_code as record ID if lastID is not available
      const logRecordId = recordId || location_code;
      
      // Log the change with proper error handling (don't block if logging fails)
      try {
        logChange(req.user.id, 'location_reference', logRecordId, 'CREATE', null, { 
          location_code, region, city, country, datacenter_name, datacenter_address, latitude, longitude, 
          time_zone, pop_type, status, provider, access_info, min_price_under_100mb, 
          min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus 
        }, req);
      } catch (logError) {
        console.error('Failed to log location creation:', logError);
      }
      
      res.status(201).json({ id: recordId, location_code });
    }
  );
});

// Update location
router.put('/locations/:id', authenticateToken, authorizePermission('locations', 'edit'), (req, res) => {
  const { region, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info,
          min_price_under_100mb, min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus } = req.body;
  const locationId = req.params.id;
  
  // Get current location data for change logging
  db.get('SELECT * FROM location_reference WHERE id = ?', [locationId], (err, oldLocation) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldLocation) return res.status(404).json({ error: 'Location not found' });
    
    db.run(
      'UPDATE location_reference SET region = ?, city = ?, country = ?, datacenter_name = ?, datacenter_address = ?, latitude = ?, longitude = ?, time_zone = ?, pop_type = ?, status = ?, provider = ?, access_info = ?, min_price_under_100mb = ?, min_price_100_to_999mb = ?, min_price_1000_to_2999mb = ?, min_price_3000mb_plus = ?, updated_by = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ?',
      [region, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info, 
       min_price_under_100mb, min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus, req.user.id, locationId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Location not found' });
        
        logChange(req.user.id, 'location_reference', oldLocation.location_code, 'UPDATE', oldLocation, { region, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info, min_price_under_100mb, min_price_100_to_999mb, min_price_1000_to_2999mb, min_price_3000mb_plus }, req);
        
        res.json({ message: 'Location updated' });
      }
    );
  });
});

// Delete location
router.delete('/locations/:id', authenticateToken, authorizePermission('locations', 'delete'), (req, res) => {
  const locationId = req.params.id;
  
  // Get location data for change logging
  db.get('SELECT * FROM location_reference WHERE id = ?', [locationId], (err, location) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!location) return res.status(404).json({ error: 'Location not found' });
    
    db.run('DELETE FROM location_reference WHERE id = ?', [locationId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Location not found' });
      
      logChange(req.user.id, 'location_reference', location.location_code, 'DELETE', location, null, req);
      
      res.json({ message: 'Location deleted' });
    });
  });
});

// Update minimum pricing for a location (admin only)
router.put('/locations/:id/minimum-pricing', authenticateToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ error: 'Admin access required' });
  }

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
router.get('/locations/:id/capabilities', authenticateToken, authorizePermission('locations', 'view'), (req, res) => {
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
router.post('/locations/:id/capabilities', authenticateToken, authorizePermission('locations', 'edit'), (req, res) => {
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
         csp_on_ramp = ?, exchange_on_ramp = ?, internet_on_ramp = ?, transport_only_pop = ?, cnx_colocation = ?,
         updated_by = ? WHERE location_id = ?`,
        [
          capabilities.cnx_extranet_wan, capabilities.cnx_ethernet, capabilities.cnx_voice, capabilities.tdm_gateway,
          capabilities.cnx_unigy, capabilities.cnx_alpha, capabilities.cnx_chrono, capabilities.cnx_sdwan,
          capabilities.csp_on_ramp, capabilities.exchange_on_ramp, capabilities.internet_on_ramp, capabilities.transport_only_pop, capabilities.cnx_colocation,
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
         cnx_unigy, cnx_alpha, cnx_chrono, cnx_sdwan, csp_on_ramp, exchange_on_ramp, internet_on_ramp, transport_only_pop, cnx_colocation, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          locationId, capabilities.cnx_extranet_wan, capabilities.cnx_ethernet, capabilities.cnx_voice, capabilities.tdm_gateway,
          capabilities.cnx_unigy, capabilities.cnx_alpha, capabilities.cnx_chrono, capabilities.cnx_sdwan,
          capabilities.csp_on_ramp, capabilities.exchange_on_ramp, capabilities.internet_on_ramp, capabilities.transport_only_pop, capabilities.cnx_colocation,
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
  const nextUpdate = new Date();
  nextUpdate.setDate(nextUpdate.getDate() + 30);
  
  db.run(
    'INSERT INTO exchange_rates (currency_code, exchange_rate, next_update_due, updated_by) VALUES (?, ?, ?, ?)',
    [currency_code, exchange_rate, nextUpdate.toISOString(), updated_by || req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Capture lastID to avoid context issues
      const recordId = this.lastID;
      
      // Use currency_code as record ID if lastID is not available
      const logRecordId = recordId || currency_code;
      
      // Log the creation with proper error handling
      try {
        logChange(req.user.id, 'exchange_rates', logRecordId, 'CREATE', null, {
          currency_code, exchange_rate, next_update_due: nextUpdate.toISOString(), updated_by: updated_by || req.user.id
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
  const nextUpdate = new Date();
  nextUpdate.setDate(nextUpdate.getDate() + 30);
  
  // Get old values for change logging
  db.get('SELECT * FROM exchange_rates WHERE id = ?', [req.params.id], (err, oldValues) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldValues) return res.status(404).json({ error: 'Exchange rate not found' });
    
    db.run(
      'UPDATE exchange_rates SET exchange_rate = ?, last_updated = CURRENT_TIMESTAMP, next_update_due = ?, updated_by = ? WHERE id = ?',
      [exchange_rate, nextUpdate.toISOString(), updated_by || req.user.id, req.params.id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Exchange rate not found' });
        
        // Log the update
        logChange(req.user.id, 'exchange_rates', req.params.id, 'UPDATE', oldValues, {
          exchange_rate, next_update_due: nextUpdate.toISOString(), updated_by: updated_by || req.user.id
        }, req);
        
        res.json({ message: 'Exchange rate updated' });
      }
    );
  });
});

router.delete('/exchange_rates/:id', authenticateToken, authorizePermission('exchange_rates', 'delete'), (req, res) => {
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
router.post('/network_design/find_path', (req, res) => {
  const { source, destination, bandwidth, bandwidth_unit, constraints = {}, include_ull = false, use_cisco_only_routes = false } = req.body;
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
      // Create modified graph without primary path edges
      const modifiedGraph = JSON.parse(JSON.stringify(graph));
      
      for (let i = 0; i < primaryPath.path.length - 1; i++) {
        const from = primaryPath.path[i];
        const to = primaryPath.path[i + 1];
        delete modifiedGraph[from][to];
        delete modifiedGraph[to][from];
      }
      
      // Check if source and destination still exist in modified graph
      const sourceStillConnected = modifiedGraph[source] && Object.keys(modifiedGraph[source]).length > 0;
      const destStillConnected = modifiedGraph[destination] && Object.keys(modifiedGraph[destination]).length > 0;
      
      console.log(`Protection route analysis:`);
      console.log(`  Source (${source}) connections after removing primary path: ${sourceStillConnected ? Object.keys(modifiedGraph[source]).length : 0}`);
      console.log(`  Destination (${destination}) connections after removing primary path: ${destStillConnected ? Object.keys(modifiedGraph[destination]).length : 0}`);
      
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
        console.log(`  Protection route found: ${diversePathResult.path.join(' → ')}`);
      } else {
        // Analyze why protection route failed
        protectionFailureReasons = {
          primary_path_blocked: primaryPath.path.join(' → '),
          remaining_routes_analysis: {
            source_isolated: !sourceStillConnected,
            destination_isolated: !destStillConnected,
            total_remaining_edges: Object.keys(modifiedGraph).reduce((sum, node) => 
              sum + Object.keys(modifiedGraph[node] || {}).length, 0) / 2, // Divide by 2 since edges are bidirectional
            affected_constraints: {
              bandwidth_still_excluding: exclusionReasons.bandwidth.count,
              carrier_avoidance_still_excluding: exclusionReasons.carrier_avoidance.count,
              mtu_still_excluding: exclusionReasons.mtu_requirement.count,
              ull_still_excluding: exclusionReasons.ull_restriction.count
            }
          },
          suggestion: sourceStillConnected && destStillConnected 
            ? "Insufficient alternative routes available with current constraints. Consider relaxing bandwidth, MTU, or carrier avoidance requirements."
            : "No alternative connection paths available after removing primary route segments. Network topology limits protection options."
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
        req.user?.full_name || 'Unknown User',
        JSON.stringify({ 
          source, 
          destination, 
          bandwidth, 
          bandwidth_unit, 
          constraints, 
          include_ull,
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
            message: diversePath ? 'Protection route found' : 'No protection route available',
            failureReasons: protectionFailureReasons
          } : {
            required: false,
            message: 'Protection not requested'
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
        message: diversePath ? 'Protection route found' : 'No protection route available - consider relaxing constraints',
        failureReasons: protectionFailureReasons
      } : {
        required: false,
        available: null,
        message: 'Protection not requested'
      },
      executionTime,
      timestamp: new Date().toISOString()
    };
    

    res.json(response);
    });
  });
});

// Network Design with Enhanced Pricing
router.post('/network_design/calculate_pricing', async (req, res) => {
  const { paths, contract_term = 12, output_currency = 'USD', include_ull = false, bandwidth, source, destination, protection_required = false } = req.body;
  
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
          
          // Calculate allocated cost based on bandwidth utilization
          const utilizationFactor = isProtection ? pricingConfig.utilizationFactors.protection : pricingConfig.utilizationFactors.primary;
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
            
            // Check if promo pricing meets minimum margin requirement
            const promoMinMargin = pricingConfig.promoPricing.minimumMarginPercent;
            const requiredAllocatedCost = promoPriceConverted * (1 - promoMinMargin / 100);
            
            if (totalAllocatedCost <= requiredAllocatedCost) {
              // Promo pricing meets margin requirements, use it
              const actualMargin = ((promoPriceConverted - totalAllocatedCost) / promoPriceConverted) * 100;
              
              // Calculate NRC charge based on contract term (same logic as regular pricing)
              const termConfig = pricingConfig.contractTerms[contract_term] || pricingConfig.contractTerms[12];
              const promoNrcCharge = convertCurrency(termConfig.nrcCharge, 'USD', output_currency);
              
              return {
                allocatedCost: Math.round(totalAllocatedCost * 100) / 100,
                minimumPrice: Math.round(promoPriceConverted * 100) / 100,
                suggestedPrice: Math.round(promoPriceConverted * 100) / 100,
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
        allocatedCost: Math.round(totalAllocatedCost * 100) / 100,
        minimumPrice: Math.round(finalMinPrice * 100) / 100,
        suggestedPrice: Math.round(finalSuggestedPrice * 100) / 100,
        minimumMargin: Math.round(actualMinMargin * 10) / 10,
        suggestedMargin: Math.round(actualSuggestedMargin * 10) / 10,
        locationMinimum: Math.round(locationMinPrice * 100) / 100,
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
        minimumPrice: Math.round(protectedMinPrice * 100) / 100,
        suggestedPrice: Math.round(protectedSuggestedPrice * 100) / 100,
        allocatedCost: Math.round(protectedAllocatedCost * 100) / 100,
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
            minimumPrice: Math.round((secondaryPricing.minimumPrice * protectionMultiplier) * 100) / 100,
            suggestedPrice: Math.round((secondaryPricing.suggestedPrice * protectionMultiplier) * 100) / 100,
            allocatedCost: Math.round((secondaryPricing.allocatedCost * protectionMultiplier) * 100) / 100,
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
        req.user?.full_name || 'Unknown User',
        JSON.stringify({ 
          contract_term, 
          output_currency, 
          include_ull, 
          bandwidth, 
          source, 
          destination, 
          protection_required,
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
            protection_required
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
router.get('/network_design/audit_logs', authenticateToken, (req, res) => {
  // Check if user can view logs (not read-only)
  if (req.user.role === 'read_only') {
    return res.status(403).json({ error: 'Access denied. Read-only users cannot view audit logs.' });
  }

  const { limit = 100, offset = 0, action_type } = req.query;
  
  let query = 'SELECT * FROM audit_logs';
  let params = [];
  
  if (action_type) {
    query += ' WHERE action_type = ?';
    params.push(action_type);
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



// Clear audit logs (Admin and Provisioner only)
router.delete('/network_design/audit_logs', authenticateToken, (req, res) => {
  // Check permissions
  if (!['administrator', 'provisioner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Only administrators and provisioners can clear audit logs.' });
  }

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

// Export audit logs to CSV (Admin and Provisioner only)
router.get('/network_design/audit_logs/export', authenticateToken, (req, res) => {
  // Check permissions
  if (!['administrator', 'provisioner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Only administrators and provisioners can export audit logs.' });
  }

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
router.get('/cnx-colocation/locations', authenticateToken, authorizePermission('cnx_colocation', 'view'), (req, res) => {
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
router.put('/cnx-colocation/locations/:id', authenticateToken, authorizePermission('cnx_colocation', 'edit'), colocationUpload.single('design_file'), (req, res) => {
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
router.get('/cnx-colocation/locations/:locationId/racks', authenticateToken, authorizePermission('cnx_colocation', 'view'), (req, res) => {
  const locationId = req.params.locationId;
  
  const query = `
    SELECT r.*, 
           COUNT(c.id) as client_count,
           COALESCE(SUM(c.power_purchased), 0) as allocated_power,
           COALESCE(SUM(c.ru_purchased), 0) as ru_allocated
    FROM cnx_colocation_racks r
    LEFT JOIN cnx_colocation_clients c ON r.id = c.rack_id
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
router.post('/cnx-colocation/locations/:locationId/racks', authenticateToken, authorizePermission('cnx_colocation', 'create'), colocationUpload.single('pricing_info_file'), (req, res) => {
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
      'INSERT INTO cnx_colocation_racks (location_id, rack_id, total_power_kva, network_infrastructure, pricing_info_file, more_info, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [locationId, rack_id, parseFloat(total_power_kva), network_infrastructure, pricingInfoFile, more_info || null, req.user.id],
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
router.put('/cnx-colocation/racks/:rackId', authenticateToken, authorizePermission('cnx_colocation', 'edit'), colocationUpload.single('pricing_info_file'), (req, res) => {
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
        `UPDATE cnx_colocation_racks SET ${setClause}, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [...updateValues, req.user.id, rackId],
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
router.delete('/cnx-colocation/racks/:rackId', authenticateToken, authorizePermission('cnx_colocation', 'delete'), (req, res) => {
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
router.get('/cnx-colocation/racks/:rackId/clients', authenticateToken, authorizePermission('cnx_colocation', 'view'), (req, res) => {
  const rackId = req.params.rackId;
  
  db.all('SELECT * FROM cnx_colocation_clients WHERE rack_id = ? ORDER BY client_name', [rackId], (err, clients) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(clients);
  });
});

// Create client
router.post('/cnx-colocation/racks/:rackId/clients', authenticateToken, authorizePermission('cnx_colocation', 'create'), colocationUpload.single('client_design_file'), (req, res) => {
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
      'INSERT INTO cnx_colocation_clients (rack_id, client_name, power_purchased, ru_purchased, more_info, design_file, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [rackId, client_name, parseFloat(power_purchased), parseInt(ru_purchased), more_info || null, clientDesignFile, req.user.id],
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
router.put('/cnx-colocation/clients/:clientId', authenticateToken, authorizePermission('cnx_colocation', 'edit'), colocationUpload.single('client_design_file'), (req, res) => {
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
        `UPDATE cnx_colocation_clients SET ${setClause}, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [...updateValues, req.user.id, clientId],
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
router.delete('/cnx-colocation/clients/:clientId', authenticateToken, authorizePermission('cnx_colocation', 'delete'), (req, res) => {
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
router.get('/cnx-colocation/locations/:id/download', authenticateToken, authorizePermission('cnx_colocation', 'view'), (req, res) => {
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
router.get('/cnx-colocation/racks/:id/download', authenticateToken, authorizePermission('cnx_colocation', 'view'), (req, res) => {
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
router.get('/cnx-colocation/clients/:id/download', authenticateToken, authorizePermission('cnx_colocation', 'view'), (req, res) => {
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
router.delete('/cnx-colocation/locations/:id/design-file', authenticateToken, authorizePermission('cnx_colocation', 'edit'), (req, res) => {
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
router.delete('/cnx-colocation/racks/:id/pricing-file', authenticateToken, authorizePermission('cnx_colocation', 'edit'), (req, res) => {
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
router.delete('/cnx-colocation/clients/:id/design-file', authenticateToken, authorizePermission('cnx_colocation', 'edit'), (req, res) => {
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
router.get('/exchanges', authenticateToken, authorizePermission('exchange_data', 'view'), (req, res) => {
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
router.post('/exchanges', authenticateToken, authorizePermission('exchange_data', 'create'), (req, res) => {
  const { exchange_name, region, available, salesperson_assigned } = req.body;
  
  if (!exchange_name || !region) {
    return res.status(400).json({ error: 'Exchange name and region are required' });
  }
  
  db.run(
    'INSERT INTO exchanges (exchange_name, region, salesperson_assigned, available, created_by) VALUES (?, ?, ?, ?, ?)',
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
router.put('/exchanges/:id', authenticateToken, authorizePermission('exchange_data', 'edit'), (req, res) => {
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
          'UPDATE exchanges SET exchange_name = ?, region = ?, salesperson_assigned = ?, available = ?, updated_by = ? WHERE id = ?',
          [exchange_name, region, salesperson_assigned || null, available !== false ? 1 : 0, req.user.id, exchangeId],
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
router.delete('/exchanges/:id', authenticateToken, authorizePermission('exchange_data', 'delete'), (req, res) => {
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
router.get('/exchanges/:id/feeds', authenticateToken, authorizePermission('exchange_data', 'view'), (req, res) => {
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
router.post('/exchanges/:id/feeds', authenticateToken, authorizePermission('exchange_data', 'edit'), exchangeUpload.single('design_file'), (req, res) => {
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
    `INSERT INTO exchange_feeds (
      exchange_id, feed_name, feed_delivery, feed_type, isf_enabled, 
      isf_a, isf_b, isf_site_code_a, isf_site_code_b,
      isf_dr_a, isf_dr_b, isf_dr_site_code_a, isf_dr_site_code_b, 
      dr_type, order_entry_isf, dr_order_entry_isf, unicast_isf,
      dr_available, bandwidth_1ms, available_now, quick_quote, pass_through_fees, 
      pass_through_currency, pass_through_fees_info, design_file_path, more_info,
      quick_quote_min_cost, order_entry_cost, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      order_entry_cost ? parseFloat(order_entry_cost) : null, req.user.id
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
          'INSERT INTO exchange_files (exchange_feed_id, filename, original_name, file_size) VALUES (?, ?, ?, ?)',
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
router.put('/exchanges/:exchangeId/feeds/:feedId', authenticateToken, authorizePermission('exchange_data', 'edit'), exchangeUpload.single('design_file'), (req, res) => {
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
        'INSERT INTO exchange_files (exchange_feed_id, filename, original_name, file_size) VALUES (?, ?, ?, ?)',
        [feedId, req.file.filename, req.file.originalname, req.file.size],
        (err) => {
          if (err) console.error('Failed to record file upload:', err);
        }
      );
    }
    
    db.run(
      `UPDATE exchange_feeds SET 
        feed_name = ?, feed_delivery = ?, feed_type = ?, isf_enabled = ?, 
        isf_a = ?, isf_b = ?, isf_site_code_a = ?, isf_site_code_b = ?,
        isf_dr_a = ?, isf_dr_b = ?, isf_dr_site_code_a = ?, isf_dr_site_code_b = ?,
        dr_type = ?, order_entry_isf = ?, dr_order_entry_isf = ?, unicast_isf = ?,
        dr_available = ?, bandwidth_1ms = ?, available_now = ?, quick_quote = ?, 
        pass_through_fees = ?, pass_through_currency = ?, pass_through_fees_info = ?, 
        design_file_path = ?, more_info = ?, quick_quote_min_cost = ?, order_entry_cost = ?, updated_by = ?
      WHERE id = ? AND exchange_id = ?`,
      [
        feed_name, feed_delivery, feed_type, isf_enabled === 'true' ? 1 : 0, 
        isf_a || null, isf_b || null, isf_site_code_a || null, isf_site_code_b || null,
        isf_dr_a || null, isf_dr_b || null, isf_dr_site_code_a || null, isf_dr_site_code_b || null,
        dr_type || null, order_entry_isf || null, dr_order_entry_isf || null, unicast_isf || null,
        dr_available === 'true' ? 1 : 0, bandwidth_1ms,
        available_now === 'true' ? 1 : 0, quick_quote === 'true' ? 1 : 0,
        parseInt(pass_through_fees) || 0, pass_through_currency || 'USD', 
        pass_through_fees_info || '', designFilePath, more_info,
        quick_quote_min_cost ? parseFloat(quick_quote_min_cost) : null,
        order_entry_cost ? parseFloat(order_entry_cost) : null, req.user.id, feedId, exchangeId
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

// Delete exchange feed
router.delete('/exchanges/:exchangeId/feeds/:feedId', authenticateToken, authorizePermission('exchange_data', 'edit'), (req, res) => {
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
router.get('/exchanges/:exchangeId/feeds/:feedId/download', authenticateToken, authorizePermission('exchange_data', 'view'), (req, res) => {
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

// Get exchange contacts for a specific exchange
router.get('/exchanges/:id/contacts', authenticateToken, authorizePermission('exchange_data', 'view'), (req, res) => {
  const exchangeId = req.params.id;
  
  db.all('SELECT * FROM exchange_contacts WHERE exchange_id = ? ORDER BY contact_name', [exchangeId], (err, contacts) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(contacts);
  });
});

// Create exchange contact
router.post('/exchanges/:id/contacts', authenticateToken, authorizePermission('exchange_data', 'edit'), (req, res) => {
  const exchangeId = req.params.id;
  const {
    contact_name, job_title, country, phone_number, email,
    contact_type, daily_contact, more_info
  } = req.body;
  
  if (!contact_name) {
    return res.status(400).json({ error: 'Contact name is required' });
  }
  
  db.run(
    `INSERT INTO exchange_contacts (
      exchange_id, contact_name, job_title, country, phone_number, email,
      contact_type, daily_contact, more_info, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exchangeId, contact_name, job_title, country, phone_number, email,
      contact_type, (daily_contact === 'true' || daily_contact === true) ? 1 : 0, more_info, req.user.id
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
router.put('/exchanges/:exchangeId/contacts/:contactId', authenticateToken, authorizePermission('exchange_data', 'edit'), (req, res) => {
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
      `UPDATE exchange_contacts SET 
        contact_name = ?, job_title = ?, country = ?, phone_number = ?, email = ?,
        contact_type = ?, daily_contact = ?, more_info = ?, last_updated = CURRENT_TIMESTAMP, updated_by = ?
      WHERE id = ? AND exchange_id = ?`,
      [
        contact_name, job_title, country, phone_number, email,
        contact_type, (daily_contact === 'true' || daily_contact === true) ? 1 : 0, more_info, req.user.id, contactId, exchangeId
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
router.delete('/exchanges/:exchangeId/contacts/:contactId', authenticateToken, authorizePermission('exchange_data', 'edit'), (req, res) => {
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
router.get('/exchanges/overdue-contacts', authenticateToken, authorizePermission('exchange_data', 'view'), (req, res) => {
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
router.post('/exchanges/:exchangeId/contacts/:contactId/approve', authenticateToken, authorizePermission('exchange_data', 'edit'), (req, res) => {
  const { exchangeId, contactId } = req.params;
  
  // Get current contact data for change logging
  db.get('SELECT * FROM exchange_contacts WHERE id = ? AND exchange_id = ?', [contactId, exchangeId], (err, contact) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!contact) return res.status(404).json({ error: 'Exchange contact not found' });
    
    db.run(
      `UPDATE exchange_contacts SET 
        last_updated = CURRENT_TIMESTAMP, 
        approved_by = ?, 
        approved_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND exchange_id = ?`,
      [req.user.id, contactId, exchangeId],
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
router.get('/exchange-currencies', authenticateToken, authorizePermission('exchange_data', 'view'), (req, res) => {
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
      'circuit_id', 'repository_type_id', 'outage_tickets_last_30d', 'maintenance_tickets_last_30d',
      'kmz_file_path', 'mtu', 'sla_latency', 'live_latency', 'expected_latency', 'test_results_link',
      'cable_system', 'is_special', 'underlying_carrier', 'cost', 'currency',
      'location_a', 'location_b', 'bandwidth', 'capacity_usage_percent', 'more_details', 'test_results_file'
    ],
    requiredFields: ['circuit_id'],
    sampleData: {
      circuit_id: 'SAMPLE123456',
      repository_type_id: '1',
      outage_tickets_last_30d: '2',
      maintenance_tickets_last_30d: '1',
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
      capacity_usage_percent: '75',
      more_details: 'Sample route details',
      test_results_file: ''
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
    requiredFields: ['exchange_id', 'feed_name', 'feed_delivery', 'feed_type'],
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
    templateFields: ['currency_code', 'currency_name', 'rate_to_usd'],
    requiredFields: ['currency_code', 'currency_name', 'rate_to_usd'],
    sampleData: {
      currency_code: 'EUR',
      currency_name: 'Euro',
      rate_to_usd: '1.08'
    }
  },
  locations: {
    table: 'location_reference',
    templateFields: [
      'location_code', 'city', 'country', 'datacenter_name', 'datacenter_address',
      'latitude', 'longitude', 'time_zone', 'pop_type', 'status', 'provider', 'access_info',
      'min_price_under_100mb', 'min_price_100_to_999mb', 'min_price_1000_to_2999mb', 'min_price_3000mb_plus'
    ],
    requiredFields: ['location_code', 'city', 'country'],
    sampleData: {
      location_code: 'LONLON',
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
      min_price_3000mb_plus: '1000'
    }
  },
  carriers: {
    table: 'carriers',
    templateFields: ['carrier_name', 'previously_known_as', 'status', 'region'],
    requiredFields: ['carrier_name', 'region'],
    sampleData: {
      carrier_name: 'Sample Carrier Inc.',
      previously_known_as: 'Old Carrier Name',
      status: 'active',
      region: 'North America'
    }
  },
  users: {
    table: 'users',
    templateFields: ['username', 'password', 'email', 'full_name', 'user_role', 'status'],
    requiredFields: ['username', 'password', 'user_role'],
    sampleData: {
      username: 'newuser',
      password: 'temppassword123',
      email: 'newuser@example.com',
      full_name: 'New User',
      user_role: 'read_only',
      status: 'active'
    }
  },
  // Add missing bulk upload modules
  carrier_contacts: {
    table: 'carrier_contacts',
    templateFields: [
      'carrier_id', 'contact_name', 'contact_title', 'email', 'phone', 'is_primary', 'notes'
    ],
    requiredFields: ['carrier_id', 'contact_name', 'email'],
    sampleData: {
      carrier_id: '1',
      contact_name: 'John Smith',
      contact_title: 'Account Manager',
      email: 'john.smith@carrier.com',
      phone: '+1-555-0789',
      is_primary: 'true',
      notes: 'Primary contact for technical issues'
    }
  },
  pop_capabilities: {
    table: 'pop_capabilities',
    templateFields: [
      'location_id', 'cnx_extranet_wan', 'cnx_ethernet', 'cnx_voice', 'tdm_gateway',
      'cnx_unigy', 'cnx_alpha', 'cnx_chrono', 'cnx_sdwan', 'csp_on_ramp',
      'exchange_on_ramp', 'internet_on_ramp', 'transport_only_pop'
    ],
    requiredFields: ['location_id'],
    sampleData: {
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
      transport_only_pop: 'false'
    }
  },
  exchanges: {
    table: 'exchanges',
    templateFields: ['exchange_name', 'region', 'contact_info', 'website', 'more_info'],
    requiredFields: ['exchange_name', 'region'],
    sampleData: {
      exchange_name: 'Sample Exchange',
      region: 'North America',
      contact_info: 'support@sampleexchange.com',
      website: 'https://www.sampleexchange.com',
      more_info: 'Leading financial data exchange'
    }
  }
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
  const limit = parseInt(req.query.limit) || 100;
  
  db.all(`SELECT * FROM ${config.table} LIMIT ?`, [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    try {
      const parser = new Parser({ fields: config.templateFields });
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
router.post('/bulk-upload/:module', authenticateToken, authorizeRole('administrator'), csvUpload.single('csv_file'), (req, res) => {
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
  
  // Parse CSV file
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      // Validate required fields
      const missingFields = config.requiredFields.filter(field => !row[field] || row[field].trim() === '');
      if (missingFields.length > 0) {
        errors.push(`Row ${results.length + 1}: Missing required fields: ${missingFields.join(', ')}`);
        return;
      }
      
      // Clean and validate data
      const cleanedRow = {};
      config.templateFields.forEach(field => {
        if (row[field] !== undefined) {
          cleanedRow[field] = row[field].trim();
        }
      });
      
      // Module-specific validations
      if (module === 'network_routes') {
        if (!isValidCircuitId(cleanedRow.circuit_id)) {
          errors.push(`Row ${results.length + 1}: Invalid circuit_id format. Must be 6 uppercase letters + 6 digits`);
          return;
        }
        if (cleanedRow.is_special) {
          cleanedRow.is_special = cleanedRow.is_special.toLowerCase() === 'true' ? 1 : 0;
        }
      } else if (module === 'users') {
        if (!['administrator', 'provisioner', 'read_only'].includes(cleanedRow.role)) {
          errors.push(`Row ${results.length + 1}: Invalid role. Must be administrator, provisioner, or read_only`);
          return;
        }
      } else if (module === 'exchange_feeds') {
        if (!['Unicast', 'Multicast'].includes(cleanedRow.feed_delivery)) {
          errors.push(`Row ${results.length + 1}: Invalid feed_delivery. Must be Unicast or Multicast`);
          return;
        }
        const validFeedTypes = ['Equities', 'Futures', 'Options', 'Fixed Income', 'FX', 'Commodities', 'Indices', 'ETFs', 'Alternative Data', 'Reference Data'];
        if (!validFeedTypes.includes(cleanedRow.feed_type)) {
          errors.push(`Row ${results.length + 1}: Invalid feed_type. Must be one of: ${validFeedTypes.join(', ')}`);
          return;
        }
        // Convert boolean strings to integers
        ['dr_available', 'available_now', 'quick_quote'].forEach(field => {
          if (cleanedRow[field]) {
            cleanedRow[field] = cleanedRow[field].toLowerCase() === 'true' ? 1 : 0;
          }
        });
      }
      
      results.push(cleanedRow);
    })
    .on('end', () => {
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      
      // If there are validation errors, return them
      if (errors.length > 0) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          errors: errors,
          total_rows: results.length + errors.length,
          valid_rows: results.length,
          invalid_rows: errors.length
        });
      }
      
      if (results.length === 0) {
        return res.status(400).json({ error: 'No valid data found in CSV file' });
      }
      
      // Begin transaction for bulk insert
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to begin transaction: ' + err.message });
          }
          
          let completed = 0;
          let failed = false;
          const insertErrors = [];
          
          results.forEach((row, index) => {
            let sql, values;
            
            // Generate SQL for each module
            if (module === 'network_routes') {
              sql = `INSERT INTO network_routes (${config.templateFields.join(', ')}) VALUES (${config.templateFields.map(() => '?').join(', ')})`;
              values = config.templateFields.map(field => row[field] || null);
            } else if (module === 'exchange_feeds') {
              sql = `INSERT INTO exchange_feeds (${config.templateFields.join(', ')}, created_by) VALUES (${config.templateFields.map(() => '?').join(', ')}, ?)`;
              values = [...config.templateFields.map(field => row[field] || null), req.user.id];
            } else if (module === 'exchange_contacts') {
              sql = `INSERT INTO exchange_contacts (${config.templateFields.join(', ')}) VALUES (${config.templateFields.map(() => '?').join(', ')})`;
              values = config.templateFields.map(field => row[field] || null);
            } else if (module === 'exchange_rates') {
              sql = `INSERT OR REPLACE INTO exchange_rates (${config.templateFields.join(', ')}) VALUES (${config.templateFields.map(() => '?').join(', ')})`;
              values = config.templateFields.map(field => row[field] || null);
            } else if (module === 'locations') {
              sql = `INSERT INTO location_reference (${config.templateFields.join(', ')}) VALUES (${config.templateFields.map(() => '?').join(', ')})`;
              values = config.templateFields.map(field => row[field] || null);
            } else if (module === 'carriers') {
              sql = `INSERT INTO carriers (${config.templateFields.join(', ')}) VALUES (${config.templateFields.map(() => '?').join(', ')})`;
              values = config.templateFields.map(field => row[field] || null);
            } else if (module === 'users') {
              // Hash password for users
              row.password = hashPassword(row.password);
              sql = `INSERT INTO users (${config.templateFields.join(', ')}) VALUES (${config.templateFields.map(() => '?').join(', ')})`;
              values = config.templateFields.map(field => row[field] || null);
            }
            
            db.run(sql, values, function(err) {
              if (err) {
                failed = true;
                insertErrors.push(`Row ${index + 1}: ${err.message}`);
              }
              
              completed++;
              
              // Check if all operations are complete
              if (completed === results.length) {
                if (failed) {
                  // Rollback transaction
                  db.run('ROLLBACK', (rollbackErr) => {
                    if (rollbackErr) console.error('Rollback failed:', rollbackErr);
                    res.status(400).json({
                      error: 'Bulk upload failed',
                      errors: insertErrors,
                      message: 'Transaction rolled back. No data was imported.'
                    });
                  });
                } else {
                  // Commit transaction
                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      return res.status(500).json({ error: 'Failed to commit transaction: ' + commitErr.message });
                    }
                    
                    // Log successful bulk upload
                    logChange(null, 'bulk_upload', null, 'BULK_IMPORT', null, {
                      module,
                      rows_imported: results.length,
                      filename: req.file.originalname
                    }, req);
                    
                    res.json({
                      message: 'Bulk upload successful',
                      module,
                      rows_imported: results.length,
                      total_rows: results.length
                    });
                  });
                }
              }
            });
          });
        });
      });
    })
    .on('error', (error) => {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.status(500).json({ error: 'Failed to process CSV file: ' + error.message });
    });
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

// PRICING LOGIC CONFIGURATION APIs (Admin Only)

// Get current pricing logic configuration
router.get('/pricing_logic/config', authenticateToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Get all pricing logic configuration
  db.all('SELECT * FROM pricing_logic_config ORDER BY config_key', [], (err, configs) => {
    if (err) {
      console.error('Error fetching pricing logic config:', err);
      return res.status(500).json({ error: 'Failed to fetch pricing configuration' });
    }

    // Transform array into structured object
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
        primary: 0.9,
        protection: 1.0
      },
      promoPricing: {
        minimumMarginPercent: 35
      }
    };

    // Override with database values if they exist
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
      }
    });

    res.json({
      success: true,
      data: configData,
      lastUpdated: configs.length > 0 ? configs[0].updated_date : null
    });
  });
});

// Update pricing logic configuration
router.put('/pricing_logic/config', authenticateToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { contractTerms, protectedServiceMargins, charges, utilizationFactors, promoPricing } = req.body;

  // Validate input
  if (!contractTerms || !protectedServiceMargins || !charges || !utilizationFactors || !promoPricing) {
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

  // Execute all updates
  const dbInstance = db.getInstance();
  if (!dbInstance) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  dbInstance.serialize(() => {
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
        primary: 0.9,
        protection: 1.0
      },
      promoPricing: {
        minimumMarginPercent: 35
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
router.get('/promo-pricing', authenticateToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { search } = req.query;

  getPromoRulesWithLocations()
    .then(rules => {
      let filteredRules = rules;
      
      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        filteredRules = rules.filter(rule => 
          rule.rule_name.toLowerCase().includes(searchLower) ||
          rule.source_locations.some(loc => loc.toLowerCase().includes(searchLower)) ||
          rule.destination_locations.some(loc => loc.toLowerCase().includes(searchLower))
        );
      }
      
      res.json({
        success: true,
        data: filteredRules
      });
    })
    .catch(err => {
      console.error('Error fetching promo pricing rules:', err);
      res.status(500).json({ error: 'Failed to fetch promo pricing rules' });
    });
});

// Create new promo pricing rule
router.post('/promo-pricing', authenticateToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { 
    rule_name, 
    source_locations, 
    destination_locations,
    price_under_100mb, 
    price_100_to_999mb, 
    price_1000_to_2999mb, 
    price_3000mb_plus 
  } = req.body;

  // Validate required fields
  if (!rule_name || !source_locations || !Array.isArray(source_locations) || source_locations.length === 0) {
    return res.status(400).json({ error: 'Rule name and at least one source location are required' });
  }
  if (!destination_locations || !Array.isArray(destination_locations) || destination_locations.length === 0) {
    return res.status(400).json({ error: 'At least one destination location is required' });
  }

  // Validate pricing values
  if (price_under_100mb < 0 || price_100_to_999mb < 0 || price_1000_to_2999mb < 0 || price_3000mb_plus < 0) {
    return res.status(400).json({ error: 'Pricing values must be non-negative' });
  }

  const dbInstance = db.getInstance();
  if (!dbInstance) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  dbInstance.serialize(() => {
    dbInstance.run('BEGIN TRANSACTION');

    // Insert the promo rule
    dbInstance.run(
      `INSERT INTO promo_pricing_rules 
       (rule_name, price_under_100mb, price_100_to_999mb, price_1000_to_2999mb, price_3000mb_plus, created_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [rule_name, price_under_100mb || 0, price_100_to_999mb || 0, price_1000_to_2999mb || 0, price_3000mb_plus || 0, req.user.id],
      function(err) {
        if (err) {
          dbInstance.run('ROLLBACK');
          return res.status(500).json({ error: 'Failed to create promo rule: ' + err.message });
        }

        const promoRuleId = this.lastID;
        let completed = 0;
        let hasError = false;
        const totalLocations = source_locations.length + destination_locations.length;

        // Insert source locations
        source_locations.forEach(locationCode => {
          dbInstance.run(
            'INSERT INTO promo_pricing_locations (promo_rule_id, location_code, location_type) VALUES (?, ?, ?)',
            [promoRuleId, locationCode, 'source'],
            function(err) {
              if (err && !hasError) {
                hasError = true;
                dbInstance.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to add source locations: ' + err.message });
              }

              completed++;
              if (completed === totalLocations && !hasError) {
                dbInstance.run('COMMIT');

                // Log the change
                logChange(req.user.id, 'promo_pricing_rules', rule_name, 'CREATE', null, {
                  rule_name, source_locations, destination_locations, price_under_100mb, price_100_to_999mb, price_1000_to_2999mb, price_3000mb_plus
                }, req);

                res.status(201).json({
                  success: true,
                  message: 'Promo pricing rule created successfully',
                  id: promoRuleId
                });
              }
            }
          );
        });

        // Insert destination locations
        destination_locations.forEach(locationCode => {
          dbInstance.run(
            'INSERT INTO promo_pricing_locations (promo_rule_id, location_code, location_type) VALUES (?, ?, ?)',
            [promoRuleId, locationCode, 'destination'],
            function(err) {
              if (err && !hasError) {
                hasError = true;
                dbInstance.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to add destination locations: ' + err.message });
              }

              completed++;
              if (completed === totalLocations && !hasError) {
                dbInstance.run('COMMIT');

                // Log the change
                logChange(req.user.id, 'promo_pricing_rules', rule_name, 'CREATE', null, {
                  rule_name, source_locations, destination_locations, price_under_100mb, price_100_to_999mb, price_1000_to_2999mb, price_3000mb_plus
                }, req);

                res.status(201).json({
                  success: true,
                  message: 'Promo pricing rule created successfully',
                  id: promoRuleId
                });
              }
            }
          );
        });
      }
    );
  });
});

// Update promo pricing rule
router.put('/promo-pricing/:id', authenticateToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const promoRuleId = req.params.id;
  const { 
    rule_name, 
    source_locations, 
    destination_locations,
    price_under_100mb, 
    price_100_to_999mb, 
    price_1000_to_2999mb, 
    price_3000mb_plus 
  } = req.body;

  // Validate required fields
  if (!rule_name || !source_locations || !Array.isArray(source_locations) || source_locations.length === 0) {
    return res.status(400).json({ error: 'Rule name and at least one source location are required' });
  }
  if (!destination_locations || !Array.isArray(destination_locations) || destination_locations.length === 0) {
    return res.status(400).json({ error: 'At least one destination location is required' });
  }

  // Validate pricing values
  if (price_under_100mb < 0 || price_100_to_999mb < 0 || price_1000_to_2999mb < 0 || price_3000mb_plus < 0) {
    return res.status(400).json({ error: 'Pricing values must be non-negative' });
  }

  const dbInstance = db.getInstance();
  if (!dbInstance) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  // Get old data for change logging
  db.get('SELECT * FROM promo_pricing_rules WHERE id = ?', [promoRuleId], (err, oldRule) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldRule) return res.status(404).json({ error: 'Promo rule not found' });

    dbInstance.serialize(() => {
      dbInstance.run('BEGIN TRANSACTION');

      // Update the promo rule
      dbInstance.run(
        `UPDATE promo_pricing_rules 
         SET rule_name = ?, price_under_100mb = ?, price_100_to_999mb = ?, price_1000_to_2999mb = ?, price_3000mb_plus = ?, updated_by = ?
         WHERE id = ?`,
        [rule_name, price_under_100mb || 0, price_100_to_999mb || 0, price_1000_to_2999mb || 0, price_3000mb_plus || 0, req.user.id, promoRuleId],
        function(err) {
          if (err) {
            dbInstance.run('ROLLBACK');
            return res.status(500).json({ error: 'Failed to update promo rule: ' + err.message });
          }

                      // Delete existing locations
            dbInstance.run(
              'DELETE FROM promo_pricing_locations WHERE promo_rule_id = ?',
              [promoRuleId],
              function(err) {
                if (err) {
                  dbInstance.run('ROLLBACK');
                  return res.status(500).json({ error: 'Failed to update locations: ' + err.message });
                }

                let completed = 0;
                let hasError = false;
                const totalLocations = source_locations.length + destination_locations.length;

                // Insert new source locations
                source_locations.forEach(locationCode => {
                  dbInstance.run(
                    'INSERT INTO promo_pricing_locations (promo_rule_id, location_code, location_type) VALUES (?, ?, ?)',
                    [promoRuleId, locationCode, 'source'],
                    function(err) {
                      if (err && !hasError) {
                        hasError = true;
                        dbInstance.run('ROLLBACK');
                        return res.status(500).json({ error: 'Failed to add source locations: ' + err.message });
                      }

                      completed++;
                      if (completed === totalLocations && !hasError) {
                        dbInstance.run('COMMIT');

                        // Log the change
                        logChange(req.user.id, 'promo_pricing_rules', rule_name, 'UPDATE', oldRule, {
                          rule_name, source_locations, destination_locations, price_under_100mb, price_100_to_999mb, price_1000_to_2999mb, price_3000mb_plus
                        }, req);

                        res.json({
                          success: true,
                          message: 'Promo pricing rule updated successfully'
                        });
                      }
                    }
                  );
                });

                // Insert new destination locations
                destination_locations.forEach(locationCode => {
                  dbInstance.run(
                    'INSERT INTO promo_pricing_locations (promo_rule_id, location_code, location_type) VALUES (?, ?, ?)',
                    [promoRuleId, locationCode, 'destination'],
                    function(err) {
                      if (err && !hasError) {
                        hasError = true;
                        dbInstance.run('ROLLBACK');
                        return res.status(500).json({ error: 'Failed to add destination locations: ' + err.message });
                      }

                      completed++;
                      if (completed === totalLocations && !hasError) {
                        dbInstance.run('COMMIT');

                        // Log the change
                        logChange(req.user.id, 'promo_pricing_rules', rule_name, 'UPDATE', oldRule, {
                          rule_name, source_locations, destination_locations, price_under_100mb, price_100_to_999mb, price_1000_to_2999mb, price_3000mb_plus
                        }, req);

                        res.json({
                          success: true,
                          message: 'Promo pricing rule updated successfully'
                        });
                      }
                    }
                  );
                });
              }
            );
        }
      );
    });
  });
});

// Delete promo pricing rule
router.delete('/promo-pricing/:id', authenticateToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const promoRuleId = req.params.id;

  // Get rule data for change logging
  db.get('SELECT * FROM promo_pricing_rules WHERE id = ?', [promoRuleId], (err, rule) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rule) return res.status(404).json({ error: 'Promo rule not found' });

    // Soft delete (set is_active to false)
    db.run(
      'UPDATE promo_pricing_rules SET is_active = 0, updated_by = ? WHERE id = ?',
      [req.user.id, promoRuleId],
      function(err) {
        if (err) return res.status(500).json({ error: 'Failed to delete promo rule: ' + err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Promo rule not found' });

        // Log the change
        logChange(req.user.id, 'promo_pricing_rules', rule.rule_name, 'DELETE', rule, null, req);

        res.json({
          success: true,
          message: 'Promo pricing rule deleted successfully'
        });
      }
    );
  });
});

// ===== EXCHANGE PRICING TOOL ROUTES =====

// Get available regions for exchange pricing tool
router.get('/exchange-pricing/regions', authenticateToken, (req, res) => {
  db.all(`
    SELECT DISTINCT e.region 
    FROM exchanges e 
    INNER JOIN exchange_feeds ef ON e.id = ef.exchange_id 
    WHERE ef.quick_quote = 1 AND e.region IS NOT NULL
    ORDER BY e.region
  `, [], (err, rows) => {
    if (err) {
      console.error('Error getting regions:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.map(row => row.region));
  });
});

// Get available exchanges by region for exchange pricing tool
router.get('/exchange-pricing/exchanges/:region', authenticateToken, (req, res) => {
  const { region } = req.params;
  db.all(`
    SELECT DISTINCT e.id, e.exchange_name, e.region 
    FROM exchanges e 
    INNER JOIN exchange_feeds ef ON e.id = ef.exchange_id 
    WHERE e.region = ? AND ef.quick_quote = 1
    ORDER BY e.exchange_name
  `, [region], (err, rows) => {
    if (err) {
      console.error('Error getting exchanges for region:', region, err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get available feeds by exchange for exchange pricing tool  
router.get('/exchange-pricing/feeds/:exchangeId', authenticateToken, (req, res) => {
  const { exchangeId } = req.params;
  db.all(`
    SELECT ef.*, e.exchange_name, e.region
    FROM exchange_feeds ef
    INNER JOIN exchanges e ON ef.exchange_id = e.id
    WHERE ef.exchange_id = ? AND ef.quick_quote = 1
    ORDER BY ef.feed_name
  `, [exchangeId], (err, rows) => {
    if (err) {
      console.error('Error getting feeds for exchange:', exchangeId, err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get available currencies from exchange rates table
router.get('/exchange-pricing/currencies', authenticateToken, (req, res) => {
  // Currency name mapping since exchange_rates table doesn't have currency_name column
  const currencyNames = {
    'USD': 'US Dollar',
    'EUR': 'Euro',
    'GBP': 'British Pound',
    'JPY': 'Japanese Yen',
    'AUD': 'Australian Dollar',
    'CAD': 'Canadian Dollar',
    'CHF': 'Swiss Franc',
    'CNY': 'Chinese Yuan',
    'SGD': 'Singapore Dollar',
    'HKD': 'Hong Kong Dollar',
    'NOK': 'Norwegian Krone',
    'SEK': 'Swedish Krona',
    'DKK': 'Danish Krone',
    'PLN': 'Polish Zloty',
    'CZK': 'Czech Koruna',
    'HUF': 'Hungarian Forint',
    'RUB': 'Russian Ruble',
    'BRL': 'Brazilian Real',
    'MXN': 'Mexican Peso',
    'ZAR': 'South African Rand',
    'INR': 'Indian Rupee',
    'KRW': 'South Korean Won',
    'THB': 'Thai Baht',
    'MYR': 'Malaysian Ringgit',
    'IDR': 'Indonesian Rupiah',
    'PHP': 'Philippine Peso',
    'NZD': 'New Zealand Dollar'
  };

  db.all(`
    SELECT DISTINCT currency_code 
    FROM exchange_rates 
    WHERE status = 'Active'
    ORDER BY currency_code
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Add currency names to the response
    const currencies = rows.map(row => ({
      currency_code: row.currency_code,
      currency_name: currencyNames[row.currency_code] || row.currency_code
    }));
    
    res.json(currencies);
  });
});

// Get available delivery datacenters by region (Tier 1 POPs only)
router.get('/exchange-pricing/datacenters/:region', authenticateToken, (req, res) => {
  const { region } = req.params;
  console.log(`Getting datacenters for region: ${region}`);
  
  db.all(`
    SELECT location_code, datacenter_name as location_name, city, country, region, pop_type
    FROM location_reference 
    WHERE region = ? AND pop_type = 'Tier 1'
    ORDER BY location_code
  `, [region], (err, rows) => {
    if (err) {
      console.error('Error getting datacenters for region:', region, err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log(`Found ${rows.length} datacenters for region ${region}:`, rows);
    res.json(rows);
  });
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
              req.user?.full_name || 'Unknown User',
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
router.get('/exchange-pricing/audit_logs', authenticateToken, (req, res) => {
  // Check if user can view logs (not read-only)
  if (req.user.role === 'read_only') {
    return res.status(403).json({ error: 'Access denied. Read-only users cannot view audit logs.' });
  }

  const { limit = 100, offset = 0 } = req.query;
  
  db.all(
    'SELECT * FROM audit_logs WHERE action_type = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
    ['EXCHANGE_PRICING_QUOTE', parseInt(limit), parseInt(offset)],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const logs = rows.map(row => ({
        ...row,
        parameters: row.parameters ? JSON.parse(row.parameters) : null,
        pricing_data: row.pricing_data ? JSON.parse(row.pricing_data) : null
      }));
      res.json(logs);
    }
  );
});

// Clear exchange pricing audit logs (Admin and Provisioner only)
router.delete('/exchange-pricing/audit_logs', authenticateToken, (req, res) => {
  // Check permissions
  if (!['administrator', 'provisioner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Only administrators and provisioners can clear audit logs.' });
  }

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

// Clear exchange pricing quote history (Admin and Provisioner only)
router.delete('/exchange-pricing/quotes/clear', authenticateToken, (req, res) => {
  // Check permissions
  if (!['administrator', 'provisioner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Only administrators and provisioners can clear quote history.' });
  }

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

// Export exchange pricing audit logs to CSV (Admin and Provisioner only)
router.get('/exchange-pricing/audit_logs/export', authenticateToken, (req, res) => {
  // Check permissions
  if (!['administrator', 'provisioner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Only administrators and provisioners can export audit logs.' });
  }

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



module.exports = router; 