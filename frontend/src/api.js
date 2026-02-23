import axios from 'axios';
import { API_BASE_URL } from './config';

// Use the global axios instance instead of creating a separate one
// This ensures the Authorization header set in AuthContext is used
const api = axios;

// Network Routes
export const fetchRoutes = () => api.get(`${API_BASE_URL}/network_routes`).then(res => res.data);
export const fetchRoutesWithKMZ = () => api.get(`${API_BASE_URL}/network_routes_with_kmz`).then(res => res.data);
export const searchRoutes = (filters) => api.get(`${API_BASE_URL}/network_routes_search`, { params: filters }).then(res => res.data);
export const exportRoutesCSV = () => api.get(`${API_BASE_URL}/network_routes_export`, { responseType: 'blob' });
export const addRoute = (data) => api.post(`${API_BASE_URL}/network_routes`, data);
export const editRoute = (id, data) => api.put(`${API_BASE_URL}/network_routes/${id}`, data);
export const deleteRoute = (id) => api.delete(`${API_BASE_URL}/network_routes/${id}`);
export const fetchRoute = (id) => api.get(`${API_BASE_URL}/network_routes/${id}`).then(res => res.data);
export const getRouteTracking = (circuitId) => api.get(`${API_BASE_URL}/network_routes/${circuitId}/tracking`).then(res => res.data);

// KMZ Viewer
export const fetchRoutesByBandwidth = (filters, regions) => api.get(`${API_BASE_URL}/kmz_viewer/routes_by_bandwidth`, { params: { filters, regions } }).then(res => res.data);
export const fetchRouteCounts = () => api.get(`${API_BASE_URL}/kmz_viewer/route_counts`).then(res => res.data);
export const searchKMZRoutes = (query) => api.get(`${API_BASE_URL}/kmz_viewer/search_routes`, { params: { query } }).then(res => res.data);

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
    // Return full response including pagination data
    // Response format: { data: [...], pagination: { total, limit, offset, page, totalPages } }
    return res.data;
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
    { id: 'promo_pricing', name: 'Promo Pricing', description: 'Bulk upload promotional pricing rules with location-based routing' },
    { id: 'extranet_providers', name: 'Extranet Providers', description: 'Bulk upload extranet provider information with resiliency and availability' },
    { id: 'extranet_products', name: 'Extranet Products', description: 'Bulk upload extranet products with ISF and datacenter information' },
    { id: 'extranet_contacts', name: 'Extranet Contacts', description: 'Bulk upload extranet provider contact information' },
    { id: 'extranet_pricing_cities', name: 'Extranet Pricing Cities', description: 'Bulk upload pricing tier city assignments for extranet pricing' },
    { id: 'extranet_rate_card', name: 'Extranet Rate Card', description: 'Bulk upload extranet pricing rate card with bandwidth and tier pricing' },
    { id: 'cnx_colocation_racks', name: 'CNX Colocation Racks', description: 'Bulk upload colocation rack data with location POP codes, rack types, power, and RU capacity' },
    { id: 'cnx_colocation_clients', name: 'CNX Colocation Clients', description: 'Bulk upload colocation client allocations with location POP code and rack ID references' },
    { id: 'cnx_rack_devices', name: 'CNX Rack Devices', description: 'Bulk upload rack devices with location POP code, rack ID, and optional client name references' }
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
  }).then(async response => {
    // Check if response is actually an error (JSON) disguised as blob
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      const text = await response.data.text();
      const errorData = JSON.parse(text);
      throw new Error(errorData.error || 'Export failed');
    }
    
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

// Get CNX colocation locations with racks for bulk upload dropdown
export const getCNXRacksList = () => {
  return api.get(`${API_BASE_URL}/bulk-upload/cnx-racks-list`);
};

// Download per-rack device export with pre-populated RU rows
export const downloadRackDeviceExport = (rackId, locationCode, rackIdLabel) => {
  return api.get(`${API_BASE_URL}/bulk-upload/rack-device-export/${rackId}`, {
    responseType: 'blob'
  }).then(response => {
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rack_devices_${locationCode}_${rackIdLabel}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    return response;
  });
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

// Module Permission Templates (Admin only)
export const getModulePermissionTemplates = () => api.get(`${API_BASE_URL}/module-permission-templates`).then(res => res.data);
export const createModulePermissionTemplate = (data) => api.post(`${API_BASE_URL}/module-permission-templates`, data);
export const updateModulePermissionTemplate = (templateId, data) => api.put(`${API_BASE_URL}/module-permission-templates/${templateId}`, data);
export const deleteModulePermissionTemplate = (templateId) => api.delete(`${API_BASE_URL}/module-permission-templates/${templateId}`);
export const applyTemplateToUser = (templateId, userId) => api.post(`${API_BASE_URL}/module-permission-templates/${templateId}/apply/${userId}`);

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

// Availability Dashboard
export const getColocationAvailability = () => api.get(`${API_BASE_URL}/cnx-colocation/availability`).then(res => res.data);

// Colocation Pricing
export const getColocationPricingConfigs = () => api.get(`${API_BASE_URL}/cnx-colocation/pricing-config`).then(res => res.data);
export const getColocationPricingConfig = (locationId) => api.get(`${API_BASE_URL}/cnx-colocation/pricing-config/${locationId}`).then(res => res.data);
export const updateColocationPricingConfig = (locationId, data) => api.put(`${API_BASE_URL}/cnx-colocation/pricing-config/${locationId}`, data);
export const getColocationPricingLocations = () => api.get(`${API_BASE_URL}/cnx-colocation/pricing-locations`).then(res => res.data);
export const saveColocationQuote = (data) => api.post(`${API_BASE_URL}/cnx-colocation/quotes`, data);
export const getColocationQuotes = () => api.get(`${API_BASE_URL}/cnx-colocation/quotes`).then(res => res.data);
export const deleteColocationQuote = (quoteId) => api.delete(`${API_BASE_URL}/cnx-colocation/quotes/${quoteId}`);

// Client RU Ranges
export const updateClientRURanges = (clientId, ruRanges) => api.put(`${API_BASE_URL}/cnx-colocation/clients/${clientId}/ru-ranges`, { ru_ranges: ruRanges });

// IPC Reserved RU Ranges
export const updateRackIPCReserved = (rackId, ipcReservedRuRanges) => api.put(`${API_BASE_URL}/cnx-colocation/racks/${rackId}/ipc-reserved`, { ipc_reserved_ru_ranges: ipcReservedRuRanges });

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

// Analytics
export const getAnalyticsOverview = (startDate, endDate) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return api.get(`${API_BASE_URL}/analytics/overview`, { params }).then(res => res.data);
};

export const getAnalyticsDesignPricing = (startDate, endDate) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return api.get(`${API_BASE_URL}/analytics/design-pricing`, { params }).then(res => res.data);
};

