const fs = require('fs');
const path = require('path');
const { isSidecarConfigured, renderPdfViaSidecar } = require('./pdfRenderClient');

// Loaded lazily, never at module scope - see the identical comment in
// networkMapRenderer.js for why (Puppeteer can crash boot on older Node).
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

const LOGO_PATH = path.join(__dirname, 'assets', 'ipc-logo.png');

// Sent to customers, so this note is worded for an external reader rather
// than the internal-only banner used on the Network Map export.
const CUSTOMER_NOTE = 'Latency values reflect live production network measurements, not synthetic '
  + 'RFC/ping tests, and represent real-world expected performance between these locations. '
  + 'RFC-based tests typically report lower latency values than production traffic experiences, '
  + 'and are available upon request.  SLA figures will differ and dependant on exact route selected.';

const CONFIDENTIALITY_NOTE = 'For authorized recipient use only - Distributed under NDA. '
  + "Redistribution without IPC's prior written approval is prohibited.";

const OUTER_MARGIN = 40;
const TITLE_BLOCK_HEIGHT = 90;
// Both header cells and row-label cells render two lines (city name, then
// POP code) plus the table's own 6px top/bottom cell padding - these are
// deliberately generous upper bounds (not a tight fit), same philosophy as
// networkMapRenderer.js's SCHEDULE_LINE_HEIGHT/ANNEX_ROW_HEIGHT, so real
// rendered content never exceeds the page height we hand to Puppeteer.
const HEADER_ROW_HEIGHT = 46;
const DATA_ROW_HEIGHT = 44;
const LABEL_COL_WIDTH = 130;
const DATA_COL_WIDTH = 78;
const MIN_CONTENT_WIDTH = 900;
const POP_ROW_HEIGHT = 24;
const SECTION_GAP = 26;
const CAPTION_HEIGHT = 40; // up to 2 lines, in case the caption wraps at MIN_CONTENT_WIDTH
const NOTE_SECTION_HEIGHT = 90; // customer note text (up to ~4 lines) + its top padding/border
const CONFIDENTIALITY_LINE_HEIGHT = 46; // bold NDA notice below the note (up to 2 lines) + margin
// Flat safety margin added on top of every other estimate above, absorbing
// any remaining font-metric/rendering variance across hosts - the final
// defense (belt-and-suspenders with the .page overflow:hidden clip below)
// against the export ever spilling onto a second PDF page.
const HEIGHT_SAFETY_MARGIN = 60;

