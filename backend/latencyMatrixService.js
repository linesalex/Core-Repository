/**
 * Latency Matrix Service
 * Computes hourly latency matrices between configured city locations
 * using live-latency-aware Dijkstra for 1Gb and 10Gb capacity tiers.
 *
 * Key differences from the standard route finder:
 * - Prefers live_latency over expected_latency
 * - Excludes circuits with live_latency = 0 (outage)
 * - Builds graph once per tier, runs Dijkstra for all city pairs
 * - Applies 20%/10ms rule for 10Gb: marks N/A only if 10Gb latency exceeds 1Gb by both more than 20% AND more than 10ms
 */

const db = require('./db');

// Exported (pure, no DB access) so they can be unit tested directly.

// Only rows with an actual computed 1Gb latency are worth tracking as part
// of a day's running low (a null just means no path existed on that run).
function filterRecordableRows(cacheRows) {
  return (cacheRows || []).filter((row) => row.latency_1g !== null && row.latency_1g !== undefined);
}

// A pair needs at least this many recorded days before we trust statistical
// outlier detection over the raw minimum - with too few samples there isn't
// enough signal to reliably tell a genuine anomaly apart from normal
// day-to-day variance, and we'd rather under-filter than wrongly exclude a
// real reading while the 30-day window is still filling in.
const OUTLIER_MIN_SAMPLES = 5;

// Threshold on the median/MAD-based "modified z-score" (Iglewicz & Hoaglin)
// beyond which a day's value is considered a statistical low-outlier for
// that pair. 3.5 is the commonly recommended cutoff for this method.
const OUTLIER_MODIFIED_Z_THRESHOLD = 3.5;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Given one pair's daily-low rows (each needing at least a `lowest_latency_1g`
 * field), flags any day(s) whose value is a statistical low-outlier relative
 * to that *same pair's* own recent values - i.e. a day that reads as an
 * anomalous dip compared to how this specific route normally performs.
 *
 * Uses a median/MAD-based "modified z-score" rather than a mean/stddev
 * z-score specifically because a mean/stddev calculation is itself skewed by
 * the very outlier(s) it's trying to detect (one impossibly-low reading can
 * drag the mean and inflate the stddev enough to hide itself); median and
 * MAD (median absolute deviation) are robust to that.
 *
 * Only ever flags LOW outliers - a day that was unusually slow is real
 * signal (e.g. genuine congestion), not something to hide, so it's left in.
 *
 * Returns { cleanRows, excludedRows } - never excludes every row for a pair
 * (if that would happen, the detection is treated as unreliable for that
 * data shape and nothing is excluded).
 */
// A live_latency reading below this fraction of the same circuit's own
// expected_latency baseline is treated as physically implausible rather than
// a genuine improvement - real production traffic essentially never beats a
// circuit's designed/provisioned latency by a wide margin, so a reading this
// far under baseline is almost always a measurement/monitoring glitch, not a
// faster network. Deliberately generous (allows up to 2x "better than
// expected") so ordinary jitter/measurement variance is never flagged.
const MIN_LIVE_LATENCY_RATIO_OF_EXPECTED = 0.5;

function excludeLowOutlierDays(dayRows) {
  const rows = dayRows || [];
  if (rows.length < OUTLIER_MIN_SAMPLES) {
    return { cleanRows: rows, excludedRows: [] };
  }

  const values = rows.map((r) => r.lowest_latency_1g);
  const med = median(values);
  const mad = median(values.map((v) => Math.abs(v - med)));

  if (mad === 0) {
    // No meaningful spread to compare against - can't safely flag outliers
    // (e.g. every recorded day happens to read almost identically).
    return { cleanRows: rows, excludedRows: [] };
  }

  const cleanRows = [];
  const excludedRows = [];
  rows.forEach((row) => {
    const modifiedZ = (0.6745 * (row.lowest_latency_1g - med)) / mad;
    if (modifiedZ < -OUTLIER_MODIFIED_Z_THRESHOLD) {
      excludedRows.push(row);
    } else {
      cleanRows.push(row);
    }
  });

  if (cleanRows.length === 0) {
    // Never report "no data" because of over-aggressive filtering - fall
    // back to trusting the raw data for this pair instead.
    return { cleanRows: rows, excludedRows: [] };
  }

  return { cleanRows, excludedRows };
}

