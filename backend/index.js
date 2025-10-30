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
const { runAllMigrations } = require('./runMigrations');
const db = require('./db');
const outageMonitor = require('./outageMonitorService');
const liveLatencyAutoRefresh = require('./liveLatencyAutoRefreshService');
const outageHistoryCleanup = require('./outageHistoryCleanupService');
const walCheckpoint = require('./walCheckpointService');

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
    version: '3.3.1',
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

// Run database migrations before starting the server
runAllMigrations((err) => {
  if (err) {
    console.error('❌ Failed to run migrations:', err);
    console.error('⚠️  Server starting anyway, but some features may not work correctly');
  }
  
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
    
    // Start the WAL checkpoint service
    setTimeout(() => {
      walCheckpoint.start();
    }, 11000); // Wait 11 seconds to avoid conflicts with other services
  });
});

// Graceful shutdown handler
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  // Stop all background services
  console.log('⏸️  Stopping background services...');
  outageMonitor.stop();
  liveLatencyAutoRefresh.stop();
  outageHistoryCleanup.stop();
  walCheckpoint.stop();
  
  // Perform final WAL checkpoint
  console.log('💾 Performing final database checkpoint...');
  walCheckpoint.performFinalCheckpoint((err) => {
    if (err) {
      console.error('❌ Final checkpoint failed:', err.message);
    }
    
    // Close database connection
    console.log('🔌 Closing database connection...');
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      } else {
        console.log('✓ Database closed successfully');
      }
      
      console.log('👋 Server shutdown complete');
      process.exit(err ? 1 : 0);
    });
  });
  
  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('⚠️  Graceful shutdown timeout - forcing exit');
    process.exit(1);
  }, 10000);
}

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); 