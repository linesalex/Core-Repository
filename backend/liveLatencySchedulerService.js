/**
 * Live Latency Scheduler Service
 * Automatically runs live latency tests based on configured intervals
 * Processes circuits individually based on their update_interval_minutes setting
 */

const LiveLatencyService = require('./liveLatencyService');

class LiveLatencySchedulerService {
  constructor() {
    this.isRunning = false;
    this.schedulerInterval = null;
    this.checkIntervalMs = 60 * 1000; // Check every 1 minute
    this.liveLatencyService = new LiveLatencyService();
  }

  /**
   * Start the live latency scheduler service
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Live latency scheduler service is already running');
      return;
    }

    console.log('🚀 Starting live latency scheduler service (checking every 1 minute)...');
    this.isRunning = true;
    
    // Run initial check after 30 seconds to allow system startup
    setTimeout(() => {
      this.processScheduledTests();
    }, 30000);
    
    // Set up recurring checks every minute
    this.schedulerInterval = setInterval(() => {
      this.processScheduledTests();
    }, this.checkIntervalMs);
    
    console.log('✅ Live latency scheduler service started successfully');
  }

  /**
   * Stop the live latency scheduler service
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Live latency scheduler service is not running');
      return;
    }

    console.log('🛑 Stopping live latency scheduler service...');
    
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    
    this.isRunning = false;
    console.log('✅ Live latency scheduler service stopped');
  }

  /**
   * Process all circuits and run tests for those due for testing
   */
  async processScheduledTests() {
    if (!this.isRunning) return;
    
    try {
      console.log('🔍 Checking for circuits due for scheduled testing...');
      
      const configurations = await this.liveLatencyService.getEnabledConfigurations();
      const now = new Date();
      let testsRun = 0;
      let errors = 0;
      
      for (const config of configurations) {
        try {
          if (this.isCircuitDueForTest(config, now)) {
            console.log(`⏰ Circuit ${config.circuit_id} is due for testing (interval: ${config.update_interval_minutes}min)`);
            
            const result = await this.liveLatencyService.fetchCircuitLatency(config, 'scheduled', null);
            
            if (result.success) {
              // Update the network route with new latency data
              await this.liveLatencyService.updateNetworkRouteLatency(config.circuit_id, result.latency_ms);
              console.log(`✅ Scheduled test completed for ${config.circuit_id}: ${result.latency_ms}ms`);
              testsRun++;
            } else {
              console.log(`❌ Scheduled test failed for ${config.circuit_id}: ${result.error}`);
              errors++;
            }
            
            // Add small delay between tests to be API-friendly
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`💥 Exception processing circuit ${config.circuit_id}:`, error.message);
          errors++;
        }
      }
      
      if (testsRun > 0 || errors > 0) {
        console.log(`📊 Scheduled testing cycle completed: ${testsRun} tests run, ${errors} errors`);
      }
      
    } catch (error) {
      console.error('❌ Critical error in scheduled testing process:', error.message);
    }
  }

  /**
   * Check if a circuit is due for testing based on its last test time and interval
   */
  isCircuitDueForTest(config, now = new Date()) {
    // Skip if disabled or temporarily disabled
    if (!config.enabled || config.disabled_until) {
      return false;
    }
    
    // Skip if no last test time (will be handled by manual refresh)
    if (!config.last_test_at) {
      return false;
    }
    
    const lastTestTime = new Date(config.last_test_at);
    const intervalMs = (config.update_interval_minutes || 15) * 60 * 1000;
    const nextTestTime = new Date(lastTestTime.getTime() + intervalMs);
    
    return now >= nextTestTime;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkIntervalMs: this.checkIntervalMs,
      nextCheckIn: this.schedulerInterval ? 
        Math.ceil((this.checkIntervalMs - (Date.now() % this.checkIntervalMs)) / 1000) : 0
    };
  }
}

// Create singleton instance
const liveLatencyScheduler = new LiveLatencySchedulerService();

module.exports = liveLatencyScheduler;