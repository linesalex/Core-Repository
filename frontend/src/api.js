import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000';

// Use the global axios instance instead of creating a separate one
// This ensures the Authorization header set in AuthContext is used
const api = axios;

// Network Routes
export const fetchRoutes = () => api.get(`${API_BASE_URL}/network_routes`).then(res => res.data);
export const searchRoutes = (filters) => api.get(`${API_BASE_URL}/network_routes_search`, { params: filters }).then(res => res.data);
export const exportRoutesCSV = () => api.get(`${API_BASE_URL}/network_routes_export`, { responseType: 'blob' });
export const addRoute = (data) => api.post(`${API_BASE_URL}/network_routes`, data);
export const editRoute = (id, data) => api.put(`${API_BASE_URL}/network_routes/${id}`, data);
export const deleteRoute = (id) => api.delete(`${API_BASE_URL}/network_routes/${id}`);
export const fetchRoute = (id) => api.get(`${API_BASE_URL}/network_routes/${id}`).then(res => res.data);

// File uploads
export const uploadKMZ = (circuitId, file) => {
  const formData = new FormData();
  formData.append('kmz_file', file);
  return api.post(`${API_BASE_URL}/network_routes/${circuitId}/upload_kmz`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const uploadTestResults = (circuitId, files) => {
  if (!files || (Array.isArray(files) && files.length === 0)) {
    return Promise.reject(new Error('No files provided'));
  }
  
  const formData = new FormData();
  if (Array.isArray(files)) {
    files.forEach(file => {
      formData.append('test_results_files', file);
    });
  } else {
    formData.append('test_results_files', files);
  }
  
  return api.post(`${API_BASE_URL}/network_routes/${circuitId}/upload_test_results`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(response => {
    return response;
  }).catch(error => {
    console.error('Upload failed:', error.response?.data || error.message);
    throw error;
  });
};

export const getTestResultsFiles = (circuitId) => api.get(`${API_BASE_URL}/network_routes/${circuitId}/test_results_files`).then(res => res.data);

export const downloadTestResults = (circuitId) => {
  return api.get(`${API_BASE_URL}/network_routes/${circuitId}/download_test_results`, {
    responseType: 'blob'
  }).then(response => {
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${circuitId}_test_results.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  });
};

export const deleteTestResultsFile = (fileId) => api.delete(`${API_BASE_URL}/test_results_files/${fileId}`);

// Dark Fiber Details
export const getDarkFiberDetails = (circuitId) => api.get(`${API_BASE_URL}/dark_fiber_details/${circuitId}`).then(res => res.data);
export const addDarkFiberDetail = (data) => api.post(`${API_BASE_URL}/dark_fiber_details`, data);
export const editDarkFiberDetail = (id, data) => api.put(`${API_BASE_URL}/dark_fiber_details/${id}`, data);
export const deleteDarkFiberDetail = (id) => api.delete(`${API_BASE_URL}/dark_fiber_details/${id}`);

// Reservations
export const reserveDarkFiber = (id, reservedBy) => {
  return api.post(`${API_BASE_URL}/dark_fiber_details/${id}/reserve`, { reserved_by: reservedBy }).then(res => res.data);
};

export const releaseDarkFiber = (id, releasedBy) => {
  return api.post(`${API_BASE_URL}/dark_fiber_details/${id}/release`, { released_by: releasedBy }).then(res => res.data);
};

// Repository Types
export const getRepositoryTypes = () => api.get(`${API_BASE_URL}/repository_types`).then(res => res.data);
export const addRepositoryType = (data) => api.post(`${API_BASE_URL}/repository_types`, data);

// Carriers
export const getCarriers = () => api.get(`${API_BASE_URL}/carriers`).then(res => res.data);

// Core Outages
export const getCoreOutages = () => api.get(`${API_BASE_URL}/core_outages`).then(res => res.data);

// Live Latency API
export const getLiveLatency = (circuitId) => api.get(`${API_BASE_URL}/live_latency/${circuitId}`).then(res => res.data);
export const getBatchLiveLatency = (circuitIds) => api.post(`${API_BASE_URL}/live_latency/batch`, { circuit_ids: circuitIds }).then(res => res.data);

// ====================================
// NETWORK DESIGN & PRICING TOOL APIs
// ====================================

// Location Reference Management
export const locationDataApi = {
  getLocations: () => api.get(`${API_BASE_URL}/locations`).then(res => res.data),
  createLocation: (data) => api.post(`${API_BASE_URL}/locations`, data),
  updateLocation: (id, data) => api.put(`${API_BASE_URL}/locations/${id}`, data),
  deleteLocation: (id) => api.delete(`${API_BASE_URL}/locations/${id}`),
  getCapabilities: (id) => api.get(`${API_BASE_URL}/locations/${id}/capabilities`).then(res => res.data),
  updateCapabilities: (id, data) => api.post(`${API_BASE_URL}/locations/${id}/capabilities`, data),
  updateMinimumPricing: (id, data) => api.put(`${API_BASE_URL}/locations/${id}/minimum-pricing`, data)
};

// Exchange Rates Management
export const exchangeRatesApi = {
  getExchangeRates: () => api.get(`${API_BASE_URL}/exchange_rates`).then(res => res.data),
  addExchangeRate: (data) => api.post(`${API_BASE_URL}/exchange_rates`, data),
  updateExchangeRate: (id, data) => api.put(`${API_BASE_URL}/exchange_rates/${id}`, data)
};

// Network Design & Pricing
export const networkDesignApi = {
  // Path Finding
  findPath: (params) => api.post(`${API_BASE_URL}/network_design/find_path`, params).then(res => res.data),
  
  // Pricing Calculations
  calculatePricing: (params) => api.post(`${API_BASE_URL}/network_design/calculate_pricing`, params).then(res => res.data),
  
  // Pricing Logic Configuration (Admin Only)
  getPricingLogicConfig: () => api.get(`${API_BASE_URL}/pricing_logic/config`).then(res => res.data),
  updatePricingLogicConfig: (config) => api.put(`${API_BASE_URL}/pricing_logic/config`, config).then(res => res.data),
  
  // KMZ Generation
  generateKMZ: (params) => api.post(`${API_BASE_URL}/network_design/generate_kmz`, params).then(res => res.data),
  
  // Saved Searches
  saveSearch: (data) => api.post(`${API_BASE_URL}/network_design/save_search`, data).then(res => res.data),
  getSavedSearches: () => api.get(`${API_BASE_URL}/network_design/saved_searches`).then(res => res.data),
  getSavedSearch: (id) => api.get(`${API_BASE_URL}/network_design/saved_searches/${id}`).then(res => res.data),
  deleteSavedSearch: (id) => api.delete(`${API_BASE_URL}/network_design/saved_searches/${id}`).then(res => res.data),
  
  // Audit Logs
  getAuditLogs: (params = {}) => api.get(`${API_BASE_URL}/network_design/audit_logs`, { params }).then(res => res.data),
  clearAuditLogs: () => api.delete(`${API_BASE_URL}/network_design/audit_logs`).then(res => res.data),
  exportAuditLogs: () => {
    window.open(`${API_BASE_URL}/network_design/audit_logs/export`, '_blank');
  },
  
  // Convenience methods for accessing location and exchange rate data
  getLocations: () => locationDataApi.getLocations(),
  getExchangeRates: () => exchangeRatesApi.getExchangeRates()
};

// ====================================
// BULK UPLOAD API FUNCTIONS
// ====================================

// Get list of available modules for bulk upload
export const getBulkUploadModules = () => {
  return Promise.resolve([
    { id: 'network_routes', name: 'Network Routes', description: 'Bulk upload network route data' },
    { id: 'exchange_feeds', name: 'Exchange Feeds', description: 'Bulk upload exchange feed data' },
    { id: 'exchange_contacts', name: 'Exchange Contacts', description: 'Bulk upload exchange contact data' },
    { id: 'exchange_rates', name: 'Exchange Rates', description: 'Bulk upload exchange rate data' },
    { id: 'locations', name: 'Manage Locations', description: 'Bulk upload location reference data' },
    { id: 'carriers', name: 'Manage Carriers', description: 'Bulk upload carrier data' },
    { id: 'users', name: 'User Management', description: 'Bulk upload user account data' }
  ]);
};

// Download CSV template for a module
export const downloadBulkUploadTemplate = (module) => {
  return api.get(`${API_BASE_URL}/bulk-upload/template/${module}`, {
    responseType: 'blob'
  }).then(response => {
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${module}_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    return response;
  });
};

// Download database export for a module
export const downloadBulkUploadDatabase = (module, limit = 100) => {
  return api.get(`${API_BASE_URL}/bulk-upload/database/${module}?limit=${limit}`, {
    responseType: 'blob'
  }).then(response => {
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${module}_database_export.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    return response;
  });
};

// Upload CSV file for bulk import
export const uploadBulkData = (module, file) => {
  const formData = new FormData();
  formData.append('csv_file', file);
  return api.post(`${API_BASE_URL}/bulk-upload/${module}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

// Get bulk upload history
export const getBulkUploadHistory = (page = 1, limit = 50) => {
  return api.get(`${API_BASE_URL}/bulk-upload/history?page=${page}&limit=${limit}`);
};

// ====================================
// EXCHANGE PRICING TOOL
// ====================================

export const exchangePricingApi = {
  // Quote Management
  createQuote: (data) => api.post(`${API_BASE_URL}/exchange-pricing/quotes`, data).then(res => res.data),
  getQuoteHistory: (params = {}) => api.get(`${API_BASE_URL}/exchange-pricing/quotes`, { params }).then(res => res.data),
  
  // Data for form dropdowns
  getRegions: () => api.get(`${API_BASE_URL}/exchange-pricing/regions`).then(res => res.data),
  getExchanges: (region) => api.get(`${API_BASE_URL}/exchange-pricing/exchanges/${region}`).then(res => res.data),
  getFeeds: (exchangeId) => api.get(`${API_BASE_URL}/exchange-pricing/feeds/${exchangeId}`).then(res => res.data),
  getCurrencies: () => api.get(`${API_BASE_URL}/exchange-pricing/currencies`).then(res => res.data),
  getDatacenters: (region) => api.get(`${API_BASE_URL}/exchange-pricing/datacenters/${region}`).then(res => res.data),
  
  // Audit Logs
  getAuditLogs: (params = {}) => api.get(`${API_BASE_URL}/exchange-pricing/audit_logs`, { params }).then(res => res.data),
  clearAuditLogs: () => api.delete(`${API_BASE_URL}/exchange-pricing/audit_logs`).then(res => res.data),
  exportAuditLogs: () => {
    window.open(`${API_BASE_URL}/exchange-pricing/audit_logs/export`, '_blank');
  }
};

// Export the base api object for direct use
export { api }; 