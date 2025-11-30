import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, Divider, Alert, CircularProgress, Autocomplete, Chip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { API_BASE_URL } from './config';
import axios from 'axios';

const ExtranetPricingTool = () => {
  // Form state
  const [formData, setFormData] = useState({
    city_name: '',
    bandwidth: '',
    provider_id: '',
    product_id: ''
  });

  // Data states
  const [cities, setCities] = useState([]);
  const [bandwidths, setBandwidths] = useState([]);
  const [providers, setProviders] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Derived state
  const [selectedCity, setSelectedCity] = useState(null);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load providers when city region changes
  useEffect(() => {
    if (selectedCity?.region) {
      loadProviders(selectedCity.region);
    } else {
      setProviders([]);
      setFormData(prev => ({ ...prev, provider_id: '', product_id: '' }));
    }
  }, [selectedCity]);

  // Load products when provider changes
  useEffect(() => {
    if (formData.provider_id) {
      loadProducts(formData.provider_id);
    } else {
      setProducts([]);
      setFormData(prev => ({ ...prev, product_id: '' }));
    }
  }, [formData.provider_id]);

  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      
      // Load cities and bandwidths in parallel
      const [citiesRes, bandwidthsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/extranet-pricing/cities`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }),
        axios.get(`${API_BASE_URL}/extranet-pricing/bandwidths`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        })
      ]);
      
      setCities(citiesRes.data);
      setBandwidths(bandwidthsRes.data);
    } catch (err) {
      setError('Failed to load initial data: ' + err.message);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadProviders = async (region) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/extranet-pricing/providers/${region}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      setProviders(response.data);
    } catch (err) {
      console.error('Failed to load providers:', err);
      setProviders([]);
    }
  };

  const loadProducts = async (providerId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/extranet-pricing/products/${providerId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      setProducts(response.data);
    } catch (err) {
      console.error('Failed to load products:', err);
      setProducts([]);
    }
  };

  const handleCityChange = (event, newValue) => {
    setSelectedCity(newValue);
    setFormData(prev => ({
      ...prev,
      city_name: newValue?.city_name || '',
      provider_id: '',
      product_id: ''
    }));
    setResult(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setResult(null);
  };

  const handleLookup = async () => {
    if (!formData.city_name || !formData.bandwidth) {
      setError('Please select a city and bandwidth');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const params = new URLSearchParams({
        city_name: formData.city_name,
        bandwidth: formData.bandwidth
      });
      
      if (formData.provider_id) {
        params.append('provider_id', formData.provider_id);
      }
      if (formData.product_id) {
        params.append('product_id', formData.product_id);
      }

      const response = await axios.get(`${API_BASE_URL}/extranet-pricing/lookup?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });

      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to look up price');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFormData({
      city_name: '',
      bandwidth: '',
      provider_id: '',
      product_id: ''
    });
    setSelectedCity(null);
    setResult(null);
    setError('');
    setProviders([]);
    setProducts([]);
  };

  const getTierColor = (tier) => {
    const colors = {
      'Metro': 'primary',
      'Tier 1': 'success',
      'Tier 2': 'warning',
      'Tier 3': 'error'
    };
    return colors[tier] || 'default';
  };

  const getRegionColor = (region) => {
    const colors = {
      'AMERs': 'primary',
      'APAC': 'success',
      'EMEA': 'secondary'
    };
    return colors[region] || 'default';
  };

  if (initialLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Extranet Pricing Lookup
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Look up extranet connectivity pricing based on member location, bandwidth, and provider.
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          {/* City Selection */}
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={cities}
              getOptionLabel={(option) => `${option.city_name} (${option.region} - ${option.tier})`}
              value={selectedCity}
              onChange={handleCityChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Member City *"
                  placeholder="Select a city..."
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Typography>{option.city_name}</Typography>
                    <Chip label={option.region} size="small" color={getRegionColor(option.region)} />
                    <Chip label={option.tier} size="small" color={getTierColor(option.tier)} />
                  </Box>
                </li>
              )}
            />
            {selectedCity && (
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                <Chip label={selectedCity.region} size="small" color={getRegionColor(selectedCity.region)} />
                <Chip label={selectedCity.tier} size="small" color={getTierColor(selectedCity.tier)} />
              </Box>
            )}
          </Grid>

          {/* Bandwidth Selection */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Bandwidth *</InputLabel>
              <Select
                value={formData.bandwidth}
                onChange={(e) => handleInputChange('bandwidth', e.target.value)}
                label="Bandwidth *"
              >
                {bandwidths.map(bw => (
                  <MenuItem key={bw} value={bw}>{bw}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Provider Selection (filtered by region) */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth disabled={!selectedCity}>
              <InputLabel>Extranet Provider (Optional)</InputLabel>
              <Select
                value={formData.provider_id}
                onChange={(e) => handleInputChange('provider_id', e.target.value)}
                label="Extranet Provider (Optional)"
              >
                <MenuItem value="">-- Select Provider --</MenuItem>
                {providers.map(provider => (
                  <MenuItem key={provider.id} value={provider.id}>{provider.provider_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {!selectedCity && (
              <Typography variant="caption" color="text.secondary">
                Select a city first to filter providers by region
              </Typography>
            )}
          </Grid>

          {/* Product Selection */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth disabled={!formData.provider_id}>
              <InputLabel>Product (Optional)</InputLabel>
              <Select
                value={formData.product_id}
                onChange={(e) => handleInputChange('product_id', e.target.value)}
                label="Product (Optional)"
              >
                <MenuItem value="">-- Select Product --</MenuItem>
                {products.map(product => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.product_name}
                    {product.suggested_bandwidth && ` (${product.suggested_bandwidth})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {!formData.provider_id && (
              <Typography variant="caption" color="text.secondary">
                Select a provider first to see available products
              </Typography>
            )}
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                onClick={handleLookup}
                disabled={loading || !formData.city_name || !formData.bandwidth}
              >
                {loading ? 'Looking up...' : 'Look Up Price'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleClear}
              >
                Clear
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Result Display */}
      {result && (
        <Card sx={{ backgroundColor: '#f5f5f5' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AttachMoneyIcon color="success" />
              Pricing Result
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Member City</Typography>
                <Typography variant="body1" fontWeight="bold">{result.city_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Region</Typography>
                <Chip label={result.region} color={getRegionColor(result.region)} size="small" />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">Tier</Typography>
                <Chip label={result.tier} color={getTierColor(result.tier)} size="small" />
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Bandwidth</Typography>
                <Typography variant="body1" fontWeight="bold">{result.bandwidth}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Price (USD)</Typography>
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  ${result.price_usd.toLocaleString()}
                </Typography>
              </Grid>

              {result.provider_name && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Provider</Typography>
                    <Typography variant="body1">{result.provider_name}</Typography>
                  </Grid>
                  {result.product_name && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">Product</Typography>
                      <Typography variant="body1">{result.product_name}</Typography>
                    </Grid>
                  )}
                </>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
        * Pricing is based on member location tier. Provider and product selections are optional and for tracking purposes.
      </Typography>
    </Box>
  );
};

export default ExtranetPricingTool;

