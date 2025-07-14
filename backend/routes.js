const express = require('express');
const db = require('./db');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Parser } = require('json2csv');
const archiver = require('archiver');
const { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  authenticateToken, 
  authorizeRole, 
  authorizePermission, 
  getUserPermissions, 
  logUserActivity 
} = require('./auth');

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

// Helper function to log changes
const logChange = (userId, tableName, recordId, action, oldValues, newValues, req) => {
  const changes = [];
  if (oldValues && newValues) {
    Object.keys(newValues).forEach(key => {
      if (oldValues[key] !== newValues[key]) {
        changes.push(`${key}: ${oldValues[key]} → ${newValues[key]}`);
      }
    });
  }
  
  const changesSummary = changes.length > 0 ? changes.join(', ') : `${action} operation`;
  const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  db.run(
    'INSERT INTO change_logs (user_id, table_name, record_id, action, old_values, new_values, changes_summary, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, tableName, recordId, action, JSON.stringify(oldValues), JSON.stringify(newValues), changesSummary, ipAddress, userAgent],
    function(err) {
      if (err) {
        console.error('Failed to log change:', err);
      }
    }
  );
};

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
      
      // Get user permissions
      getUserPermissions(user.id, (err, permissions) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to get permissions' });
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
          permissions
        });
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
      
      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.user_role
        },
        permissions
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
          logChange(req.user.id, 'users', this.lastID, 'CREATE', null, { username: trimmedUsername, email, full_name, user_role }, req);
          res.status(201).json({ id: this.lastID, username: trimmedUsername, message: 'User created successfully' });
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
        
        logChange(req.user.id, 'users', userId, 'UPDATE', oldUser, { email, full_name, user_role, status }, req);
        
        res.json({ message: 'User updated successfully' });
      }
    );
  });
});

// Delete user (admin only)
router.delete('/users/:id', authenticateToken, authorizePermission('user_management', 'delete'), (req, res) => {
  const userId = req.params.id;
  
  // Prevent deleting own account
  if (userId == req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  // Get user data for change logging
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
      
      logChange(req.user.id, 'users', userId, 'DELETE', user, null, req);
      
      res.json({ message: 'User deleted successfully' });
    });
  });
});

// ====================================
// CHANGE LOGS ENDPOINTS
// ====================================

// Get change logs (admin and provisioner can view)
router.get('/change-logs', authenticateToken, authorizePermission('change_logs', 'view'), (req, res) => {
  const { table_name, user_id, limit = 100, offset = 0 } = req.query;
  
  let query = `
    SELECT cl.*, u.username, u.full_name 
    FROM change_logs cl 
    LEFT JOIN users u ON cl.user_id = u.id
  `;
  let params = [];
  let conditions = [];
  
  if (table_name) {
    conditions.push('cl.table_name = ?');
    params.push(table_name);
  }
  
  if (user_id) {
    conditions.push('cl.user_id = ?');
    params.push(user_id);
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
    'SELECT id, carrier_name FROM carriers WHERE carrier_name LIKE ? AND status = "active" ORDER BY carrier_name LIMIT 10',
    [`%${q}%`],
    (err, carriers) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(carriers);
    }
  );
});

