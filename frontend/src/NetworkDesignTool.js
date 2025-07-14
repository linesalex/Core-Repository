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

      const results = await networkDesignApi.findPath(searchParams);
      setSearchResults(results);
      setExpandedAccordion('results');

      // Automatically calculate pricing
      const paths = [results.primaryPath];
      if (results.diversePath) paths.push(results.diversePath);

      const pricingParams = {
        paths,
        contract_term: formData.contractTerm,
        output_currency: formData.outputCurrency,
        include_ull: formData.includeULL
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
      setError('Search failed: ' + err.message);
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

              {/* Quote Request ID */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Quote Request ID"
                  value={formData.quoteRequestId}
                  onChange={(e) => handleInputChange('quoteRequestId', e.target.value)}
                />
              </Grid>

              {/* Customer Name */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Customer Name"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
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
                            {searchResults.primaryPath.route.map((segment, index) => (
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
                              {searchResults.diversePath.route.map((segment, index) => (
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

        {/* Pricing Results */}
        {pricingResults && (
          <Accordion expanded={expandedAccordion === 'pricing'} onChange={() => setExpandedAccordion(expandedAccordion === 'pricing' ? '' : 'pricing')} sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AttachMoneyIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Pricing Results</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                {pricingResults.results.map((result, index) => (
                  <Grid item xs={12} md={6} key={index}>
                    <Card>
                      <CardHeader title={`${index === 0 ? 'Primary' : 'Secondary'} Path Pricing`} />
                      <CardContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">Monthly Cost:</Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {formatCurrency(result.pricing.monthlyCost, result.pricing.currency)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">Setup Cost:</Typography>
                            <Typography variant="body2">
                              {formatCurrency(result.pricing.setupCost, result.pricing.currency)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">Total Contract Value:</Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {formatCurrency(result.pricing.totalContractValue, result.pricing.currency)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption">Contract Term:</Typography>
                            <Typography variant="caption">{result.pricing.contractTerm} months</Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
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