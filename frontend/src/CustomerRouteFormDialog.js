import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Grid,
  MenuItem, Typography, Box, Chip, Stack, Divider, Alert, CircularProgress
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import { ValidatedTextField, ValidatedSelect, createValidator, scrollToFirstError } from './components/FormValidation';
import CustomerAutocomplete from './CustomerAutocomplete';
import LocationSiteField from './LocationSiteField';
import { customerRouteApi } from './api';

const CIRCUIT_ID_REGEX = /^[A-Z]{6}[0-9]{6}$/;

const emptyLocation = { type: 'pop', pop_code: '', custom_id: null, custom_name: '', building_type: null };

const defaultValues = {
  circuit_id: '',
  route_type: 'Service',
  customer_name: '',
  customer_id: null,
  notes: ''
};

function toLocationValue(route, prefix) {
  if (!route) return { ...emptyLocation };
  const type = route[`${prefix}_type`] || 'pop';
  return {
    type,
    pop_code: type === 'custom' ? '' : (route[`${prefix}_pop_code`] || ''),
    custom_id: route[`${prefix}_custom_id`] || null,
    custom_name: type === 'custom' ? (route[`${prefix}_pop_code`] || '') : '',
    building_type: type === 'pop' ? 'datacenter' : null
  };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString();
}

