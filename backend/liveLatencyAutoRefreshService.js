/**
 * Live Latency Auto Refresh Service
 * Automatically refreshes live latency data every 15 minutes
 * Runs independently from manual refresh cooldowns
 */

const LiveLatencyService = require('./liveLatencyService');

class LiveLatencyAutoRefreshService {
  constructor() {
    this.isRunning = false;
    this.refreshInterval = null;
    this.checkIntervalMs = 15 * 60 * 1000; // 15 minutes in milliseconds
    this.liveLatencyService = new LiveLatencyService();
  }

  /**
   * Start the automated live latency refresh service
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Live latency auto-refresh service is already running');
      return;
    }

    console.log('🚀 Starting live latency auto-refresh service (refreshing every 15 minutes)...');
    this.isRunning = true;
    
    // Run initial refresh after 5 minutes to avoid startup conflicts
    setTimeout(() => {
      this.performAutoRefresh();
    }, 5 * 60 * 1000); // 5 minutes delay
    
    // Set up recurring refreshes every 15 minutes
    this.refreshInterval = setInterval(() => {
      this.performAutoRefresh();
    }, this.checkIntervalMs);
    
    console.log('✅ Live latency auto-refresh service started successfully');
  }

  /**
   * Stop the automated live latency refresh service
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Live latency auto-refresh service is not running');
      return;
    }

    console.log('🛑 Stopping live latency auto-refresh service...');
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    this.isRunning = false;
    console.log('✅ Live latency auto-refresh service stopped');
  }

  /**
   * Perform automated live latency refresh
   */
  async performAutoRefresh() {
    try {
      console.log(`🔄 [${new Date().toISOString()}] Starting automated live latency refresh...`);
      
      // Get enabled configurations directly to bypass cooldown checks
      const configurations = await this.liveLatencyService.getEnabledConfigurations();
      
      if (configurations.length === 0) {
        console.log('📊 No enabled live latency configurations found');
        return;
      }

      console.log(`📊 Found ${configurations.length} enabled configurations for auto-refresh`);
      
      const results = {
        total: configurations.length,
        processed: 0,
        updated: 0,
        failed: 0,
        errors: [],
        duration: 0,
        type: 'automated'
      };

      const startTime = Date.now();

      // Process circuits in batches to avoid overwhelming the API
      const batchSize = 3;
      for (let i = 0; i < configurations.length; i += batchSize) {
        const batch = configurations.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (config) => {
          try {
            const result = await this.liveLatencyService.fetchCircuitLatency(config, 'automated', null);
            results.processed++;
            
            if (result.success) {
              // Update the network route with new latency data
              try {
                await this.liveLatencyService.updateNetworkRouteLatency(config.circuit_id, result.latency_ms);
                results.updated++;
                console.log(`✅ Auto-updated ${config.circuit_id}: ${result.latency_ms}ms`);
              } catch (updateError) {
                console.error(`Failed to update network route for ${config.circuit_id}:`, updateError.message);
                results.failed++;
                results.errors.push({
                  circuit_id: config.circuit_id,
                  error: `Database update failed: ${updateError.message}`
                });
              }
            } else {
              results.failed++;
              results.errors.push({
                circuit_id: config.circuit_id,
                error: result.error
              });
              console.log(`❌ Auto-refresh failed ${config.circuit_id}: ${result.error}`);
            }
            
          } catch (error) {
            results.processed++;
            results.failed++;
            results.errors.push({
              circuit_id: config.circuit_id,
              error: error.message
            });
            console.error(`💥 Auto-refresh exception for ${config.circuit_id}:`, error.message);
          }
        });

        await Promise.all(batchPromises);
        
        // Small delay between batches to be API-friendly
        if (i + batchSize < configurations.length) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
      }

      results.duration = Date.now() - startTime;
      console.log(`🎉 Automated live latency refresh completed in ${results.duration}ms`);
      console.log(`📈 Auto-updated ${results.updated}/${results.total} circuits`);
      
      if (results.errors.length > 0) {
        console.log(`⚠️  ${results.errors.length} auto-refresh errors occurred`);
      }

      return results;
      
    } catch (error) {
      console.error('❌ Critical error in automated live latency refresh:', error);
    }
  }

  /**
   * Get service status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      refreshInterval: `${this.checkIntervalMs / 1000} seconds`,
      nextRefresh: this.isRunning ? new Date(Date.now() + this.checkIntervalMs).toISOString() : null,
      serviceType: 'automated_live_latency_refresh'
    };
  }
}

// Export singleton instance
const liveLatencyAutoRefresh = new LiveLatencyAutoRefreshService();
module.exports = liveLatencyAutoRefresh;
