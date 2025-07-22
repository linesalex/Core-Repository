// Configuration file for dynamic API URL detection
const getApiBaseUrl = () => {
  // Priority 1: Use environment variable if set
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Priority 2: Auto-detect based on current hostname
  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // http: or https:
  
  // Use the same protocol as the frontend (for production HTTPS support)
  return `${protocol}//${hostname}:4000`;
};

// Configuration object
const config = {
  API_BASE_URL: getApiBaseUrl(),
  
  // Other configuration options
  APP_VERSION: '2.2',
  
  // Development vs Production settings
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  
  // Default settings
  DEFAULT_PAGE_SIZE: 10,
  REQUEST_TIMEOUT: 30000,
  
  // For debugging
  DEBUG_API_CALLS: process.env.REACT_APP_DEBUG === 'true'
};

// Log configuration in development
if (config.IS_DEVELOPMENT) {
  console.log('🔧 Frontend Configuration:', {
    API_BASE_URL: config.API_BASE_URL,
    hostname: window.location.hostname,
    environment: process.env.NODE_ENV
  });
}

export default config; 