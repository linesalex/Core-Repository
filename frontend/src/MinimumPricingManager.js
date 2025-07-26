import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, 
  Alert, Snackbar, Grid
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { locationDataApi } from './api';
import { ValidatedTextField, createValidator, scrollToFirstError } from './components/FormValidation';

const MinimumPricingManager = ({ hasPermission }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog states
  const [minimumPricingDialogOpen, setMinimumPricingDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [currentMinimumPricing, setCurrentMinimumPricing] = useState({
    min_price_under_100mb: 0,
    min_price_100_to_999mb: 0,
    min_price_1000_to_2999mb: 0,
    min_price_3000mb_plus: 0
  });

  // Validation states
  const [pricingErrors, setPricingErrors] = useState({});

  // Validation rules for Minimum Pricing form
  const pricingValidationRules = {
    min_price_under_100mb: [
      { type: 'required', message: 'Price for <100Mb is required' },
      { type: 'number', message: 'Price must be a valid number' },
      { type: 'min', min: 0, message: 'Price must be greater than or equal to 0' }
    ],
    min_price_100_to_999mb: [
      { type: 'required', message: 'Price for 100-999Mb is required' },
      { type: 'number', message: 'Price must be a valid number' },
      { type: 'min', min: 0, message: 'Price must be greater than or equal to 0' }
    ],
    min_price_1000_to_2999mb: [
      { type: 'required', message: 'Price for 1000-2999Mb is required' },
      { type: 'number', message: 'Price must be a valid number' },
      { type: 'min', min: 0, message: 'Price must be greater than or equal to 0' }
    ],
    min_price_3000mb_plus: [
      { type: 'required', message: 'Price for 3000Mb+ is required' },
      { type: 'number', message: 'Price must be a valid number' },
      { type: 'min', min: 0, message: 'Price must be greater than or equal to 0' }
    ]
  };

  // Validation function
  const validatePricing = createValidator(pricingValidationRules);

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

  const handleMinimumPricingClick = (location) => {
    setSelectedLocation(location);
    setCurrentMinimumPricing({
      min_price_under_100mb: location.min_price_under_100mb || 0,
      min_price_100_to_999mb: location.min_price_100_to_999mb || 0,
      min_price_1000_to_2999mb: location.min_price_1000_to_2999mb || 0,
      min_price_3000mb_plus: location.min_price_3000mb_plus || 0
    });
    setPricingErrors({}); // Clear validation errors
    setMinimumPricingDialogOpen(true);
  };

  const handleMinimumPricingSave = async () => {
    try {
      // Validate form using validation framework
      const validationErrors = validatePricing(currentMinimumPricing);
      setPricingErrors(validationErrors);

      // Check if there are validation errors
      if (Object.keys(validationErrors).length > 0) {
        scrollToFirstError(validationErrors);
        return;
      }

      await locationDataApi.updateMinimumPricing(selectedLocation.id, currentMinimumPricing);
      setSuccess('Minimum pricing updated successfully');
      setMinimumPricingDialogOpen(false);
      setPricingErrors({}); // Clear validation errors on success
      await loadLocations();
    } catch (err) {
      setError('Failed to update minimum pricing: ' + err.message);
    }
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', p: 3 }}>
        <Typography>Loading locations...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2">
          Minimum Pricing
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadLocations}
        >
          Refresh
        </Button>
      </Box>

      {/* Description */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Manage minimum pricing tiers for each location. Prices are stored in USD and converted as needed.
        </Typography>
      </Box>
      
      {/* Minimum Pricing Table */}
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
                  {hasPermission && hasPermission('locations', 'edit') ? (
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleMinimumPricingClick(location)}
                    >
                      Edit
                    </Button>
                  ) : (
                    <Typography variant="body2" color="text.secondary">-</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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
              <ValidatedTextField
                fullWidth
                label="< 100Mb (USD) *"
                type="number"
                value={currentMinimumPricing.min_price_under_100mb}
                onChange={(e) => setCurrentMinimumPricing(prev => ({
                  ...prev,
                  min_price_under_100mb: parseFloat(e.target.value) || 0
                }))}
                placeholder="0.00"
                required
                field="min_price_under_100mb"
                errors={pricingErrors}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                fullWidth
                label="100-999Mb (USD) *"
                type="number"
                value={currentMinimumPricing.min_price_100_to_999mb}
                onChange={(e) => setCurrentMinimumPricing(prev => ({
                  ...prev,
                  min_price_100_to_999mb: parseFloat(e.target.value) || 0
                }))}
                placeholder="0.00"
                required
                field="min_price_100_to_999mb"
                errors={pricingErrors}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                fullWidth
                label="1000-2999Mb (USD) *"
                type="number"
                value={currentMinimumPricing.min_price_1000_to_2999mb}
                onChange={(e) => setCurrentMinimumPricing(prev => ({
                  ...prev,
                  min_price_1000_to_2999mb: parseFloat(e.target.value) || 0
                }))}
                placeholder="0.00"
                required
                field="min_price_1000_to_2999mb"
                errors={pricingErrors}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                fullWidth
                label="3000Mb+ (USD) *"
                type="number"
                value={currentMinimumPricing.min_price_3000mb_plus}
                onChange={(e) => setCurrentMinimumPricing(prev => ({
                  ...prev,
                  min_price_3000mb_plus: parseFloat(e.target.value) || 0
                }))}
                placeholder="0.00"
                required
                field="min_price_3000mb_plus"
                errors={pricingErrors}
                inputProps={{ min: 0, step: 0.01 }}
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

export default MinimumPricingManager; 