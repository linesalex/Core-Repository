const fs = require('fs');
const path = require('path');
// Must stay on d3-force 2.x: 3.x is ESM-only, so `require()` of it throws
// ERR_REQUIRE_ESM on any Node before 22.12. Bumping to 3.x breaks the RHEL 7
// production host (Node 16) at boot, not just PDF export.
const { forceSimulation, forceCollide, forceX, forceY } = require('d3-force');
const { formatBandwidth } = require('./utils/formatBandwidth');
const { isSidecarConfigured, renderPdfViaSidecar } = require('./pdfRenderClient');
const { resolveNodeCoordinate } = require('./utils/cityGeocoder');

// Loaded lazily, never at module scope: puppeteer is only needed for the local
// rendering fallback, and requiring it on Node < 16 throws a SyntaxError from
// puppeteer-core's use of `??=`, which would take the whole backend down over a
// single export feature. Hosts that render via the sidecar (or don't use PDF
// export at all) must still boot normally.
function loadPuppeteer() {
  try {
    return require('puppeteer');
  } catch (err) {
    throw new Error(
      `Local PDF rendering is unavailable on this host (${err.message}). Set ` +
      'PDF_RENDER_SIDECAR_URL to render via the sidecar service instead - see ' +
      'RHEL_PRODUCTION_DEPLOYMENT_V3.5.0.md.'
    );
  }
}

// Fixed, always-on confidentiality label - never configurable from the export dialog.
const CONFIDENTIALITY_LABEL = 'CONFIDENTIAL - NOT FOR DISTRIBUTION WITHOUT PERMISSION';

const LOGO_PATH = path.join(__dirname, 'assets', 'ipc-logo.png');

const REGION_ORDER = ['AMERs', 'EMEA', 'APAC'];
const REGION_COLORS = {
  AMERs: '#1565C0',
  EMEA: '#2E7D32',
  APAC: '#C62828',
};

// Maximum number of location nodes placed on a single page before a region
// is automatically split into multiple pages (e.g. "AMERs (Page 1 of 2)").
// Diagram pages auto-expand well past A4/poster size (see MAX_PAGE_DIMENSION_PX
// below) as node count grows, so this is set high enough that even large
// regions (50-90+ locations) stay on one page - pages only split when a
// region is truly too large to lay out on a single sheet.
const MAX_NODES_PER_PAGE = 90;

// Minimum diagram content size so even small pages still read as a large,
// spacious poster rather than a cramped chart.
const MIN_CONTENT_WIDTH = 1500;
const MIN_CONTENT_HEIGHT = 1000;

// Chromium's PDF printer has a practical page-size ceiling (~200in). Cap in px (96 CSS px/in)
// with headroom so we never silently clip content. Diagram pages are allowed to grow all the
// way up to this (far past A4) so dense regions still fit on one page instead of splitting.
const MAX_PAGE_DIMENSION_PX = 18000;

const TITLE_BLOCK_HEIGHT = 88;
const OUTER_MARGIN = 40;
const NODE_PADDING = 80;
const SCHEDULE_GAP = 30;
// Reference (POP Code Reference + Route Schedule) pages have no diagram to
// size themselves against, so they use this as their minimum content width.
const REFERENCE_MIN_WIDTH = 1400;

const TAG_RADIUS = 14;
const STUB_LENGTH = 74;
// Generous per-route-line height estimate (allows for the occasional wrap
// onto a second line with a long carrier name) used only to size the page's
// fixed height - actual balancing across columns is handled by CSS.
const SCHEDULE_LINE_HEIGHT = 34;

