const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('./db');

// JWT secret key (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set in production!');
    process.exit(1);
  }
  // Generate a secure random secret for development only
  const crypto = require('crypto');
  const devSecret = crypto.randomBytes(64).toString('hex');
  console.warn('WARNING: Using generated JWT secret for development. Set JWT_SECRET environment variable for production.');
  return devSecret;
})();

// Hash password
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      full_name: user.full_name || user.username,
      role: user.user_role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Role-based authorization middleware
const authorizeRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (Array.isArray(requiredRoles)) {
      if (!requiredRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    } else if (req.user.role !== requiredRoles) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Get user module permissions (per-module system)
const getUserModulePermissions = (userId, callback) => {
  db.get('SELECT user_role FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return callback(err);
    if (!user) return callback(new Error('User not found'));

    // Administrators get full access implicitly
    if (user.user_role === 'administrator') {
      const allModules = [
        'network_routes', 'network_design', 'locations', 'carriers', 'cnx_colocation',
        'exchange_rates', 'exchange_data', 'change_logs', 'user_management', 
        'bulk_upload', 'core_outages', 'minimum_pricing', 'pricing_logic', 'promo_pricing',
        'allocated_cost_calculator', 'kmz_viewer', 'route_finder'
      ];
      
      const permissionMap = {};
      allModules.forEach(module => {
        permissionMap[module] = 'provisioner'; // Admins have full access
      });
      
      return callback(null, permissionMap);
    }

    // Non-admin users: get per-module permissions
    db.all(
      'SELECT module_name, permission_level FROM user_module_permissions WHERE user_id = ?',
      [userId],
      (err, permissions) => {
        if (err) return callback(err);
        
        const permissionMap = {};
        permissions.forEach(perm => {
          permissionMap[perm.module_name] = perm.permission_level;
        });
        
        callback(null, permissionMap);
      }
    );
  });
};

// Check if user has required permission level for a module
const hasModulePermission = (userId, moduleName, requiredLevel, callback) => {
  db.get('SELECT user_role FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return callback(err, false);
    if (!user) return callback(new Error('User not found'), false);

    // Administrators always have access
    if (user.user_role === 'administrator') {
      return callback(null, true);
    }

    // Check user's permission for this module
    db.get(
      'SELECT permission_level FROM user_module_permissions WHERE user_id = ? AND module_name = ?',
      [userId, moduleName],
      (err, permission) => {
        if (err) return callback(err, false);
        if (!permission) return callback(null, false); // No permission assigned
        
        // Check if permission level is sufficient
        if (requiredLevel === 'read_only') {
          // Any permission level is sufficient for read-only
          callback(null, true);
        } else if (requiredLevel === 'provisioner') {
          // Only provisioner level is sufficient
          callback(null, permission.permission_level === 'provisioner');
        } else {
          callback(null, false);
        }
      }
    );
  });
};

// Module-based authorization middleware
const authorizeModulePermission = (moduleName, requiredLevel = 'read_only') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    hasModulePermission(req.user.id, moduleName, requiredLevel, (err, hasPermission) => {
      if (err) {
        console.error('Permission check error:', err);
        return res.status(500).json({ error: 'Permission check failed' });
      }

      if (!hasPermission) {
        // Don't return error - frontend will hide features instead
        // This allows for graceful degradation
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          module: moduleName,
          required: requiredLevel
        });
      }

      next();
    });
  };
};

// Log user activity
const logUserActivity = (userId, action, details = {}) => {
  const userAgent = details.userAgent || 'Unknown';
  const ipAddress = details.ipAddress || 'Unknown';
  
  db.run(
    'INSERT INTO change_logs (user_id, table_name, record_id, action, new_values, changes_summary, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, 'user_activity', userId, action, JSON.stringify(details), `User ${action}`, ipAddress, userAgent],
    function(err) {
      if (err) {
        console.error('Failed to log user activity:', err);
      }
    }
  );
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  authenticateToken,
  authorizeRole,
  getUserModulePermissions,
  hasModulePermission,
  authorizeModulePermission,
  logUserActivity
}; 