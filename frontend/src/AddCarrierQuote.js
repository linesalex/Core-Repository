import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Grid, MenuItem, Select, InputLabel,
  FormControl, Autocomplete, Tooltip, Divider, InputAdornment, List, ListItem,
  ListItemText, ListItemIcon, ListItemSecondaryAction, IconButton, CircularProgress,
  Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import MapIcon from '@mui/icons-material/Map';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';
import TimelineIcon from '@mui/icons-material/Timeline';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { useAuth } from './AuthContext';
import { carrierQuoteApi } from './api';

const SERVICE_TYPES = ['MPLS', 'Ethernet', 'Dark Fiber', 'Wavelength'];
const REGIONS = ['AMERs', 'APAC', 'EMEA', 'INTER'];
const BANDWIDTH_UNITS = ['Mbps', 'Gbps', 'Dark Fiber'];
const CONTRACT_TERMS = [12, 24, 36];
const PROTECTION_TYPES = ['Unprotected', 'Protected', 'Diverse'];
const PRICE_STAGE_PRESETS = ['Initial Offer', 'Counter Offer', 'Discounted', 'Best and Final', 'Accepted', 'Rejected'];

const emptyFormData = {
  quote_reference: '',
  carrier_id: null,
  carrier_name: '',
  carrier_quote_ref: '',
  service_type: '',
  region: '',
  location_a_type: 'pop',
  location_a_pop_code: '',
  location_a_custom_id: null,
  location_a_custom_name: '',
  location_b_type: 'pop',
  location_b_pop_code: '',
  location_b_custom_id: null,
  location_b_custom_name: '',
  bandwidth_value: '',
  bandwidth_unit: 'Gbps',
  mrc: '',
  nrc: '',
  currency: 'USD',
  contract_term: '',
  expected_latency: '',
  protection: '',
  cable_system: '',
  quote_date: '',
  expiry_date: '',
  transit_cities: '',
  transit_countries: '',
  notes: ''
};