let cachedLogoDataUri = null;
function getLogoDataUri() {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  try {
    const buffer = fs.readFileSync(LOGO_PATH);
    cachedLogoDataUri = `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error('Network map renderer: failed to load logo asset:', err.message);
    cachedLogoDataUri = '';
  }
  return cachedLogoDataUri;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatLatency(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${Math.round(num * 100) / 100}ms`;
}

function isInterRegional(edge) {
  return edge.routes.some((r) => r.region === 'INTER');
}

// ---------------------------------------------------------------------------
// Edge visual styling - at production density (100+ crossing lines), a flat
// gray line for every route made it impossible to tell which line was which.
// Each edge now gets a deterministic (same edge -> same look every render),
// distinctive hue plus a visual weight based on its bandwidth, so the eye
// can follow one specific line through a crossing and naturally prioritise
// the higher-bandwidth backbone routes over minor ones.
// ---------------------------------------------------------------------------

function edgeSortKey(edge) {
  return [edge.locationA, edge.locationB].sort().join('|');
}

// Small, fast string hash (not cryptographic - just needs to be deterministic
// and reasonably well-distributed across POP-code pairs).
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (Math.imul(hash, 31) + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// A distinct color per edge (by POP-code pair, so it's stable across pages/
// re-renders) - fixed saturation/lightness keeps every hue legible against
// the white page background and dark tag-number text. INTER-regional edges
// keep their existing purple/dashed treatment instead (already a meaningful,
// distinct category) rather than being hashed too.
function edgeColor(edge) {
  if (isInterRegional(edge)) return '#8E24AA';
  const hue = hashString(edgeSortKey(edge)) % 360;
  return `hsl(${hue}, 62%, 40%)`;
}

// Bundled routes on the same POP pair (see "bundled_line" in the export
// design) are drawn as one line - its weight reflects the single biggest
// circuit in the bundle, since that's the connection's real capacity.
function edgeBandwidthProfile(edge) {
  let maxMbps = 0;
  let hasDarkFiber = false;
  edge.routes.forEach((r) => {
    const raw = String(r.bandwidth || '').trim();
    const numeric = Number(raw);
    if (Number.isNaN(numeric)) {
      if (/dark\s*fiber/i.test(raw)) hasDarkFiber = true;
    } else {
      maxMbps = Math.max(maxMbps, numeric);
    }
  });
  return { maxMbps, hasDarkFiber };
}

// Thicker + more opaque for higher-bandwidth routes, so the eye is drawn to
// the backbone connections first and thin/minor circuits fade into the
// background instead of visually competing with them on equal terms.
function edgeLineWeight(edge) {
  const { maxMbps, hasDarkFiber } = edgeBandwidthProfile(edge);
  if (hasDarkFiber || maxMbps >= 10000) return { strokeWidth: 4, opacity: 0.9 };
  if (maxMbps >= 1000) return { strokeWidth: 2.6, opacity: 0.75 };
  return { strokeWidth: 1.6, opacity: 0.55 };
}

// Deterministic per-edge curve parameters (a gentle bezier bow instead of a
// dead-straight line): `sign` alternates which side of the straight A-B path
// an edge bows toward, and `ratio` (as a fraction of the A-B distance, so it
// scales correctly with the line's own length) varies slightly per edge -
// together these mean two routes that used to sit exactly on top of each
// other (or cut through the same crowd of unrelated nodes) now visually
// separate instead of perfectly overlapping.
function edgeCurveParams(edge) {
  const hash = hashString(edgeSortKey(edge));
  const sign = (hash % 2 === 0) ? 1 : -1;
  const ratio = 0.08 + ((hash % 97) / 97) * 0.10; // ~0.08 - 0.18
  return { sign, ratio };
}

// Given the two live endpoint positions and this edge's curve params, returns
// the quadratic bezier control point and the actual on-curve point at t=0.5
// (NOT the straight-line midpoint - used for both drawing the curve and
// placing its tag badge). Recomputed from the endpoints' CURRENT positions
// every time it's needed (rather than cached), so it stays correct through
// any later uniform translate/scale applied to the whole layout.
function edgeCurveControlPoint(a, b, curve) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const offset = dist * curve.ratio * curve.sign;
  return { controlX: (a.x + b.x) / 2 + nx * offset, controlY: (a.y + b.y) / 2 + ny * offset };
}

// Point on the quadratic bezier at parameter t (0 = at node a, 1 = at node
// b) - used both to draw the curve and to place a tag ANYWHERE along its
// own line (see resolveLocalTagPosition), so the tag badge is guaranteed to
// sit exactly on the line it labels, never floating off to one side of it.
function edgeCurvePointAtT(a, b, curve, t) {
  const { controlX, controlY } = edgeCurveControlPoint(a, b, curve);
  const mt = 1 - t;
  const x = (mt * mt * a.x) + (2 * mt * t * controlX) + (t * t * b.x);
  const y = (mt * mt * a.y) + (2 * mt * t * controlY) + (t * t * b.y);
  return { x, y, controlX, controlY };
}

function edgeCurveGeometry(a, b, curve) {
  const { x: midX, y: midY, controlX, controlY } = edgeCurvePointAtT(a, b, curve, 0.5);
  return { controlX, controlY, midX, midY };
}

// ---------------------------------------------------------------------------
// Geographic coordinate resolution - every node gets a best-effort lat/long
// (manual entry if ever populated, otherwise an offline city/country lookup)
// so the diagram can be laid out to genuinely reflect real-world geography
// (e.g. Paris next to Frankfurt, Milan south of both) instead of pure
// force-directed physics. Nodes that can't be resolved at all (unrecognized
// city/country spelling) fall back to the centroid of every resolved node,
// rather than (0, 0), so a handful of misses don't distort the whole map.
// ---------------------------------------------------------------------------

function resolveNodeCoordinates(nodes) {
  const resolvedCoords = [];
  nodes.forEach((n) => {
    const coord = resolveNodeCoordinate(n);
    n.lat = coord.lat;
    n.lon = coord.lon;
    n.geoResolved = coord.resolved;
    if (coord.resolved) resolvedCoords.push(coord);
  });

  if (resolvedCoords.length > 0) {
    const fallbackLat = resolvedCoords.reduce((sum, c) => sum + c.lat, 0) / resolvedCoords.length;
    const fallbackLon = resolvedCoords.reduce((sum, c) => sum + c.lon, 0) / resolvedCoords.length;
    nodes.forEach((n) => {
      if (!n.geoResolved) {
        n.lat = fallbackLat;
        n.lon = fallbackLon;
      }
    });
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Partitioning: group in-scope nodes by region, split into connected
// components, and bin-pack components into pages capped at MAX_NODES_PER_PAGE.
// ---------------------------------------------------------------------------

function computeConnectedComponents(nodeCodes, edgePairs) {
  const adjacency = new Map();
  nodeCodes.forEach((code) => adjacency.set(code, new Set()));
  edgePairs.forEach(([a, b]) => {
    if (adjacency.has(a) && adjacency.has(b)) {
      adjacency.get(a).add(b);
      adjacency.get(b).add(a);
    }
  });

  const visited = new Set();
  const components = [];
  nodeCodes.forEach((code) => {
    if (visited.has(code)) return;
    const queue = [code];
    const comp = [];
    visited.add(code);
    while (queue.length > 0) {
      const current = queue.shift();
      comp.push(current);
      adjacency.get(current).forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
    components.push(comp);
  });
  return components;
}

function binPackComponents(components, maxPerPage) {
  const oversized = components.filter((c) => c.length > maxPerPage);
  const normal = components.filter((c) => c.length <= maxPerPage);

  const pages = [];

  // Oversized single components can't share a page with anything else -
  // chunk them independently into consecutive slices.
  oversized.forEach((comp) => {
    const sorted = [...comp].sort();
    for (let i = 0; i < sorted.length; i += maxPerPage) {
      pages.push(sorted.slice(i, i + maxPerPage));
    }
  });

  // First-fit-decreasing bin packing for normally-sized components, so
  // actually-connected clusters stay together on one page wherever possible.
  const sortedNormal = [...normal].sort((a, b) => b.length - a.length);
  const bins = [];
  sortedNormal.forEach((comp) => {
    const bin = bins.find((b) => b.size + comp.length <= maxPerPage);
    if (bin) {
      bin.codes.push(...comp);
      bin.size += comp.length;
    } else {
      bins.push({ codes: [...comp], size: comp.length });
    }
  });
  bins.forEach((bin) => pages.push(bin.codes));

  return pages;
}

/**
 * @param {Array} nodes  Full node list from the export_map query (includes
 *                        both in-scope nodes and "foreign" INTER endpoints).
 * @param {Array} edges  Full edge list (grouped by unordered location pair).
 * @param {Array} regions Selected regions, e.g. ['AMERs', 'EMEA'].
 */
function partitionIntoPages(nodes, edges, regions) {
  const inScopeNodes = nodes.filter((n) => n.inSelectedRegions);
  const inScopeByCode = new Map(inScopeNodes.map((n) => [n.code, n]));
  const foreignNodesByCode = new Map(
    nodes.filter((n) => !n.inSelectedRegions).map((n) => [n.code, n])
  );

  const pages = [];

  REGION_ORDER.filter((r) => regions.includes(r)).forEach((region) => {
    const regionNodeCodes = inScopeNodes.filter((n) => n.region === region).map((n) => n.code);
    if (regionNodeCodes.length === 0) return;

    const intraRegionPairs = edges
      .filter((e) => {
        const a = inScopeByCode.get(e.locationA);
        const b = inScopeByCode.get(e.locationB);
        return a && b && a.region === region && b.region === region;
      })
      .map((e) => [e.locationA, e.locationB]);

    const components = computeConnectedComponents(regionNodeCodes, intraRegionPairs);
    const pageNodeCodeGroups = binPackComponents(components, MAX_NODES_PER_PAGE);
    const totalPagesInRegion = pageNodeCodeGroups.length;

    pageNodeCodeGroups.forEach((codes, idx) => {
      pages.push({
        id: `${region}-${idx + 1}`,
        region,
        pageIndexInRegion: idx + 1,
        totalPagesInRegion,
        nodes: codes.map((code) => inScopeByCode.get(code)),
        nodeCodes: new Set(codes),
        localEdges: [],
        stubEdges: [],
      });
    });
  });

  const codeToPage = new Map();
  pages.forEach((page) => {
    page.nodeCodes.forEach((code) => codeToPage.set(code, page));
  });

  edges.forEach((edge) => {
    const pageA = codeToPage.get(edge.locationA);
    const pageB = codeToPage.get(edge.locationB);
    if (pageA && pageB && pageA === pageB) {
      pageA.localEdges.push(edge);
      return;
    }
    if (pageA) pageA.stubEdges.push(edge);
    if (pageB && pageB !== pageA) pageB.stubEdges.push(edge);
  });

  return { pages, codeToPage, foreignNodesByCode, inScopeByCode };
}

// ---------------------------------------------------------------------------
// Per-page geographic layout. Nodes are placed by real (or best-effort
// resolved) latitude/longitude rather than pure force-directed physics, so
// the diagram reads like an actual map - Paris sits next to Frankfurt with
// Milan below, London/EMEA POPs cluster together, etc. Left/right and
// top/bottom ordering is preserved, but each axis is independently rescaled
// to use the full available canvas (this page's node count already sizes
// that canvas - see contentWidth/contentHeight below), which the geographic
// aspect ratio would otherwise leave mostly unused. A light collision-only
// force pass afterward resolves any remaining overlap without pulling nodes
// away from their geographic position.
// ---------------------------------------------------------------------------

// Groups nodes that share a city (e.g. four Newark POPs) so they can be
// arranged as a small local cluster around one shared map position, instead
// of every node fighting for the exact same point.
function buildCityClusterKey(node) {
  const city = (node.city || '').trim().toLowerCase();
  const country = (node.country || '').trim().toLowerCase();
  return city ? `${city}|${country}` : `code:${node.code}`;
}

// A region's nodes should never span the antimeridian in practice, but this
// guards against a bad longitude wraparound (e.g. a stray Pacific location)
// silently collapsing the whole layout's horizontal spread.
function normalizeAntimeridian(pageNodes) {
  const lons = pageNodes.map((n) => n.lon).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (lons.length < 2) return;
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  if (maxLon - minLon > 180) {
    pageNodes.forEach((n) => {
      if (typeof n.lon === 'number' && n.lon < 0) n.lon += 360;
    });
  }
}

// How much on-canvas radius a city cluster needs once its members are
// arranged (a single-POP city needs just its own circle; a multi-POP city
// needs a small ring big enough that member circles don't overlap).
function estimateClusterFootprintRadius(members) {
  if (members.length <= 1) return (members[0] && members[0].radius) || 30;
  const avgRadius = members.reduce((sum, m) => sum + m.radius, 0) / members.length;
  const ringRadius = Math.max(avgRadius * 1.8, (avgRadius * 2.4 * members.length) / (2 * Math.PI));
  return ringRadius + avgRadius;
}

// Spreads a city cluster's members around its map position in a small ring,
// so same-city POPs (e.g. IPCNWK1-4, all "Newark") stay legible instead of
// stacking on the exact same point.
function arrangeClusterMembers(cluster) {
  const { members } = cluster;
  if (members.length === 1) {
    members[0].anchorX = cluster.centerX;
    members[0].anchorY = cluster.centerY;
    return;
  }
  const avgRadius = members.reduce((sum, m) => sum + m.radius, 0) / members.length;
  const ringRadius = Math.max(avgRadius * 1.8, (avgRadius * 2.4 * members.length) / (2 * Math.PI));
  members.forEach((m, i) => {
    const angle = (i / members.length) * Math.PI * 2;
    m.anchorX = cluster.centerX + Math.cos(angle) * ringRadius;
    m.anchorY = cluster.centerY + Math.sin(angle) * ringRadius;
  });
}

function scaleLinear(value, min, max, targetMin, targetMax) {
  if (max - min < 1e-9) return (targetMin + targetMax) / 2;
  return targetMin + ((value - min) / (max - min)) * (targetMax - targetMin);
}

// Computes each node's `anchorX`/`anchorY` - the geographically-derived
// target position the force simulation below pulls it toward.
function placeNodesGeographically(simNodes, contentWidth, contentHeight) {
  normalizeAntimeridian(simNodes);

  const clustersByKey = new Map();
  simNodes.forEach((n) => {
    const key = buildCityClusterKey(n);
    if (!clustersByKey.has(key)) clustersByKey.set(key, { members: [], lat: n.lat, lon: n.lon });
    clustersByKey.get(key).members.push(n);
  });
  const clusters = [...clustersByKey.values()];

  // Raw equirectangular projection (uncorrected - the independent per-axis
  // rescale to the canvas below makes any constant longitude/latitude
  // correction factor cancel out, since it's just an overall linear scale).
  clusters.forEach((c) => {
    c.rawX = typeof c.lon === 'number' ? c.lon : 0;
    c.rawY = typeof c.lat === 'number' ? -c.lat : 0;
    c.footprintRadius = estimateClusterFootprintRadius(c.members);
  });

  const rawXs = clusters.map((c) => c.rawX);
  const rawYs = clusters.map((c) => c.rawY);
  const minRawX = Math.min(...rawXs);
  const maxRawX = Math.max(...rawXs);
  const minRawY = Math.min(...rawYs);
  const maxRawY = Math.max(...rawYs);

  const maxFootprint = Math.max(...clusters.map((c) => c.footprintRadius), 40);
  const marginX = Math.min(contentWidth * 0.4, maxFootprint + 40);
  const marginY = Math.min(contentHeight * 0.4, maxFootprint + 40);

  // Degenerate case (no usable geo data resolved at all, e.g. every node's
  // city/country was unrecognized): fall back to a plain grid of cluster
  // positions rather than collapsing every cluster onto the same point.
  const isDegenerate = (maxRawX - minRawX < 1e-9) && (maxRawY - minRawY < 1e-9);
  if (isDegenerate && clusters.length > 1) {
    const cols = Math.ceil(Math.sqrt(clusters.length));
    const rows = Math.ceil(clusters.length / cols);
    clusters.forEach((c, i) => {
      c.centerX = scaleLinear(i % cols, 0, Math.max(cols - 1, 1), marginX, contentWidth - marginX);
      c.centerY = scaleLinear(Math.floor(i / cols), 0, Math.max(rows - 1, 1), marginY, contentHeight - marginY);
      arrangeClusterMembers(c);
    });
  } else {
    clusters.forEach((c) => {
      c.centerX = scaleLinear(c.rawX, minRawX, maxRawX, marginX, contentWidth - marginX);
      c.centerY = scaleLinear(c.rawY, minRawY, maxRawY, marginY, contentHeight - marginY);
      arrangeClusterMembers(c);
    });
  }

  // Safety net for a page with very few distinct cities (e.g. only 1-2
  // clusters, or every city clustered tightly together): geographic
  // projection alone would leave everything bunched near the canvas center,
  // wasting most of the available page. Expand every node's position
  // outward from the overall center (independently per axis) until the
  // layout uses a healthy portion of the canvas - capped so a genuinely
  // small page group (e.g. two POPs in one city) doesn't get stretched to
  // an unreasonable extreme.
  const anchorXs = simNodes.map((n) => n.anchorX);
  const anchorYs = simNodes.map((n) => n.anchorY);
  const spreadX = Math.max(...anchorXs) - Math.min(...anchorXs);
  const spreadY = Math.max(...anchorYs) - Math.min(...anchorYs);
  const centerAnchorX = (Math.max(...anchorXs) + Math.min(...anchorXs)) / 2;
  const centerAnchorY = (Math.max(...anchorYs) + Math.min(...anchorYs)) / 2;
  const targetSpreadX = contentWidth - (marginX * 2);
  const targetSpreadY = contentHeight - (marginY * 2);
  const MAX_EXPAND = 6;
  const expandX = spreadX > 1 ? Math.min(MAX_EXPAND, Math.max(1, targetSpreadX / spreadX)) : 1;
  const expandY = spreadY > 1 ? Math.min(MAX_EXPAND, Math.max(1, targetSpreadY / spreadY)) : 1;
  if (expandX > 1.01 || expandY > 1.01) {
    simNodes.forEach((n) => {
      n.anchorX = centerAnchorX + (n.anchorX - centerAnchorX) * expandX;
      n.anchorY = centerAnchorY + (n.anchorY - centerAnchorY) * expandY;
    });
  }
}

// `contentSizeOverride` lets the second layout pass in renderMultiPageHtml
// (see `relayoutDiagramsToFillSharedCanvas`) re-run this same page's layout
// against a larger target area - e.g. when another page's Route Schedule
// ends up taller than this page's diagram, every page still shares one
// physical size (a Puppeteer page.pdf() constraint), so a diagram smaller
// than that shared canvas would otherwise sit in a small corner of mostly
// blank space instead of spanning the full page.
function computeLayout(pageNodes, localEdges, contentSizeOverride) {
  const nodeCount = Math.max(pageNodes.length, 1);
  // The per-axis multiplier here is deliberately smaller than the enforced
  // minimum node gap below would suggest: most of a page's now-larger
  // spacing requirement comes from the doubled collision distance forcing
  // the *actual* laid-out bounding box outward past this "natural" target
  // (see the real, post-simulation width/height computed further down) -
  // budgeting less purely for matching literal geographic proportions here
  // keeps that growth from compounding on top of itself. Pulled back again
  // (300->225, 240->180) alongside the second doubling of MIN_NODE_GAP_PADDING
  // below - less of the page is spent on literal geographic proportionality,
  // more of the final spread comes from the (now even larger) enforced
  // minimum gap between individual POPs.
  const naturalWidth = Math.max(MIN_CONTENT_WIDTH, Math.sqrt(nodeCount) * 225);
  const naturalHeight = Math.max(MIN_CONTENT_HEIGHT, Math.sqrt(nodeCount) * 180);
  const contentWidth = contentSizeOverride ? Math.max(naturalWidth, contentSizeOverride.width) : naturalWidth;
  const contentHeight = contentSizeOverride ? Math.max(naturalHeight, contentSizeOverride.height) : naturalHeight;

  const degreeByCode = {};
  localEdges.forEach((e) => {
    degreeByCode[e.locationA] = (degreeByCode[e.locationA] || 0) + e.routes.length;
    degreeByCode[e.locationB] = (degreeByCode[e.locationB] || 0) + e.routes.length;
  });

  const simNodes = pageNodes.map((n) => {
    const codeFontSize = n.code && n.code.length > 8 ? 10 : 12;
    // Circle must be wide enough to comfortably fit the code text on a
    // single line (roughly 0.62em per character for bold Arial) - taking
    // the max with the existing degree-based sizing means well-connected
    // hub nodes still stand out visually even with a short code.
    const textRadius = ((n.code || '').length * codeFontSize * 0.62) / 2 + 9;
    const degreeRadius = Math.min(50, Math.max(24, 20 + (degreeByCode[n.code] || 0) * 2.2));
    return {
      ...n,
      id: n.code,
      codeFontSize,
      radius: Math.max(textRadius, degreeRadius),
    };
  });

  placeNodesGeographically(simNodes, contentWidth, contentHeight);
  simNodes.forEach((n) => {
    n.x = n.anchorX;
    n.y = n.anchorY;
  });

  // Collision-only pass: nodes are already positioned geographically, this
  // just nudges apart any residual overlap between neighboring clusters
  // (e.g. two nearby European cities whose local rings slightly touch)
  // without dragging anything away from its real-world position.
  //
  // MIN_NODE_GAP_PADDING (added per node, so summed across any touching
  // pair) sets the enforced minimum edge-to-edge gap between ANY two nodes
  // on the page - production-scale exports were dense enough that lines
  // between nearby/same-city POPs were unreadable at the old 26px padding
  // (a 52px minimum gap); doubled to 52px per node (104px minimum gap), then
  // doubled again to 104px per node (208px minimum gap) for legibility at
  // real production density. This is deliberately a bigger ask of the
  // simulation than pure geographic proportionality can satisfy on its own,
  // which is why `naturalWidth`/`naturalHeight` above budget less for that
  // proportionality than they used to - the actual final canvas (computed
  // from real node positions below, not the natural-size target) grows to
  // fit this instead.
  const MIN_NODE_GAP_PADDING = 104;
  const simulation = forceSimulation(simNodes)
    .force('x', forceX((d) => d.anchorX).strength(0.6))
    .force('y', forceY((d) => d.anchorY).strength(0.6))
    .force('collide', forceCollide((d) => d.radius + MIN_NODE_GAP_PADDING))
    .stop();

  const TICKS = 500;
  for (let i = 0; i < TICKS; i += 1) simulation.tick();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  simNodes.forEach((n) => {
    minX = Math.min(minX, n.x - n.radius);
    minY = Math.min(minY, n.y - n.radius);
    maxX = Math.max(maxX, n.x + n.radius);
    maxY = Math.max(maxY, n.y + n.radius);
  });
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = contentWidth;
    maxY = contentHeight;
  }

  const offsetX = NODE_PADDING - minX;
  const offsetY = NODE_PADDING - minY;
  simNodes.forEach((n) => {
    n.x += offsetX;
    n.y += offsetY;
  });

  const width = Math.ceil(maxX - minX + NODE_PADDING * 2);
  const height = Math.ceil(maxY - minY + NODE_PADDING * 2);

  return { nodes: simNodes, width, height };
}

function capLayoutToMaxDimension(layout, chromeWidth, chromeHeight) {
  const totalWidth = chromeWidth + layout.width;
  const totalHeight = chromeHeight + layout.height;
  const scale = Math.min(1, MAX_PAGE_DIMENSION_PX / totalWidth, MAX_PAGE_DIMENSION_PX / totalHeight);
  if (scale >= 1) return layout;

  console.warn(`Network map export: page layout exceeds max page dimension, scaling down by ${scale.toFixed(3)}`);
  layout.nodes.forEach((n) => {
    n.x *= scale;
    n.y *= scale;
    n.radius *= scale;
  });
  layout.width = Math.ceil(layout.width * scale);
  layout.height = Math.ceil(layout.height * scale);
  return layout;
}

// Safety cap used only by the fill-the-shared-canvas relayout pass: tags are
// built (and can expand the canvas slightly, via expandLayoutForTags) AFTER
// a target size is chosen, so this guarantees the final result never exceeds
// that target and gets clipped by the page's fixed-size, `overflow: hidden`
// container. Scales nodes and tags together (uniformly, so text/line
// proportions stay consistent) since tag positions were computed from - but
// are not live-derived from - the node positions.
function capLayoutAndTagsToDimensions(layout, tags, targetWidth, targetHeight) {
  const scale = Math.min(1, targetWidth / layout.width, targetHeight / layout.height);
  if (scale >= 1) return;
  layout.nodes.forEach((n) => {
    n.x *= scale;
    n.y *= scale;
    n.radius *= scale;
  });
  tags.forEach((t) => {
    t.x *= scale;
    t.y *= scale;
    t.radius *= scale;
  });
  layout.width = Math.ceil(layout.width * scale);
  layout.height = Math.ceil(layout.height * scale);
}

// ---------------------------------------------------------------------------
// Stub angle placement - distribute off-page reference stubs into the
// largest free angular gap around a node, so multiple stubs on a busy hub
// node spread out instead of stacking on top of each other.
// ---------------------------------------------------------------------------

function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  let a = angle % twoPi;
  if (a < 0) a += twoPi;
  return a;
}

function pickLargestGapAngle(occupiedAngles) {
  if (occupiedAngles.length === 0) return Math.random() * Math.PI * 2;
  const sorted = [...occupiedAngles].map(normalizeAngle).sort((a, b) => a - b);
  let bestGapStart = sorted[sorted.length - 1];
  let bestGapSize = (sorted[0] + Math.PI * 2) - sorted[sorted.length - 1];
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > bestGapSize) {
      bestGapSize = gap;
      bestGapStart = sorted[i - 1];
    }
  }
  return normalizeAngle(bestGapStart + bestGapSize / 2);
}

