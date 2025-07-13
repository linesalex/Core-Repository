import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Network Routes
export const fetchRoutes = () => api.get('/network_routes').then(res => res.data);
export const searchRoutes = (filters) => api.get('/network_routes_search', { params: filters }).then(res => res.data);
export const exportRoutesCSV = () => api.get('/network_routes_export', { responseType: 'blob' });
export const addRoute = (data) => api.post('/network_routes', data);
export const editRoute = (id, data) => api.put(`/network_routes/${id}`, data);
export const deleteRoute = (id) => api.delete(`/network_routes/${id}`);
export const fetchRoute = (id) => api.get(`/network_routes/${id}`).then(res => res.data);

// File uploads
export const uploadKMZ = (circuitId, file) => {
  const formData = new FormData();
  formData.append('kmz_file', file);
  return api.post(`/network_routes/${circuitId}/upload_kmz`, formData, {
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
  
  return api.post(`/network_routes/${circuitId}/upload_test_results`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(response => {
    return response;
  }).catch(error => {
    console.error('Upload failed:', error.response?.data || error.message);
    throw error;
  });
};

export const getTestResultsFiles = (circuitId) => api.get(`/network_routes/${circuitId}/test_results_files`).then(res => res.data);

export const downloadTestResults = (circuitId) => {
  return api.get(`/network_routes/${circuitId}/download_test_results`, {
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

export const deleteTestResultsFile = (fileId) => api.delete(`/test_results_files/${fileId}`);

// Dark Fiber Details
export const getDarkFiberDetails = (circuitId) => api.get(`/dark_fiber_details/${circuitId}`).then(res => res.data);
export const addDarkFiberDetail = (data) => api.post('/dark_fiber_details', data);
export const editDarkFiberDetail = (id, data) => api.put(`/dark_fiber_details/${id}`, data);
export const deleteDarkFiberDetail = (id) => api.delete(`/dark_fiber_details/${id}`);

// Reservations
export const reserveDarkFiber = (id, reservedBy) => {
  return api.post(`/dark_fiber_details/${id}/reserve`, { reserved_by: reservedBy }).then(res => res.data);
};

export const releaseDarkFiber = (id, releasedBy) => {
  return api.post(`/dark_fiber_details/${id}/release`, { released_by: releasedBy }).then(res => res.data);
};

// Repository Types
export const getRepositoryTypes = () => api.get('/repository_types').then(res => res.data);
export const addRepositoryType = (data) => api.post('/repository_types', data);

// Carriers
export const getCarriers = () => api.get('/carriers').then(res => res.data);

// Core Outages
export const getCoreOutages = () => api.get('/core_outages').then(res => res.data);

// Live Latency API
export const getLiveLatency = (circuitId) => api.get(`/live_latency/${circuitId}`).then(res => res.data);
export const getBatchLiveLatency = (circuitIds) => api.post('/live_latency/batch', { circuit_ids: circuitIds }).then(res => res.data);

// ====================================
// NETWORK DESIGN & PRICING TOOL APIs
// ====================================

// Location Reference Management
export const locationDataApi = {
  getLocations: () => api.get('/locations').then(res => res.data),
  addLocation: (data) => api.post('/locations', data),
  updateLocation: (id, data) => api.put(`/locations/${id}`, data),
  deleteLocation: (id) => api.delete(`/locations/${id}`)
};

// Exchange Rates Management
export const exchangeRatesApi = {
  getExchangeRates: () => api.get('/exchange_rates').then(res => res.data),
  addExchangeRate: (data) => api.post('/exchange_rates', data),
  updateExchangeRate: (id, data) => api.put(`/exchange_rates/${id}`, data)
};

// Network Design & Pricing
export const networkDesignApi = {
  // Path Finding
  findPath: (params) => api.post('/network_design/find_path', params).then(res => res.data),
  
  // Pricing Calculations
  calculatePricing: (params) => api.post('/network_design/calculate_pricing', params).then(res => res.data),
  
  // KMZ Generation
  generateKMZ: (params) => api.post('/network_design/generate_kmz', params).then(res => res.data),
  
  // Saved Searches
  saveSearch: (data) => api.post('/network_design/save_search', data).then(res => res.data),
  getSavedSearches: () => api.get('/network_design/saved_searches').then(res => res.data),
  getSavedSearch: (id) => api.get(`/network_design/saved_searches/${id}`).then(res => res.data),
  deleteSavedSearch: (id) => api.delete(`/network_design/saved_searches/${id}`).then(res => res.data),
  
  // Audit Logs
  getAuditLogs: () => api.get('/network_design/audit_logs').then(res => res.data),
  
  // Convenience methods for accessing location and exchange rate data
  getLocations: () => locationDataApi.getLocations(),
  getExchangeRates: () => exchangeRatesApi.getExchangeRates()
}; 