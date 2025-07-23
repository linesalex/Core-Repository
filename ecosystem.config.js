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
        JWT_SECRET: 'your-super-secure-jwt-secret-change-this-in-production'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      // Performance settings
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      
      // Logging
      log_file: './logs/backend-combined.log',
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto-restart settings
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      
      // Health monitoring
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Environment-specific settings
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
        NODE_ENV: 'production',
        PORT: 3000,
        REACT_APP_API_URL: 'http://172.30.252.118:4000'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        GENERATE_SOURCEMAP: 'false'
      },
      
      // Performance settings
      max_memory_restart: '2G',
      min_uptime: '10s',
      max_restarts: 10,
      
      // Logging
      log_file: './logs/frontend-combined.log',
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto-restart settings
      autorestart: true,
      watch: false,
      
      // Health monitoring
      kill_timeout: 5000,
      listen_timeout: 8000, // React takes longer to start
      
      merge_logs: true,
      time: true
    }
  ]
}; 