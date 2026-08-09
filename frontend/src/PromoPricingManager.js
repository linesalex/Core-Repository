import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Alert,
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  InputAdornment,
  IconButton,
  Autocomplete,
  FormControl,
  InputLabel,
  OutlinedInput
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  LocalOffer as LocalOfferIcon,
  AttachMoney as AttachMoneyIcon,
  Route as RouteIcon,
  Warning as WarningIcon,
  Block as BlockIcon
} from '@mui/icons-material';
import { api, locationDataApi, networkDesignApi } from './api';
import { API_BASE_URL } from './config';

const PromoPricingManager = ({ hasPermission }) => {
  const [promoRules, setPromoRules] = useState([]);
  const [locations, setLocations] = useState([]);
  const [circuitIds, setCircuitIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [sameCityWarning, setSameCityWarning] = useState({ source: '', destination: '' });
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    rule_name: '',
    source_locations: [],
    destination_locations: [],
    price_under_100mb: '',
    price_100_to_999mb: '',
    price_1000_to_2999mb: '',
    price_3000mb_plus: '',
    required_circuit_ids: [],
    excluded_circuit_ids: []
  });

  // Load data on component mount
  useEffect(() => {
    loadPromoRules();
    loadLocations();
    // Don't pre-load circuit IDs - will be loaded on search
  }, []);

  const loadPromoRules = async () => {
    try {
      setLoading(true);
      const response = await api.get(`${API_BASE_URL}/promo-pricing`, {
        params: { search: searchQuery }
      });
      setPromoRules(response.data.data || []);
    } catch (err) {
      setError('Failed to load promo pricing rules: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      const data = await locationDataApi.getLocations();
      setLocations(data || []);
    } catch (err) {
      console.error('Failed to load locations:', err);
    }
  };

  const loadCircuitIds = async (search = '') => {
    try {
      const data = await networkDesignApi.getCircuitIds(search);
      // Handle both array format and object format with circuit_ids property
      setCircuitIds(Array.isArray(data) ? data : (data.circuit_ids || data || []));
    } catch (err) {
      console.error('Failed to load circuit IDs:', err);
      setCircuitIds([]);
    }
  };

  // Helper function to format circuit option label for display (UCN - Cable System)
  const getCircuitOptionLabel = (option) => {
    if (!option) return '';
    if (typeof option === 'string') {
      // Handle string format (for backward compatibility or manual entry)
      return option;
    }
    // Object format: {circuit_id, cable_system}
    if (option.cable_system) {
      return `${option.circuit_id} - ${option.cable_system}`;
    }
    return option.circuit_id || '';
  };

  // Helper function to extract circuit_id from option (for value storage)
  const getCircuitId = (option) => {
    if (!option) return '';
    if (typeof option === 'string') return option;
    return option.circuit_id || '';
  };

  // Helper function to check if locations are in the same city
  const checkSameCity = (selectedLocations, locationType) => {
    if (!selectedLocations || selectedLocations.length <= 1) {
      return '';
    }
    
    const cities = new Set();
    selectedLocations.forEach(locCode => {
      const loc = locations.find(l => l.location_code === locCode);
      if (loc && loc.city) {
        cities.add(loc.city);
      }
    });
    
    if (cities.size > 1) {
      return `Warning: ${locationType} locations span multiple cities (${Array.from(cities).join(', ')}). All ${locationType.toLowerCase()} locations must be in the same city.`;
    }
    return '';
  };

  // Helper function to check for circuits listed in both required and excluded lists
  // (excluded always wins, so overlapping entries are almost certainly a config mistake)
  const getCircuitOverlapWarning = () => {
    const required = formData.required_circuit_ids || [];
    const excluded = formData.excluded_circuit_ids || [];
    const overlap = required.filter(c => excluded.includes(c));
    if (overlap.length === 0) return '';
    return `Warning: ${overlap.join(', ')} ${overlap.length > 1 ? 'are' : 'is'} listed as both required and excluded. Excluded circuits always take precedence, so this promo can never apply via ${overlap.length > 1 ? 'those circuits' : 'that circuit'}.`;
  };

  // Update same-city warnings when locations change
  // Note: Only source locations must be in the same city. Destinations can span multiple cities.
  useEffect(() => {
    if (dialogOpen) {
      setSameCityWarning({
        source: checkSameCity(formData.source_locations, 'Source'),
        destination: '' // Destinations can span multiple cities - no validation needed
      });
    }
  }, [formData.source_locations, formData.destination_locations, dialogOpen, locations]);

  // Helper function to create enhanced options with city code grouping
  const createLocationOptions = () => {
    const locationCodes = locations.map(loc => loc.location_code);
    const cityGroups = {};
    
    // Group locations by city code pattern
    locationCodes.forEach(code => {
      // Extract base city code (remove trailing digits/suffixes)
      const baseCode = code.match(/^[A-Z]+/)?.[0];
      if (baseCode && baseCode !== code) {
        if (!cityGroups[baseCode]) {
          cityGroups[baseCode] = [];
        }
        cityGroups[baseCode].push(code);
      }
    });
    
    // Create options array with individual locations and city groups
    const options = [...locationCodes];
    
    // Add city group options for groups with more than one location
    Object.entries(cityGroups).forEach(([baseCode, codes]) => {
      if (codes.length > 1) {
        options.unshift(`${baseCode} (All ${codes.length} locations)`);
      }
    });
    
    return { options, cityGroups };
  };

  const handleSearch = () => {
    loadPromoRules();
  };

  const clearSearch = () => {
    setSearchQuery('');
    setTimeout(() => loadPromoRules(), 100);
  };

  const openDialog = (rule = null) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        rule_name: rule.rule_name,
        source_locations: rule.source_locations || [],
        destination_locations: rule.destination_locations || [],
        price_under_100mb: rule.price_under_100mb || '',
        price_100_to_999mb: rule.price_100_to_999mb || '',
        price_1000_to_2999mb: rule.price_1000_to_2999mb || '',
        price_3000mb_plus: rule.price_3000mb_plus || '',
        required_circuit_ids: rule.required_circuit_ids || [],
        excluded_circuit_ids: rule.excluded_circuit_ids || []
      });
    } else {
      setEditingRule(null);
      setFormData({
        rule_name: '',
        source_locations: [],
        destination_locations: [],
        price_under_100mb: '',
        price_100_to_999mb: '',
        price_1000_to_2999mb: '',
        price_3000mb_plus: '',
        required_circuit_ids: [],
        excluded_circuit_ids: []
      });
    }
    setSameCityWarning({ source: '', destination: '' });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
    setError('');
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      // Validate form
      if (!formData.rule_name.trim()) {
        throw new Error('Rule name is required');
      }
      if (!formData.source_locations || formData.source_locations.length === 0) {
        throw new Error('At least one source location is required');
      }
      if (!formData.destination_locations || formData.destination_locations.length === 0) {
        throw new Error('At least one destination location is required');
      }

      const submitData = {
        rule_name: formData.rule_name.trim(),
        source_locations: formData.source_locations,
        destination_locations: formData.destination_locations,
        price_under_100mb: parseFloat(formData.price_under_100mb) || 0,
        price_100_to_999mb: parseFloat(formData.price_100_to_999mb) || 0,
        price_1000_to_2999mb: parseFloat(formData.price_1000_to_2999mb) || 0,
        price_3000mb_plus: parseFloat(formData.price_3000mb_plus) || 0,
        required_circuit_ids: formData.required_circuit_ids || [],
        excluded_circuit_ids: formData.excluded_circuit_ids || []
      };

      if (editingRule) {
        await api.put(`${API_BASE_URL}/promo-pricing/${editingRule.id}`, submitData);
        setSuccess('Promo pricing rule updated successfully');
      } else {
        await api.post(`${API_BASE_URL}/promo-pricing`, submitData);
        setSuccess('Promo pricing rule created successfully');
      }

      closeDialog();
      loadPromoRules();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId, ruleName) => {
    if (!window.confirm(`Are you sure you want to delete the promo pricing rule "${ruleName}"?`)) {
      return;
    }

    try {
      await api.delete(`${API_BASE_URL}/promo-pricing/${ruleId}`);
      setSuccess('Promo pricing rule deleted successfully');
      loadPromoRules();
    } catch (err) {
      setError('Failed to delete promo pricing rule: ' + (err.response?.data?.error || err.message));
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredRules = promoRules.filter(rule => {
    const searchLower = searchQuery.toLowerCase();
    return rule.rule_name.toLowerCase().includes(searchLower) ||
           (rule.source_locations && rule.source_locations.some(loc => loc.toLowerCase().includes(searchLower))) ||
           (rule.destination_locations && rule.destination_locations.some(loc => loc.toLowerCase().includes(searchLower)));
  });

  if (!hasPermission('administrator')) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          <Typography variant="h6">Access Denied</Typography>
          Promo pricing management is restricted to administrators only.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <LocalOfferIcon color="primary" sx={{ fontSize: 32 }} />
          <Box flex={1}>
            <Typography variant="h4" component="h1" gutterBottom>
              Promo Pricing Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage promotional pricing rules that override standard pricing calculations. 
              Promo pricing is checked first and applies to both primary and secondary routes if margin requirements are met.
            </Typography>
          </Box>
        </Box>

        {/* Success/Error Messages */}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Search and Actions */}
        <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Search rules and locations...</InputLabel>
              <OutlinedInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                endAdornment={
                  <Box display="flex" gap={1}>
                    {searchQuery && (
                      <IconButton size="small" onClick={clearSearch}>
                        <ClearIcon />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={handleSearch}>
                      <SearchIcon />
                    </IconButton>
                  </Box>
                }
                label="Search rules and locations..."
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box display="flex" gap={2} justifyContent="flex-end">
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => openDialog()}
                disabled={!hasPermission('administrator')}
              >
                Add Promo Rule
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Rules Table */}
        <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Source Locations</strong></TableCell>
                <TableCell><strong>Destination Locations</strong></TableCell>
                <TableCell><strong>&lt; 100Mb (USD)</strong></TableCell>
                <TableCell><strong>100-999Mb (USD)</strong></TableCell>
                <TableCell><strong>1000-2999Mb (USD)</strong></TableCell>
                <TableCell><strong>3000Mb+ (USD)</strong></TableCell>
                <TableCell><strong>Required Circuits</strong></TableCell>
                <TableCell><strong>Excluded Circuits</strong></TableCell>
                <TableCell><strong>Created</strong></TableCell>
                <TableCell><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">Loading...</TableCell>
                </TableRow>
              ) : filteredRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    {searchQuery ? 'No promo rules found matching your search' : 'No promo pricing rules configured'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRules.map((rule) => (
                  <TableRow key={rule.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {rule.rule_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {(rule.source_locations || []).map((location, index) => (
                          <Chip 
                            key={index} 
                            label={location} 
                            size="small" 
                            variant="outlined"
                            color="primary"
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {(rule.destination_locations || []).map((location, index) => (
                          <Chip 
                            key={index} 
                            label={location} 
                            size="small" 
                            variant="outlined"
                            color="secondary"
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>{formatCurrency(rule.price_under_100mb)}</TableCell>
                    <TableCell>{formatCurrency(rule.price_100_to_999mb)}</TableCell>
                    <TableCell>{formatCurrency(rule.price_1000_to_2999mb)}</TableCell>
                    <TableCell>{formatCurrency(rule.price_3000mb_plus)}</TableCell>
                    <TableCell>
                      {rule.required_circuit_ids && rule.required_circuit_ids.length > 0 ? (
                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                          {rule.required_circuit_ids.slice(0, 3).map((circuitId, index) => (
                            <Chip 
                              key={index} 
                              label={circuitId} 
                              size="small" 
                              variant="outlined"
                              color="warning"
                              icon={<RouteIcon />}
                            />
                          ))}
                          {rule.required_circuit_ids.length > 3 && (
                            <Chip 
                              label={`+${rule.required_circuit_ids.length - 3} more`} 
                              size="small" 
                              variant="outlined"
                            />
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">Any route</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {rule.excluded_circuit_ids && rule.excluded_circuit_ids.length > 0 ? (
                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                          {rule.excluded_circuit_ids.slice(0, 3).map((circuitId, index) => (
                            <Chip 
                              key={index} 
                              label={circuitId} 
                              size="small" 
                              variant="outlined"
                              color="error"
                              icon={<BlockIcon />}
                            />
                          ))}
                          {rule.excluded_circuit_ids.length > 3 && (
                            <Chip 
                              label={`+${rule.excluded_circuit_ids.length - 3} more`} 
                              size="small" 
                              variant="outlined"
                            />
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">None</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(rule.created_at)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        by {rule.created_by_username}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <IconButton
                          size="small"
                          onClick={() => openDialog(rule)}
                          disabled={!hasPermission('administrator')}
                          title="Edit"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(rule.id, rule.rule_name)}
                          disabled={!hasPermission('administrator')}
                          title="Delete"
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Statistics */}
        <Box mt={3}>
          <Card sx={{ bgcolor: 'primary.50', border: 1, borderColor: 'primary.200' }}>
            <CardContent>
              <Typography variant="h6" color="primary" gutterBottom>
                Quick Stats
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Total Rules: <strong>{promoRules.length}</strong>
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Matching Search: <strong>{filteredRules.length}</strong>
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Promo pricing is checked first in calculations and applies to both primary and secondary routes if margin requirements are met.
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={closeDialog} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { minHeight: '600px' } }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <LocalOfferIcon color="primary" />
            <Typography variant="h6">
              {editingRule ? 'Edit Promo Pricing Rule' : 'Add New Promo Pricing Rule'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Rule Name */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Rule Name"
                value={formData.rule_name}
                onChange={(e) => handleFormChange('rule_name', e.target.value)}
                placeholder="e.g., Q1 2025 Asia-Pacific Promo"
                helperText="Descriptive name for this promo pricing rule"
                required
              />
            </Grid>

            {/* Source Locations */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                multiple
                options={createLocationOptions().options}
                value={formData.source_locations}
                onChange={(event, newValue, reason, details) => {
                  if (reason === 'selectOption' && details?.option) {
                    const selectedOption = details.option;
                    const { cityGroups } = createLocationOptions();
                    
                    // Check if this is a city group option
                    const cityGroupMatch = selectedOption.match(/^([A-Z]+) \(All \d+ locations\)$/);
                    if (cityGroupMatch) {
                      const baseCode = cityGroupMatch[1];
                      const locationsToAdd = cityGroups[baseCode] || [];
                      const currentValues = formData.source_locations || [];
                      const uniqueValues = [...new Set([...currentValues, ...locationsToAdd])];
                      handleFormChange('source_locations', uniqueValues);
                    } else {
                      // Regular single location selection
                      handleFormChange('source_locations', newValue);
                    }
                  } else {
                    handleFormChange('source_locations', newValue);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Source Locations"
                    placeholder="Select source locations or city groups"
                    helperText="Select individual locations or city groups (e.g., 'IPCSNG (All X locations)')"
                    required
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props}>
                    {option.includes('(All') ? (
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          {option}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Adds all matching locations
                        </Typography>
                      </Box>
                    ) : (
                      option
                    )}
                  </li>
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                      color="primary"
                    />
                  ))
                }
              />
            </Grid>

            {/* Destination Locations */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                multiple
                options={createLocationOptions().options}
                value={formData.destination_locations}
                onChange={(event, newValue, reason, details) => {
                  if (reason === 'selectOption' && details?.option) {
                    const selectedOption = details.option;
                    const { cityGroups } = createLocationOptions();
                    
                    // Check if this is a city group option
                    const cityGroupMatch = selectedOption.match(/^([A-Z]+) \(All \d+ locations\)$/);
                    if (cityGroupMatch) {
                      const baseCode = cityGroupMatch[1];
                      const locationsToAdd = cityGroups[baseCode] || [];
                      const currentValues = formData.destination_locations || [];
                      const uniqueValues = [...new Set([...currentValues, ...locationsToAdd])];
                      handleFormChange('destination_locations', uniqueValues);
                    } else {
                      // Regular single location selection
                      handleFormChange('destination_locations', newValue);
                    }
                  } else {
                    handleFormChange('destination_locations', newValue);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Destination Locations"
                    placeholder="Select destination locations or city groups"
                    helperText="Select individual locations or city groups (e.g., 'IPCSNG (All X locations)')"
                    required
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props}>
                    {option.includes('(All') ? (
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>
                          {option}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Adds all matching locations
                        </Typography>
                      </Box>
                    ) : (
                      option
                    )}
                  </li>
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                      color="secondary"
                    />
                  ))
                }
              />
            </Grid>

            {/* Same-city validation warnings */}
            {(sameCityWarning.source || sameCityWarning.destination) && (
              <Grid item xs={12}>
                {sameCityWarning.source && (
                  <Alert severity="warning" sx={{ mb: 1 }} icon={<WarningIcon />}>
                    {sameCityWarning.source}
                  </Alert>
                )}
                {sameCityWarning.destination && (
                  <Alert severity="warning" icon={<WarningIcon />}>
                    {sameCityWarning.destination}
                  </Alert>
                )}
              </Grid>
            )}

            {/* Required Circuit IDs */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                <RouteIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                Required Circuit IDs (Optional)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                If specified, this promo will only apply when the route includes at least ONE of these circuit IDs.
                Leave empty to apply to any route between the source and destination locations.
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={circuitIds}
                getOptionLabel={getCircuitOptionLabel}
                value={formData.required_circuit_ids}
                onChange={(event, newValue) => {
                  // Store circuit IDs as strings
                  const circuitIdStrings = newValue.map(item => getCircuitId(item));
                  handleFormChange('required_circuit_ids', circuitIdStrings);
                }}
                onInputChange={(event, inputValue) => {
                  // Only fetch circuit IDs when user starts typing
                  if (inputValue && inputValue.length >= 2) {
                    loadCircuitIds(inputValue);
                  } else if (!inputValue) {
                    // Clear options when input is cleared
                    setCircuitIds([]);
                  }
                }}
                isOptionEqualToValue={(option, value) => {
                  // Compare circuit IDs
                  const optionId = getCircuitId(option);
                  const valueId = typeof value === 'string' ? value : getCircuitId(value);
                  return optionId === valueId;
                }}
                noOptionsText="Type to search circuits or cable systems..."
                loadingText="Loading circuits..."
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Required Circuit IDs"
                    placeholder="Search by UCN or cable system..."
                    helperText="Type at least 2 characters to search circuits by UCN or Cable System name"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    const label = typeof option === 'string' ? option : getCircuitId(option);
                    return (
                      <Chip
                        key={key}
                        variant="outlined"
                        label={label}
                        {...tagProps}
                        color="warning"
                        icon={<RouteIcon />}
                      />
                    );
                  })
                }
              />
            </Grid>

            {/* Excluded Circuit IDs */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                <BlockIcon sx={{ verticalAlign: 'middle', mr: 1 }} color="error" />
                Excluded Circuit IDs (Optional)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                If specified, this promo will NOT apply when the route includes ANY of these circuit IDs.
                Exclusions always take precedence over required circuits. Leave empty to apply no exclusions.
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={circuitIds}
                getOptionLabel={getCircuitOptionLabel}
                value={formData.excluded_circuit_ids}
                onChange={(event, newValue) => {
                  // Store circuit IDs as strings
                  const circuitIdStrings = newValue.map(item => getCircuitId(item));
                  handleFormChange('excluded_circuit_ids', circuitIdStrings);
                }}
                onInputChange={(event, inputValue) => {
                  // Only fetch circuit IDs when user starts typing
                  if (inputValue && inputValue.length >= 2) {
                    loadCircuitIds(inputValue);
                  } else if (!inputValue) {
                    // Clear options when input is cleared
                    setCircuitIds([]);
                  }
                }}
                isOptionEqualToValue={(option, value) => {
                  // Compare circuit IDs
                  const optionId = getCircuitId(option);
                  const valueId = typeof value === 'string' ? value : getCircuitId(value);
                  return optionId === valueId;
                }}
                noOptionsText="Type to search circuits or cable systems..."
                loadingText="Loading circuits..."
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Excluded Circuit IDs"
                    placeholder="Search by UCN or cable system..."
                    helperText="Type at least 2 characters to search circuits by UCN or Cable System name"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    const label = typeof option === 'string' ? option : getCircuitId(option);
                    return (
                      <Chip
                        key={key}
                        variant="outlined"
                        label={label}
                        {...tagProps}
                        color="error"
                        icon={<BlockIcon />}
                      />
                    );
                  })
                }
              />
            </Grid>

            {/* Required/Excluded circuit overlap warning */}
            {getCircuitOverlapWarning() && (
              <Grid item xs={12}>
                <Alert severity="warning" icon={<WarningIcon />}>
                  {getCircuitOverlapWarning()}
                </Alert>
              </Grid>
            )}

            {/* Pricing Tiers */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                <AttachMoneyIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                Pricing by Bandwidth Tier (USD)
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="< 100 Mbps"
                type="number"
                value={formData.price_under_100mb}
                onChange={(e) => handleFormChange('price_under_100mb', e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
                inputProps={{ min: 0, step: 1 }}
                helperText="Price for bandwidth under 100 Mbps"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="100-999 Mbps"
                type="number"
                value={formData.price_100_to_999mb}
                onChange={(e) => handleFormChange('price_100_to_999mb', e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
                inputProps={{ min: 0, step: 1 }}
                helperText="Price for bandwidth 100-999 Mbps"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="1000-2999 Mbps"
                type="number"
                value={formData.price_1000_to_2999mb}
                onChange={(e) => handleFormChange('price_1000_to_2999mb', e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
                inputProps={{ min: 0, step: 1 }}
                helperText="Price for bandwidth 1000-2999 Mbps"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="3000+ Mbps"
                type="number"
                value={formData.price_3000mb_plus}
                onChange={(e) => handleFormChange('price_3000mb_plus', e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
                inputProps={{ min: 0, step: 1 }}
                helperText="Price for bandwidth 3000+ Mbps"
              />
            </Grid>
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={closeDialog}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : (editingRule ? 'Update Rule' : 'Create Rule')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PromoPricingManager; 