// ---------------------------------------------------------------------------
// Tag position resolution - a numbered badge must always sit exactly ON the
// line it labels (never drift off to one side of it), while still never
// overlapping any node circle or any other tag badge. A generic 2D "push
// apart" pass (the previous approach) can't guarantee this - pushing a badge
// away from an obstacle in an arbitrary direction is exactly what moves it
// off its own line. Instead, each tag is only ever allowed to slide ALONG
// its own line: a local edge's tag searches positions along its bezier
// curve (parameter t); a stub's tag searches positions further out along
// its fixed straight ray from the node. Processed in tag-number order, each
// tag avoiding every node plus every already-placed tag, which is a real
// geometric guarantee against those obstacles (not a one-shot heuristic).
// ---------------------------------------------------------------------------

const TAG_CLEARANCE_FROM_NODE = 6;
const TAG_CLEARANCE_FROM_TAG = 4;

function isPositionClear(x, y, radius, nodeObstacles, placedTagCircles) {
  for (let i = 0; i < nodeObstacles.length; i += 1) {
    const node = nodeObstacles[i];
    const d = Math.hypot(x - node.x, y - node.y) - node.radius - radius - TAG_CLEARANCE_FROM_NODE;
    if (d < 0) return false;
  }
  for (let i = 0; i < placedTagCircles.length; i += 1) {
    const other = placedTagCircles[i];
    const d = Math.hypot(x - other.x, y - other.y) - other.radius - radius - TAG_CLEARANCE_FROM_TAG;
    if (d < 0) return false;
  }
  return true;
}

