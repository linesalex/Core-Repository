/**
 * Dynamic API Configuration
 * Automatically detects the server IP/hostname and configures the API URL
 * Works in development, production, and when IP addresses change
 */

// Function to get the current server's API URL
const getApiBaseUrl = () => {
  // 1. Check for environment variable first (highest priority)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // 2. If in development mode and no env var, try common dev URLs
  if (process.env.NODE_ENV === 'development') {
    // Check if localhost backend is available (for local development)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:4000';
    }
  }
  
  // 3. Auto-detect based on current page URL (works for same-server deployments)
  const currentHost = window.location.hostname;
  const protocol = window.location.protocol;
  
  // If accessing via IP or hostname, assume backend is on same server on port 4000
  return `${protocol}//${currentHost}:4000`;
};

// Get the API base URL
export const API_BASE_URL = getApiBaseUrl();

// Export configuration object
export const config = {
  apiBaseUrl: API_BASE_URL,
  
  // Other configuration options
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  
  // Debug info
  environment: process.env.NODE_ENV,
  detectedHost: window.location.hostname,
  detectedProtocol: window.location.protocol,
  
  // Method to refresh the API URL (useful for debugging)
  refreshApiUrl: () => {
    return getApiBaseUrl();
  }
};

// Debug logging in development
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 API Configuration:', {
    apiBaseUrl: config.apiBaseUrl,
    environment: config.environment,
    detectedHost: config.detectedHost,
    envApiUrl: process.env.REACT_APP_API_URL
  });
}

export default config; 