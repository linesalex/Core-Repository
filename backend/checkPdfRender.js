#!/usr/bin/env node
// Diagnostic for the PDF Network Map Export render path. Run this BEFORE wiring
// anything into PM2 - it exercises exactly what generateNetworkMapPdf() does, so
// a pass here means the feature will work:
//
//   PUPPETEER_EXECUTABLE_PATH=/usr/lib64/chromium-browser/headless_shell \
//     node checkPdfRender.js                       # local Chromium
//   PDF_RENDER_SIDECAR_URL=http://10.0.0.5:5051 node checkPdfRender.js   # sidecar
//
// See RHEL_PRODUCTION_DEPLOYMENT_V3.5.0.md, Step 5.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { isSidecarConfigured, renderPdfViaSidecar } = require('./pdfRenderClient');

const HTML = '<html><body style="font-family:sans-serif"><h1>PDF render check</h1></body></html>';
const OUT = path.join(os.tmpdir(), 'pdf-render-check.pdf');

async function renderViaSidecar() {
  const axios = require('axios');
  const url = process.env.PDF_RENDER_SIDECAR_URL.replace(/\/$/, '');
  console.log(`Mode: SIDECAR (${url})`);

  const health = await axios.get(`${url}/health`, { timeout: 10000 });
  console.log(`  /health -> ${JSON.stringify(health.data)}`);

  return renderPdfViaSidecar({ html: HTML, width: 800, height: 600 });
}

async function renderLocally() {
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  console.log(`Mode: LOCAL Chromium (${execPath || 'puppeteer bundled browser'})`);

  if (execPath && !fs.existsSync(execPath)) {
    throw new Error(`PUPPETEER_EXECUTABLE_PATH does not exist: ${execPath}`);
  }

  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: execPath || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    console.log(`  Browser launched: ${await browser.version()}`);
    const page = await browser.newPage();
    await page.setContent(HTML, { waitUntil: 'load' });
    const bytes = await page.pdf({ width: '800px', height: '600px', printBackground: true });
    return Buffer.from(bytes);
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log(`Node: ${process.version}`);
  if (Number(process.versions.node.split('.')[0]) < 16) {
    console.log('  WARNING: puppeteer requires Node >=16.13.2; a local render will fail here.');
  }

  const pdf = isSidecarConfigured() ? await renderViaSidecar() : await renderLocally();

  if (pdf.slice(0, 4).toString() !== '%PDF') {
    throw new Error(`Output is not a PDF (starts with ${JSON.stringify(pdf.slice(0, 8).toString())})`);
  }
  fs.writeFileSync(OUT, pdf);
  console.log(`\nPASS - wrote ${pdf.length} bytes to ${OUT}`);
  console.log('PDF Network Map Export will work with this configuration.');
}

main().catch((err) => {
  console.error(`\nFAIL - ${err.message}`);
  console.error('\nTroubleshooting: RHEL_PRODUCTION_DEPLOYMENT_V3.5.0.md, Step 5 / Troubleshooting.');
  process.exit(1);
});