function CustomerRouteFormDialog({ open, onClose, onSubmit, initialValues = {}, isEdit = false }) {
  const [values, setValues] = useState(defaultValues);
  const [locationA, setLocationA] = useState(emptyLocation);
  const [locationB, setLocationB] = useState(emptyLocation);
  const [newFiles, setNewFiles] = useState([]);
  const [kmzHistory, setKmzHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const validationRules = {
    circuit_id: [
      { type: 'required', message: 'Circuit ID is required' },
      { type: 'pattern', pattern: CIRCUIT_ID_REGEX, message: 'Circuit ID must be exactly 6 uppercase letters followed by 6 digits (e.g., ABCDEF123456)' }
    ],
    route_type: { type: 'required', message: 'Type is required' }
  };
  const validate = createValidator(validationRules);

  useEffect(() => {
    if (!open) return;
    setError('');
    setFormErrors({});
    setNewFiles([]);

    if (isEdit && initialValues && initialValues.circuit_id) {
      setValues({
        circuit_id: initialValues.circuit_id || '',
        route_type: initialValues.route_type || 'Service',
        customer_name: initialValues.customer_name || '',
        customer_id: initialValues.customer_id || null,
        notes: initialValues.notes || ''
      });
      setLocationA(toLocationValue(initialValues, 'location_a'));
      setLocationB(toLocationValue(initialValues, 'location_b'));
      loadHistory(initialValues.circuit_id);
    } else {
      setValues(defaultValues);
      setLocationA({ ...emptyLocation });
      setLocationB({ ...emptyLocation });
      setKmzHistory([]);
    }
  }, [open, isEdit, initialValues]);

  const loadHistory = async (circuitId) => {
    setHistoryLoading(true);
    try {
      const files = await customerRouteApi.getKmzHistory(circuitId);
      setKmzHistory(files || []);
    } catch (err) {
      console.error('Failed to load KMZ history:', err);
      setKmzHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'circuit_id') {
      setValues(v => ({ ...v, circuit_id: value.toUpperCase().slice(0, 12) }));
    } else {
      setValues(v => ({ ...v, [name]: value }));
    }
  };

  const handleNewFilesChange = (e) => {
    setNewFiles(Array.from(e.target.files));
  };

  const removeNewFile = (index) => {
    setNewFiles(files => files.filter((_, i) => i !== index));
  };

  const handleUploadNow = async () => {
    if (newFiles.length === 0) return;
    setUploading(true);
    setError('');
    try {
      await customerRouteApi.uploadKmz(values.circuit_id, newFiles);
      setNewFiles([]);
      await loadHistory(values.circuit_id);
    } catch (err) {
      setError('Failed to upload KMZ file(s): ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadKmz = (file) => {
    customerRouteApi.downloadKmz(file.id, file.original_filename);
  };

  const handleDeleteKmz = async (file) => {
    if (!window.confirm(`Delete "${file.original_filename}" from the upload history? This cannot be undone.`)) return;
    try {
      await customerRouteApi.deleteKmz(file.id);
      setKmzHistory(files => files.filter(f => f.id !== file.id));
    } catch (err) {
      setError('Failed to delete KMZ file: ' + (err.response?.data?.error || err.message));
    }
  };

  const validateLocation = (loc, label) => {
    if (loc.type === 'pop' && !loc.pop_code) return `${label} is required`;
    if (loc.type === 'custom' && !loc.custom_id) return `${label} is required`;
    return null;
  };

  const handleSubmit = async () => {
    const validationErrors = validate(values);
    setFormErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      scrollToFirstError(validationErrors);
      return;
    }

    if (!values.customer_name || !values.customer_name.trim()) {
      setError('Customer name is required');
      return;
    }

    const locAError = validateLocation(locationA, 'Location A');
    if (locAError) { setError(locAError); return; }
    const locBError = validateLocation(locationB, 'Location B');
    if (locBError) { setError(locBError); return; }

    setError('');
    setFormErrors({});

    const payload = {
      circuit_id: values.circuit_id,
      route_type: values.route_type,
      customer_name: values.customer_name.trim(),
      customer_id: values.customer_id,
      location_a_type: locationA.type,
      location_a_pop_code: locationA.type === 'pop' ? locationA.pop_code : locationA.custom_name,
      location_a_custom_id: locationA.type === 'custom' ? locationA.custom_id : null,
      location_b_type: locationB.type,
      location_b_pop_code: locationB.type === 'pop' ? locationB.pop_code : locationB.custom_name,
      location_b_custom_id: locationB.type === 'custom' ? locationB.custom_id : null,
      notes: values.notes || ''
    };

    setSaving(true);
    try {
      await onSubmit(payload, newFiles);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus aria-labelledby="customer-route-form-dialog-title">
      <DialogTitle id="customer-route-form-dialog-title">{isEdit ? 'Edit' : 'Add'} Customer Route</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
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
            />
          </Grid>
          <Grid item xs={12}>
            <ValidatedSelect
              label="Type *"
              name="route_type"
              value={values.route_type}
              onChange={handleChange}
              fullWidth
              required
              field="route_type"
              errors={formErrors}
            >
              <MenuItem value="Service">Customer Service KMZ</MenuItem>
              <MenuItem value="Aggregate">Customer Aggregate KMZ</MenuItem>
            </ValidatedSelect>
          </Grid>
          <Grid item xs={12}>
            <CustomerAutocomplete
              label="Customer Name *"
              value={values.customer_name}
              onChange={(name, customerId) => setValues(v => ({ ...v, customer_name: name, customer_id: customerId }))}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <LocationSiteField label="Location A" value={locationA} onChange={setLocationA} />
          </Grid>
          <Grid item xs={12}>
            <LocationSiteField label="Location B" value={locationB} onChange={setLocationB} />
          </Grid>
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              KMZ Files
            </Typography>

            {isEdit && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Upload history (most recent first — every uploaded file stays downloadable):
                </Typography>
                {historyLoading ? (
                  <CircularProgress size={20} />
                ) : kmzHistory.length > 0 ? (
                  <Stack spacing={1}>
                    {kmzHistory.map((file, idx) => (
                      <Box
                        key={file.id}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, border: '1px solid #ddd', borderRadius: 1 }}
                      >
                        {idx === 0 && <Chip label="Current" size="small" color="primary" />}
                        <Typography variant="body2" sx={{ flexGrow: 1 }}>
                          {file.original_filename}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            uploaded {formatDate(file.uploaded_at)}
                          </Typography>
                        </Typography>
                        <Button size="small" startIcon={<DownloadIcon />} onClick={() => handleDownloadKmz(file)}>
                          Download
                        </Button>
                        <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteKmz(file)}>
                          Delete
                        </Button>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No KMZ files uploaded yet
                  </Typography>
                )}
                <Divider sx={{ my: 2 }} />
              </Box>
            )}

            <Button variant="outlined" component="label" fullWidth>
              {newFiles.length > 0 ? `${newFiles.length} file(s) selected` : 'Select KMZ File(s)'}
              <input type="file" accept=".kmz" multiple hidden onChange={handleNewFilesChange} />
            </Button>
            {newFiles.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {newFiles.map((file, index) => (
                    <Chip
                      key={index}
                      label={file.name}
                      onDelete={() => removeNewFile(index)}
                      size="small"
                      color="success"
                      sx={{ mb: 1 }}
                    />
                  ))}
                </Stack>
                {isEdit && (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleUploadNow}
                    disabled={uploading}
                    sx={{ mt: 1 }}
                  >
                    {uploading ? 'Uploading...' : 'Upload Now'}
                  </Button>
                )}
                {!isEdit && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Files will be uploaded once the route is created.
                  </Typography>
                )}
              </Box>
            )}
          </Grid>
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Notes"
              name="notes"
              value={values.notes}
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
        <Button onClick={handleSubmit} variant="contained" disabled={saving}>
          {saving ? 'Saving...' : (isEdit ? 'Save' : 'Add')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CustomerRouteFormDialog;
