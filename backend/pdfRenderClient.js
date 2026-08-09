const axios = require('axios');

// On hosts where the bundled Puppeteer Chromium cannot run natively (e.g. RHEL 7,
// glibc 2.17 vs the ~2.27 Chrome-for-Testing needs), PDF_RENDER_SIDECAR_URL points
// at a small containerized rendering service (see backend/pdf-render-sidecar/) that
// runs a modern Node + Chromium image and exposes a plain HTML -> PDF HTTP endpoint.
// When unset, PDFs are rendered with a locally-launched Puppeteer browser instead
// (fine for dev machines / hosts with a compatible glibc).
const SIDECAR_URL = process.env.PDF_RENDER_SIDECAR_URL;
const SIDECAR_TIMEOUT_MS = Number(process.env.PDF_RENDER_SIDECAR_TIMEOUT_MS) || 120000;

function isSidecarConfigured() {
  return Boolean(SIDECAR_URL);
}

async function renderPdfViaSidecar({ html, width, height }) {
  const response = await axios.post(
    `${SIDECAR_URL.replace(/\/$/, '')}/render`,
    { html, width, height },
    {
      responseType: 'arraybuffer',
      timeout: SIDECAR_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return Buffer.from(response.data);
}

module.exports = { isSidecarConfigured, renderPdfViaSidecar };