// Reduces raw latency_matrix_daily_low rows (one per day per pair) down to
// the lowest *non-outlier* value per source/destination pair over the whole
// window, plus how many distinct calendar days of data are behind that
// figure (across all pairs) and, per pair, how many of its recorded days
// were excluded as statistical low-outliers when computing its minimum.
function aggregateDailyLowRows(rows) {
  const byPair = new Map();
  const distinctDates = new Set();

  (rows || []).forEach((row) => {
    distinctDates.add(row.record_date);
    const key = `${row.source_pop}|${row.destination_pop}`;
    if (!byPair.has(key)) {
      byPair.set(key, {
        source_pop: row.source_pop,
        destination_pop: row.destination_pop,
        source_city: row.source_city,
        destination_city: row.destination_city,
        dayRows: []
      });
    }
    byPair.get(key).dayRows.push({
      record_date: row.record_date,
      lowest_latency_1g: row.lowest_latency_1g
    });
  });

  const matrix = Array.from(byPair.values()).map((pair) => {
    const sortedDays = [...pair.dayRows].sort((a, b) => a.record_date.localeCompare(b.record_date));
    const { cleanRows, excludedRows } = excludeLowOutlierDays(sortedDays);

    return {
      source_pop: pair.source_pop,
      destination_pop: pair.destination_pop,
      source_city: pair.source_city,
      destination_city: pair.destination_city,
      latency_1g_low: Math.min(...cleanRows.map((r) => r.lowest_latency_1g)),
      earliest_date: sortedDays[0].record_date,
      days_recorded: sortedDays.length,
      days_excluded_outliers: excludedRows.length
    };
  });

  return {
    matrix,
    distinctDaysRecorded: distinctDates.size
  };
}

// Shared with the test suite so it verifies the exact SQL run in production,
// not a re-implementation of it.
const DAILY_LOW_UPSERT_SQL = `INSERT INTO latency_matrix_daily_low
  (record_date, source_pop, destination_pop, source_city, destination_city, lowest_latency_1g, last_updated)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(record_date, source_pop, destination_pop) DO UPDATE SET
    lowest_latency_1g = MIN(lowest_latency_1g, excluded.lowest_latency_1g),
    source_city = excluded.source_city,
    destination_city = excluded.destination_city,
    last_updated = excluded.last_updated`;

const DAILY_LOW_PRUNE_SQL = `DELETE FROM latency_matrix_daily_low WHERE record_date < date('now', '-30 days')`;

const DAILY_LOW_RESET_SQL = `DELETE FROM latency_matrix_daily_low`;

const DAILY_LOW_SELECT_WINDOW_SQL = `SELECT record_date, source_pop, destination_pop, source_city, destination_city, lowest_latency_1g
  FROM latency_matrix_daily_low
  WHERE record_date >= date('now', '-30 days')`;

