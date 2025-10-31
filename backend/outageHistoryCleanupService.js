/**
 * Outage History Cleanup Service
 * Automatically cleans up outage history records older than 90 days
 * Runs daily at midnight GMT
 */

const db = require('./db');

class OutageHistoryCleanupService {
  constructor() {
    this.isRunning = false;
    this.cleanupTimer = null;
    this.retentionDays = 90; // Keep 90 days of history
  }

  /**
   * Start the outage history cleanup service
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Outage history cleanup service is already running');
      return;
    }

    console.log('🚀 Starting outage history cleanup service (daily at midnight GMT)...');
    this.isRunning = true;
    
    // Schedule initial cleanup and set up daily recurring cleanup
    this.scheduleNextCleanup();
    
    console.log('✅ Outage history cleanup service started successfully');
  }

  /**
   * Stop the outage history cleanup service
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Outage history cleanup service is not running');
      return;
    }

    console.log('🛑 Stopping outage history cleanup service...');
    
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.isRunning = false;
    console.log('✅ Outage history cleanup service stopped');
  }

  /**
   * Schedule the next cleanup at midnight GMT
   */
  scheduleNextCleanup() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0); // Midnight GMT
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    console.log(`📅 Next outage history cleanup scheduled for: ${tomorrow.toISOString()} (in ${Math.round(msUntilMidnight / 1000 / 60 / 60)} hours)`);
    
    this.cleanupTimer = setTimeout(() => {
      this.performCleanup().then(() => {
        // Schedule the next cleanup for tomorrow
        if (this.isRunning) {
          this.scheduleNextCleanup();
        }
      }).catch((error) => {
        console.error('❌ Error during cleanup, will retry tomorrow:', error);
        // Schedule the next cleanup even if this one failed
        if (this.isRunning) {
          this.scheduleNextCleanup();
        }
      });
    }, msUntilMidnight);
  }

  /**
   * Perform the cleanup of old outage history records
   */
  async performCleanup() {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      console.log(`🧹 [${new Date().toISOString()}] Starting outage history cleanup...`);
      console.log(`📅 Deleting records older than ${this.retentionDays} days (before ${cutoffDateString})`);
      
      // First, count how many records will be deleted
      db.get(
        'SELECT COUNT(*) as count FROM core_outage_history WHERE outage_start_time < ?',
        [cutoffDateString],
        (countErr, countResult) => {
          if (countErr) {
            console.error('❌ Failed to count old outage records:', countErr);
            reject(countErr);
            return;
          }
          
          const recordsToDelete = countResult.count;
          
          if (recordsToDelete === 0) {
            console.log('✅ No old outage history records to clean up');
            resolve({ deleted: 0, cutoffDate: cutoffDateString });
            return;
          }
          
          console.log(`🗑️  Found ${recordsToDelete} outage history records to delete`);
          
          // Perform the cleanup
          db.run(
            'DELETE FROM core_outage_history WHERE outage_start_time < ?',
            [cutoffDateString],
            function(deleteErr) {
              if (deleteErr) {
                console.error('❌ Failed to delete old outage records:', deleteErr);
                reject(deleteErr);
                return;
              }
              
              const actualDeleted = this.changes;
              console.log(`✅ Successfully deleted ${actualDeleted} outage history records older than ${this.retentionDays} days`);
              
              // Note: Automated cleanup operations are not logged to change_logs table
              // since they are system operations without a user context.
              // Manual cleanups triggered by administrators are logged separately.
              resolve({
                deleted: actualDeleted,
                cutoffDate: cutoffDateString,
                retentionDays: this.retentionDays
              });
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
    if (!this.isRunning) {
      throw new Error('Cleanup service is not running');
    }
    
    console.log('🔧 Manual outage history cleanup triggered');
    return await this.performCleanup();
  }

  /**
   * Get service status information
   */
  getStatus() {
    const now = new Date();
    let nextCleanup = null;
    
    if (this.isRunning) {
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      nextCleanup = tomorrow.toISOString();
    }
    
    return {
      isRunning: this.isRunning,
      retentionDays: this.retentionDays,
      nextCleanup: nextCleanup,
      serviceType: 'outage_history_cleanup'
    };
  }

  /**
   * Update retention period (requires restart to take effect)
   */
  setRetentionDays(days) {
    if (days < 1 || days > 365) {
      throw new Error('Retention days must be between 1 and 365');
    }
    
    this.retentionDays = days;
    console.log(`📝 Outage history retention period updated to ${days} days`);
  }
}

// Export singleton instance
const outageHistoryCleanup = new OutageHistoryCleanupService();
module.exports = outageHistoryCleanup;
