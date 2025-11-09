import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Paper, Grid, Alert, CircularProgress, Card, CardContent, CardHeader,
  Autocomplete, FormControlLabel, Checkbox, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Accordion, AccordionSummary, AccordionDetails, Tabs, Tab, IconButton, Divider,
  Tooltip, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  Pagination, InputAdornment
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EmailIcon from '@mui/icons-material/Email';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import { useAuth } from './AuthContext';
import { networkDesignApi } from './api';

// Tab Panel Component
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`allocated-cost-tabpanel-${index}`}
      aria-labelledby={`allocated-cost-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AllocatedCostCalculator = () => {
  const { user, modulePermissions } = useAuth();
  
  // Get user's allocated_cost_calculator module permission level
  const calculatorPermission = modulePermissions['allocated_cost_calculator'] || null;
  
  // Check permissions
  const canViewPricingLogs = user !== null && calculatorPermission !== null;
  const canManageLogs = user && user.role === 'administrator';
  const isReadOnly = calculatorPermission === 'read_only';
  
  // Form state
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    bandwidth: '',
    primaryPathRoutes: '', // Comma-separated circuit IDs
    secondaryPathRoutes: '', // Comma-separated circuit IDs
    pricingType: 'primary', // 'primary', 'primary_secondary', or 'protected'
    outputCurrency: 'USD',
    contractTerm: 12,
    quoteRequestId: '',
    customerName: ''
  });
  
  // Manual Incremental Costs state
  const [incrementalCosts, setIncrementalCosts] = useState([]);
  
  // Data state
  const [locations, setLocations] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({});
  const [availableCurrencies, setAvailableCurrencies] = useState(['USD']);
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [pricingResults, setPricingResults] = useState(null);
  
  // Validation state
  const [primaryPathValidation, setPrimaryPathValidation] = useState({ valid: false, message: '', routes: [] });
  const [secondaryPathValidation, setSecondaryPathValidation] = useState({ valid: false, message: '', routes: [] });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedAccordion, setExpandedAccordion] = useState({
    input: true,
    incremental: true,
    results: false,
    pricing: false
  });
  const [currentTab, setCurrentTab] = useState(0);
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  
  // Helper function to toggle accordion state
  const toggleAccordion = (accordionName) => {
    setExpandedAccordion(prev => ({
      ...prev,
      [accordionName]: !prev[accordionName]
    }));
  };
  
  // Pricing logs filtering and pagination state
  const [usersList, setUsersList] = useState([]);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [customerNameFilter, setCustomerNameFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 0
  });
  
  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    primaryPricing: true,
    secondaryPricing: false,
    protectedPricing: false
  });
  
  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);
  
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const promises = [
        networkDesignApi.getLocations(),
        networkDesignApi.getExchangeRates()
      ];
      
      // For provisioner and admin users, fetch users list for filter dropdown
      if (canViewPricingLogs && user && (user.role === 'administrator' || calculatorPermission === 'provisioner')) {
        promises.push(networkDesignApi.getUsersList());
      }
      
      const results = await Promise.all(promises);
      const [locationsData, ratesData, usersListData] = results;
      
      setLocations(locationsData);
      
      // Process exchange rates
      const ratesMap = {};
      const currencies = new Set(['USD']);
      ratesData.forEach(rate => {
        ratesMap[rate.currency_code] = parseFloat(rate.usd_rate);
        currencies.add(rate.currency_code);
      });
      ratesMap['USD'] = 1; // Base rate
      setExchangeRates(ratesMap);
      setAvailableCurrencies(Array.from(currencies).sort());
      
      // Set users list if available
      if (usersListData) {
        setUsersList(usersListData);
      }
      
      // Load audit logs with pagination
      if (canViewPricingLogs) {
        await loadAuditLogs();
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const loadAuditLogs = async () => {
    try {
      const params = {
        table_name: 'allocated_cost_calculator',
        limit: pagination.limit,
        offset: (pagination.page - 1) * pagination.limit
      };
      
      // Add filters if set
      if (selectedUser) {
        params.user_id = selectedUser;
      }
      if (customerNameFilter.trim()) {
        params.customer_name = customerNameFilter.trim();
      }
      if (logSearchTerm.trim()) {
        params.quote_request_id = logSearchTerm.trim();
      }
      
      const response = await networkDesignApi.getAllChangeLogs(params);
      
      // Handle new pagination response format
      if (response.data && response.pagination) {
        setAuditLogs(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages
        }));
      } else {
        // Fallback for old format
        setAuditLogs(response || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setError('Failed to load pricing logs: ' + err.message);
    }
  };
  
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Trigger validation for route fields
    if (field === 'primaryPathRoutes') {
      validateRoutes(value, formData.source, formData.destination, 'primary');
    } else if (field === 'secondaryPathRoutes') {
      validateRoutes(value, formData.source, formData.destination, 'secondary');
    }
  };
  
  // Incremental Costs Management Functions
  const addIncrementalCost = () => {
    const newCost = {
      id: Date.now(), // Unique identifier
      costType: 'core_incremental_new',
      sourceLocation: '',
      destinationLocation: '',
      incrementalCost: '',
      currency: 'USD',
      allocationFactor: '',
      pathAllocation: 'primary',
      selectedCircuit: '', // For Core Incremental Upgrade
      saved: false // Track if the cost is saved/locked
    };
    setIncrementalCosts(prev => [...prev, newCost]);
  };
  
  const removeIncrementalCost = (id) => {
    const costToRemove = incrementalCosts.find(c => c.id === id);
    
    // If it's a Core Incremental New that was saved, remove it from the routes field
    if (costToRemove && costToRemove.costType === 'core_incremental_new' && costToRemove.saved) {
      const virtualCircuitId = `NEW_${costToRemove.sourceLocation}_${costToRemove.destinationLocation}`;
      const pathField = costToRemove.pathAllocation === 'primary' ? 'primaryPathRoutes' : 'secondaryPathRoutes';
      const currentRoutes = formData[pathField];
      const routesArray = currentRoutes.split(',').map(r => r.trim()).filter(r => r);
      const updatedRoutes = routesArray.filter(r => r !== virtualCircuitId).join(', ');
      
      setFormData(prev => ({ ...prev, [pathField]: updatedRoutes }));
      
      // Re-validate the path
      if (pathField === 'primaryPathRoutes') {
        validateRoutes(updatedRoutes, formData.source, formData.destination, 'primary');
      } else {
        validateRoutes(updatedRoutes, formData.source, formData.destination, 'secondary');
      }
    }
    
    setIncrementalCosts(prev => prev.filter(cost => cost.id !== id));
  };
  
  const saveIncrementalCost = (id) => {
    const cost = incrementalCosts.find(c => c.id === id);
    if (!cost) return;
    
    // Validate required fields
    if (!cost.sourceLocation || !cost.destinationLocation || !cost.incrementalCost || 
        !cost.currency || cost.allocationFactor === '' || cost.allocationFactor === null) {
      setError('Please fill in all required fields before saving');
      return;
    }
    
    // For Core Incremental New, add to the appropriate path routes field
    if (cost.costType === 'core_incremental_new') {
      const virtualCircuitId = `NEW_${cost.sourceLocation}_${cost.destinationLocation}`;
      const pathField = cost.pathAllocation === 'primary' ? 'primaryPathRoutes' : 'secondaryPathRoutes';
      const currentRoutes = formData[pathField];
      const updatedRoutes = currentRoutes ? `${currentRoutes}, ${virtualCircuitId}` : virtualCircuitId;
      
      setFormData(prev => ({ ...prev, [pathField]: updatedRoutes }));
      
      // Trigger validation with the new route included
      if (pathField === 'primaryPathRoutes') {
        validateRoutes(updatedRoutes, formData.source, formData.destination, 'primary');
      } else {
        validateRoutes(updatedRoutes, formData.source, formData.destination, 'secondary');
      }
    }
    
    // Mark the cost as saved
    setIncrementalCosts(prev => prev.map(c => 
      c.id === id ? { ...c, saved: true } : c
    ));
    
    setSuccess('Incremental cost saved successfully');
    setTimeout(() => setSuccess(null), 3000);
  };
  
  const editIncrementalCost = (id) => {
    const cost = incrementalCosts.find(c => c.id === id);
    if (!cost) return;
    
    // If it's a Core Incremental New, remove the virtual circuit from routes
    if (cost.costType === 'core_incremental_new') {
      const virtualCircuitId = `NEW_${cost.sourceLocation}_${cost.destinationLocation}`;
      const pathField = cost.pathAllocation === 'primary' ? 'primaryPathRoutes' : 'secondaryPathRoutes';
      const currentRoutes = formData[pathField];
      const routesArray = currentRoutes.split(',').map(r => r.trim()).filter(r => r);
      const updatedRoutes = routesArray.filter(r => r !== virtualCircuitId).join(', ');
      
      setFormData(prev => ({ ...prev, [pathField]: updatedRoutes }));
      
      // Re-validate the path
      if (pathField === 'primaryPathRoutes') {
        validateRoutes(updatedRoutes, formData.source, formData.destination, 'primary');
      } else {
        validateRoutes(updatedRoutes, formData.source, formData.destination, 'secondary');
      }
    }
    
    // Mark the cost as not saved (unlock it)
    setIncrementalCosts(prev => prev.map(c => 
      c.id === id ? { ...c, saved: false } : c
    ));
  };
  
  const updateIncrementalCost = (id, field, value) => {
    setIncrementalCosts(prev => prev.map(cost => {
      if (cost.id === id) {
        const updatedCost = { ...cost, [field]: value };
        
        // Special handling for Core Incremental Upgrade - auto-fill source/destination
        if (field === 'selectedCircuit' && value) {
          const validation = cost.pathAllocation === 'primary' ? primaryPathValidation : secondaryPathValidation;
          const selectedRoute = validation.routes.find(r => r.circuit_id === value);
          if (selectedRoute) {
            updatedCost.sourceLocation = selectedRoute.location_a;
            updatedCost.destinationLocation = selectedRoute.location_b;
          }
        }
        
        return updatedCost;
      }
      return cost;
    }));
  };
  
  // Validate incremental costs
  const validateIncrementalCosts = () => {
    if (incrementalCosts.length === 0) {
      return { valid: true, errors: [] };
    }
    
    const errors = [];
    
    incrementalCosts.forEach((cost, index) => {
      const costNum = index + 1;
      
      // Check required fields
      if (!cost.sourceLocation) {
        errors.push(`Cost ${costNum}: Source Location is required`);
      }
      if (!cost.destinationLocation) {
        errors.push(`Cost ${costNum}: Destination Location is required`);
      }
      if (!cost.incrementalCost || cost.incrementalCost === '') {
        errors.push(`Cost ${costNum}: Incremental Cost is required`);
      }
      if (!cost.currency) {
        errors.push(`Cost ${costNum}: Currency is required`);
      }
      if (cost.allocationFactor === '' || cost.allocationFactor === null || cost.allocationFactor === undefined) {
        errors.push(`Cost ${costNum}: Allocation Factor is required`);
      }
      
      // Check cost range (0 to 999,999,999)
      const costValue = parseFloat(cost.incrementalCost);
      if (!isNaN(costValue) && (costValue < 0 || costValue > 999999999)) {
        errors.push(`Cost ${costNum}: Incremental Cost must be between 0 and 999,999,999`);
      }
      
      // Check allocation factor range (0 to 1)
      const allocationValue = parseFloat(cost.allocationFactor);
      if (!isNaN(allocationValue) && (allocationValue < 0 || allocationValue > 1)) {
        errors.push(`Cost ${costNum}: Allocation Factor must be between 0.0 and 1.0`);
      }
      
      // Check Core Incremental Upgrade has a selected circuit
      if (cost.costType === 'core_incremental_upgrade' && !cost.selectedCircuit) {
        errors.push(`Cost ${costNum}: Circuit selection is required for Core Incremental Upgrade`);
      }
    });
    
    // Validate path completeness for Core Incremental New segments
    ['primary', 'secondary'].forEach(pathType => {
      if (pathType === 'secondary' && formData.pricingType === 'primary') {
        return; // Skip secondary path validation if not needed
      }
      
      const pathCosts = incrementalCosts.filter(cost => 
        cost.pathAllocation === pathType && cost.costType === 'core_incremental_new'
      );
      
      if (pathCosts.length > 0) {
        const validation = pathType === 'primary' ? primaryPathValidation : secondaryPathValidation;
        const pathRoutes = pathType === 'primary' ? formData.primaryPathRoutes : formData.secondaryPathRoutes;
        
        // Check if path has any existing circuits
        const hasExistingCircuits = pathRoutes && pathRoutes.trim().length > 0;
        
        if (hasExistingCircuits && validation.routes.length > 0) {
          // Build a combined path from existing circuits and new segments
          const pathValidationResult = validateCombinedPath(
            validation.routes,
            pathCosts,
            formData.source,
            formData.destination,
            pathType
          );
          
          if (!pathValidationResult.valid) {
            errors.push(`${pathType.charAt(0).toUpperCase() + pathType.slice(1)} Path: ${pathValidationResult.error}`);
          }
        } else if (!hasExistingCircuits) {
          // Only new segments, validate they form a complete path
          const newSegmentsValidation = validateNewSegmentsPath(
            pathCosts,
            formData.source,
            formData.destination,
            pathType
          );
          
          if (!newSegmentsValidation.valid) {
            errors.push(`${pathType.charAt(0).toUpperCase() + pathType.slice(1)} Path: ${newSegmentsValidation.error}`);
          }
        }
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  };
  
  // Validate combined path (existing circuits + new segments)
  const validateCombinedPath = (existingRoutes, newSegments, source, destination, pathType) => {
    try {
      // Build a map of all available segments
      const segments = [];
      
      // Add existing circuit segments
      existingRoutes.forEach(route => {
        segments.push({
          from: route.location_a,
          to: route.location_b,
          type: 'existing'
        });
      });
      
      // Add new incremental segments
      newSegments.forEach(seg => {
        if (seg.sourceLocation && seg.destinationLocation) {
          segments.push({
            from: seg.sourceLocation,
            to: seg.destinationLocation,
            type: 'new'
          });
        }
      });
      
      // Try to build a complete path from source to destination
      const pathResult = findPath(segments, source, destination);
      
      if (!pathResult.found) {
        return {
          valid: false,
          error: `Cannot form complete end-to-end path from ${source} to ${destination}. Existing circuits and new segments do not connect.`
        };
      }
      
      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        error: `Path validation error: ${err.message}`
      };
    }
  };
  
  // Validate path with only new segments
  const validateNewSegmentsPath = (newSegments, source, destination, pathType) => {
    try {
      const segments = newSegments.map(seg => ({
        from: seg.sourceLocation,
        to: seg.destinationLocation,
        type: 'new'
      })).filter(seg => seg.from && seg.to);
      
      if (segments.length === 0) {
        return {
          valid: false,
          error: 'No valid new segments to form a path'
        };
      }
      
      const pathResult = findPath(segments, source, destination);
      
      if (!pathResult.found) {
        return {
          valid: false,
          error: `New segments do not form a complete path from ${source} to ${destination}`
        };
      }
      
      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        error: `New segments validation error: ${err.message}`
      };
    }
  };
  
  // Helper function to find a path using BFS
  const findPath = (segments, source, destination) => {
    if (source === destination) {
      return { found: true, path: [source] };
    }
    
    // Build adjacency list
    const graph = {};
    segments.forEach(seg => {
      if (!graph[seg.from]) graph[seg.from] = [];
      graph[seg.from].push(seg.to);
    });
    
    // BFS to find path
    const queue = [[source]];
    const visited = new Set([source]);
    
    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];
      
      if (current === destination) {
        return { found: true, path };
      }
      
      if (graph[current]) {
        for (const neighbor of graph[current]) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push([...path, neighbor]);
          }
        }
      }
    }
    
    return { found: false, path: [] };
  };
  
  // Real-time route validation
  const validateRoutes = async (routeString, source, destination, pathType) => {
    const setValidation = pathType === 'primary' ? setPrimaryPathValidation : setSecondaryPathValidation;
    
    if (!routeString || !routeString.trim()) {
      setValidation({ valid: false, message: '', routes: [] });
      return;
    }
    
    // Parse circuit IDs
    const circuitIds = routeString.split(',').map(id => id.trim()).filter(id => id);
    
    if (circuitIds.length === 0) {
      setValidation({ valid: false, message: '', routes: [] });
      return;
    }
    
    setValidation({ valid: false, message: `⏳ Validating ${circuitIds.length} route(s)...`, routes: [] });
    
    try {
      // Fetch route details - handle virtual NEW_ circuits
      const routePromises = circuitIds.map(circuitId => {
        // Check if this is a virtual NEW circuit
        if (circuitId.startsWith('NEW_')) {
          // Parse the virtual circuit format: NEW_SourceLocation_DestinationLocation
          const parts = circuitId.substring(4).split('_');
          if (parts.length >= 2) {
            const sourceLocation = parts[0];
            const destinationLocation = parts.slice(1).join('_'); // In case destination has underscores
            
            // Return a virtual route object
            return Promise.resolve({
              circuit_id: circuitId,
              location_a: sourceLocation,
              location_b: destinationLocation,
              carrier: 'New',
              cable_system: 'N/A',
              latency_ms: 0,
              bandwidth_mbps: 0,
              isVirtual: true // Flag to identify virtual circuits
            });
          } else {
            // Invalid format
            return Promise.resolve(null);
          }
        } else {
          // Regular circuit - fetch from database
          return networkDesignApi.fetchRoute(circuitId).catch(err => null);
        }
      });
      const routes = await Promise.all(routePromises);
      
      // Check for not found routes
      const notFound = circuitIds.filter((id, index) => routes[index] === null);
      if (notFound.length > 0) {
        setValidation({
          valid: false,
          message: `❌ Circuit ID not found or invalid format: ${notFound.join(', ')}`,
          routes: []
        });
        return;
      }
      
      // Validate end-to-end connectivity
      if (source && destination) {
        const connectivity = validateEndToEndConnectivity(routes, source, destination);
        if (!connectivity.valid) {
          setValidation({
            valid: false,
            message: `❌ ${connectivity.message}`,
            routes: routes
          });
          return;
        }
      }
      
      setValidation({
        valid: true,
        message: `✓ ${routes.length} route(s) validated`,
        routes: routes
      });
    } catch (err) {
      setValidation({
        valid: false,
        message: `❌ Validation error: ${err.message}`,
        routes: []
      });
    }
  };
  
  // Validate that routes form end-to-end path
  const validateEndToEndConnectivity = (routes, source, destination) => {
    if (routes.length === 0) {
      return { valid: false, message: 'No routes provided' };
    }
    
    // Build a graph of connections (bidirectional)
    const graph = {};
    routes.forEach(route => {
      // Add connection from location_a to location_b
      if (!graph[route.location_a]) graph[route.location_a] = [];
      graph[route.location_a].push({ to: route.location_b, route });
      
      // Add connection from location_b to location_a (bidirectional)
      if (!graph[route.location_b]) graph[route.location_b] = [];
      graph[route.location_b].push({ to: route.location_a, route });
    });
    
    // Use BFS to find if there's a path from source to destination
    const queue = [{ location: source, path: [], usedRoutes: new Set() }];
    const visited = new Set([source]);
    
    while (queue.length > 0) {
      const { location, path, usedRoutes } = queue.shift();
      
      // Check if we reached destination
      if (location === destination) {
        // Verify all routes are used
        if (usedRoutes.size === routes.length) {
          return { valid: true, message: '' };
        }
      }
      
      // Explore neighbors
      const neighbors = graph[location] || [];
      for (const neighbor of neighbors) {
        const routeKey = `${neighbor.route.circuit_id}`;
        if (!usedRoutes.has(routeKey)) {
          const newUsedRoutes = new Set(usedRoutes);
          newUsedRoutes.add(routeKey);
          
          if (!visited.has(neighbor.to) || newUsedRoutes.size > usedRoutes.size) {
            visited.add(neighbor.to);
            queue.push({
              location: neighbor.to,
              path: [...path, neighbor.route],
              usedRoutes: newUsedRoutes
            });
          }
        }
      }
    }
    
    return {
      valid: false,
      message: "Selected routes don't create end-to-end path from Source to Destination"
    };
  };
  
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };
  
  // Handle refresh - reset all data
  const handleRefresh = () => {
    // Reset all form data to initial state
    setFormData({
      source: '',
      destination: '',
      bandwidth: '',
      primaryPathRoutes: '',
      secondaryPathRoutes: '',
      pricingType: 'primary',
      outputCurrency: 'USD',
      contractTerm: 12,
      quoteRequestId: '',
      customerName: ''
    });
    
    // Clear validation
    setPrimaryPathValidation({ valid: false, message: '', routes: [] });
    setSecondaryPathValidation({ valid: false, message: '', routes: [] });
    
    // Clear incremental costs
    setIncrementalCosts([]);
    
    // Clear all results
    setSearchResults(null);
    setPricingResults(null);
    
    // Clear any errors or success messages
    setError(null);
    setSuccess(null);
    
    // Reset accordion state
    setExpandedAccordion({
      input: true,
      incremental: true,
      results: false,
      pricing: false
    });
  };
  
  const handleCalculate = async () => {
    // Validation
    if (!formData.source || !formData.destination) {
      setError('Please select both source and destination locations');
      return;
    }
    
    if (!formData.bandwidth) {
      setError('Please enter bandwidth');
      return;
    }
    
    const bandwidth = parseFloat(formData.bandwidth);
    if (bandwidth < 10 || bandwidth > 10000) {
      setError('Bandwidth must be between 10 and 10000 Mbps');
      return;
    }
    
    if (!formData.primaryPathRoutes || !formData.primaryPathRoutes.trim()) {
      setError('Please enter Primary Path routes');
      return;
    }
    
    if (!primaryPathValidation.valid) {
      setError('Primary Path routes are invalid');
      return;
    }
    
    // Validate secondary path if required
    if ((formData.pricingType === 'primary_secondary' || formData.pricingType === 'protected')) {
      if (!formData.secondaryPathRoutes || !formData.secondaryPathRoutes.trim()) {
        setError('Please enter Secondary Path routes for selected pricing type');
        return;
      }
      
      if (!secondaryPathValidation.valid) {
        setError('Secondary Path routes are invalid');
        return;
      }
    }
    
    // Validate incremental costs
    const incrementalValidation = validateIncrementalCosts();
    if (!incrementalValidation.valid) {
      setError('Incremental costs validation failed:\n' + incrementalValidation.errors.join('\n'));
      return;
    }
    
    setLoading(true);
    setError(null);
    setSearchResults(null);
    setPricingResults(null);
    
    try {
      // Build path data from validated routes
      const primaryPath = buildPathData(primaryPathValidation.routes, formData.source, formData.destination);
      const paths = [primaryPath];
      
      let secondaryPath = null;
      if (formData.pricingType !== 'primary' && secondaryPathValidation.routes.length > 0) {
        secondaryPath = buildPathData(secondaryPathValidation.routes, formData.source, formData.destination);
        paths.push(secondaryPath);
      }
      
      setSearchResults({
        primaryPath: primaryPath,
        diversePath: secondaryPath
      });
      
      // Filter out virtual segments from paths for backend calculation
      // (their costs are handled via incrementalCosts)
      const backendPaths = paths.map(path => ({
        ...path,
        route: path.route.filter(segment => !segment.isVirtual)
      }));
      
      // Calculate pricing
      const pricingParams = {
        paths: backendPaths,
        bandwidth: bandwidth,
        source: formData.source,
        destination: formData.destination,
        outputCurrency: formData.outputCurrency,
        contractTerm: formData.contractTerm,
        quoteRequestId: formData.quoteRequestId,
        customerName: formData.customerName,
        calling_module: 'allocated_cost_calculator',
        protection_required: formData.pricingType === 'protected',
        incrementalCosts: incrementalCosts // Include manual incremental costs
      };
      
      console.log('Calculating pricing with params:', pricingParams);
      const pricing = await networkDesignApi.calculatePricing(pricingParams);
      console.log('Received pricing results:', pricing);
      
      setPricingResults(pricing);
      setExpandedAccordion({
        input: false,
        incremental: false,
        results: true,
        pricing: true
      });
      setSuccess('Pricing calculated successfully');
      
      // Reload audit logs
      if (canViewPricingLogs) {
        await loadAuditLogs();
      }
    } catch (err) {
      console.error('Calculation error:', err);
      setError(`Failed to calculate pricing: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Build path data structure from routes
  const buildPathData = (routes, source, destination) => {
    const path = [source];
    const routeSegments = [];
    let currentLocation = source;
    let totalLatency = 0;
    
    routes.forEach(route => {
      // Check if this is a virtual NEW circuit
      if (route.isVirtual) {
        // Virtual circuit - add to display but mark as virtual
        // (cost/latency handled separately via incrementalCosts)
        const nextLocation = route.location_a === currentLocation ? route.location_b : route.location_a;
        
        // Add virtual segment for display
        routeSegments.push({
          circuit_id: 'New Core Circuit',
          from: currentLocation,
          to: nextLocation,
          latency: 0,
          carrier: 'New',
          cable_system: 'N/A',
          bandwidth: 0,
          bandwidthDisplay: 'N/A',
          cost: 0,
          isVirtual: true
        });
        
        currentLocation = nextLocation;
        if (!path.includes(nextLocation)) {
          path.push(nextLocation);
        }
        return; // Skip to next route
      }
      
      // Regular circuit - process normally
      // Handle Dark Fiber bandwidth
      let bandwidthValue;
      let bandwidthDisplay;
      
      if (route.bandwidth && typeof route.bandwidth === 'string' && route.bandwidth.toLowerCase().includes('dark fiber')) {
        // Dark Fiber: use 200000 Mbps for calculations, preserve "Dark Fiber" for display
        bandwidthValue = 200000;
        bandwidthDisplay = 'Dark Fiber';
      } else {
        // Regular bandwidth: parse numeric value
        bandwidthValue = parseFloat(route.bandwidth) || 0;
        bandwidthDisplay = bandwidthValue;
      }
      
      const segment = {
        circuit_id: route.circuit_id,
        from: currentLocation,
        to: route.location_a === currentLocation ? route.location_b : route.location_a,
        latency: parseFloat(route.expected_latency) || 0,
        carrier: route.underlying_carrier,
        cable_system: route.cable_system,
        bandwidth: bandwidthValue, // Numeric value for calculations (200000 for Dark Fiber)
        bandwidthDisplay: bandwidthDisplay, // Display value ("Dark Fiber" or number)
        cost: parseFloat(route.cost)
      };
      
      routeSegments.push(segment);
      currentLocation = segment.to;
      totalLatency += segment.latency;
      
      if (!path.includes(segment.to)) {
        path.push(segment.to);
      }
    });
    
    return {
      path: path,
      route: routeSegments,
      totalLatency: totalLatency,
      hops: routes.length
    };
  };
  
  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };
  
  const formatLatency = (latency) => {
    return Math.round(latency * 1000) / 1000; // Round to 3 decimal places
  };
  
  const toggleLogExpansion = (logId) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };
  
  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all pricing logs? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      await networkDesignApi.clearChangeLogs('allocated_cost_calculator');
      setSuccess('Pricing logs cleared successfully');
      await loadAuditLogs();
    } catch (err) {
      setError(`Failed to clear logs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleExportOpen = () => {
    setExportDialogOpen(true);
  };
  
  const handleExportClose = () => {
    setExportDialogOpen(false);
    setExportOptions({
      primaryPricing: true,
      secondaryPricing: false,
      protectedPricing: false
    });
  };
  
  const handleExportOptionChange = (option) => {
    setExportOptions(prev => ({ ...prev, [option]: !prev[option] }));
  };
  
  const generateEmailBody = () => {
    let emailBody = `Network Design Results - Allocated Cost Calculator\n\n`;
    emailBody += `Customer Name: ${formData.customerName}\n`;
    emailBody += `Quote Request ID: ${formData.quoteRequestId}\n`;
    emailBody += `Source Location: ${formData.source}\n`;
    emailBody += `Destination Location: ${formData.destination}\n`;
    emailBody += `Bandwidth: ${formData.bandwidth} Mbps\n`;
    emailBody += `Quote Time & Date: ${new Date().toLocaleString()}\n\n`;
    
    // Helper function to generate route table
    const generateRouteTable = (pathData, pathType) => {
      if (!pathData || !pathData.route) return '';
      
      let table = `${pathType} Route:\n`;
      table += `Circuit ID\tRoute Segment\tLatency\tCarrier\tCable System\n`;
      table += `${'='.repeat(70)}\n`;
      
      pathData.route.forEach(segment => {
        table += `${segment.circuit_id || 'N/A'}\t${segment.from} → ${segment.to}\t${formatLatency(segment.latency)}ms\t${segment.carrier || 'N/A'}\t${segment.cable_system || 'N/A'}\n`;
      });
      
      table += `${'='.repeat(70)}\n`;
      table += `Total Latency: ${formatLatency(pathData.totalLatency)}ms\n\n`;
      
      return table;
    };
    
    // Helper function to format pricing
    const formatPricingSection = (pricing, pathType) => {
      let section = `${pathType} Pricing:\n`;
      section += `NRC: ${pricing.nrcCharge > 0 ? formatCurrency(pricing.nrcCharge, pricing.currency) : 'FREE'}\n`;
      section += `MRC (Minimum): ${formatCurrency(pricing.minimumPrice, pricing.currency)}\n`;
      section += `MRC (Suggested): ${formatCurrency(pricing.suggestedPrice, pricing.currency)}\n`;
      section += `Allocated Cost: ${formatCurrency(pricing.allocatedCost, pricing.currency)}\n`;
      section += `Currency: ${pricing.currency}\n`;
      section += `Contract Term: ${pricing.contractTerm} months\n\n`;
      return section;
    };
    
    // Add route and pricing data
    if (exportOptions.primaryPricing && searchResults.primaryPath) {
      const primaryResult = pricingResults.results.find(r => r.pathType === 'primary');
      if (primaryResult) {
        emailBody += generateRouteTable(searchResults.primaryPath, 'Primary');
        emailBody += formatPricingSection(primaryResult.pricing, 'Primary');
      }
    }
    
    if (exportOptions.secondaryPricing && searchResults.diversePath) {
      const secondaryResult = pricingResults.results.find(r => r.pathType === 'protection');
      if (secondaryResult) {
        emailBody += generateRouteTable(searchResults.diversePath, 'Secondary');
        emailBody += formatPricingSection(secondaryResult.pricing, 'Secondary');
      }
    }
    
    if (exportOptions.protectedPricing) {
      const protectedResult = pricingResults.results.find(r => r.pathType === 'protected');
      if (protectedResult) {
        emailBody += `\nProtected Service Pricing:\n`;
        emailBody += formatPricingSection(protectedResult.pricing, 'Protected');
      }
    }
    
    return emailBody;
  };
  
  const handleCopyToClipboard = () => {
    const emailBody = generateEmailBody();
    navigator.clipboard.writeText(emailBody).then(() => {
      setSuccess('Results copied to clipboard');
      handleExportClose();
    }).catch(err => {
      setError('Failed to copy to clipboard: ' + err.message);
    });
  };
  
  const handleDownloadText = () => {
    const emailBody = generateEmailBody();
    const blob = new Blob([emailBody], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `allocated_cost_pricing_${formData.quoteRequestId || 'quote'}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSuccess('Results downloaded');
    handleExportClose();
  };
  
  // Pricing Logs Filtering and Pagination Functions
  useEffect(() => {
    if (canViewPricingLogs) {
      loadAuditLogs();
    }
  }, [pagination.page, pagination.limit, selectedUser, customerNameFilter, logSearchTerm]);

  const handleCustomerNameFilterChange = (event) => {
    setCustomerNameFilter(event.target.value);
  };

  const handleUserFilterChange = (event) => {
    setSelectedUser(event.target.value);
    // Reset to page 1 when filter changes
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (event, newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (event) => {
    setPagination(prev => ({
      ...prev,
      limit: parseInt(event.target.value),
      page: 1 // Reset to first page when limit changes
    }));
  };

  const clearLogFilters = () => {
    setLogSearchTerm('');
    setCustomerNameFilter('');
    setSelectedUser('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };
  
  // Render component JSX
  return (
    <Box sx={{ width: '100%' }}>
      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab icon={<SearchIcon />} label="Allocated Cost Calculator" />
          {canViewPricingLogs && <Tab icon={<HistoryIcon />} label="Pricing Logs" />}
        </Tabs>
      </Box>
      
      {/* Calculator Tab */}
      <TabPanel value={currentTab} index={0}>
        {/* Input Form */}
        <Accordion expanded={expandedAccordion.input} onChange={() => toggleAccordion('input')}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SearchIcon sx={{ mr: 1 }} />
                <Typography variant="subtitle1" fontWeight="bold">Design Parameters</Typography>
              </Box>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent accordion from toggling
                  handleRefresh();
                }}
                sx={{ ml: 2 }}
              >
                Refresh
              </Button>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* Customer Name */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Customer Name"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                />
              </Grid>
              
              {/* Quote Request ID */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Quote Request ID"
                  value={formData.quoteRequestId}
                  onChange={(e) => handleInputChange('quoteRequestId', e.target.value)}
                />
              </Grid>
              
              {/* Source Location */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={locations}
                  getOptionLabel={(option) => `${option.location_code} - ${option.city}, ${option.country}`}
                  value={locations.find(loc => loc.location_code === formData.source) || null}
                  onChange={(event, newValue) => {
                    handleInputChange('source', newValue ? newValue.location_code : '');
                    // Re-validate routes when source changes
                    if (formData.primaryPathRoutes) {
                      validateRoutes(formData.primaryPathRoutes, newValue ? newValue.location_code : '', formData.destination, 'primary');
                    }
                    if (formData.secondaryPathRoutes) {
                      validateRoutes(formData.secondaryPathRoutes, newValue ? newValue.location_code : '', formData.destination, 'secondary');
                    }
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Source Location *" fullWidth />
                  )}
                />
              </Grid>
              
              {/* Destination Location */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={locations}
                  getOptionLabel={(option) => `${option.location_code} - ${option.city}, ${option.country}`}
                  value={locations.find(loc => loc.location_code === formData.destination) || null}
                  onChange={(event, newValue) => {
                    handleInputChange('destination', newValue ? newValue.location_code : '');
                    // Re-validate routes when destination changes
                    if (formData.primaryPathRoutes) {
                      validateRoutes(formData.primaryPathRoutes, formData.source, newValue ? newValue.location_code : '', 'primary');
                    }
                    if (formData.secondaryPathRoutes) {
                      validateRoutes(formData.secondaryPathRoutes, formData.source, newValue ? newValue.location_code : '', 'secondary');
                    }
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Destination Location *" fullWidth />
                  )}
                />
              </Grid>
              
              {/* Bandwidth */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Bandwidth (Mbps) *"
                  type="number"
                  value={formData.bandwidth}
                  onChange={(e) => handleInputChange('bandwidth', e.target.value)}
                  helperText="Enter bandwidth between 10 and 10000 Mbps"
                />
              </Grid>
              
              {/* Output Currency */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Output Currency</InputLabel>
                  <Select
                    value={formData.outputCurrency}
                    onChange={(e) => handleInputChange('outputCurrency', e.target.value)}
                    label="Output Currency"
                  >
                    {availableCurrencies.map(currency => (
                      <MenuItem key={currency} value={currency}>{currency}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Contract Term */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Contract Term</InputLabel>
                  <Select
                    value={formData.contractTerm}
                    onChange={(e) => handleInputChange('contractTerm', e.target.value)}
                    label="Contract Term"
                  >
                    <MenuItem value={12}>12 Months</MenuItem>
                    <MenuItem value={24}>24 Months</MenuItem>
                    <MenuItem value={36}>36 Months</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Pricing Type */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Pricing Type *</InputLabel>
                  <Select
                    value={formData.pricingType}
                    onChange={(e) => handleInputChange('pricingType', e.target.value)}
                    label="Pricing Type *"
                  >
                    <MenuItem value="primary">Primary Path Only</MenuItem>
                    <MenuItem value="primary_secondary">Primary & Secondary Paths</MenuItem>
                    <MenuItem value="protected">Protected Service</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Primary Path Routes */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Primary Path Routes *"
                  value={formData.primaryPathRoutes}
                  onChange={(e) => handleInputChange('primaryPathRoutes', e.target.value)}
                  helperText={primaryPathValidation.message || "Enter comma-separated circuit IDs (e.g., LONLON123456, LONSNG159222)"}
                  error={primaryPathValidation.message.includes('❌')}
                  multiline
                  rows={2}
                />
              </Grid>
              
              {/* Secondary Path Routes - shown if pricing type requires it */}
              {(formData.pricingType === 'primary_secondary' || formData.pricingType === 'protected') && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Secondary Path Routes *"
                    value={formData.secondaryPathRoutes}
                    onChange={(e) => handleInputChange('secondaryPathRoutes', e.target.value)}
                    helperText={secondaryPathValidation.message || "Enter comma-separated circuit IDs for secondary/protection path"}
                    error={secondaryPathValidation.message.includes('❌')}
                    multiline
                    rows={2}
                  />
                </Grid>
              )}
              
              {/* Calculate Button */}
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleCalculate}
                  disabled={loading || !primaryPathValidation.valid}
                  fullWidth
                  size="large"
                >
                  {loading ? <CircularProgress size={24} /> : 'Calculate Pricing'}
                </Button>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
        
        {/* Manual Incremental Costs (Optional) */}
        <Accordion expanded={expandedAccordion.incremental} onChange={() => toggleAccordion('incremental')} sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AttachMoneyIcon sx={{ mr: 1 }} />
              <Typography variant="subtitle1" fontWeight="bold">Manual Incremental Costs (Optional)</Typography>
              {incrementalCosts.length > 0 && (
                <Chip 
                  label={`${incrementalCosts.length} cost${incrementalCosts.length !== 1 ? 's' : ''}`} 
                  size="small" 
                  sx={{ ml: 2 }} 
                  color="primary"
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add manual incremental costs to be calculated into the overall pricing results. All fields are required.
              </Typography>
              
              {incrementalCosts.length > 0 ? (
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Cost Type</TableCell>
                        <TableCell>Source Location</TableCell>
                        <TableCell>Destination Location</TableCell>
                        <TableCell>Monthly Cost</TableCell>
                        <TableCell>Currency</TableCell>
                        <TableCell>Allocation Factor</TableCell>
                        <TableCell>Path</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {incrementalCosts.map((cost) => (
                        <>
                        <TableRow key={cost.id}>
                          {/* Cost Type */}
                          <TableCell>
                            <Box>
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', visibility: 'hidden' }}>
                                Placeholder
                              </Typography>
                              <FormControl fullWidth size="small">
                                <Select
                                  value={cost.costType}
                                  onChange={(e) => updateIncrementalCost(cost.id, 'costType', e.target.value)}
                                  disabled={cost.saved}
                                  sx={{ fontSize: '0.75rem' }}
                                >
                                  <MenuItem value="core_incremental_new" sx={{ fontSize: '0.75rem' }}>Core Incremental New</MenuItem>
                                  <MenuItem value="core_incremental_upgrade" sx={{ fontSize: '0.75rem' }}>Core Incremental Upgrade</MenuItem>
                                  <MenuItem value="aggregate_cost_a_end" sx={{ fontSize: '0.75rem' }}>Aggregate Cost A End</MenuItem>
                                  <MenuItem value="aggregate_cost_b_end" sx={{ fontSize: '0.75rem' }}>Aggregate Cost B End</MenuItem>
                                </Select>
                              </FormControl>
                            </Box>
                          </TableCell>
                          
                          {/* Source Location */}
                          <TableCell sx={{ minWidth: 150 }}>
                            <Box>
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', visibility: 'hidden' }}>
                                Placeholder
                              </Typography>
                              {cost.costType === 'core_incremental_upgrade' ? (
                                <TextField
                                  fullWidth
                                  size="small"
                                  value={cost.sourceLocation}
                                  disabled
                                  placeholder="Auto-filled"
                                  inputProps={{ style: { fontSize: '0.75rem' } }}
                                />
                              ) : cost.costType === 'core_incremental_new' ? (
                                <Autocomplete
                                  size="small"
                                  disabled={cost.saved}
                                  options={locations}
                                  getOptionLabel={(option) => option.location_code}
                                  value={locations.find(loc => loc.location_code === cost.sourceLocation) || null}
                                  onChange={(event, newValue) => {
                                    updateIncrementalCost(cost.id, 'sourceLocation', newValue ? newValue.location_code : '');
                                  }}
                                  renderInput={(params) => (
                                    <TextField {...params} placeholder="Select" inputProps={{ ...params.inputProps, style: { fontSize: '0.75rem' } }} />
                                  )}
                                  sx={{ minWidth: 150 }}
                                />
                              ) : (
                                <TextField
                                  fullWidth
                                  size="small"
                                  disabled={cost.saved}
                                  value={cost.sourceLocation}
                                  onChange={(e) => updateIncrementalCost(cost.id, 'sourceLocation', e.target.value)}
                                  placeholder="Enter location"
                                  inputProps={{ style: { fontSize: '0.75rem' } }}
                                />
                              )}
                            </Box>
                          </TableCell>
                          
                          {/* Destination Location */}
                          <TableCell sx={{ minWidth: 150 }}>
                            <Box>
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', visibility: 'hidden' }}>
                                Placeholder
                              </Typography>
                              {cost.costType === 'core_incremental_upgrade' ? (
                                <TextField
                                  fullWidth
                                  size="small"
                                  value={cost.destinationLocation}
                                  disabled
                                  placeholder="Auto-filled"
                                  inputProps={{ style: { fontSize: '0.75rem' } }}
                                />
                              ) : cost.costType === 'core_incremental_new' ? (
                                <Autocomplete
                                  size="small"
                                  disabled={cost.saved}
                                  options={locations}
                                  getOptionLabel={(option) => option.location_code}
                                  value={locations.find(loc => loc.location_code === cost.destinationLocation) || null}
                                  onChange={(event, newValue) => {
                                    updateIncrementalCost(cost.id, 'destinationLocation', newValue ? newValue.location_code : '');
                                  }}
                                  renderInput={(params) => (
                                    <TextField {...params} placeholder="Select" inputProps={{ ...params.inputProps, style: { fontSize: '0.75rem' } }} />
                                  )}
                                  sx={{ minWidth: 150 }}
                                />
                              ) : (
                                <TextField
                                  fullWidth
                                  size="small"
                                  disabled={cost.saved}
                                  value={cost.destinationLocation}
                                  onChange={(e) => updateIncrementalCost(cost.id, 'destinationLocation', e.target.value)}
                                  placeholder="Enter location"
                                  inputProps={{ style: { fontSize: '0.75rem' } }}
                                />
                              )}
                            </Box>
                          </TableCell>
                          
                          {/* Cost */}
                          <TableCell>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                                {cost.costType === 'core_incremental_new' ? 'Total Monthly Cost' :
                                 cost.costType === 'core_incremental_upgrade' ? 'Incremental Increase' :
                                 cost.costType === 'aggregate_cost_a_end' ? 'Total Monthly Cost' :
                                 cost.costType === 'aggregate_cost_b_end' ? 'Total Monthly Cost' :
                                 'Total Monthly Cost'}
                              </Typography>
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                disabled={cost.saved}
                                value={cost.incrementalCost}
                                onChange={(e) => updateIncrementalCost(cost.id, 'incrementalCost', e.target.value)}
                                placeholder="0"
                                inputProps={{ min: 0, max: 999999999, style: { fontSize: '0.75rem' } }}
                              />
                            </Box>
                          </TableCell>
                          
                          {/* Currency */}
                          <TableCell>
                            <Box>
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', visibility: 'hidden' }}>
                                Placeholder
                              </Typography>
                              <FormControl fullWidth size="small">
                                <Select
                                  value={cost.currency}
                                  onChange={(e) => updateIncrementalCost(cost.id, 'currency', e.target.value)}
                                  disabled={cost.saved}
                                  sx={{ fontSize: '0.75rem' }}
                                >
                                  {availableCurrencies.map(currency => (
                                    <MenuItem key={currency} value={currency} sx={{ fontSize: '0.75rem' }}>{currency}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Box>
                          </TableCell>
                          
                          {/* Allocation Factor */}
                          <TableCell>
                            <Box>
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', visibility: 'hidden' }}>
                                Placeholder
                              </Typography>
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                disabled={cost.saved}
                                value={cost.allocationFactor}
                                onChange={(e) => updateIncrementalCost(cost.id, 'allocationFactor', e.target.value)}
                                placeholder="0.0-1.0"
                                inputProps={{ min: 0, max: 1, step: 0.01, style: { fontSize: '0.75rem' } }}
                              />
                            </Box>
                          </TableCell>
                          
                          {/* Path Allocation */}
                          <TableCell>
                            <Box>
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', visibility: 'hidden' }}>
                                Placeholder
                              </Typography>
                              <FormControl fullWidth size="small">
                                <Select
                                  value={cost.pathAllocation}
                                  onChange={(e) => updateIncrementalCost(cost.id, 'pathAllocation', e.target.value)}
                                  disabled={cost.saved}
                                  sx={{ fontSize: '0.75rem' }}
                                >
                                  <MenuItem value="primary" sx={{ fontSize: '0.75rem' }}>Primary</MenuItem>
                                  <MenuItem value="secondary" sx={{ fontSize: '0.75rem' }}>Secondary</MenuItem>
                                </Select>
                              </FormControl>
                            </Box>
                          </TableCell>
                          
                          {/* Actions */}
                          <TableCell>
                            <Box>
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', visibility: 'hidden' }}>
                                Placeholder
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {!cost.saved ? (
                                  <>
                                    <Tooltip title="Save and lock configuration">
                                      <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={() => saveIncrementalCost(cost.id)}
                                      >
                                        <SaveIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => removeIncrementalCost(cost.id)}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                ) : (
                                  <>
                                    <Tooltip title="Edit configuration">
                                      <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={() => editIncrementalCost(cost.id)}
                                      >
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => removeIncrementalCost(cost.id)}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                        </TableRow>
                        
                        {/* Additional Row for Core Incremental Upgrade - Circuit Selection */}
                        {cost.costType === 'core_incremental_upgrade' && (
                          <TableRow key={`${cost.id}-circuit`}>
                            <TableCell colSpan={8} sx={{ bgcolor: '#f5f5f5' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Typography variant="body2" sx={{ minWidth: 120 }}>Select Circuit:</Typography>
                                <FormControl fullWidth size="small" sx={{ maxWidth: 400 }}>
                                  <Select
                                    value={cost.selectedCircuit}
                                    onChange={(e) => updateIncrementalCost(cost.id, 'selectedCircuit', e.target.value)}
                                    disabled={cost.saved}
                                    displayEmpty
                                    sx={{ fontSize: '0.75rem' }}
                                  >
                                    <MenuItem value="" sx={{ fontSize: '0.75rem' }}>
                                      <em>Select a circuit from {cost.pathAllocation} path routes</em>
                                    </MenuItem>
                                    {(cost.pathAllocation === 'primary' ? primaryPathValidation.routes : secondaryPathValidation.routes).map(route => (
                                      <MenuItem key={route.circuit_id} value={route.circuit_id} sx={{ fontSize: '0.75rem' }}>
                                        {route.circuit_id}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No manual incremental costs added. Click "Add Incremental Cost" to begin.
                </Alert>
              )}
              
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addIncrementalCost}
              >
                Add Incremental Cost
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>
        
        {/* Route Results */}
        {searchResults && (
          <Accordion expanded={expandedAccordion.results} onChange={() => toggleAccordion('results')} sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="subtitle1" fontWeight="bold">Route Details</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                {/* Primary Path - Full Width */}
                <Grid item xs={12}>
                  <Card>
                    <CardHeader 
                      title="Primary Path" 
                      subheader={`${searchResults.primaryPath.path.join(' → ')}`}
                    />
                    <CardContent>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Circuit ID</TableCell>
                              <TableCell>Segment</TableCell>
                              <TableCell>Latency</TableCell>
                              <TableCell>Bandwidth</TableCell>
                              <TableCell>Carrier</TableCell>
                              <TableCell>Cable System</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {searchResults.primaryPath.route?.map((segment, index) => (
                              <TableRow 
                                key={index}
                                sx={{ bgcolor: segment.isVirtual ? '#90EE90' : 'inherit' }}
                              >
                                <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                                <TableCell>{segment.from} → {segment.to}</TableCell>
                                <TableCell>{segment.isVirtual ? 'New' : `${formatLatency(segment.latency)}ms`}</TableCell>
                                <TableCell>{segment.bandwidthDisplay === 'Dark Fiber' ? 'Dark Fiber' : (segment.bandwidth || 'N/A')}</TableCell>
                                <TableCell>{segment.carrier || 'N/A'}</TableCell>
                                <TableCell>{segment.cable_system || 'N/A'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          <strong>Total Latency:</strong> {formatLatency(searchResults.primaryPath.totalLatency)}ms
                        </Typography>
                        <Typography variant="body2">
                          <strong>Total Hops:</strong> {searchResults.primaryPath.hops}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Secondary Path - Full Width */}
                {searchResults.diversePath && (
                  <Grid item xs={12}>
                    <Card>
                      <CardHeader 
                        title="Secondary Path" 
                        subheader={`${searchResults.diversePath.path.join(' → ')}`}
                      />
                      <CardContent>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Circuit ID</TableCell>
                                <TableCell>Segment</TableCell>
                                <TableCell>Latency</TableCell>
                                <TableCell>Bandwidth</TableCell>
                                <TableCell>Carrier</TableCell>
                                <TableCell>Cable System</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {searchResults.diversePath.route?.map((segment, index) => (
                                <TableRow 
                                  key={index}
                                  sx={{ bgcolor: segment.isVirtual ? '#90EE90' : 'inherit' }}
                                >
                                  <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                                  <TableCell>{segment.from} → {segment.to}</TableCell>
                                  <TableCell>{segment.isVirtual ? 'New' : `${formatLatency(segment.latency)}ms`}</TableCell>
                                  <TableCell>{segment.bandwidthDisplay === 'Dark Fiber' ? 'Dark Fiber' : (segment.bandwidth || 'N/A')}</TableCell>
                                  <TableCell>{segment.carrier || 'N/A'}</TableCell>
                                  <TableCell>{segment.cable_system || 'N/A'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2">
                            <strong>Total Latency:</strong> {formatLatency(searchResults.diversePath.totalLatency)}ms
                          </Typography>
                          <Typography variant="body2">
                            <strong>Total Hops:</strong> {searchResults.diversePath.hops}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}
        
        {/* Pricing Results */}
        {pricingResults && (
          <Accordion expanded={expandedAccordion.pricing} onChange={() => toggleAccordion('pricing')} sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AttachMoneyIcon sx={{ mr: 1 }} />
                <Typography variant="subtitle1" fontWeight="bold">Detailed Pricing Results</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {/* Export Button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<EmailIcon />}
                  onClick={handleExportOpen}
                  color="primary"
                >
                  Export Results
                </Button>
              </Box>
              
              {/* Summary Cards */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                {/* Show Primary and Secondary paths */}
                {pricingResults.results.filter(result => {
                  if (formData.pricingType === 'primary') {
                    return result.pathType === 'primary';
                  } else {
                    return result.pathType === 'primary' || result.pathType === 'protection';
                  }
                }).map((result, index) => (
                  <Grid item xs={12} md={formData.pricingType === 'primary' ? 6 : (formData.pricingType === 'protected' && pricingResults.protectionPricing ? 4 : 6)} key={`summary-${index}`}>
                    <Card sx={{ height: '100%', border: '2px solid', borderColor: 'primary.main' }}>
                      <CardHeader 
                        title={`${result.pathType === 'primary' ? 'Primary' : 'Secondary'} Path`}
                        subheader={`${formData.contractTerm}-Month Contract`}
                        sx={{ bgcolor: 'primary.50' }}
                      />
                      <CardContent>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" color="text.secondary">Minimum Price ({result.pricing.minimumMargin}% margin)</Typography>
                          <Typography variant="h5" color="error.main">
                                {formatCurrency(result.pricing.minimumPrice, result.pricing.currency)}
                              </Typography>
                        </Box>
                        <Divider sx={{ my: 2 }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary">Suggested Price ({result.pricing.suggestedMargin}% margin)</Typography>
                          <Typography variant="h5" color="success.main">
                                {formatCurrency(result.pricing.suggestedPrice, result.pricing.currency)}
                              </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                          </Grid>
                ))}
                
                {/* Show Protected Service Pricing when available */}
                {formData.pricingType === 'protected' && pricingResults.protectionPricing && (
                  <Grid item xs={12} md={4} key="summary-protected">
                    <Card sx={{ height: '100%', border: '2px solid', borderColor: 'success.main' }}>
                      <CardHeader 
                        title="Protected Service"
                        subheader={`${formData.contractTerm}-Month Contract`}
                        sx={{ bgcolor: 'success.50' }}
                      />
                      <CardContent>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" color="text.secondary">Minimum Price ({pricingResults.protectionPricing.minimumMargin}% margin)</Typography>
                          <Typography variant="h5" color="error.main">
                            {formatCurrency(pricingResults.protectionPricing.minimumPrice, pricingResults.protectionPricing.currency)}
                              </Typography>
                        </Box>
                        <Divider sx={{ my: 2 }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary">Suggested Price ({pricingResults.protectionPricing.suggestedMargin}% margin)</Typography>
                          <Typography variant="h5" color="success.main">
                            {formatCurrency(pricingResults.protectionPricing.suggestedPrice, pricingResults.protectionPricing.currency)}
                              </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
              
              {/* Detailed Breakdowns */}
              <Grid container spacing={3}>
                {pricingResults.results.map((result, index) => {
                  const detailedCalcs = result.pricing.detailedCalculations;
                  if (!detailedCalcs) return null;
                  
                  return (
                    <Grid item xs={12} key={`details-${index}`}>
                    <Accordion defaultExpanded>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          📊 {result.pathType === 'primary' ? 'Primary' : result.pathType === 'protection' ? 'Secondary' : 'Protected'} Path - Complete Calculation Breakdown
                        </Typography>
                      </AccordionSummary>
                        <AccordionDetails>
                          {/* Segment-by-Segment Breakdown */}
                          {detailedCalcs.allocatedCostBreakdown && (
                            <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
                              <Typography variant="subtitle1" gutterBottom color="primary" fontWeight="bold">
                                1️⃣ Allocated Cost Calculation (Segment-by-Segment)
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Customer Bandwidth: <strong>{formData.bandwidth} Mbps</strong>
                              </Typography>
                              
                              <TableContainer component={Paper} sx={{ mb: 2 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Circuit</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Route</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Carrier</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Segment BW</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Original Cost</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Utilization Factor</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Allocation Ratio</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Allocated Cost</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {detailedCalcs.allocatedCostBreakdown.segments.map((segment, idx) => (
                                      <TableRow key={idx} sx={{ 
                                        '&:nth-of-type(odd)': { bgcolor: segment.isIncrementalCost ? 'rgba(144, 238, 144, 0.2)' : 'action.hover' },
                                        bgcolor: segment.isIncrementalCost ? 'rgba(144, 238, 144, 0.15)' : 'inherit'
                                      }}>
                                        <TableCell sx={{ fontWeight: 'bold' }}>{segment.circuit}</TableCell>
                                        <TableCell sx={{ fontSize: '0.75rem' }}>{segment.location}</TableCell>
                                        <TableCell sx={{ fontSize: '0.75rem' }}>{segment.carrier}</TableCell>
                                        <TableCell>{segment.isIncrementalCost ? 'N/A' : `${segment.segmentBandwidth} Mbps`}</TableCell>
                                        <TableCell>
                                          {segment.originalCost.toFixed(2)} {segment.originalCurrency}
                                          {segment.originalCurrency !== formData.outputCurrency && (
                                            <Typography variant="caption" display="block" color="text.secondary">
                                              = {segment.convertedCost.toFixed(2)} {formData.outputCurrency}
                                            </Typography>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {segment.isIncrementalCost ? (
                                            <Typography variant="body2" color="text.secondary">N/A</Typography>
                                          ) : (
                                            <>
                                              {segment.utilizationFactor}
                                              <Typography variant="caption" display="block" color="text.secondary">
                                                ({segment.utilizationFactorType})
                                              </Typography>
                                            </>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {segment.isIncrementalCost ? (
                                            <Box sx={{ bgcolor: 'info.50', p: 1, borderRadius: 1 }}>
                                              <Typography variant="body2" fontWeight="bold">
                                                Allocation Factor: {segment.allocationFactor}
                                              </Typography>
                                            </Box>
                                          ) : (
                                            <Box sx={{ bgcolor: 'info.50', p: 1, borderRadius: 1 }}>
                                              <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace' }}>
                                                {segment.calculation}
                                              </Typography>
                                              <Typography variant="body2" fontWeight="bold">
                                                = {segment.allocationRatio.toFixed(6)}
                                              </Typography>
                                            </Box>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          <Box sx={{ bgcolor: 'success.50', p: 1, borderRadius: 1 }}>
                                            <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace' }}>
                                              {segment.allocatedCostCalculation}
                                            </Typography>
                                            <Typography variant="body2" fontWeight="bold" color="success.main">
                                              = {segment.allocatedCost.toFixed(2)} {formData.outputCurrency}
                                            </Typography>
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                    <TableRow sx={{ bgcolor: 'primary.light' }}>
                                      <TableCell colSpan={7} sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
                                        Total Allocated Cost:
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'primary.main' }}>
                                        {(() => {
                                          const total = detailedCalcs.allocatedCostBreakdown.segments.reduce((sum, segment) => {
                                            return sum + (parseFloat(segment.allocatedCost) || 0);
                                          }, 0);
                                          return formatCurrency(total, formData.outputCurrency);
                                        })()}
                                      </TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </TableContainer>
                              
                              {/* Allocation Without Utilization Factor */}
                              <Typography variant="subtitle1" gutterBottom color="secondary" fontWeight="bold" sx={{ mt: 3 }}>
                                Allocated Cost WITHOUT Utilization Factor (100% Utilization)
                              </Typography>
                              <TableContainer component={Paper} sx={{ mb: 2 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ bgcolor: 'secondary.main' }}>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Circuit</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Route</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Carrier</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Segment BW</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Original Cost</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Allocation Ratio (No Factor)</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Allocated Cost</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {detailedCalcs.allocatedCostBreakdown.segments.filter(segment => !segment.isIncrementalCost).map((segment, idx) => {
                                      const noFactorRatio = parseFloat(formData.bandwidth) / segment.segmentBandwidth;
                                      const noFactorCost = segment.convertedCost * noFactorRatio;
                                      return (
                                        <TableRow key={idx} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                                          <TableCell sx={{ fontWeight: 'bold' }}>{segment.circuit}</TableCell>
                                          <TableCell sx={{ fontSize: '0.75rem' }}>{segment.location}</TableCell>
                                          <TableCell sx={{ fontSize: '0.75rem' }}>{segment.carrier}</TableCell>
                                          <TableCell>{segment.segmentBandwidth} Mbps</TableCell>
                                          <TableCell>
                                            {segment.convertedCost.toFixed(2)} {formData.outputCurrency}
                                          </TableCell>
                                          <TableCell>
                                            <Box sx={{ bgcolor: 'info.50', p: 1, borderRadius: 1 }}>
                                              <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace' }}>
                                                {formData.bandwidth} / {segment.segmentBandwidth}
                                              </Typography>
                                              <Typography variant="body2" fontWeight="bold">
                                                = {noFactorRatio.toFixed(6)}
                                              </Typography>
                                            </Box>
                                          </TableCell>
                                          <TableCell>
                                            <Box sx={{ bgcolor: 'warning.50', p: 1, borderRadius: 1 }}>
                                              <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace' }}>
                                                {segment.convertedCost.toFixed(2)} × {noFactorRatio.toFixed(6)}
                                              </Typography>
                                              <Typography variant="body2" fontWeight="bold" color="warning.dark">
                                                = {noFactorCost.toFixed(2)} {formData.outputCurrency}
                                              </Typography>
                                            </Box>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                    <TableRow sx={{ bgcolor: 'secondary.light' }}>
                                      <TableCell colSpan={6} sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
                                        Total Allocated Cost (No Utilization Factor):
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'secondary.main' }}>
                                        {(() => {
                                          const bandwidth = parseFloat(formData.bandwidth);
                                          const total = detailedCalcs.allocatedCostBreakdown.segments.reduce((sum, segment) => {
                                            const segmentBw = parseFloat(segment.segmentBandwidth);
                                            const convertedCost = parseFloat(segment.convertedCost);
                                            if (isNaN(bandwidth) || isNaN(segmentBw) || isNaN(convertedCost)) {
                                              console.error('NaN detected:', { bandwidth, segmentBw, convertedCost });
                                              return sum;
                                            }
                                            return sum + (convertedCost * (bandwidth / segmentBw));
                                          }, 0);
                                          return formatCurrency(total, formData.outputCurrency);
                                        })()}
                                      </TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </Paper>
                          )}
                          
                          {/* Minimum Price Calculation */}
                          {detailedCalcs.minimumPriceBreakdown && (
                            <Paper sx={{ p: 3, mb: 3, bgcolor: 'error.50' }}>
                              <Typography variant="subtitle1" gutterBottom color="error.main" fontWeight="bold">
                                2️⃣ Minimum Price Calculation
                              </Typography>
                              
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1, mb: 2 }}>
                                <Typography variant="subtitle2" color="error.main" gutterBottom>Formula:</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                                  Minimum Price = Allocated Cost / (1 - Minimum Margin / 100)
                                </Typography>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="subtitle2" color="error.main" gutterBottom>Calculation:</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {detailedCalcs.minimumPriceBreakdown.calculation}
                                </Typography>
                                <Typography variant="body1" color="error.main" fontWeight="bold" sx={{ mt: 1 }}>
                                  = {formatCurrency(detailedCalcs.minimumPriceBreakdown.calculatedPrice, formData.outputCurrency)}
                                </Typography>
                              </Box>
                              
                              {detailedCalcs.minimumPriceBreakdown.locationMinimumCheck && (
                                <Alert severity="warning">
                                  <Typography variant="body2">
                                    <strong>Location Minimum Price Check:</strong><br/>
                                    {detailedCalcs.minimumPriceBreakdown.locationMinimumCheck.explanation}<br/>
                                    Location Minimum: {formatCurrency(detailedCalcs.minimumPriceBreakdown.locationMinimumCheck.locationMinimum, formData.outputCurrency)}<br/>
                                    {detailedCalcs.minimumPriceBreakdown.locationMinimumCheck.used ? 
                                      '✅ Location minimum enforced' : 
                                      '❌ Calculated price already exceeds location minimum'}
                                  </Typography>
                                </Alert>
                              )}
                              
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1, mt: 2, border: '2px solid', borderColor: 'error.main' }}>
                                <Typography variant="subtitle2" color="error.main" gutterBottom>Final Minimum Price (Rounded to nearest $10):</Typography>
                                <Typography variant="h5" color="error.main">
                                  {formatCurrency(result.pricing.minimumPrice, formData.outputCurrency)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Minimum Margin: {result.pricing.minimumMargin}%
                                </Typography>
                              </Box>
                            </Paper>
                          )}
                          
                          {/* Suggested Price Calculation */}
                          {detailedCalcs.suggestedPriceBreakdown && (
                            <Paper sx={{ p: 3, mb: 3, bgcolor: 'success.50' }}>
                              <Typography variant="subtitle1" gutterBottom color="success.main" fontWeight="bold">
                                3️⃣ Suggested Price Calculation
                              </Typography>
                              
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1, mb: 2 }}>
                                <Typography variant="subtitle2" color="success.main" gutterBottom>Formula:</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                                  Suggested Price = Allocated Cost / (1 - Suggested Margin / 100)
                                </Typography>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="subtitle2" color="success.main" gutterBottom>Calculation:</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {detailedCalcs.suggestedPriceBreakdown.calculation}
                                </Typography>
                                <Typography variant="body1" color="success.main" fontWeight="bold" sx={{ mt: 1 }}>
                                  = {formatCurrency(detailedCalcs.suggestedPriceBreakdown.calculatedPrice, formData.outputCurrency)}
                                </Typography>
                              </Box>
                              
                              {detailedCalcs.suggestedPriceBreakdown.locationMinimumCheck && (
                                <Alert severity="info">
                                  <Typography variant="body2">
                                    <strong>Location Minimum Price Check:</strong><br/>
                                    {detailedCalcs.suggestedPriceBreakdown.locationMinimumCheck.explanation}<br/>
                                    Location Minimum: {formatCurrency(detailedCalcs.suggestedPriceBreakdown.locationMinimumCheck.locationMinimum, formData.outputCurrency)}<br/>
                                    {detailedCalcs.suggestedPriceBreakdown.locationMinimumCheck.used ? 
                                      '✅ Location minimum enforced' : 
                                      '❌ Calculated price already exceeds location minimum'}
                                  </Typography>
                                </Alert>
                              )}
                              
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1, mt: 2, border: '2px solid', borderColor: 'success.main' }}>
                                <Typography variant="subtitle2" color="success.main" gutterBottom>Final Suggested Price (Rounded to nearest $10):</Typography>
                                <Typography variant="h5" color="success.main">
                                  {formatCurrency(result.pricing.suggestedPrice, formData.outputCurrency)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Suggested Margin: {result.pricing.suggestedMargin}%
                                </Typography>
                              </Box>
                            </Paper>
                          )}
                          
                          {/* Protected Service Special Calculation */}
                          {result.pathType === 'protected' && detailedCalcs.protectionBreakdown && (
                            <Paper sx={{ p: 3, mb: 3, bgcolor: 'warning.50', border: '3px solid', borderColor: 'warning.main' }}>
                              <Typography variant="subtitle1" gutterBottom color="warning.main" fontWeight="bold">
                                🛡️ Protected Service Calculation
                              </Typography>
                              
                              <Alert severity="info" sx={{ mb: 2 }}>
                                Protected service pricing uses a 70% weight for the secondary path, reflecting its standby nature.
                              </Alert>
                              
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1, mb: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>Allocated Cost Formula:</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {detailedCalcs.protectionBreakdown.allocatedCostFormula}
                                </Typography>
                                <Typography variant="body1" color="primary" fontWeight="bold" sx={{ mt: 1 }}>
                                  = {formatCurrency(detailedCalcs.protectionBreakdown.allocatedCostCalculation, formData.outputCurrency)}
                                </Typography>
                              </Box>
                              
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1, mb: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>Minimum Price Formula:</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {detailedCalcs.protectionBreakdown.minimumPriceFormula}
                                </Typography>
                                <Typography variant="body1" color="error.main" fontWeight="bold" sx={{ mt: 1 }}>
                                  = {formatCurrency(detailedCalcs.protectionBreakdown.minimumPriceCalculation, formData.outputCurrency)}
                                </Typography>
                              </Box>
                              
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1, mb: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>Suggested Price Formula:</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {detailedCalcs.protectionBreakdown.suggestedPriceFormula}
                                </Typography>
                                <Typography variant="body1" color="success.main" fontWeight="bold" sx={{ mt: 1 }}>
                                  = {formatCurrency(detailedCalcs.protectionBreakdown.suggestedPriceCalculation, formData.outputCurrency)}
                                </Typography>
                              </Box>
                              
                              {detailedCalcs.protectionBreakdown.nrcCharge && (
                                <Alert severity="warning" sx={{ mt: 2 }}>
                                  <Typography variant="body2">
                                    <strong>NRC Charge:</strong> {detailedCalcs.protectionBreakdown.nrcCharge.description}<br/>
                                    Amount: {detailedCalcs.protectionBreakdown.nrcCharge.calculation}
                                  </Typography>
                                </Alert>
                              )}
                            </Paper>
                          )}
                        </AccordionDetails>
                      </Accordion>
                          </Grid>
                  );
                })}
                
                {/* Protected Service Detailed Breakdown */}
                {formData.pricingType === 'protected' && pricingResults.protectionPricing && pricingResults.protectionPricing.detailedCalculations && (
                  <Grid item xs={12} key="details-protected">
                    <Accordion defaultExpanded>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          📊 🛡️ Protected Service - Complete Calculation Breakdown
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        {pricingResults.protectionPricing.detailedCalculations && (
                          <Paper sx={{ p: 3, mb: 3, bgcolor: 'warning.50', border: '3px solid', borderColor: 'warning.main' }}>
                            <Typography variant="subtitle1" gutterBottom color="warning.main" fontWeight="bold">
                              🛡️ Protected Service Calculation
                            </Typography>
                            
                            <Alert severity="info" sx={{ mb: 2 }}>
                              Protected service pricing uses a 70% weight for the secondary path, reflecting its standby nature.
                            </Alert>
                            
                            {/* Allocated Cost Breakdown */}
                            {pricingResults.protectionPricing.detailedCalculations.allocatedCostBreakdown && (
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1, mb: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>Allocated Cost Formula:</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {pricingResults.protectionPricing.detailedCalculations.allocatedCostBreakdown.formula}
                                </Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {pricingResults.protectionPricing.detailedCalculations.allocatedCostBreakdown.calculation}
                                </Typography>
                                <Typography variant="body1" color="primary" fontWeight="bold" sx={{ mt: 1 }}>
                                  Final: {formatCurrency(pricingResults.protectionPricing.allocatedCost, formData.outputCurrency)}
                                </Typography>
                              </Box>
                            )}
                            
                            {/* Minimum Price Breakdown */}
                            {pricingResults.protectionPricing.detailedCalculations.minimumPriceBreakdown && (
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1, mb: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>Minimum Price Formula:</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {pricingResults.protectionPricing.detailedCalculations.minimumPriceBreakdown.formula}
                                </Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {pricingResults.protectionPricing.detailedCalculations.minimumPriceBreakdown.calculation}
                                </Typography>
                                <Typography variant="body1" color="error.main" fontWeight="bold" sx={{ mt: 1 }}>
                                  Final: {formatCurrency(pricingResults.protectionPricing.minimumPrice, formData.outputCurrency)}
                                </Typography>
                              </Box>
                            )}
                            
                            {/* Suggested Price Breakdown */}
                            {pricingResults.protectionPricing.detailedCalculations.suggestedPriceBreakdown && (
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1, mb: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>Suggested Price Formula:</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {pricingResults.protectionPricing.detailedCalculations.suggestedPriceBreakdown.formula}
                                </Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {pricingResults.protectionPricing.detailedCalculations.suggestedPriceBreakdown.calculation}
                                </Typography>
                                <Typography variant="body1" color="success.main" fontWeight="bold" sx={{ mt: 1 }}>
                                  Final: {formatCurrency(pricingResults.protectionPricing.suggestedPrice, formData.outputCurrency)}
                                </Typography>
                              </Box>
                            )}
                            
                            {/* Margin Verification */}
                            {pricingResults.protectionPricing.detailedCalculations.marginVerification && (
                              <Box sx={{ bgcolor: 'info.50', p: 2, borderRadius: 1, mt: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>Margin Verification:</Typography>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                  <strong>Minimum Margin:</strong> {pricingResults.protectionPricing.minimumMargin}%
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace', mb: 2 }}>
                                  {pricingResults.protectionPricing.detailedCalculations.marginVerification.actualMinMarginFormula}
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                  <strong>Suggested Margin:</strong> {pricingResults.protectionPricing.suggestedMargin}%
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace' }}>
                                  {pricingResults.protectionPricing.detailedCalculations.marginVerification.actualSuggestedMarginFormula}
                                </Typography>
                              </Box>
                            )}
                          </Paper>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  </Grid>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}
        
        {/* Notifications - Only show in Calculator Tab */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mt: 2 }}>
            {success}
          </Alert>
        )}
      </TabPanel>
      
      {/* Pricing Logs Tab */}
      {canViewPricingLogs && (
        <TabPanel value={currentTab} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Allocated Cost Pricing Logs</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {pagination.total > 0 && (
                <Chip 
                  label={`Showing ${auditLogs.length} of ${pagination.total} entries (Page ${pagination.page}/${pagination.totalPages})`} 
                  color="info" 
                  size="small"
                />
              )}
              {canManageLogs && (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={handleClearLogs}
                  startIcon={<DeleteIcon />}
                >
                  Clear Logs
                </Button>
              )}
            </Box>
          </Box>

          {/* Search and Filter Controls */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                {/* User Filter - Only for admin/provisioner */}
                {usersList.length > 0 && (
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      select
                      size="small"
                      label="User"
                      value={selectedUser}
                      onChange={handleUserFilterChange}
                    >
                      <MenuItem value="">All Users</MenuItem>
                      {usersList.map(user => (
                        <MenuItem key={user.id} value={user.id}>
                          {user.username}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                )}
                
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Customer Name"
                    value={customerNameFilter}
                    onChange={handleCustomerNameFilterChange}
                    placeholder="Search customer name..."
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search Quote Request ID"
                    value={logSearchTerm}
                    onChange={(e) => setLogSearchTerm(e.target.value)}
                    placeholder="Enter Quote Request ID..."
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    label="Rows per page"
                    value={pagination.limit}
                    onChange={handleLimitChange}
                  >
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                    <MenuItem value={200}>200</MenuItem>
                  </TextField>
                </Grid>
                
                <Grid item xs={12} md={1}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    onClick={clearLogFilters}
                    startIcon={<DeleteIcon />}
                  >
                    Clear
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
          
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Timestamp</strong></TableCell>
                  <TableCell><strong>User</strong></TableCell>
                  <TableCell><strong>Action</strong></TableCell>
                  <TableCell><strong>Customer Name</strong></TableCell>
                  <TableCell><strong>Quote Request ID</strong></TableCell>
                  <TableCell><strong>Request Summary</strong></TableCell>
                  <TableCell align="center" sx={{ width: 150 }}><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <TableRow>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {log.username || log.user_name || 'Unknown User'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={log.action || 'PRICING_CALCULATION'} 
                          color="secondary" 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {(() => {
                            try {
                              const data = log.new_values ? JSON.parse(log.new_values) : null;
                              return data?.inputParameters?.customerName || data?.customerName || data?.customer_name || 'N/A';
                            } catch {
                              return 'N/A';
                            }
                          })()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {(() => {
                            try {
                              const data = log.new_values ? JSON.parse(log.new_values) : null;
                              return data?.inputParameters?.quoteRequestId || data?.quoteRequestId || data?.quote_request_id || 'N/A';
                            } catch {
                              return 'N/A';
                            }
                          })()}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 400 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {log.changes_summary || 'Allocated Cost Pricing Calculation'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ width: 150 }}>
                        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', alignItems: 'center' }}>
                          {/* View Details - available for all users */}
                          <Button
                            variant="outlined"
                            size="small"
                            fullWidth
                            onClick={() => toggleLogExpansion(log.id)}
                          >
                            {expandedLogs.has(log.id) ? 'Hide Details' : 'View Details'}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                    {expandedLogs.has(log.id) && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ backgroundColor: '#f8f9fa', border: 'none' }}>
                          <Box sx={{ p: 2 }}>
                            <Grid container spacing={2}>
                              <Grid item xs={12}>
                                <Typography variant="subtitle2" gutterBottom>
                                  <strong>Complete Log Data:</strong>
                                </Typography>
                                <Box 
                                  component="pre" 
                                  sx={{ 
                                    fontSize: '0.75rem', 
                                    fontFamily: 'Courier New, monospace',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    maxHeight: '400px',
                                    overflow: 'auto',
                                    backgroundColor: '#f5f5f5',
                                    padding: 2,
                                    borderRadius: 1,
                                    border: '1px solid #ddd'
                                  }}
                                >
                                  {log.new_values ? JSON.stringify(JSON.parse(log.new_values), null, 2) : 'No data available'}
                                </Box>
                              </Grid>
                            </Grid>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Pagination Controls */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination 
              count={pagination.totalPages} 
              page={pagination.page} 
              onChange={handlePageChange} 
              color="primary"
              showFirstButton
              showLastButton
              size="large"
            />
          </Box>
        </TabPanel>
      )}
      
      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={handleExportClose} maxWidth="sm" fullWidth>
        <DialogTitle>Export Pricing Results</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Select which pricing results to include in the export:
          </Typography>
          <Box sx={{ mt: 2 }}>
            {searchResults?.primaryPath && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportOptions.primaryPricing}
                    onChange={() => handleExportOptionChange('primaryPricing')}
                  />
                }
                label="Primary Path Pricing"
              />
            )}
            {searchResults?.diversePath && (
              <>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={exportOptions.secondaryPricing}
                      onChange={() => handleExportOptionChange('secondaryPricing')}
                    />
                  }
                  label="Secondary Path Pricing"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={exportOptions.protectedPricing}
                      onChange={() => handleExportOptionChange('protectedPricing')}
                    />
                  }
                  label="Protected Service Pricing"
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleExportClose}>Cancel</Button>
          <Button onClick={handleCopyToClipboard} startIcon={<ContentCopyIcon />}>
            Copy to Clipboard
          </Button>
          <Button onClick={handleDownloadText} startIcon={<FileDownloadIcon />} variant="contained">
            Download as Text
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AllocatedCostCalculator;