// Tries candidate `t` values along a local edge's curve, starting at 0.5 and
// expanding outward in both directions, staying within [T_MIN, T_MAX] so the
// badge never gets close enough to slide onto/past either endpoint node.
function resolveLocalTagPosition(tag, nodeObstacles, placedTagCircles) {
  const T_MIN = 0.16;
  const T_MAX = 0.84;
  const STEP = 0.025;

  let fallbackT = 0.5;
  let fallbackClearance = -Infinity;

  for (let offset = 0; offset <= (T_MAX - T_MIN) / 2 + 1e-6; offset += STEP) {
    const candidates = offset === 0 ? [0.5] : [0.5 + offset, 0.5 - offset];
    for (let c = 0; c < candidates.length; c += 1) {
      const t = candidates[c];
      if (t < T_MIN || t > T_MAX) continue;
      const { x, y } = edgeCurvePointAtT(tag.a, tag.b, tag.curve, t);
      if (isPositionClear(x, y, tag.radius, nodeObstacles, placedTagCircles)) {
        tag.t = t;
        tag.x = x;
        tag.y = y;
        return;
      }
      // Track the least-bad candidate seen so far, in case every position
      // along this curve has some unavoidable overlap (dense clusters).
      let minClearance = Infinity;
      nodeObstacles.forEach((node) => {
        minClearance = Math.min(minClearance, Math.hypot(x - node.x, y - node.y) - node.radius - tag.radius);
      });
      placedTagCircles.forEach((other) => {
        minClearance = Math.min(minClearance, Math.hypot(x - other.x, y - other.y) - other.radius - tag.radius);
      });
      if (minClearance > fallbackClearance) {
        fallbackClearance = minClearance;
        fallbackT = t;
      }
    }
  }

  const fallback = edgeCurvePointAtT(tag.a, tag.b, tag.curve, fallbackT);
  tag.t = fallbackT;
  tag.x = fallback.x;
  tag.y = fallback.y;
}

