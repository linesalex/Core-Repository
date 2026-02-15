import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Grid, Paper, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel,
  Chip, Alert, CircularProgress, LinearProgress, Accordion, AccordionSummary, AccordionDetails, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Card, CardContent, CardHeader, Divider,
  Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem,
  ListItemText, ListItemIcon, Checkbox, Tooltip, IconButton, Snackbar, Tabs, Tab, Autocomplete,
  InputAdornment, Pagination, Radio, RadioGroup
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import RouteIcon from '@mui/icons-material/Route';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import EmailIcon from '@mui/icons-material/Email';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';

import SaveIcon from '@mui/icons-material/Save';
import HistoryIcon from '@mui/icons-material/History';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CableIcon from '@mui/icons-material/Cable';
import MapIcon from '@mui/icons-material/Map';
import WarningIcon from '@mui/icons-material/Warning';
import SecurityIcon from '@mui/icons-material/Security';
import LoadingButton from '@mui/lab/LoadingButton';
import { networkDesignApi, getCrossConnectInfo, checkKMZAvailability, exportNetworkDesignKMZ } from './api';
import { getCarriers } from './api';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from './config';

// Tab panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const NetworkDesignTool = () => {
  const { user, modulePermissions } = useAuth();
  
  // Get user's network_design module permission level
  const networkDesignPermission = modulePermissions['network_design'] || null;
  
  // Check if user has route_finder access (for showing Route Finder search logs)
  const hasRouteFinderAccess = !!modulePermissions['route_finder'];
  
  // Check if user can view pricing logs (all authenticated users with network_design access can view)
  const canViewPricingLogs = user !== null && networkDesignPermission !== null;
  
  // Check if user can manage logs (admin only)
  const canManageLogs = user && user.role === 'administrator';
  
  // Check if user is read-only (limited access to logs)
  const isReadOnly = networkDesignPermission === 'read_only';
  
  // Form state
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    bandwidth: '',
    includeULL: false,
    useCiscoOnlyRoutes: true, // Default to true (enabled by default)
    use100GbAndDFOnly: false,
    includeProvisioningRoutes: true, // Default to true - include routes in provisioning status
    protectionRequired: false,
    mtuRequired: '', // Changed from maxLatency to mtuRequired
    carrierAvoidance: [],
    circuitExclusion: [],
    outputCurrency: 'USD',
    contractTerm: 12,
    quoteRequestId: '',
    customerName: ''
  });

  // Manual route entry state
  const [designMode, setDesignMode] = useState('auto'); // 'auto' or 'manual'
  const [manualPrimaryRoutes, setManualPrimaryRoutes] = useState('');
  const [manualSecondaryRoutes, setManualSecondaryRoutes] = useState('');
  const [primaryRouteValidation, setPrimaryRouteValidation] = useState({ valid: false, message: '', routes: [] });
  const [secondaryRouteValidation, setSecondaryRouteValidation] = useState({ valid: false, message: '', routes: [] });
  const [suggestionsDialogOpen, setSuggestionsDialogOpen] = useState(false);
  const [routeSuggestions, setRouteSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionTarget, setSuggestionTarget] = useState('primary'); // 'primary' or 'secondary'

  // Data state
  const [locations, setLocations] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({});
  const [availableCurrencies, setAvailableCurrencies] = useState(['USD']); // Dynamic currency list
  const [carriers, setCarriers] = useState([]);
  const [circuitIds, setCircuitIds] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [pricingResults, setPricingResults] = useState(null);
  const [crossConnectResults, setCrossConnectResults] = useState({
    source: null,
    destination: null
  });
  const [mandatoryCrossConnects, setMandatoryCrossConnects] = useState({
    source: false,
    destination: false
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedAccordion, setExpandedAccordion] = useState('search');
  const [currentTab, setCurrentTab] = useState(0); // Tab state
  const [expandedLogs, setExpandedLogs] = useState(new Set()); // Track expanded log details
  const [logViewModes, setLogViewModes] = useState({}); // Track view mode per log: { logId: 'readable' | 'json' }
  const [parametersLocked, setParametersLocked] = useState(false); // Track if search parameters are locked
  
  // Pricing logs filtering and pagination state
  const [usersList, setUsersList] = useState([]);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [customerNameFilter, setCustomerNameFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [logDateFilter, setLogDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
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
    primaryPricing: false,
    secondaryPricing: false,
    protectedPricing: false
  });

  // KMZ Export dialog state
  const [kmzExportDialogOpen, setKmzExportDialogOpen] = useState(false);
  const [kmzExportType, setKmzExportType] = useState('primary'); // 'primary', 'secondary', 'both'
  const [kmzExporting, setKmzExporting] = useState(false);
  const [kmzExportProgress, setKmzExportProgress] = useState(0); // 0-100
  const [kmzExportStep, setKmzExportStep] = useState(''); // Current step description
  const [kmzMissingCircuitsDialogOpen, setKmzMissingCircuitsDialogOpen] = useState(false);
  const [kmzMissingCircuits, setKmzMissingCircuits] = useState([]);
  const [kmzExportDataPending, setKmzExportDataPending] = useState(null);
  const kmzAbortControllerRef = React.useRef(null);

  // Contract term options (only 12, 24, 36 months)
  const contractTerms = [
    { value: 12, label: '12 Months' },
    { value: 24, label: '24 Months' },
    { value: 36, label: '36 Months' }
  ];

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Clear expanded logs for read-only users
  useEffect(() => {
    if (isReadOnly && expandedLogs.size > 0) {
      console.log('NetworkDesignTool - Clearing expanded logs for read-only user');
      setExpandedLogs(new Set());
    }
    
    if (user) {
      console.log('NetworkDesignTool - User:', user.username);
      console.log('NetworkDesignTool - Network Design Permission:', networkDesignPermission);
      console.log('NetworkDesignTool - isReadOnly:', isReadOnly);
    }
  }, [user, networkDesignPermission, isReadOnly, expandedLogs]);

  // Auto-refresh exchange rates when component becomes visible (e.g., switching back from Exchange Rates module)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Component became visible, refresh exchange rates
        loadExchangeRates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Watch for source/destination changes - clear results and check mandatory cross connects
  useEffect(() => {
    const checkMandatoryCrossConnects = async () => {
      const checkLocation = async (locationCode, locationType) => {
        if (!locationCode) {
          setMandatoryCrossConnects(prev => ({ ...prev, [locationType]: false }));
          return;
        }

        const location = locations.find(loc => loc.location_code === locationCode);
        if (location && (location.cross_connect_mandatory || location.customer_owned_xc)) {
          setMandatoryCrossConnects(prev => ({ ...prev, [locationType]: true }));
          
          // Auto-enable cross connect for mandatory location if not already enabled
          if (!crossConnectResults[locationType]) {
            try {
              await handleToggleCrossConnect(locationType);
            } catch (err) {
              console.error(`Failed to auto-enable mandatory cross connect for ${locationType}:`, err);
            }
          }
        } else {
          setMandatoryCrossConnects(prev => ({ ...prev, [locationType]: false }));
        }
      };

      // Clear results when source or destination changes
      setSearchResults(null);
      setPricingResults(null);

      // Check mandatory status for source and destination
      await checkLocation(formData.source, 'source');
      await checkLocation(formData.destination, 'destination');
    };

    if (locations.length > 0) {
      checkMandatoryCrossConnects();
    }
  }, [formData.source, formData.destination, locations]);

  const loadExchangeRates = async () => {
    try {
      const exchangeRatesData = await networkDesignApi.getExchangeRates();
      
      // Convert exchange rates to object for easy lookup
      const ratesObj = {};
      const currencyCodes = ['USD']; // USD is always available as base currency
      
      exchangeRatesData.forEach(rate => {
        ratesObj[rate.currency_code] = rate.exchange_rate;
        if (!currencyCodes.includes(rate.currency_code)) {
          currencyCodes.push(rate.currency_code);
        }
      });
      
      setExchangeRates(ratesObj);
      setAvailableCurrencies(currencyCodes);
    } catch (err) {
      console.error('Failed to load exchange rates:', err);
      // Silently fail to avoid disrupting user experience
    }
  };

  const loadInitialData = async () => {
    try {
      const promises = [
        networkDesignApi.getLocations(),
        getCarriers()
      ];
      
      // Only load users list and audit logs if user can view pricing logs
      if (canViewPricingLogs) {
        // For provisioner and admin users, fetch users list for filter dropdown
        // Admin users always get the list, and provisioner level users also get it
        if (user && (user.role === 'administrator' || networkDesignPermission === 'provisioner')) {
          promises.push(networkDesignApi.getUsersList());
        }
      }
      
      const results = await Promise.all(promises);
      const [locationsData, carriersData, usersListData] = results;
      
      setLocations(locationsData);
      setCarriers(carriersData);
      
      // Set users list if available
      if (usersListData) {
        setUsersList(usersListData);
      }
      
      // Load audit logs separately with pagination
      if (canViewPricingLogs) {
        await loadAuditLogs();
      }
      
      // Load exchange rates separately
      await loadExchangeRates();
      
      // Mark initial load as complete to prevent duplicate loads from useEffect
      initialLoadComplete.current = true;
    } catch (err) {
      setError('Failed to load initial data: ' + err.message);
      initialLoadComplete.current = true; // Still mark complete on error to prevent loop
    }
  };

  const loadCircuitIds = async (search) => {
    try {
      const circuitIdsData = await networkDesignApi.getCircuitIds(search);
      setCircuitIds(circuitIdsData);
    } catch (err) {
      console.error('Failed to load circuit IDs:', err);
      setCircuitIds([]);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const params = {
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
      if (actionTypeFilter) {
        params.action_type = actionTypeFilter;
      }
      
      const response = await networkDesignApi.getAuditLogs(params);
      
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
        // Fallback for old format (backwards compatibility)
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
      setAuditLogs([]); // Ensure it's always an array on error
    }
  };

  // Helper function to format option label for display
  const getCircuitOptionLabel = (option) => {
    if (!option) return '';
    if (typeof option === 'string') {
      // Handle legacy string format (for backward compatibility)
      return option;
    }
    // Object format: {circuit_id, cable_system}
    if (option.cable_system) {
      return `${option.circuit_id} - ${option.cable_system}`;
    }
    return option.circuit_id;
  };

  // Helper function to extract circuit_id from option (for value storage)
  const getCircuitId = (option) => {
    if (!option) return '';
    if (typeof option === 'string') return option;
    return option.circuit_id;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const updates = { [field]: value };
      
      // Special handling for protectionRequired toggle
      if (field === 'protectionRequired') {
        if (value === true) {
          // When protection is enabled, disable Cisco Only Routes
          updates.useCiscoOnlyRoutes = false;
        } else {
          // When protection is disabled, re-enable Cisco Only Routes
          updates.useCiscoOnlyRoutes = true;
        }
      }
      
      return {
        ...prev,
        ...updates
      };
    });
  };

  const handleContractTermChange = async (newTerm) => {
    // Update form data with new contract term
    const updatedFormData = {
      ...formData,
      contractTerm: newTerm
    };
    setFormData(updatedFormData);

    // Recalculate pricing with new contract term
    if (searchResults && searchResults.primaryPath) {
      try {
        setLoading(true);
        const paths = [searchResults.primaryPath];
        if (searchResults.diversePath) paths.push(searchResults.diversePath);

        const pricingParams = {
          paths,
          contract_term: newTerm,
          output_currency: updatedFormData.outputCurrency,
          include_ull: updatedFormData.includeULL,
          use_cisco_only_routes: updatedFormData.useCiscoOnlyRoutes,
          bandwidth: parseFloat(updatedFormData.bandwidth),
          source: updatedFormData.source,
          destination: updatedFormData.destination,
          protection_required: updatedFormData.protectionRequired
        };

        const newPricingResults = await networkDesignApi.calculatePricing(pricingParams);
        
        // Preserve the path metadata (hops, latency) from original search results
        if (newPricingResults.results && searchResults) {
          newPricingResults.results = newPricingResults.results.map((result, index) => {
            const originalPath = index === 0 ? searchResults.primaryPath : searchResults.diversePath;
            if (originalPath) {
              return {
                ...result,
                hops: originalPath.hops || result.hops,
                totalLatency: originalPath.totalLatency || result.totalLatency
              };
            }
            return result;
          });
        }
        
        setPricingResults(newPricingResults);
      } catch (err) {
        setError('Failed to recalculate pricing: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  // Manual Route Entry Functions
  const handleDesignModeChange = (event) => {
    const newMode = event.target.value;
    
    if (newMode === 'manual' && searchResults) {
      // Convert auto-designed routes to manual entry
      const primaryCircuits = searchResults.primaryPath?.route?.map(r => r.circuit_id).join(', ') || '';
      const secondaryCircuits = searchResults.diversePath?.route?.map(r => r.circuit_id).join(', ') || '';
      
      setManualPrimaryRoutes(primaryCircuits);
      setManualSecondaryRoutes(secondaryCircuits);
      
      if (primaryCircuits || secondaryCircuits) {
        setSuccess('Auto-designed routes converted to manual entry');
      }
    }
    
    setDesignMode(newMode);
  };

  const validateManualRoutes = async (routeString, source, destination, pathType) => {
    if (!routeString.trim()) {
      return { valid: false, message: '', routes: [] };
    }

    const circuitIds = routeString.split(',').map(id => id.trim()).filter(id => id);
    
    if (circuitIds.length === 0) {
      return { valid: false, message: '', routes: [] };
    }

    const setValidation = pathType === 'primary' ? setPrimaryRouteValidation : setSecondaryRouteValidation;
    setValidation({ valid: false, message: `⏳ Validating ${circuitIds.length} route(s)...`, routes: [] });

    try {
      const routePromises = circuitIds.map(circuitId => 
        networkDesignApi.fetchRoute(circuitId).catch(err => null)
      );
      const routes = await Promise.all(routePromises);

      const notFound = circuitIds.filter((id, index) => routes[index] === null);
      
      if (notFound.length > 0) {
        setValidation({
          valid: false,
          message: `❌ ${notFound.length} route(s) not found: ${notFound.join(', ')}`,
          routes: routes.filter(r => r !== null)
        });
        return { valid: false, message: 'Routes not found', routes: routes.filter(r => r !== null) };
      }

      // Validate end-to-end connectivity
      const validRoutes = routes.filter(r => r !== null);
      const connectivityCheck = validateEndToEndConnectivity(validRoutes, source, destination);

      if (!connectivityCheck.valid) {
        setValidation({
          valid: false,
          message: `⚠️ ${connectivityCheck.message}`,
          routes: validRoutes,
          canFix: true
        });
        return { valid: false, message: connectivityCheck.message, routes: validRoutes, canFix: true };
      }

      setValidation({
        valid: true,
        message: `✅ All ${circuitIds.length} route(s) validated successfully`,
        routes: validRoutes
      });
      
      return { valid: true, message: 'Valid', routes: validRoutes };
    } catch (error) {
      setValidation({
        valid: false,
        message: `❌ Validation error: ${error.message}`,
        routes: []
      });
      return { valid: false, message: error.message, routes: [] };
    }
  };

  const validateEndToEndConnectivity = (routes, source, destination) => {
    if (routes.length === 0) {
      return { valid: false, message: 'No routes provided' };
    }

    let currentLocation = source;
    const path = [source];

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      
      if (route.location_a === currentLocation) {
        currentLocation = route.location_b;
        path.push(currentLocation);
      } else if (route.location_b === currentLocation) {
        currentLocation = route.location_a;
        path.push(currentLocation);
      } else {
        return {
          valid: false,
          message: `Route ${route.circuit_id} doesn't connect to ${currentLocation}. Path so far: ${path.join(' → ')}`
        };
      }
    }

    if (currentLocation !== destination) {
      return {
        valid: false,
        message: `Path ends at ${currentLocation} but destination is ${destination}. Path: ${path.join(' → ')}`
      };
    }

    return { valid: true, message: `Valid path: ${path.join(' → ')}` };
  };

  const handleManualPrimaryRoutesChange = async (value) => {
    setManualPrimaryRoutes(value);
    if (formData.source && formData.destination) {
      await validateManualRoutes(value, formData.source, formData.destination, 'primary');
    }
  };

  const handleManualSecondaryRoutesChange = async (value) => {
    setManualSecondaryRoutes(value);
    if (formData.source && formData.destination) {
      await validateManualRoutes(value, formData.source, formData.destination, 'secondary');
    }
  };

  const handleFindSuggestions = async (target = 'primary') => {
    if (!formData.source || !formData.destination) {
      setError('Please enter source and destination location');
      return;
    }
    
    if (!formData.bandwidth) {
      setError('Please enter bandwidth');
      return;
    }

    setSuggestionTarget(target);
    setSuggestionsLoading(true);
    setSuggestionsDialogOpen(true);

    try {
      const routeString = target === 'primary' ? manualPrimaryRoutes : manualSecondaryRoutes;
      const enteredCircuits = routeString.split(',').map(id => id.trim()).filter(id => id);
      
      // Track all visited locations and build the path
      const visitedLocations = new Set();
      const excludedCircuits = new Set(enteredCircuits);
      
      // CRITICAL: If finding secondary suggestions, also exclude ALL primary circuits AND locations
      if (target === 'secondary' && manualPrimaryRoutes) {
        const primaryCircuits = manualPrimaryRoutes.split(',').map(id => id.trim()).filter(id => id);
        primaryCircuits.forEach(cid => excludedCircuits.add(cid));
        console.log('Secondary suggestions - excluding primary circuits:', primaryCircuits);
        
        // Also track and exclude all intermediate locations from primary path
        try {
          const primaryValidation = await validateManualRoutes(manualPrimaryRoutes, formData.source, formData.destination, 'primary');
          if (primaryValidation.valid && primaryValidation.routes) {
            let primaryCurrentLoc = formData.source;
            primaryValidation.routes.forEach(route => {
              // Track intermediate locations (not source, not destination)
              const nextLoc = route.location_a === primaryCurrentLoc ? route.location_b : route.location_a;
              if (nextLoc !== formData.source && nextLoc !== formData.destination) {
                visitedLocations.add(nextLoc);
              }
              primaryCurrentLoc = nextLoc;
            });
            console.log('Secondary suggestions - excluding primary intermediate locations:', Array.from(visitedLocations));
          }
        } catch (err) {
          console.warn('Could not extract primary path locations:', err);
        }
      }
      
      let currentLocation = formData.source;
      visitedLocations.add(formData.source);
      
      if (enteredCircuits.length > 0) {
        // Build the complete path to find all visited locations
        try {
          const circuitData = [];
          
          // Fetch all entered circuits
          for (const cid of enteredCircuits) {
            try {
              const circuit = await networkDesignApi.fetchRoute(cid);
              if (circuit) {
                circuitData.push(circuit);
              }
            } catch (err) {
              console.warn(`Could not fetch circuit ${cid}`);
            }
          }
          
          // Walk through the path to track all visited locations
          for (const circuit of circuitData) {
            // Find which endpoint connects to our current location
            if (circuit.location_a === currentLocation) {
              currentLocation = circuit.location_b;
              visitedLocations.add(circuit.location_b);
            } else if (circuit.location_b === currentLocation) {
              currentLocation = circuit.location_a;
              visitedLocations.add(circuit.location_a);
            } else {
              console.warn(`Circuit ${circuit.circuit_id} doesn't connect to ${currentLocation}`);
              // Try to recover by checking both endpoints
              if (!visitedLocations.has(circuit.location_a)) {
                currentLocation = circuit.location_a;
                visitedLocations.add(circuit.location_a);
              } else if (!visitedLocations.has(circuit.location_b)) {
                currentLocation = circuit.location_b;
                visitedLocations.add(circuit.location_b);
              }
            }
          }
          
        } catch (err) {
          console.error('Error building path:', err);
        }
      }
      
      // Exclude all visited locations EXCEPT the current location and destination
      const excludedLocations = Array.from(visitedLocations).filter(
        loc => loc !== currentLocation && loc !== formData.destination
      );
      
      // Calculate total latency of entered circuits (frontend has this data from validation)
      let enteredCircuitsLatency = 0;
      const validation = target === 'primary' ? primaryRouteValidation : secondaryRouteValidation;
      if (validation.routes && validation.routes.length > 0) {
        enteredCircuitsLatency = validation.routes.reduce((sum, route) => {
          return sum + (parseFloat(route.expected_latency) || 0);
        }, 0);
        console.log('Calculated entered circuits total latency from validation:', enteredCircuitsLatency, 'ms');
      }
      
      console.log('Current location:', currentLocation);
      console.log('Visited locations:', Array.from(visitedLocations));
      console.log('Excluded locations:', excludedLocations);
      console.log('Entered circuits being sent to backend:', enteredCircuits);
      console.log('Total latency of entered circuits:', enteredCircuitsLatency, 'ms');

      const requestData = {
        currentLocation,
        destination: formData.destination,
        bandwidth: formData.bandwidth,
        bandwidth_unit: 'Mbps',
        excludedCircuits: Array.from(excludedCircuits),
        excludedLocations: excludedLocations,
        enteredCircuits: enteredCircuits,
        enteredCircuitsLatency: enteredCircuitsLatency, // Send pre-calculated latency from frontend
        source: formData.source,
        // Pass Auto Design rules to Find Suggestions
        include_ull: formData.includeULL,
        use_cisco_only_routes: formData.useCiscoOnlyRoutes,
        mtu_required: formData.mtuRequired ? parseFloat(formData.mtuRequired) : 1500,
        include_provisioning_routes: formData.includeProvisioningRoutes
      };

      console.log('Complete request data:', JSON.stringify(requestData, null, 2));

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${API_BASE_URL}/network_design/suggest_routes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get suggestions');
      }

      const data = await response.json();
      
      // Check if path is complete
      if (data.pathComplete) {
        setRouteSuggestions([]);
        setSuccess('Path complete - you have reached the destination!');
        setSuggestionsDialogOpen(false);
        return;
      }
      
      setRouteSuggestions(data.suggestions || []);
      
      // No need to set error here - the dialog will show the alert message
      // when routeSuggestions is empty
    } catch (error) {
      console.error('Route suggestions error:', error);
      const errorMessage = error.message || 'Failed to get route suggestions';
      
      // Check for specific error responses
      if (error.message && error.message.includes('No routes available')) {
        setError('No routes available from current location. Try using Auto Design mode.');
      } else if (error.name === 'AbortError') {
        setError('Request timed out - the search took too long. Try using Auto Design mode.');
      } else {
        setError('Failed to get route suggestions: ' + errorMessage);
      }
      
      setRouteSuggestions([]);
    } finally {
      setSuggestionsLoading(false); // Always stop loading
    }
  };

  const handleAddSuggestedRoute = async (circuitId) => {
    const currentRoutes = suggestionTarget === 'primary' ? manualPrimaryRoutes : manualSecondaryRoutes;
    const newRoutes = currentRoutes ? `${currentRoutes}, ${circuitId}` : circuitId;
    
    if (suggestionTarget === 'primary') {
      setManualPrimaryRoutes(newRoutes);
      await validateManualRoutes(newRoutes, formData.source, formData.destination, 'primary');
    } else {
      setManualSecondaryRoutes(newRoutes);
      await validateManualRoutes(newRoutes, formData.source, formData.destination, 'secondary');
    }
    
    // Close dialog immediately
    setSuggestionsDialogOpen(false);
    setRouteSuggestions([]);
    setExpandedAccordion('search'); // Revert back to search form
    
    // Show success message for 3 seconds (stays visible in top-right corner)
    setSuccess(`Route ${circuitId} added successfully!`);
  };

  const handleSuggestSecondaryPath = async () => {
    if (!formData.source || !formData.destination || !formData.bandwidth) {
      setError('Please enter source, destination, and bandwidth first');
      return;
    }

    console.log('\n=== SUGGEST SECONDARY PATH REQUEST ===');
    console.log('Source:', formData.source);
    console.log('Destination:', formData.destination);
    console.log('Bandwidth:', formData.bandwidth);
    console.log('Primary Routes Entered:', manualPrimaryRoutes);

    setLoading(true);
    try {
      // Build the manual primary path structure to send to backend
      let manualPrimaryPath = null;
      
      if (manualPrimaryRoutes && manualPrimaryRoutes.trim()) {
        console.log('Building manual primary path structure from:', manualPrimaryRoutes);
        
        // Validate manual routes first
        const validation = await validateManualRoutes(manualPrimaryRoutes, formData.source, formData.destination, 'primary');
        
        if (!validation.valid) {
          setError('Cannot suggest secondary path: Primary routes are invalid. ' + validation.message);
          setLoading(false);
          return;
        }
        
        // Build path structure (same helper function used in handleSearch)
        const buildPathFromRoutes = (routes, startLocation) => {
          let currentLoc = startLocation;
          const pathLocations = [startLocation];
          const segments = [];
          
          routes.forEach(route => {
            const segment = {
              circuit_id: route.circuit_id,
              from: currentLoc,
              to: route.location_a === currentLoc ? route.location_b : route.location_a,
              latency: parseFloat(route.expected_latency) || 0,
              cost: parseFloat(route.cost) || 0,
              currency: route.currency || 'USD',
              bandwidth: parseFloat(route.bandwidth) || 0,
              carrier: route.underlying_carrier,
              cable_system: route.cable_system || null
            };
            
            segments.push(segment);
            currentLoc = segment.to;
            pathLocations.push(currentLoc);
          });
          
          return {
            path: pathLocations,
            route: segments,
            totalLatency: routes.reduce((sum, r) => sum + (parseFloat(r.expected_latency) || 0), 0),
            hops: routes.length
          };
        };
        
        manualPrimaryPath = buildPathFromRoutes(validation.routes, formData.source);
        console.log('Manual primary path structure:', manualPrimaryPath);
      }
      
      // Use the existing find_path endpoint to get a diverse secondary path
      const requestBody = {
        source: formData.source,
        destination: formData.destination,
        bandwidth: formData.bandwidth,
        bandwidth_unit: 'Mbps',
        manualPrimaryPath: manualPrimaryPath, // Send manual primary path for protection calculation
        constraints: {
          protection_required: true,
          mtu_required: formData.mtuRequired ? parseFloat(formData.mtuRequired) : 1500,
          carrier_avoidance: formData.carrierAvoidance.length > 0 ? formData.carrierAvoidance : undefined,
          circuit_exclusion: formData.circuitExclusion.length > 0 ? formData.circuitExclusion : undefined
        },
        include_ull: formData.includeULL,
        use_cisco_only_routes: formData.useCiscoOnlyRoutes,
        use_100gb_and_df_only: formData.use100GbAndDFOnly,
        include_provisioning_routes: formData.includeProvisioningRoutes
      };

      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${API_BASE_URL}/network_design/find_path`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Secondary path error response:', errorData);
        throw new Error(errorData.error || 'Failed to find secondary path');
      }

      const data = await response.json();
      console.log('Secondary path response:', data);
      
      // Check protection status
      if (data.protectionStatus) {
        console.log('Protection Status:', data.protectionStatus);
        if (data.protectionStatus.failureReasons) {
          console.log('Failure Reasons:', data.protectionStatus.failureReasons);
        }
      }
      
      // Get the diverse path (second path)
      if (data.diversePath && data.diversePath.route) {
        console.log('✅ Diverse path found!');
        console.log('Diverse path route:', data.diversePath.route);
        const secondaryCircuits = data.diversePath.route.map(r => r.circuit_id).join(', ');
        console.log('Secondary circuits to add:', secondaryCircuits);
        
        setManualSecondaryRoutes(secondaryCircuits);
        await validateManualRoutes(secondaryCircuits, formData.source, formData.destination, 'secondary');
        setSuccess('Secondary path suggested successfully: ' + secondaryCircuits);
      } else {
        console.error('❌ No diverse path found in response');
        console.log('Protection required:', data.protectionStatus?.required);
        console.log('Protection available:', data.protectionStatus?.available);
        console.log('Protection message:', data.protectionStatus?.message);
        
        setError('No diverse secondary path found. ' + (data.protectionStatus?.message || 'Try adjusting constraints or use manual entry.'));
      }
    } catch (error) {
      console.error('Suggest secondary path error:', error);
      setError('Failed to suggest secondary path: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!formData.source || !formData.destination) {
      setError('Please select both source and destination locations');
      return;
    }

    // Validate bandwidth range
    const bandwidth = parseFloat(formData.bandwidth);
    if (bandwidth && (bandwidth < 10 || bandwidth > 10000)) {
      setError('Bandwidth must be between 10 and 10000 Mbps');
      return;
    }

    // Lock parameters when search/calculation begins
    setParametersLocked(true);

    setLoading(true);
    setError(null);
    setSearchResults(null);
    setPricingResults(null);

    try {
      let results;
      
      // Handle manual mode
      if (designMode === 'manual') {
        // Validate manual routes
        if (!manualPrimaryRoutes.trim()) {
          setError('Please enter primary routes');
          setLoading(false);
          return;
        }

        const primaryValidation = await validateManualRoutes(
          manualPrimaryRoutes,
          formData.source,
          formData.destination,
          'primary'
        );

        if (!primaryValidation.valid) {
          setError('Primary routes validation failed: ' + primaryValidation.message);
          setLoading(false);
          return;
        }

        // Build results object from manual routes
        // Transform database routes into proper segment format with cable system
        const buildPathFromRoutes = (routes, startLocation) => {
          let currentLoc = startLocation;
          const segments = [];
          
          routes.forEach(route => {
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
              from: currentLoc,
              to: route.location_a === currentLoc ? route.location_b : route.location_a,
              latency: parseFloat(route.expected_latency) || 0,
              cost: parseFloat(route.cost) || 0,
              currency: route.currency || 'USD',
              bandwidth: bandwidthValue, // Numeric value for calculations (200000 for Dark Fiber)
              bandwidthDisplay: bandwidthDisplay, // Display value ("Dark Fiber" or number)
              carrier: route.underlying_carrier,
              cable_system: route.cable_system || null
            };
            
            segments.push(segment);
            currentLoc = segment.to;
          });
          
          return {
            route: segments,
            path: [startLocation, ...segments.map(s => s.to)],
            totalLatency: routes.reduce((sum, r) => sum + (parseFloat(r.expected_latency) || 0), 0),
            totalCost: routes.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0),
            hops: routes.length
          };
        };
        
        results = {
          primaryPath: buildPathFromRoutes(primaryValidation.routes, formData.source)
        };

        // Handle secondary routes if protection is required
        if (formData.protectionRequired && manualSecondaryRoutes.trim()) {
          const secondaryValidation = await validateManualRoutes(
            manualSecondaryRoutes,
            formData.source,
            formData.destination,
            'secondary'
          );

          if (!secondaryValidation.valid) {
            setError('Secondary routes validation failed: ' + secondaryValidation.message);
            setLoading(false);
            return;
          }

          results.diversePath = buildPathFromRoutes(secondaryValidation.routes, formData.source);
        } else if (formData.protectionRequired && !manualSecondaryRoutes.trim()) {
          setError('Protection is required but no secondary routes entered. Use "Suggest Secondary Path" button.');
          setLoading(false);
          return;
        }
      } else {
        // Auto design mode - existing logic
        // Extract circuit IDs from exclusion list (converts objects to strings)
        const circuitExclusionIds = formData.circuitExclusion.map(item => getCircuitId(item));
        
        const searchParams = {
          source: formData.source,
          destination: formData.destination,
          bandwidth: formData.bandwidth ? parseFloat(formData.bandwidth) : undefined,
          bandwidth_unit: 'Mbps',
          include_ull: formData.includeULL,
          use_cisco_only_routes: formData.useCiscoOnlyRoutes,
          use_100gb_and_df_only: formData.use100GbAndDFOnly,
          include_provisioning_routes: formData.includeProvisioningRoutes,
          quoteRequestId: formData.quoteRequestId,
          customerName: formData.customerName,
          constraints: {
            protection_required: formData.protectionRequired,
            mtu_required: formData.mtuRequired ? parseFloat(formData.mtuRequired) : 1500, // Default to 1500 if not specified
            carrier_avoidance: formData.carrierAvoidance.length > 0 ? formData.carrierAvoidance : undefined,
            circuit_exclusion: circuitExclusionIds.length > 0 ? circuitExclusionIds : undefined
          }
        };

        console.log('Sending search request:', searchParams);
        results = await networkDesignApi.findPath(searchParams);
        console.log('Received search results:', results);
      }
      
      setSearchResults(results);
      setExpandedAccordion('results');

      // Automatically calculate pricing
      const paths = [results.primaryPath];
      if (results.diversePath) paths.push(results.diversePath);

      const pricingParams = {
        paths,
        contract_term: formData.contractTerm,
        output_currency: formData.outputCurrency,
        include_ull: formData.includeULL,
        use_cisco_only_routes: formData.useCiscoOnlyRoutes,
        use_100gb_and_df_only: formData.use100GbAndDFOnly,
        bandwidth: parseFloat(formData.bandwidth),
        source: formData.source,
        destination: formData.destination,
        protection_required: formData.protectionRequired,
        quoteRequestId: formData.quoteRequestId,
        customerName: formData.customerName,
        // Add design mode and manual route information
        design_mode: designMode,
        manual_primary_routes: designMode === 'manual' ? manualPrimaryRoutes : null,
        manual_secondary_routes: designMode === 'manual' ? manualSecondaryRoutes : null,
        mtu_required: formData.mtuRequired,
        carrier_avoidance: formData.carrierAvoidance,
        circuit_exclusion: formData.circuitExclusion
      };

      const pricing = await networkDesignApi.calculatePricing(pricingParams);
      setPricingResults(pricing);

      // Refresh audit logs to show the new search (only if user can view them)
      if (canViewPricingLogs) {
        try {
          const auditLogsData = await networkDesignApi.getAuditLogs();
          setAuditLogs(auditLogsData);
        } catch (logErr) {
          console.error('Failed to refresh audit logs:', logErr);
        }
      }

    } catch (err) {
      console.error('Search error:', err);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      
      // Check if the error has exclusion reasons (from 404 response)
      if (err.response && err.response.status === 404 && err.response.data && err.response.data.exclusionReasons) {
        const exclusionData = err.response.data.exclusionReasons;
        
        let errorMessage = 'No route available with current parameters.\n\n';
        const reasons = [];
        
        if (exclusionData.bandwidth.count > 0) {
          const requiredBw = exclusionData.bandwidth.routes[0]?.required_bandwidth;
          const availableBw = exclusionData.bandwidth.routes[0]?.available_bandwidth;
          reasons.push(`Bandwidth: ${exclusionData.bandwidth.count} routes excluded (required: ${requiredBw} Mbps, highest available: ${availableBw} Mbps)`);
        }
        
        if (exclusionData.carrier_avoidance.count > 0) {
          const carriers = exclusionData.carrier_avoidance.carriers.join(', ');
          reasons.push(`Carrier avoidance: ${exclusionData.carrier_avoidance.count} routes excluded (avoiding: ${carriers})`);
        }
        
        if (exclusionData.local_loop_carrier_avoidance && exclusionData.local_loop_carrier_avoidance.count > 0) {
          const localCarriers = exclusionData.local_loop_carrier_avoidance.carriers.join(', ');
          reasons.push(`Local loop carrier avoidance: ${exclusionData.local_loop_carrier_avoidance.count} routes excluded (avoiding: ${localCarriers})`);
        }
        
        if (exclusionData.mtu_requirement.count > 0) {
          const requiredMtu = exclusionData.mtu_requirement.routes[0]?.required_mtu;
          const availableMtu = exclusionData.mtu_requirement.routes[0]?.available_mtu;
          reasons.push(`MTU requirements: ${exclusionData.mtu_requirement.count} routes excluded (required: ${requiredMtu}, available: ${availableMtu})`);
        }
        
        if (exclusionData.ull_restriction.count > 0) {
          reasons.push(`ULL restriction: ${exclusionData.ull_restriction.count} Special/ULL routes excluded (Include ULL disabled)`);
        }
        
        if (exclusionData.equipment_restriction && exclusionData.equipment_restriction.count > 0) {
          reasons.push(`Equipment restriction: ${exclusionData.equipment_restriction.count} Cisco routes excluded (Include Cisco Only Routes disabled)`);
        }
        
        if (exclusionData.bandwidth_100gb_df_restriction && exclusionData.bandwidth_100gb_df_restriction.count > 0) {
          reasons.push(`100Gb/DF restriction: ${exclusionData.bandwidth_100gb_df_restriction.count} routes excluded (Use 100Gb and DF routes only enabled)`);
        }
        
        if (exclusionData.decommission_pop && exclusionData.decommission_pop.count > 0) {
          const decommissionedLocations = [...new Set(exclusionData.decommission_pop.routes.map(r => r.decommissioned_location))];
          reasons.push(`Decommissioned POPs: ${exclusionData.decommission_pop.count} routes excluded (locations: ${decommissionedLocations.join(', ')})`);
        }
        
        if (reasons.length > 0) {
          errorMessage += 'Constraints that prevented routing:\n• ' + reasons.join('\n• ');
          errorMessage += '\n\nSuggested actions:\n• Reduce bandwidth requirements\n• Remove carrier avoidance restrictions\n• Lower MTU requirements\n• Enable "Include ULL" if Special/ULL routes are acceptable\n• Enable "Include Cisco Only Routes" to include Cisco equipment\n• Try different source/destination locations';
        }
        
        errorMessage += `\n\nRoute analysis: ${exclusionData.total_routes_available} total routes, ${exclusionData.total_routes_excluded} excluded by constraints`;
        
        setError(errorMessage);
      } else if (err.response && err.response.status === 404) {
        // 404 without detailed exclusion data - show friendly message
        setError('No Route Available With Current Parameters, Please Try Again');
      } else {
        setError('Search failed: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle refresh - unlock parameters and reset all data
  const handleRefresh = () => {
    // Reset all form data to initial state
    setFormData({
      source: '',
      destination: '',
      bandwidth: '',
      includeULL: false,
      useCiscoOnlyRoutes: false,
      use100GbAndDFOnly: false,
      includeProvisioningRoutes: true,
      protectionRequired: false,
      mtuRequired: '',
      carrierAvoidance: [],
      circuitExclusion: [],
      outputCurrency: 'USD',
      contractTerm: 12,
      quoteRequestId: '',
      customerName: ''
    });

    // Reset manual route entry data
    setDesignMode('auto');
    setManualPrimaryRoutes('');
    setManualSecondaryRoutes('');
    setPrimaryRouteValidation({ valid: false, message: '', routes: [] });
    setSecondaryRouteValidation({ valid: false, message: '', routes: [] });

    // Clear all results
    setSearchResults(null);
    setPricingResults(null);
    setCrossConnectResults({
      source: null,
      destination: null
    });

    // Clear any errors or success messages
    setError(null);
    setSuccess(null);

    // Unlock parameters
    setParametersLocked(false);

    // Collapse results accordion and expand search accordion
    setExpandedAccordion('search');
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
    // Prevent read-only users from expanding logs
    if (user && user.role === 'read_only') {
      return;
    }
    
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  // Get view mode for a log (default to 'readable')
  const getLogViewMode = (logId) => {
    return logViewModes[logId] || 'readable';
  };

  // Set view mode for a log
  const setLogViewMode = (logId, mode) => {
    setLogViewModes(prev => ({ ...prev, [logId]: mode }));
  };

  // Render human-readable log details
  // Render Route Finder search log details (separate from Network Design logs)
  const renderRouteFinderLogDetails = (log) => {
    const params = log.parameters || log.pricing_data?.inputParameters;
    const pricingData = log.pricing_data || {};
    const routeResults = pricingData.routeResults || {};
    const promoPricing = pricingData.promoPricing || {};
    const crossConnectPricing = pricingData.crossConnectPricing || {};
    const marginAnalysis = pricingData.marginAnalysis || {};

    const formatPromoPriceDisplay = (price) => {
      if (price === null || price === undefined) return 'N/A';
      if (price === 0) return 'N/A';
      const currency = params?.outputCurrency || 'USD';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
    };

    const formatUSD = (amount) => {
      if (amount === null || amount === undefined) return 'N/A';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const tierLabels = {
      price_10mb: '10 Mbps',
      price_100mb: '100 Mbps',
      price_1000mb: '1000 Mbps',
      price_10gb: '10 Gbps'
    };

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Search Parameters */}
        {params && (
          <Card variant="outlined">
            <CardHeader 
              title="Search Parameters" 
              sx={{ pb: 1, '& .MuiCardHeader-title': { fontSize: '1rem', fontWeight: 600 } }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Source</Typography>
                  <Typography variant="body2" fontWeight="500">{params.source || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Destination</Typography>
                  <Typography variant="body2" fontWeight="500">{params.destination || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Bandwidth</Typography>
                  <Typography variant="body2" fontWeight="500">{params.bandwidth || 'Not specified'} Mbps</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Route Mode</Typography>
                  <Typography variant="body2" fontWeight="500">{params.routeMode === 'fastest' ? 'Fastest Route' : 'Standard Route'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">MTU Required</Typography>
                  <Typography variant="body2" fontWeight="500">{params.mtuRequired || '1500'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Output Currency</Typography>
                  <Typography variant="body2" fontWeight="500">{params.outputCurrency || 'USD'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Primary Path */}
        {routeResults.primaryPath && routeResults.primaryPath.route && (
          <Card variant="outlined">
            <CardHeader 
              title={
                <Box display="flex" alignItems="center" gap={1}>
                  <RouteIcon color="success" fontSize="small" />
                  <span>Primary Path</span>
                </Box>
              }
              subheader={routeResults.primaryPath.path ? routeResults.primaryPath.path.join(' → ') : ''}
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
                      <TableCell><strong>Cable System</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {routeResults.primaryPath.route.map((segment, index) => (
                      <TableRow key={index}>
                        <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                        <TableCell>{segment.from} → {segment.to}</TableCell>
                        <TableCell>{formatLatency(segment.latency)}ms</TableCell>
                        <TableCell>{segment.bandwidthDisplay === 'Dark Fiber' ? 'Dark Fiber' : (segment.bandwidth || 'N/A')}</TableCell>
                        <TableCell>{segment.cable_system || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ mt: 1.5, display: 'flex', gap: 3 }}>
                <Typography variant="body2"><strong>Total Latency:</strong> {formatLatency(routeResults.primaryPath.totalLatency)}ms RTD</Typography>
                <Typography variant="body2"><strong>Hops:</strong> {routeResults.primaryPath.hops || routeResults.primaryPath.route?.length}</Typography>
              </Box>

              {/* Primary Promo Pricing */}
              {promoPricing.primaryPromo ? (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'success.50', borderRadius: 1, border: 1, borderColor: 'success.200' }}>
                  <Typography variant="subtitle2" color="success.dark" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <LocalOfferIcon fontSize="small" /> Promo Pricing Available
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={3}><Typography variant="caption" color="text.secondary">10 Mbps</Typography><Typography variant="body2" fontWeight="bold">{formatPromoPriceDisplay(promoPricing.primaryPromo.price_10mb)}</Typography></Grid>
                    <Grid item xs={3}><Typography variant="caption" color="text.secondary">100 Mbps</Typography><Typography variant="body2" fontWeight="bold">{formatPromoPriceDisplay(promoPricing.primaryPromo.price_100mb)}</Typography></Grid>
                    <Grid item xs={3}><Typography variant="caption" color="text.secondary">1000 Mbps</Typography><Typography variant="body2" fontWeight="bold">{formatPromoPriceDisplay(promoPricing.primaryPromo.price_1000mb)}</Typography></Grid>
                    <Grid item xs={3}><Typography variant="caption" color="text.secondary">10 Gbps</Typography><Typography variant="body2" fontWeight="bold">{formatPromoPriceDisplay(promoPricing.primaryPromo.price_10gb)}</Typography></Grid>
                  </Grid>
                </Box>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
                  No promo pricing available for this path
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {/* Secondary/Diverse Path */}
        {routeResults.diversePath && routeResults.diversePath.route && (
          <Card variant="outlined">
            <CardHeader 
              title={
                <Box display="flex" alignItems="center" gap={1}>
                  <RouteIcon color="info" fontSize="small" />
                  <span>Secondary Path (Diverse)</span>
                </Box>
              }
              subheader={routeResults.diversePath.path ? routeResults.diversePath.path.join(' → ') : ''}
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
                      <TableCell><strong>Cable System</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {routeResults.diversePath.route.map((segment, index) => (
                      <TableRow key={index}>
                        <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                        <TableCell>{segment.from} → {segment.to}</TableCell>
                        <TableCell>{formatLatency(segment.latency)}ms</TableCell>
                        <TableCell>{segment.bandwidthDisplay === 'Dark Fiber' ? 'Dark Fiber' : (segment.bandwidth || 'N/A')}</TableCell>
                        <TableCell>{segment.cable_system || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ mt: 1.5, display: 'flex', gap: 3 }}>
                <Typography variant="body2"><strong>Total Latency:</strong> {formatLatency(routeResults.diversePath.totalLatency)}ms RTD</Typography>
                <Typography variant="body2"><strong>Hops:</strong> {routeResults.diversePath.hops || routeResults.diversePath.route?.length}</Typography>
              </Box>

              {/* Secondary Promo Pricing */}
              {promoPricing.secondaryPromo ? (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'success.50', borderRadius: 1, border: 1, borderColor: 'success.200' }}>
                  <Typography variant="subtitle2" color="success.dark" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <LocalOfferIcon fontSize="small" /> Promo Pricing Available
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={3}><Typography variant="caption" color="text.secondary">10 Mbps</Typography><Typography variant="body2" fontWeight="bold">{formatPromoPriceDisplay(promoPricing.secondaryPromo.price_10mb)}</Typography></Grid>
                    <Grid item xs={3}><Typography variant="caption" color="text.secondary">100 Mbps</Typography><Typography variant="body2" fontWeight="bold">{formatPromoPriceDisplay(promoPricing.secondaryPromo.price_100mb)}</Typography></Grid>
                    <Grid item xs={3}><Typography variant="caption" color="text.secondary">1000 Mbps</Typography><Typography variant="body2" fontWeight="bold">{formatPromoPriceDisplay(promoPricing.secondaryPromo.price_1000mb)}</Typography></Grid>
                    <Grid item xs={3}><Typography variant="caption" color="text.secondary">10 Gbps</Typography><Typography variant="body2" fontWeight="bold">{formatPromoPriceDisplay(promoPricing.secondaryPromo.price_10gb)}</Typography></Grid>
                  </Grid>
                </Box>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
                  No promo pricing available for this path
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {/* Protected Service Promo Pricing */}
        {promoPricing.protectedPromo && (
          <Card variant="outlined" sx={{ border: 2, borderColor: 'primary.main' }}>
            <CardHeader 
              title={
                <Box display="flex" alignItems="center" gap={1}>
                  <SecurityIcon color="primary" fontSize="small" />
                  <span>Protected Service Pricing</span>
                  <Chip icon={<LocalOfferIcon />} label="Promo Protected" color="primary" size="small" />
                </Box>
              }
              subheader="Both primary and secondary paths qualified for promo pricing"
              sx={{ pb: 1, '& .MuiCardHeader-title': { fontSize: '1rem', fontWeight: 600 } }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                $1,000 NRC applicable for each option - X/Cs Excluded - Full Terms available from Pricing Team
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={3}><Typography variant="caption" color="text.secondary">10 Mbps</Typography><Typography variant="body2" color="primary.dark" fontWeight="bold">{formatPromoPriceDisplay(promoPricing.protectedPromo.price_10mb)}</Typography></Grid>
                <Grid item xs={3}><Typography variant="caption" color="text.secondary">100 Mbps</Typography><Typography variant="body2" color="primary.dark" fontWeight="bold">{formatPromoPriceDisplay(promoPricing.protectedPromo.price_100mb)}</Typography></Grid>
                <Grid item xs={3}><Typography variant="caption" color="text.secondary">1000 Mbps</Typography><Typography variant="body2" color="primary.dark" fontWeight="bold">{formatPromoPriceDisplay(promoPricing.protectedPromo.price_1000mb)}</Typography></Grid>
                <Grid item xs={3}><Typography variant="caption" color="text.secondary">10 Gbps</Typography><Typography variant="body2" color="primary.dark" fontWeight="bold">{formatPromoPriceDisplay(promoPricing.protectedPromo.price_10gb)}</Typography></Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Cross Connect Pricing */}
        {(crossConnectPricing.source || crossConnectPricing.destination) && (
          <Card variant="outlined">
            <CardHeader 
              title={
                <Box display="flex" alignItems="center" gap={1}>
                  <CableIcon color="info" fontSize="small" />
                  <span>Cross Connect Pricing</span>
                </Box>
              }
              sx={{ pb: 1, '& .MuiCardHeader-title': { fontSize: '1rem', fontWeight: 600 } }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Grid container spacing={2}>
                {crossConnectPricing.source && (
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Source: {crossConnectPricing.source.datacenterName || crossConnectPricing.source.locationCode}
                        {crossConnectPricing.source.mandatory && <Chip label="Required" color="warning" size="small" sx={{ ml: 1 }} />}
                      </Typography>
                      {crossConnectPricing.source.customerOwned ? (
                        <Typography variant="body2" fontStyle="italic" color="text.secondary">Customer must provide X/C</Typography>
                      ) : (
                        <Box sx={{ display: 'flex', gap: 3 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">NRC</Typography>
                            <Typography variant="body2" fontWeight="500">{typeof crossConnectPricing.source.nrc === 'number' ? formatCurrency(crossConnectPricing.source.nrc, crossConnectPricing.source.currency || 'USD') : crossConnectPricing.source.nrc}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">MRC</Typography>
                            <Typography variant="body2" fontWeight="500">{typeof crossConnectPricing.source.mrc === 'number' ? formatCurrency(crossConnectPricing.source.mrc, crossConnectPricing.source.currency || 'USD') : crossConnectPricing.source.mrc}</Typography>
                          </Box>
                        </Box>
                      )}
                      {crossConnectPricing.source.notes && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontStyle: 'italic' }}>{crossConnectPricing.source.notes}</Typography>
                      )}
                    </Box>
                  </Grid>
                )}
                {crossConnectPricing.destination && (
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Destination: {crossConnectPricing.destination.datacenterName || crossConnectPricing.destination.locationCode}
                        {crossConnectPricing.destination.mandatory && <Chip label="Required" color="warning" size="small" sx={{ ml: 1 }} />}
                      </Typography>
                      {crossConnectPricing.destination.customerOwned ? (
                        <Typography variant="body2" fontStyle="italic" color="text.secondary">Customer must provide X/C</Typography>
                      ) : (
                        <Box sx={{ display: 'flex', gap: 3 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">NRC</Typography>
                            <Typography variant="body2" fontWeight="500">{typeof crossConnectPricing.destination.nrc === 'number' ? formatCurrency(crossConnectPricing.destination.nrc, crossConnectPricing.destination.currency || 'USD') : crossConnectPricing.destination.nrc}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">MRC</Typography>
                            <Typography variant="body2" fontWeight="500">{typeof crossConnectPricing.destination.mrc === 'number' ? formatCurrency(crossConnectPricing.destination.mrc, crossConnectPricing.destination.currency || 'USD') : crossConnectPricing.destination.mrc}</Typography>
                          </Box>
                        </Box>
                      )}
                      {crossConnectPricing.destination.notes && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontStyle: 'italic' }}>{crossConnectPricing.destination.notes}</Typography>
                      )}
                    </Box>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Margin Analysis & Pricing Logic */}
        {marginAnalysis && (marginAnalysis.primary || marginAnalysis.secondary || marginAnalysis.protected) && (
          <Card variant="outlined" sx={{ border: 1, borderColor: 'warning.main' }}>
            <CardHeader 
              title={
                <Box display="flex" alignItems="center" gap={1}>
                  <AttachMoneyIcon color="warning" fontSize="small" />
                  <span>Margin Analysis & Pricing Logic</span>
                </Box>
              }
              sx={{ pb: 1, '& .MuiCardHeader-title': { fontSize: '1rem', fontWeight: 600 } }}
            />
            <CardContent sx={{ pt: 0 }}>
              {/* Primary Path Margin Details */}
              {marginAnalysis.primary && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <RouteIcon fontSize="small" color="success" /> Primary Path Promo Margin Check
                    <Chip 
                      label={marginAnalysis.primary.valid ? 'PASSED' : (marginAnalysis.primary.reason || 'FAILED')} 
                      color={marginAnalysis.primary.valid ? 'success' : 'error'} 
                      size="small" 
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                  {marginAnalysis.primary.marginDetails && (
                    <TableContainer sx={{ mb: 1 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            <TableCell><strong>Tier</strong></TableCell>
                            <TableCell align="right"><strong>Promo Price</strong></TableCell>
                            <TableCell align="right"><strong>Allocated Cost</strong></TableCell>
                            <TableCell align="right"><strong>Actual Margin</strong></TableCell>
                            <TableCell align="right"><strong>Required Margin</strong></TableCell>
                            <TableCell align="center"><strong>Status</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(marginAnalysis.primary.marginDetails).map(([tierKey, detail]) => (
                            <TableRow key={tierKey} sx={{ bgcolor: detail.valid ? 'success.50' : 'error.50' }}>
                              <TableCell>{tierLabels[tierKey] || tierKey}</TableCell>
                              <TableCell align="right">{formatUSD(detail.price)}</TableCell>
                              <TableCell align="right">{formatUSD(detail.allocatedCost)}</TableCell>
                              <TableCell align="right" sx={{ color: detail.valid ? 'success.dark' : 'error.dark', fontWeight: 'bold' }}>
                                {detail.actualMargin !== undefined ? `${detail.actualMargin}%` : 'N/A'}
                              </TableCell>
                              <TableCell align="right">{detail.requiredMargin !== undefined ? `${detail.requiredMargin}%` : 'N/A'}</TableCell>
                              <TableCell align="center">
                                <Chip label={detail.valid ? 'Pass' : 'Fail'} color={detail.valid ? 'success' : 'error'} size="small" variant="outlined" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  {!marginAnalysis.primary.marginDetails && marginAnalysis.primary.reason && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      Reason: {marginAnalysis.primary.reason === 'no_promo_rule' ? 'No matching promo rule found' : 
                               marginAnalysis.primary.reason === 'margin_not_met' ? 'Minimum margin not met for any tier' :
                               marginAnalysis.primary.reason === 'no_path' ? 'No path available' : marginAnalysis.primary.reason}
                    </Typography>
                  )}
                </Box>
              )}

              {marginAnalysis.primary && marginAnalysis.secondary && <Divider sx={{ my: 1.5 }} />}

              {/* Secondary Path Margin Details */}
              {marginAnalysis.secondary && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <RouteIcon fontSize="small" color="info" /> Secondary Path Promo Margin Check
                    <Chip 
                      label={marginAnalysis.secondary.valid ? 'PASSED' : (marginAnalysis.secondary.reason || 'FAILED')} 
                      color={marginAnalysis.secondary.valid ? 'success' : 'error'} 
                      size="small" 
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                  {marginAnalysis.secondary.marginDetails && (
                    <TableContainer sx={{ mb: 1 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            <TableCell><strong>Tier</strong></TableCell>
                            <TableCell align="right"><strong>Promo Price</strong></TableCell>
                            <TableCell align="right"><strong>Allocated Cost</strong></TableCell>
                            <TableCell align="right"><strong>Actual Margin</strong></TableCell>
                            <TableCell align="right"><strong>Required Margin</strong></TableCell>
                            <TableCell align="center"><strong>Status</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(marginAnalysis.secondary.marginDetails).map(([tierKey, detail]) => (
                            <TableRow key={tierKey} sx={{ bgcolor: detail.valid ? 'success.50' : 'error.50' }}>
                              <TableCell>{tierLabels[tierKey] || tierKey}</TableCell>
                              <TableCell align="right">{formatUSD(detail.price)}</TableCell>
                              <TableCell align="right">{formatUSD(detail.allocatedCost)}</TableCell>
                              <TableCell align="right" sx={{ color: detail.valid ? 'success.dark' : 'error.dark', fontWeight: 'bold' }}>
                                {detail.actualMargin !== undefined ? `${detail.actualMargin}%` : 'N/A'}
                              </TableCell>
                              <TableCell align="right">{detail.requiredMargin !== undefined ? `${detail.requiredMargin}%` : 'N/A'}</TableCell>
                              <TableCell align="center">
                                <Chip label={detail.valid ? 'Pass' : 'Fail'} color={detail.valid ? 'success' : 'error'} size="small" variant="outlined" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  {!marginAnalysis.secondary.marginDetails && marginAnalysis.secondary.reason && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      Reason: {marginAnalysis.secondary.reason === 'no_promo_rule' ? 'No matching promo rule found' : 
                               marginAnalysis.secondary.reason === 'margin_not_met' ? 'Minimum margin not met for any tier' :
                               marginAnalysis.secondary.reason === 'no_path' ? 'No path available' : marginAnalysis.secondary.reason}
                    </Typography>
                  )}
                </Box>
              )}

              {marginAnalysis.protected && (marginAnalysis.primary || marginAnalysis.secondary) && <Divider sx={{ my: 1.5 }} />}

              {/* Protected Service Margin Details */}
              {marginAnalysis.protected && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SecurityIcon fontSize="small" color="primary" /> Protected Service Pricing Logic
                    <Chip 
                      label={marginAnalysis.protected.valid ? 'VALID' : 'NOT ELIGIBLE'} 
                      color={marginAnalysis.protected.valid ? 'primary' : 'default'} 
                      size="small" 
                      sx={{ ml: 1 }}
                    />
                    {marginAnalysis.protected.method && (
                      <Chip label={`Method: ${marginAnalysis.protected.method}`} size="small" variant="outlined" sx={{ ml: 0.5 }} />
                    )}
                  </Typography>
                  {marginAnalysis.protected.marginDetails && (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            <TableCell><strong>Tier</strong></TableCell>
                            <TableCell align="right"><strong>Combined Allocated Cost</strong></TableCell>
                            <TableCell align="right"><strong>1.7x Price</strong></TableCell>
                            <TableCell align="right"><strong>Margin-Based Price</strong></TableCell>
                            <TableCell align="right"><strong>Final Price</strong></TableCell>
                            <TableCell align="right"><strong>Required Margin</strong></TableCell>
                            <TableCell align="right"><strong>Actual Margin</strong></TableCell>
                            <TableCell align="center"><strong>Method Used</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(marginAnalysis.protected.marginDetails).map(([tierKey, detail]) => {
                            if (!detail.eligible) {
                              return (
                                <TableRow key={tierKey} sx={{ bgcolor: 'grey.100' }}>
                                  <TableCell>{tierLabels[tierKey] || tierKey}</TableCell>
                                  <TableCell colSpan={7} align="center">
                                    <Typography variant="caption" color="text.secondary" fontStyle="italic">
                                      Not eligible — underlying promo tier did not pass margin check
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              );
                            }
                            return (
                              <TableRow key={tierKey}>
                                <TableCell>{tierLabels[tierKey] || tierKey}</TableCell>
                                <TableCell align="right">{formatUSD(detail.allocatedCost)}</TableCell>
                                <TableCell align="right">{formatUSD(detail.price_1_7x)}</TableCell>
                                <TableCell align="right">{formatUSD(detail.marginBasedPrice)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                  {promoPricing.protectedPromo ? formatPromoPriceDisplay(promoPricing.protectedPromo[tierKey]) : formatUSD(Math.max(detail.price_1_7x || 0, detail.marginBasedPrice || 0))}
                                </TableCell>
                                <TableCell align="right">{detail.requiredMargin}%</TableCell>
                                <TableCell align="right" sx={{ color: detail.actualMargin >= detail.requiredMargin ? 'success.dark' : 'warning.dark', fontWeight: 'bold' }}>
                                  {detail.actualMargin}%
                                </TableCell>
                                <TableCell align="center">
                                  <Chip 
                                    label={detail.method === '1.7x' ? '1.7x Base' : 'Margin Override'} 
                                    color={detail.method === '1.7x' ? 'primary' : 'warning'} 
                                    size="small" 
                                    variant="outlined" 
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  {!marginAnalysis.protected.valid && !marginAnalysis.protected.marginDetails && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      Protected pricing not calculated — requires both primary and secondary paths to have valid promo pricing
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </Box>
    );
  };

  const renderHumanReadableLogDetails = (log) => {
    const params = log.parameters || log.pricing_data?.inputParameters;
    const results = log.results || log.pricing_data?.calculationResults;

    if (!params && !results) {
      return <Alert severity="info">No data available for this log</Alert>;
    }

    // Route Finder Search logs have a different structure
    if (log.action_type === 'ROUTE_FINDER_SEARCH') {
      return renderRouteFinderLogDetails(log);
    }

    // Extract path data from results
    const primaryPath = results?.primaryPath || results?.individual?.find(r => r.pathType === 'primary');
    const diversePath = results?.diversePath || results?.individual?.find(r => r.pathType === 'protection');
    const pricingResults = results?.results || results?.individual;
    const protectionPricing = results?.protectionPricing;

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
                  <Typography variant="caption" color="text.secondary">Protection Required</Typography>
                  <Typography variant="body2" fontWeight="500">{params.protection_required || params.protectionRequired ? 'Yes' : 'No'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Design Mode</Typography>
                  <Typography variant="body2" fontWeight="500">{params.design_mode === 'manual' ? 'Manual' : 'Auto Design'}</Typography>
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
                      <TableRow key={index}>
                        <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                        <TableCell>{segment.from} → {segment.to}</TableCell>
                        <TableCell>{formatLatency(segment.latency)}ms</TableCell>
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
                      <TableRow key={index}>
                        <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                        <TableCell>{segment.from} → {segment.to}</TableCell>
                        <TableCell>{formatLatency(segment.latency)}ms</TableCell>
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
                    <Card sx={{ height: '100%', bgcolor: result.pathType === 'primary' ? 'grey.50' : 'info.50' }}>
                      <CardHeader 
                        title={result.pathType === 'primary' ? 'Primary Path' : 'Secondary Path'}
                        subheader={`${pricing.contractTerm || 12}-Month Contract`}
                        sx={{ pb: 0, '& .MuiCardHeader-title': { fontSize: '0.95rem', fontWeight: 600 } }}
                      />
                      <CardContent sx={{ pt: 1 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Minimum Price</Typography>
                            <Typography variant="body1" color="error.main" fontWeight="600">
                              {formatCurrency(pricing.minimumPrice, pricing.currency)}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Suggested Price</Typography>
                            <Typography variant="body1" color="success.main" fontWeight="600">
                              {formatCurrency(pricing.suggestedPrice, pricing.currency)}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Setup Fee (NRC)</Typography>
                            <Typography variant="body2" fontWeight="500">
                              {pricing.nrcCharge > 0 ? formatCurrency(pricing.nrcCharge, pricing.currency) : 'FREE'}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}

              {/* Protected Service Pricing */}
              {protectionPricing && (
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
                          <Typography variant="caption" color="text.secondary">Minimum Price</Typography>
                          <Typography variant="body1" color="error.main" fontWeight="600">
                            {formatCurrency(protectionPricing.minimumPrice, protectionPricing.currency)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Suggested Price</Typography>
                          <Typography variant="body1" color="success.main" fontWeight="600">
                            {formatCurrency(protectionPricing.suggestedPrice, protectionPricing.currency)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Setup Fee (NRC)</Typography>
                          <Typography variant="body2" fontWeight="500">
                            {protectionPricing.nrcCharge > 0 ? formatCurrency(protectionPricing.nrcCharge, protectionPricing.currency) : 'FREE'}
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

        {/* Protection Status */}
        {results?.protectionStatus && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>Protection Status</Typography>
              <Chip 
                label={results.protectionStatus.message}
                color={results.protectionStatus.available === false && results.protectionStatus.required ? 'warning' : 'success'}
                size="small"
              />
            </CardContent>
          </Card>
        )}
      </Box>
    );
  };

  const formatReadableLogSummary = (log) => {
    try {
      const params = log.parameters || log.pricing_data?.inputParameters;
      
      if (!params) return "No parameter data available";

      let summary = "";

      // Route Finder specific summary
      if (log.action_type === 'ROUTE_FINDER_SEARCH') {
        if (params.source && params.destination) {
          summary += `Route: ${params.source} → ${params.destination} • `;
        }
        if (params.bandwidth) summary += `Bandwidth: ${params.bandwidth}Mb • `;
        if (params.routeMode) summary += `Mode: ${params.routeMode === 'fastest' ? 'Fastest' : 'Standard'} • `;
        if (params.outputCurrency) summary += `Currency: ${params.outputCurrency}`;
        summary = summary.replace(/ • $/, '');
        return summary || "Route Finder search";
      }
      
      // Customer and Request Info
      if (params.customer_name) summary += `Customer: ${params.customer_name} • `;
      if (params.quote_request_id) summary += `Quote ID: ${params.quote_request_id} • `;
      
      // Route Info
      if (params.source && params.destination) {
        summary += `Route: ${params.source} → ${params.destination} • `;
      }
      
      // Bandwidth
      if (params.bandwidth) summary += `Bandwidth: ${params.bandwidth}Mb • `;
      
      // Currency and Contract
      if (params.output_currency) summary += `Currency: ${params.output_currency} • `;
      if (params.contract_term) summary += `Contract: ${params.contract_term} months`;
      
      // Remove trailing separator
      summary = summary.replace(/ • $/, '');
      
      return summary || "Network design request";
    } catch (err) {
      return "Unable to parse log data";
    }
  };

  const formatReadableResultsSummary = (log) => {
    try {
      const results = log.results || log.pricing_data?.calculationResults;
      
      if (!results) return "No results available";

      // Route Finder specific results summary
      if (log.action_type === 'ROUTE_FINDER_SEARCH') {
        const pricingData = log.pricing_data || {};
        const promo = pricingData.promoPricing || {};
        const routes = pricingData.routeResults || {};
        let rfSummary = "";
        
        // Path info
        const primaryHops = routes.primaryPath?.hops || routes.primaryPath?.route?.length;
        const secondaryHops = routes.diversePath?.hops || routes.diversePath?.route?.length;
        if (primaryHops) rfSummary += `Primary: ${primaryHops} hops • `;
        if (secondaryHops) rfSummary += `Secondary: ${secondaryHops} hops • `;
        
        // Promo status
        if (promo.primaryPromo) rfSummary += `Primary Promo ✓ • `;
        if (promo.secondaryPromo) rfSummary += `Secondary Promo ✓ • `;
        if (promo.protectedPromo) rfSummary += `Protected Promo ✓`;
        
        rfSummary = rfSummary.replace(/ • $/, '');
        return rfSummary || "Route search completed";
      }

      let summary = "";
      
      // Primary and Protection paths
      if (results.results && results.results.length > 0) {
        const primaryPath = results.results.find(r => r.pathType === 'primary');
        const protectionPath = results.results.find(r => r.pathType === 'protection');
        
        if (primaryPath) {
          const currency = primaryPath.pricing?.currency || 'USD';
          const minPrice = primaryPath.pricing?.minimumPrice;
          const sugPrice = primaryPath.pricing?.suggestedPrice;
          if (minPrice && sugPrice) {
            summary += `Primary: ${formatCurrency(minPrice, currency)}-${formatCurrency(sugPrice, currency)} • `;
          }
        }
        
        if (protectionPath) {
          const currency = protectionPath.pricing?.currency || 'USD';
          const minPrice = protectionPath.pricing?.minimumPrice;
          const sugPrice = protectionPath.pricing?.suggestedPrice;
          if (minPrice && sugPrice) {
            summary += `Protection: ${formatCurrency(minPrice, currency)}-${formatCurrency(sugPrice, currency)} • `;
          }
        }
      }
      
      // Protected service pricing
      if (results.protectionPricing) {
        const currency = results.protectionPricing.currency || 'USD';
        const minPrice = results.protectionPricing.minimumPrice;
        const sugPrice = results.protectionPricing.suggestedPrice;
        if (minPrice && sugPrice) {
          summary += `Protected Service: ${formatCurrency(minPrice, currency)}-${formatCurrency(sugPrice, currency)} • `;
        }
        
        // Setup cost
        const nrc = results.protectionPricing.nrcCharge;
        if (nrc !== undefined) {
          summary += `Setup: ${nrc > 0 ? formatCurrency(nrc, currency) : 'FREE'}`;
        }
      }
      
      // Remove trailing separator
      summary = summary.replace(/ • $/, '');
      
      return summary || "Pricing calculated successfully";
    } catch (err) {
      return "Unable to parse results data";
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all pricing logs? This action cannot be undone.')) {
      return;
    }

    try {
      await networkDesignApi.clearAuditLogs();
      setAuditLogs([]);
      setSuccess('Pricing logs cleared successfully');
    } catch (err) {
      // Check for 403 Forbidden error
      if (err.response?.status === 403) {
        setError('User account forbidden to complete this action');
      } else {
        setError('Failed to clear pricing logs: ' + err.message);
      }
    }
  };

  const handleExportLogs = async () => {
    try {
      setSuccess('Preparing export...');
      // Use fetch directly to handle the file download properly
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/network_design/audit_logs/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Check for 403 Forbidden error
        if (response.status === 403) {
          throw new Error('User account forbidden to complete this action');
        } else {
          throw new Error(`Export failed: ${response.statusText}`);
        }
      }

      // Get the filename from the response header or use a default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'audit_logs_export.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('Pricing logs exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export pricing logs: ' + err.message);
    }
  };

  // Export Functions
  const handleExportOpen = () => {
    setExportDialogOpen(true);
  };

  const handleExportClose = () => {
    setExportDialogOpen(false);
    setExportOptions({
      primaryPricing: false,
      secondaryPricing: false,
      protectedPricing: false
    });
  };

  const handleExportOptionChange = (option) => {
    setExportOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  const generateEmailBody = () => {
    if (!pricingResults || !searchResults) return '';

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
      html += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>Currency</strong></td><td style="${tdStyle}">${pricing.currency}</td></tr>`;
      html += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>Contract Term</strong></td><td style="${tdStyle}">${pricing.contractTerm} months</td></tr>`;
      html += `</tbody></table>`;
      return html;
    };

    // Build HTML email body
    let emailBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;">`;
    
    // Header information
    emailBody += `<h2 style="color: #2E5090; border-bottom: 2px solid #4472C4; padding-bottom: 10px;">Network Design Pricing Results</h2>`;
    emailBody += `<table style="margin-bottom: 20px; font-family: Arial, sans-serif;">`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Customer Name:</td><td>${formData.customerName || 'Not Specified'}</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Quote Request ID:</td><td>${formData.quoteRequestId || 'Not Specified'}</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Source Location:</td><td>${getLocationDisplay(formData.source)}</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Destination Location:</td><td>${getLocationDisplay(formData.destination)}</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Bandwidth:</td><td>${formData.bandwidth} Mbps</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Quote Time & Date:</td><td>${new Date().toLocaleString()}</td></tr>`;
    emailBody += `</table>`;

    // Generate content based on selected options
    const hasAllThreeSelected = exportOptions.primaryPricing && exportOptions.secondaryPricing && exportOptions.protectedPricing;

    // Primary Path
    if (exportOptions.primaryPricing) {
      const primaryResult = pricingResults.results.find(r => r.pathType === 'primary');
      if (primaryResult && searchResults.primaryPath) {
        emailBody += generateRouteTable(searchResults.primaryPath, 'Primary');
        emailBody += formatPricingSection(primaryResult.pricing, 'Primary');
      }
    }

    // Secondary Path  
    if (exportOptions.secondaryPricing) {
      const secondaryResult = pricingResults.results.find(r => r.pathType === 'protection');
      if (secondaryResult && searchResults.diversePath) {
        emailBody += generateRouteTable(searchResults.diversePath, 'Secondary');
        emailBody += formatPricingSection(secondaryResult.pricing, 'Secondary');
      }
    }

    // Protected Pricing - special handling when all three are selected
    if (exportOptions.protectedPricing) {
      if (hasAllThreeSelected) {
        // Don't repeat route tables, just show protected pricing
        if (pricingResults.protectionPricing) {
          emailBody += formatPricingSection(pricingResults.protectionPricing, 'Protected Service');
        }
      } else {
        // Show both route tables and protected pricing
        if (searchResults.primaryPath) {
          emailBody += generateRouteTable(searchResults.primaryPath, 'Primary');
        }
        if (searchResults.diversePath) {
          emailBody += generateRouteTable(searchResults.diversePath, 'Secondary');
        }
        if (pricingResults.protectionPricing) {
          emailBody += formatPricingSection(pricingResults.protectionPricing, 'Protected Service');
        }
      }
    }

    // Cross Connect Information in HTML
    if (crossConnectResults.source || crossConnectResults.destination) {
      emailBody += `<h3 style="${headerStyle}">Cross Connect Information</h3>`;
      
      if (crossConnectResults.source) {
        const srcTags = [];
        if (crossConnectResults.source.mandatory) srcTags.push('Mandatory');
        if (crossConnectResults.source.customerOwned) srcTags.push('Customer Owned');
        const srcTagStr = srcTags.length > 0 ? ` (${srcTags.join(', ')})` : '';
        
        emailBody += `<h4 style="color: #666; margin-top: 15px; font-family: Arial, sans-serif;">Source Cross Connect${srcTagStr}</h4>`;
        emailBody += `<table style="${tableStyle}">`;
        emailBody += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>POP Name</strong></td><td style="${tdStyle}">${crossConnectResults.source.datacenterName} (${crossConnectResults.source.locationCode})</td></tr>`;
        emailBody += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>NRC</strong></td><td style="${tdStyle}">${crossConnectResults.source.nrc === 'Customer must provide X/C' ? 'Customer must provide X/C' : (crossConnectResults.source.nrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.source.nrc, crossConnectResults.source.currency))}</td></tr>`;
        emailBody += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>MRC</strong></td><td style="${tdStyle}">${crossConnectResults.source.mrc === 'Customer must provide X/C' ? 'Customer must provide X/C' : (crossConnectResults.source.mrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.source.mrc, crossConnectResults.source.currency))}</td></tr>`;
        if (crossConnectResults.source.notes) {
          emailBody += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>Notes</strong></td><td style="${tdStyle}">${crossConnectResults.source.notes}</td></tr>`;
        }
        if (!crossConnectResults.source.customerOwned) {
          emailBody += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>Currency</strong></td><td style="${tdStyle}">${crossConnectResults.source.currency}</td></tr>`;
        }
        emailBody += `</table>`;
      }

      if (crossConnectResults.destination) {
        const destTags = [];
        if (crossConnectResults.destination.mandatory) destTags.push('Mandatory');
        if (crossConnectResults.destination.customerOwned) destTags.push('Customer Owned');
        const destTagStr = destTags.length > 0 ? ` (${destTags.join(', ')})` : '';
        
        emailBody += `<h4 style="color: #666; margin-top: 15px; font-family: Arial, sans-serif;">Destination Cross Connect${destTagStr}</h4>`;
        emailBody += `<table style="${tableStyle}">`;
        emailBody += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>POP Name</strong></td><td style="${tdStyle}">${crossConnectResults.destination.datacenterName} (${crossConnectResults.destination.locationCode})</td></tr>`;
        emailBody += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>NRC</strong></td><td style="${tdStyle}">${crossConnectResults.destination.nrc === 'Customer must provide X/C' ? 'Customer must provide X/C' : (crossConnectResults.destination.nrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.destination.nrc, crossConnectResults.destination.currency))}</td></tr>`;
        emailBody += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>MRC</strong></td><td style="${tdStyle}">${crossConnectResults.destination.mrc === 'Customer must provide X/C' ? 'Customer must provide X/C' : (crossConnectResults.destination.mrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.destination.mrc, crossConnectResults.destination.currency))}</td></tr>`;
        if (crossConnectResults.destination.notes) {
          emailBody += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>Notes</strong></td><td style="${tdStyle}">${crossConnectResults.destination.notes}</td></tr>`;
        }
        if (!crossConnectResults.destination.customerOwned) {
          emailBody += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>Currency</strong></td><td style="${tdStyle}">${crossConnectResults.destination.currency}</td></tr>`;
        }
        emailBody += `</table>`;
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
    emailBody += `<li>Any additional 3rd Party costs incurred on order of the service will be chargeable to the customer, including but not limited to cross connects, additional cabling, out of hours charges, etc</li>`;
    emailBody += `<li>Unless otherwise stated any additional costs incurred for out of hours work will be chargeable to the customer.</li>`;
    emailBody += `<li>Customer must provide all necessary rack space and power supply.</li>`;
    emailBody += `<li>Pricing is for connectivity only, and does not include any fees associated with data feeds unless specified otherwise within the quotation.</li>`;
    emailBody += `<li>IPC reserves the right to correct any computational errors in this quote.</li>`;
    emailBody += `<li>Where Pricing is associated with a network or multi circuit design, individual element pricing is indicative, and cannot be ordered as individual elements.</li>`;
    emailBody += `</ul>`;
    emailBody += `</div>`;

    emailBody += `</body></html>`;

    return emailBody;
  };

  const handleExportConfirm = () => {
    // Check if at least one option is selected
    const hasSelection = Object.values(exportOptions).some(Boolean);
    if (!hasSelection) {
      setError('Please select at least one pricing option to export');
      return;
    }

    try {
      // Generate email content
      const emailBody = generateEmailBody();
      
      // Generate subject line
      const today = new Date().toLocaleDateString();
      const subject = `${formData.quoteRequestId || 'Quote'} - ${formData.customerName || 'Customer'} - Pricing Request - ${today}`;
      
      console.log('Creating downloadable .eml email file');
      
      // Always create downloadable .eml file for reliability
      handleDownloadEmailFile(emailBody, subject);
      
    } catch (error) {
      console.error('Email export error:', error);
      // Fallback to clipboard copy
      const emailBody = generateEmailBody();
      const today = new Date().toLocaleDateString();
      const subject = `${formData.quoteRequestId || 'Quote'} - ${formData.customerName || 'Customer'} - Pricing Request - ${today}`;
      handleCopyToClipboard(emailBody, subject);
    }
  };

  const handleDownloadEmailFile = (emailBody, subject) => {
    try {
      // Create proper .eml email file content with HTML
      const timestamp = new Date().toISOString();
      const emailContent = [
        `From: Network Design Tool <noreply@ipc.com>`,
        `To: `,
        `Subject: ${subject}`,
        `Date: ${timestamp}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        `Content-Transfer-Encoding: 8bit`,
        ``,
        emailBody
      ].join('\r\n');
      
      // Create blob as .eml file
      const blob = new Blob([emailContent], { type: 'message/rfc822' });
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      
      // Generate filename with timestamp
      const fileTimestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const customerName = (formData.customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
      const quoteId = (formData.quoteRequestId || 'Quote').replace(/[^a-zA-Z0-9]/g, '_');
      downloadLink.download = `${quoteId}_${customerName}_Pricing_${fileTimestamp}.eml`;
      
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      // Close dialog and show success message
      handleExportClose();
      setSuccess('Email file (.eml) downloaded - double-click to open in your email client');
      
    } catch (downloadError) {
      console.error('File download failed:', downloadError);
      // Final fallback to clipboard
      const emailBody = generateEmailBody();
      const today = new Date().toLocaleDateString();
      const subject = `${formData.quoteRequestId || 'Quote'} - ${formData.customerName || 'Customer'} - Pricing Request - ${today}`;
      handleCopyToClipboard(emailBody, subject);
    }
  };

  const handleCopyToClipboard = async (emailBody, subject) => {
    try {
      const fullContent = `Subject: ${subject}\n\n${emailBody}`;
      await navigator.clipboard.writeText(fullContent);
      handleExportClose();
      setSuccess('Email content copied to clipboard - paste into your email client');
    } catch (clipboardError) {
      console.error('Clipboard copy failed:', clipboardError);
      // Final fallback - show in a new window
      showEmailInNewWindow(emailBody, subject);
    }
  };

  const showEmailInNewWindow = (emailBody, subject) => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Export</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { background: #1976d2; color: white; padding: 15px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
            .subject { font-weight: bold; margin-bottom: 10px; color: #333; }
            .content { white-space: pre-wrap; font-family: monospace; background: #f8f9fa; padding: 15px; border-radius: 4px; border: 1px solid #dee2e6; }
            .buttons { margin-top: 20px; text-align: center; }
            button { background: #1976d2; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 0 5px; }
            button:hover { background: #1565c0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📧 Email Export - Copy and Paste</h2>
            </div>
            <div class="subject">Subject: ${subject}</div>
            <div class="content">${emailBody}</div>
            <div class="buttons">
              <button onclick="selectAll()">Select All</button>
              <button onclick="copyToClipboard()">Copy to Clipboard</button>
              <button onclick="window.close()">Close</button>
            </div>
          </div>
          <script>
            function selectAll() {
              const content = document.querySelector('.content');
              const range = document.createRange();
              range.selectNodeContents(content);
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
            }
            
            function copyToClipboard() {
              const subject = '${subject}';
              const body = \`${emailBody.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
              const fullContent = 'Subject: ' + subject + '\\n\\n' + body;
              navigator.clipboard.writeText(fullContent).then(() => {
                alert('Content copied to clipboard!');
              }).catch(() => {
                selectAll();
                alert('Please copy the selected text manually');
              });
            }
          </script>
        </body>
        </html>
      `);
      newWindow.document.close();
      handleExportClose();
      setSuccess('Email content opened in new window - copy and paste into your email client');
    } else {
      handleExportClose();
      setError('Unable to open email client or new window. Please check your browser settings.');
    }
  };

  // KMZ Export Functions
  const handleKMZExportOpen = () => {
    setKmzExportDialogOpen(true);
  };

  const handleKMZExportClose = () => {
    // Abort any in-progress KMZ export request
    if (kmzAbortControllerRef.current) {
      kmzAbortControllerRef.current.abort();
      kmzAbortControllerRef.current = null;
    }
    setKmzExportDialogOpen(false);
    setKmzExportType('primary');
    setKmzExportProgress(0);
    setKmzExportStep('');
    setKmzExporting(false);
  };

  const handleMissingCircuitsCancel = () => {
    setKmzMissingCircuitsDialogOpen(false);
    setKmzMissingCircuits([]);
    setKmzExportDataPending(null);
  };

  const handleMissingCircuitsContinue = async () => {
    setKmzMissingCircuitsDialogOpen(false);
    setKmzMissingCircuits([]);
    
    if (kmzExportDataPending) {
      await performKMZExport(kmzExportDataPending);
      setKmzExportDataPending(null);
    }
  };

  const performKMZExport = async (exportData) => {
    // Create AbortController for this export so user can cancel
    const abortController = new AbortController();
    kmzAbortControllerRef.current = abortController;

    try {
      setKmzExporting(true);
      console.log('Performing KMZ export with data:', exportData);

      // Calculate total circuit count for progress messages
      const primaryCount = exportData.primaryCircuits?.length || 0;
      const secondaryCount = exportData.secondaryCircuits?.length || 0;
      const totalCircuits = (exportData.exportType === 'primary' ? primaryCount : 
                             exportData.exportType === 'secondary' ? secondaryCount : 
                             primaryCount + secondaryCount);

      // Step 1: Validating circuits
      setKmzExportStep(`Validating ${totalCircuits} circuit${totalCircuits !== 1 ? 's' : ''}...`);
      setKmzExportProgress(15);
      await new Promise(resolve => setTimeout(resolve, 300)); // Brief delay for UX

      // Step 2: Loading circuit KMZ files (this is the longest step)
      setKmzExportStep(`Loading ${totalCircuits} circuit KMZ file${totalCircuits !== 1 ? 's' : ''}...`);
      setKmzExportProgress(40);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 2a: Show more detail during the long backend processing
      setKmzExportStep(`Processing circuit coordinates... (${totalCircuits} file${totalCircuits !== 1 ? 's' : ''})`);
      setKmzExportProgress(45);
      await new Promise(resolve => setTimeout(resolve, 100));

      setKmzExportStep(`Extracting route geometry from ${totalCircuits} circuit${totalCircuits !== 1 ? 's' : ''}...`);
      setKmzExportProgress(50);
      await new Promise(resolve => setTimeout(resolve, 100));

      setKmzExportStep('Parsing KML data and validating coordinates...');
      setKmzExportProgress(55);

      // Call API to export (this is where the actual long processing happens)
      // AbortController signal allows user to cancel if it takes too long
      const response = await exportNetworkDesignKMZ(exportData, abortController.signal);

      // Step 3: Combining routes
      setKmzExportStep('Merging route segments and applying styling...');
      setKmzExportProgress(70);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 4: Generating KMZ file
      setKmzExportStep('Building final KMZ package...');
      setKmzExportProgress(90);

      // Check if there were skipped circuits in the response headers
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        // Error response
        const errorData = await response.data.text();
        const error = JSON.parse(errorData);
        throw new Error(error.error || 'Failed to export KMZ');
      }

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from Content-Disposition header if available
      console.log('All response headers:', response.headers);
      
      const disposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
      let filename = 'network_design.kmz';
      
      console.log('Content-Disposition header:', disposition);
      
      if (disposition) {
        // Try multiple patterns to extract filename
        // Pattern 1: filename*=UTF-8''encoded (RFC 5987)
        let filenameMatch = disposition.match(/filename\*=UTF-8''([^;\s]+)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = decodeURIComponent(filenameMatch[1]);
          console.log('Extracted filename (RFC 5987):', filename);
        } else {
          // Pattern 2: filename="quoted"
          filenameMatch = disposition.match(/filename="([^"]+)"/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
            console.log('Extracted filename (quoted):', filename);
          } else {
            // Pattern 3: filename=unquoted
            filenameMatch = disposition.match(/filename=([^;\s]+)/);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1].trim().replace(/"/g, '');
              console.log('Extracted filename (unquoted):', filename);
            }
          }
        }
      } else {
        console.warn('No Content-Disposition header found!');
      }
      
      console.log('Final download filename:', filename);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Step 5: Complete
      kmzAbortControllerRef.current = null;
      setKmzExportStep('Export complete!');
      setKmzExportProgress(100);
      await new Promise(resolve => setTimeout(resolve, 500)); // Show completion briefly

      setSuccess('KMZ file exported successfully');
      handleKMZExportClose();
      setKmzExporting(false);
      setKmzExportProgress(0);
      setKmzExportStep('');

    } catch (error) {
      // Clean up abort controller reference
      kmzAbortControllerRef.current = null;

      // Handle user cancellation gracefully (don't show error)
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || error.message === 'canceled') {
        console.log('KMZ export cancelled by user');
        setKmzExporting(false);
        setKmzExportProgress(0);
        setKmzExportStep('');
        return;
      }

      console.error('KMZ export error:', error);
      
      // Handle timeout
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        setError('KMZ export timed out. The route may contain too many path segments. Please try exporting primary or secondary paths separately instead of both.');
        setKmzExporting(false);
        setKmzExportProgress(0);
        setKmzExportStep('');
        return;
      }

      // Handle blob error response (when responseType is 'blob')
      let errorMessage = 'Unknown error occurred';
      
      if (error.response?.data instanceof Blob) {
        // Error response is a blob, need to read it as text
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorData.message || text;
        } catch (parseError) {
          console.error('Could not parse error blob:', parseError);
          errorMessage = 'Server returned an error';
        }
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(`Failed to export KMZ: ${errorMessage}`);
      setKmzExporting(false);
      setKmzExportProgress(0);
      setKmzExportStep('');
      throw error;
    }
  };

  const handleKMZExport = async () => {
    try {
      setKmzExporting(true);
      setError(null);

      // Validate that we have search results
      if (!searchResults) {
        setError('No route design available to export');
        setKmzExporting(false);
        return;
      }

      // Extract circuit IDs from routes
      const primaryCircuits = searchResults.primaryPath?.route?.map(r => r.circuit_id) || [];
      const secondaryCircuits = searchResults.diversePath?.route?.map(r => r.circuit_id) || [];

      // Validate based on export type
      if (kmzExportType === 'primary' && primaryCircuits.length === 0) {
        setError('No primary route available to export');
        setKmzExporting(false);
        return;
      }

      if (kmzExportType === 'secondary' && secondaryCircuits.length === 0) {
        setError('No secondary route available to export');
        setKmzExporting(false);
        return;
      }

      if (kmzExportType === 'both' && primaryCircuits.length === 0 && secondaryCircuits.length === 0) {
        setError('No routes available to export');
        setKmzExporting(false);
        return;
      }

      // Prepare export data
      const exportData = {
        primaryCircuits,
        secondaryCircuits,
        sourceLocationCode: formData.source,
        destLocationCode: formData.destination,
        quoteRequestId: formData.quoteRequestId || 'Quote',
        customerName: formData.customerName || 'Customer',
        exportType: kmzExportType
      };

      console.log('Checking KMZ availability for:', exportData);

      // First, check KMZ availability
      const availabilityResponse = await checkKMZAvailability(exportData);
      const availabilityData = availabilityResponse.data;

      console.log('KMZ availability check:', availabilityData);

      // If there are unavailable circuits, show confirmation dialog
      if (availabilityData.unavailableCircuits && availabilityData.unavailableCircuits.length > 0) {
        if (!availabilityData.canProceed) {
          setError('Cannot export KMZ: All circuits are missing KMZ files');
          setKmzExporting(false);
          return;
        }

        // Store export data and show confirmation dialog
        setKmzExportDataPending(exportData);
        setKmzMissingCircuits(availabilityData.unavailableCircuits);
        setKmzMissingCircuitsDialogOpen(true);
        setKmzExporting(false);
        return;
      }

      // No missing circuits, proceed directly
      await performKMZExport(exportData);

    } catch (error) {
      console.error('KMZ export error:', error);
      console.error('Error status:', error.response?.status);
      
      // Handle blob error response (when responseType is 'blob')
      let errorMessage = 'Unknown error occurred';
      
      if (error.response?.data instanceof Blob) {
        // Error response is a blob, need to read it as text
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorData.message || text;
          console.error('Error response (parsed):', errorData);
        } catch (parseError) {
          console.error('Could not parse error blob:', parseError);
          errorMessage = 'Server returned an error';
        }
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(`Failed to export KMZ: ${errorMessage}`);
    } finally {
      setKmzExporting(false);
    }
  };

  // Pricing Log Export Function
  const handleExportPricingLog = (log) => {
    try {
      // Extract data from log
      const params = log.parameters || log.pricing_data?.inputParameters;
      const results = log.results || log.pricing_data?.calculationResults;
      
      if (!params || !results) {
        setError('Unable to export - missing pricing data in log');
        return;
      }

      // Generate email content for pricing log
      const emailBody = generatePricingLogEmailBody(params, results);
      
      // Generate subject line
      const logDate = new Date(log.timestamp).toLocaleDateString();
      const subject = `${params.quoteRequestId || params.quote_request_id || 'Quote'} - ${params.customerName || params.customer_name || 'Customer'} - Pricing Request - ${logDate}`;
      
      // Create .eml file
      handleDownloadEmailFile(emailBody, subject);
      
    } catch (error) {
      console.error('Pricing log export error:', error);
      setError('Failed to export pricing log: ' + error.message);
    }
  };

  // Reload search from pricing log
  const handleReloadFromLog = (log) => {
    try {
      const params = log.parameters || log.pricing_data?.inputParameters;
      
      if (!params) {
        setError('Unable to reload - missing parameters in log');
        return;
      }

      // Set form data from log parameters
      setFormData(prev => ({
        ...prev,
        source: params.source || '',
        destination: params.destination || '',
        bandwidth: params.bandwidth?.toString() || '',
        includeULL: params.include_ull || params.includeULL || false,
        useCiscoOnlyRoutes: params.use_cisco_only_routes || params.useCiscoOnlyRoutes || false,
        use100GbAndDFOnly: params.use_100gb_and_df_only || params.use100GbAndDFOnly || false,
        includeProvisioningRoutes: params.include_provisioning_routes ?? params.includeProvisioningRoutes ?? true,
        protectionRequired: params.protection_required || params.protectionRequired || false,
        mtuRequired: params.mtu_required || params.mtuRequired || '',
        carrierAvoidance: params.carrier_avoidance || params.carrierAvoidance || [],
        circuitExclusion: params.circuit_exclusion || params.circuitExclusion || [],
        outputCurrency: params.output_currency || params.outputCurrency || 'USD',
        contractTerm: params.contract_term || params.contractTerm || 12,
        quoteRequestId: params.quoteRequestId || params.quote_request_id || '',
        customerName: params.customerName || params.customer_name || ''
      }));

      // Restore design mode and manual routes if available
      const mode = params.design_mode || 'auto';
      setDesignMode(mode);
      
      if (mode === 'manual') {
        setManualPrimaryRoutes(params.manual_primary_routes || '');
        setManualSecondaryRoutes(params.manual_secondary_routes || '');
        
        // Validate manual routes if they exist
        if (params.manual_primary_routes) {
          validateManualRoutes(params.manual_primary_routes, params.source, params.destination, 'primary');
        }
        if (params.manual_secondary_routes) {
          validateManualRoutes(params.manual_secondary_routes, params.source, params.destination, 'secondary');
        }
      } else {
        // Clear manual routes for auto mode
        setManualPrimaryRoutes('');
        setManualSecondaryRoutes('');
        setPrimaryRouteValidation({ valid: false, message: '', routes: [] });
        setSecondaryRouteValidation({ valid: false, message: '', routes: [] });
      }

      // Switch to the Network Design tab
      setCurrentTab(0);
      setExpandedAccordion('search');
      
      setSuccess(`Search parameters loaded from pricing log (${mode} mode). You can modify and re-run the search.`);
      
    } catch (error) {
      console.error('Reload from log error:', error);
      setError('Failed to reload search: ' + error.message);
    }
  };

  const generatePricingLogEmailBody = (params, results) => {
    // Helper function to get location display as "Datacenter Name (POP_CODE)"
    const getLocationDisplay = (locationCode) => {
      const location = locations.find(loc => loc.location_code === locationCode);
      if (location && location.datacenter_name) {
        return `${location.datacenter_name} (${locationCode})`;
      }
      return locationCode || 'Not Specified';
    };

    // Common HTML styles
    const tableStyle = 'border-collapse: collapse; width: 100%; margin-bottom: 20px; font-family: Arial, sans-serif;';
    const thStyle = 'border: 1px solid #ddd; padding: 10px; background-color: #4472C4; color: white; text-align: left; font-weight: bold;';
    const tdStyle = 'border: 1px solid #ddd; padding: 8px; text-align: left;';
    const headerStyle = 'color: #2E5090; margin-top: 20px; margin-bottom: 10px; font-family: Arial, sans-serif;';

    // Helper function to generate route table from log data in HTML
    const generateRouteTableFromLog = (pathData, pathType) => {
      const routeData = pathData?.route || pathData?.routes || pathData?.path || pathData?.hops;
      
      if (!routeData || (!Array.isArray(routeData) && !routeData.length)) {
        return '';
      }
      
      const routes = Array.isArray(routeData) ? routeData : [routeData];
      
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
      
      routes.forEach((segment, index) => {
        const rowBg = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
        const circuitId = segment.circuit_id || segment.circuitId || segment.circuit || 'N/A';
        const from = segment.from || segment.location_a || segment.source || 'N/A';
        const to = segment.to || segment.location_b || segment.destination || 'N/A';
        const location = segment.location || `${from} → ${to}`;
        const latency = segment.latency || 0;
        const carrier = segment.carrier || segment.underlying_carrier || 'N/A';
        const cableSystem = segment.cable_system || segment.cableSystem || 'N/A';
        
        tableHtml += `<tr style="background-color: ${rowBg};">`;
        tableHtml += `<td style="${tdStyle}">${circuitId}</td>`;
        tableHtml += `<td style="${tdStyle}">${location}</td>`;
        tableHtml += `<td style="${tdStyle}">${formatLatency(latency)}ms</td>`;
        tableHtml += `<td style="${tdStyle}">${carrier}</td>`;
        tableHtml += `<td style="${tdStyle}">${cableSystem}</td>`;
        tableHtml += `</tr>`;
      });
      
      tableHtml += `</tbody></table>`;
      tableHtml += `<p style="font-family: Arial, sans-serif; margin-bottom: 20px;"><strong>Total Latency:</strong> ${formatLatency(pathData.totalLatency || pathData.total_latency || 0)}ms</p>`;
      
      return tableHtml;
    };

    // Helper function to format pricing section from log data in HTML
    const formatPricingSectionFromLog = (pricing, pathType) => {
      if (!pricing) return '';
      
      let html = `<h4 style="color: #228B22; margin-top: 15px; margin-bottom: 10px; font-family: Arial, sans-serif;">${pathType} Pricing</h4>`;
      html += `<table style="${tableStyle}">`;
      html += `<tbody>`;
      html += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>NRC</strong></td><td style="${tdStyle}">${pricing.nrcCharge > 0 ? formatCurrency(pricing.nrcCharge, pricing.currency) : 'FREE'}</td></tr>`;
      html += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>MRC (Minimum)</strong></td><td style="${tdStyle}">${formatCurrency(pricing.minimumPrice, pricing.currency)}</td></tr>`;
      html += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>MRC (Suggested)</strong></td><td style="${tdStyle}">${formatCurrency(pricing.suggestedPrice, pricing.currency)}</td></tr>`;
      html += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>Currency</strong></td><td style="${tdStyle}">${pricing.currency}</td></tr>`;
      html += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>Contract Term</strong></td><td style="${tdStyle}">${pricing.contractTerm} months</td></tr>`;
      html += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>Bandwidth</strong></td><td style="${tdStyle}">${pricing.bandwidth} Mbps</td></tr>`;
      html += `</tbody></table>`;
      
      // Add promo pricing information if used
      if (pricing.promoPricing && pricing.promoPricing.used) {
        html += `<div style="background-color: #e8f5e9; padding: 10px; border-radius: 5px; margin-top: 10px;">`;
        html += `<p style="margin: 0; font-weight: bold; color: #2e7d32;">Promo Pricing Applied</p>`;
        html += `<p style="margin: 5px 0 0 0; font-size: 0.9em;">Rule: ${pricing.promoPricing.ruleName} (ID: ${pricing.promoPricing.ruleId})</p>`;
        html += `</div>`;
      }
      
      return html;
    };

    // Build HTML email body
    let emailBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;">`;
    
    // Header information
    emailBody += `<h2 style="color: #2E5090; border-bottom: 2px solid #4472C4; padding-bottom: 10px;">Network Design Pricing Results (from Log)</h2>`;
    emailBody += `<table style="margin-bottom: 20px; font-family: Arial, sans-serif;">`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Customer Name:</td><td>${params.customerName || params.customer_name || 'Not Specified'}</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Quote Request ID:</td><td>${params.quoteRequestId || params.quote_request_id || 'Not Specified'}</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Source Location:</td><td>${getLocationDisplay(params.source)}</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Destination Location:</td><td>${getLocationDisplay(params.destination)}</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Bandwidth:</td><td>${params.bandwidth || 'Not Specified'} Mbps</td></tr>`;
    emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Quote Time & Date:</td><td>${new Date().toLocaleString()}</td></tr>`;
    emailBody += `</table>`;

    console.log('Export Debug - Results structure:', results);

    // Handle "individual" array structure (new format)
    if (results && results.individual && Array.isArray(results.individual)) {
      results.individual.forEach((result, index) => {
        const pathType = result.pathType === 'primary' ? 'Primary' : 
                        result.pathType === 'protection' ? 'Secondary' : 
                        `Path ${index + 1}`;
        
        // Generate route table
        if (result.pricing?.detailedCalculations?.allocatedCostBreakdown?.segments) {
          const segments = result.pricing.detailedCalculations.allocatedCostBreakdown.segments;
          emailBody += generateRouteTableFromLog({ route: segments, totalLatency: result.totalLatency }, pathType);
        } else if (result.path && Array.isArray(result.path)) {
          emailBody += `<h3 style="${headerStyle}">${pathType} Route</h3>`;
          emailBody += `<p style="font-family: Arial, sans-serif;">${result.path.join(' → ')}</p>`;
          emailBody += `<p style="font-family: Arial, sans-serif;"><strong>Total Latency:</strong> ${formatLatency(result.totalLatency || 0)}ms | <strong>Hops:</strong> ${result.hops || 'N/A'}</p>`;
        }
        
        if (result.pricing) {
          emailBody += formatPricingSectionFromLog(result.pricing, pathType);
        }
      });
    }
    // Handle legacy "results" or "paths" array structure
    else if (results && (results.results || results.paths)) {
      const pathResults = results.results || results.paths || [];
      const primaryResult = pathResults.find(r => r.pathType === 'primary' || r.type === 'primary');
      const protectionResult = pathResults.find(r => r.pathType === 'protection' || r.type === 'protection');
      
      if (primaryResult) {
        emailBody += generateRouteTableFromLog(primaryResult, 'Primary');
        if (primaryResult.pricing) {
          emailBody += formatPricingSectionFromLog(primaryResult.pricing, 'Primary');
        }
      }
      
      if (protectionResult) {
        emailBody += generateRouteTableFromLog(protectionResult, 'Secondary');
        if (protectionResult.pricing) {
          emailBody += formatPricingSectionFromLog(protectionResult.pricing, 'Secondary');
        }
      }
    }

    // Check for search results structure
    if (results.searchResults?.primary) {
      emailBody += generateRouteTableFromLog(results.searchResults.primary, 'Primary');
    }
    if (results.searchResults?.protection) {
      emailBody += generateRouteTableFromLog(results.searchResults.protection, 'Secondary');
    }

    // Handle protection pricing
    if (results.protection?.pricing) {
      emailBody += formatPricingSectionFromLog(results.protection.pricing, 'Protected Service');
    }
    if (results.protectionPricing) {
      emailBody += formatPricingSectionFromLog(results.protectionPricing, 'Protected Service');
    }

    // Handle cross connect information in HTML
    const logCrossConnect = params.crossConnect || results.crossConnect || {};
    if (logCrossConnect.source || logCrossConnect.destination) {
      emailBody += `<h3 style="${headerStyle}">Cross Connect Information</h3>`;
      
      if (logCrossConnect.source) {
        const srcTags = [];
        if (logCrossConnect.source.mandatory) srcTags.push('Mandatory');
        if (logCrossConnect.source.customerOwned) srcTags.push('Customer Owned');
        const srcTagStr = srcTags.length > 0 ? ` (${srcTags.join(', ')})` : '';
        
        emailBody += `<h4 style="color: #666; margin-top: 15px; font-family: Arial, sans-serif;">Source Cross Connect${srcTagStr}</h4>`;
        emailBody += `<table style="${tableStyle}">`;
        emailBody += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>POP Name</strong></td><td style="${tdStyle}">${logCrossConnect.source.datacenterName} (${logCrossConnect.source.locationCode})</td></tr>`;
        emailBody += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>NRC</strong></td><td style="${tdStyle}">${logCrossConnect.source.nrc === 'Customer must provide X/C' ? 'Customer must provide X/C' : (logCrossConnect.source.nrc === 'POA' ? 'POA' : formatCurrency(logCrossConnect.source.nrc, logCrossConnect.source.currency))}</td></tr>`;
        emailBody += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>MRC</strong></td><td style="${tdStyle}">${logCrossConnect.source.mrc === 'Customer must provide X/C' ? 'Customer must provide X/C' : (logCrossConnect.source.mrc === 'POA' ? 'POA' : formatCurrency(logCrossConnect.source.mrc, logCrossConnect.source.currency))}</td></tr>`;
        if (logCrossConnect.source.notes) {
          emailBody += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>Notes</strong></td><td style="${tdStyle}">${logCrossConnect.source.notes}</td></tr>`;
        }
        emailBody += `</table>`;
      }

      if (logCrossConnect.destination) {
        const destTags = [];
        if (logCrossConnect.destination.mandatory) destTags.push('Mandatory');
        if (logCrossConnect.destination.customerOwned) destTags.push('Customer Owned');
        const destTagStr = destTags.length > 0 ? ` (${destTags.join(', ')})` : '';
        
        emailBody += `<h4 style="color: #666; margin-top: 15px; font-family: Arial, sans-serif;">Destination Cross Connect${destTagStr}</h4>`;
        emailBody += `<table style="${tableStyle}">`;
        emailBody += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>POP Name</strong></td><td style="${tdStyle}">${logCrossConnect.destination.datacenterName} (${logCrossConnect.destination.locationCode})</td></tr>`;
        emailBody += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>NRC</strong></td><td style="${tdStyle}">${logCrossConnect.destination.nrc === 'Customer must provide X/C' ? 'Customer must provide X/C' : (logCrossConnect.destination.nrc === 'POA' ? 'POA' : formatCurrency(logCrossConnect.destination.nrc, logCrossConnect.destination.currency))}</td></tr>`;
        emailBody += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}"><strong>MRC</strong></td><td style="${tdStyle}">${logCrossConnect.destination.mrc === 'Customer must provide X/C' ? 'Customer must provide X/C' : (logCrossConnect.destination.mrc === 'POA' ? 'POA' : formatCurrency(logCrossConnect.destination.mrc, logCrossConnect.destination.currency))}</td></tr>`;
        if (logCrossConnect.destination.notes) {
          emailBody += `<tr style="background-color: #ffffff;"><td style="${tdStyle}"><strong>Notes</strong></td><td style="${tdStyle}">${logCrossConnect.destination.notes}</td></tr>`;
        }
        emailBody += `</table>`;
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
    emailBody += `<li>Any additional 3rd Party costs incurred on order of the service will be chargeable to the customer, including but not limited to cross connects, additional cabling, out of hours charges, etc</li>`;
    emailBody += `<li>Unless otherwise stated any additional costs incurred for out of hours work will be chargeable to the customer.</li>`;
    emailBody += `<li>Customer must provide all necessary rack space and power supply.</li>`;
    emailBody += `<li>Pricing is for connectivity only, and does not include any fees associated with data feeds unless specified otherwise within the quotation.</li>`;
    emailBody += `<li>IPC reserves the right to correct any computational errors in this quote.</li>`;
    emailBody += `<li>Where Pricing is associated with a network or multi circuit design, individual element pricing is indicative, and cannot be ordered as individual elements.</li>`;
    emailBody += `</ul>`;
    emailBody += `</div>`;

    emailBody += `</body></html>`;

    return emailBody;
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
  }, [pagination.page, pagination.limit, selectedUser, customerNameFilter, logSearchTerm, actionTypeFilter]);

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
    setActionTypeFilter('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Cross Connect Functions
  const handleToggleCrossConnect = async (locationType) => {
    try {
      setLoading(true);
      setError('');
      
      // Check if this location type already has results (remove case)
      if (crossConnectResults[locationType]) {
        // Check if this is a mandatory cross connect - prevent disabling
        if (mandatoryCrossConnects[locationType]) {
          setError(`Cross connect is mandatory for this ${locationType} location and cannot be disabled`);
          setLoading(false);
          return;
        }
        
        // Remove the cross connect results
        setCrossConnectResults(prev => ({
          ...prev,
          [locationType]: null
        }));
        setLoading(false);
        return;
      }
      
      // Add case - get the location code based on type
      const locationCode = locationType === 'source' ? formData.source : formData.destination;
      
      if (!locationCode) {
        setError(`No ${locationType} location selected`);
        return;
      }
      
      // Find the location object
      const location = locations.find(loc => loc.location_code === locationCode);
      if (!location) {
        setError(`Location ${locationCode} not found`);
        return;
      }
      
      // Get cross connect data
      const crossConnectData = await getCrossConnectInfo(location.id);
      
      // Get pricing logic config to get margins
      const pricingConfig = await networkDesignApi.getPricingLogicConfig();
      const margins = pricingConfig.data.crossConnect || { nrcMargin: 10, mrcMargin: 10 };
      
      // Helper function to round up to nearest $10 (same as backend logic)
      const roundUpToNearest10 = (amount) => {
        return Math.ceil(amount / 10) * 10;
      };

      // Helper function to convert currency (same as backend logic)
      const convertCurrency = (amount, fromCurrency, toCurrency) => {
        if (fromCurrency === toCurrency) return amount;
        
        let usdAmount = amount;
        if (fromCurrency !== 'USD' && exchangeRates[fromCurrency]) {
          usdAmount = amount / exchangeRates[fromCurrency];
        }
        
        if (toCurrency !== 'USD' && exchangeRates[toCurrency]) {
          return usdAmount * exchangeRates[toCurrency];
        }
        
        return usdAmount;
      };

      // Calculate pricing with margin, currency conversion, and rounding
      const calculatePrice = (basePrice, margin, fromCurrency, toCurrency, isCustomerOwned) => {
        if (isCustomerOwned) return 'Customer must provide X/C';
        if (!basePrice || basePrice === null) return 'POA';
        
        // Apply margin (not markup) - same formula as backend pricing logic
        const priceWithMargin = basePrice / (1 - margin / 100);
        
        // Convert currency using backend-compatible logic
        const convertedPrice = convertCurrency(priceWithMargin, fromCurrency, toCurrency);
        
        // Round up to nearest $10 as per pricing rules
        return roundUpToNearest10(convertedPrice);
      };
      
      const isCustomerOwned = crossConnectData.customer_owned_xc;
      
      const nrcPrice = calculatePrice(
        crossConnectData.cross_connect_nrc,
        margins.nrcMargin,
        crossConnectData.cross_connect_nrc_currency,
        formData.outputCurrency,
        isCustomerOwned
      );
      
      const mrcPrice = calculatePrice(
        crossConnectData.cross_connect_mrc,
        margins.mrcMargin,
        crossConnectData.cross_connect_mrc_currency,
        formData.outputCurrency,
        isCustomerOwned
      );
      
      setCrossConnectResults(prev => ({
        ...prev,
        [locationType]: {
          locationCode: crossConnectData.location_code,
          datacenterName: crossConnectData.datacenter_name,
          nrc: nrcPrice,
          mrc: mrcPrice,
          notes: crossConnectData.cross_connect_notes,
          currency: formData.outputCurrency,
          mandatory: crossConnectData.cross_connect_mandatory || mandatoryCrossConnects[locationType],
          customerOwned: isCustomerOwned
        }
      }));
      
    } catch (err) {
      setError('Failed to get cross connect pricing: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={handleTabChange} aria-label="network design tabs">
          <Tab icon={<SearchIcon />} label="Network Design" />
          {canViewPricingLogs && <Tab icon={<HistoryIcon />} label="Pricing Logs" />}
        </Tabs>
      </Box>

      {/* Network Design Tab */}
      <TabPanel value={currentTab} index={0}>
        {/* Search Parameters */}
        <Accordion expanded={expandedAccordion === 'search'} onChange={() => setExpandedAccordion(expandedAccordion === 'search' ? '' : 'search')}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SearchIcon sx={{ mr: 1 }} />
                <Typography variant="h6" sx={{ fontSize: '1.1875rem' }}>Search Parameters</Typography>
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
              {/* Design Mode Selector */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth disabled={parametersLocked}>
                  <InputLabel>Design Mode</InputLabel>
                  <Select
                    value={designMode}
                    label="Design Mode"
                    onChange={handleDesignModeChange}
                  >
                    <MenuItem value="auto">Auto Design</MenuItem>
                    <MenuItem value="manual">Manual Route Entry</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Spacer for half-width design mode */}
              <Grid item xs={12} md={6} />
              
              {/* Customer Name */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Customer Name"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  disabled={parametersLocked}
                />
              </Grid>

              {/* Quote Request ID */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Quote Request ID"
                  value={formData.quoteRequestId}
                  onChange={(e) => handleInputChange('quoteRequestId', e.target.value)}
                  disabled={parametersLocked}
                />
              </Grid>

              {/* Source and Destination - Now searchable */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={locations}
                  getOptionLabel={(option) => option.datacenter_name ? `${option.location_code} - ${option.datacenter_name}` : option.location_code}
                  value={locations.find(loc => loc.location_code === formData.source) || null}
                  onChange={(event, newValue) => {
                    handleInputChange('source', newValue ? newValue.location_code : '');
                  }}
                  disabled={parametersLocked}
                  renderInput={(params) => (
                    <TextField {...params} label="Source Location" fullWidth />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={locations}
                  getOptionLabel={(option) => option.datacenter_name ? `${option.location_code} - ${option.datacenter_name}` : option.location_code}
                  value={locations.find(loc => loc.location_code === formData.destination) || null}
                  onChange={(event, newValue) => {
                    handleInputChange('destination', newValue ? newValue.location_code : '');
                  }}
                  disabled={parametersLocked}
                  renderInput={(params) => (
                    <TextField {...params} label="Destination Location" fullWidth />
                  )}
                />
              </Grid>

              {/* Bandwidth */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Bandwidth (Mbps)"
                  type="number"
                  value={formData.bandwidth}
                  onChange={(e) => handleInputChange('bandwidth', e.target.value)}
                  inputProps={{ min: 10, max: 10000, step: 1 }}
                  helperText="Enter bandwidth between 10 and 10000 Mbps"
                  disabled={parametersLocked}
                />
              </Grid>

              {/* MTU Required - New field */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="MTU Required (minimum)"
                  type="number"
                  value={formData.mtuRequired}
                  onChange={(e) => handleInputChange('mtuRequired', e.target.value)}
                  helperText="Default: 1500 if not specified - Maximum service MTU is 9000"
                  disabled={parametersLocked}
                />
              </Grid>

              {/* Manual Route Entry Fields */}
              {designMode === 'manual' && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Primary Routes (Circuit IDs)"
                      value={manualPrimaryRoutes}
                      onChange={(e) => handleManualPrimaryRoutesChange(e.target.value)}
                      placeholder="Enter circuit IDs separated by commas (e.g., LONLON123123, LONSNG442222, SNGHKG999555)"
                      helperText={primaryRouteValidation.message || "Enter circuit IDs in order from source to destination"}
                      error={!primaryRouteValidation.valid && primaryRouteValidation.message !== ''}
                      disabled={parametersLocked}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Button
                              size="small"
                              onClick={() => {
                                setManualPrimaryRoutes('');
                                setPrimaryRouteValidation({ valid: false, message: '', routes: [] });
                              }}
                              disabled={!manualPrimaryRoutes || parametersLocked}
                              sx={{ mr: 1 }}
                            >
                              Clear
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleFindSuggestions('primary')}
                              disabled={!formData.source || !formData.destination || !formData.bandwidth || parametersLocked}
                            >
                              Find Suggestions
                            </Button>
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>

                  {formData.protectionRequired && (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Secondary Routes (Circuit IDs)"
                        value={manualSecondaryRoutes}
                        onChange={(e) => handleManualSecondaryRoutesChange(e.target.value)}
                        placeholder="Enter circuit IDs separated by commas"
                        helperText={secondaryRouteValidation.message || "Enter circuit IDs for diverse path"}
                        error={!secondaryRouteValidation.valid && secondaryRouteValidation.message !== ''}
                        disabled={parametersLocked}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <Button
                                size="small"
                                onClick={() => {
                                  setManualSecondaryRoutes('');
                                  setSecondaryRouteValidation({ valid: false, message: '', routes: [] });
                                }}
                                disabled={!manualSecondaryRoutes || parametersLocked}
                                sx={{ mr: 1 }}
                              >
                                Clear
                              </Button>
                              <Button
                                size="small"
                                onClick={() => handleFindSuggestions('secondary')}
                                disabled={!formData.source || !formData.destination || !formData.bandwidth || parametersLocked}
                                sx={{ mr: 1 }}
                              >
                                Find Suggestions
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={handleSuggestSecondaryPath}
                                disabled={!formData.source || !formData.destination || !formData.bandwidth || parametersLocked}
                              >
                                Suggest Secondary Path
                              </Button>
                            </InputAdornment>
                          )
                        }}
                      />
                    </Grid>
                  )}
                </>
              )}

              {/* Auto Design Constraints - Only show in auto mode */}
              {designMode === 'auto' && (
                <>
                  {/* Carrier Avoidance - Now searchable */}
                  <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={carriers}
                  getOptionLabel={(option) => option.carrier_name}
                  value={carriers.filter(carrier => formData.carrierAvoidance.includes(carrier.carrier_name))}
                  onChange={(event, newValue) => {
                    handleInputChange('carrierAvoidance', newValue.map(carrier => carrier.carrier_name));
                  }}
                  disabled={parametersLocked}
                  renderInput={(params) => (
                    <TextField {...params} label="Carrier Avoidance" />
                  )}
                />
              </Grid>

              {/* Circuit ID Exclusion - Search by UCN or Cable System */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={circuitIds}
                  getOptionLabel={getCircuitOptionLabel}
                  value={formData.circuitExclusion}
                  onChange={(event, newValue) => {
                    // Store the selected options as-is (objects or strings)
                    handleInputChange('circuitExclusion', newValue);
                  }}
                  onInputChange={(event, inputValue) => {
                    // Only fetch circuit IDs when user starts typing
                    if (inputValue && inputValue.length >= 2) {
                      loadCircuitIds(inputValue);
                    } else if (!inputValue) {
                      // Clear options when input is cleared
                      setCircuitIds([]);
                    }
                  }}
                  isOptionEqualToValue={(option, value) => {
                    // Compare circuit IDs
                    const optionId = getCircuitId(option);
                    const valueId = getCircuitId(value);
                    return optionId === valueId;
                  }}
                  disabled={parametersLocked}
                  noOptionsText="Type to search circuits or cable systems..."
                  loadingText="Loading circuits..."
                  renderTags={(value, getTagProps) => (
                    value.map((option, index) => {
                      const label = getCircuitId(option);
                      return (
                        <Chip
                          key={`circuit-${label}-${index}`}
                          label={label}
                          {...getTagProps({ index })}
                          disabled={parametersLocked}
                          size="small"
                        />
                      );
                    })
                  )}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Circuit ID Exclusion" 
                      placeholder="Type to search circuits or cable systems..."
                      helperText="Search by UCN or Cable System name - individually select circuits to exclude"
                    />
                  )}
                />
              </Grid>
                </>
              )}

              {/* Output Currency */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth disabled={parametersLocked}>
                  <InputLabel>Output Currency</InputLabel>
                  <Select
                    value={formData.outputCurrency}
                    onChange={(e) => handleInputChange('outputCurrency', e.target.value)}
                    label="Output Currency"
                  >
                    {availableCurrencies.map((currencyCode) => (
                      <MenuItem key={currencyCode} value={currencyCode}>
                        {currencyCode}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Protection Required - moved to right side */}
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.protectionRequired}
                      onChange={(e) => handleInputChange('protectionRequired', e.target.checked)}
                      disabled={parametersLocked}
                    />
                  }
                  label="Protection Required"
                />
              </Grid>

              {/* Contract Term - left side under Output Currency */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth disabled={parametersLocked}>
                  <InputLabel>Contract Term</InputLabel>
                  <Select
                    value={formData.contractTerm}
                    onChange={(e) => handleInputChange('contractTerm', e.target.value)}
                    label="Contract Term"
                  >
                    {contractTerms.map((term) => (
                      <MenuItem key={term.value} value={term.value}>
                        {term.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Include Cisco Only Routes - right side, hide when Protection Required */}
              {!formData.protectionRequired && (
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.useCiscoOnlyRoutes}
                        onChange={(e) => handleInputChange('useCiscoOnlyRoutes', e.target.checked)}
                        disabled={parametersLocked}
                      />
                    }
                    label="Include Cisco Only Routes"
                  />
                </Grid>
              )}

              {/* Empty space for proper alignment */}
              <Grid item xs={12} md={6}>
              </Grid>

              {/* Include ULL - right side, hide when Protection Required */}
              {!formData.protectionRequired && (
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.includeULL}
                        onChange={(e) => handleInputChange('includeULL', e.target.checked)}
                        disabled={parametersLocked}
                      />
                    }
                    label="Include ULL"
                  />
                </Grid>
              )}

              {/* Include Routes in Provisioning Status */}
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.includeProvisioningRoutes}
                      onChange={(e) => handleInputChange('includeProvisioningRoutes', e.target.checked)}
                      disabled={parametersLocked}
                      color="success"
                    />
                  }
                  label="Include Routes in Provisioning Status"
                />
              </Grid>

              {/* Use 100Gb and DF routes only - hide when manual mode */}
              {designMode === 'auto' && (
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.use100GbAndDFOnly}
                        onChange={(e) => handleInputChange('use100GbAndDFOnly', e.target.checked)}
                        disabled={parametersLocked}
                      />
                    }
                    label="Use 100Gb and DF routes only"
                  />
                </Grid>
              )}

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <LoadingButton
                    variant="contained"
                    startIcon={<SearchIcon />}
                    onClick={handleSearch}
                    loading={loading}
                    disabled={!formData.source || !formData.destination || parametersLocked}
                  >
                    {designMode === 'manual' ? 'Calculate Pricing' : 'Find Route'}
                  </LoadingButton>
                </Box>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Search Results */}
        {searchResults && (
          <Accordion expanded={expandedAccordion === 'results'} onChange={() => setExpandedAccordion(expandedAccordion === 'results' ? '' : 'results')} sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <RouteIcon sx={{ mr: 1 }} />
                <Typography variant="h6" sx={{ fontSize: '1.1875rem' }}>Search Results</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {/* Export KMZ Button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<MapIcon />}
                  onClick={handleKMZExportOpen}
                  color="primary"
                >
                  Export KMZ
                </Button>
              </Box>

              {/* Provisioning Route Notes - Display when provisioning routes are used in the path */}
              {searchResults.routeLifecycleNotes?.provisioningRoutesUsed?.length > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                    {searchResults.routeLifecycleNotes.message}
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    {searchResults.routeLifecycleNotes.provisioningRoutesUsed.map((note, idx) => (
                      <Typography component="li" variant="body2" key={idx} sx={{ fontSize: '0.75rem' }}>
                        {note.message}
                      </Typography>
                    ))}
                  </Box>
                </Alert>
              )}

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
                              <TableRow key={index}>
                                <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                                <TableCell>{segment.from} → {segment.to}</TableCell>
                                <TableCell>{formatLatency(segment.latency)}ms</TableCell>
                                <TableCell>{segment.bandwidthDisplay === 'Dark Fiber' ? 'Dark Fiber' : (segment.bandwidth || 'N/A')}</TableCell>
                                <TableCell>{segment.carrier || 'N/A'}</TableCell>
                                <TableCell>{segment.cable_system || 'N/A'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          <strong>Total Latency:</strong> {formatLatency(searchResults.primaryPath.totalLatency)}ms
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
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
                                <TableRow key={index}>
                                  <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                                  <TableCell>{segment.from} → {segment.to}</TableCell>
                                  <TableCell>{formatLatency(segment.latency)}ms</TableCell>
                                  <TableCell>{segment.bandwidthDisplay === 'Dark Fiber' ? 'Dark Fiber' : (segment.bandwidth || 'N/A')}</TableCell>
                                  <TableCell>{segment.carrier || 'N/A'}</TableCell>
                                  <TableCell>{segment.cable_system || 'N/A'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            <strong>Total Latency:</strong> {formatLatency(searchResults.diversePath.totalLatency)}ms
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            <strong>Total Hops:</strong> {searchResults.diversePath.hops}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {/* Route Information Summary */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ fontSize: '1.1875rem' }}>Route Information</Typography>
                      
                      {/* Protection Status */}
                      {searchResults.protectionStatus && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Protection Status:
                          </Typography>
                          <Chip 
                            label={searchResults.protectionStatus.message}
                            color={searchResults.protectionStatus.available === false && searchResults.protectionStatus.required ? 'warning' : 'success'}
                            size="small"
                            sx={{ mr: 1 }}
                          />
                          
                          {/* Show alert when protection is required but not available */}
                          {searchResults.protectionStatus.required && !searchResults.protectionStatus.available && (
                            <Alert severity="warning" sx={{ mt: 1 }}>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                <strong>Protection Route Not Available:</strong> No diverse path could be found with the current constraints. 
                                The primary route is available, but protection requirements cannot be met.
                              </Typography>
                              
                              {/* Show detailed failure reasons if available */}
                              {searchResults.protectionStatus.failureReasons && (
                                <Box sx={{ mt: 2 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold', mb: 1 }}>
                                    Protection Failure Analysis:
                                  </Typography>
                                  
                                  <Typography variant="body2" sx={{ fontSize: '0.75rem', mb: 1 }}>
                                    • Primary path using: {searchResults.protectionStatus.failureReasons.primary_path_blocked}
                                  </Typography>
                                  
                                  {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.source_isolated && (
                                    <Typography variant="body2" sx={{ fontSize: '0.75rem', mb: 1, color: 'error.main' }}>
                                      • Source location has no alternative connections after removing primary path
                                    </Typography>
                                  )}
                                  
                                  {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.destination_isolated && (
                                    <Typography variant="body2" sx={{ fontSize: '0.75rem', mb: 1, color: 'error.main' }}>
                                      • Destination location has no alternative connections after removing primary path
                                    </Typography>
                                  )}
                                  
                                  <Typography variant="body2" sx={{ fontSize: '0.75rem', mb: 1 }}>
                                    • Alternative routes remaining: {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.total_remaining_edges}
                                  </Typography>
                                  
                                  {(searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.bandwidth_still_excluding > 0 ||
                                    searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.carrier_avoidance_still_excluding > 0 ||
                                    searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.mtu_still_excluding > 0 ||
                                    searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.ull_still_excluding > 0) && (
                                    <Box sx={{ mt: 1 }}>
                                      <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                                        Constraints still limiting protection routes:
                                      </Typography>
                                      {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.bandwidth_still_excluding > 0 && (
                                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                          • Bandwidth constraints excluding {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.bandwidth_still_excluding} additional routes
                                        </Typography>
                                      )}
                                      {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.carrier_avoidance_still_excluding > 0 && (
                                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                          • Carrier avoidance excluding {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.carrier_avoidance_still_excluding} additional routes
                                        </Typography>
                                      )}
                                      {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.mtu_still_excluding > 0 && (
                                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                          • MTU requirements excluding {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.mtu_still_excluding} additional routes
                                        </Typography>
                                      )}
                                      {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.ull_still_excluding > 0 && (
                                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                          • ULL restrictions excluding {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.ull_still_excluding} additional routes
                                        </Typography>
                                      )}
                                    </Box>
                                  )}
                                  
                                  <Typography variant="body2" sx={{ fontSize: '0.75rem', mt: 2, fontStyle: 'italic', color: 'text.secondary' }}>
                                    Suggestion: {searchResults.protectionStatus.failureReasons.suggestion}
                                  </Typography>
                                </Box>
                              )}
                            </Alert>
                          )}
                        </Box>
                      )}
                      
                      {/* Exclusion Reasons Summary */}
                      {searchResults.exclusionReasons && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Route Filtering Summary:
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                            Total routes available: {searchResults.exclusionReasons.total_routes_available}, 
                            Excluded: {searchResults.exclusionReasons.total_routes_excluded}
                          </Typography>
                          
                          {(searchResults.exclusionReasons.bandwidth.count > 0 || 
                            searchResults.exclusionReasons.carrier_avoidance.count > 0 || 
                            searchResults.exclusionReasons.local_loop_carrier_avoidance?.count > 0 ||
                            searchResults.exclusionReasons.mtu_requirement.count > 0 ||
                            searchResults.exclusionReasons.ull_restriction.count > 0 ||
                            searchResults.exclusionReasons.circuit_exclusion?.count > 0 ||
                            searchResults.exclusionReasons.equipment_restriction?.count > 0) && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                Exclusion reasons:
                              </Typography>
                              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                {searchResults.exclusionReasons.bandwidth.count > 0 && (
                                  <Typography component="li" variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                    {searchResults.exclusionReasons.bandwidth.count} routes excluded due to insufficient bandwidth
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.carrier_avoidance.count > 0 && (
                                  <Typography component="li" variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                    {searchResults.exclusionReasons.carrier_avoidance.count} routes excluded due to carrier avoidance 
                                    ({searchResults.exclusionReasons.carrier_avoidance.carriers.join(', ')})
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.local_loop_carrier_avoidance?.count > 0 && (
                                  <Typography component="li" variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                    {searchResults.exclusionReasons.local_loop_carrier_avoidance.count} routes excluded due to local loop carrier avoidance 
                                    ({searchResults.exclusionReasons.local_loop_carrier_avoidance.carriers.join(', ')})
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.circuit_exclusion?.count > 0 && (
                                  <Typography component="li" variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                    {searchResults.exclusionReasons.circuit_exclusion.count} routes excluded due to user requested circuit exclusion 
                                    ({searchResults.exclusionReasons.circuit_exclusion.circuits.join(', ')})
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.mtu_requirement.count > 0 && (
                                  <Typography component="li" variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                    {searchResults.exclusionReasons.mtu_requirement.count} routes excluded due to MTU requirements
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.ull_restriction.count > 0 && (
                                  <Typography component="li" variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                    {searchResults.exclusionReasons.ull_restriction.count} Special/ULL routes excluded (Include ULL disabled)
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.equipment_restriction?.count > 0 && (
                                  <Typography component="li" variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                    {searchResults.exclusionReasons.equipment_restriction.count} routes excluded due to equipment restrictions 
                                    (Cisco equipment excluded - Include Cisco Only Routes disabled)
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.bandwidth_100gb_df_restriction?.count > 0 && (
                                  <Typography component="li" variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                    {searchResults.exclusionReasons.bandwidth_100gb_df_restriction.count} routes excluded 
                                    (Use 100Gb and DF routes only enabled)
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.route_decommission?.count > 0 && (
                                  <Typography component="li" variant="body2" sx={{ fontSize: '0.75rem' }} color="warning.main">
                                    {searchResults.exclusionReasons.route_decommission.count} routes excluded (Under Decommission status)
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.route_provisioning?.count > 0 && (
                                  <Typography component="li" variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                    {searchResults.exclusionReasons.route_provisioning.count} routes excluded (Provisioning status - toggle disabled)
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          )}
                          
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>


              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Enhanced Pricing Results */}
        {pricingResults && (
          <Accordion expanded={expandedAccordion === 'pricing'} onChange={() => setExpandedAccordion(expandedAccordion === 'pricing' ? '' : 'pricing')} sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AttachMoneyIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Enhanced Pricing Results</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {/* Export Buttons */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<MapIcon />}
                  onClick={handleKMZExportOpen}
                  color="primary"
                >
                  Export KMZ
                </Button>
                <Button
                  variant="contained"
                  startIcon={<EmailIcon />}
                  onClick={handleExportOpen}
                  color="primary"
                >
                  Export Results
                </Button>
              </Box>

              {/* Contract Term Summary */}
              {pricingResults.contractTermDetails && pricingResults.contractTermDetails.rules && (
                <Grid item xs={12} sx={{ mb: 3 }}>
                  <Card sx={{ bgcolor: 'grey.50' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Contract Term Pricing Model
                      </Typography>
                      <Grid container spacing={2}>
                        {Object.entries(pricingResults.contractTermDetails.rules).map(([term, rules]) => (
                          <Grid item xs={12} md={4} key={term}>
                            <Box 
                              sx={{ 
                                p: 2, 
                                border: term == pricingResults.contractTermDetails.term ? '2px solid' : '1px solid',
                                borderColor: term == pricingResults.contractTermDetails.term ? 'primary.main' : 'grey.300',
                                borderRadius: 1,
                                bgcolor: term == pricingResults.contractTermDetails.term ? 'primary.50' : 'white',
                                cursor: 'pointer',
                                '&:hover': {
                                  bgcolor: term == pricingResults.contractTermDetails.term ? 'primary.50' : 'grey.50'
                                }
                              }}
                              onClick={() => handleContractTermChange(parseInt(term))}
                            >
                              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                                {term} Months {term == pricingResults.contractTermDetails.term ? '(Selected)' : ''}
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color={rules.nrc > 0 ? 'info.main' : 'success.main'} fontWeight="bold">
                                Setup Fee: {rules.nrc > 0 ? formatCurrency(rules.nrc, pricingResults.contractTermDetails.currency) : 'FREE'}
                              </Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              <Grid container spacing={3}>
                {/* Individual Path Pricing */}
                {pricingResults.results.map((result, index) => (
                  <Grid item xs={12} md={6} key={index}>
                    <Card sx={{ height: '100%' }}>
                      <CardHeader 
                        title={`${result.pathType === 'primary' ? 'Primary' : 'Protection'} Path`}
                        subheader={`${result.hops} hops, ${formatLatency(result.totalLatency)}ms latency, ${result.pricing.bandwidth}Mb Bandwidth`}
                      />
                      <CardContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {/* Price Range */}
                          <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Monthly Price Range ({result.pricing.contractTerm}-month term)
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="success.main">
                                Minimum:
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold" color="success.main">
                                {formatCurrency(result.pricing.minimumPrice, result.pricing.currency)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="warning.main">
                                Suggested:
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold" color="warning.main">
                                {formatCurrency(result.pricing.suggestedPrice, result.pricing.currency)}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Promo Pricing Indicator */}
                          {result.pricing.promoPricing?.used && (
                            <Box sx={{ p: 2, bgcolor: 'success.50', borderRadius: 1, border: 1, borderColor: 'success.200' }}>
                              <Box display="flex" alignItems="center" gap={1}>
                                <LocalOfferIcon color="success" fontSize="small" />
                                <Typography variant="subtitle2" color="success.dark" fontWeight="bold">
                                  PROMO PRICING APPLIED
                                </Typography>
                              </Box>
                            </Box>
                          )}

                          {/* NRC Charges */}
                          {result.pricing.nrcCharge > 0 && (
                            <Box sx={{ bgcolor: 'info.50', p: 2, borderRadius: 1 }}>
                              <Typography variant="subtitle2" gutterBottom>Non-Recurring Charges (NRC)</Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>Setup Fee ({result.pricing.contractTerm}-month term):</Typography>
                                <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold" color="info.main">
                                  {formatCurrency(result.pricing.nrcCharge, result.pricing.currency)}
                                </Typography>
                              </Box>
                            </Box>
                          )}

                          {result.pricing.nrcCharge === 0 && (
                            <Box sx={{ bgcolor: 'success.50', p: 2, borderRadius: 1 }}>
                              <Typography variant="subtitle2" gutterBottom>Non-Recurring Charges (NRC)</Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>Setup Fee ({result.pricing.contractTerm}-month term):</Typography>
                                <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold" color="success.main">
                                  FREE
                                </Typography>
                              </Box>
                            </Box>
                          )}


                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}

                {/* Protection Pricing (if applicable) */}
                {pricingResults.protectionPricing && (
                  <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%', bgcolor: 'primary.50' }}>
                      <CardHeader 
                        title="Protected Service Pricing"
                        subheader={`${pricingResults.protectionPricing.contractTerm}-month term`}
                      />
                      <CardContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {/* Price Range */}
                          <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Monthly Price Range
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="success.main">
                                Minimum:
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold" color="success.main">
                                {formatCurrency(pricingResults.protectionPricing.minimumPrice, pricingResults.protectionPricing.currency)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="warning.main">
                                Suggested:
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold" color="warning.main">
                                {formatCurrency(pricingResults.protectionPricing.suggestedPrice, pricingResults.protectionPricing.currency)}
                              </Typography>
                            </Box>
                          </Box>
                          
                          {/* NRC for Protection */}
                          <Box sx={{ bgcolor: pricingResults.protectionPricing.nrcCharge > 0 ? 'info.50' : 'success.50', p: 1.5, borderRadius: 1 }}>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                              <strong>Setup Fee:</strong>
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold" color={pricingResults.protectionPricing.nrcCharge > 0 ? 'info.main' : 'success.main'}>
                              {pricingResults.protectionPricing.nrcCharge > 0 
                                ? formatCurrency(pricingResults.protectionPricing.nrcCharge, pricingResults.protectionPricing.currency)
                                : 'FREE'
                              }
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {/* Cross Connect Options */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%', bgcolor: 'info.50', border: 1, borderColor: 'info.200' }}>
                    <CardHeader 
                      avatar={<CableIcon color="info" />}
                      title="Cross Connect Options"
                      subheader="Add Cross Connect if required - Default delivery is customer to provide"
                    />
                    <CardContent>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Button
                            variant="outlined"
                            fullWidth
                            size="small"
                            startIcon={<CableIcon />}
                            onClick={() => handleToggleCrossConnect('source')}
                            disabled={!formData.source || loading}
                            color={crossConnectResults.source ? "error" : "primary"}
                          >
                            {crossConnectResults.source 
                              ? `Remove Source (${formData.source})` 
                              : `Add Source (${formData.source || 'Not Selected'})`
                            }
                          </Button>
                        </Grid>
                        <Grid item xs={12}>
                          <Button
                            variant="outlined"
                            fullWidth
                            size="small"
                            startIcon={<CableIcon />}
                            onClick={() => handleToggleCrossConnect('destination')}
                            disabled={!formData.destination || loading}
                            color={crossConnectResults.destination ? "error" : "primary"}
                          >
                            {crossConnectResults.destination 
                              ? `Remove Destination (${formData.destination})` 
                              : `Add Destination (${formData.destination || 'Not Selected'})`
                            }
                          </Button>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Cross Connect Results - Source */}
                {crossConnectResults.source && (
                  <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%', bgcolor: 'success.50', border: 1, borderColor: 'success.200' }}>
                      <CardHeader 
                        avatar={<CableIcon color="success" />}
                        title={`Source Cross Connect${crossConnectResults.source.mandatory ? ' (Mandatory)' : ''}${crossConnectResults.source.customerOwned ? ' (Customer Owned)' : ''}`}
                        subheader={`${crossConnectResults.source.locationCode} - ${crossConnectResults.source.datacenterName}`}
                      />
                      <CardContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box sx={{ bgcolor: 'white', p: 1.5, borderRadius: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                NRC (One-time):
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold" color="primary.main">
                                {crossConnectResults.source.nrc === 'Customer must provide X/C' ? 'Customer must provide X/C' : (crossConnectResults.source.nrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.source.nrc, crossConnectResults.source.currency))}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                MRC (Monthly):
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold" color="secondary.main">
                                {crossConnectResults.source.mrc === 'Customer must provide X/C' ? 'Customer must provide X/C' : (crossConnectResults.source.mrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.source.mrc, crossConnectResults.source.currency))}
                              </Typography>
                            </Box>
                          </Box>
                          {crossConnectResults.source.notes && (
                            <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Notes: {crossConnectResults.source.notes}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {/* Cross Connect Results - Destination */}
                {crossConnectResults.destination && (
                  <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%', bgcolor: 'warning.50', border: 1, borderColor: 'warning.200' }}>
                      <CardHeader 
                        avatar={<CableIcon color="warning" />}
                        title={`Destination Cross Connect${crossConnectResults.destination.mandatory ? ' (Mandatory)' : ''}${crossConnectResults.destination.customerOwned ? ' (Customer Owned)' : ''}`}
                        subheader={`${crossConnectResults.destination.locationCode} - ${crossConnectResults.destination.datacenterName}`}
                      />
                      <CardContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box sx={{ bgcolor: 'white', p: 1.5, borderRadius: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                NRC (One-time):
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold" color="primary.main">
                                {crossConnectResults.destination.nrc === 'Customer must provide X/C' ? 'Customer must provide X/C' : (crossConnectResults.destination.nrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.destination.nrc, crossConnectResults.destination.currency))}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                MRC (Monthly):
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold" color="secondary.main">
                                {crossConnectResults.destination.mrc === 'Customer must provide X/C' ? 'Customer must provide X/C' : (crossConnectResults.destination.mrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.destination.mrc, crossConnectResults.destination.currency))}
                              </Typography>
                            </Box>
                          </Box>
                          {crossConnectResults.destination.notes && (
                            <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Notes: {crossConnectResults.destination.notes}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}
      </TabPanel>

      {/* Pricing Logs Tab - Only show if user has permission */}
      {canViewPricingLogs && (
        <TabPanel value={currentTab} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Pricing Logs</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip 
                label={`Showing ${auditLogs.length} of ${pagination.total} entries (Page ${pagination.page}/${pagination.totalPages})`} 
                color="info" 
                size="small"
              />
              {canManageLogs && (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleExportLogs}
                    startIcon={<DownloadIcon />}
                  >
                    Export CSV
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={handleClearLogs}
                    startIcon={<DeleteIcon />}
                  >
                    Clear Logs
                  </Button>
                </>
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
                    label="Type"
                    value={actionTypeFilter}
                    onChange={(e) => { setActionTypeFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                  >
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="CONTRACT_TERM_PRICING_CALCULATION">Contract Term Pricing</MenuItem>
                    <MenuItem value="PATH_SEARCH">Path Search</MenuItem>
                    {hasRouteFinderAccess && (
                      <MenuItem value="ROUTE_FINDER_SEARCH">Route Finder Search</MenuItem>
                    )}
                  </TextField>
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
                    startIcon={<FilterListOffIcon />}
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
                  <TableCell><strong>Pricing Results</strong></TableCell>
                  <TableCell><strong>Execution Time</strong></TableCell>
                  <TableCell align="center" sx={{ width: 150 }}><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.isArray(auditLogs) && auditLogs.map((log) => (
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
                          label={log.action_type === 'ROUTE_FINDER_SEARCH' ? 'Route Finder Search' : log.action_type} 
                          color={log.action_type === 'ROUTE_FINDER_SEARCH' ? 'info' : log.action_type === 'PATH_SEARCH' ? 'primary' : 'secondary'} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {(() => {
                            try {
                              const params = log.parameters || log.pricing_data?.inputParameters;
                              return params?.customerName || params?.customer_name || 'N/A';
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
                              const params = log.parameters || log.pricing_data?.inputParameters;
                              return params?.quoteRequestId || params?.quote_request_id || 'N/A';
                            } catch {
                              return 'N/A';
                            }
                          })()}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 400 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {formatReadableLogSummary(log)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 400 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {formatReadableResultsSummary(log)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {log.execution_time ? `${log.execution_time}ms` : 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ width: 150 }}>
                        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', alignItems: 'center' }}>
                          {/* View Details - available for provisioner and admin users, not read-only */}
                          {!isReadOnly && (
                            <Button
                              variant="outlined"
                              size="small"
                              fullWidth
                              onClick={() => toggleLogExpansion(log.id)}
                            >
                              {expandedLogs.has(log.id) ? 'Hide Details' : 'View Details'}
                            </Button>
                          )}
                          
                          {/* Export - only for CONTRACT_TERM_PRICING_CALCULATION */}
                          {log.action_type === 'CONTRACT_TERM_PRICING_CALCULATION' && (
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<EmailIcon />}
                              onClick={() => handleExportPricingLog(log)}
                              disabled={!log.results && !log.pricing_data?.calculationResults}
                              color="primary"
                            >
                              Export
                            </Button>
                          )}
                          
                          {/* Reload Search - available to all users except Route Finder logs (display-only) */}
                          {log.action_type !== 'ROUTE_FINDER_SEARCH' && (
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<HistoryIcon />}
                              onClick={() => handleReloadFromLog(log)}
                              color="secondary"
                            >
                              Reload Search
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                    {expandedLogs.has(log.id) && !isReadOnly && (
                      <TableRow>
                        <TableCell colSpan={9} sx={{ backgroundColor: '#f8f9fa', border: 'none' }}>
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
                                <Grid item xs={12} md={6}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    <strong>Complete Input Data:</strong>
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
                                    {log.parameters ? JSON.stringify(log.parameters, null, 2) : 
                                     log.pricing_data?.inputParameters ? JSON.stringify(log.pricing_data.inputParameters, null, 2) : 
                                     'No input data available'}
                                  </Box>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    <strong>Complete Results Data:</strong>
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
                                    {log.results ? JSON.stringify(log.results, null, 2) : 
                                     log.pricing_data?.calculationResults ? JSON.stringify(log.pricing_data.calculationResults, null, 2) :
                                     log.action_type === 'ROUTE_FINDER_SEARCH' && log.pricing_data ? JSON.stringify({
                                       routeResults: log.pricing_data.routeResults,
                                       promoPricing: log.pricing_data.promoPricing,
                                       crossConnectPricing: log.pricing_data.crossConnectPricing
                                     }, null, 2) :
                                     'No results data available'}
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
      <Dialog
        open={exportDialogOpen}
        onClose={handleExportClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmailIcon color="primary" />
            <Typography variant="h6">Export Pricing Results</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 2 }}>
            Select which pricing results to include in the email export:
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Primary Pricing Option */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.primaryPricing}
                  onChange={() => handleExportOptionChange('primaryPricing')}
                  color="primary"
                />
              }
              label="Primary Pricing"
              disabled={!pricingResults?.results?.find(r => r.pathType === 'primary') || !searchResults?.primaryPath}
            />
            
            {/* Secondary Pricing Option */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.secondaryPricing}
                  onChange={() => handleExportOptionChange('secondaryPricing')}
                  color="primary"
                />
              }
              label="Secondary Pricing"
              disabled={!pricingResults?.results?.find(r => r.pathType === 'protection') || !searchResults?.diversePath}
            />
            
            {/* Protected Pricing Option */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.protectedPricing}
                  onChange={() => handleExportOptionChange('protectedPricing')}
                  color="primary"
                />
              }
              label="Protected Pricing"
              disabled={!pricingResults?.protectionPricing}
            />
          </Box>

          {/* Cross Connect Info Display */}
          {(crossConnectResults.source || crossConnectResults.destination) && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'info.50', borderRadius: 1 }}>
              <Typography variant="body2" color="info.main" sx={{ fontSize: '0.75rem', fontWeight: 'bold', mb: 1 }}>
                Cross Connect Information:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                {crossConnectResults.source && `Source: ${crossConnectResults.source.locationCode}`}
                {crossConnectResults.source && crossConnectResults.destination && ' • '}
                {crossConnectResults.destination && `Destination: ${crossConnectResults.destination.locationCode}`}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                Cross connect details will be included in the export.
              </Typography>
            </Box>
          )}

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
              This will download a .eml email file that you can double-click to open in your email client or attach to emails.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleExportClose} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={() => {
              const hasSelection = Object.values(exportOptions).some(Boolean);
              if (!hasSelection) {
                setError('Please select at least one pricing option to export');
                return;
              }
              const emailBody = generateEmailBody();
              const today = new Date().toLocaleDateString();
              const subject = `${formData.quoteRequestId || 'Quote'} - ${formData.customerName || 'Customer'} - Pricing Request - ${today}`;
              handleCopyToClipboard(emailBody, subject);
            }}
            variant="outlined" 
            startIcon={<DownloadIcon />}
            disabled={!Object.values(exportOptions).some(Boolean)}
            sx={{ mr: 1 }}
          >
            Copy to Clipboard
          </Button>
          <Button 
            onClick={handleExportConfirm} 
            variant="contained" 
            startIcon={<EmailIcon />}
            disabled={!Object.values(exportOptions).some(Boolean)}
          >
            Download Email File
          </Button>
        </DialogActions>
      </Dialog>

      {/* KMZ Export Dialog */}
      <Dialog
        open={kmzExportDialogOpen}
        onClose={handleKMZExportClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MapIcon color="primary" />
            <Typography variant="h6">Export Network Design as KMZ</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Export your network design as a KMZ file for visualization in Google Earth or other mapping tools.
            Routes will be color-coded: <strong style={{color: '#ff0000'}}>Red</strong> for Primary, <strong style={{color: '#0000ff'}}>Blue</strong> for Secondary.
          </Typography>

          <FormControl component="fieldset" sx={{ width: '100%' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              Select Routes to Export:
            </Typography>
            <RadioGroup
              value={kmzExportType}
              onChange={(e) => setKmzExportType(e.target.value)}
            >
              <FormControlLabel
                value="primary"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Primary Route Only</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Export only the primary path (displayed in red)
                    </Typography>
                  </Box>
                }
                disabled={!searchResults?.primaryPath}
              />
              <FormControlLabel
                value="secondary"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Secondary Route Only</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Export only the secondary/protection path (displayed in blue)
                    </Typography>
                  </Box>
                }
                disabled={!searchResults?.diversePath}
              />
              <FormControlLabel
                value="both"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Both Routes (Protected Service)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Export both paths in one file with color coding
                    </Typography>
                  </Box>
                }
                disabled={!searchResults?.primaryPath || !searchResults?.diversePath}
              />
            </RadioGroup>
          </FormControl>

          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
              <strong>File includes:</strong> Network routes with color coding, source/destination markers, and disclaimer.
              The filename will be: {formData.quoteRequestId || 'Quote'}_{formData.customerName || 'Customer'}_{formData.source}_{formData.destination}.kmz
            </Typography>
          </Alert>

          {kmzExporting && (
            <Box sx={{ mt: 3, mb: 2 }}>
              <Typography variant="body2" color="primary" sx={{ mb: 1, fontWeight: 500 }}>
                {kmzExportStep}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={kmzExportProgress} 
                sx={{ height: 8, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {kmzExportProgress}% complete
              </Typography>
              {kmzExportProgress >= 40 && kmzExportProgress < 70 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="caption">
                    Processing circuit KMZ files may take 30-60 seconds for multi-hop routes. 
                    Large files and multiple circuits require additional processing time.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleKMZExportClose} color={kmzExporting ? 'error' : 'inherit'}>
            {kmzExporting ? 'Cancel Export' : 'Cancel'}
          </Button>
          <Button 
            onClick={handleKMZExport}
            variant="contained"
            startIcon={<MapIcon />}
            disabled={kmzExporting || !searchResults}
          >
            {kmzExporting ? 'Exporting...' : 'Export KMZ'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Missing Circuits Confirmation Dialog */}
      <Dialog
        open={kmzMissingCircuitsDialogOpen}
        onClose={handleMissingCircuitsCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            <Typography variant="h6">Missing KMZ Files</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            The following circuits are missing KMZ files and will be excluded from the export:
          </Alert>

          <Box sx={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 2 }}>
            {kmzMissingCircuits.map((circuit, index) => (
              <Box key={index} sx={{ mb: 1.5, pb: 1.5, borderBottom: index < kmzMissingCircuits.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  {circuit.circuitId}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Type: {circuit.type === 'primary' ? 'Primary Route' : 'Secondary Route'}
                </Typography>
                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                  {circuit.reason}
                </Typography>
              </Box>
            ))}
          </Box>

          <Typography variant="body2" sx={{ mt: 2 }}>
            Do you want to continue with the export using only the available circuits?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleMissingCircuitsCancel} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleMissingCircuitsContinue}
            variant="contained"
            color="primary"
          >
            Continue Export
          </Button>
        </DialogActions>
      </Dialog>

      {/* Route Suggestions Dialog */}
      <Dialog
        open={suggestionsDialogOpen}
        onClose={() => setSuggestionsDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Route Suggestions for {suggestionTarget === 'primary' ? 'Primary' : 'Secondary'} Path
        </DialogTitle>
        <DialogContent>
          {/* Show currently selected routes */}
          {((suggestionTarget === 'primary' && manualPrimaryRoutes) || 
            (suggestionTarget === 'secondary' && manualSecondaryRoutes)) && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Currently Selected Routes:</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {suggestionTarget === 'primary' ? manualPrimaryRoutes : manualSecondaryRoutes}
              </Typography>
            </Alert>
          )}
          
          {suggestionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : routeSuggestions.length > 0 ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Showing top {routeSuggestions.length} route{routeSuggestions.length > 1 ? 's' : ''} by estimated end-to-end latency.
                After adding a route, close this dialog and click "Find Suggestions" again to see next hops.
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                    <TableCell>UCN</TableCell>
                    <TableCell>Location A</TableCell>
                    <TableCell>Location B</TableCell>
                    <TableCell>Latency (ms)</TableCell>
                    <TableCell>Carrier</TableCell>
                    <TableCell>Cable System</TableCell>
                    <TableCell>Bandwidth</TableCell>
                    <TableCell>Est. End-to-End Latency (ms)</TableCell>
                    <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {routeSuggestions.map((suggestion, index) => (
                      <TableRow 
                        key={suggestion.circuit_id}
                        sx={{
                          backgroundColor: !suggestion.sufficientBandwidth ? 'rgba(255, 0, 0, 0.05)' : undefined,
                          opacity: !suggestion.sufficientBandwidth ? 0.6 : 1
                        }}
                      >
                        <TableCell>{suggestion.ucn}</TableCell>
                        <TableCell>{suggestion.location_a}</TableCell>
                        <TableCell>{suggestion.location_b}</TableCell>
                        <TableCell>{suggestion.latency}</TableCell>
                        <TableCell>{suggestion.carrier || 'N/A'}</TableCell>
                        <TableCell>{suggestion.cable_system || 'N/A'}</TableCell>
                        <TableCell>
                          {suggestion.bandwidthDisplay}
                          {!suggestion.sufficientBandwidth && (
                            <Chip 
                              label="Insufficient" 
                              size="small" 
                              color="error" 
                              sx={{ ml: 1 }} 
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={suggestion.estimatedEndToEndLatency}
                            color={index === 0 ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title={!suggestion.sufficientBandwidth ? 'Insufficient bandwidth' : 'Add this route'}>
                            <span>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleAddSuggestedRoute(suggestion.circuit_id)}
                                disabled={!suggestion.sufficientBandwidth}
                              >
                                Add Route
                              </Button>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                No {suggestionTarget === 'secondary' ? 'Secondary' : 'Primary'} Route Suggestions Available
              </Typography>
              <Typography variant="body2">
                {suggestionTarget === 'secondary' 
                  ? 'No suitable secondary paths found that meet the requirements and avoid the primary path locations. Consider using Auto Design mode or adjusting your route parameters.'
                  : 'No suitable routes found from the current location. Try using Auto Design mode or check your source and destination locations.'}
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuggestionsDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error/Success Messages */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default NetworkDesignTool; 