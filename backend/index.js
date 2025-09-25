// 🔓 IGNORE SSL CERTIFICATE ERRORS GLOBALLY
// Required for self-signed certificates in live latency APIs
// This affects all HTTPS requests made by the Node.js process
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;
const routes = require('./routes');
const { handleDatabaseError } = require('./dbErrorHandler');
const outageMonitor = require('./outageMonitorService');
const liveLatencyAutoRefresh = require('./liveLatencyAutoRefreshService');
const outageHistoryCleanup = require('./outageHistoryCleanupService');

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
  
  // Start the outage monitoring service
  setTimeout(() => {
    outageMonitor.start();
  }, 5000); // Wait 5 seconds for server to fully initialize
  
  // Start the automated live latency refresh service
  setTimeout(() => {
    liveLatencyAutoRefresh.start();
  }, 7000); // Wait 7 seconds to avoid conflicts with outage monitor
  
  // Start the outage history cleanup service
  setTimeout(() => {
    outageHistoryCleanup.start();
  }, 9000); // Wait 9 seconds to avoid conflicts with other services
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  outageMonitor.stop();
  liveLatencyAutoRefresh.stop();
  outageHistoryCleanup.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  outageMonitor.stop();
  liveLatencyAutoRefresh.stop();
  outageHistoryCleanup.stop();
  process.exit(0);
}); 