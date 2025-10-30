import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Grid, Paper, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel,
  Chip, Alert, CircularProgress, Accordion, AccordionSummary, AccordionDetails, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Card, CardContent, CardHeader, Divider,
  Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem,
  ListItemText, ListItemIcon, Checkbox, Tooltip, IconButton, Snackbar, Tabs, Tab, Autocomplete,
  InputAdornment
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
import LoadingButton from '@mui/lab/LoadingButton';
import { networkDesignApi, getCrossConnectInfo } from './api';
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
  const { user } = useAuth();
  
  // Check if user can view pricing logs (all authenticated users can view)
  const canViewPricingLogs = user !== null;
  
  // Check if user can manage logs (admin only)
  const canManageLogs = user && user.role === 'administrator';
  
  // Check if user is read-only (limited access to logs)
  const isReadOnly = user && user.role === 'read_only';
  
  // Form state
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    bandwidth: '',
    includeULL: false,
    useCiscoOnlyRoutes: false,
    use100GbAndDFOnly: false,
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
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedAccordion, setExpandedAccordion] = useState('search');
  const [currentTab, setCurrentTab] = useState(0); // Tab state
  const [expandedLogs, setExpandedLogs] = useState(new Set()); // Track expanded log details
  
  // Pricing logs filtering state
  const [filteredAuditLogs, setFilteredAuditLogs] = useState([]);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logDateFilter, setLogDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  
  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    primaryPricing: false,
    secondaryPricing: false,
    protectedPricing: false
  });

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
    if (user && user.role === 'read_only' && expandedLogs.size > 0) {
      console.log('NetworkDesignTool - Clearing expanded logs for read-only user');
      setExpandedLogs(new Set());
    }
    
    if (user) {
      console.log('NetworkDesignTool - User role:', user.role);
      console.log('NetworkDesignTool - isReadOnly:', isReadOnly);
    }
  }, [user, isReadOnly, expandedLogs]);

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
      
      // Only load audit logs if user can view pricing logs
      if (canViewPricingLogs) {
        promises.push(networkDesignApi.getAuditLogs());
      }
      
      const results = await Promise.all(promises);
      const [locationsData, carriersData, auditLogsData] = results;
      
      setLocations(locationsData);
      setCarriers(carriersData);
      
      // Only set audit logs if user can view them
      if (canViewPricingLogs && auditLogsData) {
        setAuditLogs(auditLogsData);
      }
      
      // Load exchange rates separately
      await loadExchangeRates();
    } catch (err) {
      setError('Failed to load initial data: ' + err.message);
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

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
        mtu_required: formData.mtuRequired ? parseFloat(formData.mtuRequired) : 1500
      };

      console.log('Complete request data:', JSON.stringify(requestData, null, 2));

      const response = await fetch(`${API_BASE_URL}/network_design/suggest_routes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

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
      
      // Show message if no suggestions available
      if (data.suggestions.length === 0) {
        setError('No route suggestions available. Try using Auto Design mode.');
      }
    } catch (error) {
      const errorMessage = error.message || 'Failed to get route suggestions';
      
      // Check for specific error responses
      if (error.message && error.message.includes('No routes available')) {
        setError('No routes available from current location. Try using Auto Design mode.');
      } else {
        setError('Failed to get route suggestions: ' + errorMessage);
      }
      
      setRouteSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
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
        use_100gb_and_df_only: formData.use100GbAndDFOnly
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
        const searchParams = {
          source: formData.source,
          destination: formData.destination,
          bandwidth: formData.bandwidth ? parseFloat(formData.bandwidth) : undefined,
          bandwidth_unit: 'Mbps',
          include_ull: formData.includeULL,
          use_cisco_only_routes: formData.useCiscoOnlyRoutes,
          use_100gb_and_df_only: formData.use100GbAndDFOnly,
          quoteRequestId: formData.quoteRequestId,
          customerName: formData.customerName,
          constraints: {
            protection_required: formData.protectionRequired,
            mtu_required: formData.mtuRequired ? parseFloat(formData.mtuRequired) : 1500, // Default to 1500 if not specified
            carrier_avoidance: formData.carrierAvoidance.length > 0 ? formData.carrierAvoidance : undefined,
            circuit_exclusion: formData.circuitExclusion.length > 0 ? formData.circuitExclusion : undefined
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
        customerName: formData.customerName
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
      } else {
        setError('Search failed: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoading(false);
    }
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

  const formatReadableLogSummary = (log) => {
    try {
      const params = log.parameters || log.pricing_data?.inputParameters;
      
      if (!params) return "No parameter data available";

      let summary = "";
      
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

    let emailBody = '';
    
    // Header information - always shown
    emailBody += `Customer Name: ${formData.customerName || 'Not Specified'}\n`;
    emailBody += `Quote Request ID: ${formData.quoteRequestId || 'Not Specified'}\n`;
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
      section += `Currency: ${pricing.currency}\n`;
      section += `Contract Term: ${pricing.contractTerm} months\n\n`;
      return section;
    };

    // Generate content based on selected options
    const hasMultipleSelections = Object.values(exportOptions).filter(Boolean).length > 1;
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

    // Cross Connect Information
    if (crossConnectResults.source) {
      emailBody += `Source Cross Connect\n`;
      emailBody += `POP Name: ${crossConnectResults.source.locationCode} - ${crossConnectResults.source.datacenterName}\n`;
      emailBody += `NRC: ${crossConnectResults.source.nrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.source.nrc, crossConnectResults.source.currency)}\n`;
      emailBody += `MRC: ${crossConnectResults.source.mrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.source.mrc, crossConnectResults.source.currency)}\n`;
      if (crossConnectResults.source.notes) {
        emailBody += `Notes: ${crossConnectResults.source.notes}\n`;
      }
      emailBody += `Currency: ${crossConnectResults.source.currency}\n\n`;
    }

    if (crossConnectResults.destination) {
      emailBody += `Destination Cross Connect\n`;
      emailBody += `POP Name: ${crossConnectResults.destination.locationCode} - ${crossConnectResults.destination.datacenterName}\n`;
      emailBody += `NRC: ${crossConnectResults.destination.nrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.destination.nrc, crossConnectResults.destination.currency)}\n`;
      emailBody += `MRC: ${crossConnectResults.destination.mrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.destination.mrc, crossConnectResults.destination.currency)}\n`;
      if (crossConnectResults.destination.notes) {
        emailBody += `Notes: ${crossConnectResults.destination.notes}\n`;
      }
      emailBody += `Currency: ${crossConnectResults.destination.currency}\n\n`;
    }

    // Pricing Disclaimer
    emailBody += `${'='.repeat(80)}\n`;
    emailBody += `PRICING DISCLAIMER\n`;
    emailBody += `${'='.repeat(80)}\n`;
    emailBody += `This quotation is valid for 90 days.\n`;
    emailBody += `All Pricing is subject to IPC standard terms and conditions.\n`;
    emailBody += `All Pricing is budgetary and subject to survey and facility/feasibility checks.\n`;
    emailBody += `All Pricing is exclusive of any applicable Taxes and Surcharges.\n`;
    emailBody += `Any additional 3rd Party costs incurred on order of the service will be chargeable to the customer, including but not limited to cross connects, additional cabling, out of hours charges, etc\n`;
    emailBody += `Unless otherwise stated any additional costs incurred for out of hours work will be chargeable to the customer.\n`;
    emailBody += `Customer must provide all necessary rack space and power supply.\n`;
    emailBody += `Pricing is for connectivity only, and does not include any fees associated with data feeds unless specified otherwise within the quotation.\n`;
    emailBody += `IPC reserves the right to correct any computational errors in this quote.\n`;
    emailBody += `Where Pricing is associated with a network or multi circuit design, individual element pricing is indicative, and cannot be ordered as individual elements.\n`;

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
      // Create proper .eml email file content
      const timestamp = new Date().toISOString();
      const emailContent = [
        `From: Network Design Tool <noreply@ipc.com>`,
        `To: `,
        `Subject: ${subject}`,
        `Date: ${timestamp}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=utf-8`,
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
        protectionRequired: params.protection_required || params.protectionRequired || false,
        mtuRequired: params.mtu_required || params.mtuRequired || '',
        carrierAvoidance: params.carrier_avoidance || params.carrierAvoidance || [],
        circuitExclusion: params.circuit_exclusion || params.circuitExclusion || [],
        outputCurrency: params.output_currency || params.outputCurrency || 'USD',
        contractTerm: params.contract_term || params.contractTerm || 12,
        quoteRequestId: params.quoteRequestId || params.quote_request_id || '',
        customerName: params.customerName || params.customer_name || ''
      }));

      // Check if this was a manual mode search by looking at the log data
      // (Future enhancement: store design_mode in the log parameters)
      setDesignMode('auto'); // Default to auto for now

      // Switch to the Network Design tab
      setCurrentTab(0);
      setExpandedAccordion('search');
      
      setSuccess('Search parameters loaded from pricing log. You can modify and re-run the search.');
      
    } catch (error) {
      console.error('Reload from log error:', error);
      setError('Failed to reload search: ' + error.message);
    }
  };

  const generatePricingLogEmailBody = (params, results) => {
    let emailBody = '';
    
    // Header information - always shown
    emailBody += `Customer Name: ${params.customerName || params.customer_name || 'Not Specified'}\n`;
    emailBody += `Quote Request ID: ${params.quoteRequestId || params.quote_request_id || 'Not Specified'}\n`;
    emailBody += `Source Location: ${params.source || 'Not Specified'}\n`;
    emailBody += `Destination Location: ${params.destination || 'Not Specified'}\n`;
    emailBody += `Bandwidth: ${params.bandwidth || 'Not Specified'} Mbps\n`;
    emailBody += `Quote Time & Date: ${new Date().toLocaleString()}\n\n`;

    // Helper function to generate route table from log data with better structure mapping
    const generateRouteTableFromLog = (pathData, pathType) => {
      // Try different possible route data structures
      const routeData = pathData?.route || pathData?.routes || pathData?.path;
      
      if (!routeData || (!Array.isArray(routeData) && !routeData.length)) {
        // Try alternative data structure
        if (pathData?.hops && Array.isArray(pathData.hops)) {
          const routes = pathData.hops;
          let table = `${pathType} Route:\n`;
          table += `Circuit ID\tRoute Segment\tLatency\tCarrier\tCable System\n`;
          table += `${'='.repeat(70)}\n`;
          
          routes.forEach(segment => {
            const circuitId = segment.circuit_id || segment.circuitId || 'N/A';
            const from = segment.from || segment.location_a || segment.source || 'N/A';
            const to = segment.to || segment.location_b || segment.destination || 'N/A';
            const latency = segment.latency || 0;
            const carrier = segment.carrier || segment.underlying_carrier || 'N/A';
            const cableSystem = segment.cable_system || segment.cableSystem || 'N/A';
            table += `${circuitId}\t${from} → ${to}\t${formatLatency(latency)}ms\t${carrier}\t${cableSystem}\n`;
          });
          
          table += `${'='.repeat(70)}\n`;
          table += `Total Latency: ${formatLatency(pathData.totalLatency || pathData.total_latency || 0)}ms\n\n`;
          return table;
        }
        return '';
      }
      
      let table = `${pathType} Route:\n`;
      table += `Circuit ID\tRoute Segment\tLatency\tCarrier\tCable System\n`;
      table += `${'='.repeat(70)}\n`;
      
      const routes = Array.isArray(routeData) ? routeData : [routeData];
      routes.forEach(segment => {
        const circuitId = segment.circuit_id || segment.circuitId || 'N/A';
        const from = segment.from || segment.location_a || segment.source || 'N/A';
        const to = segment.to || segment.location_b || segment.destination || 'N/A';
        const latency = segment.latency || 0;
        const carrier = segment.carrier || segment.underlying_carrier || 'N/A';
        const cableSystem = segment.cable_system || segment.cableSystem || 'N/A';
        table += `${circuitId}\t${from} → ${to}\t${formatLatency(latency)}ms\t${carrier}\t${cableSystem}\n`;
      });
      
      table += `${'='.repeat(70)}\n`;
      table += `Total Latency: ${formatLatency(pathData.totalLatency || pathData.total_latency || 0)}ms\n\n`;
      
      return table;
    };

    // Helper function to format pricing section from log data
    const formatPricingSectionFromLog = (pricing, pathType) => {
      if (!pricing) return '';
      
      let section = `${pathType} Pricing:\n`;
      section += `NRC: ${pricing.nrcCharge > 0 ? formatCurrency(pricing.nrcCharge, pricing.currency) : 'FREE'}\n`;
      section += `MRC (Minimum): ${formatCurrency(pricing.minimumPrice, pricing.currency)}\n`;
      section += `MRC (Suggested): ${formatCurrency(pricing.suggestedPrice, pricing.currency)}\n`;
      section += `Currency: ${pricing.currency}\n`;
      section += `Contract Term: ${pricing.contractTerm} months\n`;
      section += `Bandwidth: ${pricing.bandwidth} Mbps\n`;
      
      // Margins removed - not included in exports per user requirement
      
      // Add promo pricing information if used
      if (pricing.promoPricing && pricing.promoPricing.used) {
        section += `\nPromo Pricing Applied:\n`;
        section += `Rule: ${pricing.promoPricing.ruleName} (ID: ${pricing.promoPricing.ruleId})\n`;
        section += `Original Price: ${formatCurrency(pricing.promoPricing.originalPriceUSD, 'USD')}\n`;
        section += `Price Field: ${pricing.promoPricing.priceField}\n`;
      }
      
      section += `\n`;
      return section;
    };

    console.log('Export Debug - Results structure:', results); // Debug log

    // Process all available pricing results from the log with improved data extraction
    
    // Handle "individual" array structure (new format)
    if (results && results.individual && Array.isArray(results.individual)) {
      console.log('Export Debug - Found individual array:', results.individual);
      
      results.individual.forEach((result, index) => {
        const pathType = result.pathType === 'primary' ? 'Primary' : 
                        result.pathType === 'protection' ? 'Secondary' : 
                        `Path ${index + 1}`;
        
        console.log(`Export Debug - Processing ${pathType}:`, result);
        
        // Generate route table - check if we have detailed route info
        if (result.pricing && result.pricing.detailedCalculations && result.pricing.detailedCalculations.allocatedCostBreakdown && result.pricing.detailedCalculations.allocatedCostBreakdown.segments) {
          // Use detailed calculations which have all circuit info
          const segments = result.pricing.detailedCalculations.allocatedCostBreakdown.segments;
          let table = `${pathType} Route:\n`;
          table += `Circuit ID\tRoute Segment\tLatency\tCarrier\tCable System\n`;
          table += `${'='.repeat(70)}\n`;
          
          segments.forEach(segment => {
            const circuitId = segment.circuit || 'N/A';
            const location = segment.location || 'N/A';
            const latency = segment.latency || 0;
            const carrier = segment.carrier || 'N/A';
            const cableSystem = segment.cable_system || segment.cableSystem || 'N/A';
            table += `${circuitId}\t${location}\t${formatLatency(latency)}ms\t${carrier}\t${cableSystem}\n`;
          });
          
          table += `${'='.repeat(70)}\n`;
          table += `Total Latency: ${formatLatency(result.totalLatency || 0)}ms\n`;
          table += `Hops: ${result.hops || segments.length}\n\n`;
          
          emailBody += table;
        } else if (result.path && Array.isArray(result.path)) {
          // Fallback to path array if detailed calculations not available
          let table = `${pathType} Route:\n`;
          table += `Route Segment\tLatency\n`;
          table += `${'='.repeat(70)}\n`;
          
          // Convert path array to route segments
          for (let i = 0; i < result.path.length - 1; i++) {
            const from = result.path[i];
            const to = result.path[i + 1];
            table += `${from} → ${to}\t${formatLatency(result.totalLatency || 0)}ms\n`;
          }
          
          table += `${'='.repeat(70)}\n`;
          table += `Total Latency: ${formatLatency(result.totalLatency || 0)}ms\n`;
          table += `Hops: ${result.hops || 'N/A'}\n\n`;
          
          emailBody += table;
        }
        
        // Add pricing information
        if (result.pricing) {
          emailBody += formatPricingSectionFromLog(result.pricing, pathType);
        }
      });
    }
    
    // Handle legacy "results" or "paths" array structure
    else if (results && (results.results || results.paths)) {
      const pathResults = results.results || results.paths || [];
      
      // Find primary and protection paths
      const primaryResult = pathResults.find(r => r.pathType === 'primary' || r.type === 'primary');
      const protectionResult = pathResults.find(r => r.pathType === 'protection' || r.type === 'protection');
      
      // Add primary path and pricing
      if (primaryResult) {
        console.log('Export Debug - Primary result:', primaryResult); // Debug log
        emailBody += generateRouteTableFromLog(primaryResult, 'Primary');
        if (primaryResult.pricing) {
          emailBody += formatPricingSectionFromLog(primaryResult.pricing, 'Primary');
        }
      }
      
      // Add protection/secondary path and pricing
      if (protectionResult) {
        console.log('Export Debug - Protection result:', protectionResult); // Debug log
        emailBody += generateRouteTableFromLog(protectionResult, 'Secondary');
        if (protectionResult.pricing) {
          emailBody += formatPricingSectionFromLog(protectionResult.pricing, 'Secondary');
        }
      }
    }

    // Also check for search results structure (when exporting from path search logs)
    if (results.searchResults && results.searchResults.primary) {
      const primaryPath = results.searchResults.primary;
      emailBody += generateRouteTableFromLog(primaryPath, 'Primary');
    }

    if (results.searchResults && results.searchResults.protection) {
      const protectionPath = results.searchResults.protection;
      emailBody += generateRouteTableFromLog(protectionPath, 'Secondary');
    }

    // Handle protection pricing separately if it exists
    if (results.protection && results.protection.pricing) {
      emailBody += formatPricingSectionFromLog(results.protection.pricing, 'Protected Service');
    }

    // Add protected service pricing if available
    if (results.protectionPricing) {
      emailBody += formatPricingSectionFromLog(results.protectionPricing, 'Protected Service');
    }

    // Handle cross connect information from multiple possible locations
    const logCrossConnect = params.crossConnect || results.crossConnect || {};
    if (logCrossConnect.source) {
      emailBody += `Source Cross Connect\n`;
      emailBody += `POP Name: ${logCrossConnect.source.locationCode} - ${logCrossConnect.source.datacenterName}\n`;
      emailBody += `NRC: ${logCrossConnect.source.nrc === 'POA' ? 'POA' : formatCurrency(logCrossConnect.source.nrc, logCrossConnect.source.currency)}\n`;
      emailBody += `MRC: ${logCrossConnect.source.mrc === 'POA' ? 'POA' : formatCurrency(logCrossConnect.source.mrc, logCrossConnect.source.currency)}\n`;
      if (logCrossConnect.source.notes) {
        emailBody += `Notes: ${logCrossConnect.source.notes}\n`;
      }
      emailBody += `Currency: ${logCrossConnect.source.currency}\n\n`;
    }

    if (logCrossConnect.destination) {
      emailBody += `Destination Cross Connect\n`;
      emailBody += `POP Name: ${logCrossConnect.destination.locationCode} - ${logCrossConnect.destination.datacenterName}\n`;
      emailBody += `NRC: ${logCrossConnect.destination.nrc === 'POA' ? 'POA' : formatCurrency(logCrossConnect.destination.nrc, logCrossConnect.destination.currency)}\n`;
      emailBody += `MRC: ${logCrossConnect.destination.mrc === 'POA' ? 'POA' : formatCurrency(logCrossConnect.destination.mrc, logCrossConnect.destination.currency)}\n`;
      if (logCrossConnect.destination.notes) {
        emailBody += `Notes: ${logCrossConnect.destination.notes}\n`;
      }
      emailBody += `Currency: ${logCrossConnect.destination.currency}\n\n`;
    }

    // Pricing Disclaimer
    emailBody += `${'='.repeat(80)}\n`;
    emailBody += `PRICING DISCLAIMER\n`;
    emailBody += `${'='.repeat(80)}\n`;
    emailBody += `This quotation is valid for 90 days.\n`;
    emailBody += `All Pricing is subject to IPC standard terms and conditions.\n`;
    emailBody += `All Pricing is budgetary and subject to survey and facility/feasibility checks.\n`;
    emailBody += `All Pricing is exclusive of any applicable Taxes and Surcharges.\n`;
    emailBody += `Any additional 3rd Party costs incurred on order of the service will be chargeable to the customer, including but not limited to cross connects, additional cabling, out of hours charges, etc\n`;
    emailBody += `Unless otherwise stated any additional costs incurred for out of hours work will be chargeable to the customer.\n`;
    emailBody += `Customer must provide all necessary rack space and power supply.\n`;
    emailBody += `Pricing is for connectivity only, and does not include any fees associated with data feeds unless specified otherwise within the quotation.\n`;
    emailBody += `IPC reserves the right to correct any computational errors in this quote.\n`;
    emailBody += `Where Pricing is associated with a network or multi circuit design, individual element pricing is indicative, and cannot be ordered as individual elements.\n`;

    return emailBody;
  };

  // Pricing Logs Filtering Functions
  useEffect(() => {
    filterAuditLogs();
  }, [auditLogs, logSearchTerm, logDateFilter]);

  const filterAuditLogs = () => {
    let filtered = [...auditLogs];

    // Search by Quote Request ID
    if (logSearchTerm.trim()) {
      filtered = filtered.filter(log => {
        try {
          const params = log.parameters || log.pricing_data?.inputParameters;
          const quoteId = params?.quoteRequestId || params?.quote_request_id || '';
          return quoteId.toLowerCase().includes(logSearchTerm.toLowerCase());
        } catch {
          return false;
        }
      });
    }

    // Filter by date range
    if (logDateFilter.startDate || logDateFilter.endDate) {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);
        const startDate = logDateFilter.startDate ? new Date(logDateFilter.startDate) : null;
        const endDate = logDateFilter.endDate ? new Date(logDateFilter.endDate + 'T23:59:59') : null;

        if (startDate && logDate < startDate) return false;
        if (endDate && logDate > endDate) return false;
        return true;
      });
    }

    setFilteredAuditLogs(filtered);
  };

  const handleLogSearchChange = (event) => {
    setLogSearchTerm(event.target.value);
  };

  const handleDateFilterChange = (field) => (event) => {
    setLogDateFilter(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const clearLogFilters = () => {
    setLogSearchTerm('');
    setLogDateFilter({ startDate: '', endDate: '' });
  };

  // Cross Connect Functions
  const handleToggleCrossConnect = async (locationType) => {
    try {
      setLoading(true);
      setError('');
      
      // Check if this location type already has results (remove case)
      if (crossConnectResults[locationType]) {
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
      const calculatePrice = (basePrice, margin, fromCurrency, toCurrency) => {
        if (!basePrice || basePrice === null) return 'POA';
        
        // Apply margin (not markup) - same formula as backend pricing logic
        const priceWithMargin = basePrice / (1 - margin / 100);
        
        // Convert currency using backend-compatible logic
        const convertedPrice = convertCurrency(priceWithMargin, fromCurrency, toCurrency);
        
        // Round up to nearest $10 as per pricing rules
        return roundUpToNearest10(convertedPrice);
      };
      
      const nrcPrice = calculatePrice(
        crossConnectData.cross_connect_nrc,
        margins.nrcMargin,
        crossConnectData.cross_connect_nrc_currency,
        formData.outputCurrency
      );
      
      const mrcPrice = calculatePrice(
        crossConnectData.cross_connect_mrc,
        margins.mrcMargin,
        crossConnectData.cross_connect_mrc_currency,
        formData.outputCurrency
      );
      
      setCrossConnectResults(prev => ({
        ...prev,
        [locationType]: {
          locationCode: crossConnectData.location_code,
          datacenterName: crossConnectData.datacenter_name,
          nrc: nrcPrice,
          mrc: mrcPrice,
          notes: crossConnectData.cross_connect_notes,
          currency: formData.outputCurrency
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
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SearchIcon sx={{ mr: 1 }} />
              <Typography variant="h6" sx={{ fontSize: '1.1875rem' }}>Search Parameters</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* Design Mode Selector */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
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

              {/* Source and Destination - Now searchable */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={locations}
                  getOptionLabel={(option) => `${option.location_code} - ${option.city}, ${option.country}`}
                  value={locations.find(loc => loc.location_code === formData.source) || null}
                  onChange={(event, newValue) => {
                    handleInputChange('source', newValue ? newValue.location_code : '');
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Source Location" fullWidth />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={locations}
                  getOptionLabel={(option) => `${option.location_code} - ${option.city}, ${option.country}`}
                  value={locations.find(loc => loc.location_code === formData.destination) || null}
                  onChange={(event, newValue) => {
                    handleInputChange('destination', newValue ? newValue.location_code : '');
                  }}
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
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Button
                              size="small"
                              onClick={() => {
                                setManualPrimaryRoutes('');
                                setPrimaryRouteValidation({ valid: false, message: '', routes: [] });
                              }}
                              disabled={!manualPrimaryRoutes}
                              sx={{ mr: 1 }}
                            >
                              Clear
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleFindSuggestions('primary')}
                              disabled={!formData.source || !formData.destination || !formData.bandwidth}
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
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <Button
                                size="small"
                                onClick={() => {
                                  setManualSecondaryRoutes('');
                                  setSecondaryRouteValidation({ valid: false, message: '', routes: [] });
                                }}
                                disabled={!manualSecondaryRoutes}
                                sx={{ mr: 1 }}
                              >
                                Clear
                              </Button>
                              <Button
                                size="small"
                                onClick={() => handleFindSuggestions('secondary')}
                                disabled={!formData.source || !formData.destination || !formData.bandwidth}
                                sx={{ mr: 1 }}
                              >
                                Find Suggestions
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={handleSuggestSecondaryPath}
                                disabled={!formData.source || !formData.destination || !formData.bandwidth}
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
                  renderInput={(params) => (
                    <TextField {...params} label="Carrier Avoidance" />
                  )}
                />
              </Grid>

              {/* Circuit ID Exclusion - Only shows results when user types */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={circuitIds}
                  getOptionLabel={(option) => option}
                  value={formData.circuitExclusion}
                  onChange={(event, newValue) => {
                    handleInputChange('circuitExclusion', newValue);
                  }}
                  onInputChange={(event, inputValue) => {
                    // Only fetch circuit IDs when user starts typing
                    if (inputValue && inputValue.length >= 2) {
                      loadCircuitIds(inputValue);
                    }
                  }}
                  noOptionsText="Type to search circuit IDs..."
                  loadingText="Loading circuit IDs..."
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Circuit ID Exclusion" 
                      placeholder="Type to search circuits to exclude..."
                      helperText="Search and select circuit IDs to exclude from routing"
                    />
                  )}
                />
              </Grid>
                </>
              )}

              {/* Output Currency */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
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
                    />
                  }
                  label="Protection Required"
                />
              </Grid>

              {/* Contract Term - left side under Output Currency */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
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
                      />
                    }
                    label="Include ULL"
                  />
                </Grid>
              )}

              {/* Empty space for proper alignment */}
              <Grid item xs={12} md={6}>
              </Grid>

              {/* Use 100Gb and DF routes only - hide when manual mode */}
              {designMode === 'auto' && (
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.use100GbAndDFOnly}
                        onChange={(e) => handleInputChange('use100GbAndDFOnly', e.target.checked)}
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
                    disabled={!formData.source || !formData.destination}
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
              <Grid container spacing={3}>
                {/* Primary Path */}
                <Grid item xs={12} md={searchResults.diversePath ? 6 : 12}>
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

                {/* Diverse Path */}
                {searchResults.diversePath && (
                  <Grid item xs={12} md={6}>
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

              {/* Contract Term Summary */}
              {pricingResults.contractTermDetails && (
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
                        title="Source Cross Connect"
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
                                {crossConnectResults.source.nrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.source.nrc, crossConnectResults.source.currency)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                MRC (Monthly):
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold" color="secondary.main">
                                {crossConnectResults.source.mrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.source.mrc, crossConnectResults.source.currency)}
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
                        title="Destination Cross Connect"
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
                                {crossConnectResults.destination.nrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.destination.nrc, crossConnectResults.destination.currency)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                                MRC (Monthly):
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold" color="secondary.main">
                                {crossConnectResults.destination.mrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.destination.mrc, crossConnectResults.destination.currency)}
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
                label={`${filteredAuditLogs.length} of ${auditLogs.length} entries`} 
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
                <Grid item xs={12} md={4}>
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
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Start Date"
                    value={logDateFilter.startDate}
                    onChange={handleDateFilterChange('startDate')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="End Date"
                    value={logDateFilter.endDate}
                    onChange={handleDateFilterChange('endDate')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    onClick={clearLogFilters}
                    startIcon={<FilterListOffIcon />}
                  >
                    Clear Filters
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
                  <TableCell><strong>Quote Request ID</strong></TableCell>
                  <TableCell><strong>Request Summary</strong></TableCell>
                  <TableCell><strong>Pricing Results</strong></TableCell>
                  <TableCell><strong>Execution Time</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAuditLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <TableRow>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {log.user_name || 'Unknown User'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={log.action_type} 
                          color={log.action_type === 'PATH_SEARCH' ? 'primary' : 'secondary'} 
                          size="small" 
                        />
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
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {/* View Details - hide for read-only users */}
                          {user && (user.role === 'administrator' || user.role === 'provisioner') && (
                            <Button
                              variant="outlined"
                              size="small"
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
                          
                          {/* Reload Search - available to all users */}
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<HistoryIcon />}
                            onClick={() => handleReloadFromLog(log)}
                            color="secondary"
                          >
                            Reload Search
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                    {expandedLogs.has(log.id) && user && (user.role === 'administrator' || user.role === 'provisioner') && (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ backgroundColor: '#f8f9fa', border: 'none' }}>
                          <Box sx={{ p: 2 }}>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                  <strong>Complete Input Data:</strong>
                                </Typography>
                                <Box 
                                  component="pre" 
                                  sx={{ 
                                    fontSize: '0.75rem', 
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    maxHeight: '300px',
                                    overflow: 'auto',
                                    backgroundColor: '#f5f5f5',
                                    padding: 1,
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
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    maxHeight: '300px',
                                    overflow: 'auto',
                                    backgroundColor: '#f5f5f5',
                                    padding: 1,
                                    borderRadius: 1,
                                    border: '1px solid #ddd'
                                  }}
                                >
                                  {log.results ? JSON.stringify(log.results, null, 2) : 
                                   log.pricing_data?.calculationResults ? JSON.stringify(log.pricing_data.calculationResults, null, 2) : 
                                   'No results data available'}
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
            <Alert severity="info">
              No route suggestions available. Try using Auto Design mode.
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