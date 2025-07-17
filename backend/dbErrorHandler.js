const { classifyDatabaseError, createUserFriendlyError } = require('./db');

// Database error handling middleware
const handleDatabaseError = (err, req, res, next) => {
  // If this isn't a database error, pass it to the next error handler
  if (!err || typeof err !== 'object') {
    return next(err);
  }

  // Log the error for debugging
  console.error('Database Error Handler:', {
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString(),
    endpoint: req.originalUrl,
    method: req.method,
    user: req.user?.username || 'anonymous'
  });

  // Classify and create user-friendly error
  const errorType = classifyDatabaseError(err);
  const userError = createUserFriendlyError(errorType, err);

  // Determine HTTP status code based on error type
  let statusCode = 500;
  switch (userError.type) {
    case 'CONNECTION_ERROR':
    case 'TEMPORARY_ERROR':
      statusCode = 503; // Service Unavailable
      break;
    case 'VALIDATION_ERROR':
      statusCode = 400; // Bad Request
      break;
    case 'PERMISSION_ERROR':
      statusCode = 403; // Forbidden
      break;
    case 'STORAGE_ERROR':
      statusCode = 507; // Insufficient Storage
      break;
    default:
      statusCode = 500; // Internal Server Error
  }

  // Send user-friendly error response
  res.status(statusCode).json({
    error: userError.message,
    type: userError.type,
    retryable: userError.retryable,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      debug: {
        originalError: err.message,
        errorCode: err.code
      }
    })
  });
};

// Helper function to handle database operations with consistent error handling
const executeWithErrorHandling = (operation, req, res, next) => {
  try {
    operation((err, result, userError) => {
      if (err) {
        // If we have a user error from the database wrapper, use it
        if (userError) {
          return handleDatabaseError(err, req, res, next);
        }
        // Otherwise, create one
        const dbError = new Error(err.message);
        dbError.code = err.code;
        return handleDatabaseError(dbError, req, res, next);
      }
      
      // Operation succeeded, continue with normal flow
      req.dbResult = result;
      next();
    });
  } catch (error) {
    handleDatabaseError(error, req, res, next);
  }
};

// Async wrapper for database operations
const asyncDbOperation = (operation) => {
  return (req, res, next) => {
    executeWithErrorHandling(operation, req, res, next);
  };
};

// Helper to create standardized success responses
const createSuccessResponse = (data, message = 'Operation completed successfully') => {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

// Helper to create paginated responses
const createPaginatedResponse = (data, total, page = 1, limit = 50) => {
  return {
    success: true,
    data,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1
    },
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  handleDatabaseError,
  executeWithErrorHandling,
  asyncDbOperation,
  createSuccessResponse,
  createPaginatedResponse
}; 