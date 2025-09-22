/**
 * Core Outage Monitoring Service
 * Monitors live latency data and automatically tracks circuit outages
 * Runs every 1 minute to detect outage start/end events
 */

const db = require('./db');

class OutageMonitorService {
  constructor() {
    this.isRunning = false;
    this.monitorInterval = null;
    this.checkIntervalMs = 60 * 1000; // 1 minute in milliseconds
  }

  /**
   * Start the outage monitoring service
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Outage monitor service is already running');
      return;
    }

    console.log('🚀 Starting outage monitor service (checking every 1 minute)...');
    this.isRunning = true;
    
    // Run initial check immediately
    this.checkForOutages();
    
    // Set up recurring checks every minute
    this.monitorInterval = setInterval(() => {
      this.checkForOutages();
    }, this.checkIntervalMs);
    
    console.log('✅ Outage monitor service started successfully');
  }

  /**
   * Stop the outage monitoring service
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Outage monitor service is not running');
      return;
    }

    console.log('🛑 Stopping outage monitor service...');
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    this.isRunning = false;
    console.log('✅ Outage monitor service stopped');
  }

  /**
   * Main outage checking logic - runs every minute
   */
  async checkForOutages() {
    try {
      console.log(`🔍 [${new Date().toISOString()}] Checking for circuit outages...`);
      
      await Promise.all([
        this.detectNewOutages(),
        this.detectOutageResolutions()
      ]);
      
    } catch (error) {
      console.error('❌ Error during outage check:', error.message);
    }
  }

  /**
   * Detect new outages (circuits that went from normal to 0ms latency)
   */
  async detectNewOutages() {
    return new Promise((resolve, reject) => {
      // Find circuits with live_latency = 0 that don't have active outage records
      const query = `
        SELECT nr.circuit_id, nr.location_a, nr.location_b, nr.bandwidth, 
               nr.underlying_carrier, nr.live_latency, nr.live_latency_last_updated
        FROM network_routes nr
        LEFT JOIN core_active_outages cao ON nr.circuit_id = cao.circuit_id
        WHERE nr.live_latency = 0 
          AND nr.live_latency_last_updated IS NOT NULL
          AND cao.circuit_id IS NULL
      `;

      db.all(query, [], (err, circuits) => {
        if (err) {
          console.error('Failed to query for new outages:', err);
          reject(err);
          return;
        }

        if (circuits.length > 0) {
          console.log(`🔥 Found ${circuits.length} new outage(s)`);
          this.createOutageRecords(circuits).then(resolve).catch(reject);
        } else {
          console.log('✅ No new outages detected');
          resolve();
        }
      });
    });
  }

  /**
   * Detect outage resolutions (circuits that went from 0ms to normal latency)
   */
  async detectOutageResolutions() {
    return new Promise((resolve, reject) => {
      // Find active outages where the circuit now has non-zero latency
      const query = `
        SELECT cao.*, nr.live_latency, nr.live_latency_last_updated
        FROM core_active_outages cao
        JOIN network_routes nr ON cao.circuit_id = nr.circuit_id
        WHERE nr.live_latency != 0 AND nr.live_latency IS NOT NULL
      `;

      db.all(query, [], (err, resolvedOutages) => {
        if (err) {
          console.error('Failed to query for resolved outages:', err);
          reject(err);
          return;
        }

        if (resolvedOutages.length > 0) {
          console.log(`🎉 Found ${resolvedOutages.length} resolved outage(s)`);
          this.resolveOutages(resolvedOutages).then(resolve).catch(reject);
        } else {
          console.log('✅ No outage resolutions detected');
          resolve();
        }
      });
    });
  }

