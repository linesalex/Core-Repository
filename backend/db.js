const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../network_routes.db');

// Database connection state
let db = null;
let connectionAttempts = 0;
const maxRetries = 3;
const retryDelay = 1000; // 1 second

// Enhanced database error types
const DatabaseErrorTypes = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  DATABASE_LOCKED: 'DATABASE_LOCKED',
  DISK_FULL: 'DISK_FULL',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  GENERAL_ERROR: 'GENERAL_ERROR'
};

// Classify database errors
function classifyDatabaseError(error) {
  if (!error) return null;
  
  const errorCode = error.code;
  const errorMessage = error.message?.toLowerCase() || '';
  
  if (errorCode === 'SQLITE_CANTOPEN' || errorMessage.includes('permission denied')) {
    return DatabaseErrorTypes.PERMISSION_DENIED;
  }
  if (errorCode === 'SQLITE_BUSY' || errorCode === 'SQLITE_LOCKED' || errorMessage.includes('locked')) {
    return DatabaseErrorTypes.DATABASE_LOCKED;
  }
  if (errorCode === 'SQLITE_FULL' || errorMessage.includes('disk') || errorMessage.includes('space')) {
    return DatabaseErrorTypes.DISK_FULL;
  }
  if (errorCode === 'SQLITE_CONSTRAINT' || errorMessage.includes('constraint')) {
    return DatabaseErrorTypes.CONSTRAINT_VIOLATION;
  }
  if (errorMessage.includes('connect') || errorMessage.includes('open')) {
    return DatabaseErrorTypes.CONNECTION_FAILED;
  }
  
  return DatabaseErrorTypes.GENERAL_ERROR;
}

// Create user-friendly error messages
function createUserFriendlyError(errorType, originalError) {
  const baseMessage = 'Database operation failed';
  
  switch (errorType) {
    case DatabaseErrorTypes.CONNECTION_FAILED:
      return {
        message: 'Unable to connect to the database. Please try again in a moment.',
        type: 'CONNECTION_ERROR',
        retryable: true
      };
    case DatabaseErrorTypes.DATABASE_LOCKED:
      return {
        message: 'Database is temporarily busy. Please try again in a few seconds.',
        type: 'TEMPORARY_ERROR',
        retryable: true
      };
    case DatabaseErrorTypes.DISK_FULL:
      return {
        message: 'Storage space is full. Please contact your administrator.',
        type: 'STORAGE_ERROR',
        retryable: false
      };
    case DatabaseErrorTypes.PERMISSION_DENIED:
      return {
        message: 'Database access denied. Please contact your administrator.',
        type: 'PERMISSION_ERROR',
        retryable: false
      };
    case DatabaseErrorTypes.CONSTRAINT_VIOLATION:
      return {
        message: originalError.message.includes('UNIQUE') 
          ? 'This record already exists. Please check your data and try again.'
          : 'Data validation failed. Please check your input and try again.',
        type: 'VALIDATION_ERROR',
        retryable: false
      };
    default:
      return {
        message: 'A database error occurred. Please try again or contact support.',
        type: 'GENERAL_ERROR',
        retryable: true
      };
  }
}

// Initialize database connection with retry logic
function initializeDatabase(callback) {
  connectionAttempts++;
  
  console.log(`Database connection attempt ${connectionAttempts}/${maxRetries}...`);
  
  // Check if database file exists and is accessible
  try {
    if (!fs.existsSync(dbPath)) {
      const error = new Error(`Database file not found at ${dbPath}`);
      error.code = 'ENOENT';
      if (callback) callback(error);
      return;
    }
    
    // Check file permissions
    fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
  } catch (err) {
    console.error('Database file access error:', err.message);
    const userError = createUserFriendlyError(classifyDatabaseError(err), err);
    if (callback) callback(err, null, userError);
    return;
  }
  
  db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      console.error(`Database connection failed (attempt ${connectionAttempts}):`, err.message);
      
      const errorType = classifyDatabaseError(err);
      const userError = createUserFriendlyError(errorType, err);
      
      // Retry logic for retryable errors
      if (userError.retryable && connectionAttempts < maxRetries) {
        console.log(`Retrying database connection in ${retryDelay}ms...`);
        setTimeout(() => {
          initializeDatabase(callback);
        }, retryDelay);
        return;
      }
      
      if (callback) callback(err, null, userError);
    } else {
      console.log('✅ Connected to SQLite database successfully');
      connectionAttempts = 0; // Reset counter on successful connection
      
      // Test the connection with a simple query
      db.get('SELECT 1 as test', (testErr) => {
        if (testErr) {
          console.error('Database connection test failed:', testErr.message);
          const errorType = classifyDatabaseError(testErr);
          const userError = createUserFriendlyError(errorType, testErr);
          if (callback) callback(testErr, null, userError);
        } else {
          console.log('✅ Database connection test passed');
          if (callback) callback(null, db);
        }
      });
    }
  });
}

