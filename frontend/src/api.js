import axios from 'axios';
import { API_BASE_URL } from './config';

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
export const getRouteTracking = (circuitId) => api.get(`${API_BASE_URL}/network_routes/${circuitId}/tracking`).then(res => res.data);

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

// Core Outages - Enhanced with current outages and history
export const getCoreOutages = () => api.get(`${API_BASE_URL}/core_outages`).then(res => res.data);
export const getCurrentOutages = (search = '') => {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return api.get(`${API_BASE_URL}/core_outages/current${params}`).then(res => res.data);
};
export const getOutageHistory = (page = 1, limit = 20, search = '', startDate = '', endDate = '') => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString()
  });
  
  if (search) params.append('search', search);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  return api.get(`${API_BASE_URL}/core_outages/history?${params.toString()}`).then(res => res.data);
};
export const exportOutageHistory = (search = '', startDate = '', endDate = '') => {
  const params = new URLSearchParams();
  
  if (search) params.append('search', search);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  return api.get(`${API_BASE_URL}/core_outages/history/export?${params.toString()}`, { 
    responseType: 'blob'
  });
};
export const getOutageStats = () => api.get(`${API_BASE_URL}/core_outages/stats`).then(res => res.data);
export const getOutageMonitorStatus = () => api.get(`${API_BASE_URL}/core_outages/monitor-status`).then(res => res.data);

// Latency Warnings
export const getLatencyWarnings = (search = '') => {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return api.get(`${API_BASE_URL}/core_outages/latency-warnings${params}`).then(res => res.data);
};

// Ticket and Notes Management
export const updateOutageTicket = (circuitId, ticketNumber, notes) => {
  return api.put(`${API_BASE_URL}/core_outages/current/${circuitId}/ticket`, {
    ticket_number: ticketNumber,
    notes: notes
  }).then(res => res.data);
};

export const updateLatencyWarningTicket = (circuitId, ticketNumber, notes) => {
  return api.put(`${API_BASE_URL}/core_outages/latency-warnings/${circuitId}/ticket`, {
    ticket_number: ticketNumber,
    notes: notes
  }).then(res => res.data);
};

// Get latest live latency API call details for a circuit
export const getLatestApiCallDetails = (circuitId) => {
  return api.get(`${API_BASE_URL}/live-latency/${circuitId}/latest-call`).then(res => res.data);
};

// Live Latency API - Enhanced System Only
// Note: Old simulation endpoints removed - no longer generating fake data
export const refreshAllLiveLatency = () => api.post(`${API_BASE_URL}/api/live-latency/refresh-all`).then(res => res.data);
export const getLiveLatencyStatus = () => api.get(`${API_BASE_URL}/api/live-latency/status`).then(res => res.data);
export const getLiveLatencyHistory = (circuitId, days = 30) => api.get(`${API_BASE_URL}/api/live-latency/history/${circuitId}?days=${days}`).then(res => res.data);

// ====================================
// NETWORK DESIGN & PRICING TOOL APIs
// ====================================

// Location Reference Management
export const locationDataApi = {
  getLocations: () => api.get(`${API_BASE_URL}/locations`).then(res => res.data),
  createLocation: (data) => api.post(`${API_BASE_URL}/locations`, data).then(res => res.data),
  updateLocation: (id, data) => api.put(`${API_BASE_URL}/locations/${id}`, data),
  deleteLocation: (id) => api.delete(`${API_BASE_URL}/locations/${id}`),
  getCapabilities: (id) => api.get(`${API_BASE_URL}/locations/${id}/capabilities`).then(res => res.data),
  updateCapabilities: (id, data) => api.post(`${API_BASE_URL}/locations/${id}/capabilities`, data).then(res => res.data),
  updateMinimumPricing: (id, data) => api.put(`${API_BASE_URL}/locations/${id}/minimum-pricing`, data)
};