const AddCarrierQuote = ({ onNavigateBack, editQuoteId }) => {
  const { user } = useAuth();
  const isEditMode = !!editQuoteId;

  // Form state
  const [formData, setFormData] = useState({ ...emptyFormData });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Autocomplete data
  const [carriers, setCarriers] = useState([]);
  const [popLocations, setPopLocations] = useState([]);
  const [customLocations, setCustomLocations] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  // File upload state
  const [uploadFiles, setUploadFiles] = useState([]);
  const fileInputRef = useRef(null);

  // KMZ parsing state
  const [kmzParsing, setKmzParsing] = useState(false);
  const kmzInputRef = useRef(null);

  // New custom location dialog
  const [customLocDialogOpen, setCustomLocDialogOpen] = useState(false);
  const [customLocTarget, setCustomLocTarget] = useState('a');
  const [newCustomLoc, setNewCustomLoc] = useState({ location_name: '', address: '', city: '', country: '' });

  // Price stage tracking
  const [priceStages, setPriceStages] = useState([]);
  const [priceStageDialogOpen, setPriceStageDialogOpen] = useState(false);
  const [newPriceStage, setNewPriceStage] = useState({
    stage_name: '',
    mrc: '',
    nrc: '',
    currency: '',
    notes: '',
    stage_date: new Date().toISOString().split('T')[0]
  });

  // Load reference data
  const loadReferenceData = useCallback(async () => {
    try {
      const [carrierData, currencyData] = await Promise.all([
        carrierQuoteApi.getCarriers(),
        carrierQuoteApi.getCurrencies()
      ]);
      setCarriers(carrierData || []);
      setCurrencies(currencyData || []);
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  }, []);

  // Load quote data for edit mode
  const loadQuoteForEdit = useCallback(async () => {
    if (!editQuoteId) return;
    setLoading(true);
    try {
      const quote = await carrierQuoteApi.getQuote(editQuoteId);
      setFormData({
        quote_reference: quote.quote_reference || '',
        carrier_id: quote.carrier_id,
        carrier_name: quote.carrier_name || '',
        carrier_quote_ref: quote.carrier_quote_ref || '',
        service_type: quote.service_type || '',
        region: quote.region || '',
        location_a_type: quote.location_a_type || 'pop',
        location_a_pop_code: quote.location_a_pop_code || '',
        location_a_custom_id: quote.location_a_custom_id,
        location_a_custom_name: quote.location_a_custom_name || '',
        location_b_type: quote.location_b_type || 'pop',
        location_b_pop_code: quote.location_b_pop_code || '',
        location_b_custom_id: quote.location_b_custom_id,
        location_b_custom_name: quote.location_b_custom_name || '',
        bandwidth_value: quote.bandwidth_value || '',
        bandwidth_unit: quote.bandwidth_unit || 'Gbps',
        mrc: quote.mrc || '',
        nrc: quote.nrc || '',
        currency: quote.currency || 'USD',
        contract_term: quote.contract_term || '',
        expected_latency: quote.expected_latency || '',
        protection: quote.protection || '',
        cable_system: quote.cable_system || '',
        quote_date: quote.quote_date || '',
        expiry_date: quote.expiry_date || '',
        transit_cities: quote.transit_cities || '',
        transit_countries: quote.transit_countries || '',
        notes: quote.notes || ''
      });
      // Load price stages
      if (quote.price_stages) {
        setPriceStages(quote.price_stages);
      }
    } catch (err) {
      setError('Failed to load quote: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }, [editQuoteId]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    loadQuoteForEdit();
  }, [loadQuoteForEdit]);

  // Search POP locations
  const searchPopLocations = async (query) => {
    if (!query || query.length < 1) return;
    try {
      const data = await carrierQuoteApi.getPopLocations(query);
      setPopLocations(data || []);
    } catch (err) {
      console.error('Failed to search POP locations:', err);
    }
  };

  // Search custom locations
  const searchCustomLocations = async (query) => {
    try {
      const data = await carrierQuoteApi.getCustomLocations(query || '');
      setCustomLocations(data || []);
    } catch (err) {
      console.error('Failed to search custom locations:', err);
    }
  };

  // Check if Dark Fiber is selected (bandwidth value not required)
  const isDarkFiber = formData.bandwidth_unit === 'Dark Fiber';

  // Validate form
  const validateForm = () => {
    const errors = {};
    if (!formData.carrier_name) errors.carrier_name = 'Carrier name is required';
    if (!formData.service_type) errors.service_type = 'Service type is required';
    if (!formData.region) errors.region = 'Region is required';
    if (!isDarkFiber && !formData.bandwidth_value) errors.bandwidth_value = 'Bandwidth is required';
    if (!formData.bandwidth_unit) errors.bandwidth_unit = 'Bandwidth unit is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const submitData = { ...formData };
      // Clean up numeric fields
      if (submitData.bandwidth_value) submitData.bandwidth_value = parseFloat(submitData.bandwidth_value);
      if (submitData.mrc) submitData.mrc = parseFloat(submitData.mrc);
      if (submitData.nrc) submitData.nrc = parseFloat(submitData.nrc);
      if (submitData.expected_latency) submitData.expected_latency = parseFloat(submitData.expected_latency);
      if (submitData.contract_term) submitData.contract_term = parseInt(submitData.contract_term);
      // Clear bandwidth value for Dark Fiber
      if (isDarkFiber) submitData.bandwidth_value = null;

      let quoteId;
      if (isEditMode) {
        await carrierQuoteApi.updateQuote(editQuoteId, submitData);
        quoteId = editQuoteId;
        setSuccess('Quote updated successfully');
      } else {
        const result = await carrierQuoteApi.createQuote(submitData);
        quoteId = result.id;
        setSuccess(`Quote ${result.quote_reference} created successfully`);
      }

      // Upload files if any
      if (uploadFiles.length > 0 && quoteId) {
        try {
          await carrierQuoteApi.uploadAttachments(quoteId, uploadFiles);
        } catch (uploadErr) {
          setError('Quote saved but file upload failed: ' + (uploadErr.response?.data?.error || uploadErr.message));
        }
      }

      // Navigate back after short delay so user sees success message
      setTimeout(() => {
        if (onNavigateBack) onNavigateBack();
      }, 1200);
    } catch (err) {
      setError('Failed to save quote: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Handle KMZ file parsing
  const handleKmzParse = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setKmzParsing(true);
    try {
      const result = await carrierQuoteApi.parseKmz(file);
      setFormData(prev => ({
        ...prev,
        transit_cities: result.transit_cities || prev.transit_cities,
        transit_countries: result.transit_countries || prev.transit_countries
      }));
      
      // Add KMZ file to upload list
      setUploadFiles(prev => [...prev, file]);
      setSuccess('KMZ uploaded and parsed - route data extracted');
    } catch (err) {
      setError('Failed to parse KMZ: ' + (err.response?.data?.error || err.message));
    } finally {
      setKmzParsing(false);
      if (kmzInputRef.current) kmzInputRef.current.value = '';
    }
  };

  // Handle document file selection
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setUploadFiles(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove file from upload list
  const removeUploadFile = (index) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Add a price stage
  const handleAddPriceStage = async () => {
    if (!newPriceStage.stage_name) {
      setError('Stage name is required');
      return;
    }
    
    if (!editQuoteId) {
      // For new quotes, stage will be added after save
      setError('Please save the quote first, then add price stages');
      return;
    }
    
    try {
      const stageData = {
        ...newPriceStage,
        mrc: newPriceStage.mrc ? parseFloat(newPriceStage.mrc) : null,
        nrc: newPriceStage.nrc ? parseFloat(newPriceStage.nrc) : null,
        currency: newPriceStage.currency || formData.currency || 'USD'
      };
      
      const result = await carrierQuoteApi.addPriceStage(editQuoteId, stageData);
      setPriceStages(prev => [...prev, result]);
      setPriceStageDialogOpen(false);
      setNewPriceStage({
        stage_name: '',
        mrc: '',
        nrc: '',
        currency: '',
        notes: '',
        stage_date: new Date().toISOString().split('T')[0]
      });
      setSuccess('Price stage added');
    } catch (err) {
      setError('Failed to add price stage: ' + (err.response?.data?.error || err.message));
    }
  };

  // Delete a price stage
  const handleDeletePriceStage = async (stageId) => {
    if (!editQuoteId) return;
    try {
      await carrierQuoteApi.deletePriceStage(editQuoteId, stageId);
      setPriceStages(prev => prev.filter(s => s.id !== stageId));
      setSuccess('Price stage deleted');
    } catch (err) {
      setError('Failed to delete price stage: ' + (err.response?.data?.error || err.message));
    }
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Create custom location
  const handleCreateCustomLocation = async () => {
    if (!newCustomLoc.location_name) {
      setError('Location name is required');
      return;
    }

    try {
      const result = await carrierQuoteApi.createCustomLocation(newCustomLoc);
      const target = customLocTarget;
      
      setFormData(prev => ({
        ...prev,
        [`location_${target}_type`]: 'custom',
        [`location_${target}_custom_id`]: result.id,
        [`location_${target}_custom_name`]: result.location_name,
        [`location_${target}_pop_code`]: result.location_name
      }));

      setCustomLocDialogOpen(false);
      setNewCustomLoc({ location_name: '', address: '', city: '', country: '' });
      setSuccess('Custom location created');
      searchCustomLocations('');
    } catch (err) {
      setError('Failed to create custom location: ' + (err.response?.data?.error || err.message));
    }
  };

  // Combined location options for autocomplete (POP + Custom)
  const getLocationOptions = () => {
    const popOptions = popLocations.map(loc => ({
      type: 'pop',
      id: null,
      code: loc.location_code,
      label: `${loc.location_code} - ${loc.datacenter_name || loc.city || ''}`,
      customId: null
    }));
    const customOptions = customLocations.map(loc => ({
      type: 'custom',
      id: loc.id,
      code: loc.location_name,
      label: `${loc.location_name}${loc.address ? ' - ' + loc.address : ''}${loc.city ? ', ' + loc.city : ''}`,
      customId: loc.id
    }));
    return [...popOptions, ...customOptions];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onNavigateBack}
          variant="outlined"
          size="small"
        >
          Back to Repository
        </Button>
        <Typography variant="h5">
          {isEditMode ? 'Edit Carrier Quote' : 'Add Carrier Quote'}
        </Typography>
        {isEditMode && formData.quote_reference && (
          <Chip label={formData.quote_reference} color="primary" variant="outlined" />
        )}
      </Box>

      {/* Section 1: Carrier & Service */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Carrier & Service</Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Autocomplete
              freeSolo
              size="small"
              options={carriers}
              getOptionLabel={(opt) => {
                if (typeof opt === 'string') return opt;
                return opt.display_name || opt.carrier_name || '';
              }}
              value={formData.carrier_name ? { carrier_name: formData.carrier_name, id: formData.carrier_id, display_name: formData.carrier_name } : null}
              filterOptions={(options, { inputValue }) => {
                return options.filter(opt =>
                  (opt.carrier_name || '').toLowerCase().includes(inputValue.toLowerCase()) ||
                  (opt.display_name || '').toLowerCase().includes(inputValue.toLowerCase())
                );
              }}
              onInputChange={(_, value) => {
                // Strip region suffix if user is typing after selecting
                const cleanValue = value.replace(/\s*\([^)]*\)\s*$/, '');
                setFormData(prev => ({ ...prev, carrier_name: cleanValue }));
                if (cleanValue.length >= 1) {
                  carrierQuoteApi.getCarriers(cleanValue).then(setCarriers).catch(() => {});
                }
              }}
              onChange={(_, value) => {
                if (value && typeof value === 'object') {
                  setFormData(prev => ({ ...prev, carrier_name: value.carrier_name, carrier_id: value.id }));
                } else if (typeof value === 'string') {
                  setFormData(prev => ({ ...prev, carrier_name: value, carrier_id: null }));
                }
              }}
              renderOption={(props, option) => (
                <li {...props} key={option.id || option.carrier_name}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <Typography variant="body2">{option.carrier_name}</Typography>
                    {option.region && (
                      <Chip label={option.region} size="small" variant="outlined" sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} />
                    )}
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Carrier *" error={!!formErrors.carrier_name} helperText={formErrors.carrier_name} />
              )}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small" error={!!formErrors.service_type}>
              <InputLabel>Service Type *</InputLabel>
              <Select value={formData.service_type} onChange={(e) => setFormData(prev => ({ ...prev, service_type: e.target.value }))} label="Service Type *">
                {SERVICE_TYPES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small" error={!!formErrors.region}>
              <InputLabel>Region *</InputLabel>
              <Select value={formData.region} onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))} label="Region *">
                {REGIONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Section 2: Route / Locations */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Route</Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Autocomplete
                freeSolo
                size="small"
                fullWidth
                options={getLocationOptions()}
                getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.label || opt.code || ''}
                groupBy={(opt) => opt.type === 'pop' ? 'POP Locations' : 'Custom Locations'}
                inputValue={formData.location_a_pop_code || formData.location_a_custom_name || ''}
                onInputChange={(_, value) => {
                  setFormData(prev => ({
                    ...prev,
                    location_a_pop_code: value,
                    location_a_type: 'pop',
                    location_a_custom_id: null,
                    location_a_custom_name: ''
                  }));
                  searchPopLocations(value);
                  searchCustomLocations(value);
                }}
                onChange={(_, value) => {
                  if (value && typeof value === 'object') {
                    if (value.type === 'pop') {
                      setFormData(prev => ({
                        ...prev,
                        location_a_type: 'pop',
                        location_a_pop_code: value.code,
                        location_a_custom_id: null,
                        location_a_custom_name: ''
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        location_a_type: 'custom',
                        location_a_pop_code: value.code,
                        location_a_custom_id: value.customId,
                        location_a_custom_name: value.code
                      }));
                    }
                  }
                }}
                renderInput={(params) => <TextField {...params} label="Location A" />}
              />
              <Tooltip title="Add New Custom Location">
                <IconButton size="small" onClick={() => { setCustomLocTarget('a'); setCustomLocDialogOpen(true); }}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Autocomplete
                freeSolo
                size="small"
                fullWidth
                options={getLocationOptions()}
                getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.label || opt.code || ''}
                groupBy={(opt) => opt.type === 'pop' ? 'POP Locations' : 'Custom Locations'}
                inputValue={formData.location_b_pop_code || formData.location_b_custom_name || ''}
                onInputChange={(_, value) => {
                  setFormData(prev => ({
                    ...prev,
                    location_b_pop_code: value,
                    location_b_type: 'pop',
                    location_b_custom_id: null,
                    location_b_custom_name: ''
                  }));
                  searchPopLocations(value);
                  searchCustomLocations(value);
                }}
                onChange={(_, value) => {
                  if (value && typeof value === 'object') {
                    if (value.type === 'pop') {
                      setFormData(prev => ({
                        ...prev,
                        location_b_type: 'pop',
                        location_b_pop_code: value.code,
                        location_b_custom_id: null,
                        location_b_custom_name: ''
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        location_b_type: 'custom',
                        location_b_pop_code: value.code,
                        location_b_custom_id: value.customId,
                        location_b_custom_name: value.code
                      }));
                    }
                  }
                }}
                renderInput={(params) => <TextField {...params} label="Location B" />}
              />
              <Tooltip title="Add New Custom Location">
                <IconButton size="small" onClick={() => { setCustomLocTarget('b'); setCustomLocDialogOpen(true); }}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Section 3: Bandwidth & Pricing */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Bandwidth & Pricing</Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small" error={!!formErrors.bandwidth_unit}>
              <InputLabel>Bandwidth Unit *</InputLabel>
              <Select value={formData.bandwidth_unit} onChange={(e) => setFormData(prev => ({ ...prev, bandwidth_unit: e.target.value }))} label="Bandwidth Unit *">
                {BANDWIDTH_UNITS.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label={isDarkFiber ? 'Bandwidth (N/A)' : 'Bandwidth *'}
              type="number"
              value={isDarkFiber ? '' : formData.bandwidth_value}
              onChange={(e) => setFormData(prev => ({ ...prev, bandwidth_value: e.target.value }))}
              error={!!formErrors.bandwidth_value}
              helperText={isDarkFiber ? 'Not required for Dark Fiber' : formErrors.bandwidth_value}
              disabled={isDarkFiber}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Currency</InputLabel>
              <Select value={formData.currency} onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))} label="Currency">
                {currencies.map(c => <MenuItem key={c.currency_code} value={c.currency_code}>{c.currency_code}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Contract Term</InputLabel>
              <Select value={formData.contract_term} onChange={(e) => setFormData(prev => ({ ...prev, contract_term: e.target.value }))} label="Contract Term">
                <MenuItem value="">N/A</MenuItem>
                {CONTRACT_TERMS.map(t => <MenuItem key={t} value={t}>{t} months</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="MRC"
              type="number"
              value={formData.mrc}
              onChange={(e) => setFormData(prev => ({ ...prev, mrc: e.target.value }))}
              InputProps={{ startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="NRC"
              type="number"
              value={formData.nrc}
              onChange={(e) => setFormData(prev => ({ ...prev, nrc: e.target.value }))}
              InputProps={{ startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Protection</InputLabel>
              <Select value={formData.protection} onChange={(e) => setFormData(prev => ({ ...prev, protection: e.target.value }))} label="Protection">
                {PROTECTION_TYPES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Section 4: Additional Details */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Additional Details</Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Expected Latency (ms)"
              type="number"
              value={formData.expected_latency}
              onChange={(e) => setFormData(prev => ({ ...prev, expected_latency: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Cable System"
              value={formData.cable_system}
              onChange={(e) => setFormData(prev => ({ ...prev, cable_system: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Quote Date"
              value={formData.quote_date}
              onChange={(e) => setFormData(prev => ({ ...prev, quote_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Expiry Date"
              value={formData.expiry_date}
              onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Section 5: Quote References */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>References</Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Internal Reference (QR)"
              value={formData.quote_reference}
              onChange={(e) => setFormData(prev => ({ ...prev, quote_reference: e.target.value }))}
              helperText={isEditMode ? 'Cannot change reference' : 'Leave blank to auto-generate. Same QR can be used across multiple quotes.'}
              disabled={isEditMode}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Carrier Quote Ref"
              value={formData.carrier_quote_ref}
              onChange={(e) => setFormData(prev => ({ ...prev, carrier_quote_ref: e.target.value }))}
              helperText="The carrier's own reference number for this quote"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Section 6: KMZ Route Data */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>KMZ Route Data</Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={kmzParsing ? <CircularProgress size={16} /> : <UploadFileIcon />}
            onClick={() => kmzInputRef.current?.click()}
            disabled={kmzParsing}
          >
            {kmzParsing ? 'Uploading...' : 'Upload KMZ'}
          </Button>
          <input
            ref={kmzInputRef}
            type="file"
            accept=".kmz,.kml"
            style={{ display: 'none' }}
            onChange={handleKmzParse}
          />
        </Box>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Transit Cities"
              value={formData.transit_cities}
              onChange={(e) => setFormData(prev => ({ ...prev, transit_cities: e.target.value }))}
              helperText="Auto-populated from KMZ upload, editable"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Transit Countries"
              value={formData.transit_countries}
              onChange={(e) => setFormData(prev => ({ ...prev, transit_countries: e.target.value }))}
              helperText="Auto-populated from KMZ upload, editable"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Section 7: Notes */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Notes</Typography>
        <TextField
          fullWidth
          size="small"
          label="Notes"
          multiline
          minRows={3}
          maxRows={6}
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
        />
      </Paper>

      {/* Section 8: Price Negotiation History */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Price Negotiation History</Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setNewPriceStage(prev => ({
                ...prev,
                currency: formData.currency || 'USD',
                mrc: formData.mrc || '',
                nrc: formData.nrc || ''
              }));
              setPriceStageDialogOpen(true);
            }}
            disabled={!isEditMode}
          >
            Add Price Stage
          </Button>
        </Box>
        
        {!isEditMode && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            Save the quote first to start tracking price negotiations. Once saved, you can record each stage of the negotiation process.
          </Typography>
        )}
        
        {isEditMode && priceStages.length > 0 && (
          <>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Stage</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">MRC</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">NRC</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Ccy</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>By</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {priceStages.map((stage, idx) => {
                    const prevStage = idx > 0 ? priceStages[idx - 1] : null;
                    const mrcChange = prevStage && prevStage.mrc && stage.mrc ? stage.mrc - prevStage.mrc : null;
                    const nrcChange = prevStage && prevStage.nrc && stage.nrc ? stage.nrc - prevStage.nrc : null;
                    
                    return (
                      <TableRow key={stage.id} sx={idx === priceStages.length - 1 ? { backgroundColor: 'action.hover' } : {}}>
                        <TableCell>
                          <Chip label={stage.stage_name} size="small" variant="outlined" color={
                            stage.stage_name === 'Best and Final' ? 'success' :
                            stage.stage_name === 'Discounted' ? 'info' :
                            stage.stage_name === 'Counter Offer' ? 'warning' :
                            stage.stage_name === 'Accepted' ? 'success' :
                            stage.stage_name === 'Rejected' ? 'error' : 'default'
                          } />
                        </TableCell>
                        <TableCell>{formatDate(stage.stage_date)}</TableCell>
                        <TableCell align="right">
                          {stage.mrc != null ? stage.mrc.toLocaleString() : '-'}
                          {mrcChange != null && mrcChange !== 0 && (
                            <Typography variant="caption" component="span" sx={{ ml: 0.5, color: mrcChange < 0 ? 'success.main' : 'error.main' }}>
                              ({mrcChange > 0 ? '+' : ''}{mrcChange.toLocaleString()})
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {stage.nrc != null ? stage.nrc.toLocaleString() : '-'}
                          {nrcChange != null && nrcChange !== 0 && (
                            <Typography variant="caption" component="span" sx={{ ml: 0.5, color: nrcChange < 0 ? 'success.main' : 'error.main' }}>
                              ({nrcChange > 0 ? '+' : ''}{nrcChange.toLocaleString()})
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{stage.currency}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {stage.notes || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{stage.created_by_name || stage.created_by_username || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => handleDeletePriceStage(stage.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {priceStages.length > 1 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <TrendingDownIcon fontSize="small" color="success" />
                <Typography variant="caption" color="text.secondary">
                  {(() => {
                    const first = priceStages[0];
                    const last = priceStages[priceStages.length - 1];
                    if (first.mrc && last.mrc) {
                      const pctChange = ((last.mrc - first.mrc) / first.mrc * 100).toFixed(1);
                      return `MRC: ${first.mrc.toLocaleString()} → ${last.mrc.toLocaleString()} (${pctChange > 0 ? '+' : ''}${pctChange}%)`;
                    }
                    return 'Price change tracking from initial to latest stage';
                  })()}
                </Typography>
              </Box>
            )}
          </>
        )}
        
        {isEditMode && priceStages.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            No price stages recorded yet. Click "Add Price Stage" to track negotiation steps.
          </Typography>
        )}
      </Paper>

      {/* Section 9: Attachments */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Attachments</Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            Add Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".kmz,.kml,.pdf,.eml,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.msg,.txt,.csv"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </Box>
        {uploadFiles.length > 0 ? (
          <List dense>
            {uploadFiles.map((file, idx) => (
              <ListItem key={idx}>
                <ListItemIcon><InsertDriveFileIcon /></ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={`${(file.size / 1024).toFixed(1)} KB`}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" size="small" onClick={() => removeUploadFile(idx)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary">No files attached yet. Upload KMZ, PDF, documents, or images.</Typography>
        )}
      </Paper>

      {/* Action Buttons */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={onNavigateBack} variant="outlined">
            Cancel
          </Button>
          <Button
            variant="contained"
            size="large"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving...' : isEditMode ? 'Update Quote' : 'Create Quote'}
          </Button>
        </Box>
      </Paper>

      {/* Add Price Stage Dialog */}
      <Dialog open={priceStageDialogOpen} onClose={() => setPriceStageDialogOpen(false)} maxWidth="sm" fullWidth disableRestoreFocus>
        <DialogTitle>Add Price Stage</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <Autocomplete
                freeSolo
                size="small"
                options={PRICE_STAGE_PRESETS}
                value={newPriceStage.stage_name}
                onInputChange={(_, value) => setNewPriceStage(prev => ({ ...prev, stage_name: value }))}
                onChange={(_, value) => setNewPriceStage(prev => ({ ...prev, stage_name: value || '' }))}
                renderInput={(params) => (
                  <TextField {...params} label="Stage Name *" helperText="Select or type a custom stage name" />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Stage Date"
                value={newPriceStage.stage_date}
                onChange={(e) => setNewPriceStage(prev => ({ ...prev, stage_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="MRC"
                type="number"
                value={newPriceStage.mrc}
                onChange={(e) => setNewPriceStage(prev => ({ ...prev, mrc: e.target.value }))}
                InputProps={{ startAdornment: <InputAdornment position="start">{newPriceStage.currency || formData.currency}</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="NRC"
                type="number"
                value={newPriceStage.nrc}
                onChange={(e) => setNewPriceStage(prev => ({ ...prev, nrc: e.target.value }))}
                InputProps={{ startAdornment: <InputAdornment position="start">{newPriceStage.currency || formData.currency}</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Currency</InputLabel>
                <Select
                  value={newPriceStage.currency || formData.currency || 'USD'}
                  onChange={(e) => setNewPriceStage(prev => ({ ...prev, currency: e.target.value }))}
                  label="Currency"
                >
                  {currencies.map(c => <MenuItem key={c.currency_code} value={c.currency_code}>{c.currency_code}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Notes"
                multiline
                minRows={2}
                maxRows={4}
                value={newPriceStage.notes}
                onChange={(e) => setNewPriceStage(prev => ({ ...prev, notes: e.target.value }))}
                helperText="Optional notes about this price change (e.g., reason for discount)"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPriceStageDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddPriceStage} startIcon={<AddIcon />}>Add Stage</Button>
        </DialogActions>
      </Dialog>

      {/* Custom Location Dialog */}
      <Dialog open={customLocDialogOpen} onClose={() => setCustomLocDialogOpen(false)} maxWidth="sm" fullWidth disableRestoreFocus>
        <DialogTitle>Add Custom Location (Location {customLocTarget.toUpperCase()})</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Location Name *"
                value={newCustomLoc.location_name}
                onChange={(e) => setNewCustomLoc(prev => ({ ...prev, location_name: e.target.value }))}
                helperText="e.g., Equinix CH3, ABCLON1, etc."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Address"
                value={newCustomLoc.address}
                onChange={(e) => setNewCustomLoc(prev => ({ ...prev, address: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="City"
                value={newCustomLoc.city}
                onChange={(e) => setNewCustomLoc(prev => ({ ...prev, city: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Country"
                value={newCustomLoc.country}
                onChange={(e) => setNewCustomLoc(prev => ({ ...prev, country: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomLocDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateCustomLocation}>Create Location</Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>
      </Snackbar>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
      </Snackbar>
    </Box>
  );
};

export default AddCarrierQuote;
