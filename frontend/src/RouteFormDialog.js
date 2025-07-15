import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Grid, Checkbox, FormControlLabel, Typography, Box, Chip, Stack, Divider, Alert,
  Select, MenuItem, FormControl, InputLabel, Autocomplete
} from '@mui/material';
import { uploadTestResults, getTestResultsFiles, deleteTestResultsFile } from './api';
import axios from 'axios';

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
  more_details: ''
};

function RouteFormDialog({ open, onClose, onSubmit, initialValues = {}, isEdit = false, onFileDeleted }) {
  const [values, setValues] = useState(defaultValues);
  const [file, setFile] = useState(null);
  const [testResultsFiles, setTestResultsFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [error, setError] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [carrierOptions, setCarrierOptions] = useState([]);
  const [carrierInputValue, setCarrierInputValue] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState(null);

  useEffect(() => {
    if (isEdit && initialValues && Object.keys(initialValues).length > 0) {
      // When editing, populate with existing values
      setValues({ ...defaultValues, ...initialValues });
      
      // Set the selected carrier based on underlying_carrier value
      if (initialValues.underlying_carrier) {
        setSelectedCarrier({ 
          carrier_name: initialValues.underlying_carrier,
          id: null // We don't have the ID from the initial values
        });
        setCarrierInputValue(initialValues.underlying_carrier);
      }
      
      // Load existing test results files
      loadExistingFiles(initialValues.circuit_id);
    } else {
      // When adding, ensure all fields are blank
      setValues(defaultValues);
      setExistingFiles([]);
      setSelectedCarrier(null);
      setCarrierInputValue('');
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
    setValues(v => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
  };

  const searchCarriers = async (inputValue) => {
    if (inputValue.length < 2) {
      setCarrierOptions([]);
      return;
    }
    
    try {
      const response = await axios.get(`http://localhost:4000/carriers/search?q=${inputValue}`, {
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
    
    // Reset selected carrier if input doesn't match any option
    if (!newInputValue) {
      setSelectedCarrier(null);
      setValues({ ...values, underlying_carrier: '' });
    } else {
      // Check if the input matches any existing carrier option
      const matchingCarrier = carrierOptions.find(option => 
        option.carrier_name.toLowerCase() === newInputValue.toLowerCase()
      );
      
      if (matchingCarrier && matchingCarrier !== selectedCarrier) {
        setSelectedCarrier(matchingCarrier);
        setValues({ ...values, underlying_carrier: matchingCarrier.carrier_name });
      } else if (!matchingCarrier && selectedCarrier) {
        // Input doesn't match any carrier, clear selection
        setSelectedCarrier(null);
        setValues({ ...values, underlying_carrier: '' });
      }
    }
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

  const validateBandwidth = (bandwidth) => {
    if (!bandwidth) return true; // Allow empty bandwidth
    
    // Allow 'Dark Fiber' as text (case insensitive)
    if (bandwidth.toLowerCase() === 'dark fiber') return true;
    
    // Otherwise must be numeric
    const numericValue = parseFloat(bandwidth);
    return !isNaN(numericValue) && numericValue > 0;
  };

  const handleSubmit = () => {
    if (!isEdit && !CIRCUIT_ID_REGEX.test(values.circuit_id)) {
      setError('Circuit ID must be 6 uppercase letters followed by 6 digits');
      return;
    }
    
    if (!validateBandwidth(values.bandwidth)) {
      setError('Bandwidth must be either "Dark Fiber" or a numeric value');
      return;
    }
    
    // Validate underlying carrier - must be from database or empty
    if (values.underlying_carrier && !selectedCarrier) {
      setError('Please select a valid carrier from the list or leave empty');
      return;
    }
    
    setError('');
    onSubmit({ ...values }, file, testResultsFiles);
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
            <TextField
              label="Circuit ID - UCN"
              name="circuit_id"
              value={values.circuit_id}
              onChange={handleChange}
              fullWidth
              required
              disabled={isEdit}
              error={!!error}
              helperText={isEdit ? 'Circuit ID cannot be changed' : error}
              sx={{
                '& .MuiInputBase-input': {
                  backgroundColor: isEdit ? '#f5f5f5' : 'transparent',
                }
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="MTU"
              name="mtu"
              value={values.mtu}
              onChange={handleChange}
              type="number"
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="SLA Latency"
              name="sla_latency"
              value={values.sla_latency}
              onChange={handleChange}
              type="number"
              step="0.1"
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Expected Latency"
              name="expected_latency"
              value={values.expected_latency}
              onChange={handleChange}
              type="number"
              step="0.1"
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <Button variant="outlined" component="label" fullWidth>
              {file ? file.name : (values.kmz_file_path ? values.kmz_file_path : 'Upload KMZ File')}
              <input type="file" accept=".kmz" hidden onChange={handleFileChange} />
            </Button>
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
            <TextField
              label="Cable System"
              name="cable_system"
              value={values.cable_system}
              onChange={handleChange}
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              options={carrierOptions}
              getOptionLabel={(option) => option.carrier_name}
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
                />
              )}
              clearOnBlur
              selectOnFocus
              handleHomeEndKeys
              noOptionsText="No carriers found - type at least 2 characters to search"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Location A"
              name="location_a"
              value={values.location_a}
              onChange={handleChange}
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Location B"
              name="location_b"
              value={values.location_b}
              onChange={handleChange}
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Bandwidth"
              name="bandwidth"
              value={values.bandwidth}
              onChange={handleChange}
              fullWidth
              helperText="Enter numeric value (Mbps) or 'Dark Fiber'"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
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
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Cost"
              name="cost"
              value={values.cost}
              onChange={handleChange}
              type="number"
              step="0.01"
              fullWidth
              helperText="Monthly cost (hidden from main table)"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Currency</InputLabel>
              <Select
                name="currency"
                value={values.currency}
                onChange={handleChange}
                label="Currency"
              >
                <MenuItem value="USD">USD - US Dollar</MenuItem>
                <MenuItem value="EUR">EUR - Euro</MenuItem>
                <MenuItem value="GBP">GBP - British Pound</MenuItem>
                <MenuItem value="JPY">JPY - Japanese Yen</MenuItem>
                <MenuItem value="AUD">AUD - Australian Dollar</MenuItem>
                <MenuItem value="CAD">CAD - Canadian Dollar</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Checkbox checked={!!values.is_special} onChange={handleChange} name="is_special" />}
              label="Special/ULL"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="More Details"
              name="more_details"
              value={values.more_details}
              onChange={handleChange}
              fullWidth
              multiline
              minRows={2}
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