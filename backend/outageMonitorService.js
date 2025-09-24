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
        this.detectOutageResolutions(),
        this.processResolvedOutages()
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

        // Check if there's a recent outage for the same circuit within 24 hours
        const checkRecentQuery = `
          SELECT * FROM core_active_outages 
          WHERE circuit_id = ? AND status = 'resolved' 
            AND resolved_at > datetime('now', '-24 hours')
          ORDER BY resolved_at DESC LIMIT 1
        `;

        db.get(checkRecentQuery, [outage.circuit_id], (checkErr, recentOutage) => {
          if (checkErr) {
            console.error(`Failed to check recent outages for ${outage.circuit_id}:`, checkErr);
            reject(checkErr);
            return;
          }

          let ticketNumber = outage.ticket_number;
          let notes = outage.notes;
          let originalStartTime = outage.outage_start_time;

          // If there's a recent resolved outage for same circuit, reuse its data
          if (recentOutage) {
            ticketNumber = recentOutage.ticket_number || ticketNumber;
            notes = recentOutage.notes || notes;
            originalStartTime = recentOutage.outage_start_time; // Use original start time
            
            // Delete the previous resolved outage since we're consolidating
            db.run('DELETE FROM core_active_outages WHERE id = ?', [recentOutage.id], (deleteErr) => {
              if (deleteErr) {
                console.warn(`Failed to delete previous resolved outage for ${outage.circuit_id}:`, deleteErr);
              }
            });
          }

          // Mark current outage as resolved instead of moving to history immediately
          db.run(
            'UPDATE core_active_outages SET status = ?, resolved_at = ? WHERE id = ?',
            ['resolved', outage.live_latency_last_updated, outage.id],
            function(updateErr) {
              if (updateErr) {
                console.error(`Failed to mark outage as resolved for ${outage.circuit_id}:`, updateErr);
                reject(updateErr);
                return;
              }
              
              console.log(`🎉 Marked outage as resolved for ${outage.circuit_id} (will move to history after 24 hours)`);
              resolve();
            }
          );
        });
      });
    });

    await Promise.all(promises);
  }

  /**
   * Move resolved outages to history after 24 hours
   */
  async processResolvedOutages() {
    return new Promise((resolve, reject) => {
      // Find resolved outages older than 24 hours
      const query = `
        SELECT * FROM core_active_outages 
        WHERE status = 'resolved' 
          AND resolved_at < datetime('now', '-24 hours')
      `;

      db.all(query, [], (err, resolvedOutages) => {
        if (err) {
          console.error('Failed to query resolved outages:', err);
          reject(err);
          return;
        }

        if (resolvedOutages.length === 0) {
          resolve();
          return;
        }

        console.log(`🔄 Moving ${resolvedOutages.length} resolved outage(s) to history`);

        const promises = resolvedOutages.map(outage => {
          return new Promise((resolveOutage, rejectOutage) => {
            const startTime = new Date(outage.outage_start_time);
            const endTime = new Date(outage.resolved_at);
            const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));

            // Insert into history
            const historyQuery = `
              INSERT INTO core_outage_history 
              (circuit_id, location_a, location_b, bandwidth, underlying_carrier,
               outage_start_time, outage_end_time, outage_duration_minutes, detected_by,
               ticket_number, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const historyValues = [
              outage.circuit_id,
              outage.location_a,
              outage.location_b,
              outage.bandwidth,
              outage.underlying_carrier,
              outage.outage_start_time,
              outage.resolved_at,
              durationMinutes,
              'live_latency_monitor',
              outage.ticket_number,
              outage.notes
            ];

            db.run(historyQuery, historyValues, function(historyErr) {
              if (historyErr) {
                console.error(`Failed to create history record for ${outage.circuit_id}:`, historyErr);
                rejectOutage(historyErr);
                return;
              }

              // Remove from active outages
              db.run('DELETE FROM core_active_outages WHERE id = ?', [outage.id], function(deleteErr) {
                if (deleteErr) {
                  console.error(`Failed to remove resolved outage for ${outage.circuit_id}:`, deleteErr);
                  rejectOutage(deleteErr);
                } else {
                  console.log(`📚 Moved resolved outage for ${outage.circuit_id} to history (duration: ${durationMinutes} minutes)`);
                  resolveOutage();
                }
              });
            });
          });
        });

        Promise.all(promises).then(() => resolve()).catch(reject);
      });
    });
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
  async getCurrentOutages(searchTerm = '') {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT cao.circuit_id, cao.location_a, cao.location_b, cao.bandwidth,
               cao.underlying_carrier, cao.live_latency, cao.outage_start_time,
               cao.ticket_number, cao.notes, cao.status,
               nr.live_latency_last_updated
        FROM core_active_outages cao
        JOIN network_routes nr ON cao.circuit_id = nr.circuit_id
        WHERE nr.live_latency = 0 AND cao.status = 'active'
      `;
      
      let params = [];
      
      // Add search filter if provided
      if (searchTerm && searchTerm.trim()) {
        query += ` AND (
          cao.circuit_id LIKE ? OR 
          cao.location_a LIKE ? OR 
          cao.location_b LIKE ? OR 
          cao.underlying_carrier LIKE ?
        )`;
        const searchPattern = `%${searchTerm.trim()}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }
      
      query += ` ORDER BY cao.outage_start_time DESC`;

      db.all(query, params, (err, outages) => {
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
  async getOutageHistory(limit = 100, offset = 0, searchTerm = '', startDate = '', endDate = '') {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT circuit_id, location_a, location_b, bandwidth, underlying_carrier,
               outage_start_time, outage_end_time, outage_duration_minutes, detected_by,
               ticket_number, notes
        FROM core_outage_history
        WHERE 1=1
      `;
      
      let params = [];
      
      // Add search filter if provided
      if (searchTerm && searchTerm.trim()) {
        query += ` AND (
          circuit_id LIKE ? OR 
          location_a LIKE ? OR 
          location_b LIKE ? OR 
          underlying_carrier LIKE ?
        )`;
        const searchPattern = `%${searchTerm.trim()}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }
      
      // Add date range filter if provided
      if (startDate && startDate.trim()) {
        query += ` AND DATE(outage_start_time) >= DATE(?)`;
        params.push(startDate.trim());
      }
      
      if (endDate && endDate.trim()) {
        query += ` AND DATE(outage_start_time) <= DATE(?)`;
        params.push(endDate.trim());
      }
      
      query += ` ORDER BY outage_start_time DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      db.all(query, params, (err, history) => {
        if (err) {
          reject(err);
        } else {
          resolve(history);
        }
      });
    });
  }

  /**
   * Get filtered outage history count for pagination
   */
  async getOutageHistoryCount(searchTerm = '', startDate = '', endDate = '') {
    return new Promise((resolve, reject) => {
      let query = `SELECT COUNT(*) as total FROM core_outage_history WHERE 1=1`;
      let params = [];
      
      // Add search filter if provided
      if (searchTerm && searchTerm.trim()) {
        query += ` AND (
          circuit_id LIKE ? OR 
          location_a LIKE ? OR 
          location_b LIKE ? OR 
          underlying_carrier LIKE ?
        )`;
        const searchPattern = `%${searchTerm.trim()}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }
      
      // Add date range filter if provided
      if (startDate && startDate.trim()) {
        query += ` AND DATE(outage_start_time) >= DATE(?)`;
        params.push(startDate.trim());
      }
      
      if (endDate && endDate.trim()) {
        query += ` AND DATE(outage_start_time) <= DATE(?)`;
        params.push(endDate.trim());
      }

      db.get(query, params, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.total);
        }
      });
    });
  }

  /**
   * Get latency warnings (circuits exceeding expected latency by >5%)
   */
  async getLatencyWarnings(searchTerm = '') {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT nr.circuit_id, nr.location_a, nr.location_b, nr.bandwidth,
               nr.underlying_carrier, nr.live_latency, nr.expected_latency,
               ROUND(((CAST(CASE WHEN nr.live_latency = '' OR nr.live_latency = 'N/A' THEN '0' ELSE nr.live_latency END AS REAL) - CAST(CASE WHEN nr.expected_latency = '' OR nr.expected_latency = 'N/A' THEN '0' ELSE nr.expected_latency END AS REAL)) / CAST(CASE WHEN nr.expected_latency = '' OR nr.expected_latency = 'N/A' THEN '0' ELSE nr.expected_latency END AS REAL)) * 100, 2) as latency_percentage,
               lw.ticket_number, lw.notes
        FROM network_routes nr
        LEFT JOIN latency_warnings_live lw ON nr.circuit_id = lw.circuit_id
        WHERE nr.live_latency IS NOT NULL 
          AND nr.live_latency != '' 
          AND nr.live_latency != 'N/A'
          AND nr.live_latency != '0'
          AND CAST(CASE WHEN nr.live_latency = '' OR nr.live_latency = 'N/A' THEN '0' ELSE nr.live_latency END AS REAL) > 0
          AND nr.expected_latency IS NOT NULL 
          AND nr.expected_latency != '' 
          AND nr.expected_latency != 'N/A'
          AND nr.expected_latency != '0'
          AND CAST(CASE WHEN nr.expected_latency = '' OR nr.expected_latency = 'N/A' THEN '0' ELSE nr.expected_latency END AS REAL) > 0
          AND CAST(CASE WHEN nr.live_latency = '' OR nr.live_latency = 'N/A' THEN '0' ELSE nr.live_latency END AS REAL) > (CAST(CASE WHEN nr.expected_latency = '' OR nr.expected_latency = 'N/A' THEN '0' ELSE nr.expected_latency END AS REAL) * 1.05)
      `;
      
      let params = [];
      
      // Add search filter if provided
      if (searchTerm && searchTerm.trim()) {
        query += ` AND (
          nr.circuit_id LIKE ? OR 
          nr.location_a LIKE ? OR 
          nr.location_b LIKE ? OR 
          nr.underlying_carrier LIKE ?
        )`;
        const searchPattern = `%${searchTerm.trim()}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }
      
      query += ` ORDER BY latency_percentage DESC`;

      db.all(query, params, (err, warnings) => {
        if (err) {
          reject(err);
        } else {
          resolve(warnings);
        }
      });
    });
  }

  /**
   * Update latency warnings table with current warnings
   */
  async updateLatencyWarnings() {
    try {
      // Clear existing warnings
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM latency_warnings_live', [], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Get current latency warnings with proper filtering
      const warnings = await this.getLatencyWarnings();
      
      // Insert current warnings
      if (warnings.length > 0) {
        const insertPromises = warnings.map(warning => {
          return new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO latency_warnings_live 
               (circuit_id, location_a, location_b, bandwidth, underlying_carrier, 
                live_latency, expected_latency, latency_percentage, ticket_number, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                warning.circuit_id, warning.location_a, warning.location_b, 
                warning.bandwidth, warning.underlying_carrier, warning.live_latency,
                warning.expected_latency, warning.latency_percentage,
                warning.ticket_number, warning.notes
              ],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        });

        await Promise.all(insertPromises);
        console.log(`📊 Updated ${warnings.length} latency warnings`);
      }

      return warnings;
    } catch (error) {
      console.error('❌ Failed to update latency warnings:', error);
      throw error;
    }
  }

  /**
   * Update ticket and notes for a latency warning
   */
  async updateLatencyWarningTicket(circuitId, ticketNumber, notes) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO latency_warnings_live 
         (circuit_id, ticket_number, notes, last_updated)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(circuit_id) DO UPDATE SET
         ticket_number = excluded.ticket_number,
         notes = excluded.notes,
         last_updated = excluded.last_updated`,
        [circuitId, ticketNumber, notes],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ circuitId, ticketNumber, notes });
          }
        }
      );
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
