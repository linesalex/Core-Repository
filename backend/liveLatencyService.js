const axios = require('axios');
const https = require('https');
const db = require('./db');
const { encrypt, decrypt } = require('./encryption');
const { logUserActivity } = require('./auth');

/**
 * Live Latency Service for External API Integration
 * Handles configuration-based API calls to fetch latency data
 */
class LiveLatencyService {
  
  constructor() {
    this.defaultTimeout = 30000; // 30 seconds
  }

  /**
   * Get system configuration value
   */
  async getSystemConfig(settingName) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT setting_value FROM live_latency_system_config WHERE setting_name = ?',
        [settingName],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.setting_value : null);
        }
      );
    });
  }

  /**
   * Update system configuration value
   */
  async updateSystemConfig(settingName, settingValue, userId = null) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE live_latency_system_config SET setting_value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE setting_name = ?',
        [settingValue, userId, settingName],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  /**
   * Check if global refresh cooldown is active
   */
  async isGlobalRefreshOnCooldown() {
    try {
      const cooldownMinutes = await this.getSystemConfig('global_refresh_cooldown_minutes') || '15';
      const lastRefresh = await this.getSystemConfig('last_global_refresh') || '1970-01-01 00:00:00';
      
      const cooldownMs = parseInt(cooldownMinutes) * 60 * 1000;
      const lastRefreshTime = new Date(lastRefresh).getTime();
      const now = Date.now();
      
      return (now - lastRefreshTime) < cooldownMs;
    } catch (error) {
      console.error('Error checking global refresh cooldown:', error);
      return false; // Allow refresh if we can't check
    }
  }

  /**
   * Update last global refresh timestamp
   */
  async updateLastGlobalRefresh(userId = null) {
    const timestamp = new Date().toISOString();
    await this.updateSystemConfig('last_global_refresh', timestamp, userId);
  }

  /**
   * Get all enabled circuit configurations
   */
  async getEnabledConfigurations() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT lc.*, nr.circuit_id as route_exists
        FROM live_latency_config lc
        LEFT JOIN network_routes nr ON lc.circuit_id = nr.circuit_id
        WHERE lc.enabled = 1 
          AND (lc.disabled_until IS NULL OR lc.disabled_until < CURRENT_TIMESTAMP)
        ORDER BY lc.circuit_id
      `;
      
      db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Decrypt passwords
          const configs = rows.map(row => ({
            ...row,
            auth_password: row.auth_password_encrypted ? 
              this.decryptPassword(row.auth_password_encrypted) : null
          }));
          resolve(configs);
        }
      });
    });
  }

  /**
   * Get single circuit configuration
   */
  async getCircuitConfiguration(circuitId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM live_latency_config WHERE circuit_id = ?',
        [circuitId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            // Decrypt password
            const config = {
              ...row,
              auth_password: row.auth_password_encrypted ? 
                this.decryptPassword(row.auth_password_encrypted) : null
            };
            resolve(config);
          }
        }
      );
    });
  }

  /**
   * Encrypt password for storage
   */
  encryptPassword(password) {
    try {
      return encrypt(password);
    } catch (error) {
      console.error('Failed to encrypt password:', error);
      throw new Error('Password encryption failed');
    }
  }

  /**
   * Decrypt password from storage
   */
  decryptPassword(encryptedPassword) {
    try {
      return decrypt(encryptedPassword);
    } catch (error) {
      console.error('Failed to decrypt password:', error);
      throw new Error('Password decryption failed');
    }
  }

  /**
   * Create API client for a specific configuration
   */
  createApiClient(config) {
    const client = axios.create({
      baseURL: config.api_base_url,
      timeout: this.defaultTimeout,
      headers: {
        'accept': '*/*'
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    // Add authentication
    if (config.auth_username && config.auth_password) {
      client.defaults.auth = {
        username: config.auth_username,
        password: config.auth_password
      };
    }

    return client;
  }

  /**
   * Build API parameters for latency request
   */
  buildApiParameters(config, hoursBack = 24) {
    // Get current time and round down to the previous complete minute
    // This ensures we get the most recent complete data point
    const now = new Date();
    const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                           now.getHours(), now.getMinutes(), 0, 0); // Remove seconds and milliseconds
    
    // Calculate start time as exactly 24 hours before the end time
    const startTime = new Date(endTime.getTime() - (hoursBack * 60 * 60 * 1000));
    
    console.log(`📅 API time range: ${startTime.toISOString()} to ${endTime.toISOString()} (${hoursBack}h window)`);
    
    const baseParams = {
      displayRate: 'PT1H',
      interval: `${startTime.toISOString()}/${endTime.toISOString()}/`,
      instances: config.api_instance_name,
      indicators: config.api_indicator || 'AnyVendor - Response Time (ms) - BPI'
    };

    // Add custom parameters if specified
    if (config.api_parameters) {
      try {
        const customParams = JSON.parse(config.api_parameters);
        Object.assign(baseParams, customParams);
      } catch (error) {
        console.warn(`Invalid API parameters for ${config.circuit_id}:`, error.message);
      }
    }

    return baseParams;
  }

  /**
   * Fetch latency data from external API for a specific circuit
   */
  async fetchCircuitLatency(config, requestType = 'scheduled', userId = null) {
    const startTime = Date.now();
    let apiClient, response, finalLatencyValue = null;
    
    try {
      console.log(`🔄 Fetching latency for circuit ${config.circuit_id} (${requestType})`);
      
      apiClient = this.createApiClient(config);
      const params = this.buildApiParameters(config);
      
      response = await apiClient.get('', { params });
      const responseTime = Date.now() - startTime;
      
      // Process the API response
      const processedData = this.processApiResponse(response.data, config.circuit_id);
      finalLatencyValue = processedData.finalLatencyValue;
      
      // Log successful API call
      await this.logApiCall({
        circuit_id: config.circuit_id,
        config_id: config.id,
        request_type: requestType,
        request_url: apiClient.defaults.baseURL + '?' + new URLSearchParams(params).toString(),
        response_status: response.status,
        response_time_ms: responseTime,
        raw_response: JSON.stringify(response.data),
        extracted_values: JSON.stringify(processedData.extractedValues),
        calculated_average: processedData.calculatedAverage,
        latest_value: processedData.latestValue,
        final_latency_value: finalLatencyValue,
        data_quality_score: processedData.averageQuality,
        requested_by: userId
      });

      // Update circuit configuration with success
      try {
        await this.updateConfigurationStatus(config.id, {
          last_test_at: new Date().toISOString(),
          last_test_status: 'success',
          last_test_response_time_ms: responseTime,
          last_test_error: null,
          failure_count: 0,
          last_successful_update: new Date().toISOString()
        });
      } catch (updateError) {
        console.error(`Failed to update config status for ${config.circuit_id}:`, updateError.message);
        // Don't fail the entire operation if status update fails
      }

      return {
        success: true,
        circuit_id: config.circuit_id,
        latency_ms: finalLatencyValue,
        response_time_ms: responseTime,
        data_points: processedData.extractedValues.length,
        quality_score: processedData.averageQuality,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error.response?.data?.message || error.message;
      
      console.error(`❌ API call failed for ${config.circuit_id}:`, errorMessage);

      // Log failed API call
      await this.logApiCall({
        circuit_id: config.circuit_id,
        config_id: config.id,
        request_type: requestType,
        request_url: apiClient ? (apiClient.defaults.baseURL + '?' + new URLSearchParams(this.buildApiParameters(config)).toString()) : 'unknown',
        response_status: error.response?.status || 0,
        response_time_ms: responseTime,
        error_message: errorMessage,
        requested_by: userId
      });

      // Update configuration with failure
      const newFailureCount = (config.failure_count || 0) + 1;
      const shouldDisable = newFailureCount >= 3;
      
      try {
        await this.updateConfigurationStatus(config.id, {
          last_test_at: new Date().toISOString(),
          last_test_status: 'failed',
          last_test_response_time_ms: responseTime,
          last_test_error: errorMessage,
          failure_count: newFailureCount,
          disabled_until: shouldDisable ? this.getRetryTimestamp() : null
        });
      } catch (updateError) {
        console.error(`Failed to update config status for ${config.circuit_id}:`, updateError.message);
        // Don't fail the entire operation if status update fails
      }

      return {
        success: false,
        circuit_id: config.circuit_id,
        error: errorMessage,
        response_time_ms: responseTime,
        failure_count: newFailureCount,
        auto_disabled: shouldDisable,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Process API response and calculate final latency value
   */
  processApiResponse(apiData, circuitId) {
    if (!Array.isArray(apiData) || apiData.length === 0) {
      throw new Error('No data returned from API');
    }

    const extractedValues = [];
    let latestTimestamp = null;
    let latestValue = null;

    // Extract all valid measurements
    for (const dataPoint of apiData) {
      if (dataPoint.values && dataPoint.values.length > 0) {
        const value = dataPoint.values[0];
        
        if (value.status === 'good' && typeof value.value === 'number') {
          extractedValues.push({
            timestamp: dataPoint.timestamp,
            value: value.value,
            quality: value.quality || 0,
            min: value.min,
            max: value.max
          });
          
          // Track latest value by timestamp
          if (!latestTimestamp || dataPoint.timestamp > latestTimestamp) {
            latestTimestamp = dataPoint.timestamp;
            latestValue = value.value;
          }
        }
      }
    }

    if (extractedValues.length === 0) {
      throw new Error('No valid measurements found in API response');
    }

    // Calculate average quality score
    const averageQuality = extractedValues.reduce((sum, val) => sum + val.quality, 0) / extractedValues.length;

    // Implement the latency calculation logic:
    // If latest value is 0, return 0 immediately (circuit down)
    // Otherwise, calculate average of all non-zero values
    let finalLatencyValue;
    let calculatedAverage;

    if (latestValue === 0) {
      finalLatencyValue = 0;
      calculatedAverage = null; // Not applicable when latest is 0
      console.log(`⚠️  Circuit ${circuitId} is DOWN (latest value = 0)`);
    } else {
      // Calculate average excluding zero values
      const nonZeroValues = extractedValues.filter(val => val.value !== 0);
      
      if (nonZeroValues.length === 0) {
        finalLatencyValue = 0; // All historical values were 0
        calculatedAverage = 0;
      } else {
        calculatedAverage = nonZeroValues.reduce((sum, val) => sum + val.value, 0) / nonZeroValues.length;
        finalLatencyValue = Math.round(calculatedAverage * 100) / 100; // Round to 2 decimal places
      }
    }

    return {
      extractedValues,
      latestValue,
      calculatedAverage,
      finalLatencyValue,
      averageQuality: Math.round(averageQuality)
    };
  }

  /**
   * Log API call details
   */
  async logApiCall(logData) {
    return new Promise((resolve, reject) => {
      const {
        circuit_id, config_id, request_type, request_url, response_status,
        response_time_ms, raw_response, extracted_values, calculated_average,
        latest_value, final_latency_value, data_quality_score, error_message, requested_by
      } = logData;

      db.run(
        `INSERT INTO live_latency_api_logs 
         (circuit_id, config_id, request_type, request_url, response_status, response_time_ms,
          raw_response, extracted_values, calculated_average, latest_value, final_latency_value,
          data_quality_score, error_message, requested_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          circuit_id, config_id, request_type, request_url, response_status, response_time_ms,
          raw_response, extracted_values, calculated_average, latest_value, final_latency_value,
          data_quality_score, error_message, requested_by
        ],
        function(err) {
          if (err) {
            console.error('Failed to log API call:', err);
            reject(err);
          } else {
            resolve(this ? this.lastID : null);
          }
        }
      );
    });
  }

  /**
   * Update configuration status after API call
   */
  async updateConfigurationStatus(configId, updates) {
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), configId];
    
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE live_latency_config SET ${setClause} WHERE id = ?`,
        values,
        function(err) {
          if (err) {
            console.error('Failed to update configuration status:', err);
            reject(err);
          } else {
            resolve(this ? this.changes : 1); // Return 1 if context is lost
          }
        }
      );
    });
  }

  /**
   * Get timestamp for retry after auto-disable (24 hours from now)
   */
  getRetryTimestamp() {
    const retryHours = 24; // Could be configurable
    const retryTime = new Date(Date.now() + (retryHours * 60 * 60 * 1000));
    return retryTime.toISOString();
  }

  /**
   * Update network route with new latency data
   */
  async updateNetworkRouteLatency(circuitId, latencyMs, source = 'live_latency_api') {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE network_routes SET live_latency = ?, live_latency_last_updated = ?, live_latency_source = ? WHERE circuit_id = ?',
        [latencyMs, new Date().toISOString(), source, circuitId],
        function(err) {
          if (err) {
            console.error(`Failed to update network route ${circuitId}:`, err);
            reject(err);
          } else {
            resolve(this ? this.changes > 0 : true); // Return true if context is lost
          }
        }
      );
    });
  }

  /**
   * Refresh all enabled circuits
   */
  async refreshAllCircuits(userId = null) {
    const startTime = Date.now();
    console.log('🚀 Starting live latency refresh for all circuits...');
    
    try {
      // Check global cooldown
      if (await this.isGlobalRefreshOnCooldown()) {
        throw new Error('Global refresh is on cooldown. Please wait before trying again.');
      }

      // Update last refresh timestamp
      await this.updateLastGlobalRefresh(userId);

      const configurations = await this.getEnabledConfigurations();
      console.log(`📊 Found ${configurations.length} enabled configurations`);
      
      const results = {
        total: configurations.length,
        processed: 0,
        updated: 0,
        failed: 0,
        errors: [],
        duration: 0
      };

      // Process circuits in batches to avoid overwhelming the API
      const batchSize = 3;
      for (let i = 0; i < configurations.length; i += batchSize) {
        const batch = configurations.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (config) => {
          try {
            const result = await this.fetchCircuitLatency(config, 'manual', userId);
            results.processed++;
            
            if (result.success) {
              // Update the network route with new latency data
              try {
                await this.updateNetworkRouteLatency(config.circuit_id, result.latency_ms);
                results.updated++;
                console.log(`✅ Updated ${config.circuit_id}: ${result.latency_ms}ms`);
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
              console.log(`❌ Failed ${config.circuit_id}: ${result.error}`);
            }
            
          } catch (error) {
            results.processed++;
            results.failed++;
            results.errors.push({
              circuit_id: config.circuit_id,
              error: error.message
            });
            console.error(`💥 Exception for ${config.circuit_id}:`, error.message);
          }
        });

        await Promise.all(batchPromises);
        
        // Small delay between batches to be API-friendly
        if (i + batchSize < configurations.length) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
      }

      results.duration = Date.now() - startTime;
      console.log(`🎉 Live latency refresh completed in ${results.duration}ms`);
      console.log(`📈 Updated ${results.updated}/${results.total} circuits`);
      
      if (results.errors.length > 0) {
        console.log(`⚠️  ${results.errors.length} errors occurred`);
      }

      return results;
      
    } catch (error) {
      console.error('❌ Critical error in live latency refresh:', error);
      throw error;
    }
  }

  /**
   * Test connection for a specific circuit configuration
   */
  async testCircuitConnection(circuitId, userId = null) {
    const config = await this.getCircuitConfiguration(circuitId);
    if (!config) {
      throw new Error('Configuration not found for circuit');
    }

    return await this.fetchCircuitLatency(config, 'test', userId);
  }
}

module.exports = LiveLatencyService;
