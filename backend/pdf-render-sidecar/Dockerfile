# Standalone HTML->PDF rendering service. Runs on a modern base image so it is
# completely unaffected by the host OS's glibc version (e.g. RHEL 7's glibc 2.17,
# which cannot run the Chromium build modern Puppeteer needs). The main backend
# calls this over HTTP via PDF_RENDER_SIDECAR_URL - see backend/pdfRenderClient.js
# and RHEL_PRODUCTION_DEPLOYMENT_V3.5.0.md.
FROM ghcr.io/puppeteer/puppeteer:23.11.1

USER root
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
RUN chown -R pptruser:pptruser /app

USER pptruser

ENV PORT=5051
ENV HOST=0.0.0.0
EXPOSE 5051

CMD ["node", "server.js"]
