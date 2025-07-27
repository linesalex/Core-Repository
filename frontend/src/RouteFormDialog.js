import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Grid, Checkbox, FormControlLabel, Typography, Box, Chip, Stack, Divider, Alert,
  Select, MenuItem, FormControl, InputLabel, Autocomplete
} from '@mui/material';
import { uploadTestResults, getTestResultsFiles, deleteTestResultsFile, locationDataApi } from './api';
import { API_BASE_URL } from './config';
import axios from 'axios';
import { ValidatedTextField, ValidatedSelect, createValidator, scrollToFirstError } from './components/FormValidation';

const CIRCUIT_ID_REGEX = /^[A-Z]{6}[0-9]{6}$/;

const defaultValues = {
  circuit_id: '',
  kmz_file_path: '',
  mtu: '',
  sla_latency: '',
  expected_latency: '',
  cable_system: '',
  is_special: false,
  underlying_carrier: '',
  cost: '',
  currency: 'USD',
  location_a: '',
  location_b: '',
  bandwidth: '',
  capacity_usage_percent: '',
  more_details: '',
  local_loop_carriers_a: '',
  local_loop_carriers_b: '',
  equipment_type: ''
};

function RouteFormDialog({ open, onClose, onSubmit, initialValues = {}, isEdit = false, onFileDeleted }) {
  const [values, setValues] = useState(defaultValues);
  const [file, setFile] = useState(null);
  const [testResultsFiles, setTestResultsFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [error, setError] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [kmzDeleteLoading, setKmzDeleteLoading] = useState(false);
  
  // Validation states
  const [formErrors, setFormErrors] = useState({});
  
  // Validation rules for Network Routes form
  const routeValidationRules = {
    circuit_id: [
      { type: 'required', message: 'Circuit ID is required' },
      { type: 'pattern', pattern: CIRCUIT_ID_REGEX, message: 'Circuit ID must be exactly 6 uppercase letters followed by 6 digits (e.g., ABCDEF123456)' }
    ],
    mtu: { type: 'required', message: 'MTU is required' },
    expected_latency: { type: 'required', message: 'Expected Latency is required' },
    cost: { type: 'required', message: 'Cost is required' },
    underlying_carrier: { type: 'required', message: 'Underlying Carrier is required' },
    equipment_type: { type: 'required', message: 'Equipment Type is required' },
    bandwidth: { type: 'required', message: 'Bandwidth is required' }
  };
  
  // Validation function
  const validate = createValidator(routeValidationRules);
  
  // Normalize text for duplicate checking
  const normalizeText = (text) => {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  };
  const [carrierOptions, setCarrierOptions] = useState([]);
  const [carrierInputValue, setCarrierInputValue] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState(null);
  const [selectedLocalLoopCarriersA, setSelectedLocalLoopCarriersA] = useState([]);
  const [selectedLocalLoopCarriersB, setSelectedLocalLoopCarriersB] = useState([]);
  const [localLoopCarrierInputValueA, setLocalLoopCarrierInputValueA] = useState('');
  const [localLoopCarrierInputValueB, setLocalLoopCarrierInputValueB] = useState('');
  const [locationOptions, setLocationOptions] = useState([]);
  const [selectedLocationA, setSelectedLocationA] = useState(null);
  const [selectedLocationB, setSelectedLocationB] = useState(null);
  const [locationInputValueA, setLocationInputValueA] = useState('');
  const [locationInputValueB, setLocationInputValueB] = useState('');

  // Load locations on component mount
  useEffect(() => {
    if (open) {
      loadLocations();
      setFormErrors({}); // Clear validation errors when dialog opens
      setError(''); // Clear general errors
    }
  }, [open]);

  useEffect(() => {
    if (isEdit && initialValues && Object.keys(initialValues).length > 0) {
      // When editing, populate with existing values (filter out null/undefined values)
      const cleanInitialValues = Object.keys(initialValues).reduce((acc, key) => {
        if (initialValues[key] !== null && initialValues[key] !== undefined) {
          acc[key] = initialValues[key];
        }
        return acc;
      }, {});
      setValues({ ...defaultValues, ...cleanInitialValues });
      
      // Set the selected carrier based on underlying_carrier value
      if (initialValues.underlying_carrier) {
        setSelectedCarrier({ 
          carrier_name: initialValues.underlying_carrier,
          id: null // We don't have the ID from the initial values
        });
        setCarrierInputValue(initialValues.underlying_carrier);
      }

      // Set the selected local loop carriers based on comma-separated values
      if (initialValues.local_loop_carriers_a) {
        const carriersA = initialValues.local_loop_carriers_a.split(',').map(carrier => ({
          carrier_name: carrier.trim(),
          id: null
        })).filter(carrier => carrier.carrier_name);
        setSelectedLocalLoopCarriersA(carriersA);
      }

      if (initialValues.local_loop_carriers_b) {
        const carriersB = initialValues.local_loop_carriers_b.split(',').map(carrier => ({
          carrier_name: carrier.trim(),
          id: null
        })).filter(carrier => carrier.carrier_name);
        setSelectedLocalLoopCarriersB(carriersB);
      }

      // Set the selected locations based on location codes
      if (initialValues.location_a) {
        setSelectedLocationA({ 
          location_code: initialValues.location_a,
          id: null
        });
        setLocationInputValueA(initialValues.location_a);
      }

      if (initialValues.location_b) {
        setSelectedLocationB({ 
          location_code: initialValues.location_b,
          id: null
        });
        setLocationInputValueB(initialValues.location_b);
      }
      
      // Load existing test results files
      loadExistingFiles(initialValues.circuit_id);
    } else {
      // When adding, ensure all fields are blank
      setValues(defaultValues);
      setExistingFiles([]);
      setSelectedCarrier(null);
      setCarrierInputValue('');
      setSelectedLocalLoopCarriersA([]);
      setSelectedLocalLoopCarriersB([]);
      setLocalLoopCarrierInputValueA('');
      setLocalLoopCarrierInputValueB('');
      setSelectedLocationA(null);
      setSelectedLocationB(null);
      setLocationInputValueA('');
      setLocationInputValueB('');
    }
    setFile(null);
    setTestResultsFiles([]);
    setError('');
  }, [open, initialValues, isEdit]);

  const loadExistingFiles = async (circuitId) => {
    if (!circuitId) return;
    
    setFileLoading(true);
    try {
      const files = await getTestResultsFiles(circuitId);
      setExistingFiles(files);
    } catch (err) {
      console.error('Failed to load existing files:', err);
      setExistingFiles([]);
    } finally {
      setFileLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Auto-uppercase Circuit ID and limit to 12 characters
    if (name === 'circuit_id') {
      const upperValue = value.toUpperCase().slice(0, 12);
      setValues(v => ({ ...v, [name]: type === 'checkbox' ? checked : upperValue }));
      
      // Real-time Circuit ID validation (only for add mode)
      if (!isEdit) {
        if (upperValue && !CIRCUIT_ID_REGEX.test(upperValue)) {
          setError('Circuit ID must be exactly 6 uppercase letters followed by 6 digits (e.g., ABCDEF123456)');
        } else {
          setError('');
        }
      }
    } else {
      setValues(v => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const loadLocations = async () => {
    try {
      const locations = await locationDataApi.getLocations();
      setLocationOptions(locations || []);
    } catch (error) {
      console.error('Error loading locations:', error);
      setLocationOptions([]);
    }
  };

  const searchCarriers = async (inputValue) => {
    if (inputValue.length < 2) {
      setCarrierOptions([]);
      return;
    }
    
    try {
              const response = await axios.get(`${API_BASE_URL}/carriers/search?q=${inputValue}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setCarrierOptions(response.data);
    } catch (error) {
      console.error('Error searching carriers:', error);
      setCarrierOptions([]);
    }
  };

  const handleCarrierChange = (event, newValue) => {
    setSelectedCarrier(newValue);
    if (newValue) {
      setValues({ ...values, underlying_carrier: newValue.carrier_name });
    } else {
      setValues({ ...values, underlying_carrier: '' });
    }
  };

  const handleCarrierInputChange = (event, newInputValue) => {
    setCarrierInputValue(newInputValue);
    searchCarriers(newInputValue);
    
    // Only clear selection if input is completely empty
    if (!newInputValue) {
      setSelectedCarrier(null);
      setValues({ ...values, underlying_carrier: '' });
    }
    // No auto-selection - user must click to select
  };

  const handleLocalLoopCarrierChangeA = (event, newValue) => {
    setSelectedLocalLoopCarriersA(newValue);
    const carrierNames = newValue.map(carrier => carrier.carrier_name).join(', ');
    setValues({ ...values, local_loop_carriers_a: carrierNames });
  };

  const handleLocalLoopCarrierChangeB = (event, newValue) => {
    setSelectedLocalLoopCarriersB(newValue);
    const carrierNames = newValue.map(carrier => carrier.carrier_name).join(', ');
    setValues({ ...values, local_loop_carriers_b: carrierNames });
  };

  const handleLocalLoopCarrierInputChangeA = (event, newInputValue) => {
    setLocalLoopCarrierInputValueA(newInputValue);
    searchCarriers(newInputValue);
  };

  const handleLocalLoopCarrierInputChangeB = (event, newInputValue) => {
    setLocalLoopCarrierInputValueB(newInputValue);
    searchCarriers(newInputValue);
  };

  const handleLocationAChange = (event, newValue) => {
    setSelectedLocationA(newValue);
    if (newValue) {
      setValues({ ...values, location_a: newValue.location_code });
    } else {
      setValues({ ...values, location_a: '' });
    }
  };

  const handleLocationBChange = (event, newValue) => {
    setSelectedLocationB(newValue);
    if (newValue) {
      setValues({ ...values, location_b: newValue.location_code });
    } else {
      setValues({ ...values, location_b: '' });
    }
  };

  const handleLocationInputChangeA = (event, newInputValue) => {
    setLocationInputValueA(newInputValue);
    
    // Only clear selection if input is completely empty
    if (!newInputValue) {
      setSelectedLocationA(null);
      setValues({ ...values, location_a: '' });
    }
    // No auto-selection - user must click to select
  };

  const handleLocationInputChangeB = (event, newInputValue) => {
    setLocationInputValueB(newInputValue);
    
    // Only clear selection if input is completely empty
    if (!newInputValue) {
      setSelectedLocationB(null);
      setValues({ ...values, location_b: '' });
    }
    // No auto-selection - user must click to select
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleTestResultsFilesChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setTestResultsFiles(selectedFiles);
  };

  const removeTestResultsFile = (index) => {
    setTestResultsFiles(files => files.filter((_, i) => i !== index));
  };

  const handleDeleteExistingFile = async (fileId, fileName) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      await deleteTestResultsFile(fileId);
      setExistingFiles(files => files.filter(f => f.id !== fileId));
      
      // Notify parent component to refresh the table
      if (onFileDeleted) {
        onFileDeleted();
      }
      
      // Show success message
      setError('');
    } catch (err) {
      console.error('Failed to delete file:', err);
      setError('Failed to delete file: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteKMZ = async () => {
    if (!window.confirm('Are you sure you want to delete the KMZ file? This action cannot be undone.')) {
      return;
    }

    setKmzDeleteLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/network_routes/${initialValues.circuit_id}/delete_kmz`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete KMZ file');
      }
      
      // Update the form state to reflect KMZ file removal
      setValues(prev => ({ ...prev, kmz_file_path: '' }));
      setFile(null);
      
      // Notify parent component if needed
      if (onFileDeleted) {
        onFileDeleted();
      }
      
      setError(''); // Clear any existing errors
    } catch (err) {
      console.error('Failed to delete KMZ file:', err);
      setError('Failed to delete KMZ file: ' + err.message);
    } finally {
      setKmzDeleteLoading(false);
    }
  };

  const validateBandwidth = (bandwidth) => {
    if (!bandwidth) return true; // Allow empty bandwidth
    
    // Allow 'Dark Fiber' as text (case insensitive)
    if (bandwidth.toLowerCase() === 'dark fiber') return true;
    
    // Otherwise must be numeric
    const numericValue = parseFloat(bandwidth);
    return !isNaN(numericValue) && numericValue > 0;
  };

  const handleSubmit = async () => {
    try {
      // Validate form using validation framework
      let validationErrors;
      if (isEdit) {
        // For edit mode, don't require circuit_id validation (it's disabled)
        const editValidationRules = {
          mtu: { type: 'required', message: 'MTU is required' },
          expected_latency: { type: 'required', message: 'Expected Latency is required' },
          cost: { type: 'required', message: 'Cost is required' },
          underlying_carrier: { type: 'required', message: 'Underlying Carrier is required' },
          equipment_type: { type: 'required', message: 'Equipment Type is required' },
          bandwidth: { type: 'required', message: 'Bandwidth is required' }
        };
        const editValidate = createValidator(editValidationRules);
        validationErrors = editValidate(values);
      } else {
        validationErrors = validate(values);
      }

      setFormErrors(validationErrors);

      // Check if there are validation errors
      if (Object.keys(validationErrors).length > 0) {
        scrollToFirstError(validationErrors);
        return;
      }

      // Location validations
      if (!selectedLocationA) {
        setError('Location A is required');
        return;
      }
      
      if (!selectedLocationB) {
        setError('Location B is required');
        return;
      }

      // Validate underlying carrier - must be from database
      if (!selectedCarrier) {
        setError('Please select a valid carrier from the list');
        return;
      }

      // Bandwidth validation
      if (!validateBandwidth(values.bandwidth)) {
        setError('Bandwidth must be either "Dark Fiber" or a numeric value');
        return;
      }

      // Circuit ID duplicate prevention (only for add mode)
      if (!isEdit) {
        // You would need to get existing routes here and check for duplicates
        // For now, we'll implement the framework and you can add the actual API call
        const normalizedCircuitId = normalizeText(values.circuit_id);
        // TODO: Add actual duplicate checking against existing routes
        // const existingRoute = existingRoutes.find(route => 
        //   normalizeText(route.circuit_id) === normalizedCircuitId
        // );
        // if (existingRoute) {
        //   setError(`A route with Circuit ID "${values.circuit_id}" already exists. Please use a different Circuit ID.`);
        //   return;
        // }
      }

      setError('');
      setFormErrors({}); // Clear validation errors on success
      onSubmit({ ...values }, file, testResultsFiles);
    } catch (err) {
      setError('An error occurred during validation');
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      disableRestoreFocus
      aria-labelledby="route-form-dialog-title"
    >
      <DialogTitle id="route-form-dialog-title">{isEdit ? 'Edit' : 'Add'} Network Route</DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <ValidatedTextField
              label="Circuit ID - UCN *"
              name="circuit_id"
              value={values.circuit_id}
              onChange={handleChange}
              fullWidth
              required
              disabled={isEdit}
              placeholder="ABCDEF123456"
              inputProps={{ maxLength: 12 }}
              helperText={isEdit ? 'Circuit ID cannot be changed' : 'Format: 6 uppercase letters + 6 digits (e.g., ABCDEF123456)'}
              field="circuit_id"
              errors={formErrors}
              sx={{
                '& .MuiInputBase-input': {
                  backgroundColor: isEdit ? '#f5f5f5' : 'transparent',
                }
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <ValidatedTextField
              label="MTU (bytes) *"
              name="mtu"
              value={values.mtu}
              onChange={handleChange}
              type="number"
              fullWidth
              required
              field="mtu"
              errors={formErrors}
            />
          </Grid>
          <Grid item xs={12}>
            <ValidatedTextField
              label="SLA Latency (ms)"
              name="sla_latency"
              value={values.sla_latency}
              onChange={handleChange}
              type="number"
              step="0.1"
              fullWidth
              field="sla_latency"
              errors={formErrors}
            />
          </Grid>
          <Grid item xs={12}>
            <ValidatedTextField
              label="Expected Latency (ms) *"
              name="expected_latency"
              value={values.expected_latency}
              onChange={handleChange}
              type="number"
              step="0.1"
              fullWidth
              required
              field="expected_latency"
              errors={formErrors}
            />
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                KMZ File
              </Typography>
              
              {values.kmz_file_path && !file ? (
                // Show existing KMZ file with delete option
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, border: '1px solid #ddd', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    Current file: {values.kmz_file_path}
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={handleDeleteKMZ}
                    disabled={kmzDeleteLoading}
                  >
                    {kmzDeleteLoading ? 'Deleting...' : 'Delete'}
                  </Button>
                </Box>
              ) : null}
              
              <Button variant="outlined" component="label" fullWidth>
                {file ? file.name : (values.kmz_file_path ? 'Replace KMZ File' : 'Upload KMZ File')}
                <input type="file" accept=".kmz" hidden onChange={handleFileChange} />
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Test Results Files
              </Typography>
              
              {/* Existing Files Section (only in edit mode) */}
              {isEdit && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Existing Files:
                  </Typography>
                  {fileLoading ? (
                    <Typography variant="body2" color="text.secondary">Loading...</Typography>
                  ) : existingFiles.length > 0 ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {existingFiles.map((file) => (
                        <Chip
                          key={file.id}
                          label={file.original_name}
                          onDelete={() => handleDeleteExistingFile(file.id, file.original_name)}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ mb: 1 }}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No existing files
                    </Typography>
                  )}
                  <Divider sx={{ my: 2 }} />
                </Box>
              )}
              
              {/* New Files Upload Section */}
              <Box>
                <Button variant="outlined" component="label" fullWidth>
                  {testResultsFiles.length > 0 ? `${testResultsFiles.length} New Test Results Files Selected` : 'Upload New Test Results Files (Multiple)'}
                  <input type="file" multiple hidden onChange={handleTestResultsFilesChange} />
                </Button>
                {testResultsFiles.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      New files to upload:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {testResultsFiles.map((file, index) => (
                        <Chip
                          key={index}
                          label={file.name}
                          onDelete={() => removeTestResultsFile(index)}
                          size="small"
                          color="success"
                          sx={{ mb: 1 }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <ValidatedTextField
              label="Cable System"
              name="cable_system"
              value={values.cable_system}
              onChange={handleChange}
              fullWidth
              field="cable_system"
              errors={formErrors}
            />
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              options={carrierOptions}
              getOptionLabel={(option) => option.display_name || option.carrier_name}
              value={selectedCarrier}
              onChange={handleCarrierChange}
              inputValue={carrierInputValue}
              onInputChange={handleCarrierInputChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Underlying Carrier"
                  placeholder="Search carriers..."
                  fullWidth
                  required
                />
              )}
              clearOnBlur={false}
              selectOnFocus={false}
              autoSelect={false}
              handleHomeEndKeys
              noOptionsText="No carriers found - type at least 2 characters to search"
            />
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              multiple
              options={carrierOptions}
              getOptionLabel={(option) => option.display_name || option.carrier_name}
              value={selectedLocalLoopCarriersA}
              onChange={handleLocalLoopCarrierChangeA}
              inputValue={localLoopCarrierInputValueA}
              onInputChange={handleLocalLoopCarrierInputChangeA}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Local Loop Carriers A-End"
                  placeholder="Search carriers..."
                  fullWidth
                  helperText="Select multiple carriers from the database"
                />
              )}
              clearOnBlur={false}
              selectOnFocus={false}
              autoSelect={false}
              handleHomeEndKeys
              noOptionsText="No carriers found - type at least 2 characters to search"
              freeSolo
              isOptionEqualToValue={(option, value) => option.carrier_name === value.carrier_name}
            />
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              multiple
              options={carrierOptions}
              getOptionLabel={(option) => option.display_name || option.carrier_name}
              value={selectedLocalLoopCarriersB}
              onChange={handleLocalLoopCarrierChangeB}
              inputValue={localLoopCarrierInputValueB}
              onInputChange={handleLocalLoopCarrierInputChangeB}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Local Loop Carriers B-End"
                  placeholder="Search carriers..."
                  fullWidth
                  helperText="Select multiple carriers from the database"
                />
              )}
              clearOnBlur={false}
              selectOnFocus={false}
              autoSelect={false}
              handleHomeEndKeys
              noOptionsText="No carriers found - type at least 2 characters to search"
              freeSolo
              isOptionEqualToValue={(option, value) => option.carrier_name === value.carrier_name}
            />
          </Grid>
          <Grid item xs={12}>
            <ValidatedSelect
              fullWidth
              label="Equipment Type *"
              value={values.equipment_type}
              onChange={(e) => handleChange(e)}
              name="equipment_type"
              required
              field="equipment_type"
              errors={formErrors}
            >
              <MenuItem value="Nokia">Nokia</MenuItem>
              <MenuItem value="Cisco">Cisco</MenuItem>
              <MenuItem value="Mixed">Mixed</MenuItem>
            </ValidatedSelect>
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              options={locationOptions}
              getOptionLabel={(option) => option.location_code}
              value={selectedLocationA}
              onChange={handleLocationAChange}
              inputValue={locationInputValueA}
              onInputChange={handleLocationInputChangeA}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Location A"
                  placeholder="Search POP codes..."
                  fullWidth
                  required
                />
              )}
              clearOnBlur={false}
              selectOnFocus={false}
              autoSelect={false}
              handleHomeEndKeys
              noOptionsText="No locations found"
              isOptionEqualToValue={(option, value) => option.location_code === value.location_code}
            />
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              options={locationOptions}
              getOptionLabel={(option) => option.location_code}
              value={selectedLocationB}
              onChange={handleLocationBChange}
              inputValue={locationInputValueB}
              onInputChange={handleLocationInputChangeB}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Location B"
                  placeholder="Search POP codes..."
                  fullWidth
                  required
                />
              )}
              clearOnBlur={false}
              selectOnFocus={false}
              autoSelect={false}
              handleHomeEndKeys
              noOptionsText="No locations found"
              isOptionEqualToValue={(option, value) => option.location_code === value.location_code}
            />
          </Grid>
          <Grid item xs={12}>
            <ValidatedTextField
              label="Bandwidth *"
              name="bandwidth"
              value={values.bandwidth}
              onChange={handleChange}
              fullWidth
              required
              helperText="Enter numeric value (Mbps) or 'Dark Fiber'"
              field="bandwidth"
              errors={formErrors}
            />
          </Grid>
          <Grid item xs={12}>
            <ValidatedTextField
              label="Capacity Usage %"
              name="capacity_usage_percent"
              value={values.capacity_usage_percent}
              onChange={handleChange}
              type="number"
              step="0.1"
              min="0"
              max="1000"
              fullWidth
              helperText="Percentage value (0-1000%)"
              field="capacity_usage_percent"
              errors={formErrors}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <ValidatedTextField
              label="Cost *"
              name="cost"
              value={values.cost}
              onChange={handleChange}
              type="number"
              step="0.01"
              fullWidth
              required
              helperText="Monthly cost (hidden from main table)"
              field="cost"
              errors={formErrors}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <ValidatedSelect
              fullWidth
              label="Currency"
              value={values.currency}
              onChange={(e) => handleChange(e)}
              name="currency"
              field="currency"
              errors={formErrors}
            >
              <MenuItem value="USD">USD - US Dollar</MenuItem>
              <MenuItem value="EUR">EUR - Euro</MenuItem>
              <MenuItem value="GBP">GBP - British Pound</MenuItem>
              <MenuItem value="JPY">JPY - Japanese Yen</MenuItem>
              <MenuItem value="AUD">AUD - Australian Dollar</MenuItem>
              <MenuItem value="CAD">CAD - Canadian Dollar</MenuItem>
            </ValidatedSelect>
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Checkbox checked={!!values.is_special} onChange={handleChange} name="is_special" />}
              label="Special/ULL"
            />
          </Grid>
          <Grid item xs={12}>
            <ValidatedTextField
              label="More Details"
              name="more_details"
              value={values.more_details}
              onChange={handleChange}
              fullWidth
              multiline
              minRows={2}
              field="more_details"
              errors={formErrors}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">{isEdit ? 'Save' : 'Add'}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default RouteFormDialog; 