/**
 * Route/latency pathfinding for the "Ask" chat assistant.
 *
 * Deliberately mirrors `POST /route_finder/find_routes` (backend/routes.js,
 * ~line 18934) exactly - same SQL query, same bandwidth/MTU/equipment/ULL
 * filters, same Dijkstra, same diverse-path logic - so a chat answer never
 * disagrees with what Route Finder itself would return for the same inputs.
 * `routes.js` itself is not touched; this is a parallel implementation.
 *
 * The one addition is `multiSourceDijkstra`, used when the user asks for
 * "best latency across all PoPs" in a city rather than naming a specific
 * PoP - a virtual source/destination node fans out to every candidate PoP
 * at zero weight so the single best pair is found in one pass.
 */

const db = require('../db');

const VIRTUAL_SRC = '__ASSISTANT_VIRTUAL_SRC__';
const VIRTUAL_DST = '__ASSISTANT_VIRTUAL_DST__';

function getRoutesForGraph() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT nr.*,
              lr_a.status as status_a,
              lr_b.status as status_b
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
 * Builds the latency-weighted graph, applying the same filters as
 * `find_routes`: 2x bandwidth capacity requirement, decommission exclusion,
 * equipment type (Cisco only in "fastest" mode), MTU, and ULL/special.
 */
function buildGraph(routes, { bandwidthMbps, mtuRequired = 1500, includeUll = false, useCiscoOnlyRoutes = false } = {}) {
  const graph = {};
  const provisioningRoutes = {};

  routes.forEach(route => {
    const {
      location_a, location_b, expected_latency, bandwidth: routeBandwidth,
      underlying_carrier, circuit_id, cable_system, equipment_type, is_special
    } = route;

    let routeBandwidthMbps = routeBandwidth;
    let routeBandwidthDisplay = routeBandwidth;
    if (routeBandwidth && routeBandwidth.toLowerCase && routeBandwidth.toLowerCase().includes('dark fiber')) {
      routeBandwidthMbps = '200000';
      routeBandwidthDisplay = 'Dark Fiber';
    }

    if (bandwidthMbps && routeBandwidthMbps) {
      const requiredBandwidth = parseFloat(bandwidthMbps) * 2;
      if (parseFloat(routeBandwidthMbps) < requiredBandwidth) return;
    }

    const routeStatus = route.route_status || 'Active';
    if (routeStatus === 'Under Decommission') return;

    if (routeStatus === 'Provisioning') {
      provisioningRoutes[circuit_id] = {
        circuit_id,
        expected_go_live_date: route.expected_go_live_date,
        replaces: route.replaces
      };
    }

    const equipType = equipment_type || 'Nokia';
    if (!useCiscoOnlyRoutes && equipType === 'Cisco') return;

    const routeMtu = route.mtu || 9212;
    if (routeMtu < mtuRequired) return;

    if (!includeUll && is_special) return;

    if (!graph[location_a]) graph[location_a] = {};
    if (!graph[location_b]) graph[location_b] = {};

    const weight = parseFloat(expected_latency) || 100;
    const existingRoute = graph[location_a][location_b];
    if (!existingRoute || weight < existingRoute.weight) {
      const routeData = {
        weight,
        bandwidth: routeBandwidthDisplay,
        carrier: underlying_carrier,
        circuit_id,
        cable_system: cable_system || null
      };
      graph[location_a][location_b] = routeData;
      graph[location_b][location_a] = routeData;
    }
  });

  return { graph, provisioningRoutes };
}

/** Standard Dijkstra over the weighted graph, identical to find_routes. */
function dijkstra(graph, start, end) {
  if (!graph[start] || !graph[end]) return null;

  const distances = {};
  const previous = {};
  const unvisited = new Set(Object.keys(graph));

  Object.keys(graph).forEach(node => {
    distances[node] = node === start ? 0 : Infinity;
    previous[node] = null;
  });

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

    Object.keys(graph[current]).forEach(neighbor => {
      if (unvisited.has(neighbor)) {
        const newDistance = distances[current] + graph[current][neighbor].weight;
        if (newDistance < distances[neighbor]) {
          distances[neighbor] = newDistance;
          previous[neighbor] = current;
        }
      }
    });
  }

  const path = [];
  let current = end;
  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  if (path[0] !== start) return null;

  return { path, totalLatency: distances[end], hops: path.length - 1 };
}