// Exchange Rates Management
export const exchangeRatesApi = {
  getExchangeRates: () => api.get(`${API_BASE_URL}/exchange_rates`).then(res => res.data),
  addExchangeRate: (data) => api.post(`${API_BASE_URL}/exchange_rates`, data),
  updateExchangeRate: (id, data) => api.put(`${API_BASE_URL}/exchange_rates/${id}`, data),
  deleteExchangeRate: (id) => api.delete(`${API_BASE_URL}/exchange_rates/${id}`)
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
  getUsersList: () => api.get(`${API_BASE_URL}/network_design/users_list`).then(res => res.data),
  
  // Circuit IDs for exclusion
  getCircuitIds: (search = '') => api.get(`${API_BASE_URL}/network_design/circuit_ids`, { params: { search } }).then(res => res.data),
  
  // Convenience methods for accessing location and exchange rate data
  getLocations: () => locationDataApi.getLocations(),
  getExchangeRates: () => exchangeRatesApi.getExchangeRates(),
  
  // Change logs (for allocated cost calculator)
  getAllChangeLogs: (params = {}) => api.get(`${API_BASE_URL}/change-logs`, { params }).then(res => {
    // Handle new pagination response format
    if (res.data && res.data.data) {
      return res.data.data;
    }
    // Fallback for old format (backwards compatibility)
    return res.data || [];
  }),
  clearChangeLogs: (tableName) => api.delete(`${API_BASE_URL}/change-logs/${tableName}`).then(res => res.data),
  
  // Fetch route by circuit ID
  fetchRoute: (circuitId) => api.get(`${API_BASE_URL}/network_routes/${circuitId}`).then(res => res.data)
};

// ====================================
// BULK UPLOAD API FUNCTIONS
// ====================================

