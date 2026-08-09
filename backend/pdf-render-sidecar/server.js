const express = require('express');
const puppeteer = require('puppeteer');

const PORT = Number(process.env.PORT) || 5051;
const HOST = process.env.HOST || '127.0.0.1'; // internal-only by default; do not expose publicly
const AUTH_TOKEN = process.env.SIDECAR_AUTH_TOKEN || null;

const app = express();
app.use(express.json({ limit: '50mb' }));

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    browserPromise.catch(() => {
      // Allow a later request to retry launching if this attempt failed.
      browserPromise = null;
    });
  }
  return browserPromise;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/render', async (req, res) => {
  if (AUTH_TOKEN && req.get('authorization') !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { html, width, height } = req.body || {};
  if (!html || !width || !height) {
    return res.status(400).json({ error: 'html, width, and height are required' });
  }

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBytes = await page.pdf({
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
    });
    res.set('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('PDF render failed:', err);
    res.status(500).json({ error: 'PDF render failed', details: err.message });
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
});

app.listen(PORT, HOST, () => {
  console.log(`PDF render sidecar listening on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', async () => {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    if (browser) await browser.close().catch(() => {});
  }
  process.exit(0);
});