// Tries increasing distances along a stub's fixed angle from its node,
// starting at the normal tip distance - the drawn arrow always runs from
// the node to exactly `tag.x`/`tag.y`, so extending outward along the same
// angle keeps the arrow (and its badge) perfectly straight and on-line.
function resolveStubTagPosition(tag, nodeObstacles, placedTagCircles) {
  const baseDist = tag.localNode.radius + STUB_LENGTH;
  const maxDist = baseDist + 500;
  const STEP = 12;

  let fallbackDist = baseDist;
  let fallbackClearance = -Infinity;

  for (let dist = baseDist; dist <= maxDist; dist += STEP) {
    const x = tag.localNode.x + Math.cos(tag.angle) * dist;
    const y = tag.localNode.y + Math.sin(tag.angle) * dist;
    if (isPositionClear(x, y, tag.radius, nodeObstacles, placedTagCircles)) {
      tag.x = x;
      tag.y = y;
      return;
    }
    let minClearance = Infinity;
    nodeObstacles.forEach((node) => {
      minClearance = Math.min(minClearance, Math.hypot(x - node.x, y - node.y) - node.radius - tag.radius);
    });
    placedTagCircles.forEach((other) => {
      minClearance = Math.min(minClearance, Math.hypot(x - other.x, y - other.y) - other.radius - tag.radius);
    });
    if (minClearance > fallbackClearance) {
      fallbackClearance = minClearance;
      fallbackDist = dist;
    }
  }

  tag.x = tag.localNode.x + Math.cos(tag.angle) * fallbackDist;
  tag.y = tag.localNode.y + Math.sin(tag.angle) * fallbackDist;
}

// Places every tag (in tag-number order) against every node plus every
// already-placed tag - a real geometric guarantee for both, while each
// tag's own search is constrained to stay exactly on its own line.
function resolveTagPositions(tags, nodeObstacles) {
  const placedTagCircles = [];
  tags.forEach((tag) => {
    if (tag.kind === 'local') {
      resolveLocalTagPosition(tag, nodeObstacles, placedTagCircles);
    } else {
      resolveStubTagPosition(tag, nodeObstacles, placedTagCircles);
    }
    placedTagCircles.push({ x: tag.x, y: tag.y, radius: tag.radius });
  });
  return tags;
}

// ---------------------------------------------------------------------------
// Per-page tag assignment - number every local edge and every stub on this
// page (1, 2, 3, ...) and compute each tag's initial + collision-resolved
// screen position.
// ---------------------------------------------------------------------------

function buildPageTags(page, layoutNodes) {
  const nodesByCode = new Map(layoutNodes.map((n) => [n.code, n]));

  const sortKey = (e) => `${e.locationA}|${e.locationB}`;
  const orderedLocal = [...page.localEdges].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const orderedStubs = [...page.stubEdges].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  const tags = [];
  let tagNumber = 0;

  // Local edges: tag sits at the curve's actual midpoint (not the straight
  // A-B midpoint, now that edges are drawn as gentle bezier curves - see
  // edgeCurveGeometry).
  orderedLocal.forEach((edge) => {
    const a = nodesByCode.get(edge.locationA);
    const b = nodesByCode.get(edge.locationB);
    if (!a || !b) return;
    tagNumber += 1;
    const curve = edgeCurveParams(edge);
    const { midX, midY } = edgeCurveGeometry(a, b, curve);
    tags.push({
      number: tagNumber,
      kind: 'local',
      edge,
      a,
      b,
      curve,
      t: 0.5,
      x: midX,
      y: midY,
      radius: TAG_RADIUS,
    });
  });

  // Stub edges: distribute around whichever node on this page is local,
  // spreading multiple stubs on the same node into separate angular gaps.
  const occupiedAnglesByNode = new Map();
  layoutNodes.forEach((n) => {
    const anglesFromLocalEdges = orderedLocal
      .filter((e) => e.locationA === n.code || e.locationB === n.code)
      .map((e) => {
        const otherCode = e.locationA === n.code ? e.locationB : e.locationA;
        const other = nodesByCode.get(otherCode);
        return other ? Math.atan2(other.y - n.y, other.x - n.x) : null;
      })
      .filter((a) => a !== null);
    occupiedAnglesByNode.set(n.code, anglesFromLocalEdges);
  });

  orderedStubs.forEach((edge) => {
    const aIsLocal = page.nodeCodes.has(edge.locationA);
    const localCode = aIsLocal ? edge.locationA : edge.locationB;
    const remoteCode = aIsLocal ? edge.locationB : edge.locationA;
    const localNode = nodesByCode.get(localCode);
    if (!localNode) return;

    const occupied = occupiedAnglesByNode.get(localCode) || [];
    const angle = pickLargestGapAngle(occupied);
    occupied.push(angle);
    occupiedAnglesByNode.set(localCode, occupied);

    tagNumber += 1;
    const tipX = localNode.x + Math.cos(angle) * (localNode.radius + STUB_LENGTH);
    const tipY = localNode.y + Math.sin(angle) * (localNode.radius + STUB_LENGTH);
    tags.push({
      number: tagNumber,
      kind: 'stub',
      edge,
      localCode,
      remoteCode,
      localNode,
      angle,
      x: tipX,
      y: tipY,
      radius: TAG_RADIUS,
    });
  });

  resolveTagPositions(tags, layoutNodes.map((n) => ({ x: n.x, y: n.y, radius: n.radius })));

  return tags;
}

// Stub arrows/tags extend STUB_LENGTH + TAG_RADIUS beyond a node's own
// radius, which can reach past the layout's node-only bounding box (sized
// with only NODE_PADDING of headroom) for nodes near the edge of the
// diagram - clipping the outermost tag against the SVG canvas. Grow (and
// re-offset, if needed) the layout to fit every node AND every tag/stub tip
// so nothing at the edges is ever cut off.
function expandLayoutForTags(layout, tags) {
  const EDGE_PADDING = 30;

  let minX = 0;
  let minY = 0;
  let maxX = layout.width;
  let maxY = layout.height;

  layout.nodes.forEach((n) => {
    minX = Math.min(minX, n.x - n.radius);
    minY = Math.min(minY, n.y - n.radius);
    maxX = Math.max(maxX, n.x + n.radius);
    maxY = Math.max(maxY, n.y + n.radius);
  });
  tags.forEach((t) => {
    minX = Math.min(minX, t.x - t.radius);
    minY = Math.min(minY, t.y - t.radius);
    maxX = Math.max(maxX, t.x + t.radius);
    maxY = Math.max(maxY, t.y + t.radius);
  });

  const offsetX = EDGE_PADDING - minX;
  const offsetY = EDGE_PADDING - minY;

  if (offsetX !== 0 || offsetY !== 0) {
    // Nodes referenced by tags (tag.a/tag.b/tag.localNode) are the SAME
    // object instances as layout.nodes entries, so shifting nodes here
    // automatically keeps every tag's line/stub endpoints in sync - only
    // each tag's own circle position needs shifting separately.
    layout.nodes.forEach((n) => {
      n.x += offsetX;
      n.y += offsetY;
    });
    tags.forEach((t) => {
      t.x += offsetX;
      t.y += offsetY;
    });
  }

  layout.width = Math.ceil(maxX - minX + EDGE_PADDING * 2);
  layout.height = Math.ceil(maxY - minY + EDGE_PADDING * 2);

  return layout;
}

