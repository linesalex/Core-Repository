import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Paper, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel,
  Chip, Alert, CircularProgress, Accordion, AccordionSummary, AccordionDetails, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Card, CardContent, CardHeader, Divider,
  Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem,
  ListItemText, ListItemIcon, Checkbox, Tooltip, IconButton, Snackbar
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import RouteIcon from '@mui/icons-material/Route';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import MapIcon from '@mui/icons-material/Map';
import SaveIcon from '@mui/icons-material/Save';
import LoadingButton from '@mui/lab/LoadingButton';
import { networkDesignApi } from './api';
import { getCarriers } from './api';

const NetworkDesignTool = () => {
  // Form state
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    bandwidth: '',
    includeULL: false,
    protectionRequired: false,
    maxLatency: '',
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
          max_latency: formData.maxLatency ? parseFloat(formData.maxLatency) : undefined,
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
            {/* Source and Destination */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Source Location</InputLabel>
                <Select
                  value={formData.source}
                  onChange={(e) => handleInputChange('source', e.target.value)}
                  label="Source Location"
                >
                  {locations.map((location) => (
                    <MenuItem key={location.location_code} value={location.location_code}>
                      {location.location_code} - {location.city}, {location.country}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Destination Location</InputLabel>
                <Select
                  value={formData.destination}
                  onChange={(e) => handleInputChange('destination', e.target.value)}
                  label="Destination Location"
                >
                  {locations.map((location) => (
                    <MenuItem key={location.location_code} value={location.location_code}>
                      {location.location_code} - {location.city}, {location.country}
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
                helperText="Reference ID for this quote request"
              />
            </Grid>

            {/* Customer Name */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Customer Name"
                value={formData.customerName}
                onChange={(e) => handleInputChange('customerName', e.target.value)}
                helperText="Customer or organization name"
              />
            </Grid>

            {/* Bandwidth Requirements */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Bandwidth Required (Mbps)"
                type="number"
                value={formData.bandwidth}
                onChange={(e) => handleInputChange('bandwidth', e.target.value)}
                helperText="All bandwidth values are in Mbps"
                InputProps={{
                  endAdornment: <Typography variant="body2" color="text.secondary">Mbps</Typography>
                }}
              />
            </Grid>

            {/* Max Latency */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Max Latency (ms)"
                type="number"
                value={formData.maxLatency}
                onChange={(e) => handleInputChange('maxLatency', e.target.value)}
                helperText="Leave empty for no latency constraint"
              />
            </Grid>

            {/* Switches */}
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.protectionRequired}
                    onChange={(e) => handleInputChange('protectionRequired', e.target.checked)}
                  />
                }
                label="Protection Required (Diverse Path)"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.includeULL}
                    onChange={(e) => handleInputChange('includeULL', e.target.checked)}
                  />
                }
                label="Include ULL Routes"
              />
            </Grid>

            {/* Carrier Avoidance */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Carrier Avoidance</InputLabel>
                <Select
                  multiple
                  value={formData.carrierAvoidance}
                  onChange={(e) => handleInputChange('carrierAvoidance', e.target.value)}
                  label="Carrier Avoidance"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {carriers.map((carrier) => (
                    <MenuItem key={carrier} value={carrier}>
                      <Checkbox checked={formData.carrierAvoidance.includes(carrier)} />
                      <ListItemText primary={carrier} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Pricing Options */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Output Currency</InputLabel>
                <Select
                  value={formData.outputCurrency}
                  onChange={(e) => handleInputChange('outputCurrency', e.target.value)}
                  label="Output Currency"
                >
                  {currencies.map((currency) => (
                    <MenuItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

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
              <Typography variant="h6">Route Results</Typography>
              <Chip 
                label={`${formatLatency(searchResults.primaryPath.totalLatency)}ms`} 
                color="primary" 
                size="small" 
                sx={{ ml: 2 }} 
              />
              <Chip 
                label={`${searchResults.primaryPath.hops} hops`} 
                color="secondary" 
                size="small" 
                sx={{ ml: 1 }} 
              />
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
                            <TableCell>Segment</TableCell>
                            <TableCell>Latency</TableCell>
                            <TableCell>Carrier</TableCell>
                            <TableCell>Cost</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {searchResults.primaryPath.route.map((segment, index) => (
                            <TableRow key={index}>
                              <TableCell>{segment.from} → {segment.to}</TableCell>
                              <TableCell>{formatLatency(segment.latency)}ms</TableCell>
                              <TableCell>{segment.carrier || 'N/A'}</TableCell>
                              <TableCell>{formatCurrency(segment.cost, segment.currency)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Diverse Path */}
              {searchResults.diversePath && (
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardHeader 
                      title="Diverse Path" 
                      subheader={`${searchResults.diversePath.path.join(' → ')}`}
                    />
                    <CardContent>
                      <Typography variant="body2">
                        Latency: {formatLatency(searchResults.diversePath.totalLatency)}ms
                      </Typography>
                      <Typography variant="body2">
                        Hops: {searchResults.diversePath.hops}
                      </Typography>
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
              <Typography variant="h6">Pricing Analysis</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {pricingResults.results.map((result, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card>
                    <CardHeader 
                      title={index === 0 ? 'Primary Path Pricing' : 'Diverse Path Pricing'}
                      subheader={`${result.path.join(' → ')}`}
                    />
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
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(result.pricing.setupCost, result.pricing.currency)}
                          </Typography>
                        </Box>
                        <Divider />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body1">Total Contract Value:</Typography>
                          <Typography variant="body1" fontWeight="bold" color="primary">
                            {formatCurrency(result.pricing.totalContractValue, result.pricing.currency)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption">Term Discount:</Typography>
                          <Typography variant="caption">{result.pricing.termDiscount}%</Typography>
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

      {/* Audit Logs */}
      <Accordion expanded={expandedAccordion === 'logs'} onChange={() => setExpandedAccordion(expandedAccordion === 'logs' ? '' : 'logs')} sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SearchIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Search & Pricing Logs</Typography>
            <Chip 
              label={`${auditLogs.length} entries`} 
              color="info" 
              size="small" 
              sx={{ ml: 2 }} 
            />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
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
        </AccordionDetails>
      </Accordion>



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