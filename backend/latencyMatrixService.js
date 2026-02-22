/**
 * Latency Matrix Service
 * Computes hourly latency matrices between configured city locations
 * using live-latency-aware Dijkstra for 1Gb and 10Gb capacity tiers.
 *
 * Key differences from the standard route finder:
 * - Prefers live_latency over expected_latency
 * - Excludes circuits with live_latency = 0 (outage)
 * - Builds graph once per tier, runs Dijkstra for all city pairs
 * - Applies 20% rule for 10Gb: if 10Gb latency > 1.2 * 1Gb latency, mark N/A
 */

const db = require('./db');

class LatencyMatrixService {
  constructor() {
    this.isRunning = false;
    this.intervalTimer = null;
    this.refreshIntervalMs = 60 * 60 * 1000; // 1 hour
    this.isComputing = false;
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️  Latency matrix service is already running');
      return;
    }

    console.log('🚀 Starting latency matrix service (hourly computation)...');
    this.isRunning = true;

    this.computeMatrix().then(() => {
      console.log('✅ Initial latency matrix computation complete');
    }).catch(err => {
      console.error('❌ Initial latency matrix computation failed:', err.message);
    });

    this.intervalTimer = setInterval(() => {
      this.computeMatrix().catch(err => {
        console.error('❌ Scheduled latency matrix computation failed:', err.message);
      });
    }, this.refreshIntervalMs);

