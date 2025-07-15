import React, { useState, useEffect } from 'react';
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
import MapIcon from '@mui/icons-material/Map';
import SaveIcon from '@mui/icons-material/Save';
import HistoryIcon from '@mui/icons-material/History';
import LoadingButton from '@mui/lab/LoadingButton';
import { networkDesignApi } from './api';
import { getCarriers } from './api';

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
  // Form state
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    bandwidth: '',
    includeULL: false,
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
      const [locationsData, exchangeRatesData, carriersData, auditLogsData] = await Promise.all([
        networkDesignApi.getLocations(),
        networkDesignApi.getExchangeRates(),
        getCarriers(),
        networkDesignApi.getAuditLogs()
      ]);
      
      setLocations(locationsData);
      setCarriers(carriersData);
      setAuditLogs(auditLogsData);
      
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
        bandwidth: parseFloat(formData.bandwidth),
        source: formData.source,
        destination: formData.destination,
        protection_required: formData.protectionRequired
      };

      const pricing = await networkDesignApi.calculatePricing(pricingParams);
      setPricingResults(pricing);

      // Refresh audit logs to show the new search
      try {
        const auditLogsData = await networkDesignApi.getAuditLogs();
        setAuditLogs(auditLogsData);
      } catch (logErr) {
        console.error('Failed to refresh audit logs:', logErr);
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
        
        if (exclusionData.mtu_requirement.count > 0) {
          const requiredMtu = exclusionData.mtu_requirement.routes[0]?.required_mtu;
          const availableMtu = exclusionData.mtu_requirement.routes[0]?.available_mtu;
          reasons.push(`MTU requirements: ${exclusionData.mtu_requirement.count} routes excluded (required: ${requiredMtu}, available: ${availableMtu})`);
        }
        
        if (exclusionData.ull_restriction.count > 0) {
          reasons.push(`ULL restriction: ${exclusionData.ull_restriction.count} Special/ULL routes excluded (Include ULL disabled)`);
        }
        
        if (exclusionData.decommission_pop && exclusionData.decommission_pop.count > 0) {
          const decommissionedLocations = [...new Set(exclusionData.decommission_pop.routes.map(r => r.decommissioned_location))];
          reasons.push(`Decommissioned POPs: ${exclusionData.decommission_pop.count} routes excluded (locations: ${decommissionedLocations.join(', ')})`);
        }
        
        if (reasons.length > 0) {
          errorMessage += 'Constraints that prevented routing:\n• ' + reasons.join('\n• ');
          errorMessage += '\n\nSuggested actions:\n• Reduce bandwidth requirements\n• Remove carrier avoidance restrictions\n• Lower MTU requirements\n• Enable "Include ULL" if Special/ULL routes are acceptable\n• Try different source/destination locations';
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

  const handleGenerateKMZ = async () => {
    if (!searchResults) {
      setError('No search results to export');
      return;
    }

    try {
      const paths = [searchResults.primaryPath];
      if (searchResults.diversePath) paths.push(searchResults.diversePath);

      const metadata = {
        search_date: new Date().toISOString(),
        source: formData.source,
        destination: formData.destination,
        bandwidth: formData.bandwidth,
        protection: formData.protectionRequired
      };

      const result = await networkDesignApi.generateKMZ({ paths, metadata });
      
      // Download the KMZ file
      const downloadUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api${result.downloadUrl}`;
      window.open(downloadUrl, '_blank');
      
      setSuccess('KMZ file generated and downloaded successfully');

    } catch (err) {
      setError('Failed to generate KMZ file: ' + err.message);
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

  return (
    <Box sx={{ width: '100%' }}>
      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={handleTabChange} aria-label="network design tabs">
          <Tab icon={<SearchIcon />} label="Network Design" />
          <Tab icon={<HistoryIcon />} label="Pricing Logs" />
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
                  helperText="Default: 1500 if not specified"
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
                            searchResults.exclusionReasons.mtu_requirement.count > 0 ||
                            searchResults.exclusionReasons.ull_restriction.count > 0) && (
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
                              </Box>
                            </Box>
                          )}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Action Buttons */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      startIcon={<MapIcon />}
                      onClick={handleGenerateKMZ}
                    >
                      Generate KMZ
                    </Button>
                  </Box>
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
                            <Typography variant="subtitle2" gutterBottom>Price Range</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" color="success.main">Minimum (40% margin):</Typography>
                              <Typography variant="body2" fontWeight="bold" color="success.main">
                                {formatCurrency(result.pricing.minimumPrice, result.pricing.currency)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="warning.main">Suggested (60% margin):</Typography>
                              <Typography variant="body2" fontWeight="bold" color="warning.main">
                                {formatCurrency(result.pricing.suggestedPrice, result.pricing.currency)}
                              </Typography>
                            </Box>
                          </Box>

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
                        subheader="100% Primary + 70% Protection"
                      />
                      <CardContent>
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={6}>
                            <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1 }}>
                              <Typography variant="subtitle2" gutterBottom>Protected Price Range</Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body1" color="success.main">Minimum (40% margin):</Typography>
                                <Typography variant="h6" fontWeight="bold" color="success.main">
                                  {formatCurrency(pricingResults.protectionPricing.minimumPrice, pricingResults.protectionPricing.currency)}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body1" color="warning.main">Suggested (60% margin):</Typography>
                                <Typography variant="h6" fontWeight="bold" color="warning.main">
                                  {formatCurrency(pricingResults.protectionPricing.suggestedPrice, pricingResults.protectionPricing.currency)}
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

      {/* Pricing Logs Tab */}
      <TabPanel value={currentTab} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">Pricing Logs</Typography>
          <Chip 
            label={`${auditLogs.length} entries`} 
            color="info" 
            size="small"
          />
        </Box>
        
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Timestamp</strong></TableCell>
                <TableCell><strong>Action</strong></TableCell>
                <TableCell><strong>Parameters</strong></TableCell>
                <TableCell><strong>Execution Time</strong></TableCell>
                <TableCell><strong>Results</strong></TableCell>
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
                    <Chip 
                      label={log.action_type} 
                      color={log.action_type === 'PATH_SEARCH' ? 'primary' : 'secondary'} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.parameters ? JSON.stringify(log.parameters, null, 2) : 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {log.execution_time ? `${log.execution_time}ms` : 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.results ? JSON.stringify(log.results, null, 2) : log.pricing_data ? JSON.stringify(log.pricing_data, null, 2) : 'N/A'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

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