// Create carrier
router.post('/carriers', authenticateToken, authorizePermission('carriers', 'create'), (req, res) => {
  const { carrier_name, previously_known_as, status, region } = req.body;
  
  if (!carrier_name) {
    return res.status(400).json({ error: 'Carrier name is required' });
  }
  
  // Map frontend region values to database values
  const regionMapping = {
    'AMERs': 'North America',
    'APAC': 'Asia Pacific', 
    'EMEA': 'Europe'
  };
  
  const dbRegion = regionMapping[region] || region;
  
  db.run(
    'INSERT INTO carriers (carrier_name, previously_known_as, status, region, created_by) VALUES (?, ?, ?, ?, ?)',
    [carrier_name, previously_known_as, status || 'active', dbRegion, req.user.id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Carrier name already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      
      logChange(req.user.id, 'carriers', this.lastID, 'CREATE', null, { carrier_name, previously_known_as, status, region }, req);
      
      res.status(201).json({ id: this.lastID, carrier_name, message: 'Carrier created successfully' });
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
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Carrier not found' });
        
        logChange(req.user.id, 'carriers', carrierId, 'UPDATE', oldCarrier, { carrier_name, previously_known_as, status, region }, req);
        
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
        
        logChange(req.user.id, 'carriers', carrierId, 'DELETE', carrier, null, req);
        
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
    'INSERT INTO carrier_contacts (carrier_id, contact_type, contact_level, contact_name, contact_function, contact_email, contact_phone, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [carrierId, contact_type, contact_level, contact_name, contact_function, contact_email, contact_phone, notes, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      logChange(req.user.id, 'carrier_contacts', this.lastID, 'CREATE', null, { carrier_id: carrierId, contact_type, contact_level, contact_name, contact_function, contact_email, contact_phone, notes }, req);
      
      res.status(201).json({ id: this.lastID, message: 'Contact created successfully' });
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
      'UPDATE carrier_contacts SET contact_type = ?, contact_level = ?, contact_name = ?, contact_function = ?, contact_email = ?, contact_phone = ?, notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND carrier_id = ?',
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
      
      logChange(req.user.id, 'carrier_contacts', contactId, 'DELETE', contact, null, req);
      
      res.json({ message: 'Contact deleted successfully' });
    });
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
router.get('/network_routes', (req, res) => {
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
router.get('/network_routes/:circuit_id', (req, res) => {
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
  if (!carrierName) {
    return callback(null, true); // Allow empty carrier
  }
  
  db.get(
    'SELECT id FROM carriers WHERE carrier_name = ? AND status = "active"',
    [carrierName],
    (err, row) => {
      if (err) return callback(err);
      callback(null, !!row); // Return true if carrier exists
    }
  );
}

// Create new route
router.post('/network_routes', (req, res) => {
  const data = req.body;
  if (!isValidCircuitId(data.circuit_id)) {
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
    
    const fields = [
      'circuit_id','repository_type_id','outage_tickets_last_30d','maintenance_tickets_last_30d','kmz_file_path','live_latency','expected_latency','test_results_link','cable_system','is_special','underlying_carrier','cost','currency','location_a','location_b','bandwidth','more_details','mtu','sla_latency'
    ];
    const placeholders = fields.map(() => '?').join(',');
    const values = fields.map(f => data[f] ?? (f === 'repository_type_id' ? 1 : null));
    db.run(
      `INSERT INTO network_routes (${fields.join(',')}) VALUES (${placeholders})`,
      values,
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ circuit_id: data.circuit_id });
      }
    );
  });
});

// Update route
router.put('/network_routes/:circuit_id', (req, res) => {
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
    
    const fields = [
      'repository_type_id','outage_tickets_last_30d','maintenance_tickets_last_30d','kmz_file_path','live_latency','expected_latency','test_results_link','cable_system','is_special','underlying_carrier','cost','currency','location_a','location_b','bandwidth','more_details','mtu','sla_latency'
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
        res.json({ message: 'Updated' });
      }
    );
  });
});

// Delete route
router.delete('/network_routes/:circuit_id', (req, res) => {
  const { circuit_id } = req.params;
  db.run('DELETE FROM network_routes WHERE circuit_id = ?', [circuit_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  });
});

// Upload KMZ file and update kmz_file_path for a circuit_id
router.post('/network_routes/:circuit_id/upload_kmz', upload.single('kmz_file'), (req, res) => {
  const { circuit_id } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const kmzPath = req.file.filename;
  db.run(
    'UPDATE network_routes SET kmz_file_path = ? WHERE circuit_id = ?',
    [kmzPath, circuit_id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ message: 'KMZ file uploaded', kmz_file_path: kmzPath });
    }
  );
});

// Export network_routes as CSV
router.get('/network_routes_export', (req, res) => {
  db.all('SELECT circuit_id, outage_tickets_last_30d, maintenance_tickets_last_30d, kmz_file_path, live_latency, expected_latency, test_results_link, cable_system, is_special, underlying_carrier, location_a, location_b, bandwidth, more_details, mtu, sla_latency FROM network_routes', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const fields = ['circuit_id','outage_tickets_last_30d','maintenance_tickets_last_30d','kmz_file_path','live_latency','expected_latency','test_results_link','cable_system','is_special','underlying_carrier','location_a','location_b','bandwidth','more_details','mtu','sla_latency'];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);
    res.header('Content-Type', 'text/csv');
    res.attachment('network_routes.csv');
    res.send(csv);
  });
});