function pathToRouteDetails(graph, path) {
  const details = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const edge = graph[from][to];
    details.push({
      from,
      to,
      latency: edge.weight,
      bandwidth: edge.bandwidth,
      carrier: edge.carrier,
      circuit_id: edge.circuit_id,
      cable_system: edge.cable_system
    });
  }
  return details;
}

/**
 * Finds the best (lowest-latency) pair among candidate source/destination
 * PoPs by fanning virtual source/destination nodes out to every candidate
 * at zero weight, then running one Dijkstra pass. A single-element
 * candidate array degenerates to plain point-to-point Dijkstra, so this is
 * used for every route/latency query - not just "any PoP" ones.
 *
 * Returns { path, totalLatency, hops } with virtual nodes stripped from
 * `path` (so path[0] is the real source PoP, path[path.length-1] the real
 * destination PoP), or null if no candidate pair is connected.
 */
function multiSourceDijkstra(graph, sourceCandidates, destCandidates) {
  const augmented = {};
  Object.keys(graph).forEach(node => {
    augmented[node] = { ...graph[node] };
  });

  augmented[VIRTUAL_SRC] = {};
  sourceCandidates.forEach(code => {
    if (!augmented[code]) return; // candidate PoP has no routes in this graph
    augmented[VIRTUAL_SRC][code] = { weight: 0 };
  });

  destCandidates.forEach(code => {
    if (!augmented[code]) return;
    if (!augmented[code][VIRTUAL_DST]) augmented[code] = { ...augmented[code], [VIRTUAL_DST]: { weight: 0 } };
  });
  augmented[VIRTUAL_DST] = augmented[VIRTUAL_DST] || {};

  const result = dijkstra(augmented, VIRTUAL_SRC, VIRTUAL_DST);
  if (!result) return null;

  const realPath = result.path.slice(1, -1);
  if (realPath.length < 2) return null; // source and destination candidates overlap directly

  return { path: realPath, totalLatency: result.totalLatency, hops: realPath.length - 1 };
}

/**
 * Given a concrete primary path, finds a diverse secondary path that
 * avoids the primary's intermediate PoPs and circuit IDs - identical logic
 * to find_routes' secondary/protection path.
 */
function findDiversePath(graph, primaryPath, source, destination) {
  const modifiedGraph = JSON.parse(JSON.stringify(graph));

  const intermediatePops = primaryPath.path.slice(1, -1);
  intermediatePops.forEach(pop => {
    if (modifiedGraph[pop]) {
      delete modifiedGraph[pop];
      Object.keys(modifiedGraph).forEach(node => {
        if (modifiedGraph[node] && modifiedGraph[node][pop]) {
          delete modifiedGraph[node][pop];
        }
      });
    }
  });

  const primaryCircuitIds = new Set(
    pathToRouteDetails(graph, primaryPath.path).map(r => r.circuit_id)
  );
  Object.keys(modifiedGraph).forEach(fromNode => {
    Object.keys(modifiedGraph[fromNode]).forEach(toNode => {
      const edge = modifiedGraph[fromNode][toNode];
      if (edge && edge.circuit_id && primaryCircuitIds.has(edge.circuit_id)) {
        delete modifiedGraph[fromNode][toNode];
      }
    });
  });

  if (!modifiedGraph[source] || Object.keys(modifiedGraph[source]).length === 0) return null;
  if (!modifiedGraph[destination] || Object.keys(modifiedGraph[destination]).length === 0) return null;

  const diverseResult = dijkstra(modifiedGraph, source, destination);
  if (!diverseResult) return null;

  return {
    path: diverseResult.path,
    totalLatency: diverseResult.totalLatency,
    hops: diverseResult.hops,
    route: pathToRouteDetails(modifiedGraph, diverseResult.path)
  };
}

module.exports = {
  getRoutesForGraph,
  buildGraph,
  dijkstra,
  multiSourceDijkstra,
  findDiversePath,
  pathToRouteDetails
};
