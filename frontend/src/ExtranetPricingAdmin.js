import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  Alert, Snackbar, Tooltip, Grid, FormControl, InputLabel, Select, MenuItem, Tabs, Tab,
  Card, CardContent, Chip, Autocomplete, CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import { API_BASE_URL } from './config';
import axios from 'axios';
import LoadingIndicator from './components/LoadingIndicator';

const ExtranetPricingAdmin = ({ hasPermission }) => {
  // Data states
  const [rateCard, setRateCard] = useState([]);
  const [cities, setCities] = useState([]);
  const [editedPrices, setEditedPrices] = useState({});
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);
  
  // Dialog states
  const [cityDialogOpen, setCityDialogOpen] = useState(false);
  const [cityDialogMode, setCityDialogMode] = useState('add');
  const [selectedCity, setSelectedCity] = useState(null);
  const [deleteCityDialogOpen, setDeleteCityDialogOpen] = useState(false);
  
  // CSV import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef(null);
  
  // Form data
  const [cityFormData, setCityFormData] = useState({
    city_name: '',
    country: '',
    region: 'AMERs',
    tier: 'Tier 1'
  });
  
  // Available cities from location_reference
  const [availableCities, setAvailableCities] = useState([]);
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const [selectedCityOption, setSelectedCityOption] = useState(null);

  const regions = ['AMERs', 'APAC', 'EMEA'];
  const tiers = ['Metro', 'Tier 1', 'Tier 2', 'Tier 3'];
  const bandwidths = ['64Kb', '128Kb', '256Kb', '512Kb', '1Mb', '1.5Mb', '2Mb', '3Mb', '4Mb', '5Mb', '6Mb', '8Mb', '10Mb', '20Mb', '50Mb', '100Mb'];

  // Load data on mount
  useEffect(() => {
    loadRateCard();
    loadCities();
  }, []);

  const loadRateCard = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/extranet-pricing/rate-card`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setRateCard(response.data);
      setEditedPrices({});
    } catch (err) {
      setError('Failed to load rate card: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCities = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/extranet-pricing/cities`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setCities(response.data);
    } catch (err) {
      setError('Failed to load cities: ' + err.message);
    }
  };

  const searchAvailableCities = async (searchText) => {
    if (!searchText || searchText.length < 2) {
      setAvailableCities([]);
      return;
    }
    
    setCitySearchLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/extranet-pricing/available-cities`, {
        params: { search: searchText },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setAvailableCities(response.data);
    } catch (err) {
      console.error('Failed to search cities:', err);
    } finally {
      setCitySearchLoading(false);
    }
  };

  // Get price for a specific bandwidth/region/tier combination
  const getPrice = (bandwidth, region, tier) => {
    const key = `${bandwidth}-${region}-${tier}`;
    if (editedPrices[key] !== undefined) {
      return editedPrices[key];
    }
    const rate = rateCard.find(r => r.bandwidth === bandwidth && r.region === region && r.tier === tier);
    return rate ? rate.price_usd : 'POA';
  };

  // Get rate card entry ID
  const getRateId = (bandwidth, region, tier) => {
    const rate = rateCard.find(r => r.bandwidth === bandwidth && r.region === region && r.tier === tier);
    return rate ? rate.id : null;
  };

  // Handle price change (allows "POA" or numeric values)
  const handlePriceChange = (bandwidth, region, tier, value) => {
    const key = `${bandwidth}-${region}-${tier}`;
    // Allow "POA" as text or numeric values
    const upperValue = value.toUpperCase();
    if (upperValue === 'POA' || upperValue === 'P' || upperValue === 'PO') {
      setEditedPrices(prev => ({
        ...prev,
        [key]: upperValue === 'POA' ? 'POA' : upperValue
      }));
    } else {
      const numValue = value === '' ? '' : (parseFloat(value) || 0);
      setEditedPrices(prev => ({
        ...prev,
        [key]: numValue
      }));
    }
  };

  // Save all edited prices
  const handleSaveAllPrices = async () => {
    if (Object.keys(editedPrices).length === 0) {
      setError('No changes to save');
      return;
    }

    setSaving(true);
    try {
      const rates = Object.entries(editedPrices).map(([key, price]) => {
        const [bandwidth, region, tier] = key.split('-');
        // Store POA as string, numbers as numbers
        const priceValue = price === 'POA' ? 'POA' : (parseFloat(price) || 0);
        return { bandwidth, region, tier, price_usd: priceValue };
      });

      await axios.post(`${API_BASE_URL}/extranet-pricing/rate-card/bulk`, { rates }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      setSuccess('Rate card updated successfully');
      await loadRateCard();
    } catch (err) {
      setError('Failed to save rate card: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  // City handlers
  const handleAddCity = () => {
    setCityDialogMode('add');
    setSelectedCity(null);
    setCityFormData({
      city_name: '',
      country: '',
      region: 'AMERs',
      tier: 'Tier 1'
    });
    setSelectedCityOption(null);
    setAvailableCities([]);
    setCityDialogOpen(true);
  };

  const handleEditCity = (city) => {
    setCityDialogMode('edit');
    setSelectedCity(city);
    setCityFormData({
      city_name: city.city_name,
      country: city.country || '',
      region: city.region,
      tier: city.tier
    });
    // Set the selected option for editing
    if (city.city_name && city.country) {
      setSelectedCityOption({
        label: `${city.city_name}, ${city.country}`,
        city: city.city_name,
        country: city.country
      });
    } else {
      setSelectedCityOption(null);
    }
    setAvailableCities([]);
    setCityDialogOpen(true);
  };

  const handleDeleteCity = (city) => {
    setSelectedCity(city);
    setDeleteCityDialogOpen(true);
  };

  const handleCitySubmit = async () => {
    try {
      if (!cityFormData.city_name.trim()) {
        setError('City name is required');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      };

      if (cityDialogMode === 'add') {
        await axios.post(`${API_BASE_URL}/extranet-pricing/cities`, cityFormData, { headers });
        setSuccess('City added successfully');
      } else {
        await axios.put(`${API_BASE_URL}/extranet-pricing/cities/${selectedCity.id}`, cityFormData, { headers });
        setSuccess('City updated successfully');
      }

      setCityDialogOpen(false);
      await loadCities();
    } catch (err) {
      setError('Failed to save city: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleConfirmDeleteCity = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/extranet-pricing/cities/${selectedCity.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setSuccess('City deleted successfully');
      setDeleteCityDialogOpen(false);
      await loadCities();
    } catch (err) {
      setError('Failed to delete city: ' + (err.response?.data?.error || err.message));
    }
  };

  // CSV Import handlers
  const handleImportClick = () => {
    setImportDialogOpen(true);
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setError('CSV file must have a header row and at least one data row');
        return;
      }

      const header = lines[0].split(',').map(h => h.trim());
      const bandwidthIndex = header.findIndex(h => h.toLowerCase() === 'bandwidth');
      const regionIndex = header.findIndex(h => h.toLowerCase() === 'region');
      const tierIndex = header.findIndex(h => h.toLowerCase() === 'tier');
      const priceIndex = header.findIndex(h => h.toLowerCase().includes('price'));

      if (bandwidthIndex === -1 || regionIndex === -1 || tierIndex === -1 || priceIndex === -1) {
        setError('CSV must have columns: bandwidth, region, tier, price_usd');
        return;
      }

      const rates = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= 4) {
          const priceValue = values[priceIndex].toUpperCase();
          rates.push({
            bandwidth: values[bandwidthIndex],
            region: values[regionIndex],
            tier: values[tierIndex],
            price_usd: priceValue === 'POA' ? 'POA' : (parseFloat(values[priceIndex]) || 0)
          });
        }
      }

      if (rates.length === 0) {
        setError('No valid data rows found in CSV');
        return;
      }

      await axios.post(`${API_BASE_URL}/extranet-pricing/rate-card/bulk`, { rates }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      setSuccess(`Imported ${rates.length} rate card entries successfully`);
      setImportDialogOpen(false);
      await loadRateCard();
    } catch (err) {
      setError('Failed to import CSV: ' + (err.response?.data?.error || err.message));
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Export rate card to CSV
  const handleExportRateCard = () => {
    const csvHeader = 'bandwidth,region,tier,price_usd\n';
    const csvData = rateCard.map(r => `${r.bandwidth},${r.region},${r.tier},${r.price_usd}`).join('\n');
    
    const blob = new Blob([csvHeader + csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'extranet_rate_card.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  // Download CSV template
  const handleDownloadTemplate = () => {
    const csvHeader = 'bandwidth,region,tier,price_usd\n';
    const sampleData = '1Mb,APAC,Metro,500\n1Mb,APAC,Tier 1,600\n1Mb,APAC,Tier 2,700';
    
    const blob = new Blob([csvHeader + sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'extranet_rate_card_template.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const getTierChip = (tier) => {
    const colors = {
      'Metro': 'primary',
      'Tier 1': 'success',
      'Tier 2': 'warning',
      'Tier 3': 'error'
    };
    return <Chip label={tier} color={colors[tier] || 'default'} size="small" />;
  };

  const getRegionChip = (region) => {
    const colors = {
      'AMERs': 'primary',
      'APAC': 'success',
      'EMEA': 'secondary'
    };
    return <Chip label={region} color={colors[region] || 'default'} size="small" />;
  };

  // Group cities by region
  const citiesByRegion = cities.reduce((acc, city) => {
    if (!acc[city.region]) {
      acc[city.region] = { Metro: [], 'Tier 1': [], 'Tier 2': [], 'Tier 3': [] };
    }
    acc[city.region][city.tier].push(city);
    return acc;
  }, {});

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2">
          Extranet Pricing Admin
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => { loadRateCard(); loadCities(); }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
          <Tab label="Rate Card" />
          <Tab label="City Tiers" />
        </Tabs>
      </Box>

      {/* Rate Card Tab */}
      {currentTab === 0 && (
        <Box>
          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveAllPrices}
              disabled={Object.keys(editedPrices).length === 0 || saving}
            >
              {saving ? 'Saving...' : `Save Changes (${Object.keys(editedPrices).length})`}
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={handleImportClick}
            >
              Import CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportRateCard}
            >
              Export CSV
            </Button>
          </Box>

          {loading ? (
            <LoadingIndicator message="Loading rate card..." />
          ) : (
            <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', width: 70, position: 'sticky', left: 0, zIndex: 3, backgroundColor: '#fff' }}>Bandwidth</TableCell>
                    {regions.map(region => (
                      tiers.map(tier => (
                        <TableCell 
                          key={`${region}-${tier}`} 
                          align="center"
                          sx={{ 
                            fontWeight: 'bold', 
                            p: 0.5,
                            backgroundColor: region === 'AMERs' ? '#e3f2fd' : 
                                           region === 'APAC' ? '#e8f5e9' : '#f3e5f5'
                          }}
                        >
                          <Box sx={{ fontSize: '0.65rem' }}>{region}</Box>
                          <Box sx={{ fontSize: '0.6rem' }}>{tier}</Box>
                        </TableCell>
                      ))
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bandwidths.map(bandwidth => (
                    <TableRow key={bandwidth} hover>
                      <TableCell sx={{ fontWeight: 'bold', position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 1, fontSize: '0.75rem' }}>{bandwidth}</TableCell>
                      {regions.map(region => (
                        tiers.map(tier => {
                          const key = `${bandwidth}-${region}-${tier}`;
                          const isEdited = editedPrices[key] !== undefined;
                          const priceValue = getPrice(bandwidth, region, tier);
                          return (
                            <TableCell key={`${region}-${tier}`} align="center" sx={{ p: 0.25 }}>
                              <TextField
                                size="small"
                                type="text"
                                value={priceValue === 'POA' ? 'POA' : (priceValue || '')}
                                placeholder="POA"
                                onChange={(e) => handlePriceChange(bandwidth, region, tier, e.target.value)}
                                inputProps={{ 
                                  style: { 
                                    textAlign: 'center', 
                                    padding: '2px 4px',
                                    fontSize: '0.7rem'
                                  } 
                                }}
                                sx={{ 
                                  width: '100%',
                                  minWidth: 50,
                                  '& .MuiOutlinedInput-root': {
                                    backgroundColor: isEdited ? '#fff3e0' : (priceValue === 'POA' ? '#f5f5f5' : 'transparent')
                                  }
                                }}
                              />
                            </TableCell>
                          );
                        })
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            * All prices are in USD. Edited cells are highlighted in orange.
          </Typography>
        </Box>
      )}

      {/* City Tiers Tab */}
      {currentTab === 1 && (
        <Box>
          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddCity}
            >
              Add City
            </Button>
          </Box>

          {/* Cities by Region and Tier */}
          <Grid container spacing={2}>
            {regions.map(region => (
              <Grid item xs={12} md={4} key={region}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {getRegionChip(region)}
                    </Typography>
                    {tiers.map(tier => (
                      <Box key={tier} sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getTierChip(tier)}
                          <Typography variant="caption" color="text.secondary">
                            ({(citiesByRegion[region]?.[tier] || []).length} cities)
                          </Typography>
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(citiesByRegion[region]?.[tier] || []).map(city => (
                            <Chip
                              key={city.id}
                              label={city.country ? `${city.city_name}, ${city.country}` : city.city_name}
                              size="small"
                              onDelete={() => handleDeleteCity(city)}
                              onClick={() => handleEditCity(city)}
                              sx={{ cursor: 'pointer' }}
                            />
                          ))}
                          {(citiesByRegion[region]?.[tier] || []).length === 0 && (
                            <Typography variant="caption" color="text.secondary">
                              No cities assigned
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Full City List Table */}
          <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>All Cities</Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>City Name</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell>Region</TableCell>
                  <TableCell>Tier</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No cities configured. Click "Add City" to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  cities.map(city => (
                    <TableRow key={city.id} hover>
                      <TableCell>{city.city_name}</TableCell>
                      <TableCell>{city.country || '-'}</TableCell>
                      <TableCell>{getRegionChip(city.region)}</TableCell>
                      <TableCell>{getTierChip(city.tier)}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEditCity(city)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDeleteCity(city)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* City Dialog */}
      <Dialog open={cityDialogOpen} onClose={() => setCityDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {cityDialogMode === 'add' ? 'Add City' : 'Edit City'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                options={availableCities}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.city}
                value={selectedCityOption}
                loading={citySearchLoading}
                onChange={(event, newValue) => {
                  if (newValue && typeof newValue === 'object') {
                    setSelectedCityOption(newValue);
                    setCityFormData(prev => ({
                      ...prev,
                      city_name: newValue.city,
                      country: newValue.country
                    }));
                  } else if (typeof newValue === 'string') {
                    setCityFormData(prev => ({ ...prev, city_name: newValue }));
                    setSelectedCityOption(null);
                  } else {
                    setSelectedCityOption(null);
                    setCityFormData(prev => ({ ...prev, city_name: '', country: '' }));
                  }
                }}
                onInputChange={(event, newInputValue, reason) => {
                  if (reason === 'input') {
                    searchAvailableCities(newInputValue);
                    if (!selectedCityOption) {
                      setCityFormData(prev => ({ ...prev, city_name: newInputValue }));
                    }
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="City *"
                    placeholder="Search for a city"
                    helperText="Select from locations or type manually"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {citySearchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Country"
                value={cityFormData.country}
                onChange={(e) => setCityFormData(prev => ({ ...prev, country: e.target.value }))}
                placeholder="Auto-filled when city selected"
                helperText="Auto-filled from location or enter manually"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Region</InputLabel>
                <Select
                  value={cityFormData.region}
                  onChange={(e) => setCityFormData(prev => ({ ...prev, region: e.target.value }))}
                  label="Region"
                >
                  {regions.map(region => (
                    <MenuItem key={region} value={region}>{region}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Tier</InputLabel>
                <Select
                  value={cityFormData.tier}
                  onChange={(e) => setCityFormData(prev => ({ ...prev, tier: e.target.value }))}
                  label="Tier"
                >
                  {tiers.map(tier => (
                    <MenuItem key={tier} value={tier}>{tier}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCityDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCitySubmit} variant="contained">
            {cityDialogMode === 'add' ? 'Add' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete City Dialog */}
      <Dialog open={deleteCityDialogOpen} onClose={() => setDeleteCityDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedCity?.city_name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteCityDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDeleteCity} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import Rate Card from CSV</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Upload a CSV file with columns: <strong>bandwidth, region, tier, price_usd</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Valid bandwidths: {bandwidths.join(', ')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Valid regions: {regions.join(', ')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Valid tiers: {tiers.join(', ')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUploadIcon />}
            >
              Select CSV File
              <input
                type="file"
                hidden
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadTemplate}
            >
              Download Template
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ExtranetPricingAdmin;

