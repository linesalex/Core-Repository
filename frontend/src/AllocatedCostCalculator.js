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
  const [logViewModes, setLogViewModes] = useState({}); // Track view mode per log: { logId: 'readable' | 'json' }
  
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
  
  // Track if initial data has been loaded to prevent double-load
  const initialLoadComplete = React.useRef(false);
  
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
      
      // Mark initial load as complete to prevent duplicate loads from useEffect
      initialLoadComplete.current = true;
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError(`Failed to load data: ${err.message}`);
      initialLoadComplete.current = true; // Still mark complete on error to prevent loop
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
          totalPages: response.pagination.totalPages,
          page: response.pagination.page || prev.page // Ensure page is synced with server
        }));
      } else {
        // Fallback for old format
        const logs = Array.isArray(response) ? response : [];
        setAuditLogs(logs);
        // Reset pagination to avoid stale state
        setPagination(prev => ({
          ...prev,
          total: logs.length,
          totalPages: Math.max(1, Math.ceil(logs.length / prev.limit)),
          page: 1
        }));
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
      newBandwidth: '', // For Core Incremental New/Upgrade (replaces allocationFactor)
      allocationFactor: '', // Keep for Aggregate Cost A/B End
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
    
    // Validate required fields based on cost type
    if (!cost.sourceLocation || !cost.destinationLocation || !cost.incrementalCost || !cost.currency) {
      setError('Please fill in all required fields before saving');
      return;
    }
    
    // For Core Incremental New/Upgrade: validate newBandwidth
    if (cost.costType === 'core_incremental_new' || cost.costType === 'core_incremental_upgrade') {
      if (!cost.newBandwidth || cost.newBandwidth === '') {
        setError('Please enter New Bandwidth before saving');
        return;
      }
      
      // Validate bandwidth format (must be a number or "Dark Fiber")
      const isDarkFiber = cost.newBandwidth.toString().toLowerCase().trim() === 'dark fiber';
      const isNumeric = !isNaN(parseFloat(cost.newBandwidth)) && parseFloat(cost.newBandwidth) > 0;
      
      if (!isDarkFiber && !isNumeric) {
        setError('New Bandwidth must be a positive number (Mbps) or "Dark Fiber"');
        return;
      }
      
      // For Core Incremental Upgrade: validate new bandwidth > current bandwidth
      if (cost.costType === 'core_incremental_upgrade' && cost.selectedCircuit && !isDarkFiber) {
        const validation = cost.pathAllocation === 'primary' ? primaryPathValidation : secondaryPathValidation;
        const selectedRoute = validation.routes.find(r => r.circuit_id === cost.selectedCircuit);
        
        if (selectedRoute) {
          let currentBandwidth;
          if (selectedRoute.bandwidth && typeof selectedRoute.bandwidth === 'string' && 
              selectedRoute.bandwidth.toLowerCase().includes('dark fiber')) {
            currentBandwidth = 200000; // Dark Fiber = 200000 Mbps
          } else {
            currentBandwidth = parseFloat(selectedRoute.bandwidth) || 0;
          }
          
          const newBandwidthValue = parseFloat(cost.newBandwidth);
          if (newBandwidthValue <= currentBandwidth) {
            setError(`New Bandwidth (${newBandwidthValue} Mbps) must be greater than current bandwidth (${currentBandwidth} Mbps)`);
            return;
          }
        }
      }
    }
    
    // For Aggregate Cost A/B End: validate allocationFactor
    if ((cost.costType === 'aggregate_cost_a_end' || cost.costType === 'aggregate_cost_b_end') &&
        (cost.allocationFactor === '' || cost.allocationFactor === null)) {
      setError('Please enter Allocation Factor before saving');
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
      
      // Validate based on cost type
      if (cost.costType === 'core_incremental_new' || cost.costType === 'core_incremental_upgrade') {
        // Validate newBandwidth for New/Upgrade
        if (cost.newBandwidth === '' || cost.newBandwidth === null || cost.newBandwidth === undefined) {
          errors.push(`Cost ${costNum}: New Bandwidth is required`);
        } else {
          // Validate bandwidth format
          const isDarkFiber = cost.newBandwidth.toString().toLowerCase().trim() === 'dark fiber';
          const isNumeric = !isNaN(parseFloat(cost.newBandwidth)) && parseFloat(cost.newBandwidth) > 0;
          
          if (!isDarkFiber && !isNumeric) {
            errors.push(`Cost ${costNum}: New Bandwidth must be a positive number (Mbps) or "Dark Fiber"`);
          }
        }
      } else {
        // Validate allocationFactor for Aggregate Cost A/B End
        if (cost.allocationFactor === '' || cost.allocationFactor === null || cost.allocationFactor === undefined) {
          errors.push(`Cost ${costNum}: Allocation Factor is required`);
        } else {
          // Check allocation factor range (0 to 1)
          const allocationValue = parseFloat(cost.allocationFactor);
          if (!isNaN(allocationValue) && (allocationValue < 0 || allocationValue > 1)) {
            errors.push(`Cost ${costNum}: Allocation Factor must be between 0.0 and 1.0`);
          }
        }
      }
      
      // Check cost range (0 to 999,999,999)
      const costValue = parseFloat(cost.incrementalCost);
      if (!isNaN(costValue) && (costValue < 0 || costValue > 999999999)) {
        errors.push(`Cost ${costNum}: Incremental Cost must be between 0 and 999,999,999`);
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
    
    // Build bidirectional adjacency list (routes work in both directions)
    const graph = {};
    segments.forEach(seg => {
      // Add forward direction
      if (!graph[seg.from]) graph[seg.from] = [];
      graph[seg.from].push(seg.to);
      
      // Add reverse direction (routes are bidirectional)
      if (!graph[seg.to]) graph[seg.to] = [];
      graph[seg.to].push(seg.from);
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
      const primaryPath = buildPathData(primaryPathValidation.routes, formData.source, formData.destination, 'primary');
      const paths = [primaryPath];
      
      let secondaryPath = null;
      if (formData.pricingType !== 'primary' && secondaryPathValidation.routes.length > 0) {
        secondaryPath = buildPathData(secondaryPathValidation.routes, formData.source, formData.destination, 'secondary');
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
      
      const pricing = await networkDesignApi.calculatePricing(pricingParams);
      
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
  const buildPathData = (routes, source, destination, pathType = 'primary') => {
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
        
        // Find the corresponding incremental cost to get bandwidth
        const correspondingCost = incrementalCosts.find(cost => 
          cost.costType === 'core_incremental_new' &&
          cost.sourceLocation === currentLocation &&
          cost.destinationLocation === nextLocation &&
          cost.pathAllocation === pathType
        );
        
        let bandwidthValue = 0;
        let bandwidthDisplay = 'N/A';
        
        if (correspondingCost && correspondingCost.newBandwidth) {
          const isDarkFiber = correspondingCost.newBandwidth.toString().toLowerCase().trim() === 'dark fiber';
          if (isDarkFiber) {
            bandwidthValue = 200000;
            bandwidthDisplay = 'Dark Fiber';
          } else {
            bandwidthValue = parseFloat(correspondingCost.newBandwidth) || 0;
            bandwidthDisplay = bandwidthValue;
          }
        }
        
        // Add virtual segment for display
        routeSegments.push({
          circuit_id: 'New Core Circuit',
          from: currentLocation,
          to: nextLocation,
          latency: 0,
          carrier: 'New',
          cable_system: 'N/A',
          bandwidth: bandwidthValue,
          bandwidthDisplay: bandwidthDisplay,
          cost: 0,
          isVirtual: true
        });
        
        currentLocation = nextLocation;
        if (!path.includes(nextLocation)) {
          path.push(nextLocation);
        }
        return; // Skip to next route
      }
      
      // Regular circuit - check if it's being upgraded
      const upgradeForThisCircuit = incrementalCosts.find(cost => 
        cost.costType === 'core_incremental_upgrade' &&
        cost.selectedCircuit === route.circuit_id &&
        cost.pathAllocation === pathType
      );
      
      // Handle Dark Fiber bandwidth
      let bandwidthValue;
      let bandwidthDisplay;
      let isUpgraded = false;
      
      if (upgradeForThisCircuit && upgradeForThisCircuit.newBandwidth) {
        // This circuit is being upgraded - use new bandwidth
        isUpgraded = true;
        const isDarkFiber = upgradeForThisCircuit.newBandwidth.toString().toLowerCase().trim() === 'dark fiber';
        if (isDarkFiber) {
          bandwidthValue = 200000;
          bandwidthDisplay = 'Dark Fiber';
        } else {
          bandwidthValue = parseFloat(upgradeForThisCircuit.newBandwidth) || 0;
          bandwidthDisplay = bandwidthValue;
        }
      } else if (route.bandwidth && typeof route.bandwidth === 'string' && route.bandwidth.toLowerCase().includes('dark fiber')) {
        // Dark Fiber: use 200000 Mbps for calculations, preserve "Dark Fiber" for display
        bandwidthValue = 200000;
        bandwidthDisplay = 'Dark Fiber';
      } else {
        // Regular bandwidth: parse numeric value
        bandwidthValue = parseFloat(route.bandwidth) || 0;
        bandwidthDisplay = bandwidthValue;
      }
      
      const segment = {
        circuit_id: route.circuit_id, // Keep original circuit_id for backend
        circuit_id_display: isUpgraded ? `${route.circuit_id} (Upgrade)` : route.circuit_id, // Display version
        from: currentLocation,
        to: route.location_a === currentLocation ? route.location_b : route.location_a,
        latency: parseFloat(route.expected_latency) || 0,
        carrier: route.underlying_carrier,
        cable_system: route.cable_system,
        bandwidth: bandwidthValue, // Numeric value for calculations (200000 for Dark Fiber)
        bandwidthDisplay: bandwidthDisplay, // Display value ("Dark Fiber" or number)
        cost: parseFloat(route.cost),
        isUpgraded: isUpgraded
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

  // Get view mode for a log (default to 'readable')
  const getLogViewMode = (logId) => {
    return logViewModes[logId] || 'readable';
  };

  // Set view mode for a log
  const setLogViewMode = (logId, mode) => {
    setLogViewModes(prev => ({ ...prev, [logId]: mode }));
  };

  // Render human-readable log details for Allocated Cost Calculator
  const renderHumanReadableLogDetails = (log) => {
    let logData;
    try {
      logData = log.new_values ? JSON.parse(log.new_values) : null;
    } catch (e) {
      return <Alert severity="error">Unable to parse log data</Alert>;
    }

    if (!logData) {
      return <Alert severity="info">No data available for this log</Alert>;
    }

    const params = logData.inputParameters || logData;
    const results = logData.calculationResults || logData.results;

    // Extract path data
    const primaryPath = results?.searchResults?.primaryPath || logData.searchResults?.primaryPath;
    const diversePath = results?.searchResults?.diversePath || logData.searchResults?.diversePath;
    const pricingResults = results?.individual || results?.results;
    // Protection pricing is stored at results.protection (not results.protection.pricing)
    const protectionPricing = results?.protection;
    
    // Determine pricing type from params
    const pricingType = params?.protection_required ? 'protected' : 
                        (diversePath ? 'primary_secondary' : 'primary');

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Input Parameters Summary */}
        {params && (
          <Card variant="outlined">
            <CardHeader 
              title="Request Parameters" 
              sx={{ pb: 1, '& .MuiCardHeader-title': { fontSize: '1rem', fontWeight: 600 } }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Customer</Typography>
                  <Typography variant="body2" fontWeight="500">{params.customerName || params.customer_name || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Quote ID</Typography>
                  <Typography variant="body2" fontWeight="500">{params.quoteRequestId || params.quote_request_id || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Route</Typography>
                  <Typography variant="body2" fontWeight="500">{params.source} → {params.destination}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Bandwidth</Typography>
                  <Typography variant="body2" fontWeight="500">{params.bandwidth} Mbps</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Contract Term</Typography>
                  <Typography variant="body2" fontWeight="500">{params.contract_term || params.contractTerm || 12} months</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Currency</Typography>
                  <Typography variant="body2" fontWeight="500">{params.output_currency || params.outputCurrency || 'USD'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Pricing Type</Typography>
                  <Typography variant="body2" fontWeight="500">
                    {pricingType === 'protected' ? 'Protected' : 
                     pricingType === 'primary_secondary' ? 'Primary + Secondary' : 'Primary'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Primary Path Route Table */}
        {primaryPath && primaryPath.route && (
          <Card variant="outlined">
            <CardHeader 
              title="Primary Path" 
              subheader={primaryPath.path ? primaryPath.path.join(' → ') : ''}
              sx={{ pb: 1, '& .MuiCardHeader-title': { fontSize: '1rem', fontWeight: 600 } }}
            />
            <CardContent sx={{ pt: 0 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell><strong>Circuit ID</strong></TableCell>
                      <TableCell><strong>Segment</strong></TableCell>
                      <TableCell><strong>Latency</strong></TableCell>
                      <TableCell><strong>Bandwidth</strong></TableCell>
                      <TableCell><strong>Carrier</strong></TableCell>
                      <TableCell><strong>Cable System</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {primaryPath.route.map((segment, index) => (
                      <TableRow 
                        key={index}
                        sx={{ bgcolor: (segment.isVirtual || segment.isUpgraded) ? '#90EE90' : 'inherit' }}
                      >
                        <TableCell>{segment.circuit_id_display || segment.circuit_id || 'N/A'}</TableCell>
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
              <Box sx={{ mt: 1.5, display: 'flex', gap: 3 }}>
                <Typography variant="body2"><strong>Total Latency:</strong> {formatLatency(primaryPath.totalLatency)}ms</Typography>
                <Typography variant="body2"><strong>Hops:</strong> {primaryPath.hops || primaryPath.route?.length}</Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Secondary/Diverse Path Route Table */}
        {diversePath && diversePath.route && (
          <Card variant="outlined">
            <CardHeader 
              title="Secondary Path" 
              subheader={diversePath.path ? diversePath.path.join(' → ') : ''}
              sx={{ pb: 1, '& .MuiCardHeader-title': { fontSize: '1rem', fontWeight: 600 } }}
            />
            <CardContent sx={{ pt: 0 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell><strong>Circuit ID</strong></TableCell>
                      <TableCell><strong>Segment</strong></TableCell>
                      <TableCell><strong>Latency</strong></TableCell>
                      <TableCell><strong>Bandwidth</strong></TableCell>
                      <TableCell><strong>Carrier</strong></TableCell>
                      <TableCell><strong>Cable System</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {diversePath.route.map((segment, index) => (
                      <TableRow 
                        key={index}
                        sx={{ bgcolor: (segment.isVirtual || segment.isUpgraded) ? '#90EE90' : 'inherit' }}
                      >
                        <TableCell>{segment.circuit_id_display || segment.circuit_id || 'N/A'}</TableCell>
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
              <Box sx={{ mt: 1.5, display: 'flex', gap: 3 }}>
                <Typography variant="body2"><strong>Total Latency:</strong> {formatLatency(diversePath.totalLatency)}ms</Typography>
                <Typography variant="body2"><strong>Hops:</strong> {diversePath.hops || diversePath.route?.length}</Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Pricing Summary Cards */}
        {pricingResults && pricingResults.length > 0 && (
          <Box>
            <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 2 }}>Pricing Results</Typography>
            <Grid container spacing={2}>
              {pricingResults.map((result, index) => {
                const pricing = result.pricing;
                if (!pricing) return null;
                
                return (
                  <Grid item xs={12} md={4} key={index}>
                    <Card sx={{ height: '100%', bgcolor: result.pathType === 'primary' ? 'grey.50' : (result.pathType === 'protected' ? 'primary.50' : 'info.50') }}>
                      <CardHeader 
                        title={result.pathType === 'primary' ? 'Primary Path' : (result.pathType === 'protected' ? 'Protected Service' : 'Secondary Path')}
                        subheader={`${pricing.contractTerm || 12}-Month Contract`}
                        sx={{ pb: 0, '& .MuiCardHeader-title': { fontSize: '0.95rem', fontWeight: 600 } }}
                      />
                      <CardContent sx={{ pt: 1 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Minimum Price ({pricing.minimumMargin}% margin)</Typography>
                            <Typography variant="body1" color="error.main" fontWeight="600">
                              {formatCurrency(pricing.minimumPrice, pricing.currency)}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Suggested Price ({pricing.suggestedMargin}% margin)</Typography>
                            <Typography variant="body1" color="success.main" fontWeight="600">
                              {formatCurrency(pricing.suggestedPrice, pricing.currency)}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}

              {/* Protected Service Pricing from separate field */}
              {protectionPricing && protectionPricing.minimumPrice && (
                <Grid item xs={12} md={4}>
                  <Card sx={{ height: '100%', bgcolor: 'primary.50' }}>
                    <CardHeader 
                      title="Protected Service"
                      subheader={`${protectionPricing.contractTerm || 12}-Month Contract`}
                      sx={{ pb: 0, '& .MuiCardHeader-title': { fontSize: '0.95rem', fontWeight: 600 } }}
                    />
                    <CardContent sx={{ pt: 1 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Minimum Price ({protectionPricing.minimumMargin}% margin)</Typography>
                          <Typography variant="body1" color="error.main" fontWeight="600">
                            {formatCurrency(protectionPricing.minimumPrice, protectionPricing.currency)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Suggested Price ({protectionPricing.suggestedMargin}% margin)</Typography>
                          <Typography variant="body1" color="success.main" fontWeight="600">
                            {formatCurrency(protectionPricing.suggestedPrice, protectionPricing.currency)}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {/* Detailed Calculation Breakdown */}
        {pricingResults && pricingResults.length > 0 && (
          <Box>
            <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 2 }}>Detailed Calculation Breakdown</Typography>
            {pricingResults.map((result, index) => {
              const detailedCalcs = result.pricing?.detailedCalculations;
              if (!detailedCalcs || !detailedCalcs.allocatedCostBreakdown) return null;
              
              return (
                <Accordion key={index} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" fontWeight="600">
                      📊 {result.pathType === 'primary' ? 'Primary' : result.pathType === 'protection' ? 'Secondary' : 'Protected'} Path - Allocated Cost Calculation
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Customer Bandwidth: <strong>{params?.bandwidth} Mbps</strong>
                    </Typography>
                    
                    <TableContainer component={Paper} sx={{ borderRadius: 1 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'primary.main' }}>
                            <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.75rem' }}>Circuit</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.75rem' }}>Route</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.75rem' }}>Carrier</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.75rem' }}>Segment BW</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.75rem' }}>Original Cost</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.75rem' }}>Utilization</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.75rem' }}>Allocation</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.75rem' }}>Allocated Cost</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {detailedCalcs.allocatedCostBreakdown.segments.map((segment, idx) => (
                            <TableRow key={idx} sx={{ 
                              '&:nth-of-type(odd)': { bgcolor: segment.isIncrementalCost ? 'rgba(144, 238, 144, 0.2)' : 'action.hover' },
                              bgcolor: segment.isIncrementalCost ? 'rgba(144, 238, 144, 0.15)' : 'inherit'
                            }}>
                              <TableCell sx={{ fontWeight: '600', fontSize: '0.75rem' }}>{segment.circuit}</TableCell>
                              <TableCell sx={{ fontSize: '0.7rem' }}>{segment.location}</TableCell>
                              <TableCell sx={{ fontSize: '0.7rem' }}>{segment.carrier}</TableCell>
                              <TableCell sx={{ fontSize: '0.75rem' }}>
                                {segment.segmentBandwidth ? `${segment.segmentBandwidth} Mbps` : 'N/A'}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.75rem' }}>
                                {segment.originalCost?.toFixed(2)} {segment.originalCurrency}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.7rem' }}>
                                {segment.utilizationFactor || 'N/A'}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.7rem' }}>
                                {segment.allocationRatio?.toFixed(4) || 'N/A'}
                              </TableCell>
                              <TableCell sx={{ fontWeight: '600', fontSize: '0.75rem', color: 'success.main' }}>
                                {segment.allocatedCost?.toFixed(2)} {params?.outputCurrency || 'USD'}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: 'primary.light' }}>
                            <TableCell colSpan={7} sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                              Total Allocated Cost:
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'primary.main' }}>
                              {(() => {
                                const total = detailedCalcs.allocatedCostBreakdown.segments.reduce((sum, seg) => {
                                  return sum + (parseFloat(seg.allocatedCost) || 0);
                                }, 0);
                                return formatCurrency(total, params?.outputCurrency || 'USD');
                              })()}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              );
            })}

          </Box>
        )}
      </Box>
    );
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

  const handleReloadFromLog = (log) => {
    try {
      let logData;
      try {
        logData = log.new_values ? JSON.parse(log.new_values) : null;
      } catch (e) {
        setError('Unable to parse log data');
        return;
      }

      if (!logData) {
        setError('Unable to reload - missing data in log');
        return;
      }

      const params = logData.inputParameters || logData;
      const results = logData.calculationResults;
      
      if (!params) {
        setError('Unable to reload - missing parameters in log');
        return;
      }

      // Extract path routes from stored params or reconstruct from results
      let primaryPathRoutes = params.primaryPathRoutes || '';
      let secondaryPathRoutes = params.secondaryPathRoutes || '';
      
      // Debug: Log the data structure to help diagnose issues
      console.log('Reload log data structure:', {
        hasParams: !!params,
        hasPrimaryPathRoutes: !!params.primaryPathRoutes,
        hasResults: !!results,
        hasIndividual: !!results?.individual,
        individualLength: results?.individual?.length,
        hasDetailedBreakdowns: !!logData.detailedCalculationBreakdowns
      });
      
      // If path routes weren't stored, try to reconstruct from calculation results
      // Try multiple data sources in order of preference
      
      // Source 1: Direct from individual results' route array (if stored)
      if (!primaryPathRoutes && results?.individual?.[0]?.route) {
        primaryPathRoutes = results.individual[0].route
          .filter(seg => seg.circuit_id && !seg.isVirtual)
          .map(seg => seg.circuit_id)
          .join(', ');
        console.log('Extracted primary routes from individual[0].route:', primaryPathRoutes);
      }
      
      // Source 2: From detailed calculation breakdowns' segment calculations
      // Note: property is 'circuit' not 'circuitId', and filter out incremental costs
      if (!primaryPathRoutes && logData.detailedCalculationBreakdowns?.primaryPath?.segmentCalculations) {
        primaryPathRoutes = logData.detailedCalculationBreakdowns.primaryPath.segmentCalculations
          .filter(seg => seg.circuit && !seg.isIncrementalCost && !seg.circuit.includes('New Core') && !seg.circuit.includes('Upgrade') && !seg.circuit.includes('Aggregate'))
          .map(seg => seg.circuit)
          .join(', ');
        console.log('Extracted primary routes from detailedBreakdowns:', primaryPathRoutes);
      }
      
      // Source 3: From individual pricing results' detailedCalculations
      if (!primaryPathRoutes && results?.individual?.[0]?.pricing?.detailedCalculations?.segmentCalculations) {
        primaryPathRoutes = results.individual[0].pricing.detailedCalculations.segmentCalculations
          .filter(seg => seg.circuit && !seg.isIncrementalCost && !seg.circuit.includes('New Core') && !seg.circuit.includes('Upgrade') && !seg.circuit.includes('Aggregate'))
          .map(seg => seg.circuit)
          .join(', ');
        console.log('Extracted primary routes from individual[0].pricing.detailedCalculations:', primaryPathRoutes);
      }
      
      // Secondary path - try same sources
      if (!secondaryPathRoutes && results?.individual?.[1]?.route) {
        secondaryPathRoutes = results.individual[1].route
          .filter(seg => seg.circuit_id && !seg.isVirtual)
          .map(seg => seg.circuit_id)
          .join(', ');
        console.log('Extracted secondary routes from individual[1].route:', secondaryPathRoutes);
      }
      
      if (!secondaryPathRoutes && logData.detailedCalculationBreakdowns?.secondaryPath?.segmentCalculations) {
        secondaryPathRoutes = logData.detailedCalculationBreakdowns.secondaryPath.segmentCalculations
          .filter(seg => seg.circuit && !seg.isIncrementalCost && !seg.circuit.includes('New Core') && !seg.circuit.includes('Upgrade') && !seg.circuit.includes('Aggregate'))
          .map(seg => seg.circuit)
          .join(', ');
        console.log('Extracted secondary routes from detailedBreakdowns:', secondaryPathRoutes);
      }
      
      if (!secondaryPathRoutes && results?.individual?.[1]?.pricing?.detailedCalculations?.segmentCalculations) {
        secondaryPathRoutes = results.individual[1].pricing.detailedCalculations.segmentCalculations
          .filter(seg => seg.circuit && !seg.isIncrementalCost && !seg.circuit.includes('New Core') && !seg.circuit.includes('Upgrade') && !seg.circuit.includes('Aggregate'))
          .map(seg => seg.circuit)
          .join(', ');
        console.log('Extracted secondary routes from individual[1].pricing.detailedCalculations:', secondaryPathRoutes);
      }
      
      console.log('Final path routes:', { primaryPathRoutes, secondaryPathRoutes });

      // Determine pricing type
      let pricingType = 'primary';
      if (params.protection_required) {
        pricingType = 'protected';
      } else if (secondaryPathRoutes) {
        pricingType = 'primary_secondary';
      }

      // Set form data from log parameters
      setFormData({
        source: params.source || '',
        destination: params.destination || '',
        bandwidth: params.bandwidth?.toString() || '',
        primaryPathRoutes: primaryPathRoutes,
        secondaryPathRoutes: secondaryPathRoutes,
        pricingType: pricingType,
        outputCurrency: params.output_currency || params.outputCurrency || 'USD',
        contractTerm: params.contract_term || params.contractTerm || 12,
        quoteRequestId: params.quoteRequestId || params.quote_request_id || '',
        customerName: params.customerName || params.customer_name || ''
      });

      // Restore incremental costs from log - mark as UNSAVED so user can review and save them
      const restoredIncrementalCosts = params.incrementalCosts || [];
      if (restoredIncrementalCosts.length > 0) {
        // Ensure each cost has all required fields and a unique id
        // Mark as saved: false so user must save them to push into routes
        const processedCosts = restoredIncrementalCosts.map((cost, index) => ({
          id: cost.id || `reloaded_${Date.now()}_${index}`,
          costType: cost.costType || 'core_incremental_upgrade',
          sourceLocation: cost.sourceLocation || '',
          destinationLocation: cost.destinationLocation || '',
          selectedCircuit: cost.selectedCircuit || '',
          newBandwidth: cost.newBandwidth || '',
          incrementalCost: cost.incrementalCost || '',
          currency: cost.currency || 'USD',
          pathAllocation: cost.pathAllocation || 'primary',
          allocationFactor: cost.allocationFactor || '',
          notes: cost.notes || '',
          saved: false // Mark as unsaved so user can review and save to push into routes
        }));
        setIncrementalCosts(processedCosts);
      } else {
        setIncrementalCosts([]);
      }

      // Clear previous results - user needs to recalculate
      setSearchResults(null);
      setPricingResults(null);

      // Trigger validation for the loaded routes
      if (primaryPathRoutes) {
        setTimeout(() => {
          validateRoutes(primaryPathRoutes, params.source, params.destination, 'primary');
        }, 100);
      }
      if (secondaryPathRoutes) {
        setTimeout(() => {
          validateRoutes(secondaryPathRoutes, params.source, params.destination, 'secondary');
        }, 150);
      }

      // Switch to the Calculator tab and expand relevant sections
      setCurrentTab(0);
      setExpandedAccordion({
        input: true,
        incremental: restoredIncrementalCosts.length > 0,
        results: false,
        pricing: false
      });
      
      setSuccess(`Search parameters loaded from pricing log${restoredIncrementalCosts.length > 0 ? ` (including ${restoredIncrementalCosts.length} incremental cost${restoredIncrementalCosts.length !== 1 ? 's' : ''} - please save them to push into routes)` : ''}. You can modify and re-run the calculation.`);
      
    } catch (error) {
      console.error('Reload from log error:', error);
      setError('Failed to reload search: ' + error.message);
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
    // Helper function to get location display as "Datacenter Name (POP_CODE)"
    const getLocationDisplay = (locationCode) => {
      const location = locations.find(loc => loc.location_code === locationCode);
      if (location && location.datacenter_name) {
        return `${location.datacenter_name} (${locationCode})`;
      }
      return locationCode;
    };

    // Common HTML styles
    const tableStyle = 'border-collapse: collapse; width: 100%; margin-bottom: 20px; font-family: Arial, sans-serif;';
    const thStyle = 'border: 1px solid #ddd; padding: 10px; background-color: #4472C4; color: white; text-align: left; font-weight: bold;';
    const tdStyle = 'border: 1px solid #ddd; padding: 8px; text-align: left;';
    const headerStyle = 'color: #2E5090; margin-top: 20px; margin-bottom: 10px; font-family: Arial, sans-serif;';

    // Helper function to generate route table in HTML
    const generateRouteTable = (pathData, pathType) => {
      if (!pathData || !pathData.route) return '';
      
      let tableHtml = `<h3 style="${headerStyle}">${pathType} Route</h3>`;
      tableHtml += `<table style="${tableStyle}">`;
      tableHtml += `<thead><tr>`;
      tableHtml += `<th style="${thStyle}">Circuit ID</th>`;
      tableHtml += `<th style="${thStyle}">Route Segment</th>`;
      tableHtml += `<th style="${thStyle}">Latency</th>`;
      tableHtml += `<th style="${thStyle}">Carrier</th>`;
      tableHtml += `<th style="${thStyle}">Cable System</th>`;
      tableHtml += `</tr></thead>`;
      tableHtml += `<tbody>`;
      
      pathData.route.forEach((segment, index) => {
        const rowBg = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
        tableHtml += `<tr style="background-color: ${rowBg};">`;
        tableHtml += `<td style="${tdStyle}">${segment.circuit_id || 'N/A'}</td>`;
        tableHtml += `<td style="${tdStyle}">${segment.from} → ${segment.to}</td>`;
        tableHtml += `<td style="${tdStyle}">${formatLatency(segment.latency)}ms</td>`;
        tableHtml += `<td style="${tdStyle}">${segment.carrier || 'N/A'}</td>`;
        tableHtml += `<td style="${tdStyle}">${segment.cable_system || 'N/A'}</td>`;
        tableHtml += `</tr>`;
      });
      
      tableHtml += `</tbody></table>`;
      tableHtml += `<p style="font-family: Arial, sans-serif; margin-bottom: 20px;"><strong>Total Latency:</strong> ${formatLatency(pathData.totalLatency)}ms</p>`;
      
      return tableHtml;
    };
    
    // Helper function to format pricing in HTML
    const formatPricingSection = (pricing, pathType) => {
      let html = `<h4 style="color: #228B22; margin-top: 15px; margin-bottom: 10px; font-family: Arial, sans-serif;">${pathType} Pricing</h4>`;
      html += `<table style="${tableStyle}">`;
      html += `<tbody>`;
      html += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>NRC</strong></td><td style="${tdStyle}">${pricing.nrcCharge > 0 ? formatCurrency(pricing.nrcCharge, pricing.currency) : 'FREE'}</td></tr>`;
      html += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>MRC (Minimum)</strong></td><td style="${tdStyle}">${formatCurrency(pricing.minimumPrice, pricing.currency)}</td></tr>`;
      html += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>MRC (Suggested)</strong></td><td style="${tdStyle}">${formatCurrency(pricing.suggestedPrice, pricing.currency)}</td></tr>`;
      html += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>Allocated Cost</strong></td><td style="${tdStyle}">${formatCurrency(pricing.allocatedCost, pricing.currency)}</td></tr>`;
      html += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>Currency</strong></td><td style="${tdStyle}">${pricing.currency}</td></tr>`;
      html += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>Contract Term</strong></td><td style="${tdStyle}">${pricing.contractTerm} months</td></tr>`;
      html += `</tbody></table>`;
      return html;
    };

    // Build HTML email body
    let emailBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;">`;
    
    // Header information
    emailBody += `<h2 style="color: #2E5090; border-bottom: 2px solid #4472C4; padding-bottom: 10px;">Allocated Cost Calculator Results</h2>`;
    emailBody += `<table style="margin-bottom: 20px; font-family: Arial, sans-serif;">`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Customer Name:</td><td>${formData.customerName || 'Not Specified'}</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Quote Request ID:</td><td>${formData.quoteRequestId || 'Not Specified'}</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Source Location:</td><td>${getLocationDisplay(formData.source)}</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Destination Location:</td><td>${getLocationDisplay(formData.destination)}</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Bandwidth:</td><td>${formData.bandwidth} Mbps</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Quote Time & Date:</td><td>${new Date().toLocaleString()}</td></tr>`;
    emailBody += `</table>`;
    
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
        emailBody += formatPricingSection(protectedResult.pricing, 'Protected Service');
      }
    }

    // Pricing Disclaimer in HTML
    emailBody += `<hr style="margin-top: 30px; margin-bottom: 20px; border: none; border-top: 1px solid #ccc;">`;
    emailBody += `<div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; font-family: Arial, sans-serif;">`;
    emailBody += `<h3 style="color: #333; margin-top: 0;">PRICING DISCLAIMER</h3>`;
    emailBody += `<ul style="color: #444; line-height: 1.6;">`;
    emailBody += `<li>This quotation is valid for 90 days.</li>`;
    emailBody += `<li>All Pricing is subject to IPC standard terms and conditions.</li>`;
    emailBody += `<li>All Pricing is budgetary and subject to survey and facility/feasibility checks.</li>`;
    emailBody += `<li>All Pricing is exclusive of any applicable Taxes and Surcharges.</li>`;
    emailBody += `</ul>`;
    emailBody += `</div>`;

    emailBody += `</body></html>`;
    
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
  
  const generateCSV = () => {
    // Helper to escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [];

    // CSV Header
    const headers = [
      'Customer Name',
      'Quote Request ID',
      'Source',
      'Destination',
      'Bandwidth (Mbps)',
      'Currency',
      'Contract Term (Months)',
      'Pricing Type',
      'Path',
      'Circuit ID',
      'Segment From',
      'Segment To',
      'Carrier',
      'Cable System',
      'Latency (ms)',
      'Segment Bandwidth (Mbps)',
      'Original Cost',
      'Original Currency',
      'Converted Cost',
      'Utilization Factor',
      'Utilization Factor Type',
      'Allocation Ratio',
      'Allocated Cost',
      'Allocation Ratio (No Utilization Factor)',
      'Allocated Cost (No Utilization Factor)',
      'Is Incremental Cost',
      'Incremental Cost Type',
      'Path Total Allocated Cost',
      'Path Minimum Price',
      'Path Minimum Margin (%)',
      'Path Suggested Price',
      'Path Suggested Margin (%)',
      'Path NRC Charge'
    ];

    rows.push(headers);

    // Common request parameters
    const pricingTypeLabel = formData.pricingType === 'protected' ? 'Protected' :
                             formData.pricingType === 'primary_secondary' ? 'Primary + Secondary' : 'Primary';
    const commonFields = [
      formData.customerName || '',
      formData.quoteRequestId || '',
      formData.source,
      formData.destination,
      formData.bandwidth,
      formData.outputCurrency,
      formData.contractTerm,
      pricingTypeLabel
    ];

    const bandwidth = parseFloat(formData.bandwidth);

    // Process each path result
    const pathsToExport = pricingResults.results.filter(result => {
      if (result.pathType === 'primary' && exportOptions.primaryPricing) return true;
      if (result.pathType === 'protection' && exportOptions.secondaryPricing) return true;
      return false;
    });

    pathsToExport.forEach(result => {
      const detailedCalcs = result.pricing?.detailedCalculations;
      if (!detailedCalcs || !detailedCalcs.allocatedCostBreakdown) return;

      const pathLabel = result.pathType === 'primary' ? 'Primary' : 'Secondary';
      const segments = detailedCalcs.allocatedCostBreakdown.segments;

      segments.forEach(segment => {
        // Calculate "no utilization factor" values
        const isAggregateCost = segment.isIncrementalCost && !segment.segmentBandwidth;
        let noFactorRatio = '';
        let noFactorCost = '';

        if (isAggregateCost) {
          noFactorRatio = '1 (Full Cost)';
          noFactorCost = segment.convertedCost != null ? segment.convertedCost.toFixed(2) : '';
        } else if (segment.segmentBandwidth) {
          noFactorRatio = (bandwidth / segment.segmentBandwidth).toFixed(6);
          noFactorCost = (segment.convertedCost * (bandwidth / segment.segmentBandwidth)).toFixed(2);
        }

        const segFrom = segment.location ? segment.location.split(' → ')[0] : '';
        const segTo = segment.location ? segment.location.split(' → ')[1] : '';

        const row = [
          ...commonFields,
          pathLabel,
          segment.circuit || '',
          segFrom,
          segTo,
          segment.carrier || '',
          segment.cable_system || '',
          segment.latency != null ? segment.latency : '',
          segment.segmentBandwidth || '',
          segment.originalCost != null ? segment.originalCost.toFixed(2) : '',
          segment.originalCurrency || '',
          segment.convertedCost != null ? segment.convertedCost.toFixed(2) : '',
          segment.utilizationFactor || '',
          segment.utilizationFactorType || '',
          segment.allocationRatio != null ? segment.allocationRatio.toFixed(6) : (segment.allocationFactor != null ? segment.allocationFactor : ''),
          segment.allocatedCost != null ? segment.allocatedCost.toFixed(2) : '',
          noFactorRatio,
          noFactorCost,
          segment.isIncrementalCost ? 'Yes' : 'No',
          segment.isIncrementalCost ? (segment.costType || '') : '',
          result.pricing.allocatedCost != null ? result.pricing.allocatedCost.toFixed(2) : '',
          result.pricing.minimumPrice != null ? result.pricing.minimumPrice.toFixed(2) : '',
          result.pricing.minimumMargin != null ? result.pricing.minimumMargin : '',
          result.pricing.suggestedPrice != null ? result.pricing.suggestedPrice.toFixed(2) : '',
          result.pricing.suggestedMargin != null ? result.pricing.suggestedMargin : '',
          result.pricing.nrcCharge != null ? result.pricing.nrcCharge.toFixed(2) : '0.00'
        ];

        rows.push(row);
      });
    });

    // Add protected service pricing row if applicable
    if (exportOptions.protectedPricing && pricingResults.protectionPricing) {
      const pp = pricingResults.protectionPricing;
      const protectedRow = [
        ...commonFields,
        'Protected Service',
        '', '', '', '', '', '', '',
        '', '', '', '', '', '', '',
        '', '', '', '',
        pp.allocatedCost != null ? pp.allocatedCost.toFixed(2) : '',
        pp.minimumPrice != null ? pp.minimumPrice.toFixed(2) : '',
        pp.minimumMargin != null ? pp.minimumMargin : '',
        pp.suggestedPrice != null ? pp.suggestedPrice.toFixed(2) : '',
        pp.suggestedMargin != null ? pp.suggestedMargin : '',
        ''
      ];
      rows.push(protectedRow);
    }

    // Convert to CSV string
    return rows.map(row => row.map(escapeCSV).join(',')).join('\n');
  };

  const handleDownloadCSV = () => {
    const csvContent = generateCSV();

    // Create blob as .csv file
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel compatibility
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename with timestamp
    const fileTimestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const customerName = (formData.customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
    const quoteId = (formData.quoteRequestId || 'Quote').replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `AllocatedCost_${quoteId}_${customerName}_${fileTimestamp}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSuccess('CSV file downloaded successfully');
    handleExportClose();
  };
  
  // Pricing Logs Filtering and Pagination Functions
  // Skip on initial mount since loadInitialData already loads audit logs
  useEffect(() => {
    // Skip if initial load hasn't completed yet (loadInitialData handles first load)
    if (!initialLoadComplete.current) {
      return;
    }
    if (canViewPricingLogs) {
      loadAuditLogs();
    }
  }, [pagination.page, pagination.limit, selectedUser, customerNameFilter, logSearchTerm]);

  const handleLogSearchChange = (event) => {
    setLogSearchTerm(event.target.value);
    // Reset to page 1 when search changes
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleCustomerNameFilterChange = (event) => {
    setCustomerNameFilter(event.target.value);
    // Reset to page 1 when filter changes
    setPagination(prev => ({ ...prev, page: 1 }));
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
                        <TableCell>New Bandwidth / Allocation Factor</TableCell>
                        <TableCell>Path</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {incrementalCosts.map((cost) => (
                        <React.Fragment key={cost.id}>
                        <TableRow>
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
                                 cost.costType === 'core_incremental_upgrade' ? 'Total Cost After Upgrade' :
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
                          
                          {/* New Bandwidth / Allocation Factor */}
                          <TableCell>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                                {cost.costType === 'core_incremental_new' || cost.costType === 'core_incremental_upgrade' 
                                  ? 'Enter Mbps or "Dark Fiber"' 
                                  : 'Allocation Factor (0.0-1.0)'}
                              </Typography>
                              {cost.costType === 'core_incremental_new' || cost.costType === 'core_incremental_upgrade' ? (
                                <TextField
                                  fullWidth
                                  size="small"
                                  disabled={cost.saved}
                                  value={cost.newBandwidth}
                                  onChange={(e) => updateIncrementalCost(cost.id, 'newBandwidth', e.target.value)}
                                  placeholder='e.g., "10000" or "Dark Fiber"'
                                  inputProps={{ style: { fontSize: '0.75rem' } }}
                                />
                              ) : (
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
                              )}
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
                        
                        {/* Additional Row for Core Incremental Upgrade - Circuit Selection and Current Info */}
                        {cost.costType === 'core_incremental_upgrade' && (
                          <TableRow key={`${cost.id}-circuit`}>
                            <TableCell colSpan={8} sx={{ bgcolor: '#f5f5f5' }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {/* Circuit Selection */}
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
                                      {/* If circuit is saved and not in current list, add it as disabled option */}
                                      {cost.saved && cost.selectedCircuit && 
                                       !(cost.pathAllocation === 'primary' ? primaryPathValidation.routes : secondaryPathValidation.routes)
                                         .some(r => r.circuit_id === cost.selectedCircuit) && (
                                        <MenuItem key={cost.selectedCircuit} value={cost.selectedCircuit} disabled sx={{ fontSize: '0.75rem' }}>
                                          {cost.selectedCircuit}
                                        </MenuItem>
                                      )}
                                    </Select>
                                  </FormControl>
                                </Box>
                                
                                {/* Current Circuit Info */}
                                {cost.selectedCircuit && (() => {
                                  const validation = cost.pathAllocation === 'primary' ? primaryPathValidation : secondaryPathValidation;
                                  const selectedRoute = validation.routes.find(r => r.circuit_id === cost.selectedCircuit);
                                  if (selectedRoute) {
                                    let currentBandwidthDisplay;
                                    if (selectedRoute.bandwidth && typeof selectedRoute.bandwidth === 'string' && 
                                        selectedRoute.bandwidth.toLowerCase().includes('dark fiber')) {
                                      currentBandwidthDisplay = 'Dark Fiber (200000 Mbps)';
                                    } else {
                                      currentBandwidthDisplay = `${selectedRoute.bandwidth || 'N/A'} Mbps`;
                                    }
                                    const currentCost = selectedRoute.cost ? `${parseFloat(selectedRoute.cost).toFixed(2)} ${selectedRoute.currency || 'USD'}` : 'N/A';
                                    
                                    return (
                                      <Box sx={{ pl: 2, py: 1, bgcolor: 'info.50', borderRadius: 1 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 'bold' }}>
                                          Current Circuit Info:
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                          Current Bandwidth: <strong>{currentBandwidthDisplay}</strong> | Current Cost: <strong>{currentCost}</strong>
                                        </Typography>
                                      </Box>
                                    );
                                  }
                                  return null;
                                })()}
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
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
                                sx={{ bgcolor: (segment.isVirtual || segment.isUpgraded) ? '#90EE90' : 'inherit' }}
                              >
                                <TableCell>{segment.circuit_id_display || segment.circuit_id || 'N/A'}</TableCell>
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
                                  sx={{ bgcolor: (segment.isVirtual || segment.isUpgraded) ? '#90EE90' : 'inherit' }}
                                >
                                  <TableCell>{segment.circuit_id_display || segment.circuit_id || 'N/A'}</TableCell>
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
              <Grid container spacing={2.5} sx={{ mb: 4 }}>
                {/* Show Primary and Secondary paths */}
                {pricingResults.results.filter(result => {
                  if (formData.pricingType === 'primary') {
                    return result.pathType === 'primary';
                  } else {
                    return result.pathType === 'primary' || result.pathType === 'protection';
                  }
                }).map((result, index) => (
                  <Grid item xs={12} md={formData.pricingType === 'primary' ? 6 : (formData.pricingType === 'protected' && pricingResults.protectionPricing ? 4 : 6)} key={`summary-${index}`}>
                    <Card sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 1 }}>
                      <CardHeader 
                        title={result.pathType === 'primary' ? 'Primary Path' : 'Secondary Path'}
                        subheader={`${formData.contractTerm}-Month Contract`}
                        sx={{
                          pb: 0.75,
                          '& .MuiCardHeader-title': { fontSize: '0.95rem', fontWeight: 600 },
                          '& .MuiCardHeader-subheader': { fontSize: '0.8rem', color: 'text.secondary' }
                        }}
                      />
                      <CardContent sx={{ pt: 0.75, px: 2.25, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.4 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.2, fontSize: '0.68rem' }}>
                            Minimum Price · {result.pricing.minimumMargin}% Margin
                          </Typography>
                          <Typography variant="h6" color="error.main" sx={{ fontSize: '1.0rem', fontWeight: 600, mt: 0.4 }}>
                            {formatCurrency(result.pricing.minimumPrice, result.pricing.currency)}
                          </Typography>
                        </Box>
                        <Divider flexItem sx={{ my: 0.4 }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.2, fontSize: '0.68rem' }}>
                            Suggested Price · {result.pricing.suggestedMargin}% Margin
                          </Typography>
                          <Typography variant="h6" color="success.main" sx={{ fontSize: '1.0rem', fontWeight: 600, mt: 0.4 }}>
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
                    <Card sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 1 }}>
                      <CardHeader 
                        title="Protected Service"
                        subheader={`${formData.contractTerm}-Month Contract`}
                        sx={{
                          pb: 0.75,
                          '& .MuiCardHeader-title': { fontSize: '0.95rem', fontWeight: 600 },
                          '& .MuiCardHeader-subheader': { fontSize: '0.8rem', color: 'text.secondary' }
                        }}
                      />
                      <CardContent sx={{ pt: 0.75, px: 2.25, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.4 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.2, fontSize: '0.68rem' }}>
                            Minimum Price · {pricingResults.protectionPricing.minimumMargin}% Margin
                          </Typography>
                          <Typography variant="h6" color="error.main" sx={{ fontSize: '1.0rem', fontWeight: 600, mt: 0.4 }}>
                            {formatCurrency(pricingResults.protectionPricing.minimumPrice, pricingResults.protectionPricing.currency)}
                          </Typography>
                        </Box>
                        <Divider flexItem sx={{ my: 0.4 }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.2, fontSize: '0.68rem' }}>
                            Suggested Price · {pricingResults.protectionPricing.suggestedMargin}% Margin
                          </Typography>
                          <Typography variant="h6" color="success.main" sx={{ fontSize: '1.0rem', fontWeight: 600, mt: 0.4 }}>
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
                      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'grey.50' }}>
                        <Typography variant="h6" fontWeight="600">
                          📊 {result.pathType === 'primary' ? 'Primary' : result.pathType === 'protection' ? 'Secondary' : 'Protected'} Path - Complete Calculation Breakdown
                        </Typography>
                      </AccordionSummary>
                        <AccordionDetails sx={{ p: 3 }}>
                          {/* Segment-by-Segment Breakdown */}
                          {detailedCalcs.allocatedCostBreakdown && (
                            <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper' }}>
                              <Typography variant="subtitle1" gutterBottom color="primary" fontWeight="600" sx={{ mb: 1.5 }}>
                                1️⃣ Allocated Cost Calculation
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, fontWeight: 500 }}>
                                Customer Bandwidth: <strong>{formData.bandwidth} Mbps</strong>
                              </Typography>
                              
                              <TableContainer component={Paper} sx={{ mb: 3, borderRadius: 2, boxShadow: 2 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Circuit</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Route</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Carrier</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Segment BW</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Original Cost</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Utilization Factor</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Allocation Ratio</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Allocated Cost</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {detailedCalcs.allocatedCostBreakdown.segments.map((segment, idx) => (
                                      <TableRow key={idx} sx={{ 
                                        '&:nth-of-type(odd)': { bgcolor: segment.isIncrementalCost ? 'rgba(144, 238, 144, 0.2)' : 'action.hover' },
                                        bgcolor: segment.isIncrementalCost ? 'rgba(144, 238, 144, 0.15)' : 'inherit'
                                      }}>
                                        <TableCell sx={{ fontWeight: '600', fontSize: '0.8rem' }}>{segment.circuit}</TableCell>
                                        <TableCell sx={{ fontSize: '0.75rem' }}>{segment.location}</TableCell>
                                        <TableCell sx={{ fontSize: '0.75rem' }}>{segment.carrier}</TableCell>
                                        <TableCell sx={{ fontSize: '0.8rem' }}>
                                          {segment.isIncrementalCost ? 
                                            (segment.segmentBandwidth ? `${segment.segmentBandwidth} Mbps` : 'N/A') : 
                                            `${segment.segmentBandwidth} Mbps`}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.8rem' }}>
                                          {segment.originalCost.toFixed(2)} {segment.originalCurrency}
                                          {segment.originalCurrency !== formData.outputCurrency && (
                                            <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                              = {segment.convertedCost.toFixed(2)} {formData.outputCurrency}
                                            </Typography>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {segment.isIncrementalCost ? (
                                            segment.utilizationFactor ? (
                                              <>
                                                {segment.utilizationFactor}
                                                <Typography variant="caption" display="block" color="text.secondary">
                                                  ({segment.utilizationFactorType})
                                                </Typography>
                                              </>
                                            ) : (
                                              <Typography variant="body2" color="text.secondary">N/A</Typography>
                                            )
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
                                            segment.calculation ? (
                                              <Box sx={{ bgcolor: 'info.50', p: 1, borderRadius: 1 }}>
                                                <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace' }}>
                                                  {segment.calculation}
                                                </Typography>
                                                <Typography variant="body2" fontWeight="bold">
                                                  = {segment.allocationRatio.toFixed(6)}
                                                </Typography>
                                              </Box>
                                            ) : (
                                              <Box sx={{ bgcolor: 'info.50', p: 1, borderRadius: 1 }}>
                                                <Typography variant="body2" fontWeight="bold">
                                                  Allocation Factor: {segment.allocationFactor}
                                                </Typography>
                                              </Box>
                                            )
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
                              <Typography variant="subtitle1" gutterBottom color="secondary" fontWeight="600" sx={{ mt: 3.5, mb: 1.5 }}>
                                Allocated Cost WITHOUT Utilization Factor (100% Utilization)
                              </Typography>
                              <TableContainer component={Paper} sx={{ mb: 3, borderRadius: 2, boxShadow: 2 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ bgcolor: 'secondary.main' }}>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Circuit</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Route</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Carrier</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Segment BW</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Original Cost</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Allocation Ratio (No Factor)</TableCell>
                                      <TableCell sx={{ color: 'white', fontWeight: '600', fontSize: '0.8rem' }}>Allocated Cost</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {detailedCalcs.allocatedCostBreakdown.segments.map((segment, idx) => {
                                      // Check if this is an Aggregate Cost (no bandwidth)
                                      const isAggregateCost = segment.isIncrementalCost && !segment.segmentBandwidth;
                                      
                                      if (isAggregateCost) {
                                        // For Aggregate Cost A/B End: Show at full cost (100%)
                                        return (
                                          <TableRow key={idx} sx={{ 
                                            '&:nth-of-type(odd)': { bgcolor: 'rgba(144, 238, 144, 0.2)' },
                                            bgcolor: 'rgba(144, 238, 144, 0.15)'
                                          }}>
                                            <TableCell sx={{ fontWeight: '600', fontSize: '0.8rem' }}>{segment.circuit}</TableCell>
                                            <TableCell sx={{ fontSize: '0.75rem' }}>{segment.location}</TableCell>
                                            <TableCell sx={{ fontSize: '0.75rem' }}>{segment.carrier}</TableCell>
                                            <TableCell sx={{ fontSize: '0.8rem' }}>N/A</TableCell>
                                            <TableCell sx={{ fontSize: '0.8rem' }}>
                                              {segment.convertedCost.toFixed(2)} {formData.outputCurrency}
                                            </TableCell>
                                            <TableCell>
                                              <Box sx={{ bgcolor: 'info.50', p: 1, borderRadius: 1 }}>
                                                <Typography variant="body2" fontWeight="bold">
                                                  100% (Full Cost)
                                                </Typography>
                                              </Box>
                                            </TableCell>
                                            <TableCell>
                                              <Box sx={{ bgcolor: 'warning.50', p: 1, borderRadius: 1 }}>
                                                <Typography variant="body2" fontWeight="bold" color="warning.dark">
                                                  = {segment.convertedCost.toFixed(2)} {formData.outputCurrency}
                                                </Typography>
                                              </Box>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      } else {
                                        // For regular circuits and bandwidth-based incremental costs
                                        const noFactorRatio = parseFloat(formData.bandwidth) / segment.segmentBandwidth;
                                        const noFactorCost = segment.convertedCost * noFactorRatio;
                                        return (
                                          <TableRow key={idx} sx={{ 
                                            '&:nth-of-type(odd)': { bgcolor: segment.isIncrementalCost ? 'rgba(144, 238, 144, 0.2)' : 'action.hover' },
                                            bgcolor: segment.isIncrementalCost ? 'rgba(144, 238, 144, 0.15)' : 'inherit'
                                          }}>
                                            <TableCell sx={{ fontWeight: '600', fontSize: '0.8rem' }}>{segment.circuit}</TableCell>
                                            <TableCell sx={{ fontSize: '0.75rem' }}>{segment.location}</TableCell>
                                            <TableCell sx={{ fontSize: '0.75rem' }}>{segment.carrier}</TableCell>
                                            <TableCell sx={{ fontSize: '0.8rem' }}>{segment.segmentBandwidth} Mbps</TableCell>
                                            <TableCell sx={{ fontSize: '0.8rem' }}>
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
                                      }
                                    })}
                                    <TableRow sx={{ bgcolor: 'secondary.light' }}>
                                      <TableCell colSpan={6} sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                                        Total Allocated Cost (No Utilization Factor):
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem', color: 'secondary.main' }}>
                                        {(() => {
                                          const bandwidth = parseFloat(formData.bandwidth);
                                          const total = detailedCalcs.allocatedCostBreakdown.segments.reduce((sum, segment) => {
                                            const convertedCost = parseFloat(segment.convertedCost);
                                            
                                            // Check if this is an Aggregate Cost (no bandwidth)
                                            const isAggregateCost = segment.isIncrementalCost && !segment.segmentBandwidth;
                                            
                                            if (isAggregateCost) {
                                              // For Aggregate Cost: Add full cost
                                              return sum + convertedCost;
                                            } else {
                                              // For bandwidth-based costs: Calculate with ratio
                                              const segmentBw = parseFloat(segment.segmentBandwidth);
                                              if (isNaN(bandwidth) || isNaN(segmentBw) || isNaN(convertedCost)) {
                                                console.error('NaN detected:', { bandwidth, segmentBw, convertedCost });
                                                return sum;
                                              }
                                              return sum + (convertedCost * (bandwidth / segmentBw));
                                            }
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
                            <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'error.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                              <Typography variant="subtitle1" gutterBottom color="error.main" fontWeight="600" sx={{ mb: 1.5 }}>
                                2️⃣ Minimum Price Calculation
                              </Typography>
                              
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 2, mb: 2 }}>
                                <Typography variant="body2" color="error.main" gutterBottom fontWeight="600">Formula:</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1.5, color: 'text.secondary' }}>
                                  Minimum Price = Allocated Cost / (1 - Minimum Margin / 100)
                                </Typography>
                                <Divider sx={{ my: 1.5 }} />
                                <Typography variant="body2" color="error.main" gutterBottom fontWeight="600">Calculation:</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                  {detailedCalcs.minimumPriceBreakdown.calculation}
                                </Typography>
                                <Typography variant="h6" color="error.main" fontWeight="600" sx={{ mt: 1.5, fontSize: '1.15rem' }}>
                                  = {formatCurrency(detailedCalcs.minimumPriceBreakdown.calculatedPrice, formData.outputCurrency)}
                                </Typography>
                              </Box>
                              
                              {detailedCalcs.minimumPriceBreakdown.locationMinimumCheck && (
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                  <Typography variant="body2" fontWeight="600" gutterBottom>Location Minimum Price Check:</Typography>
                                  <Typography variant="body2" sx={{ mb: 1 }}>
                                    {detailedCalcs.minimumPriceBreakdown.locationMinimumCheck.explanation}
                                  </Typography>
                                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                                    Location Minimum: <strong>{formatCurrency(detailedCalcs.minimumPriceBreakdown.locationMinimumCheck.locationMinimum, formData.outputCurrency)}</strong>
                                  </Typography>
                                  <Typography variant="body2">
                                    {detailedCalcs.minimumPriceBreakdown.locationMinimumCheck.used ? 
                                      '✅ Location minimum enforced' : 
                                      '❌ Calculated price already exceeds location minimum'}
                                  </Typography>
                                </Alert>
                              )}
                              
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 2, mt: 2, border: '2px solid', borderColor: 'error.main' }}>
                                <Typography variant="body2" color="error.main" gutterBottom fontWeight="600">
                                  Final Minimum Price (Rounded to nearest $10):
                                </Typography>
                                <Typography variant="h6" color="error.main" fontWeight="600" sx={{ my: 0.6, fontSize: '1.1rem' }}>
                                  {formatCurrency(result.pricing.minimumPrice, formData.outputCurrency)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" fontWeight="500">
                                  Minimum Margin: {result.pricing.minimumMargin}%
                                </Typography>
                              </Box>
                            </Paper>
                          )}
                          
                          {/* Suggested Price Calculation */}
                          {detailedCalcs.suggestedPriceBreakdown && (
                            <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'success.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                              <Typography variant="subtitle1" gutterBottom color="success.main" fontWeight="600" sx={{ mb: 1.5 }}>
                                3️⃣ Suggested Price Calculation
                              </Typography>
                              
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 2, mb: 2 }}>
                                <Typography variant="body2" color="success.main" gutterBottom fontWeight="600">Formula:</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1.5, color: 'text.secondary' }}>
                                  Suggested Price = Allocated Cost / (1 - Suggested Margin / 100)
                                </Typography>
                                <Divider sx={{ my: 1.5 }} />
                                <Typography variant="body2" color="success.main" gutterBottom fontWeight="600">Calculation:</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                  {detailedCalcs.suggestedPriceBreakdown.calculation}
                                </Typography>
                                <Typography variant="h6" color="success.main" fontWeight="600" sx={{ mt: 1.5, fontSize: '1.15rem' }}>
                                  = {formatCurrency(detailedCalcs.suggestedPriceBreakdown.calculatedPrice, formData.outputCurrency)}
                                </Typography>
                              </Box>
                              
                              {detailedCalcs.suggestedPriceBreakdown.locationMinimumCheck && (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                  <Typography variant="body2" fontWeight="600" gutterBottom>Location Minimum Price Check:</Typography>
                                  <Typography variant="body2" sx={{ mb: 1 }}>
                                    {detailedCalcs.suggestedPriceBreakdown.locationMinimumCheck.explanation}
                                  </Typography>
                                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                                    Location Minimum: <strong>{formatCurrency(detailedCalcs.suggestedPriceBreakdown.locationMinimumCheck.locationMinimum, formData.outputCurrency)}</strong>
                                  </Typography>
                                  <Typography variant="body2">
                                    {detailedCalcs.suggestedPriceBreakdown.locationMinimumCheck.used ? 
                                      '✅ Location minimum enforced' : 
                                      '❌ Calculated price already exceeds location minimum'}
                                  </Typography>
                                </Alert>
                              )}
                              
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 2, mt: 2, border: '2px solid', borderColor: 'success.main' }}>
                                <Typography variant="body2" color="success.main" gutterBottom fontWeight="600">
                                  Final Suggested Price (Rounded to nearest $10):
                                </Typography>
                                <Typography variant="h6" color="success.main" fontWeight="600" sx={{ my: 0.6, fontSize: '1.1rem' }}>
                                  {formatCurrency(result.pricing.suggestedPrice, formData.outputCurrency)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" fontWeight="500">
                                  Suggested Margin: {result.pricing.suggestedMargin}%
                                </Typography>
                              </Box>
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
                      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'grey.50' }}>
                        <Typography variant="h6" fontWeight="600">
                          📊 🛡️ Protected Service - Complete Calculation Breakdown
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 3 }}>
                        {pricingResults.protectionPricing.detailedCalculations && (
                          <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'warning.50', border: '2px solid', borderColor: 'warning.main', borderRadius: 2 }}>
                            <Typography variant="subtitle1" gutterBottom color="warning.dark" fontWeight="600" sx={{ mb: 1.5 }}>
                              🛡️ Protected Service Calculation
                            </Typography>
                            
                            <Alert severity="info" sx={{ mb: 2 }}>
                              <Typography variant="body2" fontWeight="500" sx={{ fontSize: '0.875rem' }}>
                                Protected service pricing includes 100% of both primary and secondary allocated costs, with enforced margin targets to ensure profitability.
                              </Typography>
                            </Alert>
                            
                            {/* Allocated Cost Breakdown */}
                            {pricingResults.protectionPricing.detailedCalculations.allocatedCostBreakdown && (
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 2, mb: 2 }}>
                                <Typography variant="body2" gutterBottom fontWeight="600">Allocated Cost Formula:</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                  {pricingResults.protectionPricing.detailedCalculations.allocatedCostBreakdown.formula}
                                </Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                  {pricingResults.protectionPricing.detailedCalculations.allocatedCostBreakdown.calculation}
                                </Typography>
                                <Typography variant="h6" color="primary" fontWeight="600" sx={{ mt: 1.5, fontSize: '1.15rem' }}>
                                  Final: {formatCurrency(pricingResults.protectionPricing.allocatedCost, formData.outputCurrency)}
                                </Typography>
                              </Box>
                            )}
                            
                            {/* Minimum Price Breakdown */}
                            {pricingResults.protectionPricing.detailedCalculations.minimumPriceBreakdown && (
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 2, mb: 2 }}>
                                <Typography variant="body2" gutterBottom fontWeight="600">Minimum Price Formula:</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                  {pricingResults.protectionPricing.detailedCalculations.minimumPriceBreakdown.formula}
                                </Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                  {pricingResults.protectionPricing.detailedCalculations.minimumPriceBreakdown.calculation}
                                </Typography>
                                <Typography variant="h6" color="error.main" fontWeight="600" sx={{ mt: 1.5, fontSize: '1.15rem' }}>
                                  Final: {formatCurrency(pricingResults.protectionPricing.minimumPrice, formData.outputCurrency)}
                                </Typography>
                              </Box>
                            )}
                            
                            {/* Suggested Price Breakdown */}
                            {pricingResults.protectionPricing.detailedCalculations.suggestedPriceBreakdown && (
                              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 2, mb: 2 }}>
                                <Typography variant="body2" gutterBottom fontWeight="600">Suggested Price Formula:</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                  {pricingResults.protectionPricing.detailedCalculations.suggestedPriceBreakdown.formula}
                                </Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                  {pricingResults.protectionPricing.detailedCalculations.suggestedPriceBreakdown.calculation}
                                </Typography>
                                <Typography variant="h6" color="success.main" fontWeight="600" sx={{ mt: 1.5, fontSize: '1.15rem' }}>
                                  Final: {formatCurrency(pricingResults.protectionPricing.suggestedPrice, formData.outputCurrency)}
                                </Typography>
                              </Box>
                            )}
                            
                            {/* Margin Verification */}
                            {pricingResults.protectionPricing.detailedCalculations.marginVerification && (
                              <Box sx={{ bgcolor: 'info.50', p: 2, borderRadius: 2, mt: 2 }}>
                                <Typography variant="body2" gutterBottom fontWeight="600">Margin Verification:</Typography>
                                <Typography variant="body2" sx={{ mb: 1.2, fontWeight: 500 }}>
                                  <strong>Minimum Margin:</strong> {pricingResults.protectionPricing.minimumMargin}%
                                </Typography>
                                <Typography variant="body2" display="block" sx={{ fontFamily: 'monospace', mb: 2, color: 'text.secondary' }}>
                                  {pricingResults.protectionPricing.detailedCalculations.marginVerification.actualMinMarginFormula}
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 1.2, fontWeight: 500 }}>
                                  <strong>Suggested Margin:</strong> {pricingResults.protectionPricing.suggestedMargin}%
                                </Typography>
                                <Typography variant="body2" display="block" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
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
                    onChange={handleLogSearchChange}
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
                      <TableCell align="center" sx={{ width: 180 }}>
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
                          {/* Reload Search - available for all users */}
                          <Button
                            variant="outlined"
                            size="small"
                            fullWidth
                            startIcon={<HistoryIcon />}
                            onClick={() => handleReloadFromLog(log)}
                            color="secondary"
                          >
                            Reload Search
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                    {expandedLogs.has(log.id) && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ backgroundColor: '#f8f9fa', border: 'none' }}>
                          <Box sx={{ p: 2 }}>
                            {/* View Mode Toggle */}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                              <FormControl size="small" sx={{ minWidth: 180 }}>
                                <InputLabel>View Mode</InputLabel>
                                <Select
                                  value={getLogViewMode(log.id)}
                                  label="View Mode"
                                  onChange={(e) => setLogViewMode(log.id, e.target.value)}
                                >
                                  <MenuItem value="readable">Visual View</MenuItem>
                                  <MenuItem value="json">JSON Data</MenuItem>
                                </Select>
                              </FormControl>
                            </Box>

                            {/* Human Readable View */}
                            {getLogViewMode(log.id) === 'readable' && (
                              renderHumanReadableLogDetails(log)
                            )}

                            {/* JSON View */}
                            {getLogViewMode(log.id) === 'json' && (
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
                            )}
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
          <Button onClick={handleDownloadCSV} startIcon={<FileDownloadIcon />} variant="contained">
            Download as CSV
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AllocatedCostCalculator;
