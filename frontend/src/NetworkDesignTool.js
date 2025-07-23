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
import LoadingButton from '@mui/lab/LoadingButton';
import { networkDesignApi } from './api';
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
  
  // Check if user can manage logs (admin or provisioner)
  const canManageLogs = user && ['administrator', 'provisioner'].includes(user.role);
  
  // Form state
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    bandwidth: '',
    includeULL: false,
    useCiscoOnlyRoutes: false,
    protectionRequired: false,
    mtuRequired: '', // Changed from maxLatency to mtuRequired
    carrierAvoidance: [],
    outputCurrency: 'USD',
    contractTerm: 12,
    quoteRequestId: '',
    customerName: ''
  });

  // Data state
  const [locations, setLocations] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({});
  const [carriers, setCarriers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [pricingResults, setPricingResults] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedAccordion, setExpandedAccordion] = useState('search');
  const [currentTab, setCurrentTab] = useState(0); // Tab state

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

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
        quote_request_id: formData.quoteRequestId,
        customer_name: formData.customerName,
        constraints: {
          protection_required: formData.protectionRequired,
          mtu_required: formData.mtuRequired ? parseFloat(formData.mtuRequired) : 1500, // Default to 1500 if not specified
          carrier_avoidance: formData.carrierAvoidance.length > 0 ? formData.carrierAvoidance : undefined
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
        bandwidth: parseFloat(formData.bandwidth),
        source: formData.source,
        destination: formData.destination,
        protection_required: formData.protectionRequired
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
    return Math.round(latency * 10) / 10; // Round to 1 decimal place
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
      setError('Failed to clear pricing logs: ' + err.message);
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
        throw new Error(`Export failed: ${response.statusText}`);
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

              {/* Protection Required */}
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

              {/* Include ULL */}
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

              {/* Include Cisco Only Routes */}
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

              {/* Contract Term */}
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
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Applied Rule: {pricingResults.contractTermDetails.appliedRule}
                      </Typography>
                      <Grid container spacing={2}>
                        {Object.entries(pricingResults.contractTermDetails.rules).map(([term, rules]) => (
                          <Grid item xs={12} md={4} key={term}>
                            <Box sx={{ 
                              p: 2, 
                              border: term == pricingResults.contractTermDetails.term ? '2px solid' : '1px solid',
                              borderColor: term == pricingResults.contractTermDetails.term ? 'primary.main' : 'grey.300',
                              borderRadius: 1,
                              bgcolor: term == pricingResults.contractTermDetails.term ? 'primary.50' : 'white'
                            }}>
                              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                                {term} Months {term == pricingResults.contractTermDetails.term ? '(Selected)' : ''}
                              </Typography>
                              <Typography variant="body2" sx={{ mb: 0.5 }}>
                                Min Margin: {rules.minMargin}
                              </Typography>
                              <Typography variant="body2" sx={{ mb: 0.5 }}>
                                Suggested Margin: {rules.suggestedMargin}
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
                        subheader={`${result.hops} hops, ${formatLatency(result.totalLatency)}ms latency`}
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
                                Minimum ({result.pricing.targetMinMargin}% margin):
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" color="success.main">
                                {formatCurrency(result.pricing.minimumPrice, result.pricing.currency)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="warning.main">
                                Suggested ({result.pricing.targetSuggestedMargin}% margin):
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" color="warning.main">
                                {formatCurrency(result.pricing.suggestedPrice, result.pricing.currency)}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Promo Pricing Indicator */}
                          {result.pricing.promoPricing?.used && (
                            <Box sx={{ p: 2, bgcolor: 'success.50', borderRadius: 1, border: 1, borderColor: 'success.200' }}>
                              <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <LocalOfferIcon color="success" fontSize="small" />
                                <Typography variant="subtitle2" color="success.dark" fontWeight="bold">
                                  PROMO PRICING APPLIED
                                </Typography>
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                Rule: <strong>{result.pricing.promoPricing.ruleName}</strong>
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Original USD Price: ${result.pricing.promoPricing.originalPriceUSD} • Tier: {result.pricing.promoPricing.priceField.replace('price_', '').replace('_', ' ').replace('mb', 'Mb')}
                              </Typography>
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

                          {/* Cost Breakdown */}
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>Cost Analysis</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2">Allocated Cost:</Typography>
                              <Typography variant="body2">
                                {formatCurrency(result.pricing.allocatedCost, result.pricing.currency)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2">Location Minimum:</Typography>
                              <Typography variant="body2">
                                {formatCurrency(result.pricing.locationMinimum, result.pricing.currency)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">Bandwidth:</Typography>
                              <Typography variant="body2">{result.pricing.bandwidth} Mbps</Typography>
                            </Box>
                          </Box>

                          {/* Margin Information */}
                          <Box sx={{ bgcolor: 'info.50', p: 1.5, borderRadius: 1 }}>
                            <Typography variant="caption" display="block">
                              Actual Margins: {result.pricing.minimumMargin}% - {result.pricing.suggestedMargin}%
                            </Typography>
                            {result.pricing.marginEnforced && (
                              <Typography variant="caption" color="warning.main" display="block">
                                ⚠ Minimum price enforced by location requirements
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}

                {/* Protection Pricing (if applicable) */}
                {pricingResults.protectionPricing && (
                  <Grid item xs={12}>
                    <Card sx={{ bgcolor: 'primary.50' }}>
                      <CardHeader 
                        title="Protected Service Pricing"
                        subheader="100% Primary + 70% Protection Path"
                      />
                      <CardContent>
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={6}>
                            <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Protected Monthly Price Range ({pricingResults.protectionPricing.contractTerm}-month term)
                              </Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body1" color="success.main">
                                  Minimum (Protected Service):
                                </Typography>
                                <Typography variant="h6" fontWeight="bold" color="success.main">
                                  {formatCurrency(pricingResults.protectionPricing.minimumPrice, pricingResults.protectionPricing.currency)}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                <Typography variant="body1" color="warning.main">
                                  Suggested (Protected Service):
                                </Typography>
                                <Typography variant="h6" fontWeight="bold" color="warning.main">
                                  {formatCurrency(pricingResults.protectionPricing.suggestedPrice, pricingResults.protectionPricing.currency)}
                                </Typography>
                              </Box>
                              
                              {/* NRC for Protection */}
                              <Box sx={{ bgcolor: pricingResults.protectionPricing.nrcCharge > 0 ? 'info.50' : 'success.50', p: 1.5, borderRadius: 1 }}>
                                <Typography variant="body2" sx={{ mb: 0.5 }}>
                                  <strong>Setup Fee (One-time):</strong>
                                </Typography>
                                <Typography variant="body1" fontWeight="bold" color={pricingResults.protectionPricing.nrcCharge > 0 ? 'info.main' : 'success.main'}>
                                  {pricingResults.protectionPricing.nrcCharge > 0 
                                    ? formatCurrency(pricingResults.protectionPricing.nrcCharge, pricingResults.protectionPricing.currency)
                                    : 'FREE'
                                  }
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Box>
                              <Typography variant="subtitle2" gutterBottom>Protection Analysis</Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2">Combined Allocated Cost:</Typography>
                                <Typography variant="body2">
                                  {formatCurrency(pricingResults.protectionPricing.allocatedCost, pricingResults.protectionPricing.currency)}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2">Actual Margins:</Typography>
                                <Typography variant="body2">
                                  {pricingResults.protectionPricing.minimumMargin}% - {pricingResults.protectionPricing.suggestedMargin}%
                                </Typography>
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                Provides full redundancy with backup path
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
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
                  <TableCell><strong>Complete Input Data</strong></TableCell>
                  <TableCell><strong>Complete Results Data</strong></TableCell>
                  <TableCell><strong>Execution Time</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
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
                      <Box 
                        component="pre" 
                        sx={{ 
                          fontSize: '0.75rem', 
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '200px',
                          overflow: 'auto',
                          backgroundColor: '#f5f5f5',
                          padding: 1,
                          borderRadius: 1
                        }}
                      >
                        {log.parameters ? JSON.stringify(log.parameters, null, 2) : 
                         log.pricing_data?.inputParameters ? JSON.stringify(log.pricing_data.inputParameters, null, 2) : 
                         'No input data available'}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 400 }}>
                      <Box 
                        component="pre" 
                        sx={{ 
                          fontSize: '0.75rem', 
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '200px',
                          overflow: 'auto',
                          backgroundColor: '#f5f5f5',
                          padding: 1,
                          borderRadius: 1
                        }}
                      >
                        {log.results ? JSON.stringify(log.results, null, 2) : 
                         log.pricing_data?.calculationResults ? JSON.stringify(log.pricing_data.calculationResults, null, 2) : 
                         'No results data available'}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {log.execution_time ? `${log.execution_time}ms` : 'N/A'}
                      </Typography>
                    </TableCell>
                  </TableRow>
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