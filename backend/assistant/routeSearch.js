/**
 * Orchestrates a single route/latency search for the "Ask" chat assistant:
 * fetch + build the graph, find the best pair among candidate PoPs, then
 * find a diverse/protected secondary path for that concrete pair - mirroring
 * what Route Finder computes for the same inputs.
 */

const {
  getRoutesForGraph,
  buildGraph,
  multiSourceDijkstra,
  findDiversePath,
  pathToRouteDetails
} = require('./pathfinding');

/**
 * @param {object} params
 * @param {string[]} params.sourceCandidates - one or more source PoP codes
 * @param {string[]} params.destCandidates - one or more destination PoP codes
 * @param {number|null} params.bandwidthMbps
 * @param {'fastest'|'standard'} params.routeMode
 * @param {boolean} params.wantDiverse - whether to also compute a protection path (default true, matches Route Finder's default)
 */
async function findRoute({ sourceCandidates, destCandidates, bandwidthMbps, routeMode = 'standard', wantDiverse = true }) {
  const routes = await getRoutesForGraph();
  const { graph, provisioningRoutes } = buildGraph(routes, {
    bandwidthMbps,
    mtuRequired: 1500,
    includeUll: routeMode === 'fastest',
    useCiscoOnlyRoutes: routeMode === 'fastest'
  });

  const best = multiSourceDijkstra(graph, sourceCandidates, destCandidates);
  if (!best) return null;

  const sourcePop = best.path[0];
  const destPop = best.path[best.path.length - 1];

  const primaryPath = {
    path: best.path,
    totalLatency: best.totalLatency,
    hops: best.hops,
    route: pathToRouteDetails(graph, best.path)
  };

  let diversePath = null;
  if (wantDiverse) {
    diversePath = findDiversePath(graph, primaryPath, sourcePop, destPop);
  }

  const usedCircuitIds = new Set([
    ...primaryPath.route.map(r => r.circuit_id),
    ...(diversePath ? diversePath.route.map(r => r.circuit_id) : [])
  ]);
  const provisioningNotes = Object.values(provisioningRoutes).filter(p => usedCircuitIds.has(p.circuit_id));

  return { sourcePop, destPop, primaryPath, diversePath, provisioningNotes };
}

module.exports = { findRoute };
