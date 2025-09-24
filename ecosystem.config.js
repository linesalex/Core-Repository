module.exports = {
  apps: [
    {
      name: 'network-backend',
      cwd: './backend',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
        JWT_SECRET: 'development-jwt-secret-change-for-production'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
        // 🔐 SECURITY: Set these environment variables for production
        JWT_SECRET: 'CHANGE-THIS-TO-A-SECURE-JWT-SECRET-64-CHARACTERS-MINIMUM',
        ENCRYPTION_KEY: 'CHANGE-THIS-TO-YOUR-GENERATED-ENCRYPTION-KEY-FROM-SETUP-SCRIPT',
        
        // 📊 Optional: Database settings (if using custom path)
        // DB_PATH: './network_routes.db',
        
        // 🔧 Optional: Live Latency Service settings
        // MAX_CONCURRENT_REQUESTS: '5',
        // DEFAULT_TIMEOUT_MS: '30000',
        
        // 📝 Optional: Logging level
        // LOG_LEVEL: 'info'
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
      ignore_watch: ['node_modules', 'logs', '*.db'],
      kill_timeout: 5000,
      listen_timeout: 3000,
      merge_logs: true,
      time: true
    },
    {
      name: 'network-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        REACT_APP_API_URL: 'http://localhost:4000'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // 🌐 IMPORTANT: Update this to your production backend URL
        REACT_APP_API_URL: 'http://172.30.252.118:4000',
        
        // ⚡ Performance optimizations
        GENERATE_SOURCEMAP: 'false',
        REACT_APP_DISABLE_DEVTOOLS: 'true',
        
        // 🔧 Optional: Build optimizations
        // BUILD_PATH: './build',
        // PUBLIC_URL: '/'
      },
      max_memory_restart: '2G',
      min_uptime: '10s',
      max_restarts: 10,
      log_file: './logs/frontend-combined.log',
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
      kill_timeout: 5000,
      listen_timeout: 8000,
      merge_logs: true,
      time: true
    }
  ],

  // 🔧 PM2+ Monitoring (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'your-git-repository.git',
      path: '/var/www/network-inventory',
      'post-deploy': 'cd backend && npm install && cd ../frontend && npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};