import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Paper, Grid, Alert, CircularProgress, Card, CardContent, CardHeader,
  Autocomplete, FormControlLabel, Checkbox, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Accordion, AccordionSummary, AccordionDetails, Tabs, Tab, IconButton, Divider,
  Tooltip, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions
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
  const { user } = useAuth();
  
  // Check permissions
  const canViewPricingLogs = user && user.role !== 'read_only';
  const canManageLogs = user && user.role === 'administrator';
  
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
  
  // Data state
  const [locations, setLocations] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({});
  const [availableCurrencies, setAvailableCurrencies] = useState(['USD']);
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [pricingResults, setPricingResults] = useState(null);
  const [crossConnectResults, setCrossConnectResults] = useState({
    source: null,
    destination: null
  });
  
  // Validation state
  const [primaryPathValidation, setPrimaryPathValidation] = useState({ valid: false, message: '', routes: [] });
  const [secondaryPathValidation, setSecondaryPathValidation] = useState({ valid: false, message: '', routes: [] });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedAccordion, setExpandedAccordion] = useState('input');
  const [currentTab, setCurrentTab] = useState(0);
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  
  // Pricing logs filtering state
  const [filteredAuditLogs, setFilteredAuditLogs] = useState([]);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logDateFilter, setLogDateFilter] = useState({ startDate: '', endDate: '' });
  
  // Cross-connect state
  const [crossConnectEnabled, setCrossConnectEnabled] = useState({
    source: false,
    destination: false
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
      const [locationsData, ratesData] = await Promise.all([
        networkDesignApi.getLocations(),
        networkDesignApi.getExchangeRates()
      ]);
      
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
      
      // Load audit logs
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
      const logs = await networkDesignApi.getAllChangeLogs({
        table_name: 'allocated_cost_calculator'
      });
      setAuditLogs(logs || []);
      setFilteredAuditLogs(logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
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
      // Fetch route details
      const routePromises = circuitIds.map(circuitId => 
        networkDesignApi.fetchRoute(circuitId).catch(err => null)
      );
      const routes = await Promise.all(routePromises);
      
      // Check for not found routes
      const notFound = circuitIds.filter((id, index) => routes[index] === null);
      if (notFound.length > 0) {
        setValidation({
          valid: false,
          message: `❌ Circuit ID not found: ${notFound.join(', ')}`,
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
      
      // Calculate pricing
      const pricingParams = {
        paths,
        bandwidth: bandwidth,
        source: formData.source,
        destination: formData.destination,
        outputCurrency: formData.outputCurrency,
        contractTerm: formData.contractTerm,
        quoteRequestId: formData.quoteRequestId,
        customerName: formData.customerName,
        crossConnectA: crossConnectEnabled.source ? crossConnectResults.source : null,
        crossConnectB: crossConnectEnabled.destination ? crossConnectResults.destination : null,
        calling_module: 'allocated_cost_calculator',
        protection_required: formData.pricingType === 'protected'
      };
      
      console.log('Calculating pricing with params:', pricingParams);
      const pricing = await networkDesignApi.calculatePricing(pricingParams);
      console.log('Received pricing results:', pricing);
      
      setPricingResults(pricing);
      setExpandedAccordion('results');
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
      const segment = {
        circuit_id: route.circuit_id,
        from: currentLocation,
        to: route.location_a === currentLocation ? route.location_b : route.location_a,
        latency: parseFloat(route.expected_latency) || 0,
        carrier: route.underlying_carrier,
        cable_system: route.cable_system,
        bandwidth: parseFloat(route.bandwidth),
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
  
  const toggleCrossConnect = async (locationType) => {
    const locationCode = locationType === 'source' ? formData.source : formData.destination;
    
    if (!locationCode) {
      setError(`Please select ${locationType} location first`);
      return;
    }
    
    // If disabling, just toggle off
    if (crossConnectEnabled[locationType]) {
      setCrossConnectEnabled(prev => ({
        ...prev,
        [locationType]: false
      }));
      return;
    }
    
    // If enabling, fetch cross connect data
    setLoading(true);
    try {
      const crossConnectData = await networkDesignApi.getCrossConnectInfo(locationCode);
      
      if (!crossConnectData) {
        setError(`No cross-connect data available for ${locationCode}`);
        return;
      }
      
      // Convert prices to output currency
      const convertCurrency = (amount, fromCurrency, toCurrency) => {
        const fromRate = exchangeRates[fromCurrency] || 1;
        const toRate = exchangeRates[toCurrency] || 1;
        const amountInUSD = amount / fromRate;
        return amountInUSD * toRate;
      };
      
      const nrcPrice = convertCurrency(
        parseFloat(crossConnectData.cross_connect_nrc),
        crossConnectData.cross_connect_nrc_currency,
        formData.outputCurrency
      );
      
      const mrcPrice = convertCurrency(
        parseFloat(crossConnectData.cross_connect_mrc),
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
      
      setCrossConnectEnabled(prev => ({
        ...prev,
        [locationType]: true
      }));
      
    } catch (err) {
      setError('Failed to get cross connect pricing: ' + err.message);
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
  
  // Filter logs based on search and date
  useEffect(() => {
    let filtered = auditLogs;
    
    // Search filter
    if (logSearchTerm) {
      const searchLower = logSearchTerm.toLowerCase();
      filtered = filtered.filter(log => {
        const summary = (log.changes_summary || '').toLowerCase();
        const newValues = (log.new_values || '').toLowerCase();
        return summary.includes(searchLower) || newValues.includes(searchLower);
      });
    }
    
    // Date filter
    if (logDateFilter.startDate) {
      filtered = filtered.filter(log => log.timestamp >= logDateFilter.startDate);
    }
    if (logDateFilter.endDate) {
      filtered = filtered.filter(log => log.timestamp <= logDateFilter.endDate);
    }
    
    setFilteredAuditLogs(filtered);
  }, [auditLogs, logSearchTerm, logDateFilter]);
  
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
        <Accordion expanded={expandedAccordion === 'input'} onChange={() => setExpandedAccordion(expandedAccordion === 'input' ? '' : 'input')}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SearchIcon sx={{ mr: 1 }} />
              <Typography variant="subtitle1" fontWeight="bold">Design Parameters</Typography>
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
                    <MenuItem value={60}>60 Months</MenuItem>
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
              
              {/* Cross Connect Options */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>Cross-Connect Options</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={crossConnectEnabled.source}
                          onChange={() => toggleCrossConnect('source')}
                          disabled={!formData.source}
                        />
                      }
                      label={`Add Cross-Connect at Source (${formData.source || 'Select source'})`}
                    />
                    {crossConnectEnabled.source && crossConnectResults.source && (
                      <Box sx={{ ml: 4, mt: 1 }}>
                        <Typography variant="body2">
                          NRC: {formatCurrency(crossConnectResults.source.nrc, crossConnectResults.source.currency)}
                        </Typography>
                        <Typography variant="body2">
                          MRC: {formatCurrency(crossConnectResults.source.mrc, crossConnectResults.source.currency)}
                        </Typography>
                      </Box>
                    )}
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={crossConnectEnabled.destination}
                          onChange={() => toggleCrossConnect('destination')}
                          disabled={!formData.destination}
                        />
                      }
                      label={`Add Cross-Connect at Destination (${formData.destination || 'Select destination'})`}
                    />
                    {crossConnectEnabled.destination && crossConnectResults.destination && (
                      <Box sx={{ ml: 4, mt: 1 }}>
                        <Typography variant="body2">
                          NRC: {formatCurrency(crossConnectResults.destination.nrc, crossConnectResults.destination.currency)}
                        </Typography>
                        <Typography variant="body2">
                          MRC: {formatCurrency(crossConnectResults.destination.mrc, crossConnectResults.destination.currency)}
                        </Typography>
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </Grid>
              
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
        
        {/* Route Results */}
        {searchResults && (
          <Accordion expanded={expandedAccordion === 'results'} onChange={() => setExpandedAccordion(expandedAccordion === 'results' ? '' : 'results')} sx={{ mt: 2 }}>
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
                              <TableRow key={index}>
                                <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                                <TableCell>{segment.from} → {segment.to}</TableCell>
                                <TableCell>{formatLatency(segment.latency)}ms</TableCell>
                                <TableCell>{segment.bandwidth || 'N/A'}</TableCell>
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
                                <TableRow key={index}>
                                  <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                                  <TableCell>{segment.from} → {segment.to}</TableCell>
                                  <TableCell>{formatLatency(segment.latency)}ms</TableCell>
                                  <TableCell>{segment.bandwidth || 'N/A'}</TableCell>
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
          <Accordion expanded={expandedAccordion === 'pricing'} onChange={() => setExpandedAccordion(expandedAccordion === 'pricing' ? '' : 'pricing')} sx={{ mt: 2 }}>
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
                                      <TableRow key={idx} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                                        <TableCell sx={{ fontWeight: 'bold' }}>{segment.circuit}</TableCell>
                                        <TableCell sx={{ fontSize: '0.75rem' }}>{segment.location}</TableCell>
                                        <TableCell sx={{ fontSize: '0.75rem' }}>{segment.carrier}</TableCell>
                                        <TableCell>{segment.segmentBandwidth} Mbps</TableCell>
                                        <TableCell>
                                          {segment.originalCost.toFixed(2)} {segment.originalCurrency}
                                          {segment.originalCurrency !== formData.outputCurrency && (
                                            <Typography variant="caption" display="block" color="text.secondary">
                                              = {segment.convertedCost.toFixed(2)} {formData.outputCurrency}
                                            </Typography>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {segment.utilizationFactor}
                                          <Typography variant="caption" display="block" color="text.secondary">
                                            ({segment.utilizationFactorType})
                                          </Typography>
                                        </TableCell>
                                        <TableCell>
                                          <Box sx={{ bgcolor: 'info.50', p: 1, borderRadius: 1 }}>
                                            <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace' }}>
                                              {segment.calculation}
                                            </Typography>
                                            <Typography variant="body2" fontWeight="bold">
                                              = {segment.allocationRatio.toFixed(6)}
                                            </Typography>
                                          </Box>
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
                                    {detailedCalcs.allocatedCostBreakdown.segments.map((segment, idx) => {
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
                              
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>Contract Term Rules:</Typography>
                                <Typography variant="body2">
                                  <strong>{formData.contractTerm}-Month Contract:</strong> {detailedCalcs.minimumPriceBreakdown.contractTermRule}
                                </Typography>
                              </Box>
                              
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
                              
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>Contract Term Rules:</Typography>
                                <Typography variant="body2">
                                  <strong>{formData.contractTerm}-Month Contract:</strong> {detailedCalcs.suggestedPriceBreakdown.contractTermRule}
                                </Typography>
                              </Box>
                              
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
      </TabPanel>
      
      {/* Pricing Logs Tab */}
      {canViewPricingLogs && (
        <TabPanel value={currentTab} index={1}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">Allocated Cost Pricing Logs</Typography>
              {canManageLogs && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleClearLogs}
                  disabled={loading || filteredAuditLogs.length === 0}
                >
                  Clear All Logs
                </Button>
              )}
            </Box>
            
            {/* Search and Filter */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Search Logs"
                  value={logSearchTerm}
                  onChange={(e) => setLogSearchTerm(e.target.value)}
                  placeholder="Search by customer, quote ID, or locations..."
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={logDateFilter.startDate}
                  onChange={(e) => setLogDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={logDateFilter.endDate}
                  onChange={(e) => setLogDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            
            {/* Log Results */}
            {filteredAuditLogs.length === 0 ? (
              <Alert severity="info">
                {canManageLogs ? 'No pricing logs available. ' : 'No pricing logs found matching your search criteria. '}
                {user.role === 'read_only' && 'You can only view your own logs.'}
              </Alert>
            ) : (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Showing {filteredAuditLogs.length} log{filteredAuditLogs.length !== 1 ? 's' : ''}
                  {user.role === 'read_only' && ' (your logs only)'}
                </Typography>
                {filteredAuditLogs.map((log) => (
                  <Card key={log.id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                        <Box>
                          <Typography variant="subtitle1">{log.changes_summary || 'Pricing Calculation'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(log.timestamp).toLocaleString()} • User: {log.username || 'Unknown'}
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => toggleLogExpansion(log.id)}>
                          {expandedLogs.has(log.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Box>
                      
                      {expandedLogs.has(log.id) && log.new_values && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                          <Typography variant="subtitle2" gutterBottom>Details:</Typography>
                          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', margin: 0 }}>
                            {JSON.stringify(JSON.parse(log.new_values), null, 2)}
                          </pre>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Paper>
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
      
      {/* Notifications */}
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
    </Box>
  );
};

export default AllocatedCostCalculator;