let cachedLogoDataUri = null;
function getLogoDataUri() {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  try {
    const buffer = fs.readFileSync(LOGO_PATH);
    cachedLogoDataUri = `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error('Latency matrix renderer: failed to load logo asset:', err.message);
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
  if (value === null || value === undefined) return 'N/A';
  const num = Number(value);
  if (Number.isNaN(num)) return 'N/A';
  return num.toFixed(2);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Formatted manually (rather than toLocaleDateString) so the produced date
// doesn't depend on the rendering host's default locale (relevant on
// minimal RHEL hosts - see pdfRenderClient.js/networkMapRenderer.js notes).
function formatProducedDate(date) {
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function styles(width, height) {
  return `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; width: ${width}px; }
  /* Fixed to the exact page size we hand to Puppeteer/the sidecar, with
     overflow hidden - the final guarantee that this export always fits on
     exactly one PDF page. The height estimate above is deliberately
     generous, so in practice nothing is ever clipped; this only matters as
     a hard backstop if content is ever taller than expected. */
  .page { width: ${width}px; height: ${height}px; padding: ${OUTER_MARGIN}px; background: #FFFFFF; overflow: hidden; }
  .title-block { display: flex; align-items: center; height: ${TITLE_BLOCK_HEIGHT}px; border-bottom: 2px solid #1A1A2E; margin-bottom: 20px; }
  .title-block img.logo { height: 48px; margin-right: 16px; }
  .title-main { font-size: 20px; font-weight: 700; color: #1A1A2E; }
  .title-sub { font-size: 12px; color: #616161; margin-top: 4px; }
  table.matrix { border-collapse: collapse; width: 100%; }
  table.matrix th, table.matrix td { border: 1px solid #E0E0E0; text-align: center; font-size: 11px; padding: 6px 4px; }
  table.matrix th { background: #F5F5F5; font-weight: 700; color: #1A1A2E; white-space: nowrap; }
  table.matrix td.row-label { text-align: left; font-weight: 700; background: #FAFAFA; color: #1A1A2E; white-space: nowrap; }
  table.matrix td.diagonal { background: #F0F0F0; color: #BDBDBD; }
  table.matrix td.value { color: #0D47A1; font-weight: 600; }
  table.matrix td.na { color: #9E9E9E; }
  .caption { font-size: 10px; color: #757575; margin-top: 8px; }
  .section-title { font-size: 14px; font-weight: 700; color: #1A1A2E; margin: ${SECTION_GAP}px 0 8px 0; }
  .pop-columns { column-gap: 32px; }
  .pop-row { font-size: 11px; line-height: 1.5; margin-bottom: 4px; break-inside: avoid; }
  .pop-code { font-weight: 700; color: #1A1A2E; }
  .pop-name { color: #424242; }
  .note { font-size: 10px; color: #424242; line-height: 1.5; margin-top: ${SECTION_GAP}px; padding-top: 12px; border-top: 1px solid #E0E0E0; }
  .confidentiality-note { font-size: 10px; font-weight: 700; color: #B71C1C; line-height: 1.5; margin-top: 8px; }
  `;
}

function buildMatrixTableHtml(locations, matrixByPair) {
  const headerCells = locations.map((loc) => `<th>${escapeHtml(loc.city_name)}<br/><span style="font-weight:400;color:#757575;">${escapeHtml(loc.pop_code)}</span></th>`).join('');

  const bodyRows = locations.map((srcLoc) => {
    const cells = locations.map((dstLoc) => {
      if (srcLoc.pop_code === dstLoc.pop_code) return '<td class="diagonal">&mdash;</td>';
      const entry = matrixByPair.get(`${srcLoc.pop_code}|${dstLoc.pop_code}`);
      const val = entry ? entry.latency_1g_low : null;
      if (val === null || val === undefined) return '<td class="na">N/A</td>';
      return `<td class="value">${formatLatency(val)}</td>`;
    }).join('');
    return `<tr><td class="row-label">${escapeHtml(srcLoc.city_name)}<br/><span style="font-weight:400;color:#757575;">${escapeHtml(srcLoc.pop_code)}</span></td>${cells}</tr>`;
  }).join('');

  return `<table class="matrix">
    <thead><tr><th>Source / Destination</th>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>`;
}

function buildPopReferenceHtml(locations) {
  const rowCount = locations.length;
  const columnCount = rowCount > 30 ? 3 : (rowCount > 12 ? 2 : 1);
  const rows = locations
    .slice()
    .sort((a, b) => a.pop_code.localeCompare(b.pop_code))
    .map((loc) => (
      `<div class="pop-row"><span class="pop-code">${escapeHtml(loc.pop_code)}</span>`
      + ` &ndash; <span class="pop-name">${escapeHtml(loc.datacenter_name || 'N/A')}</span></div>`
    )).join('');

  return {
    html: `<div class="pop-columns" style="column-count:${columnCount};">${rows}</div>`,
    height: Math.ceil(rowCount / columnCount) * POP_ROW_HEIGHT + 20
  };
}

/**
 * @param {Array} locations  [{ pop_code, city_name, datacenter_name }]
 * @param {Array} matrix     [{ source_pop, destination_pop, latency_1g_low, days_recorded }]
 * @param {Object} options   { generatedAt }
 */
async function generateLatencyMatrix30dPdf(locations, matrix, options) {
  const { generatedAt } = options;

  const matrixByPair = new Map();
  matrix.forEach((row) => {
    matrixByPair.set(`${row.source_pop}|${row.destination_pop}`, row);
  });

  const tableHtml = buildMatrixTableHtml(locations, matrixByPair);
  const popReference = buildPopReferenceHtml(locations);

  const tableWidth = LABEL_COL_WIDTH + (locations.length * DATA_COL_WIDTH);
  const width = Math.max(MIN_CONTENT_WIDTH, tableWidth + (OUTER_MARGIN * 2));
  const tableHeight = HEADER_ROW_HEIGHT + (locations.length * DATA_ROW_HEIGHT);
  const titleBlockHeight = TITLE_BLOCK_HEIGHT + 20; // + its own CSS margin-bottom
  const sectionTitleHeight = 34; // "POP Code Reference" heading, incl. its own margins

  // Every term here is a deliberately generous upper bound (see the
  // constants above) plus a flat HEIGHT_SAFETY_MARGIN on top, and the
  // page itself clips at exactly this height (see the .page overflow:hidden
  // rule in styles()) - together these guarantee the export always renders
  // as exactly one PDF page, never spilling onto a second page.
  const height = (OUTER_MARGIN * 2)
    + titleBlockHeight
    + tableHeight
    + CAPTION_HEIGHT
    + SECTION_GAP + sectionTitleHeight
    + popReference.height
    + SECTION_GAP + NOTE_SECTION_HEIGHT
    + CONFIDENTIALITY_LINE_HEIGHT
    + HEIGHT_SAFETY_MARGIN;

  // Fixed regardless of how much of the 30-day window has actually filled in
  // yet - intentionally not adjusted based on distinctDaysRecorded.
  const TITLE_TEXT = 'IPC Live Network Latency Matrix';

  const logoDataUri = getLogoDataUri();
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>${styles(width, height)}</style>
</head>
<body>
  <div class="page">
    <div class="title-block">
      ${logoDataUri ? `<img class="logo" src="${logoDataUri}" />` : ''}
      <div>
        <div class="title-main">${escapeHtml(TITLE_TEXT)}</div>
        <div class="title-sub">Produced on ${escapeHtml(formatProducedDate(generatedAt))} - Values state minimum latency in last 30d</div>
      </div>
    </div>

    ${tableHtml}
    <div class="caption">All values in milliseconds (ms), round-trip delay. Each figure is the lowest 1Gb-tier latency measured between the two locations at any point in the reporting window.</div>

    <div class="section-title">POP Code Reference</div>
    ${popReference.html}

    <div class="note">${escapeHtml(CUSTOMER_NOTE)}</div>
    <div class="confidentiality-note">${escapeHtml(CONFIDENTIALITY_NOTE)}</div>
  </div>
</body>
</html>`;

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
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}

module.exports = {
  CUSTOMER_NOTE,
  CONFIDENTIALITY_NOTE,
  generateLatencyMatrix30dPdf,
  formatProducedDate,
};
