/**
 * Live Latency Auto Refresh Service
 * Automatically refreshes live latency data with staggered bucket system
 * - Each circuit refreshes every 20 minutes
 * - 4 buckets refresh 5 minutes apart (0, 5, 10, 15 mins)
 * - Distributes API load across time to prevent thundering herd
 * Runs independently from manual refresh cooldowns
 */

const LiveLatencyService = require('./liveLatencyService');
const outageMonitor = require('./outageMonitorService');

class LiveLatencyAutoRefreshService {
  constructor() {
    this.isRunning = false;
    this.bucketIntervals = []; // Array of 4 interval timers
    this.bucketRefreshIntervalMs = 20 * 60 * 1000; // 20 minutes per bucket cycle
    this.bucketCount = 4; // Number of buckets
    this.bucketOffsetMs = 5 * 60 * 1000; // 5 minutes between bucket starts
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

    console.log('🚀 Starting live latency auto-refresh service with staggered bucket system...');
    console.log(`📊 Configuration: ${this.bucketCount} buckets, 20-minute cycle, 5-minute offsets`);
    this.isRunning = true;
    
    // Start each bucket with staggered delays
    // Bucket 0: starts at 5 mins, then every 20 mins (5, 25, 45...)
    // Bucket 1: starts at 10 mins, then every 20 mins (10, 30, 50...)
    // Bucket 2: starts at 15 mins, then every 20 mins (15, 35, 55...)
    // Bucket 3: starts at 20 mins, then every 20 mins (20, 40, 60...)
    const initialDelayMs = 5 * 60 * 1000; // Wait 5 minutes before starting pattern
    
    for (let bucketIndex = 0; bucketIndex < this.bucketCount; bucketIndex++) {
      const startDelay = initialDelayMs + (bucketIndex * this.bucketOffsetMs);
      const startTime = new Date(Date.now() + startDelay);
      
      console.log(`🪣 Bucket ${bucketIndex}: First refresh at ${startTime.toLocaleTimeString()}, then every 20 minutes`);
      
      // Schedule first refresh for this bucket
      setTimeout(() => {
        this.performBucketRefresh(bucketIndex);
        
        // Set up recurring refresh for this bucket every 20 minutes
        const interval = setInterval(() => {
          this.performBucketRefresh(bucketIndex);
        }, this.bucketRefreshIntervalMs);
        
        this.bucketIntervals[bucketIndex] = interval;
      }, startDelay);
    }
    
    console.log('✅ Live latency auto-refresh service started successfully with staggered buckets');
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
    
    // Clear all bucket intervals
    for (let i = 0; i < this.bucketIntervals.length; i++) {
      if (this.bucketIntervals[i]) {
        clearInterval(this.bucketIntervals[i]);
        console.log(`🪣 Bucket ${i} interval cleared`);
      }
    }
    this.bucketIntervals = [];
    
    this.isRunning = false;
    console.log('✅ Live latency auto-refresh service stopped');
  }

  /**
   * Divide circuits into buckets alphabetically
   */
  divideIntoBuckets(configurations) {
    // Sort alphabetically by circuit_id
    const sorted = [...configurations].sort((a, b) => 
      a.circuit_id.localeCompare(b.circuit_id)
    );
    
    const buckets = [];
    const bucketSize = Math.ceil(sorted.length / this.bucketCount);
    
    for (let i = 0; i < this.bucketCount; i++) {
      const start = i * bucketSize;
      const end = Math.min(start + bucketSize, sorted.length);
      buckets.push(sorted.slice(start, end));
    }
    
    return buckets;
  }

  /**
   * Perform automated live latency refresh for a specific bucket
   */
  async performBucketRefresh(bucketIndex) {
    try {
      console.log(`🔄 [${new Date().toISOString()}] Starting automated refresh for Bucket ${bucketIndex}...`);
      
      // Get enabled configurations directly to bypass cooldown checks
      const allConfigurations = await this.liveLatencyService.getEnabledConfigurations();
      
      if (allConfigurations.length === 0) {
        console.log('📊 No enabled live latency configurations found');
        return;
      }

      // Divide into buckets and get only this bucket's circuits
      const buckets = this.divideIntoBuckets(allConfigurations);
      const configurations = buckets[bucketIndex] || [];
      
      if (configurations.length === 0) {
        console.log(`🪣 Bucket ${bucketIndex} is empty`);
        return;
      }

      console.log(`🪣 Bucket ${bucketIndex}: Processing ${configurations.length}/${allConfigurations.length} circuits`);
      
      const results = {
        bucket: bucketIndex,
        total: configurations.length,
        processed: 0,
        updated: 0,
        failed: 0,
        errors: [],
        duration: 0,
        type: 'automated_bucket'
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
      console.log(`🎉 Bucket ${bucketIndex} refresh completed in ${results.duration}ms (${Math.round(results.duration / 1000)}s)`);
      console.log(`📈 Bucket ${bucketIndex}: Updated ${results.updated}/${results.total} circuits`);
      
      if (results.errors.length > 0) {
        console.log(`⚠️  Bucket ${bucketIndex}: ${results.errors.length} errors occurred`);
      }

      // Update latency warnings after refreshing live latency data
      // Only do this for bucket 3 (last bucket) to avoid redundant updates
      if (bucketIndex === this.bucketCount - 1) {
        try {
          console.log('🔄 Updating latency warnings (final bucket completed)...');
          await outageMonitor.updateLatencyWarnings();
          console.log('✅ Latency warnings updated successfully');
        } catch (warningError) {
          console.error('❌ Failed to update latency warnings:', warningError.message);
        }
      }

      return results;
      
    } catch (error) {
      console.error(`❌ Critical error in Bucket ${bucketIndex} refresh:`, error);
    }
  }

  /**
   * Get service status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      bucketCount: this.bucketCount,
      refreshInterval: `${this.bucketRefreshIntervalMs / 1000} seconds per bucket (20 minutes)`,
      bucketOffset: `${this.bucketOffsetMs / 1000} seconds between buckets (5 minutes)`,
      activeBuckets: this.bucketIntervals.length,
      serviceType: 'automated_live_latency_refresh_staggered',
      description: 'Each circuit refreshes every 20 minutes, spread across 4 buckets with 5-minute offsets'
    };
  }
}

// Export singleton instance
const liveLatencyAutoRefresh = new LiveLatencyAutoRefreshService();
module.exports = liveLatencyAutoRefresh;