// ---------------------------------------------------------------------------
// SVG rendering
// ---------------------------------------------------------------------------

function buildPageSvg(page, layoutNodes, tags) {
  const parts = [];

  // Local edge lines (drawn under everything else) - a gentle bezier curve
  // rather than a dead-straight line, so overlapping/near-parallel routes
  // visually separate, colored+weighted per edge so a specific line can be
  // followed by eye through a crossing (see edgeColor/edgeLineWeight).
  const orderedLocal = tags.filter((t) => t.kind === 'local');
  orderedLocal.forEach((tag) => {
    const dashed = isInterRegional(tag.edge) ? ' stroke-dasharray="10,6"' : '';
    const color = edgeColor(tag.edge);
    const { strokeWidth, opacity } = edgeLineWeight(tag.edge);
    const { controlX, controlY } = edgeCurveGeometry(tag.a, tag.b, tag.curve);
    parts.push(`<path d="M ${tag.a.x} ${tag.a.y} Q ${controlX} ${controlY} ${tag.b.x} ${tag.b.y}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}"${dashed} />`);
  });

  // Stub lines + arrowheads (kept as short straight segments - curving these
  // would complicate the arrowhead angle for little visual benefit).
  const stubTags = tags.filter((t) => t.kind === 'stub');
  stubTags.forEach((tag) => {
    const color = edgeColor(tag.edge);
    const { strokeWidth, opacity } = edgeLineWeight(tag.edge);
    const dashed = isInterRegional(tag.edge) ? ' stroke-dasharray="8,5"' : '';
    const startX = tag.localNode.x + Math.cos(tag.angle) * tag.localNode.radius;
    const startY = tag.localNode.y + Math.sin(tag.angle) * tag.localNode.radius;
    parts.push(`<line x1="${startX}" y1="${startY}" x2="${tag.x}" y2="${tag.y}" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}"${dashed} />`);
    const arrowSize = 7;
    const ax = tag.x - Math.cos(tag.angle) * (tag.radius + 2);
    const ay = tag.y - Math.sin(tag.angle) * (tag.radius + 2);
    const leftAngle = tag.angle + (Math.PI * 0.85);
    const rightAngle = tag.angle - (Math.PI * 0.85);
    const p1x = ax + Math.cos(leftAngle) * arrowSize;
    const p1y = ay + Math.sin(leftAngle) * arrowSize;
    const p2x = ax + Math.cos(rightAngle) * arrowSize;
    const p2y = ay + Math.sin(rightAngle) * arrowSize;
    parts.push(`<polygon points="${ax},${ay} ${p1x},${p1y} ${p2x},${p2y}" fill="${color}" />`);
  });

  // Tag number badges (drawn above lines, below nodes) - border color matches
  // its edge's line color, reinforcing which badge belongs to which line.
  tags.forEach((tag) => {
    const fill = '#FFFFFF';
    const stroke = edgeColor(tag.edge);
    parts.push(
      `<g>`
      + `<circle cx="${tag.x}" cy="${tag.y}" r="${tag.radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />`
      + `<text x="${tag.x}" y="${tag.y + 4}" text-anchor="middle" font-size="11" font-family="Arial, sans-serif" font-weight="700" fill="#212121">${tag.number}</text>`
      + `</g>`
    );
  });

  // Nodes (drawn last, on top). POP code sits inside the circle (city name
  // is not shown on the diagram - full address detail lives in the POP Code
  // Reference page). Node radius is sized to comfortably fit the code text
  // (see computeLayout), and the text gets a thin dark outline behind the
  // white fill so thin glyphs (capital "I", digit "1") stay legible against
  // the mid-tone circle fill.
  const nodeColor = REGION_COLORS[page.region] || '#455A64';
  layoutNodes.forEach((n) => {
    parts.push(
      `<g>`
      + `<circle cx="${n.x}" cy="${n.y}" r="${n.radius}" fill="${nodeColor}" stroke="#FFFFFF" stroke-width="2.5" />`
      + `<text x="${n.x}" y="${n.y + (n.codeFontSize * 0.35)}" text-anchor="middle" font-size="${n.codeFontSize}" font-family="Arial, sans-serif" font-weight="700" `
      + `paint-order="stroke fill" stroke="#10233F" stroke-width="2.4" stroke-linejoin="round" fill="#FFFFFF">${escapeHtml(n.code)}</text>`
      + `</g>`
    );
  });

  return parts.join('');
}

// ---------------------------------------------------------------------------
// Route Schedule table - every route's full detail lives here instead of
// floating on the diagram, so text can never overlap regardless of density.
// ---------------------------------------------------------------------------

// Kept intentionally short (POP code + page number only) so it always fits
// within the Route Schedule table's narrow grid columns without truncating -
// the full region/sub-page breakdown for that page is on the cover index.
function formatRemoteRef(remoteCode, codeToPage, foreignNodesByCode, pageNumberByPageId) {
  const remotePage = codeToPage.get(remoteCode);
  if (remotePage) {
    const pageNum = pageNumberByPageId.get(remotePage.id);
    return `${remoteCode} (Pg ${pageNum})`;
  }
  return `${remoteCode} (not incl.)`;
}

// Every route renders as one full-text line (tag number, the two POP codes,
// then every requested detail field spelled out with its own label) instead
// of a grid table - so long carrier/UCN values wrap onto a second line
// rather than getting silently truncated by a fixed-width column.
function buildScheduleTable(page, tags, details, codeToPage, foreignNodesByCode, pageNumberByPageId) {
  const rows = [];
  tags.forEach((tag) => {
    let colA;
    let colB;
    if (tag.kind === 'local') {
      colA = tag.edge.locationA;
      colB = tag.edge.locationB;
    } else {
      colA = tag.localCode;
      colB = formatRemoteRef(tag.remoteCode, codeToPage, foreignNodesByCode, pageNumberByPageId);
    }

    tag.edge.routes.forEach((route) => {
      const detailParts = [];
      if (details.ucn && route.circuit_id) detailParts.push(`UCN ${route.circuit_id}`);
      if (details.latency) {
        const latency = formatLatency(route.expected_latency);
        if (latency) detailParts.push(`Latency ${latency}`);
      }
      if (details.bandwidth) {
        const bandwidth = formatBandwidth(route.bandwidth);
        if (bandwidth) detailParts.push(`Bandwidth ${bandwidth}`);
      }
      if (details.carrier && route.underlying_carrier) detailParts.push(`Carrier ${route.underlying_carrier}`);

      rows.push({ tag: tag.number, a: colA, b: colB, detail: detailParts.join('   \u2022   ') });
    });
  });

  // Two columns at most (never three) so each line stays wide enough to show
  // full carrier/UCN text without wrapping excessively.
  const columnCount = rows.length > 10 ? 2 : 1;
  const height = Math.ceil(rows.length / columnCount) * SCHEDULE_LINE_HEIGHT + 20;

  const linesHtml = rows.map((row) => (
    `<div class="schedule-line">`
    + `<span class="schedule-tag">${row.tag}.</span>`
    + `<span class="schedule-route">${escapeHtml(row.a)} \u2194 ${escapeHtml(row.b)}</span>`
    + (row.detail ? `<span class="schedule-detail">${escapeHtml(row.detail)}</span>` : '')
    + `</div>`
  )).join('');

  const html = rows.length === 0
    ? '<div class="schedule-empty">No routes to list on this page.</div>'
    : `<div class="schedule-columns" style="column-count:${columnCount};">${linesHtml}</div>`;

  return { html, height: rows.length === 0 ? 40 : height, rowCount: rows.length, columnCount };
}

// ---------------------------------------------------------------------------
// Annex - POP code -> full address, including off-page/external references
// touched by this page's stubs.
// ---------------------------------------------------------------------------

// Approximate rendered height (px) of a single two-line annex-row entry,
// including its bottom margin - used to size the page so the annex list
// (which can grow past the diagram once off-page references are included)
// never gets clipped by the page's fixed height. Generous on purpose - CSS
// multi-column layout balances the real content automatically, this only
// needs to be a safe upper bound for the outer page's fixed height.
const ANNEX_ROW_HEIGHT = 46;

