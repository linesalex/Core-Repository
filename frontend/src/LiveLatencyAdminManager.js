import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Snackbar,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  CircularProgress,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { liveLatencyAdminApi } from './api';
import LoadingIndicator from './components/LoadingIndicator';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`live-latency-tabpanel-${index}`}
      aria-labelledby={`live-latency-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const LiveLatencyAdminManager = ({ hasPermission }) => {
  // State management
  const [currentTab, setCurrentTab] = useState(0);
  const [overview, setOverview] = useState(null);
  const [configurations, setConfigurations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(false);
  
  // Dialog states
  const [configDialog, setConfigDialog] = useState({ open: false, mode: 'add', data: null });
  const [testDialog, setTestDialog] = useState({ open: false, circuitId: null, result: null, loading: false });
  const [logsDialog, setLogsDialog] = useState({ open: false, circuitId: null, logs: [], loading: false });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, config: null });
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadOverview(),
        loadConfigurations()
      ]);
    } catch (error) {
      showSnackbar('Failed to load data: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const data = await liveLatencyAdminApi.getOverview();
      setOverview(data.data);
    } catch (error) {
      console.error('Failed to load overview:', error);
      showSnackbar('Failed to load overview data', 'error');
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadConfigurations = async () => {
    try {
      const data = await liveLatencyAdminApi.getConfigurations();
      setConfigurations(data.data || []);
    } catch (error) {
      console.error('Failed to load configurations:', error);
      showSnackbar('Failed to load configurations', 'error');
    }
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Configuration management
  const handleAddConfig = () => {
    setConfigDialog({
      open: true,
      mode: 'add',
      data: {
        circuit_id: '',
        enabled: true,
        api_base_url: 'https://ivpi-ipcnwk1.ipc.com/api/v1/vistamart/data',
        api_instance_name: '',
        api_indicator: 'AnyVendor - Response Time (ms) - BPI',
        api_parameters: '',
        auth_username: 'infovista_api_ro',
        auth_password: '',
        update_interval_minutes: 15
      }
    });
  };

  const handleEditConfig = (config) => {
    setConfigDialog({
      open: true,
      mode: 'edit',
      data: { ...config }
    });
  };

  const handleDeleteConfig = (config) => {
    setDeleteDialog({ open: true, config });
  };

  const handleConfigSave = async (formData) => {
    try {
      if (configDialog.mode === 'add') {
        await liveLatencyAdminApi.createConfiguration(formData);
        showSnackbar('Configuration created successfully', 'success');
      } else {
        await liveLatencyAdminApi.updateConfiguration(configDialog.data.id, formData);
        showSnackbar('Configuration updated successfully', 'success');
      }
      
      setConfigDialog({ open: false, mode: 'add', data: null });
      await loadData(); // Refresh both overview and configurations
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      showSnackbar('Failed to save configuration: ' + errorMessage, 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await liveLatencyAdminApi.deleteConfiguration(deleteDialog.config.id);
      showSnackbar('Configuration deleted successfully', 'success');
      setDeleteDialog({ open: false, config: null });
      await loadData();
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      showSnackbar('Failed to delete configuration: ' + errorMessage, 'error');
    }
  };

  // Testing functionality
  const handleTestConnection = async (circuitId) => {
    setTestDialog({ open: true, circuitId, result: null, loading: true });
    
    try {
      const result = await liveLatencyAdminApi.testConnection(circuitId);
      setTestDialog(prev => ({ ...prev, result, loading: false }));
      
      // Refresh configurations to update test status
      await loadConfigurations();
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setTestDialog(prev => ({ 
        ...prev, 
        result: { success: false, error: errorMessage }, 
        loading: false 
      }));
    }
  };

  // Logs functionality
  const handleViewLogs = async (circuitId) => {
    setLogsDialog({ open: true, circuitId, logs: [], loading: true });
    
    try {
      const data = await liveLatencyAdminApi.getApiLogs(circuitId);
      setLogsDialog(prev => ({ ...prev, logs: data.data || [], loading: false }));
    } catch (error) {
      console.error('Failed to load logs:', error);
      showSnackbar('Failed to load API logs', 'error');
      setLogsDialog(prev => ({ ...prev, loading: false }));
    }
  };

  // Status helpers
  const getStatusChip = (config) => {
    if (!config.enabled) {
      return <Chip label="Disabled" color="default" size="small" />;
    }
    
    if (config.disabled_until && new Date(config.disabled_until) > new Date()) {
      return <Chip label="Auto-Disabled" color="error" size="small" />;
    }
    
    if (config.failure_count >= 3) {
      return <Chip label="Failed" color="error" size="small" />;
    }
    
    if (config.last_test_status === 'success') {
      return <Chip label="Active" color="success" size="small" />;
    }
    
    if (config.last_test_status === 'failed') {
      return <Chip label="Failed" color="error" size="small" />;
    }
    
    return <Chip label="Not Tested" color="warning" size="small" />;
  };

  const getHealthIcon = (config) => {
    if (!config.enabled) return <WarningIcon color="disabled" />;
    if (config.last_test_status === 'success') return <SuccessIcon color="success" />;
    if (config.last_test_status === 'failed') return <ErrorIcon color="error" />;
    return <InfoIcon color="info" />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (ms) => {
    if (!ms) return 'N/A';
    return `${ms}ms`;
  };

  // Check permissions
  if (!hasPermission || !hasPermission('user_management', 'view')) {
    return (
      <Alert severity="error">
        You do not have permission to access Live Latency API Management.
      </Alert>
    );
  }

  if (loading) {
    return <LoadingIndicator message="Loading Live Latency Management..." />;
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Live Latency API Management
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Dashboard" />
          <Tab label="Configurations" />
        </Tabs>
      </Box>

      {/* Dashboard Tab */}
      <TabPanel value={currentTab} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5">System Overview</Typography>
              <Button
                startIcon={<RefreshIcon />}
                onClick={loadOverview}
                disabled={overviewLoading}
              >
                Refresh
              </Button>
            </Box>
          </Grid>
          
          {overview && (
            <>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Configurations
                    </Typography>
                    <Typography variant="h4">
                      {overview.total_configurations}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Active Circuits
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {overview.active_configurations}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Failed Circuits
                    </Typography>
                    <Typography variant="h4" color="error.main">
                      {overview.failed_configurations}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Success Rate (24h)
                    </Typography>
                    <Typography variant="h4" color={overview.api_success_rate_24h >= 90 ? 'success.main' : 'warning.main'}>
                      {overview.api_success_rate_24h}%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      System Status
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Overall Status:</Typography>
                        <Chip 
                          label={overview.system_status.toUpperCase()} 
                          color={overview.system_status === 'healthy' ? 'success' : 'warning'}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Last Update:</Typography>
                        <Typography>{formatDate(overview.last_successful_update)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Global Refresh Cooldown:</Typography>
                        <Chip 
                          label={overview.global_refresh_on_cooldown ? 'ACTIVE' : 'READY'} 
                          color={overview.global_refresh_on_cooldown ? 'warning' : 'success'}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>API Calls (24h):</Typography>
                        <Typography>{overview.total_api_calls_24h}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
        </Grid>
      </TabPanel>

      {/* Configurations Tab */}
      <TabPanel value={currentTab} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">Circuit Configurations</Typography>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={handleAddConfig}
            disabled={!hasPermission('user_management', 'create')}
          >
            Add Configuration
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Circuit ID</TableCell>
                <TableCell>API Instance</TableCell>
                <TableCell>Last Test</TableCell>
                <TableCell>Response Time</TableCell>
                <TableCell>Failure Count</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {configurations
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getHealthIcon(config)}
                        {getStatusChip(config)}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {config.circuit_id}
                      </Typography>
                      {!config.route_exists && (
                        <Typography variant="caption" color="error">
                          Route not found
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {config.api_instance_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(config.last_test_at)}
                      </Typography>
                      {config.last_test_error && (
                        <Typography variant="caption" color="error" display="block">
                          {config.last_test_error.substring(0, 50)}...
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDuration(config.last_test_response_time_ms)}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={config.failure_count || 0} 
                        color={config.failure_count >= 3 ? 'error' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Test Connection">
                          <IconButton
                            size="small"
                            onClick={() => handleTestConnection(config.circuit_id)}
                          >
                            <TestIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Logs">
                          <IconButton
                            size="small"
                            onClick={() => handleViewLogs(config.circuit_id)}
                          >
                            <HistoryIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleEditConfig(config)}
                            disabled={!hasPermission('user_management', 'edit')}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteConfig(config)}
                            disabled={!hasPermission('user_management', 'delete')}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={configurations.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </TableContainer>
      </TabPanel>

      {/* Configuration Dialog */}
      <ConfigurationDialog
        open={configDialog.open}
        onClose={() => setConfigDialog({ open: false, mode: 'add', data: null })}
        onSave={handleConfigSave}
        mode={configDialog.mode}
        initialData={configDialog.data}
      />

      {/* Test Result Dialog */}
      <TestResultDialog
        open={testDialog.open}
        onClose={() => setTestDialog({ open: false, circuitId: null, result: null, loading: false })}
        circuitId={testDialog.circuitId}
        result={testDialog.result}
        loading={testDialog.loading}
      />

      {/* Logs Dialog */}
      <LogsDialog
        open={logsDialog.open}
        onClose={() => setLogsDialog({ open: false, circuitId: null, logs: [], loading: false })}
        circuitId={logsDialog.circuitId}
        logs={logsDialog.logs}
        loading={logsDialog.loading}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, config: null })}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the configuration for circuit{' '}
            <strong>{deleteDialog.config?.circuit_id}</strong>?
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, config: null })}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Configuration Dialog Component
const ConfigurationDialog = ({ open, onClose, onSave, mode, initialData }) => {
  const [formData, setFormData] = useState(initialData || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const isEdit = mode === 'edit';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEdit ? 'Edit Configuration' : 'Add Configuration'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Circuit ID"
            value={formData.circuit_id || ''}
            onChange={(e) => handleInputChange('circuit_id', e.target.value)}
            disabled={isEdit}
            required
            helperText="6 uppercase letters followed by 6 digits (e.g., NYKPAR279885)"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.enabled || false}
                onChange={(e) => handleInputChange('enabled', e.target.checked)}
              />
            }
            label="Enabled"
          />
          
          <TextField
            label="API Base URL"
            value={formData.api_base_url || ''}
            onChange={(e) => handleInputChange('api_base_url', e.target.value)}
            required
          />
          
          <TextField
            label="API Instance Name"
            value={formData.api_instance_name || ''}
            onChange={(e) => handleInputChange('api_instance_name', e.target.value)}
            required
            helperText="e.g., ipcpar1-epe002_NYKPAR279885_Probe"
          />
          
          <TextField
            label="API Indicator"
            value={formData.api_indicator || ''}
            onChange={(e) => handleInputChange('api_indicator', e.target.value)}
          />
          
          <TextField
            label="Custom API Parameters (JSON)"
            value={formData.api_parameters || ''}
            onChange={(e) => handleInputChange('api_parameters', e.target.value)}
            multiline
            rows={2}
            helperText="Optional JSON object for additional API parameters"
          />
          
          <TextField
            label="Auth Username"
            value={formData.auth_username || ''}
            onChange={(e) => handleInputChange('auth_username', e.target.value)}
          />
          
          <TextField
            label="Auth Password"
            type="password"
            value={formData.auth_password || ''}
            onChange={(e) => handleInputChange('auth_password', e.target.value)}
            helperText={isEdit ? "Leave blank to keep existing password" : ""}
          />
          
          <TextField
            label="Update Interval (minutes)"
            type="number"
            value={formData.update_interval_minutes || 15}
            onChange={(e) => handleInputChange('update_interval_minutes', parseInt(e.target.value))}
            inputProps={{ min: 1, max: 1440 }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={saving}
        >
          {saving ? <CircularProgress size={20} /> : (isEdit ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Test Result Dialog Component
const TestResultDialog = ({ open, onClose, circuitId, result, loading }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Connection Test - {circuitId}
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Testing connection...</Typography>
          </Box>
        ) : result ? (
          <Box sx={{ mt: 1 }}>
            <Alert severity={result.success ? 'success' : 'error'} sx={{ mb: 2 }}>
              {result.success ? 'Connection test successful!' : 'Connection test failed!'}
            </Alert>
            
            {result.success ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Latency:</Typography>
                  <Typography fontWeight="bold">{result.data.latency_ms}ms</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Response Time:</Typography>
                  <Typography>{result.data.response_time_ms}ms</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Data Points:</Typography>
                  <Typography>{result.data.data_points}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Quality Score:</Typography>
                  <Typography>{result.data.quality_score}%</Typography>
                </Box>
              </Box>
            ) : (
              <Typography color="error">
                Error: {result.error}
              </Typography>
            )}
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

// Logs Dialog Component
const LogsDialog = ({ open, onClose, circuitId, logs, loading }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        API Call Logs - {circuitId}
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <LoadingIndicator message="Loading API logs..." />
        ) : (
          <List>
            {logs.map((log, index) => (
              <React.Fragment key={log.id}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1">
                          {log.request_type.toUpperCase()} - {new Date(log.created_at).toLocaleString()}
                        </Typography>
                        <Chip 
                          label={log.response_status || 'Error'} 
                          color={log.response_status >= 200 && log.response_status < 300 ? 'success' : 'error'}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        {log.error_message ? (
                          <Typography color="error" variant="body2">
                            Error: {log.error_message}
                          </Typography>
                        ) : (
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <Typography variant="body2">
                              Latency: {log.final_latency_value}ms
                            </Typography>
                            <Typography variant="body2">
                              Response: {log.response_time_ms}ms
                            </Typography>
                            <Typography variant="body2">
                              Quality: {log.data_quality_score}%
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
                {index < logs.length - 1 && <Divider />}
              </React.Fragment>
            ))}
            {logs.length === 0 && (
              <ListItem>
                <ListItemText primary="No API logs found for this circuit." />
              </ListItem>
            )}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LiveLatencyAdminManager;