// Search/filter network_routes by query params (visible fields only)
router.get('/network_routes_search', (req, res) => {
  const allowedFields = ['circuit_id','outage_tickets_last_30d','maintenance_tickets_last_30d','kmz_file_path','live_latency','expected_latency','test_results_link','cable_system','is_special','underlying_carrier','location_a','location_b','bandwidth','more_details','mtu','sla_latency'];
  const filters = [];
  const values = [];
  
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
  
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  db.all(`SELECT * FROM network_routes ${where}`, values, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
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
router.post('/dark_fiber_details', (req, res) => {
  const { circuit_id, dwdm_wavelength, dwdm_ucn, equipment, in_use, capex_cost_to_light } = req.body;
  db.run(
    'INSERT INTO dark_fiber_details (circuit_id, dwdm_wavelength, dwdm_ucn, equipment, in_use, capex_cost_to_light) VALUES (?, ?, ?, ?, ?, ?)',
    [circuit_id, dwdm_wavelength, dwdm_ucn, equipment, in_use ? 1 : 0, capex_cost_to_light],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

// Edit a dark fiber detail by id
router.put('/dark_fiber_details/:id', (req, res) => {
  const { dwdm_wavelength, dwdm_ucn, equipment, in_use, capex_cost_to_light } = req.body;
  db.run(
    'UPDATE dark_fiber_details SET dwdm_wavelength = ?, dwdm_ucn = ?, equipment = ?, in_use = ?, capex_cost_to_light = ? WHERE id = ?',
    [dwdm_wavelength, dwdm_ucn, equipment, in_use ? 1 : 0, capex_cost_to_light, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ message: 'Updated' });
    }
  );
});

// Delete a dark fiber detail by id
router.delete('/dark_fiber_details/:id', (req, res) => {
  db.run('DELETE FROM dark_fiber_details WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  });
});

// Reserve a DWDM UCN for 60 days
router.post('/dark_fiber_details/:id/reserve', (req, res) => {
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
      
      // Log the reservation
      db.get('SELECT * FROM dark_fiber_details WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run(
          'INSERT INTO reservation_logs (dark_fiber_id, circuit_id, dwdm_ucn, action, reserved_by, expiry_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, row.circuit_id, row.dwdm_ucn, 'RESERVED', reserved_by, expiresAt.toISOString(), '60-day reservation'],
          function(logErr) {
            if (logErr) console.error('Failed to log reservation:', logErr);
          }
        );
      });
      
      res.json({ 
        message: 'Reserved successfully', 
        reserved_at: reservedAt.toISOString(),
        expires_at: expiresAt.toISOString()
      });
    }
  );
});

// Release a reservation
router.post('/dark_fiber_details/:id/release', (req, res) => {
  const { id } = req.params;
  const { released_by } = req.body;
  
  db.run(
    'UPDATE dark_fiber_details SET is_reserved = 0, reserved_at = NULL, reserved_by = NULL, reservation_expires_at = NULL WHERE id = ? AND is_reserved = 1',
    [id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(400).json({ error: 'Cannot release - not reserved or not found' });
      
      // Log the release
      db.get('SELECT * FROM dark_fiber_details WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run(
          'INSERT INTO reservation_logs (dark_fiber_id, circuit_id, dwdm_ucn, action, reserved_by, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [id, row.circuit_id, row.dwdm_ucn, 'RELEASED', released_by || 'Unknown', 'Manual release'],
          function(logErr) {
            if (logErr) console.error('Failed to log release:', logErr);
          }
        );
      });
      
      res.json({ message: 'Released successfully' });
    }
  );
});

// Upload Test Results files (multiple files support)
router.post('/network_routes/:circuit_id/upload_test_results', testResultsUpload.array('test_results_files', 10), (req, res) => {
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
        
        res.json({ message: 'Test Results files uploaded', files: results });
      })
      .catch(err => {
        res.status(500).json({ error: err.message });
      });
  });
});

