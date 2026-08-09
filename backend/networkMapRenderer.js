const fs = require('fs');
const path = require('path');
// Must stay on d3-force 2.x: 3.x is ESM-only, so `require()` of it throws
// ERR_REQUIRE_ESM on any Node before 22.12. Bumping to 3.x breaks the RHEL 7
// production host (Node 16) at boot, not just PDF export.
const { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } = require('d3-force');
const { formatBandwidth } = require('./utils/formatBandwidth');
const { isSidecarConfigured, renderPdfViaSidecar } = require('./pdfRenderClient');

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
const SCHEDULE_ROW_HEIGHT = 22;
const SCHEDULE_HEADER_HEIGHT = 32;

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
// Per-page force layout (generic - a page is already a single cluster, so no
// region-column anchoring is needed here).
// ---------------------------------------------------------------------------

function computeLayout(pageNodes, localEdges) {
  const nodeCount = Math.max(pageNodes.length, 1);
  const contentWidth = Math.max(MIN_CONTENT_WIDTH, Math.sqrt(nodeCount) * 380);
  const contentHeight = Math.max(MIN_CONTENT_HEIGHT, Math.sqrt(nodeCount) * 300);

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

  const simLinks = localEdges.map((e) => ({ source: e.locationA, target: e.locationB }));

  const simulation = forceSimulation(simNodes)
    .force('link', forceLink(simLinks).id((d) => d.id).distance(200).strength(0.5))
    .force('charge', forceManyBody().strength(-260))
    .force('x', forceX(contentWidth / 2).strength(0.05))
    .force('y', forceY(contentHeight / 2).strength(0.05))
    .force('collide', forceCollide((d) => d.radius + 32))
    .stop();

  const TICKS = 400;
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
// Tag collision resolution - iterative pairwise separation so the small
// numbered badges (which carry all cross-reference text) never overlap each
// other or any node circle. Because the badges are uniform circles, this is
// a real geometric guarantee rather than a one-shot heuristic offset.
// ---------------------------------------------------------------------------

function resolveTagCollisions(tags, nodeObstacles, iterations = 120) {
  for (let iter = 0; iter < iterations; iter += 1) {
    let anyMoved = false;

    tags.forEach((tag) => {
      nodeObstacles.forEach((node) => {
        const dx = tag.x - node.x;
        const dy = tag.y - node.y;
        const dist = Math.sqrt((dx * dx) + (dy * dy)) || 0.001;
        const minDist = tag.radius + node.radius + 16;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          tag.x += (dx / dist) * push;
          tag.y += (dy / dist) * push;
          anyMoved = true;
        }
      });
    });

    for (let i = 0; i < tags.length; i += 1) {
      for (let j = i + 1; j < tags.length; j += 1) {
        const t1 = tags[i];
        const t2 = tags[j];
        const dx = t2.x - t1.x;
        const dy = t2.y - t1.y;
        const dist = Math.sqrt((dx * dx) + (dy * dy)) || 0.001;
        const minDist = t1.radius + t2.radius + 6;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          t1.x -= ux * push;
          t1.y -= uy * push;
          t2.x += ux * push;
          t2.y += uy * push;
          anyMoved = true;
        }
      }
    }

    if (!anyMoved) break;
  }
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

  // Local edges: tag sits at the line midpoint.
  orderedLocal.forEach((edge) => {
    const a = nodesByCode.get(edge.locationA);
    const b = nodesByCode.get(edge.locationB);
    if (!a || !b) return;
    tagNumber += 1;
    tags.push({
      number: tagNumber,
      kind: 'local',
      edge,
      a,
      b,
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
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

  resolveTagCollisions(tags, layoutNodes.map((n) => ({ x: n.x, y: n.y, radius: n.radius })));

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

  // Local edge lines (drawn under everything else).
  const orderedLocal = tags.filter((t) => t.kind === 'local');
  orderedLocal.forEach((tag) => {
    const dashed = isInterRegional(tag.edge) ? ' stroke-dasharray="10,6"' : '';
    const color = isInterRegional(tag.edge) ? '#8E24AA' : '#9E9E9E';
    parts.push(`<line x1="${tag.a.x}" y1="${tag.a.y}" x2="${tag.b.x}" y2="${tag.b.y}" stroke="${color}" stroke-width="2.5"${dashed} />`);
  });

  // Stub lines + arrowheads.
  const stubTags = tags.filter((t) => t.kind === 'stub');
  stubTags.forEach((tag) => {
    const color = isInterRegional(tag.edge) ? '#8E24AA' : '#9E9E9E';
    const dashed = isInterRegional(tag.edge) ? ' stroke-dasharray="8,5"' : '';
    const startX = tag.localNode.x + Math.cos(tag.angle) * tag.localNode.radius;
    const startY = tag.localNode.y + Math.sin(tag.angle) * tag.localNode.radius;
    parts.push(`<line x1="${startX}" y1="${startY}" x2="${tag.x}" y2="${tag.y}" stroke="${color}" stroke-width="2"${dashed} />`);
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

  // Tag number badges (drawn above lines, below nodes).
  tags.forEach((tag) => {
    const fill = tag.kind === 'stub' ? '#FFFFFF' : '#FFFFFF';
    const stroke = tag.kind === 'stub' ? '#8E24AA' : '#616161';
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

function buildScheduleTable(page, tags, details, codeToPage, foreignNodesByCode, pageNumberByPageId) {
  const columns = [{ key: 'tag', label: '#' }, { key: 'a', label: 'Location A' }, { key: 'b', label: 'Location B' }];
  if (details.ucn) columns.push({ key: 'ucn', label: 'UCN' });
  if (details.latency) columns.push({ key: 'latency', label: 'Latency' });
  if (details.bandwidth) columns.push({ key: 'bandwidth', label: 'Bandwidth' });
  if (details.carrier) columns.push({ key: 'carrier', label: 'Carrier' });

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
      rows.push({
        tag: tag.number,
        a: colA,
        b: colB,
        ucn: route.circuit_id,
        latency: formatLatency(route.expected_latency),
        bandwidth: formatBandwidth(route.bandwidth),
        carrier: route.underlying_carrier || '',
      });
    });
  });

  const columnCount = rows.length > 60 ? 3 : (rows.length > 20 ? 2 : 1);
  const height = Math.ceil(rows.length / columnCount) * SCHEDULE_ROW_HEIGHT + SCHEDULE_HEADER_HEIGHT + 20;

  const gridTemplate = columns.map((c) => (c.key === 'tag' ? '34px' : (c.key === 'a' || c.key === 'b' ? '1.4fr' : '1fr'))).join(' ');

  const headerHtml = `<div class="schedule-row schedule-header" style="grid-template-columns:${gridTemplate}">`
    + columns.map((c) => `<span>${escapeHtml(c.label)}</span>`).join('')
    + `</div>`;

  const rowsHtml = rows.map((row) => (
    `<div class="schedule-row" style="grid-template-columns:${gridTemplate}">`
    + columns.map((c) => `<span>${escapeHtml(row[c.key] !== undefined ? row[c.key] : '')}</span>`).join('')
    + `</div>`
  )).join('');

  const html = rows.length === 0
    ? '<div class="schedule-empty">No routes to list on this page.</div>'
    : `<div class="schedule-columns" style="column-count:${columnCount};">${headerHtml}${rowsHtml}</div>`;

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
  .legend { display: flex; gap: 14px; font-size: 9px; margin-top: 3px; }
  .legend-item { display: flex; align-items: center; gap: 4px; }
  .legend-swatch { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  .schedule-title { font-size: 16px; font-weight: 700; color: #1A1A2E; margin: ${SCHEDULE_GAP}px 0 10px 0; }
  .schedule-columns { column-gap: 36px; }
  .schedule-row { display: grid; column-gap: 10px; font-size: 11px; line-height: ${SCHEDULE_ROW_HEIGHT}px; height: ${SCHEDULE_ROW_HEIGHT}px; overflow: hidden; white-space: nowrap; break-inside: avoid; }
  .schedule-row span { overflow: hidden; text-overflow: ellipsis; }
  .schedule-header { font-weight: 700; border-bottom: 1.5px solid #1A1A2E; height: ${SCHEDULE_HEADER_HEIGHT}px; line-height: ${SCHEDULE_HEADER_HEIGHT}px; }
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
  const { regions, generatedAt } = options;
  const titleText = `IPC Network Map \u2013 ${regions.join(' / ')}`;
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
  renderMultiPageHtml,
};