export const getAnalyticsAllocatedCost = (startDate, endDate) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return api.get(`${API_BASE_URL}/analytics/allocated-cost`, { params }).then(res => res.data);
};

export const getAnalyticsUsers = (startDate, endDate) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return api.get(`${API_BASE_URL}/analytics/users`, { params }).then(res => res.data);
};

export const getAnalyticsPerformance = (startDate, endDate) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return api.get(`${API_BASE_URL}/analytics/performance`, { params }).then(res => res.data);
};

export const getAnalyticsRouteFinder = (startDate, endDate) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return api.get(`${API_BASE_URL}/analytics/route-finder`, { params }).then(res => res.data);
};

export const logLatencyMatrixReferral = (data) =>
  api.post(`${API_BASE_URL}/analytics/latency-matrix-referral`, data).then(res => res.data);

export const getAnalyticsExtranetPricing = (startDate, endDate) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return api.get(`${API_BASE_URL}/analytics/extranet-pricing`, { params }).then(res => res.data);
};

export const getAnalyticsOneDirectory = (startDate, endDate) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return api.get(`${API_BASE_URL}/analytics/one-directory`, { params }).then(res => res.data);
};

// ====================================
// EXTRANET PRICING TOOL API
// ====================================

export const extranetPricingApi = {
  // Pricing Parameters
  getParameters: () => api.get(`${API_BASE_URL}/extranet-pricing/parameters`).then(res => res.data),
  updateParameters: (parameters) => api.put(`${API_BASE_URL}/extranet-pricing/parameters`, { parameters }).then(res => res.data),
  
  // IPSec Surcharges
  getIpsecSurcharges: () => api.get(`${API_BASE_URL}/extranet-pricing/ipsec-surcharges`).then(res => res.data),
  updateIpsecSurcharges: (surcharges) => api.put(`${API_BASE_URL}/extranet-pricing/ipsec-surcharges`, { surcharges }).then(res => res.data),
  
  // Cities
  getCities: () => api.get(`${API_BASE_URL}/extranet-pricing/cities`).then(res => res.data),
  addCity: (data) => api.post(`${API_BASE_URL}/extranet-pricing/cities`, data).then(res => res.data),
  updateCity: (id, data) => api.put(`${API_BASE_URL}/extranet-pricing/cities/${id}`, data).then(res => res.data),
  deleteCity: (id) => api.delete(`${API_BASE_URL}/extranet-pricing/cities/${id}`).then(res => res.data),
  
  // Rate Card
  getRateCard: () => api.get(`${API_BASE_URL}/extranet-pricing/rate-card`).then(res => res.data),
  updateRateCardBulk: (rates) => api.post(`${API_BASE_URL}/extranet-pricing/rate-card/bulk`, { rates }).then(res => res.data),
  
  // Bandwidths and Currencies
  getBandwidths: () => api.get(`${API_BASE_URL}/extranet-pricing/bandwidths`).then(res => res.data),
  getCurrencies: () => api.get(`${API_BASE_URL}/extranet-pricing/currencies`).then(res => res.data),
  
  // Calculate pricing
  calculatePricing: (data) => api.post(`${API_BASE_URL}/extranet-pricing/calculate`, data).then(res => res.data),
  
  // Providers and Products
  getProvidersByRegion: (region) => api.get(`${API_BASE_URL}/extranet-pricing/providers/${region}`).then(res => res.data),
  getProductsByProvider: (providerId) => api.get(`${API_BASE_URL}/extranet-pricing/products/${providerId}`).then(res => res.data)
};

