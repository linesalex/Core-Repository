// WAL Checkpoint Service
// Periodically checkpoints the WAL file to keep it at a reasonable size
// and ensure database consistency

const db = require('./db');

let intervalId = null;
let checkpointCount = 0;

function performCheckpoint() {
  checkpointCount++;
  console.log(`🔄 [WAL Checkpoint ${checkpointCount}] Starting...`);
  
  const startTime = Date.now();
  
  // PASSIVE mode: Don't block readers/writers, checkpoint what we can
  db.run('PRAGMA wal_checkpoint(PASSIVE)', [], (err) => {
    const duration = Date.now() - startTime;
    
    if (err) {
      console.error(`❌ [WAL Checkpoint ${checkpointCount}] Failed after ${duration}ms:`, err.message);
    } else {
      console.log(`✓ [WAL Checkpoint ${checkpointCount}] Completed successfully in ${duration}ms`);
    }
  });
}

function performFinalCheckpoint(callback) {
  console.log('🔄 [WAL Final Checkpoint] Starting...');
  
  const startTime = Date.now();
  
  // TRUNCATE mode: More aggressive, resets WAL file
  db.run('PRAGMA wal_checkpoint(TRUNCATE)', [], (err) => {
    const duration = Date.now() - startTime;
    
    if (err) {
      console.error(`❌ [WAL Final Checkpoint] Failed after ${duration}ms:`, err.message);
    } else {
      console.log(`✓ [WAL Final Checkpoint] Completed successfully in ${duration}ms`);
    }
    
    if (callback) callback(err);
  });
}

function start() {
  if (intervalId) {
    console.log('⚠️  WAL checkpoint service already running');
    return;
  }
  
  // Run checkpoint every hour (3600000 ms)
  intervalId = setInterval(performCheckpoint, 60 * 60 * 1000);
  
  console.log('✓ WAL checkpoint service started');
  console.log('  - Frequency: Every 1 hour');
  console.log('  - Mode: PASSIVE (non-blocking)');
  
  // Perform initial checkpoint after 5 minutes
  setTimeout(() => {
    console.log('🔄 [WAL Checkpoint] Performing initial checkpoint...');
    performCheckpoint();
  }, 5 * 60 * 1000);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('✓ WAL checkpoint service stopped');
    console.log(`  - Total checkpoints performed: ${checkpointCount}`);
  }
}

module.exports = { 
  start, 
  stop, 
  performCheckpoint, 
  performFinalCheckpoint 
};

