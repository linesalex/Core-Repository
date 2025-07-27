import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip,
  Alert, Snackbar, Tooltip, Grid, Card, CardContent, Select, MenuItem, FormControl, InputLabel,
  List, ListItem, ListItemText, ListItemIcon, Checkbox, FormControlLabel
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
import { API_BASE_URL } from './config';
import axios from 'axios';
import { ValidatedTextField, ValidatedSelect, createValidator, scrollToFirstError } from './components/FormValidation';

const LocationDataManager = ({ hasPermission }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Tab state removed - only showing locations now
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accessInfoDialogOpen, setAccessInfoDialogOpen] = useState(false);
  const [popCapabilitiesDialogOpen, setPopCapabilitiesDialogOpen] = useState(false);
  const [currentAccessInfo, setCurrentAccessInfo] = useState('');
  const [currentCapabilities, setCurrentCapabilities] = useState({});
  
  // Form data
  const [formData, setFormData] = useState({
    location_code: '',
    region: 'AMERs', // Default to AMERs
    city: '',
    country: '',
    datacenter_name: '',
    datacenter_address: '',
    pop_type: 'Tier 1',
    status: 'Active',
    provider: '',
    access_info: ''
  });

  // Add POP capabilities form state for creation
  const [formCapabilities, setFormCapabilities] = useState({
    cnx_extranet_wan: false,
    cnx_ethernet: false,
    cnx_voice: false,
    tdm_gateway: false,
    cnx_unigy: false,
    cnx_alpha: false,
    cnx_chrono: false,
    cnx_sdwan: false,
    csp_on_ramp: false,
    exchange_on_ramp: false,
    internet_on_ramp: false,
    transport_only_pop: false,
    cnx_colocation: false
  });

  // Function to get suggested city and country based on historical data
  const getSuggestedLocation = async (popCode) => {
    if (!popCode || popCode.length < 6) return { city: '', country: '', region: '' };
    
    // Extract city code (characters 4-6, e.g., "LON" from "IPCLON9")
    const cityCode = popCode.substring(3, 6).toUpperCase();
    
    try {
      // Find existing locations with the same city code pattern
      const existingLocation = locations.find(location => 
        location.location_code && 
        location.location_code.length >= 6 &&
        location.location_code.substring(3, 6).toUpperCase() === cityCode &&
        location.city && location.country
      );
      
      if (existingLocation) {
        return {
          city: existingLocation.city,
          country: existingLocation.country,
          region: existingLocation.region || 'AMERs'
        };
      }
    } catch (error) {
      console.error('Error getting suggested location:', error);
    }
    
    return { city: '', country: '', region: '' };
  };

  // POP code validation regex: IPC + 3 letters + 1-2 digits
  const POP_CODE_REGEX = /^IPC[A-Z]{3}([1-9]|[1-9][0-9])$/;

  // Validation states
  const [formErrors, setFormErrors] = useState({});

  // Enhanced validation rules for Location form with POP code format
  const locationValidationRules = {
    location_code: [
      { type: 'required', message: 'POP Code is required' },
      { type: 'pattern', pattern: POP_CODE_REGEX, message: 'POP code must follow format: IPC[3 LETTERS][1-99] (e.g., IPCLON9, IPCNYC12)' }
    ],
    region: { type: 'required', message: 'Region is required' },
    city: { type: 'required', message: 'City is required' },
    country: { type: 'required', message: 'Country is required' },
    provider: { type: 'required', message: 'Provider is required' },
    datacenter_name: { type: 'required', message: 'Datacenter Name is required' },
    datacenter_address: { type: 'required', message: 'Address is required' }
  };

  // Validation function
  const validate = createValidator(locationValidationRules);

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
    { key: 'transport_only_pop', label: 'Transport Only POP' },
    { key: 'cnx_colocation', label: 'CNX Colocation' }
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
      region: 'AMERs',
      city: '',
      country: '',
      datacenter_name: '',
      datacenter_address: '',
      pop_type: 'Tier 1',
      status: 'Active',
      provider: '',
      access_info: ''
    });
    setFormCapabilities({ // Reset capabilities for new location
      cnx_extranet_wan: false,
      cnx_ethernet: false,
      cnx_voice: false,
      tdm_gateway: false,
      cnx_unigy: false,
      cnx_alpha: false,
      cnx_chrono: false,
      cnx_sdwan: false,
      csp_on_ramp: false,
      exchange_on_ramp: false,
      internet_on_ramp: false,
      transport_only_pop: false,
      cnx_colocation: false
    });
    setFormErrors({}); // Clear validation errors
    setDialogOpen(true);
  };

  const handleEdit = (location) => {
    setDialogMode('edit');
    setSelectedLocation(location);
    setFormData({
      location_code: location.location_code,
      region: location.region || 'AMERs',
      city: location.city,
      country: location.country,
      datacenter_name: location.datacenter_name || '',
      datacenter_address: location.datacenter_address || '',
      pop_type: location.pop_type || 'Tier 1',
      status: location.status || 'Active',
      provider: location.provider || '',
      access_info: location.access_info || ''
    });
    setFormErrors({}); // Clear validation errors
    setDialogOpen(true);
  };

  const handleDelete = (location) => {
    setSelectedLocation(location);
    setDeleteDialogOpen(true);
  };

  // Normalize text for duplicate checking
  const normalizeText = (text) => {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-populate city and country when POP code is entered
    if (field === 'location_code' && dialogMode === 'add' && value && value.length >= 6) {
      getSuggestedLocation(value).then(suggestion => {
        if (suggestion.city && suggestion.country) {
          setFormData(prev => ({
            ...prev,
            city: suggestion.city,
            country: suggestion.country,
            region: suggestion.region // Add region to formData
          }));
        }
      });
    }
  };

  const handleCapabilityChange = (key, value) => {
    setFormCapabilities(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handlePopCapabilitiesClick = async (location) => {
    setSelectedLocation(location);
    const capabilities = await loadCapabilities(location.id);
    setCurrentCapabilities(capabilities);
    setPopCapabilitiesDialogOpen(true);
  };

  const handleExistingCapabilityChange = async (key, value) => {
    // Special handling for CNX Colocation - check for existing data before allowing disable
    if (key === 'cnx_colocation' && !value && currentCapabilities[key]) {
      try {
        // Check if there are any racks for this location
        const response = await axios.get(`${API_BASE_URL}/cnx-colocation/locations/${selectedLocation.id}/racks`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (response.data && response.data.length > 0) {
          setError(`Cannot disable CNX Colocation. This location has ${response.data.length} rack(s) with associated data. Please delete all racks first.`);
          return; // Don't update the capability
        }
      } catch (err) {
        // If we can't check, allow the change (fail safe)
        console.warn('Could not check for existing rack data:', err);
      }
    }
    
    setCurrentCapabilities(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      // Validate form using validation framework
      const validationErrors = validate(formData);
      setFormErrors(validationErrors);

      // Check if there are validation errors
      if (Object.keys(validationErrors).length > 0) {
        scrollToFirstError(validationErrors);
        return;
      }

      // Duplicate prevention - check for existing locations with same POP Code (normalized)
      if (dialogMode === 'add') {
        const normalizedLocationCode = normalizeText(formData.location_code);
        const existingLocation = locations.find(location => 
          normalizeText(location.location_code) === normalizedLocationCode
        );
        
        if (existingLocation) {
          setError(`A location with POP Code "${formData.location_code}" already exists. Please use a different POP Code.`);
          return;
        }

        // Create location first
        const createdLocation = await locationDataApi.createLocation(formData);
        
        // Save capabilities for new location if any are enabled
        const hasEnabledCapabilities = Object.values(formCapabilities).some(Boolean);
        
        if (hasEnabledCapabilities) {
          try {
            // The backend returns { id, location_code }, so use createdLocation.id
            let locationId = createdLocation.id;
            
            if (!locationId) {
              // Fallback: find the location ID by location_code
              const allLocations = await locationDataApi.getLocations();
              const foundLocation = allLocations.find(loc => loc.location_code === createdLocation.location_code);
              locationId = foundLocation ? foundLocation.id : null;
            }
            
            if (!locationId) {
              throw new Error('Location ID is missing from creation response and could not be found by location code');
            }
            
            // Convert boolean values to ensure backend compatibility
            const capabilitiesForBackend = {};
            Object.keys(formCapabilities).forEach(key => {
              capabilitiesForBackend[key] = formCapabilities[key] ? 1 : 0;
            });
            
            const capabilitiesResponse = await locationDataApi.updateCapabilities(locationId, capabilitiesForBackend);
            setSuccess('Location and capabilities created successfully');
          } catch (capErr) {
            console.error('Failed to save capabilities during location creation:', capErr);
            setError(`Location created but failed to save capabilities: ${capErr.message}`);
            // Continue to show location as created successfully but note capabilities issue
          }
        } else {
          setSuccess('Location created successfully');
        }
      } else {
        // For edit mode, check duplicates excluding current location
        const normalizedLocationCode = normalizeText(formData.location_code);
        const existingLocation = locations.find(location => 
          location.id !== selectedLocation.id && 
          normalizeText(location.location_code) === normalizedLocationCode
        );
        
        if (existingLocation) {
          setError(`A location with POP Code "${formData.location_code}" already exists. Please use a different POP Code.`);
          return;
        }

        await locationDataApi.updateLocation(selectedLocation.id, formData);
        setSuccess('Location updated successfully');
      }

      setDialogOpen(false);
      setFormErrors({}); // Clear validation errors on success
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

      {/* Locations Content */}
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
              <TableCell>Region</TableCell>
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
                <TableCell>
                  <Chip 
                    label={location.region || 'N/A'} 
                    color={
                      location.region === 'AMERs' ? 'primary' : 
                      location.region === 'EMEA' ? 'secondary' : 
                      location.region === 'APAC' ? 'success' : 'default'
                    }
                    size="small"
                  />
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
              <ValidatedTextField
                fullWidth
                label="POP Code *"
                value={formData.location_code}
                onChange={(e) => handleInputChange('location_code', e.target.value)}
                disabled={dialogMode === 'edit'}
                field="location_code"
                errors={formErrors}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedSelect
                fullWidth
                label="Region *"
                value={formData.region}
                onChange={(e) => handleInputChange('region', e.target.value)}
                field="region"
                errors={formErrors}
                required
              >
                <MenuItem value="AMERs">AMERs</MenuItem>
                <MenuItem value="EMEA">EMEA</MenuItem>
                <MenuItem value="APAC">APAC</MenuItem>
              </ValidatedSelect>
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                fullWidth
                label="City *"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                field="city"
                errors={formErrors}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                fullWidth
                label="Country *"
                value={formData.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                field="country"
                errors={formErrors}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                fullWidth
                label="Provider *"
                value={formData.provider}
                onChange={(e) => handleInputChange('provider', e.target.value)}
                field="provider"
                errors={formErrors}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <ValidatedTextField
                fullWidth
                label="Datacenter Name *"
                value={formData.datacenter_name}
                onChange={(e) => handleInputChange('datacenter_name', e.target.value)}
                field="datacenter_name"
                errors={formErrors}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <ValidatedTextField
                fullWidth
                label="Address *"
                value={formData.datacenter_address}
                onChange={(e) => handleInputChange('datacenter_address', e.target.value)}
                field="datacenter_address"
                errors={formErrors}
                required
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedSelect
                fullWidth
                label="POP Type"
                value={formData.pop_type}
                onChange={(e) => handleInputChange('pop_type', e.target.value)}
                field="pop_type"
                errors={formErrors}
              >
                <MenuItem value="Tier 1">Tier 1</MenuItem>
                <MenuItem value="Tier 2">Tier 2</MenuItem>
                <MenuItem value="Tier 3">Tier 3</MenuItem>
                <MenuItem value="Exchange">Exchange</MenuItem>
              </ValidatedSelect>
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedSelect
                fullWidth
                label="Status"
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                field="status"
                errors={formErrors}
              >
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Under Decommission">Under Decommission</MenuItem>
                <MenuItem value="Under Construction">Under Construction</MenuItem>
              </ValidatedSelect>
            </Grid>
            <Grid item xs={12}>
              <ValidatedTextField
                fullWidth
                label="Access Info"
                value={formData.access_info}
                onChange={(e) => handleInputChange('access_info', e.target.value)}
                multiline
                rows={3}
                placeholder="Enter access information, instructions, or notes..."
                field="access_info"
                errors={formErrors}
              />
            </Grid>

            {/* POP Capabilities Section - Only show in Add mode */}
            {dialogMode === 'add' && (
              <>
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                    POP Capabilities
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Select the capabilities available at this location. These can be modified later.
                  </Typography>
                </Grid>
                
                {popCapabilitiesFields.map((field) => (
                  <Grid item xs={12} sm={6} key={field.key}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={Boolean(formCapabilities[field.key])}
                          onChange={(e) => handleCapabilityChange(field.key, e.target.checked)}
                        />
                      }
                      label={field.label}
                    />
                  </Grid>
                ))}
              </>
            )}
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
                          onChange={(e) => handleExistingCapabilityChange(field.key, e.target.checked)}
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