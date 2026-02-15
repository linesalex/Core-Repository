import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, Alert, Card, CardContent,
  Divider, Chip, InputAdornment, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Select, MenuItem, FormControl, InputLabel, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, Accordion,
  AccordionSummary, AccordionDetails, Tooltip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalculateIcon from '@mui/icons-material/Calculate';
import SettingsIcon from '@mui/icons-material/Settings';
import ReceiptIcon from '@mui/icons-material/Receipt';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import {
  getColocationPricingLocations, getColocationPricingConfig, updateColocationPricingConfig,
  saveColocationQuote, getColocationQuotes, deleteColocationQuote
} from '../api';

// Number input style (no spinners)
const numberInputSx = {
  '& input[type=number]': { MozAppearance: 'textfield' },
  '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
  '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 }
};

const ColocationPricingTool = ({ hasPermission }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Admin Config State
  const [selectedConfigLocation, setSelectedConfigLocation] = useState('');
  const [configData, setConfigData] = useState(null);
  const [configSaving, setConfigSaving] = useState(false);

  // Quote Builder State
  const [selectedQuoteLocation, setSelectedQuoteLocation] = useState('');
  const [quotePricing, setQuotePricing] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    client_name: '',
    contact_name: '',
    contact_email: '',
    rack_type: 'shared',
    ru_count: 0,
    power_kw: 0,
    tor_ports: 0,
    premium_tor_ports: 0,
    internet_access: 0,
    managed_cross_connects: 0,
    contract_term_months: 12,
    notes: ''
  });
  const [quoteSaving, setQuoteSaving] = useState(false);

  // Saved Quotes State
  const [savedQuotes, setSavedQuotes] = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(false);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const data = await getColocationPricingLocations();
      setLocations(data);
    } catch (err) {
      setError('Failed to load locations: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadPricingConfig = async (locationId) => {
    try {
      setError(null);
      const data = await getColocationPricingConfig(locationId);
      setConfigData(data);
    } catch (err) {
      if (err.response?.status === 404) {
        // No config yet - set defaults
        setConfigData({
          location_id: locationId,
          currency: 'USD',
          price_per_ru_month: 0,
          price_per_kw_month: 0,
          ru_per_kw_ratio: 4,
          tor_port_price_month: 0,
          premium_tor_port_price_month: 0,
          internet_access_price_month: 0,
          internet_access_bandwidth_mb: 10,
          setup_nrc: 0,
          cross_connect_nrc: null,
          cross_connect_mrc: null,
          discount_12_month: 0,
          discount_24_month: 5,
          discount_36_month: 10,
          notes: ''
        });
      } else {
        setError('Failed to load pricing config: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleConfigLocationChange = (locationId) => {
    setSelectedConfigLocation(locationId);
    if (locationId) {
      loadPricingConfig(locationId);
    } else {
      setConfigData(null);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedConfigLocation || !configData) return;
    try {
      setConfigSaving(true);
      setError(null);
      await updateColocationPricingConfig(selectedConfigLocation, configData);
      setSuccess('Pricing configuration saved successfully');
      loadLocations(); // Refresh to update has_pricing_config status
    } catch (err) {
      setError('Failed to save config: ' + (err.response?.data?.error || err.message));
    } finally {
      setConfigSaving(false);
    }
  };

  const updateConfig = (field, value) => {
    setConfigData(prev => ({ ...prev, [field]: value }));
  };

  // Quote Builder logic
  const handleQuoteLocationChange = async (locationId) => {
    setSelectedQuoteLocation(locationId);
    if (locationId) {
      try {
        const config = await getColocationPricingConfig(locationId);
        setQuotePricing(config);
      } catch {
        setQuotePricing(null);
        setError('No pricing config found for this location. Please configure pricing first.');
      }
    } else {
      setQuotePricing(null);
    }
  };

  // Calculate quote pricing
  const calculatedQuote = useMemo(() => {
    if (!quotePricing) return null;

    const p = quotePricing;
    const q = quoteForm;

    // Determine discount based on term
    let discountPct = 0;
    if (q.contract_term_months === 24) discountPct = p.discount_24_month || 0;
    if (q.contract_term_months === 36) discountPct = p.discount_36_month || 0;
    const discountMultiplier = 1 - (discountPct / 100);

    // RU pricing
    const ruMRC = q.ru_count * (p.price_per_ru_month || 0);

    // Power pricing  
    const powerMRC = q.power_kw * (p.price_per_kw_month || 0);

    // TOR Port pricing
    const torMRC = q.tor_ports * (p.tor_port_price_month || 0);
    const premiumTorMRC = q.premium_tor_ports * (p.premium_tor_port_price_month || 0);

    // Internet access (fixed 10Mb)
    const internetMRC = q.internet_access * (p.internet_access_price_month || 0);

    // Cross connect - use location pricing with global margin from PricingLogicManager
    const ccNRC = q.managed_cross_connects * (p.cross_connect_nrc || 0);
    const ccMRC = q.managed_cross_connects * (p.cross_connect_mrc || 0);

    // Subtotal MRC before discount
    const subtotalMRC = ruMRC + powerMRC + torMRC + premiumTorMRC + internetMRC + ccMRC;
    
    // Apply term discount
    const totalMRC = parseFloat((subtotalMRC * discountMultiplier).toFixed(2));

    // NRC
    const setupNRC = p.setup_nrc || 0;
    const totalNRC = parseFloat((setupNRC + ccNRC).toFixed(2));

    // RU included with power (informational)
    const includedRU = Math.floor(q.power_kw * (p.ru_per_kw_ratio || 4));

    return {
      currency: p.currency || 'USD',
      breakdown: {
        ruMRC: parseFloat(ruMRC.toFixed(2)),
        powerMRC: parseFloat(powerMRC.toFixed(2)),
        torMRC: parseFloat(torMRC.toFixed(2)),
        premiumTorMRC: parseFloat(premiumTorMRC.toFixed(2)),
        internetMRC: parseFloat(internetMRC.toFixed(2)),
        ccMRC: parseFloat(ccMRC.toFixed(2)),
        subtotalMRC: parseFloat(subtotalMRC.toFixed(2)),
        discountPct,
        discountAmount: parseFloat((subtotalMRC - totalMRC).toFixed(2)),
        totalMRC,
        setupNRC: parseFloat(setupNRC.toFixed(2)),
        ccNRC: parseFloat(ccNRC.toFixed(2)),
        totalNRC,
        includedRU
      }
    };
  }, [quotePricing, quoteForm]);

  const handleSaveQuote = async () => {
    if (!calculatedQuote || !selectedQuoteLocation || !quoteForm.client_name) {
      setError('Please fill in required fields (Location and Client Name)');
      return;
    }
    try {
      setQuoteSaving(true);
      setError(null);
      const response = await saveColocationQuote({
        location_id: selectedQuoteLocation,
        ...quoteForm,
        currency: calculatedQuote.currency,
        mrc_total: calculatedQuote.breakdown.totalMRC,
        nrc_total: calculatedQuote.breakdown.totalNRC,
        pricing_breakdown: calculatedQuote.breakdown
      });
      setSuccess(`Quote saved! Reference: ${response.data.quote_reference}`);
    } catch (err) {
      setError('Failed to save quote: ' + (err.response?.data?.error || err.message));
    } finally {
      setQuoteSaving(false);
    }
  };

  const loadSavedQuotes = async () => {
    try {
      setQuotesLoading(true);
      const data = await getColocationQuotes();
      setSavedQuotes(data);
    } catch (err) {
      setError('Failed to load quotes: ' + (err.response?.data?.error || err.message));
    } finally {
      setQuotesLoading(false);
    }
  };

  const handleDeleteQuote = async (quoteId) => {
    if (!window.confirm('Are you sure you want to delete this quote?')) return;
    try {
      await deleteColocationQuote(quoteId);
      setSuccess('Quote deleted');
      loadSavedQuotes();
    } catch (err) {
      setError('Failed to delete quote: ' + (err.response?.data?.error || err.message));
    }
  };

  const updateQuote = (field, value) => {
    setQuoteForm(prev => ({ ...prev, [field]: value }));
  };

  const canEditPricing = hasPermission && hasPermission('cnx_colocation_pricing', 'edit');
  const savedQuotesTabValue = canEditPricing ? 2 : 1;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontSize: '1.1875rem' }}>Colocation Pricing Tool</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => { setActiveTab(v); if (v === savedQuotesTabValue) loadSavedQuotes(); }}>
          <Tab icon={<CalculateIcon />} iconPosition="start" label="Quote Builder" sx={{ minHeight: 48 }} />
          {canEditPricing && <Tab icon={<SettingsIcon />} iconPosition="start" label="Pricing Config" sx={{ minHeight: 48 }} />}
          <Tab icon={<HistoryIcon />} iconPosition="start" label="Saved Quotes" sx={{ minHeight: 48 }} />
        </Tabs>
      </Box>

      {/* TAB 0: Quote Builder */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Left side - Configuration */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom><strong>1. Select Location</strong></Typography>
              <FormControl fullWidth size="small">
                <InputLabel>Datacenter Location</InputLabel>
                <Select
                  value={selectedQuoteLocation}
                  label="Datacenter Location"
                  onChange={(e) => handleQuoteLocationChange(e.target.value)}
                >
                  <MenuItem value=""><em>-- Select Location --</em></MenuItem>
                  {locations.filter(l => l.has_pricing_config).map(loc => (
                    <MenuItem key={loc.colocation_location_id} value={loc.colocation_location_id}>
                      {loc.location_code} - {loc.city}, {loc.country} ({loc.datacenter_name})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {locations.filter(l => !l.has_pricing_config).length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {locations.filter(l => !l.has_pricing_config).length} location(s) have no pricing config yet
                </Typography>
              )}
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom><strong>2. Client Details</strong></Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Client Name *" value={quoteForm.client_name}
                    onChange={(e) => updateQuote('client_name', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Contact Name" value={quoteForm.contact_name}
                    onChange={(e) => updateQuote('contact_name', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Contact Email" value={quoteForm.contact_email}
                    onChange={(e) => updateQuote('contact_email', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Rack Type</InputLabel>
                    <Select value={quoteForm.rack_type} label="Rack Type"
                      onChange={(e) => updateQuote('rack_type', e.target.value)}>
                      <MenuItem value="shared">Shared</MenuItem>
                      <MenuItem value="dedicated">Dedicated</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom><strong>3. Space & Power Requirements</strong></Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" type="number" label="Rack Units (RU)"
                    value={quoteForm.ru_count} sx={numberInputSx}
                    onChange={(e) => updateQuote('ru_count', parseInt(e.target.value) || 0)}
                    inputProps={{ min: 0 }}
                    helperText={quotePricing ? `${quotePricing.currency} ${quotePricing.price_per_ru_month}/RU/month` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" type="number" label="Power (kW)"
                    value={quoteForm.power_kw} sx={numberInputSx}
                    onChange={(e) => updateQuote('power_kw', parseFloat(e.target.value) || 0)}
                    inputProps={{ min: 0, step: 0.5 }}
                    helperText={quotePricing ? `${quotePricing.currency} ${quotePricing.price_per_kw_month}/kW/month` : ''}
                  />
                </Grid>
              </Grid>
              {calculatedQuote && calculatedQuote.breakdown.includedRU > 0 && (
                <Alert severity="info" sx={{ mt: 1, py: 0 }}>
                  <Typography variant="caption">
                    {quoteForm.power_kw} kW includes ~{calculatedQuote.breakdown.includedRU} RU (ratio: {quotePricing?.ru_per_kw_ratio || 4} RU/kW)
                  </Typography>
                </Alert>
              )}
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom><strong>4. Add-on Services</strong></Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" type="number" label="TOR Ports"
                    value={quoteForm.tor_ports} sx={numberInputSx}
                    onChange={(e) => updateQuote('tor_ports', parseInt(e.target.value) || 0)}
                    inputProps={{ min: 0 }}
                    helperText={quotePricing ? `${quotePricing.currency} ${quotePricing.tor_port_price_month}/port/month` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" type="number" label="Premium TOR Ports"
                    value={quoteForm.premium_tor_ports} sx={numberInputSx}
                    onChange={(e) => updateQuote('premium_tor_ports', parseInt(e.target.value) || 0)}
                    inputProps={{ min: 0 }}
                    helperText={quotePricing ? `${quotePricing.currency} ${quotePricing.premium_tor_port_price_month}/port/month` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" type="number" label="Outbound Internet Access (10Mb each)"
                    value={quoteForm.internet_access} sx={numberInputSx}
                    onChange={(e) => updateQuote('internet_access', parseInt(e.target.value) || 0)}
                    inputProps={{ min: 0 }}
                    helperText={quotePricing ? `${quotePricing.currency} ${quotePricing.internet_access_price_month}/connection/month (fixed 10Mb)` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" type="number" label="Managed Cross Connects"
                    value={quoteForm.managed_cross_connects} sx={numberInputSx}
                    onChange={(e) => updateQuote('managed_cross_connects', parseInt(e.target.value) || 0)}
                    inputProps={{ min: 0 }}
                    helperText={quotePricing ? `NRC: ${quotePricing.currency} ${quotePricing.cross_connect_nrc || 0} + MRC: ${quotePricing.currency} ${quotePricing.cross_connect_mrc || 0}/month` : ''}
                  />
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom><strong>5. Contract Term</strong></Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Contract Term</InputLabel>
                    <Select value={quoteForm.contract_term_months} label="Contract Term"
                      onChange={(e) => updateQuote('contract_term_months', e.target.value)}>
                      <MenuItem value={12}>12 Months{quotePricing?.discount_12_month > 0 ? ` (${quotePricing.discount_12_month}% discount)` : ''}</MenuItem>
                      <MenuItem value={24}>24 Months{quotePricing?.discount_24_month > 0 ? ` (${quotePricing.discount_24_month}% discount)` : ''}</MenuItem>
                      <MenuItem value={36}>36 Months{quotePricing?.discount_36_month > 0 ? ` (${quotePricing.discount_36_month}% discount)` : ''}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" multiline rows={2} label="Notes"
                    value={quoteForm.notes}
                    onChange={(e) => updateQuote('notes', e.target.value)} />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Right side - Quote Summary */}
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2, position: 'sticky', top: 16 }}>
              <Typography variant="subtitle1" gutterBottom><strong>Quote Summary</strong></Typography>
              
              {!calculatedQuote ? (
                <Typography variant="body2" color="text.secondary">Select a location and configure services to see pricing</Typography>
              ) : (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Chip label={calculatedQuote.currency} size="small" color="primary" sx={{ mb: 1 }} />
                  </Box>

                  <TableContainer>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ border: 0, py: 0.5 }}><Typography variant="caption">RU ({quoteForm.ru_count} × {quotePricing?.price_per_ru_month})</Typography></TableCell>
                          <TableCell align="right" sx={{ border: 0, py: 0.5 }}>{calculatedQuote.breakdown.ruMRC.toFixed(2)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ border: 0, py: 0.5 }}><Typography variant="caption">Power ({quoteForm.power_kw} kW × {quotePricing?.price_per_kw_month})</Typography></TableCell>
                          <TableCell align="right" sx={{ border: 0, py: 0.5 }}>{calculatedQuote.breakdown.powerMRC.toFixed(2)}</TableCell>
                        </TableRow>
                        {quoteForm.tor_ports > 0 && (
                          <TableRow>
                            <TableCell sx={{ border: 0, py: 0.5 }}><Typography variant="caption">TOR Ports ({quoteForm.tor_ports})</Typography></TableCell>
                            <TableCell align="right" sx={{ border: 0, py: 0.5 }}>{calculatedQuote.breakdown.torMRC.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {quoteForm.premium_tor_ports > 0 && (
                          <TableRow>
                            <TableCell sx={{ border: 0, py: 0.5 }}><Typography variant="caption">Premium TOR Ports ({quoteForm.premium_tor_ports})</Typography></TableCell>
                            <TableCell align="right" sx={{ border: 0, py: 0.5 }}>{calculatedQuote.breakdown.premiumTorMRC.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {quoteForm.internet_access > 0 && (
                          <TableRow>
                            <TableCell sx={{ border: 0, py: 0.5 }}><Typography variant="caption">Internet Access ({quoteForm.internet_access} × 10Mb)</Typography></TableCell>
                            <TableCell align="right" sx={{ border: 0, py: 0.5 }}>{calculatedQuote.breakdown.internetMRC.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {quoteForm.managed_cross_connects > 0 && (
                          <TableRow>
                            <TableCell sx={{ border: 0, py: 0.5 }}><Typography variant="caption">Cross Connects MRC ({quoteForm.managed_cross_connects})</Typography></TableCell>
                            <TableCell align="right" sx={{ border: 0, py: 0.5 }}>{calculatedQuote.breakdown.ccMRC.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell sx={{ py: 0.5 }}><Typography variant="caption" fontWeight="bold">Subtotal MRC</Typography></TableCell>
                          <TableCell align="right" sx={{ py: 0.5 }}><strong>{calculatedQuote.breakdown.subtotalMRC.toFixed(2)}</strong></TableCell>
                        </TableRow>
                        {calculatedQuote.breakdown.discountPct > 0 && (
                          <TableRow>
                            <TableCell sx={{ border: 0, py: 0.5, color: 'success.main' }}>
                              <Typography variant="caption">Term Discount ({calculatedQuote.breakdown.discountPct}%)</Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ border: 0, py: 0.5, color: 'success.main' }}>
                              -{calculatedQuote.breakdown.discountAmount.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Divider sx={{ my: 1 }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" color="primary"><strong>Monthly Recurring (MRC)</strong></Typography>
                    <Typography variant="subtitle2" color="primary">
                      <strong>{calculatedQuote.currency} {calculatedQuote.breakdown.totalMRC.toFixed(2)}</strong>
                    </Typography>
                  </Box>

                  {calculatedQuote.breakdown.totalNRC > 0 && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <TableContainer>
                        <Table size="small">
                          <TableBody>
                            {calculatedQuote.breakdown.setupNRC > 0 && (
                              <TableRow>
                                <TableCell sx={{ border: 0, py: 0.5 }}><Typography variant="caption">Setup NRC</Typography></TableCell>
                                <TableCell align="right" sx={{ border: 0, py: 0.5 }}>{calculatedQuote.breakdown.setupNRC.toFixed(2)}</TableCell>
                              </TableRow>
                            )}
                            {calculatedQuote.breakdown.ccNRC > 0 && (
                              <TableRow>
                                <TableCell sx={{ border: 0, py: 0.5 }}><Typography variant="caption">Cross Connect NRC ({quoteForm.managed_cross_connects})</Typography></TableCell>
                                <TableCell align="right" sx={{ border: 0, py: 0.5 }}>{calculatedQuote.breakdown.ccNRC.toFixed(2)}</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        <Typography variant="subtitle2" color="secondary"><strong>One-Time (NRC)</strong></Typography>
                        <Typography variant="subtitle2" color="secondary">
                          <strong>{calculatedQuote.currency} {calculatedQuote.breakdown.totalNRC.toFixed(2)}</strong>
                        </Typography>
                      </Box>
                    </>
                  )}

                  <Divider sx={{ my: 2 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, p: 1, backgroundColor: 'primary.50', borderRadius: 1 }}>
                    <Typography variant="body1"><strong>Contract: {quoteForm.contract_term_months} months</strong></Typography>
                    <Typography variant="body1">
                      <strong>TCV: {calculatedQuote.currency} {(calculatedQuote.breakdown.totalMRC * quoteForm.contract_term_months + calculatedQuote.breakdown.totalNRC).toFixed(2)}</strong>
                    </Typography>
                  </Box>

                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveQuote}
                    disabled={quoteSaving || !quoteForm.client_name}
                    sx={{ mt: 1 }}
                  >
                    {quoteSaving ? 'Saving...' : 'Save Quote'}
                  </Button>
                </>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* TAB 1: Pricing Config (Provisioner only) */}
      {activeTab === 1 && canEditPricing && (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom><strong>Select Location to Configure</strong></Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Location</InputLabel>
              <Select value={selectedConfigLocation} label="Location"
                onChange={(e) => handleConfigLocationChange(e.target.value)}>
                <MenuItem value=""><em>-- Select Location --</em></MenuItem>
                {locations.map(loc => (
                  <MenuItem key={loc.colocation_location_id} value={loc.colocation_location_id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {loc.location_code} - {loc.city}, {loc.country}
                      {loc.has_pricing_config ? (
                        <Chip label="Configured" size="small" color="success" variant="outlined" />
                      ) : (
                        <Chip label="Not Configured" size="small" color="warning" variant="outlined" />
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>

          {configData && (
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1"><strong>Pricing Configuration</strong></Typography>
                <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveConfig}
                  disabled={configSaving}>
                  {configSaving ? 'Saving...' : 'Save Config'}
                </Button>
              </Box>

              <Grid container spacing={3}>
                {/* Currency */}
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Currency</InputLabel>
                    <Select value={configData.currency || 'USD'} label="Currency"
                      onChange={(e) => updateConfig('currency', e.target.value)}>
                      <MenuItem value="USD">USD</MenuItem>
                      <MenuItem value="GBP">GBP</MenuItem>
                      <MenuItem value="EUR">EUR</MenuItem>
                      <MenuItem value="JPY">JPY</MenuItem>
                      <MenuItem value="SGD">SGD</MenuItem>
                      <MenuItem value="HKD">HKD</MenuItem>
                      <MenuItem value="AUD">AUD</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Space & Power */}
                <Grid item xs={12}>
                  <Divider sx={{ mb: 1 }} />
                  <Typography variant="subtitle2" gutterBottom><strong>Space & Power Pricing</strong></Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" type="number" label="Price per RU / month"
                    value={configData.price_per_ru_month} sx={numberInputSx}
                    onChange={(e) => updateConfig('price_per_ru_month', e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start">{configData.currency}</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" type="number" label="Price per kW / month"
                    value={configData.price_per_kw_month} sx={numberInputSx}
                    onChange={(e) => updateConfig('price_per_kw_month', e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start">{configData.currency}</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" type="number" label="RU per kW Ratio"
                    value={configData.ru_per_kw_ratio} sx={numberInputSx}
                    onChange={(e) => updateConfig('ru_per_kw_ratio', e.target.value)}
                    helperText="How many RU included per 1 kW of power"
                  />
                </Grid>

                {/* Add-on Services */}
                <Grid item xs={12}>
                  <Divider sx={{ mb: 1 }} />
                  <Typography variant="subtitle2" gutterBottom><strong>Add-on Service Pricing</strong></Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" type="number" label="TOR Port / month"
                    value={configData.tor_port_price_month} sx={numberInputSx}
                    onChange={(e) => updateConfig('tor_port_price_month', e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start">{configData.currency}</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" type="number" label="Premium TOR Port / month"
                    value={configData.premium_tor_port_price_month} sx={numberInputSx}
                    onChange={(e) => updateConfig('premium_tor_port_price_month', e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start">{configData.currency}</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" type="number" label="Internet Access (10Mb) / month"
                    value={configData.internet_access_price_month} sx={numberInputSx}
                    onChange={(e) => updateConfig('internet_access_price_month', e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start">{configData.currency}</InputAdornment> }}
                    helperText="Fixed 10Mb per connection"
                  />
                </Grid>

                {/* Cross Connect */}
                <Grid item xs={12}>
                  <Divider sx={{ mb: 1 }} />
                  <Typography variant="subtitle2" gutterBottom><strong>Cross Connect Pricing</strong></Typography>
                  {configData.location_cc_nrc != null && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Location base pricing: NRC {configData.cross_connect_nrc_currency} {configData.location_cc_nrc}, MRC {configData.cross_connect_mrc_currency} {configData.location_cc_mrc}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" type="number" label="Cross Connect NRC"
                    value={configData.cross_connect_nrc || ''} sx={numberInputSx}
                    onChange={(e) => updateConfig('cross_connect_nrc', e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start">{configData.currency}</InputAdornment> }}
                    helperText="One-time per cross connect"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" type="number" label="Cross Connect MRC"
                    value={configData.cross_connect_mrc || ''} sx={numberInputSx}
                    onChange={(e) => updateConfig('cross_connect_mrc', e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start">{configData.currency}</InputAdornment> }}
                    helperText="Monthly per cross connect"
                  />
                </Grid>

                {/* NRC & Discounts */}
                <Grid item xs={12}>
                  <Divider sx={{ mb: 1 }} />
                  <Typography variant="subtitle2" gutterBottom><strong>Setup & Contract Terms</strong></Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField fullWidth size="small" type="number" label="Setup NRC"
                    value={configData.setup_nrc} sx={numberInputSx}
                    onChange={(e) => updateConfig('setup_nrc', e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start">{configData.currency}</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField fullWidth size="small" type="number" label="12-Month Discount"
                    value={configData.discount_12_month} sx={numberInputSx}
                    onChange={(e) => updateConfig('discount_12_month', e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField fullWidth size="small" type="number" label="24-Month Discount"
                    value={configData.discount_24_month} sx={numberInputSx}
                    onChange={(e) => updateConfig('discount_24_month', e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField fullWidth size="small" type="number" label="36-Month Discount"
                    value={configData.discount_36_month} sx={numberInputSx}
                    onChange={(e) => updateConfig('discount_36_month', e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  />
                </Grid>

                {/* Notes */}
                <Grid item xs={12}>
                  <TextField fullWidth size="small" multiline rows={2} label="Notes"
                    value={configData.notes || ''}
                    onChange={(e) => updateConfig('notes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </Paper>
          )}
        </Box>
      )}

      {/* Saved Quotes Tab */}
      {activeTab === savedQuotesTabValue && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1"><strong>Saved Quotes ({savedQuotes.length})</strong></Typography>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadSavedQuotes} size="small">
              Refresh
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Reference</strong></TableCell>
                  <TableCell><strong>Location</strong></TableCell>
                  <TableCell><strong>Client</strong></TableCell>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell><strong>Term</strong></TableCell>
                  <TableCell align="right"><strong>MRC</strong></TableCell>
                  <TableCell align="right"><strong>NRC</strong></TableCell>
                  <TableCell><strong>Created By</strong></TableCell>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {savedQuotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        {quotesLoading ? 'Loading...' : 'No saved quotes found'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  savedQuotes.map(quote => (
                    <TableRow key={quote.id} hover>
                      <TableCell><Chip label={quote.quote_reference} size="small" variant="outlined" /></TableCell>
                      <TableCell>{quote.location_code}</TableCell>
                      <TableCell>{quote.client_name}</TableCell>
                      <TableCell><Chip label={quote.rack_type} size="small" /></TableCell>
                      <TableCell>{quote.contract_term_months}m</TableCell>
                      <TableCell align="right">{quote.currency} {parseFloat(quote.mrc_total).toFixed(2)}</TableCell>
                      <TableCell align="right">{quote.currency} {parseFloat(quote.nrc_total).toFixed(2)}</TableCell>
                      <TableCell>{quote.created_by_name || 'N/A'}</TableCell>
                      <TableCell>{new Date(quote.created_date).toLocaleDateString()}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => handleDeleteQuote(quote.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
};

export default ColocationPricingTool;
