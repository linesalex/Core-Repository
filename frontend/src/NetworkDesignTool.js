import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Grid, Paper, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel,
  Chip, Alert, CircularProgress, Accordion, AccordionSummary, AccordionDetails, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Card, CardContent, CardHeader, Divider,
  Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem,
  ListItemText, ListItemIcon, Checkbox, Tooltip, IconButton, Snackbar, Tabs, Tab, Autocomplete
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import RouteIcon from '@mui/icons-material/Route';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';

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
  
  // Check if user can view pricing logs (not read-only)
  const canViewPricingLogs = user && user.role !== 'read_only';
  
  // Check if user can manage logs (admin only)
  const canManageLogs = user && user.role === 'administrator';
  
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

  // Data state
  const [locations, setLocations] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({});
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

  // Currency options
  const currencies = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'CAD', name: 'Canadian Dollar' }
  ];

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

  const loadInitialData = async () => {
    try {
      const promises = [
        networkDesignApi.getLocations(),
        networkDesignApi.getExchangeRates(),
        getCarriers()
      ];
      
      // Only load audit logs if user can view pricing logs
      if (canViewPricingLogs) {
        promises.push(networkDesignApi.getAuditLogs());
      }
      
      const results = await Promise.all(promises);
      const [locationsData, exchangeRatesData, carriersData, auditLogsData] = results;
      
      setLocations(locationsData);
      setCarriers(carriersData);
      
      // Only set audit logs if user can view them
      if (canViewPricingLogs && auditLogsData) {
        setAuditLogs(auditLogsData);
      }
      
      // Convert exchange rates to object for easy lookup
      const ratesObj = {};
      exchangeRatesData.forEach(rate => {
        ratesObj[rate.currency_code] = rate.exchange_rate;
      });
      setExchangeRates(ratesObj);
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
      const results = await networkDesignApi.findPath(searchParams);
      console.log('Received search results:', results);
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
              <Typography variant="h6">Search Parameters</Typography>
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

              {/* Output Currency - Now searchable */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={currencies}
                  getOptionLabel={(option) => `${option.code} - ${option.name}`}
                  value={currencies.find(curr => curr.code === formData.outputCurrency) || null}
                  onChange={(event, newValue) => {
                    handleInputChange('outputCurrency', newValue ? newValue.code : 'USD');
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Output Currency" />
                  )}
                />
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

              {/* Include Cisco Only Routes - right side with other checkboxes */}
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

              {/* Empty space for proper alignment */}
              <Grid item xs={12} md={6}>
              </Grid>

              {/* Include ULL - right side with other checkboxes */}
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

              {/* Empty space for proper alignment */}
              <Grid item xs={12} md={6}>
              </Grid>

              {/* Use 100Gb and DF routes only - below Include ULL */}
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
                    Find Route
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
                <Typography variant="h6">Search Results</Typography>
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
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {searchResults.primaryPath.route?.map((segment, index) => (
                              <TableRow key={index}>
                                <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                                <TableCell>{segment.from} → {segment.to}</TableCell>
                                <TableCell>{formatLatency(segment.latency)}ms</TableCell>
                                <TableCell>{segment.carrier || 'N/A'}</TableCell>
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
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {searchResults.diversePath.route?.map((segment, index) => (
                                <TableRow key={index}>
                                  <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                                  <TableCell>{segment.from} → {segment.to}</TableCell>
                                  <TableCell>{formatLatency(segment.latency)}ms</TableCell>
                                  <TableCell>{segment.carrier || 'N/A'}</TableCell>
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

                {/* Route Information Summary */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Route Information</Typography>
                      
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
                              <Typography variant="body2">
                                <strong>Protection Route Not Available:</strong> No diverse path could be found with the current constraints. 
                                The primary route is available, but protection requirements cannot be met.
                              </Typography>
                              
                              {/* Show detailed failure reasons if available */}
                              {searchResults.protectionStatus.failureReasons && (
                                <Box sx={{ mt: 2 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                    Protection Failure Analysis:
                                  </Typography>
                                  
                                  <Typography variant="body2" sx={{ mb: 1 }}>
                                    • Primary path using: {searchResults.protectionStatus.failureReasons.primary_path_blocked}
                                  </Typography>
                                  
                                  {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.source_isolated && (
                                    <Typography variant="body2" sx={{ mb: 1, color: 'error.main' }}>
                                      • Source location has no alternative connections after removing primary path
                                    </Typography>
                                  )}
                                  
                                  {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.destination_isolated && (
                                    <Typography variant="body2" sx={{ mb: 1, color: 'error.main' }}>
                                      • Destination location has no alternative connections after removing primary path
                                    </Typography>
                                  )}
                                  
                                  <Typography variant="body2" sx={{ mb: 1 }}>
                                    • Alternative routes remaining: {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.total_remaining_edges}
                                  </Typography>
                                  
                                  {(searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.bandwidth_still_excluding > 0 ||
                                    searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.carrier_avoidance_still_excluding > 0 ||
                                    searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.mtu_still_excluding > 0 ||
                                    searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.ull_still_excluding > 0) && (
                                    <Box sx={{ mt: 1 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                        Constraints still limiting protection routes:
                                      </Typography>
                                      {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.bandwidth_still_excluding > 0 && (
                                        <Typography variant="body2">
                                          • Bandwidth constraints excluding {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.bandwidth_still_excluding} additional routes
                                        </Typography>
                                      )}
                                      {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.carrier_avoidance_still_excluding > 0 && (
                                        <Typography variant="body2">
                                          • Carrier avoidance excluding {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.carrier_avoidance_still_excluding} additional routes
                                        </Typography>
                                      )}
                                      {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.mtu_still_excluding > 0 && (
                                        <Typography variant="body2">
                                          • MTU requirements excluding {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.mtu_still_excluding} additional routes
                                        </Typography>
                                      )}
                                      {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.ull_still_excluding > 0 && (
                                        <Typography variant="body2">
                                          • ULL restrictions excluding {searchResults.protectionStatus.failureReasons.remaining_routes_analysis.affected_constraints.ull_still_excluding} additional routes
                                        </Typography>
                                      )}
                                    </Box>
                                  )}
                                  
                                  <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic', color: 'text.secondary' }}>
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
                          <Typography variant="body2" color="text.secondary">
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
                              <Typography variant="body2" color="text.secondary">
                                Exclusion reasons:
                              </Typography>
                              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                {searchResults.exclusionReasons.bandwidth.count > 0 && (
                                  <Typography component="li" variant="body2" color="text.secondary">
                                    {searchResults.exclusionReasons.bandwidth.count} routes excluded due to insufficient bandwidth
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.carrier_avoidance.count > 0 && (
                                  <Typography component="li" variant="body2" color="text.secondary">
                                    {searchResults.exclusionReasons.carrier_avoidance.count} routes excluded due to carrier avoidance 
                                    ({searchResults.exclusionReasons.carrier_avoidance.carriers.join(', ')})
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.local_loop_carrier_avoidance?.count > 0 && (
                                  <Typography component="li" variant="body2" color="text.secondary">
                                    {searchResults.exclusionReasons.local_loop_carrier_avoidance.count} routes excluded due to local loop carrier avoidance 
                                    ({searchResults.exclusionReasons.local_loop_carrier_avoidance.carriers.join(', ')})
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.circuit_exclusion?.count > 0 && (
                                  <Typography component="li" variant="body2" color="text.secondary">
                                    {searchResults.exclusionReasons.circuit_exclusion.count} routes excluded due to user requested circuit exclusion 
                                    ({searchResults.exclusionReasons.circuit_exclusion.circuits.join(', ')})
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.mtu_requirement.count > 0 && (
                                  <Typography component="li" variant="body2" color="text.secondary">
                                    {searchResults.exclusionReasons.mtu_requirement.count} routes excluded due to MTU requirements
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.ull_restriction.count > 0 && (
                                  <Typography component="li" variant="body2" color="text.secondary">
                                    {searchResults.exclusionReasons.ull_restriction.count} Special/ULL routes excluded (Include ULL disabled)
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.equipment_restriction?.count > 0 && (
                                  <Typography component="li" variant="body2" color="text.secondary">
                                    {searchResults.exclusionReasons.equipment_restriction.count} routes excluded due to equipment restrictions 
                                    (Cisco equipment excluded - Include Cisco Only Routes disabled)
                                  </Typography>
                                )}
                                {searchResults.exclusionReasons.bandwidth_100gb_df_restriction?.count > 0 && (
                                  <Typography component="li" variant="body2" color="text.secondary">
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
                              <Typography variant="body2" color={rules.nrc > 0 ? 'info.main' : 'success.main'} fontWeight="bold">
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
                              <Typography variant="body2" color="success.main">
                                Minimum:
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" color="success.main">
                                {formatCurrency(result.pricing.minimumPrice, result.pricing.currency)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="warning.main">
                                Suggested:
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" color="warning.main">
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
                                <Typography variant="body2">Setup Fee ({result.pricing.contractTerm}-month term):</Typography>
                                <Typography variant="body2" fontWeight="bold" color="info.main">
                                  {formatCurrency(result.pricing.nrcCharge, result.pricing.currency)}
                                </Typography>
                              </Box>
                            </Box>
                          )}

                          {result.pricing.nrcCharge === 0 && (
                            <Box sx={{ bgcolor: 'success.50', p: 2, borderRadius: 1 }}>
                              <Typography variant="subtitle2" gutterBottom>Non-Recurring Charges (NRC)</Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Setup Fee ({result.pricing.contractTerm}-month term):</Typography>
                                <Typography variant="body2" fontWeight="bold" color="success.main">
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
                              <Typography variant="body2" color="success.main">
                                Minimum:
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" color="success.main">
                                {formatCurrency(pricingResults.protectionPricing.minimumPrice, pricingResults.protectionPricing.currency)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="warning.main">
                                Suggested:
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" color="warning.main">
                                {formatCurrency(pricingResults.protectionPricing.suggestedPrice, pricingResults.protectionPricing.currency)}
                              </Typography>
                            </Box>
                          </Box>
                          
                          {/* NRC for Protection */}
                          <Box sx={{ bgcolor: pricingResults.protectionPricing.nrcCharge > 0 ? 'info.50' : 'success.50', p: 1.5, borderRadius: 1 }}>
                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                              <strong>Setup Fee:</strong>
                            </Typography>
                            <Typography variant="body2" fontWeight="bold" color={pricingResults.protectionPricing.nrcCharge > 0 ? 'info.main' : 'success.main'}>
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
                              <Typography variant="body2" color="text.secondary">
                                NRC (One-time):
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" color="primary.main">
                                {crossConnectResults.source.nrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.source.nrc, crossConnectResults.source.currency)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="text.secondary">
                                MRC (Monthly):
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" color="secondary.main">
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
                              <Typography variant="body2" color="text.secondary">
                                NRC (One-time):
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" color="primary.main">
                                {crossConnectResults.destination.nrc === 'POA' ? 'POA' : formatCurrency(crossConnectResults.destination.nrc, crossConnectResults.destination.currency)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="text.secondary">
                                MRC (Monthly):
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" color="secondary.main">
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
                label={`${auditLogs.length} entries`} 
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
          
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Timestamp</strong></TableCell>
                  <TableCell><strong>User</strong></TableCell>
                  <TableCell><strong>Action</strong></TableCell>
                  <TableCell><strong>Request Summary</strong></TableCell>
                  <TableCell><strong>Pricing Results</strong></TableCell>
                  <TableCell><strong>Execution Time</strong></TableCell>
                  <TableCell align="center"><strong>Details</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <TableRow>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(log.timestamp).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
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
                      <TableCell sx={{ maxWidth: 400 }}>
                        <Typography variant="body2">
                          {formatReadableLogSummary(log)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 400 }}>
                        <Typography variant="body2">
                          {formatReadableResultsSummary(log)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {log.execution_time ? `${log.execution_time}ms` : 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => toggleLogExpansion(log.id)}
                        >
                          {expandedLogs.has(log.id) ? 'Hide Details' : 'View Details'}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedLogs.has(log.id) && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ backgroundColor: '#f8f9fa', border: 'none' }}>
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