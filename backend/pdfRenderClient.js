const axios = require('axios');

// On hosts where the bundled Puppeteer Chromium cannot run natively (e.g. RHEL 7,
// glibc 2.17 vs the ~2.27 Chrome-for-Testing needs), PDF_RENDER_SIDECAR_URL points
// at a small containerized rendering service (see backend/pdf-render-sidecar/) that
// runs a modern Node + Chromium image and exposes a plain HTML -> PDF HTTP endpoint.
// When unset, PDFs are rendered with a locally-launched Puppeteer browser instead
// (fine for dev machines / hosts with a compatible glibc).
const SIDECAR_URL = process.env.PDF_RENDER_SIDECAR_URL;
const SIDECAR_TIMEOUT_MS = Number(process.env.PDF_RENDER_SIDECAR_TIMEOUT_MS) || 120000;
// Must match SIDECAR_AUTH_TOKEN on the sidecar, which rejects mismatches with a 401.
const SIDECAR_TOKEN = process.env.PDF_RENDER_SIDECAR_TOKEN;

function isSidecarConfigured() {
  return Boolean(SIDECAR_URL);
}

async function renderPdfViaSidecar({ html, width, height }) {
  const headers = { 'Content-Type': 'application/json' };
  if (SIDECAR_TOKEN) {
    headers.Authorization = `Bearer ${SIDECAR_TOKEN}`;
  }

  try {
    const response = await axios.post(
      `${SIDECAR_URL.replace(/\/$/, '')}/render`,
      { html, width, height },
      { responseType: 'arraybuffer', timeout: SIDECAR_TIMEOUT_MS, headers }
    );
    return Buffer.from(response.data);
  } catch (err) {
    // The arraybuffer response type leaves error bodies as raw Buffers, so the
    // default axios message hides the sidecar's own explanation.
    throw new Error(`PDF render sidecar at ${SIDECAR_URL} failed: ${describeError(err)}`);
  }
}

function describeError(err) {
  if (!err.response) {
    return err.message;
  }
  let body = '';
  try {
    body = Buffer.from(err.response.data).toString('utf8').slice(0, 500);
  } catch (_) {
    body = '';
  }
  return `HTTP ${err.response.status}${body ? ` - ${body}` : ''}`;
}

module.exports = { isSidecarConfigured, renderPdfViaSidecar };