  /**
   * Create new outage records for circuits that just went down
   */
  async createOutageRecords(circuits) {
    const promises = circuits.map(circuit => {
      return new Promise((resolve, reject) => {
        const insertQuery = `
          INSERT INTO core_active_outages 
          (circuit_id, location_a, location_b, bandwidth, underlying_carrier, 
           outage_start_time, live_latency)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
          circuit.circuit_id,
          circuit.location_a,
          circuit.location_b,
          circuit.bandwidth,
          circuit.underlying_carrier,
          circuit.live_latency_last_updated,
          circuit.live_latency
        ];

        db.run(insertQuery, values, function(err) {
          if (err) {
            console.error(`Failed to create outage record for ${circuit.circuit_id}:`, err);
            reject(err);
          } else {
            console.log(`📝 Created outage record for ${circuit.circuit_id} (down since ${circuit.live_latency_last_updated})`);
            resolve();
          }
        });
      });
    });

    await Promise.all(promises);
  }

  /**
   * Resolve outages and move them to history
   */
  async resolveOutages(resolvedOutages) {
    const promises = resolvedOutages.map(outage => {
      return new Promise((resolve, reject) => {
        const startTime = new Date(outage.outage_start_time);
        const endTime = new Date(outage.live_latency_last_updated);
        const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));

        // Insert into history
        const historyQuery = `
          INSERT INTO core_outage_history 
          (circuit_id, location_a, location_b, bandwidth, underlying_carrier,
           outage_start_time, outage_end_time, outage_duration_minutes, detected_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const historyValues = [
          outage.circuit_id,
          outage.location_a,
          outage.location_b,
          outage.bandwidth,
          outage.underlying_carrier,
          outage.outage_start_time,
          outage.live_latency_last_updated,
          durationMinutes,
          'live_latency_monitor'
        ];

        db.run(historyQuery, historyValues, function(historyErr) {
          if (historyErr) {
            console.error(`Failed to create history record for ${outage.circuit_id}:`, historyErr);
            reject(historyErr);
            return;
          }

          // Remove from active outages
          db.run('DELETE FROM core_active_outages WHERE id = ?', [outage.id], function(deleteErr) {
            if (deleteErr) {
              console.error(`Failed to remove active outage for ${outage.circuit_id}:`, deleteErr);
              reject(deleteErr);
            } else {
              console.log(`🎉 Resolved outage for ${outage.circuit_id} (duration: ${durationMinutes} minutes)`);
              resolve();
            }
          });
        });
      });
    });

    await Promise.all(promises);
  }

  /**
   * Get service status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: `${this.checkIntervalMs / 1000} seconds`,
      lastCheck: new Date().toISOString()
    };
  }

  /**
   * Get current outages (for API endpoints)
   */
  async getCurrentOutages() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT cao.circuit_id, cao.location_a, cao.location_b, cao.bandwidth,
               cao.underlying_carrier, cao.live_latency, cao.outage_start_time,
               nr.live_latency_last_updated
        FROM core_active_outages cao
        JOIN network_routes nr ON cao.circuit_id = nr.circuit_id
        WHERE nr.live_latency = 0
        ORDER BY cao.outage_start_time DESC
      `;

      db.all(query, [], (err, outages) => {
        if (err) {
          reject(err);
        } else {
          resolve(outages);
        }
      });
    });
  }

  /**
   * Get outage history (for API endpoints)
   */
  async getOutageHistory(limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT circuit_id, location_a, location_b, bandwidth, underlying_carrier,
               outage_start_time, outage_end_time, outage_duration_minutes, detected_by
        FROM core_outage_history
        ORDER BY outage_start_time DESC
        LIMIT ? OFFSET ?
      `;

      db.all(query, [limit, offset], (err, history) => {
        if (err) {
          reject(err);
        } else {
          resolve(history);
        }
      });
    });
  }

  /**
   * Get outage statistics
   */
  async getOutageStats() {
    return new Promise((resolve, reject) => {
      const queries = {
        currentOutages: 'SELECT COUNT(*) as count FROM core_active_outages',
        totalHistoricalOutages: 'SELECT COUNT(*) as count FROM core_outage_history',
        outagesLast24h: `
          SELECT COUNT(*) as count FROM core_outage_history 
          WHERE outage_start_time >= datetime('now', '-24 hours')
        `,
        avgOutageDuration: `
          SELECT AVG(outage_duration_minutes) as avg_duration 
          FROM core_outage_history 
          WHERE outage_end_time IS NOT NULL
        `
      };

      const results = {};
      const queryKeys = Object.keys(queries);
      let completed = 0;

      queryKeys.forEach(key => {
        db.get(queries[key], [], (err, result) => {
          completed++;
          
          if (err) {
            console.error(`Failed to get ${key}:`, err);
            results[key] = 0;
          } else {
            results[key] = result.count !== undefined ? result.count : result.avg_duration || 0;
          }

          if (completed === queryKeys.length) {
            resolve(results);
          }
        });
      });
    });
  }
}

// Export singleton instance
const outageMonitor = new OutageMonitorService();
module.exports = outageMonitor;
