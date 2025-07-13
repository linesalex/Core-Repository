import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip,
  Alert, Snackbar, Tooltip, Grid, Card, CardContent, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MapIcon from '@mui/icons-material/Map';
import { locationDataApi } from './api';

const LocationDataManager = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    location_code: '',
    city: '',
    country: '',
    datacenter_name: '',
    datacenter_address: '',
    latitude: '',
    longitude: '',
    time_zone: '',
    pop_type: 'Primary',
    status: 'Active'
  });

  // Filter states
  const [filterCountry, setFilterCountry] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

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

  const handleAdd = () => {
    setDialogMode('add');
    setSelectedLocation(null);
    setFormData({
      location_code: '',
      city: '',
      country: '',
      datacenter_name: '',
      datacenter_address: '',
      latitude: '',
      longitude: '',
      time_zone: '',
      pop_type: 'Primary',
      status: 'Active'
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
      latitude: location.latitude ? location.latitude.toString() : '',
      longitude: location.longitude ? location.longitude.toString() : '',
      time_zone: location.time_zone || '',
      pop_type: location.pop_type || 'Primary',
      status: location.status || 'Active'
    });
    setDialogOpen(true);
  };

  const handleDelete = (location) => {
    setSelectedLocation(location);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (!formData.location_code || !formData.city || !formData.country) {
        setError('Please fill in all required fields');
        return;
      }

      const submitData = {
        location_code: formData.location_code.toUpperCase(),
        city: formData.city,
        country: formData.country,
        datacenter_name: formData.datacenter_name,
        datacenter_address: formData.datacenter_address,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        time_zone: formData.time_zone,
        pop_type: formData.pop_type,
        status: formData.status
      };

      if (dialogMode === 'add') {
        await locationDataApi.addLocation(submitData);
        setSuccess('Location added successfully');
      } else {
        await locationDataApi.updateLocation(selectedLocation.id, submitData);
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

  const getStatusChip = (status) => {
    const colors = {
      'Active': 'success',
      'Inactive': 'error',
      'Maintenance': 'warning'
    };
    return <Chip label={status} color={colors[status] || 'default'} size="small" />;
  };

  const getPOPTypeChip = (popType) => {
    const colors = {
      'Primary': 'primary',
      'Secondary': 'secondary',
      'Tertiary': 'default'
    };
    return <Chip label={popType} color={colors[popType] || 'default'} size="small" />;
  };

  // Get unique countries for filtering
  const uniqueCountries = [...new Set(locations.map(loc => loc.country))].sort();

  // Filter locations based on selected filters
  const filteredLocations = locations.filter(location => {
    const matchesCountry = !filterCountry || location.country === filterCountry;
    const matchesStatus = !filterStatus || location.status === filterStatus;
    return matchesCountry && matchesStatus;
  });

  // Stats for overview cards
  const stats = {
    total: locations.length,
    active: locations.filter(loc => loc.status === 'Active').length,
    countries: uniqueCountries.length,
    primary: locations.filter(loc => loc.pop_type === 'Primary').length
  };

  // Common timezones for quick selection
  const commonTimezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Asia/Hong_Kong',
    'Australia/Sydney'
  ];

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2">
          Location Data Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAdd}
          >
            Add Location
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadLocations}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">
                {stats.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Locations
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {stats.active}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Locations
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="info.main">
                {stats.countries}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Countries
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="secondary.main">
                {stats.primary}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Primary POPs
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Filters
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Country</InputLabel>
              <Select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                label="Country"
              >
                <MenuItem value="">All Countries</MenuItem>
                {uniqueCountries.map((country) => (
                  <MenuItem key={country} value={country}>
                    {country}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
                <MenuItem value="Maintenance">Maintenance</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Locations Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Location Code</TableCell>
              <TableCell>City</TableCell>
              <TableCell>Country</TableCell>
              <TableCell>Datacenter</TableCell>
              <TableCell>Coordinates</TableCell>
              <TableCell>POP Type</TableCell>
              <TableCell>Status</TableCell>
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
                  {location.city}
                </TableCell>
                <TableCell>
                  {location.country}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {location.datacenter_name || 'N/A'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {location.datacenter_address || 'No address'}
                  </Typography>
                </TableCell>
                <TableCell>
                  {location.latitude && location.longitude ? (
                    <Tooltip title={`${location.latitude}, ${location.longitude}`}>
                      <Chip
                        icon={<LocationOnIcon />}
                        label="Available"
                        size="small"
                        variant="outlined"
                      />
                    </Tooltip>
                  ) : (
                    <Chip label="Not Set" size="small" color="warning" />
                  )}
                </TableCell>
                <TableCell>
                  {getPOPTypeChip(location.pop_type)}
                </TableCell>
                <TableCell>
                  {getStatusChip(location.status)}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Edit">
                    <IconButton 
                      size="small" 
                      onClick={() => handleEdit(location)}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton 
                      size="small" 
                      onClick={() => handleDelete(location)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialogMode === 'add' ? 'Add Location' : 'Edit Location'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Location Code"
                value={formData.location_code}
                onChange={(e) => handleInputChange('location_code', e.target.value.toUpperCase())}
                fullWidth
                required
                disabled={dialogMode === 'edit'}
                helperText="Unique identifier for this location"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="City"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Country"
                value={formData.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>POP Type</InputLabel>
                <Select
                  value={formData.pop_type}
                  onChange={(e) => handleInputChange('pop_type', e.target.value)}
                  label="POP Type"
                >
                  <MenuItem value="Primary">Primary</MenuItem>
                  <MenuItem value="Secondary">Secondary</MenuItem>
                  <MenuItem value="Tertiary">Tertiary</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Datacenter Name"
                value={formData.datacenter_name}
                onChange={(e) => handleInputChange('datacenter_name', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Datacenter Address"
                value={formData.datacenter_address}
                onChange={(e) => handleInputChange('datacenter_address', e.target.value)}
                fullWidth
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Latitude"
                type="number"
                value={formData.latitude}
                onChange={(e) => handleInputChange('latitude', e.target.value)}
                fullWidth
                inputProps={{ step: 0.0001 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Longitude"
                type="number"
                value={formData.longitude}
                onChange={(e) => handleInputChange('longitude', e.target.value)}
                fullWidth
                inputProps={{ step: 0.0001 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Time Zone</InputLabel>
                <Select
                  value={formData.time_zone}
                  onChange={(e) => handleInputChange('time_zone', e.target.value)}
                  label="Time Zone"
                >
                  {commonTimezones.map((tz) => (
                    <MenuItem key={tz} value={tz}>
                      {tz}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                  <MenuItem value="Maintenance">Maintenance</MenuItem>
                </Select>
              </FormControl>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Location</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete location <strong>{selectedLocation?.location_code}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

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

export default LocationDataManager; 