// Database wrapper with enhanced error handling
const dbWrapper = {
  // Get database instance
  getInstance: () => db,
  
  // Check if database is connected
  isConnected: () => db !== null,
  
  // Execute query with enhanced error handling
  run: (sql, params, callback) => {
    if (!db) {
      const error = new Error('Database not connected');
      const userError = createUserFriendlyError(DatabaseErrorTypes.CONNECTION_FAILED, error);
      if (callback) callback(error, null, userError);
      return;
    }
    
    db.run(sql, params, function(err) {
      if (err) {
        const errorType = classifyDatabaseError(err);
        const userError = createUserFriendlyError(errorType, err);
        console.error('Database RUN error:', err.message);
        if (callback) callback(err, null, userError);
      } else {
        if (callback) callback(null, this);
      }
    });
  },
  
  // Get single row with enhanced error handling
  get: (sql, params, callback) => {
    if (!db) {
      const error = new Error('Database not connected');
      const userError = createUserFriendlyError(DatabaseErrorTypes.CONNECTION_FAILED, error);
      if (callback) callback(error, null, userError);
      return;
    }
    
    db.get(sql, params, (err, row) => {
      if (err) {
        const errorType = classifyDatabaseError(err);
        const userError = createUserFriendlyError(errorType, err);
        console.error('Database GET error:', err.message);
        if (callback) callback(err, null, userError);
      } else {
        if (callback) callback(null, row);
      }
    });
  },
  
  // Get multiple rows with enhanced error handling
  all: (sql, params, callback) => {
    if (!db) {
      const error = new Error('Database not connected');
      const userError = createUserFriendlyError(DatabaseErrorTypes.CONNECTION_FAILED, error);
      if (callback) callback(error, null, userError);
      return;
    }
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        const errorType = classifyDatabaseError(err);
        const userError = createUserFriendlyError(errorType, err);
        console.error('Database ALL error:', err.message);
        if (callback) callback(err, null, userError);
      } else {
        if (callback) callback(null, rows);
      }
    });
  },
  
  // Execute multiple statements
  exec: (sql, callback) => {
    if (!db) {
      const error = new Error('Database not connected');
      const userError = createUserFriendlyError(DatabaseErrorTypes.CONNECTION_FAILED, error);
      if (callback) callback(error, userError);
      return;
    }
    
    db.exec(sql, (err) => {
      if (err) {
        const errorType = classifyDatabaseError(err);
        const userError = createUserFriendlyError(errorType, err);
        console.error('Database EXEC error:', err.message);
        if (callback) callback(err, userError);
      } else {
        if (callback) callback(null);
      }
    });
  },
  
  // Health check
  healthCheck: (callback) => {
    if (!db) {
      const error = new Error('Database not connected');
      const userError = createUserFriendlyError(DatabaseErrorTypes.CONNECTION_FAILED, error);
      if (callback) callback(error, userError);
      return;
    }
    
    const startTime = Date.now();
    db.get('SELECT 1 as health_check, datetime("now") as server_time', (err, result) => {
      const responseTime = Date.now() - startTime;
      
      if (err) {
        const errorType = classifyDatabaseError(err);
        const userError = createUserFriendlyError(errorType, err);
        console.error('Database health check failed:', err.message);
        if (callback) callback(err, userError);
      } else {
        if (callback) callback(null, {
          status: 'healthy',
          responseTime: `${responseTime}ms`,
          serverTime: result.server_time,
          connectionState: 'connected'
        });
      }
    });
  },
  
  // Close database connection
  close: (callback) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('Database connection closed');
        }
        db = null;
        if (callback) callback(err);
      });
    } else if (callback) {
      callback(null);
    }
  }
};

// Initialize database on module load
initializeDatabase((err, database, userError) => {
  if (err) {
    console.error('❌ Failed to initialize database:', userError?.message || err.message);
    // Don't exit the process - allow the app to start and show connection errors
  }
});

// Export the enhanced database wrapper
module.exports = dbWrapper;

// Also export the raw database instance for backward compatibility
module.exports.raw = () => db;

// Export error handling utilities
module.exports.DatabaseErrorTypes = DatabaseErrorTypes;
module.exports.classifyDatabaseError = classifyDatabaseError;
module.exports.createUserFriendlyError = createUserFriendlyError; 