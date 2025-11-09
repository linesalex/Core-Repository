import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Alert, CircularProgress,
  Grid, Card, CardContent, CardActions, Divider
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import DescriptionIcon from '@mui/icons-material/Description';
import { getSystemSettings, updateSystemSetting } from './api';

const SystemSettingsManager = ({ hasRole }) => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editedValues, setEditedValues] = useState({});

  useEffect(() => {
    loadSettings();
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
    </Box>
  );
};

export default SystemSettingsManager;