// System Settings
export const getSystemSettings = () => api.get(`${API_BASE_URL}/system-settings`).then(res => res.data);
export const getSystemSetting = (key) => api.get(`${API_BASE_URL}/system-settings/${key}`).then(res => res.data);
export const updateSystemSetting = (key, value) => api.put(`${API_BASE_URL}/system-settings/${key}`, { setting_value: value }).then(res => res.data);

// KMZ Template Management
export const uploadKMZTemplate = (templateType, file) => {
  const formData = new FormData();
  formData.append('template', file);
  formData.append('templateType', templateType); // 'locations' or 'disclaimer'
  return api.post(`${API_BASE_URL}/kmz_templates/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(res => res.data);
};

export const getKMZTemplateInfo = (templateType) => {
  return api.get(`${API_BASE_URL}/kmz_templates/info/${templateType}`).then(res => res.data);
};

export const downloadKMZTemplate = (templateType) => {
  return api.get(`${API_BASE_URL}/kmz_templates/download/${templateType}`, {
    responseType: 'blob'
  }).then(response => {
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${templateType}_template.kmz`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  });
};

// Network Design KMZ Export
export const checkKMZAvailability = (data) => {
  return api.post(`${API_BASE_URL}/network_design/check_kmz_availability`, data);
};

export const exportNetworkDesignKMZ = (data, signal) => {
  return api.post(`${API_BASE_URL}/network_design/export_kmz`, data, {
    responseType: 'blob',
    timeout: 300000, // 5 minute timeout for large KMZ exports
    signal // AbortController signal for cancellation support
  });
};

// ====================================
// ROUTE FINDER - PROMO PRICING APIs
// ====================================

// Get promo pricing rules for sales (sanitized view - no rule names, no margin info)
export const getPromoRulesForSales = (locationFilter = '') => {
  const params = locationFilter ? `?location_filter=${encodeURIComponent(locationFilter)}` : '';
  return api.get(`${API_BASE_URL}/route_finder/promo-pricing${params}`).then(res => res.data);
};

// Check if a route matches promo pricing and validate margins
export const checkPromoMatch = (source, destination, bandwidth, primaryCircuitIds = [], secondaryCircuitIds = []) => {
  return api.post(`${API_BASE_URL}/route_finder/check-promo-match`, {
    source,
    destination,
    bandwidth,
    primary_circuit_ids: primaryCircuitIds,
    secondary_circuit_ids: secondaryCircuitIds
  }).then(res => res.data);
};

// Calculate protected promo pricing for Route Finder (both paths must have valid promo)
export const calculateProtectedPromo = (source, destination, bandwidth, primaryCircuitIds, secondaryCircuitIds, primaryPromoPrices, secondaryPromoPrices) => {
  return api.post(`${API_BASE_URL}/route_finder/calculate-protected-promo`, {
    source,
    destination,
    bandwidth,
    primary_circuit_ids: primaryCircuitIds,
    secondary_circuit_ids: secondaryCircuitIds,
    primary_promo_prices: primaryPromoPrices,
    secondary_promo_prices: secondaryPromoPrices
  }).then(res => res.data);
};

// Save Route Finder search log to pricing logs
export const saveRouteFinderSearchLog = (data) => {
  return api.post(`${API_BASE_URL}/route_finder/save-search-log`, data).then(res => res.data);
};

// ====================================
// CARRIER QUOTE REPOSITORY APIs
// ====================================

