module.exports = {
  apps: [
    {
      name: 'network-backend',
      cwd: './backend',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        JWT_SECRET: 'your-super-secure-jwt-secret-change-this-in-production',
        ENCRYPTION_KEY: 'hidden',
        // v3.5.0 PDF Network Map Export - set EXACTLY ONE of these two, since a
        // configured sidecar takes precedence over the local browser. Puppeteer's
        // own bundled Chromium can't run on RHEL 7 (glibc 2.17 vs the >=2.27 it
        // needs), so either:
        //   PUPPETEER_EXECUTABLE_PATH - a glibc-compatible Chromium already on
        //     this host, e.g. EPEL's el7 build at
        //     /usr/lib64/chromium-browser/headless_shell (preferred on RHEL 7)
        //   PDF_RENDER_SIDECAR_URL - backend/pdf-render-sidecar/ running on any
        //     reachable host; add PDF_RENDER_SIDECAR_TOKEN to match its
        //     SIDECAR_AUTH_TOKEN
        // Leave both unset to disable export cleanly. Validate any choice with
        // `node backend/checkPdfRender.js`. See RHEL_PRODUCTION_DEPLOYMENT_V3.5.0.md.
        PDF_RENDER_SIDECAR_URL: 'http://127.0.0.1:5051'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
        ENCRYPTION_KEY: 'hidden',
        PDF_RENDER_SIDECAR_URL: 'http://127.0.0.1:5051'
      },
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      log_file: './logs/backend-combined.log',
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      kill_timeout: 5000,
      listen_timeout: 3000,
      merge_logs: true,
      time: true
    },
    {
      name: 'network-frontend',
      cwd: './frontend',
      script: 'npx',
      args: ['serve', '-p', '3000', '--no-clipboard'],  // ← serve.json will handle SPA config
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        REACT_APP_API_URL: 'http://172.30.252.118:4000'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        GENERATE_SOURCEMAP: 'false'
      },
      max_memory_restart: '500M',  // ← CHANGED: Reduced from 2G to 500M (production build uses ~50MB)
      min_uptime: '10s',
      max_restarts: 10,
      log_file: './logs/frontend-combined.log',
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
      kill_timeout: 5000,
      listen_timeout: 3000,  // ← CHANGED: Reduced from 8000 to 3000 (static server starts instantly)
      merge_logs: true,
      time: true
    }
  ]
}; 
