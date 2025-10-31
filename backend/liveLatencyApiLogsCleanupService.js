/**
 * Live Latency API Logs Cleanup Service
 * Automatically cleans up live_latency_api_logs records older than 8 days
 * Runs daily at 3 AM GMT
 */

const db = require('./db');

class LiveLatencyApiLogsCleanupService {
  constructor() {
    this.isRunning = false;
    this.cleanupTimer = null;
    this.retentionDays = 8; // Keep 8 days of logs
  }

  /**
   * Start the live latency API logs cleanup service
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Live latency API logs cleanup service is already running');
      return;
    }

    console.log('🚀 Starting live latency API logs cleanup service (daily at 3 AM GMT)...');
    this.isRunning = true;
    
    // Schedule initial cleanup and set up daily recurring cleanup
    this.scheduleNextCleanup();
    
    console.log('✅ Live latency API logs cleanup service started successfully');
  }

  /**
   * Stop the live latency API logs cleanup service
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Live latency API logs cleanup service is not running');
      return;
    }

    console.log('🛑 Stopping live latency API logs cleanup service...');
    
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.isRunning = false;
    console.log('✅ Live latency API logs cleanup service stopped');
  }

  /**
   * Schedule the next cleanup at 3 AM GMT
   */
  scheduleNextCleanup() {
    const now = new Date();
    const next3AM = new Date(now);
    
    // Set to 3 AM GMT today
    next3AM.setUTCHours(3, 0, 0, 0);
    
    // If 3 AM has already passed today, schedule for tomorrow
    if (next3AM <= now) {
      next3AM.setUTCDate(next3AM.getUTCDate() + 1);
    }
    
    const msUntilNext3AM = next3AM.getTime() - now.getTime();
    
    console.log(`📅 Next live latency API logs cleanup scheduled for: ${next3AM.toISOString()} (in ${Math.round(msUntilNext3AM / 1000 / 60 / 60)} hours)`);
    
    this.cleanupTimer = setTimeout(() => {
      this.performCleanup().then(() => {
        // Schedule the next cleanup for tomorrow
        if (this.isRunning) {
          this.scheduleNextCleanup();
        }
      }).catch((error) => {
        console.error('❌ Error during live latency API logs cleanup, will retry tomorrow:', error);
        // Schedule the next cleanup even if this one failed
        if (this.isRunning) {
          this.scheduleNextCleanup();
        }
      });
    }, msUntilNext3AM);
  }

  /**
   * Perform the cleanup of old live latency API log records
   */
  async performCleanup() {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      const cutoffDateString = cutoffDate.toISOString();
      const retentionDays = this.retentionDays; // Capture for use in callbacks
      
      console.log(`🧹 [${new Date().toISOString()}] Starting live latency API logs cleanup...`);
      console.log(`📅 Deleting records older than ${retentionDays} days (before ${cutoffDateString})`);
      
      // First, count how many records will be deleted
      db.get(
        'SELECT COUNT(*) as count FROM live_latency_api_logs WHERE created_at < ?',
        [cutoffDateString],
        (countErr, countResult) => {
          if (countErr) {
            console.error('❌ Failed to count old live latency API log records:', countErr);
            reject(countErr);
            return;
          }
          
          const recordsToDelete = countResult.count;
          
          if (recordsToDelete === 0) {
            console.log('✅ No old live latency API log records to clean up');
            resolve({ deleted: 0, cutoffDate: cutoffDateString });
            return;
          }
          
          console.log(`🗑️  Found ${recordsToDelete} live latency API log records to delete`);
          
          // Perform the cleanup
          db.run(
            'DELETE FROM live_latency_api_logs WHERE created_at < ?',
            [cutoffDateString],
            function(deleteErr) {
              if (deleteErr) {
                console.error('❌ Failed to delete old live latency API log records:', deleteErr);
                reject(deleteErr);
                return;
              }
              
              const actualDeleted = this.changes;
              console.log(`✅ Successfully deleted ${actualDeleted} live latency API log records older than ${retentionDays} days`);
              
              // Log the cleanup activity
              const logEntry = {
                action: 'live_latency_api_logs_cleanup',
                records_deleted: actualDeleted,
                cutoff_date: cutoffDateString,
                retention_days: retentionDays,
                timestamp: new Date().toISOString()
              };
              
              db.run(
                'INSERT INTO change_logs (user_id, table_name, record_id, action, new_values, changes_summary) VALUES (?, ?, ?, ?, ?, ?)',
                [
                  null, // system operation
                  'live_latency_api_logs',
                  '0', // Use '0' as placeholder for system operations without specific record
                  'cleanup',
                  JSON.stringify(logEntry),
                  `Automated cleanup: deleted ${actualDeleted} live latency API log records older than ${retentionDays} days`
                ],
                function(logErr) {
                  if (logErr) {
                    console.warn('⚠️  Failed to log cleanup activity:', logErr);
                  }
                  
                  resolve({
                    deleted: actualDeleted,
                    cutoffDate: cutoffDateString,
                    retentionDays: retentionDays
                  });
                }
              );
            }
          );
        }
      );
    });
  }

  /**
   * Manually trigger cleanup (for testing or manual maintenance)
   */
  async manualCleanup() {
    console.log('🔧 Manual live latency API logs cleanup triggered');
    return await this.performCleanup();
  }

  /**
   * Get service status information
   */
  getStatus() {
    const now = new Date();
    let nextCleanup = null;
    
    if (this.isRunning) {
      const next3AM = new Date(now);
      next3AM.setUTCHours(3, 0, 0, 0);
      
      // If 3 AM has already passed today, show tomorrow's time
      if (next3AM <= now) {
        next3AM.setUTCDate(next3AM.getUTCDate() + 1);
      }
      
      nextCleanup = next3AM.toISOString();
    }
    
    return {
      isRunning: this.isRunning,
      retentionDays: this.retentionDays,
      nextCleanup: nextCleanup,
      serviceType: 'live_latency_api_logs_cleanup'
    };
  }
}

// Export singleton instance
const liveLatencyApiLogsCleanup = new LiveLatencyApiLogsCleanupService();
module.exports = liveLatencyApiLogsCleanup;