function buildAnnex(page, tags, foreignNodesByCode, inScopeByCode) {
  const referencedCodes = new Set(page.nodes.map((n) => n.code));
  tags.filter((t) => t.kind === 'stub').forEach((t) => referencedCodes.add(t.remoteCode));

  const rows = [...referencedCodes].sort().map((code) => {
    const node = inScopeByCode.get(code) || foreignNodesByCode.get(code);
    if (!node) return '';
    const addressParts = [node.datacenterName, node.address, node.city, node.country].filter(Boolean).map(escapeHtml).join(', ');
    const isLocal = page.nodeCodes.has(code);
    const suffix = isLocal ? '' : ' <em>(off-page reference)</em>';
    return `<div class="annex-row"><span class="annex-code">${escapeHtml(code)}${suffix}</span><span class="annex-address">${addressParts}</span></div>`;
  }).join('');

  const rowCount = referencedCodes.size;
  // Full page width now (no longer squeezed into a 420px sidebar), so a
  // dense page's POP list can flow across several columns instead of
  // growing very tall.
  const columnCount = rowCount > 90 ? 4 : (rowCount > 45 ? 3 : (rowCount > 15 ? 2 : 1));
  const height = Math.ceil(rowCount / columnCount) * ANNEX_ROW_HEIGHT + 20;

  const html = rowCount === 0
    ? '<div class="schedule-empty">No POP codes to list on this page.</div>'
    : `<div class="annex-columns" style="column-count:${columnCount};">${rows}</div>`;

  return { html, height, rowCount, columnCount };
}

// ---------------------------------------------------------------------------
// Full-document assembly
// ---------------------------------------------------------------------------

function sharedStyles(width, height) {
  return `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; }
  .page { width: ${width}px; height: ${height}px; padding: ${OUTER_MARGIN}px; background: #FFFFFF; page-break-after: always; overflow: hidden; }
  .page:last-child { page-break-after: auto; }
  .title-block { display: flex; align-items: center; height: ${TITLE_BLOCK_HEIGHT}px; border-bottom: 2px solid #1A1A2E; }
  .title-block img.logo { height: 44px; margin-right: 14px; }
  .title-text { flex: 1; }
  .title-main { font-size: 16px; font-weight: 700; color: #1A1A2E; }
  .title-sub { font-size: 10px; color: #616161; margin-top: 2px; }
  .confidential { font-size: 10px; font-weight: 700; color: #B71C1C; border: 1.5px solid #B71C1C; padding: 5px 10px; border-radius: 4px; white-space: nowrap; }
  .diagram-wrap { display: flex; justify-content: center; margin-top: 10px; }
  .annex-columns { column-gap: 40px; margin-top: 4px; }
  .annex-row { font-size: 12px; margin-bottom: 10px; line-height: 1.4; break-inside: avoid; }
  .annex-code { font-weight: 700; color: #1A1A2E; display: block; }
  .annex-code em { font-weight: 400; color: #757575; font-style: normal; }
  .annex-address { color: #424242; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 9px; margin-top: 3px; }
  .legend-item { display: flex; align-items: center; gap: 4px; }
  .legend-swatch { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  .legend-line { width: 18px; height: 0; border-top: 2.5px solid #757575; display: inline-block; }
  .legend-line.thin { border-top-width: 1.6px; opacity: 0.55; }
  .legend-line.thick { border-top-width: 4px; opacity: 0.9; }
  .legend-line.inter { border-top-style: dashed; border-top-color: #8E24AA; }
  .schedule-title { font-size: 16px; font-weight: 700; color: #1A1A2E; margin: ${SCHEDULE_GAP}px 0 10px 0; }
  .schedule-columns { column-gap: 48px; }
  .schedule-line { font-size: 12px; line-height: 1.5; margin-bottom: 9px; break-inside: avoid; }
  .schedule-tag { display: inline-block; min-width: 20px; font-weight: 700; color: #9E9E9E; }
  .schedule-route { font-weight: 700; color: #1A1A2E; margin-right: 12px; }
  .schedule-detail { color: #424242; }
  .schedule-empty { font-size: 12px; color: #757575; margin-top: ${SCHEDULE_GAP}px; }
  .index-row { display: grid; grid-template-columns: 130px 1fr 220px; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #E0E0E0; }
  .index-header { font-weight: 700; border-bottom: 2px solid #1A1A2E; }
  `;
}

function renderTitleBlock(titleText, generatedText) {
  const logoDataUri = getLogoDataUri();
  return `
    <div class="title-block">
      ${logoDataUri ? `<img class="logo" src="${logoDataUri}" />` : ''}
      <div class="title-text">
        <div class="title-main">${escapeHtml(titleText)}</div>
        <div class="title-sub">${escapeHtml(generatedText)}</div>
        <div class="legend">
          ${REGION_ORDER.map((r) => `<div class="legend-item"><span class="legend-swatch" style="background:${REGION_COLORS[r]}"></span>${r}</div>`).join('')}
          <div class="legend-item"><span class="legend-line inter"></span>INTER-regional route</div>
          <div class="legend-item"><span class="legend-line thin"></span>&lt;1 Gb</div>
          <div class="legend-item"><span class="legend-line"></span>1-10 Gb</div>
          <div class="legend-item"><span class="legend-line thick"></span>10 Gb+ / Dark Fiber</div>
          <div class="legend-item">Line color varies per route for visual clarity only</div>
        </div>
      </div>
      <div class="confidential">${escapeHtml(CONFIDENTIALITY_LABEL)}</div>
    </div>
  `;
}

function pageSectionLabel(page) {
  return page.totalPagesInRegion > 1
    ? `${page.region} \u2013 Page ${page.pageIndexInRegion} of ${page.totalPagesInRegion}`
    : page.region;
}

function renderCoverPageHtml(pages, options, diagramPageNumberByPageId, width, height) {
  const { regions, generatedAt, popSelectionCount } = options;
  const titleText = popSelectionCount
    ? `IPC Network Map \u2013 ${regions.join(' / ')} (${popSelectionCount} selected POP${popSelectionCount === 1 ? '' : 's'})`
    : `IPC Network Map \u2013 ${regions.join(' / ')}`;
  const generatedText = `Generated ${generatedAt.toISOString().replace('T', ' ').substring(0, 19)} UTC`;

  const indexRows = pages.map((page) => {
    const diagramPageNum = diagramPageNumberByPageId.get(page.id);
    const referencePageNum = diagramPageNum + 1;
    const nodeCount = page.nodes.length;
    const routeCount = page.localEdges.reduce((sum, e) => sum + e.routes.length, 0);
    const label = page.totalPagesInRegion > 1
      ? `${page.region} (${page.pageIndexInRegion} of ${page.totalPagesInRegion})`
      : page.region;
    return `<div class="index-row"><span>Pages ${diagramPageNum}\u2013${referencePageNum}</span><span>${escapeHtml(label)}</span><span>${nodeCount} locations, ${routeCount} routes</span></div>`;
  }).join('');

  return `<div class="page" style="width:${width}px;height:${height}px;">
    ${renderTitleBlock(titleText, generatedText)}
    <div style="margin-top:32px;">
      <div class="schedule-title" style="margin-top:0;">Page Index</div>
      <div class="index-row index-header"><span>Pages</span><span>Section</span><span>Contents</span></div>
      ${indexRows}
      <div style="font-size:11px;color:#757575;margin-top:16px;">Each section spans two pages: a network diagram, followed by its POP Code Reference and Route Schedule.</div>
    </div>
  </div>`;
}