class LatencyMatrixService {
  constructor() {
    this.isRunning = false;
    this.intervalTimer = null;
    this.refreshIntervalMs = 60 * 60 * 1000; // 1 hour
    this.isComputing = false;
    // Circuits whose live_latency was rejected as implausible during the
    // current computeMatrix() run (deduped so a circuit that qualifies for
    // both the 1Gb and 10Gb graphs only logs once per run). Reset at the
    // start of every run.
    this._warnedImplausibleCircuits = new Set();
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
   *
   * Sanity check: a live_latency reading that comes in far below that same
   * circuit's own expected_latency baseline (see MIN_LIVE_LATENCY_RATIO_OF_EXPECTED)
   * is rejected as implausible/corrupt data and expected_latency is used
   * instead - the same fallback as if no live reading were present at all.
   * This stops a single bad monitoring sample from ever being computed into
   * the live matrix (and therefore into the 30-day-low tracking derived from
   * it) in the first place.
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

      const hasValidLive = !isNaN(liveVal) && liveVal > 0;
      const hasValidEstimate = !isNaN(estimatedVal) && estimatedVal > 0;
      const liveLooksImplausible = hasValidLive && hasValidEstimate
        && liveVal < estimatedVal * MIN_LIVE_LATENCY_RATIO_OF_EXPECTED;

      let weight;
      if (hasValidLive && !liveLooksImplausible) {
        weight = liveVal;
      } else if (hasValidEstimate) {
        weight = estimatedVal;
      } else if (hasValidLive) {
        // Implausible live reading but no expected_latency baseline to fall
        // back to - a suspect real reading still beats an arbitrary constant.
        weight = liveVal;
      } else {
        weight = 100; // fallback
      }

      if (liveLooksImplausible) {
        if (!this._warnedImplausibleCircuits.has(circuit_id)) {
          this._warnedImplausibleCircuits.add(circuit_id);
          console.warn(`⚠️  Rejected implausible live_latency for circuit ${circuit_id} (${location_a}↔${location_b}): live=${liveVal}ms is below ${Math.round(MIN_LIVE_LATENCY_RATIO_OF_EXPECTED * 100)}% of expected=${estimatedVal}ms - using expected_latency instead`);
        }
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

  /**
   * Upsert today's (UTC) running-lowest 1Gb latency per source/destination
   * pair. Called on every hourly computeMatrix() run - each call only ever
   * lowers today's stored value (never raises it), so by the time the UTC
   * date rolls over, that day's row is frozen at the true lowest latency
   * measured at any point during that day.
   */
  recordDailyLow(cacheRows) {
    return new Promise((resolve, reject) => {
      const rows = filterRecordableRows(cacheRows);
      if (rows.length === 0) return resolve();

      const recordDate = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
      const now = new Date().toISOString();

      let completed = 0;
      let hasError = false;

      rows.forEach((row) => {
        db.run(DAILY_LOW_UPSERT_SQL, [
          recordDate, row.source_pop, row.destination_pop,
          row.source_city, row.destination_city,
          row.latency_1g, now
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

  /**
   * Drop daily-low rows older than the 30-day retention window, keeping
   * latency_matrix_daily_low capped at roughly 30 days per pair.
   */
  pruneOldDailyLows() {
    return new Promise((resolve, reject) => {
      db.run(DAILY_LOW_PRUNE_SQL, [], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  /**
   * Admin action: wipes the entire 30-day daily-low tracking table. Used
   * when bad data (e.g. from a transient upstream live-latency measurement
   * glitch) has been baked into the rolling minimum and needs to be cleared
   * so the table can re-accumulate cleanly from the next hourly
   * computeMatrix() run. Resolves with the number of rows removed.
   */
  resetDailyLows() {
    return new Promise((resolve, reject) => {
      db.run(DAILY_LOW_RESET_SQL, [], function (err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
      });
    });
  }

  /**
   * Admin action: list every recorded daily-low row for a specific
   * source/destination pair, most recent day first. Used by the "inspect &
   * prune" popup on the 30-Day Low tab so an admin can see exactly which
   * day(s) produced the value shown and remove any that look wrong. Each row
   * is annotated with `is_excluded_outlier`, reflecting whether the
   * automatic statistical filter (same logic used by get30DayLowMatrix) is
   * already excluding it from the pair's displayed minimum - so an admin can
   * tell the difference between "already handled automatically" and "still
   * needs a manual delete".
   */
  getDailyLowsForPair(sourcePop, destinationPop) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT record_date, source_pop, destination_pop, source_city, destination_city, lowest_latency_1g, last_updated
         FROM latency_matrix_daily_low
         WHERE source_pop = ? AND destination_pop = ?
         ORDER BY record_date DESC`,
        [sourcePop, destinationPop],
        (err, rows) => {
          if (err) return reject(err);
          const allRows = rows || [];
          const sortedAsc = [...allRows].sort((a, b) => a.record_date.localeCompare(b.record_date));
          const { excludedRows } = excludeLowOutlierDays(sortedAsc);
          const excludedDates = new Set(excludedRows.map((r) => r.record_date));
          resolve(allRows.map((row) => ({
            ...row,
            is_excluded_outlier: excludedDates.has(row.record_date)
          })));
        }
      );
    });
  }

  /**
   * Admin action: delete a single day's recorded low-latency value for a
   * specific pair (e.g. a value that looks physically impossible). Resolves
   * with the number of rows removed (0 or 1).
   */
  deleteDailyLowRow(sourcePop, destinationPop, recordDate) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM latency_matrix_daily_low WHERE source_pop = ? AND destination_pop = ? AND record_date = ?`,
        [sourcePop, destinationPop, recordDate],
        function (err) {
          if (err) return reject(err);
          resolve(this.changes || 0);
        }
      );
    });
  }

  /**
   * Computes the lowest 1Gb latency observed for each source/destination
   * pair over the last 30 days, i.e. "the lowest latency available within
   * the last 30 days" - used by the Home page's 30-Day Low tab and its PDF
   * export. Also reports how many distinct days of data back each pair's
   * value, so the UI can note when the rolling window hasn't fully filled
   * in yet (e.g. shortly after this feature first ships).
   */
  get30DayLowMatrix() {
    return new Promise((resolve, reject) => {
      db.all(DAILY_LOW_SELECT_WINDOW_SQL, [], (err, rows) => {
        if (err) return reject(err);
        resolve(aggregateDailyLowRows(rows));
      });
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

      // Reset per-run dedup so a persistently-bad circuit is still surfaced
      // on every run (not just silenced forever after its first warning).
      this._warnedImplausibleCircuits.clear();

      // Build graphs
      const graph1g = this.buildGraph(routes, 1000);    // >= 1 Gbps
      const graph10g = this.buildGraph(routes, 20000);   // >= 20 Gbps

      if (this._warnedImplausibleCircuits.size > 0) {
        console.warn(`⚠️  Rejected ${this._warnedImplausibleCircuits.size} circuit(s) with implausible live_latency this run (see warnings above) - fell back to expected_latency for each`);
      }

      const cacheRows = [];

      // Compute all pairs
      for (const src of locations) {
        for (const dst of locations) {
          if (src.pop_code === dst.pop_code) continue;

          const result1g = this.dijkstra(graph1g, src.pop_code, dst.pop_code);
          const result10g = this.dijkstra(graph10g, src.pop_code, dst.pop_code);

          let latency1g = result1g ? result1g.totalLatency : null;
          let latency10g = result10g ? result10g.totalLatency : null;

          // Apply 20% or 10ms rule: show 10Gb if delta is within 20% OR within 10ms
          if (latency1g !== null && latency10g !== null) {
            const withinPercent = latency10g <= latency1g * 1.2;
            const withinMs = (latency10g - latency1g) <= 10;
            if (!withinPercent && !withinMs) {
              latency10g = null;
            }
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

      // Track each day's lowest 1Gb-tier latency per pair (rolling 30-day
      // window) for the Home page's 30-Day Low tab / PDF export.
      try {
        await this.recordDailyLow(cacheRows);
        await this.pruneOldDailyLows();
      } catch (dailyLowErr) {
        console.error('⚠️  Failed to update 30-day low latency tracking:', dailyLowErr.message);
        // Don't fail the whole matrix computation over this secondary tracking step.
      }

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

// Exposed for the 30-day low latency regression test only (pure helpers +
// the exact SQL used above, so the test verifies real production behavior
// instead of a re-implementation of it).
module.exports.filterRecordableRows = filterRecordableRows;
module.exports.aggregateDailyLowRows = aggregateDailyLowRows;
module.exports.excludeLowOutlierDays = excludeLowOutlierDays;
module.exports.median = median;
module.exports.OUTLIER_MIN_SAMPLES = OUTLIER_MIN_SAMPLES;
module.exports.OUTLIER_MODIFIED_Z_THRESHOLD = OUTLIER_MODIFIED_Z_THRESHOLD;
module.exports.MIN_LIVE_LATENCY_RATIO_OF_EXPECTED = MIN_LIVE_LATENCY_RATIO_OF_EXPECTED;
module.exports.DAILY_LOW_UPSERT_SQL = DAILY_LOW_UPSERT_SQL;
module.exports.DAILY_LOW_PRUNE_SQL = DAILY_LOW_PRUNE_SQL;
module.exports.DAILY_LOW_SELECT_WINDOW_SQL = DAILY_LOW_SELECT_WINDOW_SQL;
module.exports.DAILY_LOW_RESET_SQL = DAILY_LOW_RESET_SQL;