// Get all test results files for a circuit
router.get('/network_routes/:circuit_id/test_results_files', (req, res) => {
  const { circuit_id } = req.params;
  db.all('SELECT * FROM test_results_files WHERE circuit_id = ? ORDER BY uploaded_at DESC', [circuit_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Download Test Results files as ZIP
router.get('/network_routes/:circuit_id/download_test_results', (req, res) => {
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
router.delete('/test_results_files/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM test_results_files WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'File not found' });
    
    const circuitId = row.circuit_id;
    
    // Delete from filesystem
    const filePath = path.join(testResultsDir, row.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete from database
    db.run('DELETE FROM test_results_files WHERE id = ?', [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
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
  const { location_code, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info } = req.body;
  
  if (!location_code || !city || !country) {
    return res.status(400).json({ error: 'Location code, city, and country are required' });
  }
  
  db.run(
    'INSERT INTO location_reference (location_code, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [location_code, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type || 'Tier 1', status || 'Active', provider, access_info, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      logChange(req.user.id, 'location_reference', this.lastID, 'CREATE', null, { location_code, city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info }, req);
      
      res.status(201).json({ id: this.lastID, location_code });
    }
  );
});

// Update location
router.put('/locations/:id', authenticateToken, authorizePermission('locations', 'edit'), (req, res) => {
  const { city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info } = req.body;
  const locationId = req.params.id;
  
  // Get current location data for change logging
  db.get('SELECT * FROM location_reference WHERE id = ?', [locationId], (err, oldLocation) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldLocation) return res.status(404).json({ error: 'Location not found' });
    
    db.run(
      'UPDATE location_reference SET city = ?, country = ?, datacenter_name = ?, datacenter_address = ?, latitude = ?, longitude = ?, time_zone = ?, pop_type = ?, status = ?, provider = ?, access_info = ?, updated_by = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ?',
      [city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info, req.user.id, locationId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Location not found' });
        
        logChange(req.user.id, 'location_reference', locationId, 'UPDATE', oldLocation, { city, country, datacenter_name, datacenter_address, latitude, longitude, time_zone, pop_type, status, provider, access_info }, req);
        
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
      
      logChange(req.user.id, 'location_reference', locationId, 'DELETE', location, null, req);
      
      res.json({ message: 'Location deleted' });
    });
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
        transport_only_pop: false
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
         csp_on_ramp = ?, exchange_on_ramp = ?, internet_on_ramp = ?, transport_only_pop = ?,
         updated_by = ? WHERE location_id = ?`,
        [
          capabilities.cnx_extranet_wan, capabilities.cnx_ethernet, capabilities.cnx_voice, capabilities.tdm_gateway,
          capabilities.cnx_unigy, capabilities.cnx_alpha, capabilities.cnx_chrono, capabilities.cnx_sdwan,
          capabilities.csp_on_ramp, capabilities.exchange_on_ramp, capabilities.internet_on_ramp, capabilities.transport_only_pop,
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
         cnx_unigy, cnx_alpha, cnx_chrono, cnx_sdwan, csp_on_ramp, exchange_on_ramp, internet_on_ramp, transport_only_pop, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          locationId, capabilities.cnx_extranet_wan, capabilities.cnx_ethernet, capabilities.cnx_voice, capabilities.tdm_gateway,
          capabilities.cnx_unigy, capabilities.cnx_alpha, capabilities.cnx_chrono, capabilities.cnx_sdwan,
          capabilities.csp_on_ramp, capabilities.exchange_on_ramp, capabilities.internet_on_ramp, capabilities.transport_only_pop,
          req.user.id
        ],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          logChange(req.user.id, 'pop_capabilities', this.lastID, 'CREATE', null, capabilities, req);
          
          res.status(201).json({ id: this.lastID, message: 'POP capabilities created' });
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

router.post('/exchange_rates', (req, res) => {
  const { currency_code, exchange_rate, updated_by } = req.body;
  const nextUpdate = new Date();
  nextUpdate.setDate(nextUpdate.getDate() + 30);
  
  db.run(
    'INSERT INTO exchange_rates (currency_code, exchange_rate, next_update_due, updated_by) VALUES (?, ?, ?, ?)',
    [currency_code, exchange_rate, nextUpdate.toISOString(), updated_by],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, currency_code });
    }
  );
});

router.put('/exchange_rates/:id', (req, res) => {
  const { exchange_rate, updated_by } = req.body;
  const nextUpdate = new Date();
  nextUpdate.setDate(nextUpdate.getDate() + 30);
  
  db.run(
    'UPDATE exchange_rates SET exchange_rate = ?, last_updated = CURRENT_TIMESTAMP, next_update_due = ?, updated_by = ? WHERE id = ?',
    [exchange_rate, nextUpdate.toISOString(), updated_by, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Exchange rate not found' });
      res.json({ message: 'Exchange rate updated' });
    }
  );
});

// Network Design Path Finding with Dijkstra Algorithm
router.post('/network_design/find_path', (req, res) => {
  const { source, destination, bandwidth, bandwidth_unit, constraints = {} } = req.body;
  const startTime = Date.now();
  
  // Validate inputs
  if (!source || !destination) {
    return res.status(400).json({ error: 'Source and destination are required' });
  }
  
  if (source === destination) {
    return res.status(400).json({ error: 'Source and destination cannot be the same' });
  }
  
  // Get all network routes to build graph
  db.all('SELECT * FROM network_routes WHERE location_a IS NOT NULL AND location_b IS NOT NULL', [], (err, routes) => {
    if (err) return res.status(500).json({ error: err.message });
    
    console.log(`\n=== PATH FINDING DEBUG ===`);
    console.log(`Source: ${source}, Destination: ${destination}`);
    console.log(`Total routes found: ${routes.length}`);
    
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
      let bandwidthWarning = false;
      if (bandwidth && routeBandwidthMbps && parseFloat(routeBandwidthMbps) < parseFloat(bandwidth)) {
        if (isRelevant) console.log(`  SKIPPED: Bandwidth too low (${routeBandwidthMbps} Mbps < ${bandwidth} Mbps)`);
        routesSkipped++;
        return;
      }
      
      // Skip routes with carrier constraints
      if (constraints.carrier_avoidance && underlying_carrier && 
          constraints.carrier_avoidance.includes(underlying_carrier)) {
        if (isRelevant) console.log(`  SKIPPED: Carrier avoided (${underlying_carrier})`);
        routesSkipped++;
        return;
      }

      // Skip routes that don't meet MTU requirements
      const mtuRequired = constraints.mtu_required || 1500; // Default to 1500 if not specified
      const routeMtu = route.mtu || 9212; // Default to 9212 if not specified in route
      
      if (routeMtu < mtuRequired) {
        if (isRelevant) console.log(`  SKIPPED: MTU too low (${routeMtu} < ${mtuRequired})`);
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
    
    console.log(`\n=== GRAPH CONSTRUCTION COMPLETE ===`);
    console.log(`Routes processed: ${routesProcessed}, Routes skipped: ${routesSkipped}`);
    console.log(`Total locations in graph: ${Object.keys(graph).length}`);
    console.log(`All locations: ${Object.keys(graph).join(', ')}`);
    
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
      return res.status(404).json({ error: `Source location ${source} not found in network` });
    }
    
    if (!graph[destination]) {
      return res.status(404).json({ error: `Destination location ${destination} not found in network` });
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
      return res.status(404).json({ error: 'No route found between source and destination' });
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
    if (constraints.protection_required) {
      // Create modified graph without primary path edges
      const modifiedGraph = JSON.parse(JSON.stringify(graph));
      
      for (let i = 0; i < primaryPath.path.length - 1; i++) {
        const from = primaryPath.path[i];
        const to = primaryPath.path[i + 1];
        delete modifiedGraph[from][to];
        delete modifiedGraph[to][from];
      }
      
      diversePath = dijkstra(modifiedGraph, source, destination);
    }
    
    const executionTime = Date.now() - startTime;
    
    // Log the search
    db.run(
      'INSERT INTO audit_logs (action_type, parameters, results, execution_time) VALUES (?, ?, ?, ?)',
      [
        'PATH_SEARCH',
        JSON.stringify({ source, destination, bandwidth, bandwidth_unit, constraints }),
        JSON.stringify({ primaryPath, diversePath, totalCost }),
        executionTime
      ],
      function(err) {
        if (err) console.error('Failed to log search:', err);
      }
    );
    
    res.json({
      request: {
        source,
        destination,
        bandwidth,
        bandwidth_unit,
        constraints
      },
      primaryPath: {
        ...primaryPath,
        route: routeDetails,
        totalCost,
        currencies: Array.from(currencies)
      },
      diversePath,
      executionTime,
      timestamp: new Date().toISOString()
    });
  });
});

// Network Design with Pricing
router.post('/network_design/calculate_pricing', (req, res) => {
  const { paths, contract_term = 12, output_currency = 'USD', include_ull = false } = req.body;
  
  if (!paths || !Array.isArray(paths)) {
    return res.status(400).json({ error: 'Paths array is required' });
  }
  
  // Get exchange rates
  db.all('SELECT * FROM exchange_rates WHERE status = "Active"', [], (err, rates) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const exchangeRates = {};
    rates.forEach(rate => {
      exchangeRates[rate.currency_code] = rate.exchange_rate;
    });
    
    // Calculate pricing for each path
    const pricingResults = paths.map(path => {
      let totalMonthlyCost = 0;
      let totalSetupCost = 0;
      
      if (path.route) {
        path.route.forEach(segment => {
          let segmentCost = parseFloat(segment.cost) || 0;
          const segmentCurrency = segment.currency || 'USD';
          
          // Convert to output currency
          if (segmentCurrency !== output_currency && exchangeRates[segmentCurrency]) {
            segmentCost = segmentCost / exchangeRates[segmentCurrency];
            if (output_currency !== 'USD' && exchangeRates[output_currency]) {
              segmentCost = segmentCost * exchangeRates[output_currency];
            }
          }
          
          totalMonthlyCost += segmentCost;
          totalSetupCost += segmentCost * 0.5; // Assume 50% setup cost
        });
      }
      
      // Apply ULL charges if requested
      if (include_ull) {
        totalMonthlyCost += totalMonthlyCost * 0.15; // 15% ULL premium
        totalSetupCost += totalMonthlyCost * 0.25; // 25% ULL setup
      }
      
      // Apply contract term discounts
      let termDiscount = 0;
      if (contract_term >= 36) termDiscount = 0.20; // 20% discount for 3+ years
      else if (contract_term >= 24) termDiscount = 0.15; // 15% discount for 2+ years
      else if (contract_term >= 12) termDiscount = 0.10; // 10% discount for 1+ year
      
      const discountedMonthlyCost = totalMonthlyCost * (1 - termDiscount);
      const totalContractValue = discountedMonthlyCost * contract_term + totalSetupCost;
      
      return {
        path: path.path,
        totalLatency: path.totalLatency,
        hops: path.hops,
        pricing: {
          monthlyCost: Math.round(discountedMonthlyCost * 100) / 100,
          setupCost: Math.round(totalSetupCost * 100) / 100,
          totalContractValue: Math.round(totalContractValue * 100) / 100,
          currency: output_currency,
          termDiscount: termDiscount * 100,
          contractTerm: contract_term,
          includeULL: include_ull
        }
      };
    });
    
    // Log pricing calculation
    db.run(
      'INSERT INTO audit_logs (action_type, parameters, pricing_data) VALUES (?, ?, ?)',
      [
        'PRICING_CALCULATION',
        JSON.stringify({ contract_term, output_currency, include_ull }),
        JSON.stringify(pricingResults)
      ],
      function(err) {
        if (err) console.error('Failed to log pricing calculation:', err);
      }
    );
    
    res.json({
      results: pricingResults,
      exchangeRates: exchangeRates,
      timestamp: new Date().toISOString()
    });
  });
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
router.post('/network_design/save_search', (req, res) => {
  const { search_name, source_location, destination_location, bandwidth_required, 
          bandwidth_unit, include_ull, protection_required, max_latency, 
          carrier_avoidance, output_currency, contract_term, search_results } = req.body;
  
  db.run(
    'INSERT INTO network_design_searches (search_name, source_location, destination_location, bandwidth_required, bandwidth_unit, include_ull, protection_required, max_latency, carrier_avoidance, output_currency, contract_term, search_results) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [search_name, source_location, destination_location, bandwidth_required, bandwidth_unit, include_ull, protection_required, max_latency, carrier_avoidance, output_currency, contract_term, JSON.stringify(search_results)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, message: 'Search saved successfully' });
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

router.delete('/network_design/saved_searches/:id', (req, res) => {
  db.run('DELETE FROM network_design_searches WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Search not found' });
    res.json({ message: 'Search deleted successfully' });
  });
});

// Get audit logs for Network Design Tool
router.get('/network_design/audit_logs', (req, res) => {
  db.all('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const logs = rows.map(row => ({
      ...row,
      parameters: row.parameters ? JSON.parse(row.parameters) : null,
      results: row.results ? JSON.parse(row.results) : null,
      pricing_data: row.pricing_data ? JSON.parse(row.pricing_data) : null
    }));
    res.json(logs);
  });
});

// Download KMZ file
router.get('/download_kmz/:filename', (req, res) => {
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

module.exports = router; 