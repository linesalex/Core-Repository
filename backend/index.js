const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;
const routes = require('./routes');
const { handleDatabaseError } = require('./dbErrorHandler');

app.use(cors());
app.use(express.json());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    message: 'Network Inventory Backend API',
    version: '2.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      database: '/health/database',
      login: '/login'
    }
  });
});

app.use('/', routes);

// Database error handling middleware (must be after routes)
app.use(handleDatabaseError);

// General error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'An unexpected error occurred',
    type: 'INTERNAL_ERROR',
    retryable: false,
    timestamp: new Date().toISOString()
  });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    type: 'NOT_FOUND',
    retryable: false,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Network Inventory Server running on port ${PORT}`);
  console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
  console.log(`🔍 Database health check: http://localhost:${PORT}/health/database`);
  console.log(`🌐 API Root: http://localhost:${PORT}/`);
}); 