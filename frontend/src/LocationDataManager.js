import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip,
  Alert, Snackbar, Tooltip, Grid, Card, CardContent, Select, MenuItem, FormControl, InputLabel,
  List, ListItem, ListItemText, ListItemIcon, Checkbox, FormControlLabel, Tabs, Tab
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import InfoIcon from '@mui/icons-material/Info';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { locationDataApi } from './api';

const LocationDataManager = ({ hasPermission }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Tab state
  const [currentTab, setCurrentTab] = useState(0); // 0: Locations, 1: Minimum Pricing
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accessInfoDialogOpen, setAccessInfoDialogOpen] = useState(false);
  const [popCapabilitiesDialogOpen, setPopCapabilitiesDialogOpen] = useState(false);
  const [minimumPricingDialogOpen, setMinimumPricingDialogOpen] = useState(false);
  const [currentAccessInfo, setCurrentAccessInfo] = useState('');
  const [currentCapabilities, setCurrentCapabilities] = useState({});
  const [currentMinimumPricing, setCurrentMinimumPricing] = useState({
    min_price_under_100mb: 0,
    min_price_100_to_999mb: 0,
    min_price_1000_to_2999mb: 0,
    min_price_3000mb_plus: 0
  });
  
  // Form data
  const [formData, setFormData] = useState({
    location_code: '',
    city: '',
    country: '',
    datacenter_name: '',
    datacenter_address: '',
    pop_type: 'Tier 1',
    status: 'Active',
    provider: '',
    access_info: ''
  });

  // POP Capabilities structure
  const popCapabilitiesFields = [
    { key: 'cnx_extranet_wan', label: 'CNX Extranet / WAN' },
    { key: 'cnx_ethernet', label: 'CNX Ethernet' },
    { key: 'cnx_voice', label: 'CNX Voice' },
    { key: 'tdm_gateway', label: 'TDM Gateway' },
    { key: 'cnx_unigy', label: 'CNX Unigy' },
    { key: 'cnx_alpha', label: 'CNX Alpha' },
    { key: 'cnx_chrono', label: 'CNX Chrono' },
    { key: 'cnx_sdwan', label: 'CNX SDWAN' },
    { key: 'csp_on_ramp', label: 'CSP On Ramp' },
    { key: 'exchange_on_ramp', label: 'Exchange On Ramp' },
    { key: 'internet_on_ramp', label: 'Internet On Ramp' },
    { key: 'transport_only_pop', label: 'Transport Only POP' }
  ];

  // Filter states
  const [filterCountry, setFilterCountry] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchText, setSearchText] = useState('');

  // Load locations on component mount
  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const data = await locationDataApi.getLocations();
      setLocations(data);
    } catch (err) {
      setError('Failed to load locations: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCapabilities = async (locationId) => {
    try {
      const capabilities = await locationDataApi.getCapabilities(locationId);
      return capabilities;
    } catch (err) {
      console.error('Failed to load capabilities:', err);
      return {};
    }
  };

  const handleAdd = () => {
    setDialogMode('add');
    setSelectedLocation(null);
    setFormData({
      location_code: '',
      city: '',
      country: '',
      datacenter_name: '',
      datacenter_address: '',
      pop_type: 'Tier 1',
      status: 'Active',
      provider: '',
      access_info: ''
    });
    setDialogOpen(true);
  };

  const handleEdit = (location) => {
    setDialogMode('edit');
    setSelectedLocation(location);
    setFormData({
      location_code: location.location_code,
      city: location.city,
      country: location.country,
      datacenter_name: location.datacenter_name || '',
      datacenter_address: location.datacenter_address || '',
      pop_type: location.pop_type || 'Tier 1',
      status: location.status || 'Active',
      provider: location.provider || '',
      access_info: location.access_info || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = (location) => {
    setSelectedLocation(location);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (dialogMode === 'add') {
        if (!formData.location_code || !formData.city || !formData.country) {
          setError('Please fill in all required fields (POP Code, City, Country)');
          return;
        }

        await locationDataApi.createLocation(formData);
        setSuccess('Location created successfully');
      } else {
        await locationDataApi.updateLocation(selectedLocation.id, formData);
        setSuccess('Location updated successfully');
      }

      setDialogOpen(false);
      await loadLocations();

    } catch (err) {
      setError('Failed to save location: ' + err.message);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await locationDataApi.deleteLocation(selectedLocation.id);
      setSuccess('Location deleted successfully');
      setDeleteDialogOpen(false);
      await loadLocations();
    } catch (err) {
      setError('Failed to delete location: ' + err.message);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAccessInfoClick = (location) => {
    setSelectedLocation(location);
    setCurrentAccessInfo(location.access_info || '');
    setAccessInfoDialogOpen(true);
  };

  const handleAccessInfoSave = async () => {
    try {
      await locationDataApi.updateLocation(selectedLocation.id, {
        ...selectedLocation,
        access_info: currentAccessInfo
      });
      setSuccess('Access info updated successfully');
      setAccessInfoDialogOpen(false);
      await loadLocations();
    } catch (err) {
      setError('Failed to update access info: ' + err.message);
    }
  };

  const handlePopCapabilitiesClick = async (location) => {
    setSelectedLocation(location);
    const capabilities = await loadCapabilities(location.id);
    setCurrentCapabilities(capabilities);
    setPopCapabilitiesDialogOpen(true);
  };

  const handleCapabilityChange = (key, value) => {
    setCurrentCapabilities(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleCapabilitiesSave = async () => {
    try {
      await locationDataApi.updateCapabilities(selectedLocation.id, currentCapabilities);
      setSuccess('POP capabilities updated successfully');
      setPopCapabilitiesDialogOpen(false);
      await loadLocations();
    } catch (err) {
      setError('Failed to update POP capabilities: ' + err.message);
    }
  };

  const handleMinimumPricingClick = (location) => {
    setSelectedLocation(location);
    setCurrentMinimumPricing({
      min_price_under_100mb: location.min_price_under_100mb || 0,
      min_price_100_to_999mb: location.min_price_100_to_999mb || 0,
      min_price_1000_to_2999mb: location.min_price_1000_to_2999mb || 0,
      min_price_3000mb_plus: location.min_price_3000mb_plus || 0
    });
    setMinimumPricingDialogOpen(true);
  };

  const handleMinimumPricingSave = async () => {
    try {
      await locationDataApi.updateMinimumPricing(selectedLocation.id, currentMinimumPricing);
      setSuccess('Minimum pricing updated successfully');
      setMinimumPricingDialogOpen(false);
      await loadLocations();
    } catch (err) {
      setError('Failed to update minimum pricing: ' + err.message);
    }
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const getStatusChip = (status) => {
    const colors = {
      'Active': 'success',
      'Under Decommission': 'warning',
      'Under Construction': 'info'
    };
    return <Chip label={status} color={colors[status] || 'default'} size="small" />;
  };

  const getPOPTypeChip = (popType) => {
    const colors = {
      'Tier 1': 'error',
      'Tier 2': 'warning',
      'Tier 3': 'info',
      'Exchange': 'success'
    };
    return <Chip label={popType} color={colors[popType] || 'default'} size="small" />;
  };

  const getCapabilitiesSummary = async (locationId) => {
    try {
      const capabilities = await loadCapabilities(locationId);
      const enabledCount = Object.values(capabilities).filter(Boolean).length;
      return `${enabledCount}/${popCapabilitiesFields.length}`;
    } catch (err) {
      return '0/12';
    }
  };

  const filteredLocations = locations.filter(location => {
    const matchesCountry = !filterCountry || location.country.toLowerCase().includes(filterCountry.toLowerCase());
    const matchesStatus = !filterStatus || location.status === filterStatus;
    const matchesSearch = !searchText || 
      location.location_code.toLowerCase().includes(searchText.toLowerCase()) ||
      location.city.toLowerCase().includes(searchText.toLowerCase()) ||
      location.country.toLowerCase().includes(searchText.toLowerCase()) ||
      (location.provider && location.provider.toLowerCase().includes(searchText.toLowerCase())) ||
      (location.datacenter_name && location.datacenter_name.toLowerCase().includes(searchText.toLowerCase()));
    return matchesCountry && matchesStatus && matchesSearch;
  });

  const uniqueCountries = [...new Set(locations.map(loc => loc.country))].sort();
  const uniqueStatuses = [...new Set(locations.map(loc => loc.status))].sort();

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2">
          Manage Locations
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {hasPermission && hasPermission('locations', 'create') && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
            >
              Add Location
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadLocations}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Locations" />
          {hasPermission && hasPermission('locations', 'edit') && (
            <Tab label="Minimum Pricing" />
          )}
        </Tabs>
      </Box>

      {/* Tab Content */}
      {currentTab === 0 && (
        <Box>
          {/* Filters */}
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          label="Search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by POP code, city, country, provider..."
          sx={{ minWidth: 300 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Country</InputLabel>
          <Select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            label="Country"
          >
            <MenuItem value="">All Countries</MenuItem>
            {uniqueCountries.map(country => (
              <MenuItem key={country} value={country}>{country}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            label="Status"
          >
            <MenuItem value="">All Statuses</MenuItem>
            {uniqueStatuses.map(status => (
              <MenuItem key={status} value={status}>{status}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Locations Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>POP Code</TableCell>
              <TableCell>City</TableCell>
              <TableCell>Country</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>Provider</TableCell>
              <TableCell>POP Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">POP Capabilities</TableCell>
              <TableCell align="center">Access Info</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLocations.map((location) => (
              <TableRow key={location.id} hover>
                <TableCell>
                  <Typography variant="body1" fontWeight="bold">
                    {location.location_code}
                  </Typography>
                </TableCell>
                <TableCell>{location.city}</TableCell>
                <TableCell>{location.country}</TableCell>
                <TableCell>{location.datacenter_address || 'N/A'}</TableCell>
                <TableCell>{location.provider || 'N/A'}</TableCell>
                <TableCell>{getPOPTypeChip(location.pop_type)}</TableCell>
                <TableCell>{getStatusChip(location.status)}</TableCell>
                <TableCell align="center">
                  <Button
                    size="small"
                    startIcon={<SettingsIcon />}
                    onClick={() => handlePopCapabilitiesClick(location)}
                  >
                    {hasPermission && hasPermission('locations', 'edit') ? 'View/Edit' : 'View'}
                  </Button>
                </TableCell>
                <TableCell align="center">
                  <Button
                    size="small"
                    startIcon={<InfoIcon />}
                    onClick={() => handleAccessInfoClick(location)}
                  >
                    {hasPermission && hasPermission('locations', 'edit') ? 'View/Edit' : 'View'}
                  </Button>
                </TableCell>
                <TableCell align="center">
                  {hasPermission && hasPermission('locations', 'edit') && (
                    <Tooltip title="Edit">
                      <IconButton 
                        size="small" 
                        onClick={() => handleEdit(location)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {hasPermission && hasPermission('locations', 'delete') && (
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small" 
                        onClick={() => handleDelete(location)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {(!hasPermission || (!hasPermission('locations', 'edit') && !hasPermission('locations', 'delete'))) && (
                    <Typography variant="body2" color="text.secondary">-</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Location Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialogMode === 'add' ? 'Add New Location' : 'Edit Location'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="POP Code *"
                value={formData.location_code}
                onChange={(e) => handleInputChange('location_code', e.target.value)}
                disabled={dialogMode === 'edit'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="City *"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Country *"
                value={formData.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Provider"
                value={formData.provider}
                onChange={(e) => handleInputChange('provider', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Datacenter Name"
                value={formData.datacenter_name}
                onChange={(e) => handleInputChange('datacenter_name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={formData.datacenter_address}
                onChange={(e) => handleInputChange('datacenter_address', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>POP Type</InputLabel>
                <Select
                  value={formData.pop_type}
                  onChange={(e) => handleInputChange('pop_type', e.target.value)}
                  label="POP Type"
                >
                  <MenuItem value="Tier 1">Tier 1</MenuItem>
                  <MenuItem value="Tier 2">Tier 2</MenuItem>
                  <MenuItem value="Tier 3">Tier 3</MenuItem>
                  <MenuItem value="Exchange">Exchange</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Under Decommission">Under Decommission</MenuItem>
                  <MenuItem value="Under Construction">Under Construction</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Access Info"
                value={formData.access_info}
                onChange={(e) => handleInputChange('access_info', e.target.value)}
                multiline
                rows={3}
                placeholder="Enter access information, instructions, or notes..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {dialogMode === 'add' ? 'Add' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Access Info Dialog */}
      <Dialog open={accessInfoDialogOpen} onClose={() => setAccessInfoDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Access Info - {selectedLocation?.location_code}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={8}
            value={currentAccessInfo}
            onChange={(e) => setCurrentAccessInfo(e.target.value)}
            placeholder="Enter access information, instructions, or notes..."
            sx={{ mt: 2 }}
            disabled={!hasPermission || !hasPermission('locations', 'edit')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccessInfoDialogOpen(false)}>
            {hasPermission && hasPermission('locations', 'edit') ? 'Cancel' : 'Close'}
          </Button>
          {hasPermission && hasPermission('locations', 'edit') && (
            <Button onClick={handleAccessInfoSave} variant="contained">
              Save
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* POP Capabilities Dialog */}
      <Dialog open={popCapabilitiesDialogOpen} onClose={() => setPopCapabilitiesDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          POP Capabilities - {selectedLocation?.location_code}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              {popCapabilitiesFields.map((field) => (
                <Grid item xs={12} sm={6} key={field.key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {currentCapabilities[field.key] ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <CancelIcon color="error" />
                    )}
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={Boolean(currentCapabilities[field.key])}
                          onChange={(e) => handleCapabilityChange(field.key, e.target.checked)}
                          disabled={!hasPermission || !hasPermission('locations', 'edit')}
                        />
                      }
                      label={field.label}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPopCapabilitiesDialogOpen(false)}>
            {hasPermission && hasPermission('locations', 'edit') ? 'Cancel' : 'Close'}
          </Button>
          {hasPermission && hasPermission('locations', 'edit') && (
            <Button onClick={handleCapabilitiesSave} variant="contained">
              Save
            </Button>
          )}
        </DialogActions>
      </Dialog>
        </Box>
      )}

      {/* Minimum Pricing Tab */}
      {currentTab === 1 && hasPermission && hasPermission('locations', 'edit') && (
        <Box>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Manage minimum pricing tiers for each location. Prices are stored in USD and converted as needed.
            </Typography>
          </Box>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>POP Code</strong></TableCell>
                  <TableCell><strong>&lt; 100Mb (USD)</strong></TableCell>
                  <TableCell><strong>100-999Mb (USD)</strong></TableCell>
                  <TableCell><strong>1000-2999Mb (USD)</strong></TableCell>
                  <TableCell><strong>3000Mb+ (USD)</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id} hover>
                    <TableCell>
                      <Typography variant="body1" fontWeight="bold">
                        {location.location_code}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {location.city}, {location.country}
                      </Typography>
                    </TableCell>
                    <TableCell>${location.min_price_under_100mb || 0}</TableCell>
                    <TableCell>${location.min_price_100_to_999mb || 0}</TableCell>
                    <TableCell>${location.min_price_1000_to_2999mb || 0}</TableCell>
                    <TableCell>${location.min_price_3000mb_plus || 0}</TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleMinimumPricingClick(location)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Minimum Pricing Dialog */}
      <Dialog open={minimumPricingDialogOpen} onClose={() => setMinimumPricingDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Edit Minimum Pricing - {selectedLocation?.location_code}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Set minimum prices for different bandwidth tiers. All prices are in USD.
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="< 100Mb (USD)"
                type="text"
                value={currentMinimumPricing.min_price_under_100mb}
                onChange={(e) => setCurrentMinimumPricing(prev => ({
                  ...prev,
                  min_price_under_100mb: parseFloat(e.target.value) || 0
                }))}
                placeholder="0.00"
                inputProps={{ pattern: '[0-9]*\\.?[0-9]*' }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="100-999Mb (USD)"
                type="text"
                value={currentMinimumPricing.min_price_100_to_999mb}
                onChange={(e) => setCurrentMinimumPricing(prev => ({
                  ...prev,
                  min_price_100_to_999mb: parseFloat(e.target.value) || 0
                }))}
                placeholder="0.00"
                inputProps={{ pattern: '[0-9]*\\.?[0-9]*' }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="1000-2999Mb (USD)"
                type="text"
                value={currentMinimumPricing.min_price_1000_to_2999mb}
                onChange={(e) => setCurrentMinimumPricing(prev => ({
                  ...prev,
                  min_price_1000_to_2999mb: parseFloat(e.target.value) || 0
                }))}
                placeholder="0.00"
                inputProps={{ pattern: '[0-9]*\\.?[0-9]*' }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="3000Mb+ (USD)"
                type="text"
                value={currentMinimumPricing.min_price_3000mb_plus}
                onChange={(e) => setCurrentMinimumPricing(prev => ({
                  ...prev,
                  min_price_3000mb_plus: parseFloat(e.target.value) || 0
                }))}
                placeholder="0.00"
                inputProps={{ pattern: '[0-9]*\\.?[0-9]*' }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMinimumPricingDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleMinimumPricingSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Location</DialogTitle>
        <DialogContent>
          Are you sure you want to delete location {selectedLocation?.location_code}?
          <br />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            City: {selectedLocation?.city}, Country: {selectedLocation?.country}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Messages */}
      <Snackbar 
        open={!!success} 
        autoHideDuration={6000} 
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>
      
      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LocationDataManager; 