import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Alert, CircularProgress,
  Grid, Card, CardContent, CardActions, Divider, Chip, IconButton
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import DescriptionIcon from '@mui/icons-material/Description';
import MapIcon from '@mui/icons-material/Map';
import GavelIcon from '@mui/icons-material/Gavel';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import { getSystemSettings, updateSystemSetting, uploadKMZTemplate, getKMZTemplateInfo, downloadKMZTemplate } from './api';

const SystemSettingsManager = ({ hasRole }) => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editedValues, setEditedValues] = useState({});

  // KMZ Template state
  const [locationsTemplate, setLocationsTemplate] = useState(null);
  const [disclaimerTemplate, setDisclaimerTemplate] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateUploading, setTemplateUploading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadTemplateInfo();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getSystemSettings();
      setSettings(data);
      // Initialize edited values with current values
      const initialValues = {};
      data.forEach(setting => {
        initialValues[setting.setting_key] = setting.setting_value;
      });
      setEditedValues(initialValues);
    } catch (err) {
      setError('Failed to load system settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (key, value) => {
    setEditedValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async (key) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await updateSystemSetting(key, editedValues[key]);
      setSuccess('Setting updated successfully');
      await loadSettings(); // Reload to get updated timestamp
    } catch (err) {
      setError('Failed to update setting: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = (key) => {
    const setting = settings.find(s => s.setting_key === key);
    return setting && editedValues[key] !== setting.setting_value;
  };

  // KMZ Template functions
  const loadTemplateInfo = async () => {
    try {
      setTemplateLoading(true);
      
      // Load locations template info
      try {
        const locInfo = await getKMZTemplateInfo('locations');
        setLocationsTemplate(locInfo);
      } catch (err) {
        // Template not found is OK
        setLocationsTemplate(null);
      }
      
      // Load disclaimer template info
      try {
        const discInfo = await getKMZTemplateInfo('disclaimer');
        setDisclaimerTemplate(discInfo);
      } catch (err) {
        // Template not found is OK
        setDisclaimerTemplate(null);
      }
    } catch (err) {
      console.error('Failed to load template info:', err);
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleTemplateUpload = async (templateType, event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.kmz')) {
      setError('Only KMZ files are allowed');
      return;
    }
    
    try {
      setTemplateUploading(true);
      setError('');
      setSuccess('');
      
      await uploadKMZTemplate(templateType, file);
      setSuccess(`${templateType === 'locations' ? 'Locations' : 'Disclaimer'} template uploaded successfully`);
      
      // Reload template info
      await loadTemplateInfo();
    } catch (err) {
      setError(`Failed to upload ${templateType} template: ${err.message}`);
    } finally {
      setTemplateUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleTemplateDownload = async (templateType) => {
    try {
      setError('');
      await downloadKMZTemplate(templateType);
    } catch (err) {
      setError(`Failed to download ${templateType} template: ${err.message}`);
    }
  };

  if (!hasRole || !hasRole('administrator')) {
    return (
      <Alert severity="error">
        You don't have permission to access System Settings. Administrator role required.
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4">System Settings</Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadSettings}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Loading State */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {settings.map((setting) => (
            <Grid item xs={12} md={6} key={setting.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <DescriptionIcon color="action" />
                    <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                      {setting.setting_key.replace(/_/g, ' ')}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {setting.description}
                  </Typography>

                  <TextField
                    fullWidth
                    label="Value"
                    value={editedValues[setting.setting_key] || ''}
                    onChange={(e) => handleValueChange(setting.setting_key, e.target.value)}
                    variant="outlined"
                    size="small"
                    helperText={
                      setting.updated_at
                        ? `Last updated: ${new Date(setting.updated_at).toLocaleString()}`
                        : 'Never updated'
                    }
                  />
                </CardContent>
                <Divider />
                <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={() => handleSave(setting.setting_key)}
                    disabled={saving || !hasChanges(setting.setting_key)}
                  >
                    {hasChanges(setting.setting_key) ? 'Save Changes' : 'No Changes'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {!loading && settings.length === 0 && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No system settings configured.
          </Typography>
        </Paper>
      )}

      {/* KMZ Template Management Section */}
      <Box sx={{ mt: 5 }}>
        <Divider sx={{ mb: 3 }} />
        <Typography variant="h5" sx={{ mb: 3 }}>
          KMZ Template Management
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Upload KMZ templates for network design exports. The locations template should contain all POP code locations, and the disclaimer will be bundled with every export.
        </Typography>

        <Grid container spacing={3}>
          {/* Locations Template */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <MapIcon color="primary" />
                  <Typography variant="h6">
                    Locations Template
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  KMZ file containing all network location points with POP codes
                </Typography>

                {locationsTemplate ? (
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'success.50', borderRadius: 1, border: 1, borderColor: 'success.200' }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                      ✓ Template Uploaded
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', mt: 1 }}>
                      <strong>File:</strong> {locationsTemplate.filename}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      <strong>Uploaded by:</strong> {locationsTemplate.uploaded_by_username || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      <strong>Date:</strong> {new Date(locationsTemplate.uploaded_at).toLocaleString()}
                    </Typography>
                  </Box>
                ) : (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    No locations template uploaded. Source/destination points will not be added to exports.
                  </Alert>
                )}
              </CardContent>
              <Divider />
              <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                {locationsTemplate && (
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleTemplateDownload('locations')}
                  >
                    Download
                  </Button>
                )}
                <Button
                  variant="contained"
                  component="label"
                  size="small"
                  startIcon={<UploadIcon />}
                  disabled={templateUploading}
                >
                  {locationsTemplate ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    hidden
                    accept=".kmz"
                    onChange={(e) => handleTemplateUpload('locations', e)}
                  />
                </Button>
              </CardActions>
            </Card>
          </Grid>

          {/* Disclaimer Template */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <GavelIcon color="error" />
                  <Typography variant="h6">
                    Disclaimer Template
                  </Typography>
                  <Chip label="Required" size="small" color="error" />
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  KMZ file containing legal disclaimer and terms (mandatory for exports)
                </Typography>

                {disclaimerTemplate ? (
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'success.50', borderRadius: 1, border: 1, borderColor: 'success.200' }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                      ✓ Template Uploaded
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', mt: 1 }}>
                      <strong>File:</strong> {disclaimerTemplate.filename}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      <strong>Uploaded by:</strong> {disclaimerTemplate.uploaded_by_username || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      <strong>Date:</strong> {new Date(disclaimerTemplate.uploaded_at).toLocaleString()}
                    </Typography>
                  </Box>
                ) : (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    No disclaimer template uploaded. KMZ exports will be disabled until this is uploaded.
                  </Alert>
                )}
              </CardContent>
              <Divider />
              <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                {disclaimerTemplate && (
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleTemplateDownload('disclaimer')}
                  >
                    Download
                  </Button>
                )}
                <Button
                  variant="contained"
                  component="label"
                  size="small"
                  startIcon={<UploadIcon />}
                  disabled={templateUploading}
                >
                  {disclaimerTemplate ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    hidden
                    accept=".kmz"
                    onChange={(e) => handleTemplateUpload('disclaimer', e)}
                  />
                </Button>
              </CardActions>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default SystemSettingsManager;

