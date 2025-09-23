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
        ENCRYPTION_KEY: '40d1aaf98664fa7f23d6f3bf8fbb9c7af3e534f9eb8c5e35a108f4d1da7281fe'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
        ENCRYPTION_KEY: '40d1aaf98664fa7f23d6f3bf8fbb9c7af3e534f9eb8c5e35a108f4d1da7281fe'
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
  ]
}; 