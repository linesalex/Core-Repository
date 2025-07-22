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

// Permission-based authorization middleware
const authorizePermission = (moduleName, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has permission for this module and action
    db.get(
      'SELECT * FROM role_permissions WHERE role_name = ? AND module_name = ?',
      [req.user.role, moduleName],
      (err, permission) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!permission) {
          return res.status(403).json({ error: 'No permissions found for this module' });
        }

        let hasPermission = false;
        switch (action) {
          case 'view':
            hasPermission = permission.can_view;
            break;
          case 'create':
            hasPermission = permission.can_create;
            break;
          case 'edit':
            hasPermission = permission.can_edit;
            break;
          case 'delete':
            hasPermission = permission.can_delete;
            break;
          default:
            hasPermission = false;
        }

        if (!hasPermission) {
          return res.status(403).json({ error: `Insufficient permissions for ${action} on ${moduleName}` });
        }

        next();
      }
    );
  };
};

// Get user permissions
const getUserPermissions = (userId, callback) => {
  db.get('SELECT user_role FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return callback(err);
    if (!user) return callback(new Error('User not found'));

    db.all(
      'SELECT module_name, can_view, can_create, can_edit, can_delete FROM role_permissions WHERE role_name = ?',
      [user.user_role],
      (err, permissions) => {
        if (err) return callback(err);
        
        const permissionMap = {};
        permissions.forEach(perm => {
          permissionMap[perm.module_name] = {
            can_view: perm.can_view,
            can_create: perm.can_create,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete
          };
        });
        
        callback(null, permissionMap);
      }
    );
  });
};

// Get user permissions with module visibility
const getUserPermissionsWithVisibility = (userId, callback) => {
  db.get('SELECT user_role FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return callback(err);
    if (!user) return callback(new Error('User not found'));

    // Get role-based permissions
    db.all(
      'SELECT module_name, can_view, can_create, can_edit, can_delete FROM role_permissions WHERE role_name = ?',
      [user.user_role],
      (err, permissions) => {
        if (err) return callback(err);
        
        // Get user-specific module visibility settings
        db.all(
          'SELECT module_name, is_visible FROM user_module_visibility WHERE user_id = ?',
          [userId],
          (err, visibilitySettings) => {
            if (err) return callback(err);
            
            const permissionMap = {};
            const visibilityMap = {};
            
            // Build permission map
            permissions.forEach(perm => {
              permissionMap[perm.module_name] = {
                can_view: perm.can_view,
                can_create: perm.can_create,
                can_edit: perm.can_edit,
                can_delete: perm.can_delete
              };
            });
            
            // Build visibility map - default all modules to visible
            const allModules = [
              'network_routes', 'network_design', 'locations', 'carriers', 'cnx_colocation',
              'exchange_rates', 'exchange_data', 'change_logs', 'user_management', 
              'bulk_upload', 'core_outages', 'minimum_pricing', 'pricing_logic', 'promo_pricing'
            ];
            
            // Set all modules to visible by default
            allModules.forEach(module => {
              visibilityMap[module] = true;
            });
            
            // Also include any modules from permissions table
            permissions.forEach(perm => {
              visibilityMap[perm.module_name] = true;
            });
            
            // Override with user-specific visibility settings
            visibilitySettings.forEach(vis => {
              visibilityMap[vis.module_name] = !!vis.is_visible;
            });
            
            callback(null, { permissions: permissionMap, visibility: visibilityMap });
          }
        );
      }
    );
  });
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
  authorizePermission,
  getUserPermissions,
  getUserPermissionsWithVisibility,
  logUserActivity
}; 