// Get list of available modules for bulk upload
export const getBulkUploadModules = () => {
  return Promise.resolve([
    { id: 'network_routes', name: 'Network Routes', description: 'Bulk upload network route data with locations and carriers' },
    { id: 'exchange_feeds', name: 'Exchange Feeds', description: 'Bulk upload exchange feed data with ISF and pricing information' },
    { id: 'exchange_contacts', name: 'Exchange Contacts', description: 'Bulk upload exchange contact information' },
    { id: 'exchange_rates', name: 'Exchange Rates', description: 'Bulk upload currency exchange rates for pricing calculations' },
    { id: 'locations', name: 'Manage Locations', description: 'Bulk upload POP locations with pricing and capability data' },
    { id: 'carriers', name: 'Manage Carriers', description: 'Bulk upload carrier information with regional coverage' },
    { id: 'carrier_contacts', name: 'Carrier Contacts', description: 'Bulk upload carrier contact information and details' },
    { id: 'pop_capabilities', name: 'POP Capabilities', description: 'Bulk upload location capability matrix and service availability' },
    { id: 'exchanges', name: 'Exchange Providers', description: 'Bulk upload exchange provider information and details' },
    { id: 'users', name: 'User Management', description: 'Bulk upload user accounts with roles and permissions' },
    { id: 'live_latency_config', name: 'Live Latency Config', description: 'Bulk upload live latency API configurations for circuit monitoring' },
    { id: 'promo_pricing', name: 'Promo Pricing', description: 'Bulk upload promotional pricing rules with location-based routing' }
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
export const downloadBulkUploadDatabase = (module, limit = 10000) => {
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

// Get bulk upload progress
export const getBulkUploadProgress = (sessionId) => {
  return api.get(`${API_BASE_URL}/bulk-upload/progress/${sessionId}`);
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

// User Registration
export const registerUser = (userData) => api.post(`${API_BASE_URL}/register`, userData);

// User Approval (Admin only)
export const getPendingUsers = () => api.get(`${API_BASE_URL}/users/pending`).then(res => res.data);
export const approveUser = (userId, approvalData) => api.post(`${API_BASE_URL}/users/${userId}/approve`, approvalData);
export const rejectUser = (userId) => api.delete(`${API_BASE_URL}/users/${userId}/reject`);

// Per-Module Permissions (Admin only)
export const getUserModulePermissions = (userId) => api.get(`${API_BASE_URL}/users/${userId}/module-permissions`).then(res => res.data);
export const updateUserModulePermissions = (userId, permissions) => api.put(`${API_BASE_URL}/users/${userId}/module-permissions`, permissions);

// Locations
export const getLocations = () => api.get(`${API_BASE_URL}/locations`).then(res => res.data);

// Cross Connect
export const getCrossConnectInfo = (locationId) => api.get(`${API_BASE_URL}/locations/${locationId}/cross-connect`).then(res => res.data);
export const updateCrossConnectInfo = (locationId, data) => api.put(`${API_BASE_URL}/locations/${locationId}/cross-connect`, data);

// ====================================
// CNX COLOCATION ELEVATION & DEVICES
// ====================================

// Rack Elevation
export const getRackElevation = (rackId) => api.get(`${API_BASE_URL}/cnx-colocation/racks/${rackId}/elevation`).then(res => res.data);

// Rack Design File
export const downloadRackDesign = (rackId) => {
  return api.get(`${API_BASE_URL}/cnx-colocation/racks/${rackId}/design-download`, {
    responseType: 'blob',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
    }
  });
};
export const deleteRackDesign = (rackId) => api.delete(`${API_BASE_URL}/cnx-colocation/racks/${rackId}/design-file`);

// Devices
export const getRackDevices = (rackId) => api.get(`${API_BASE_URL}/cnx-colocation/racks/${rackId}/devices`).then(res => res.data);
export const createDevice = (rackId, deviceData) => api.post(`${API_BASE_URL}/cnx-colocation/racks/${rackId}/devices`, deviceData);
export const updateDevice = (deviceId, deviceData) => api.put(`${API_BASE_URL}/cnx-colocation/devices/${deviceId}`, deviceData);
export const deleteDevice = (deviceId) => api.delete(`${API_BASE_URL}/cnx-colocation/devices/${deviceId}`);

// ====================================
// ADMIN: LIVE LATENCY API MANAGEMENT
// ====================================

// Dashboard and overview
export const liveLatencyAdminApi = {
  // Get dashboard overview statistics
  getOverview: () => api.get(`${API_BASE_URL}/admin/live-latency/overview`).then(res => res.data),
  
  // Configuration management
  getConfigurations: () => api.get(`${API_BASE_URL}/admin/live-latency/configurations`).then(res => res.data),
  getConfiguration: (circuitId) => api.get(`${API_BASE_URL}/admin/live-latency/configurations/${circuitId}`).then(res => res.data),
  createConfiguration: (data) => api.post(`${API_BASE_URL}/admin/live-latency/configurations`, data),
  updateConfiguration: (configId, data) => api.put(`${API_BASE_URL}/admin/live-latency/configurations/${configId}`, data),
  deleteConfiguration: (configId) => api.delete(`${API_BASE_URL}/admin/live-latency/configurations/${configId}`),
  
  // Testing and monitoring
  testConnection: (circuitId) => api.post(`${API_BASE_URL}/admin/live-latency/test/${circuitId}`).then(res => res.data),
  getApiLogs: (circuitId, limit = 50) => api.get(`${API_BASE_URL}/admin/live-latency/logs/${circuitId}?limit=${limit}`).then(res => res.data),
  
  // Cleanup operations
  cleanupOldLogs: () => api.post(`${API_BASE_URL}/admin/live-latency/cleanup-logs`).then(res => res.data)
};

// ===========================
// Feedback Module API Functions
// ===========================

// Submit new feedback with attachments
export const submitFeedback = (formData) => {
  return api.post(`${API_BASE_URL}/feedback`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

// Get user's own submissions
export const getMyFeedback = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.type) params.append('type', filters.type);
  
  const queryString = params.toString();
  return api.get(`${API_BASE_URL}/feedback/my-submissions${queryString ? '?' + queryString : ''}`).then(res => res.data);
};

// Get all feedback (Admin only)
export const getAllFeedback = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.type) params.append('type', filters.type);
  if (filters.priority) params.append('priority', filters.priority);
  if (filters.search) params.append('search', filters.search);
  
  const queryString = params.toString();
  return api.get(`${API_BASE_URL}/feedback/all${queryString ? '?' + queryString : ''}`).then(res => res.data);
};

// Get feedback statistics (Admin only)
export const getFeedbackStatistics = () => api.get(`${API_BASE_URL}/feedback/statistics`).then(res => res.data);

// Get single feedback with full details
export const getFeedbackDetails = (id) => api.get(`${API_BASE_URL}/feedback/${id}`).then(res => res.data);

// Update feedback status (Admin only)
export const updateFeedbackStatus = (id, statusData) => api.put(`${API_BASE_URL}/feedback/${id}/status`, statusData);

// Add comment to feedback
export const addFeedbackComment = (id, comment) => api.post(`${API_BASE_URL}/feedback/${id}/comment`, { comment });

// Download attachment
export const downloadFeedbackAttachment = (feedbackId, filename) => {
  return api.get(`${API_BASE_URL}/feedback/${feedbackId}/attachments/${filename}`, {
    responseType: 'blob'
  }).then(response => {
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  });
};

// Delete attachment
export const deleteFeedbackAttachment = (feedbackId, attachmentId) => 
  api.delete(`${API_BASE_URL}/feedback/${feedbackId}/attachments/${attachmentId}`);

// Mark feedback as viewed
export const markFeedbackAsViewed = (feedbackId) => 
  api.post(`${API_BASE_URL}/feedback/${feedbackId}/mark-viewed`);

// Delete feedback (Admin only)
export const deleteFeedback = (feedbackId) => 
  api.delete(`${API_BASE_URL}/feedback/${feedbackId}`);

// Get feedback notification count (unread items)
export const getFeedbackNotificationCount = () => 
  api.get(`${API_BASE_URL}/feedback/notifications/count`).then(res => res.data);

// Export the base api object for direct use
export { api }; 