// Diagram-only page - kept free of any reference/table content so the
// diagram itself can use the full page and stay legible regardless of scale.
function renderDiagramPageHtml(page, layout, tags, options, diagramPageNumberByPageId, width, height) {
  const { generatedAt } = options;
  const titleText = `IPC Network Map \u2013 ${pageSectionLabel(page)}`;
  const pageNum = diagramPageNumberByPageId.get(page.id);
  const generatedText = `Generated ${generatedAt.toISOString().replace('T', ' ').substring(0, 19)} UTC \u2013 Page ${pageNum} (Network Diagram)`;

  const svgInner = buildPageSvg(page, layout.nodes, tags);

  return `<div class="page" style="width:${width}px;height:${height}px;">
    ${renderTitleBlock(titleText, generatedText)}
    <div class="diagram-wrap">
      <svg width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">
        ${svgInner}
      </svg>
    </div>
  </div>`;
}

// Reference page - POP Code Reference + Route Schedule for the same page
// group, on its own full-width page immediately after the diagram, so both
// can use multi-column layouts that scale far better than a narrow sidebar.
function renderReferencePageHtml(page, scheduleHtml, annexHtml, options, diagramPageNumberByPageId, width, height) {
  const { generatedAt } = options;
  const titleText = `IPC Network Map \u2013 ${pageSectionLabel(page)} \u2013 POP Reference & Route Schedule`;
  const pageNum = diagramPageNumberByPageId.get(page.id) + 1;
  const generatedText = `Generated ${generatedAt.toISOString().replace('T', ' ').substring(0, 19)} UTC \u2013 Page ${pageNum} (POP Reference & Route Schedule)`;

  return `<div class="page" style="width:${width}px;height:${height}px;">
    ${renderTitleBlock(titleText, generatedText)}
    <div class="schedule-title" style="margin-top:24px;">POP Code Reference</div>
    ${annexHtml}
    <div class="schedule-title">Route Schedule</div>
    ${scheduleHtml}
  </div>`;
}

/**
 * Builds every page group's internal layout/SVG/schedule/annex, determines a
 * shared physical page size for the whole document (Puppeteer's page.pdf()
 * only supports one size per print job), and returns the full HTML document.
 * Each page group renders as two physical pages: a diagram page, followed
 * immediately by its POP Code Reference + Route Schedule page.
 */
function renderMultiPageHtml(partitionResult, options) {
  const { pages, codeToPage, foreignNodesByCode, inScopeByCode } = partitionResult;
  const { details } = options;

  // Maps a page group's id to the page NUMBER of its diagram page (the
  // reference page always immediately follows, at diagramPageNum + 1).
  // Cross-page stub references ("Pg N") point here, since that's where the
  // reader can see the actual remote node.
  const diagramPageNumberByPageId = new Map();
  pages.forEach((page, idx) => diagramPageNumberByPageId.set(page.id, 2 + (idx * 2))); // page 1 is the cover

  const built = pages.map((page) => {
    const layout = computeLayout(page.nodes, page.localEdges);
    capLayoutToMaxDimension(layout, OUTER_MARGIN * 2, OUTER_MARGIN * 2 + TITLE_BLOCK_HEIGHT);
    const tags = buildPageTags(page, layout.nodes);
    expandLayoutForTags(layout, tags);
    const schedule = buildScheduleTable(page, tags, details, codeToPage, foreignNodesByCode, diagramPageNumberByPageId);
    const annex = buildAnnex(page, tags, foreignNodesByCode, inScopeByCode);

    const diagramNaturalWidth = OUTER_MARGIN * 2 + layout.width;
    const diagramNaturalHeight = OUTER_MARGIN * 2 + TITLE_BLOCK_HEIGHT + layout.height;

    const referenceNaturalWidth = REFERENCE_MIN_WIDTH;
    const referenceNaturalHeight = OUTER_MARGIN * 2 + TITLE_BLOCK_HEIGHT
      + 46 + annex.height // "POP Code Reference" title + annex content
      + SCHEDULE_GAP + 46 + schedule.height; // "Route Schedule" title + schedule content

    return {
      page, layout, tags, schedule, annex,
      diagramNaturalWidth, diagramNaturalHeight,
      referenceNaturalWidth, referenceNaturalHeight,
    };
  });

  const coverNaturalWidth = MIN_CONTENT_WIDTH;
  const coverNaturalHeight = OUTER_MARGIN * 2 + TITLE_BLOCK_HEIGHT + 60 + (pages.length * 34) + 100;

  const sharedWidth = Math.ceil(Math.max(
    coverNaturalWidth,
    ...built.map((b) => b.diagramNaturalWidth),
    ...built.map((b) => b.referenceNaturalWidth)
  ));
  const sharedHeight = Math.ceil(Math.max(
    coverNaturalHeight,
    ...built.map((b) => b.diagramNaturalHeight),
    ...built.map((b) => b.referenceNaturalHeight)
  ));

  // Every page in the document shares this one physical size, but a page
  // group's Route Schedule/POP Reference can be far taller than its own
  // diagram needs to be (e.g. a dense, highly-interconnected region) - so
  // without this step, that page group's diagram would only occupy a small
  // area of a mostly-blank shared canvas. Re-run the geographic layout for
  // any diagram smaller than the shared canvas so it actually fills it.
  built.forEach((b) => {
    const availableWidth = sharedWidth - OUTER_MARGIN * 2;
    const availableHeight = sharedHeight - OUTER_MARGIN * 2 - TITLE_BLOCK_HEIGHT;
    const isMeaningfullySmaller = availableWidth > b.layout.width + 60 || availableHeight > b.layout.height + 60;
    if (!isMeaningfullySmaller) return;

    const relayout = computeLayout(b.page.nodes, b.page.localEdges, { width: availableWidth, height: availableHeight });
    capLayoutToMaxDimension(relayout, OUTER_MARGIN * 2, OUTER_MARGIN * 2 + TITLE_BLOCK_HEIGHT);
    const relayoutTags = buildPageTags(b.page, relayout.nodes);
    expandLayoutForTags(relayout, relayoutTags);
    capLayoutAndTagsToDimensions(relayout, relayoutTags, availableWidth, availableHeight);

    b.layout = relayout;
    b.tags = relayoutTags;
    // Tag numbering only depends on sorted edge order (not position), so
    // the already-built schedule/annex (which reference tag numbers, not
    // coordinates) stay valid and don't need to be rebuilt.
  });

  const coverHtml = renderCoverPageHtml(pages, options, diagramPageNumberByPageId, sharedWidth, sharedHeight);
  const pageHtml = built.map((b) => (
    renderDiagramPageHtml(b.page, b.layout, b.tags, options, diagramPageNumberByPageId, sharedWidth, sharedHeight)
    + renderReferencePageHtml(b.page, b.schedule.html, b.annex.html, options, diagramPageNumberByPageId, sharedWidth, sharedHeight)
  )).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>${sharedStyles(sharedWidth, sharedHeight)}</style>
</head>
<body>
  ${coverHtml}
  ${pageHtml}
</body>
</html>`;

  return { html, width: sharedWidth, height: sharedHeight, pageCount: 1 + (pages.length * 2) };
}

async function generateNetworkMapPdf(nodes, edges, options) {
  resolveNodeCoordinates(nodes);
  const partitionResult = partitionIntoPages(nodes, edges, options.regions);
  const { html, width, height } = renderMultiPageHtml(partitionResult, options);

  // On hosts where Puppeteer's own Chromium can't run natively (e.g. RHEL 7,
  // glibc 2.17 vs the ~2.27 Chrome-for-Testing needs), delegate the actual
  // HTML->PDF rendering to a containerized sidecar instead - see
  // backend/pdf-render-sidecar/ and RHEL_PRODUCTION_DEPLOYMENT_V3.5.0.md.
  if (isSidecarConfigured()) {
    return renderPdfViaSidecar({ html, width, height });
  }

  const puppeteer = loadPuppeteer();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBytes = await page.pdf({
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
    });
    // Puppeteer returns a plain Uint8Array. Express's res.send() only writes
    // raw binary when Buffer.isBuffer() is true, otherwise it silently falls
    // back to res.json() and corrupts the PDF - always convert explicitly.
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}

module.exports = {
  CONFIDENTIALITY_LABEL,
  generateNetworkMapPdf,
  partitionIntoPages,
  computeLayout,
  resolveNodeCoordinates,
  renderMultiPageHtml,
  // Exported for the tag-placement regression test only (pure/no side effects).
  buildPageTags,
  edgeCurvePointAtT,
};