    console.log('✅ Latency matrix service started');
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Latency matrix service is not running');
      return;
    }

    console.log('🛑 Stopping latency matrix service...');
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log('✅ Latency matrix service stopped');
  }

  getLocations() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM latency_matrix_locations ORDER BY display_order ASC, city_name ASC',
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  getRoutes() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT nr.circuit_id, nr.location_a, nr.location_b, nr.expected_latency,
                nr.live_latency, nr.bandwidth, nr.underlying_carrier, nr.cable_system,
                nr.equipment_type, nr.is_special, nr.mtu, nr.route_status
         FROM network_routes nr
         LEFT JOIN location_reference lr_a ON nr.location_a = lr_a.location_code
         LEFT JOIN location_reference lr_b ON nr.location_b = lr_b.location_code
         WHERE nr.location_a IS NOT NULL AND nr.location_b IS NOT NULL
         AND (lr_a.status IS NULL OR lr_a.status != 'Under Decommission')
         AND (lr_b.status IS NULL OR lr_b.status != 'Under Decommission')`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Build a graph from routes filtered by minimum bandwidth.
   * Uses live_latency when available and > 0, else falls back to expected_latency.
   * Circuits with live_latency = 0 (outage) are excluded entirely.
   */
  buildGraph(routes, minBandwidthMbps) {
    const graph = {};

    routes.forEach(route => {
      const { location_a, location_b, expected_latency, live_latency, bandwidth, circuit_id, underlying_carrier, cable_system, equipment_type, is_special, route_status } = route;

      if (route_status === 'Under Decommission') return;

      let routeBandwidthMbps = bandwidth;
      let routeBandwidthDisplay = bandwidth;
      if (bandwidth && typeof bandwidth === 'string' && bandwidth.toLowerCase().includes('dark fiber')) {
        routeBandwidthMbps = '200000';
        routeBandwidthDisplay = 'Dark Fiber';
      }

      if (parseFloat(routeBandwidthMbps) < minBandwidthMbps) return;

      // Determine edge weight using live latency preference
      const liveVal = parseFloat(live_latency);
      const estimatedVal = parseFloat(expected_latency);

      if (!isNaN(liveVal) && liveVal === 0) return; // outage - exclude

      let weight;
      if (!isNaN(liveVal) && liveVal > 0) {
        weight = liveVal;
      } else if (!isNaN(estimatedVal) && estimatedVal > 0) {
        weight = estimatedVal;
      } else {
        weight = 100; // fallback
      }

      if (!graph[location_a]) graph[location_a] = {};
      if (!graph[location_b]) graph[location_b] = {};

      const routeData = {
        weight,
        bandwidth: routeBandwidthDisplay,
        carrier: underlying_carrier,
        circuit_id,
        cable_system: cable_system || null
      };

      const existingAB = graph[location_a][location_b];
      if (!existingAB || weight < existingAB.weight) {
        graph[location_a][location_b] = routeData;
        graph[location_b][location_a] = routeData;
      }
    });

    return graph;
  }

  dijkstra(graph, start, end) {
    if (!graph[start] || !graph[end]) return null;

    const distances = {};
    const previous = {};
    const unvisited = new Set(Object.keys(graph));

    for (const node of unvisited) {
      distances[node] = node === start ? 0 : Infinity;
      previous[node] = null;
    }

    while (unvisited.size > 0) {
      let current = null;
      let minDistance = Infinity;

      for (const node of unvisited) {
        if (distances[node] < minDistance) {
          minDistance = distances[node];
          current = node;
        }
      }

      if (current === null || distances[current] === Infinity) break;
      unvisited.delete(current);
      if (current === end) break;

      const neighbors = graph[current];
      if (!neighbors) continue;

      for (const neighbor of Object.keys(neighbors)) {
        if (unvisited.has(neighbor)) {
          const newDist = distances[current] + neighbors[neighbor].weight;
          if (newDist < distances[neighbor]) {
            distances[neighbor] = newDist;
            previous[neighbor] = current;
          }
        }
      }
    }

    const path = [];
    let current = end;
    while (current !== null) {
      path.unshift(current);
      current = previous[current];
    }

    if (path[0] !== start) return null;

    const route = [];
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      const edge = graph[from][to];
      route.push({
        from,
        to,
        latency: Math.round(edge.weight * 100) / 100,
        bandwidth: edge.bandwidth,
        carrier: edge.carrier,
        circuit_id: edge.circuit_id,
        cable_system: edge.cable_system
      });
    }

    return {
      path,
      totalLatency: Math.round(distances[end] * 100) / 100,
      hops: path.length - 1,
      route
    };
  }

  upsertCache(rows) {
    return new Promise((resolve, reject) => {
      if (rows.length === 0) return resolve();

      const now = new Date().toISOString();
      const stmt = `INSERT INTO latency_matrix_cache 
        (source_city, source_pop, destination_city, destination_pop, latency_1g, latency_10g, route_1g, route_10g, last_computed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_pop, destination_pop) DO UPDATE SET
          source_city = excluded.source_city,
          destination_city = excluded.destination_city,
          latency_1g = excluded.latency_1g,
          latency_10g = excluded.latency_10g,
          route_1g = excluded.route_1g,
          route_10g = excluded.route_10g,
          last_computed = excluded.last_computed`;

      let completed = 0;
      let hasError = false;

      rows.forEach(row => {
        db.run(stmt, [
          row.source_city, row.source_pop,
          row.destination_city, row.destination_pop,
          row.latency_1g, row.latency_10g,
          row.route_1g ? JSON.stringify(row.route_1g) : null,
          row.route_10g ? JSON.stringify(row.route_10g) : null,
          now
        ], (err) => {
          if (err && !hasError) {
            hasError = true;
            return reject(err);
          }
          completed++;
          if (completed === rows.length && !hasError) resolve();
        });
      });
    });
  }

  cleanStaleCacheEntries(validPops) {
    return new Promise((resolve, reject) => {
      if (validPops.length === 0) {
        db.run('DELETE FROM latency_matrix_cache', [], (err) => {
          if (err) return reject(err);
          resolve();
        });
        return;
      }
      const placeholders = validPops.map(() => '?').join(',');
      db.run(
        `DELETE FROM latency_matrix_cache 
         WHERE source_pop NOT IN (${placeholders}) OR destination_pop NOT IN (${placeholders})`,
        [...validPops, ...validPops],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  async computeMatrix() {
    if (this.isComputing) {
      console.log('⚠️  Latency matrix computation already in progress, skipping');
      return;
    }

    this.isComputing = true;
    const startTime = Date.now();

    try {
      const locations = await this.getLocations();
      if (locations.length < 2) {
        console.log('📊 Latency matrix: fewer than 2 locations configured, skipping');
        return;
      }

      console.log(`🔄 Computing latency matrix for ${locations.length} locations...`);

      const routes = await this.getRoutes();
      console.log(`📊 Total routes fetched: ${routes.length}`);

      // Build graphs
      const graph1g = this.buildGraph(routes, 1000);    // >= 1 Gbps
      const graph10g = this.buildGraph(routes, 20000);   // >= 20 Gbps

      const cacheRows = [];

      // Compute all pairs
      for (const src of locations) {
        for (const dst of locations) {
          if (src.pop_code === dst.pop_code) continue;

          const result1g = this.dijkstra(graph1g, src.pop_code, dst.pop_code);
          const result10g = this.dijkstra(graph10g, src.pop_code, dst.pop_code);

          let latency1g = result1g ? result1g.totalLatency : null;
          let latency10g = result10g ? result10g.totalLatency : null;

          // Apply 20% rule
          if (latency1g !== null && latency10g !== null && latency10g > latency1g * 1.2) {
            latency10g = null;
          }

          cacheRows.push({
            source_city: src.city_name,
            source_pop: src.pop_code,
            destination_city: dst.city_name,
            destination_pop: dst.pop_code,
            latency_1g: latency1g,
            latency_10g: latency10g,
            route_1g: result1g ? result1g.route : null,
            route_10g: (latency10g !== null && result10g) ? result10g.route : null
          });
        }
      }

      // Clean stale entries for removed locations
      const validPops = locations.map(l => l.pop_code);
      await this.cleanStaleCacheEntries(validPops);

      // Upsert all results
      await this.upsertCache(cacheRows);

      const elapsed = Date.now() - startTime;
      console.log(`✅ Latency matrix computed: ${cacheRows.length} pairs in ${elapsed}ms`);
    } catch (err) {
      console.error('❌ Latency matrix computation error:', err.message);
      throw err;
    } finally {
      this.isComputing = false;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isComputing: this.isComputing,
      refreshInterval: `${this.refreshIntervalMs / 1000 / 60} minutes`,
      serviceType: 'latency_matrix_hourly'
    };
  }
}

const latencyMatrixService = new LatencyMatrixService();
module.exports = latencyMatrixService;