export const carrierQuoteApi = {
  // Get all quotes with search/filter
  getQuotes: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    return api.get(`${API_BASE_URL}/carrier_quotes?${queryParams.toString()}`).then(res => res.data);
  },

  // Get a single quote by ID
  getQuote: (id) => api.get(`${API_BASE_URL}/carrier_quotes/${id}`).then(res => res.data),

  // Create a new quote
  createQuote: (data) => api.post(`${API_BASE_URL}/carrier_quotes`, data).then(res => res.data),

  // Update a quote
  updateQuote: (id, data) => api.put(`${API_BASE_URL}/carrier_quotes/${id}`, data).then(res => res.data),

  // Delete a quote
  deleteQuote: (id) => api.delete(`${API_BASE_URL}/carrier_quotes/${id}`).then(res => res.data),

  // Upload attachments to a quote
  uploadAttachments: (quoteId, files) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return api.post(`${API_BASE_URL}/carrier_quotes/${quoteId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);
  },

  // Download an attachment
  downloadAttachment: (attachmentId, fileName) => {
    return api.get(`${API_BASE_URL}/carrier_quotes/attachments/${attachmentId}/download`, {
      responseType: 'blob'
    }).then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    });
  },

  // Delete an attachment
  deleteAttachment: (attachmentId) => api.delete(`${API_BASE_URL}/carrier_quotes/attachments/${attachmentId}`).then(res => res.data),

  // Parse KMZ file for route data
  parseKmz: (file) => {
    console.log('[KMZ API] Preparing FormData for file:', file.name, 'Size:', file.size);
    const formData = new FormData();
    formData.append('kmz_file', file);
    console.log('[KMZ API] Sending POST to', `${API_BASE_URL}/carrier_quotes/parse_kmz`);
    return api.post(`${API_BASE_URL}/carrier_quotes/parse_kmz`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000 // 2 minute timeout
    }).then(res => {
      console.log('[KMZ API] Response received:', res.status, res.data);
      return res.data;
    }).catch(err => {
      if (err.code === 'ECONNABORTED') {
        console.error('[KMZ API] Request timed out after 120 seconds');
        err.message = 'KMZ parsing timed out after 2 minutes. The file may be too large.';
      }
      console.error('[KMZ API] Request failed:', err.code, err.message);
      throw err;
    });
  },

  // Get POP locations for autocomplete
  getPopLocations: (query) => api.get(`${API_BASE_URL}/carrier_quotes/pop_locations`, { params: { q: query } }).then(res => res.data),

  // Get custom locations for autocomplete
  getCustomLocations: (query) => api.get(`${API_BASE_URL}/carrier_quotes/custom_locations`, { params: { q: query } }).then(res => res.data),

  // Create a custom location
  createCustomLocation: (data) => api.post(`${API_BASE_URL}/carrier_quotes/custom_locations`, data).then(res => res.data),

  // Get carriers for autocomplete
  getCarriers: (query) => api.get(`${API_BASE_URL}/carrier_quotes/carriers`, { params: { q: query } }).then(res => res.data),

  // Get currencies
  getCurrencies: () => api.get(`${API_BASE_URL}/carrier_quotes/currencies`).then(res => res.data),

  // Get price stages for a quote
  getPriceStages: (quoteId) => api.get(`${API_BASE_URL}/carrier_quotes/${quoteId}/price_stages`).then(res => res.data),

  // Add a price stage to a quote
  addPriceStage: (quoteId, data) => api.post(`${API_BASE_URL}/carrier_quotes/${quoteId}/price_stages`, data).then(res => res.data),

  // Delete a price stage
  deletePriceStage: (quoteId, stageId) => api.delete(`${API_BASE_URL}/carrier_quotes/${quoteId}/price_stages/${stageId}`).then(res => res.data),

  // Export CSV
  exportCSV: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    return api.get(`${API_BASE_URL}/carrier_quotes/export?${queryParams.toString()}`, {
      responseType: 'blob'
    }).then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'carrier_quotes_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    });
  }
};

// Latency Matrix
export const latencyMatrixApi = {
  getMatrix: () => api.get(`${API_BASE_URL}/api/latency-matrix`).then(res => res.data),
};

export const latencyMatrixAdminApi = {
  getLocations: () => api.get(`${API_BASE_URL}/api/admin/latency-matrix/locations`).then(res => res.data),
  addLocation: (data) => api.post(`${API_BASE_URL}/api/admin/latency-matrix/locations`, data).then(res => res.data),
  updateLocation: (id, data) => api.put(`${API_BASE_URL}/api/admin/latency-matrix/locations/${id}`, data).then(res => res.data),
  deleteLocation: (id) => api.delete(`${API_BASE_URL}/api/admin/latency-matrix/locations/${id}`).then(res => res.data),
  refreshMatrix: () => api.post(`${API_BASE_URL}/api/admin/latency-matrix/refresh`).then(res => res.data),
};

// Export the base api object for direct use
export { api }; 