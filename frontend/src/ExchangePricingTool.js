import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, CardHeader, Divider, Alert, CircularProgress, Autocomplete,
  FormControlLabel, Switch, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton,
  Pagination, InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CalculateIcon from '@mui/icons-material/Calculate';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import EmailIcon from '@mui/icons-material/Email';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth } from './AuthContext';
import { exchangePricingApi } from './api';
import { API_BASE_URL } from './config';

const ExchangePricingTool = () => {
  const { user } = useAuth();
  
  // Check if user can manage logs (admin or provisioner)
  const canManageLogs = user && ['administrator', 'provisioner'].includes(user.role);

  // Form state
  const [formData, setFormData] = useState({
    requestor_name: user?.full_name || '',
    customer_name: '',
    region: '',
    exchange_id: '',
    exchange_name: '',
    feed_id: '',
    feed_name: '',
    desired_sell_price: '',
    currency_requested: '',
    order_entry_required: false,
    delivery_datacenter: ''
  });

  // Data states
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableExchanges, setAvailableExchanges] = useState([]);
  const [availableFeeds, setAvailableFeeds] = useState([]);
  const [availableCurrencies, setAvailableCurrencies] = useState([]);
  const [availableDatacenters, setAvailableDatacenters] = useState([]);

  // UI states
  const [loading, setLoading] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  
  // History states
  const [quoteHistory, setQuoteHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  


  // Load initial data
  useEffect(() => {
    loadRegions();
    loadCurrencies();
  }, []);

  // Update requestor name when user changes
  useEffect(() => {
    if (user?.full_name) {
      setFormData(prev => ({ ...prev, requestor_name: user.full_name }));
    }
  }, [user]);

  // Validate form
  useEffect(() => {
    const isValid = formData.customer_name.trim() && 
                   formData.region && 
                   formData.exchange_id && 
                   formData.feed_id && 
                   formData.desired_sell_price && 
                   parseFloat(formData.desired_sell_price) > 0 &&
                   formData.currency_requested && 
                   formData.delivery_datacenter &&
                   (formData.order_entry_required === true || formData.order_entry_required === false);
    
    setFormValid(isValid);
  }, [formData]);

  const loadRegions = async () => {
    try {
      const regions = await exchangePricingApi.getRegions();
      setAvailableRegions(regions);
    } catch (error) {
      console.error('Failed to load regions:', error);
      setError('Failed to load available regions');
    }
  };

  const loadExchanges = async (region) => {
    try {
      const exchanges = await exchangePricingApi.getExchanges(region);
      setAvailableExchanges(exchanges);
    } catch (error) {
      console.error('Failed to load exchanges:', error);
      setError('Failed to load exchanges for this region');
    }
  };

  const loadFeeds = async (exchangeId) => {
    try {
      const feeds = await exchangePricingApi.getFeeds(exchangeId);
      setAvailableFeeds(feeds);
    } catch (error) {
      console.error('Failed to load feeds:', error);
      setError('Failed to load feeds for this exchange');
    }
  };

  const loadCurrencies = async () => {
    try {
      const currencies = await exchangePricingApi.getCurrencies();
      setAvailableCurrencies(currencies);
    } catch (error) {
      console.error('Failed to load currencies:', error);
      setError('Failed to load available currencies');
    }
  };

  const loadDatacenters = async (region) => {
    try {
      const datacenters = await exchangePricingApi.getDatacenters(region);
      setAvailableDatacenters(datacenters);
    } catch (error) {
      console.error('Failed to load datacenters:', error);
      setError('Failed to load datacenters for this region');
    }
  };

  const loadQuoteHistory = async (page = 1, search = '') => {
    setHistoryLoading(true);
    try {
      const response = await exchangePricingApi.getQuoteHistory({ page, limit: 10, search });
      setQuoteHistory(response.quotes);
      setHistoryTotal(response.totalCount);
    } catch (error) {
      console.error('Failed to load quote history:', error);
      setError('Failed to load quote history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleClearQuoteHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all quote history? This action cannot be undone.')) {
      return;
    }

    try {
      // Call API to clear quote history
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/exchange-pricing/quotes/clear`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Clear failed: ${response.statusText}`);
      }

      // Refresh the quote history
      setQuoteHistory([]);
      setHistoryTotal(0);
      setSuccess('Quote history cleared successfully');
    } catch (err) {
      console.error('Clear error:', err);
      setError('Failed to clear quote history: ' + err.message);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    
    // Handle cascading dropdowns
    if (field === 'region') {
      // Reset dependent fields
      setFormData(prev => ({ 
        ...prev, 
        region: value,
        exchange_id: '', 
        exchange_name: '',
        feed_id: '', 
        feed_name: '',
        delivery_datacenter: ''
      }));
      setAvailableExchanges([]);
      setAvailableFeeds([]);
      setAvailableDatacenters([]);
      
      if (value) {
        loadExchanges(value);
        loadDatacenters(value);
      }
    } else if (field === 'exchange_id') {
      const selectedExchange = availableExchanges.find(ex => ex.id === value);
      setFormData(prev => ({ 
        ...prev, 
        exchange_id: value,
        exchange_name: selectedExchange ? selectedExchange.exchange_name : '',
        feed_id: '', 
        feed_name: ''
      }));
      setAvailableFeeds([]);
      
      if (value) {
        loadFeeds(value);
      }
    } else if (field === 'feed_id') {
      const selectedFeed = availableFeeds.find(feed => feed.id === value);
      setFormData(prev => ({ 
        ...prev, 
        feed_id: value,
        feed_name: selectedFeed ? selectedFeed.feed_name : ''
      }));
    }
  };

  const handleCheckResults = async () => {
    if (!formValid) return;
    
    setLoading(true);
    setError('');
    setResults(null);
    
    try {
      const result = await exchangePricingApi.createQuote(formData);
      setResults(result);
    } catch (error) {
      console.error('Quote calculation failed:', error);
      setError(error.response?.data?.error || 'Failed to calculate quote');
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setFormData({
      requestor_name: user?.full_name || '',
      customer_name: '',
      region: '',
      exchange_id: '',
      exchange_name: '',
      feed_id: '',
      feed_name: '',
      desired_sell_price: '',
      currency_requested: '',
      order_entry_required: false,
      delivery_datacenter: ''
    });
    setResults(null);
    setError('');
    setAvailableExchanges([]);
    setAvailableFeeds([]);
    setAvailableDatacenters([]);
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const convertFromUSD = (usdAmount, exchangeRate, targetCurrency) => {
    if (targetCurrency === 'USD') {
      return usdAmount;
    }
    return usdAmount * exchangeRate;
  };

  const handleEmailExport = () => {
    if (!results) return;

    const pricingDisclaimer = `
All Pricing is subject to IPC standard terms and conditions.
This quotation is valid for 90 days
All Pricing is budgetary and subject to finalised design, survey and facility/feasibility checks.
All Pricing is exclusive of any applicable Taxes and Surcharges.
Any additional 3rd Party costs incurred on order of the service will be chargeable to the customer, including but not limited to cross connects, additional cabling, out of hours charges, etc
Unless otherwise stated any additional costs incurred for out of hours work will be chargeable to the customer.
Budgetary price is designed for wires only delivery. Customer to provide own cross connects to IPC market data environment.
    `.trim();

    const emailBody = `Exchange Feed Pricing Quote

${results.approval_status}

Customer Name: ${results.customer_name}
Feed: ${results.exchange_name} - ${results.feed_name}
Feed NRC: ${formatCurrency(convertFromUSD(1000, results.exchange_rate, results.currency_requested), results.currency_requested)}
Desired Sell Price: ${formatCurrency(results.desired_sell_price, results.currency_requested)}
Pass Through Fees: ${results.pass_through_fees && results.pass_through_fees > 0 ? 'Yes' : 'No'}
ISF A: ${results.isf_a || 'Not specified'}
ISF B: ${results.isf_b || 'Not specified'}
Bandwidth: ${results.bandwidth || 'Not specified'}${results.order_entry_required ? `
Order Entry NRC: ${formatCurrency(convertFromUSD(500, results.exchange_rate, results.currency_requested), results.currency_requested)}
Order Entry Cost: ${results.order_entry_cost ? formatCurrency(convertFromUSD(results.order_entry_cost, results.exchange_rate, results.currency_requested), results.currency_requested) : 'Not specified'}
Order Entry ISF: ${results.order_entry_isf || 'Not specified'}` : ''}
Delivery Datacenter: ${results.delivery_datacenter}

${pricingDisclaimer}`;

    const subject = `${results.customer_name} - ${results.exchange_name} - ${results.feed_name} - Pricing`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    
    window.open(mailtoUrl);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Exchange Feed Pricing Tool
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Ensure corresponding QR is raised for pricing confirmation and design. Include requested sell price within QR.<br/>
        Pricing valid for combined A + B feeds for delivery to IPC Tier 1 Datacenters within same region as feed source.<br/>
        Order Entry is available for each listed market - Unicast 10Mb - Price dependant on market.<br/>
        DR feeds may be available and further information is available via quoting process.<br/>
        Retransmission included as standard if available<br/>
        For detailed service standards, please see IPC Connexus Extranet standards or refer to your SE.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Pricing Form */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardHeader 
              title="Quote Request Form" 
              action={
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={handleResetForm}
                  startIcon={<RefreshIcon />}
                >
                  Reset
                </Button>
              }
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Requestor Name"
                    value={formData.requestor_name}
                    InputProps={{ readOnly: true }}
                    helperText="Auto-filled from your profile"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Customer Name"
                    value={formData.customer_name}
                    onChange={(e) => handleInputChange('customer_name', e.target.value)}
                    required
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Select Region</InputLabel>
                    <Select
                      value={formData.region}
                      label="Select Region"
                      onChange={(e) => handleInputChange('region', e.target.value)}
                    >
                      {availableRegions.map(region => (
                        <MenuItem key={region} value={region}>{region}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required disabled={!formData.region}>
                    <InputLabel>Select Exchange</InputLabel>
                    <Select
                      value={formData.exchange_id}
                      label="Select Exchange"
                      onChange={(e) => handleInputChange('exchange_id', e.target.value)}
                    >
                      {availableExchanges.map(exchange => (
                        <MenuItem key={exchange.id} value={exchange.id}>
                          {exchange.exchange_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required disabled={!formData.exchange_id}>
                    <InputLabel>Select Feed</InputLabel>
                    <Select
                      value={formData.feed_id}
                      label="Select Feed"
                      onChange={(e) => handleInputChange('feed_id', e.target.value)}
                    >
                      {availableFeeds.map(feed => (
                        <MenuItem key={feed.id} value={feed.id}>
                          {feed.feed_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Desired Sell Price"
                    type="number"
                    inputProps={{ min: 0, step: 0.01 }}
                    value={formData.desired_sell_price}
                    onChange={(e) => handleInputChange('desired_sell_price', e.target.value)}
                    required
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Currency Requested</InputLabel>
                    <Select
                      value={formData.currency_requested}
                      label="Currency Requested"
                      onChange={(e) => handleInputChange('currency_requested', e.target.value)}
                    >
                      {availableCurrencies.map(currency => (
                        <MenuItem key={currency.currency_code} value={currency.currency_code}>
                          {currency.currency_code} - {currency.currency_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.order_entry_required}
                        onChange={(e) => handleInputChange('order_entry_required', e.target.checked)}
                      />
                    }
                    label="Order Entry Required"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required disabled={!formData.region}>
                    <InputLabel>Delivery Datacenter</InputLabel>
                    <Select
                      value={formData.delivery_datacenter}
                      label="Delivery Datacenter"
                      onChange={(e) => handleInputChange('delivery_datacenter', e.target.value)}
                    >
                      {availableDatacenters.map(datacenter => (
                        <MenuItem key={datacenter.location_code} value={datacenter.location_code}>
                          {datacenter.location_code} - {datacenter.location_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={handleCheckResults}
                      disabled={!formValid || loading}
                      startIcon={loading ? <CircularProgress size={20} /> : <CalculateIcon />}
                    >
                      {loading ? 'Calculating...' : 'Check Results'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={() => {
                        setShowHistory(true);
                        loadQuoteHistory(1, historySearch);
                      }}
                      startIcon={<HistoryIcon />}
                    >
                      View History
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Results Panel */}
        <Grid item xs={12} lg={4}>
          {results && (
            <Card>
              <CardHeader 
                title="Quote Results" 
                avatar={
                  results.is_approved ? 
                    <CheckCircleIcon color="success" /> : 
                    <CancelIcon color="error" />
                }
                action={
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleEmailExport}
                    startIcon={<EmailIcon />}
                  >
                    Export to Email
                  </Button>
                }
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Alert 
                      severity={results.is_approved ? "success" : "error"}
                      sx={{ mb: 2 }}
                    >
                      <Typography variant="subtitle1" fontWeight="bold">
                        {results.is_approved ? "Approved" : "Not Approved"}
                      </Typography>
                    </Alert>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Customer Name</Typography>
                    <Typography variant="body1">{results.customer_name}</Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Feed (Exchange Name - Feed Name)</Typography>
                    <Typography variant="body1">
                      {results.exchange_name} - {results.feed_name}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Feed NRC</Typography>
                    <Typography variant="body1">
                      {formatCurrency(convertFromUSD(1000, results.exchange_rate, results.currency_requested), results.currency_requested)}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Desired Sell Price</Typography>
                    <Typography variant="body1">
                      {formatCurrency(results.desired_sell_price, results.currency_requested)}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Pass Through Fees</Typography>
                    <Typography variant="body1">
                      {results.pass_through_fees && results.pass_through_fees > 0 ? 'Yes' : 'No'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">ISF A</Typography>
                    <Typography variant="body1">{results.isf_a || 'Not specified'}</Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">ISF B</Typography>
                    <Typography variant="body1">{results.isf_b || 'Not specified'}</Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Bandwidth</Typography>
                    <Typography variant="body1">{results.bandwidth || 'Not specified'}</Typography>
                  </Grid>

                  {results.order_entry_required && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Order Entry NRC</Typography>
                      <Typography variant="body1">
                        {formatCurrency(convertFromUSD(500, results.exchange_rate, results.currency_requested), results.currency_requested)}
                      </Typography>
                    </Grid>
                  )}

                  {results.order_entry_required && (
                    <>
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">Order Entry Cost</Typography>
                        <Typography variant="body1">
                          {results.order_entry_cost ? formatCurrency(convertFromUSD(results.order_entry_cost, results.exchange_rate, results.currency_requested), results.currency_requested) : 'Not specified'}
                        </Typography>
                      </Grid>

                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">Order Entry ISF</Typography>
                        <Typography variant="body1">{results.order_entry_isf || 'Not specified'}</Typography>
                      </Grid>
                    </>
                  )}

                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Delivery Datacenter</Typography>
                    <Typography variant="body1">{results.delivery_datacenter}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Quote History Dialog */}
      <Dialog open={showHistory} onClose={() => setShowHistory(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              Quote History
              {canManageLogs && (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={handleClearQuoteHistory}
                  startIcon={<DeleteIcon />}
                >
                  Clear History
                </Button>
              )}
            </Box>
            <TextField
              size="small"
              placeholder="Search quotes..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  loadQuoteHistory(1, historySearch);
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Box>
        </DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell>Exchange</TableCell>
                      <TableCell>Feed</TableCell>
                      <TableCell>Sell Price</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Requestor</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {quoteHistory.map((quote) => (
                      <TableRow key={quote.id}>
                        <TableCell>{formatDate(quote.created_at)}</TableCell>
                        <TableCell>{quote.customer_name}</TableCell>
                        <TableCell>{quote.exchange_name}</TableCell>
                        <TableCell>{quote.feed_name}</TableCell>
                        <TableCell>
                          {formatCurrency(quote.desired_sell_price, quote.currency_requested)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={quote.is_approved ? 'Approved' : 'Not Approved'}
                            color={quote.is_approved ? 'success' : 'error'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{quote.requestor_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {historyTotal > 10 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Pagination
                    count={Math.ceil(historyTotal / 10)}
                    page={historyPage}
                    onChange={(e, page) => {
                      setHistoryPage(page);
                      loadQuoteHistory(page, historySearch);
                    }}
                  />
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistory(false)}>Close</Button>
        </DialogActions>
      </Dialog>


    </Box>
  );
};

export default ExchangePricingTool; 