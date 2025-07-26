import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Button, 
  Select, MenuItem, FormControl, InputLabel, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, LinearProgress, Divider, Stack,
  List, ListItem, ListItemText, ListItemIcon
} from '@mui/material';
import {
  CloudUpload, Download, History, CheckCircle, Error
} from '@mui/icons-material';
import { useAuth } from './AuthContext';
import { ValidatedSelect, createValidator, scrollToFirstError } from './components/FormValidation';
import {
  getBulkUploadModules, downloadBulkUploadTemplate, downloadBulkUploadDatabase,
  uploadBulkData, getBulkUploadHistory
} from './api';

const BulkUpload = () => {
  const { hasRole } = useAuth();
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Validation states
  const [formErrors, setFormErrors] = useState({});

  // Validation rules for Bulk Upload form
  const bulkUploadValidationRules = {
    selectedModule: { type: 'required', message: 'Please select a module' },
    uploadFile: { type: 'required', message: 'Please select a CSV file to upload' }
  };

  // Validation function
  const validate = createValidator(bulkUploadValidationRules);
  
  // History dialog state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      const moduleList = await getBulkUploadModules();
      setModules(moduleList);
    } catch (err) {
      setError('Failed to load available modules');
    }
  };

  const handleTemplateDownload = async () => {
    // Validate module selection
    const validationErrors = validate({ selectedModule, uploadFile: null });
    
    if (validationErrors.selectedModule) {
      setFormErrors({ selectedModule: validationErrors.selectedModule });
      setError('Please select a module first');
      scrollToFirstError(validationErrors);
      return;
    }

    try {
      setError('');
      setFormErrors({});
      await downloadBulkUploadTemplate(selectedModule);
      setSuccess('Template downloaded successfully');
    } catch (err) {
      setError('Failed to download template: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDatabaseDownload = async () => {
    // Validate module selection
    const validationErrors = validate({ selectedModule, uploadFile: null });
    
    if (validationErrors.selectedModule) {
      setFormErrors({ selectedModule: validationErrors.selectedModule });
      setError('Please select a module first');
      scrollToFirstError(validationErrors);
      return;
    }

    try {
      setError('');
      setFormErrors({});
      await downloadBulkUploadDatabase(selectedModule);
      setSuccess('Database export downloaded successfully');
    } catch (err) {
      setError('Failed to download database: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleFileUpload = async () => {
    // Validate form using validation framework
    const validationData = { 
      selectedModule, 
      uploadFile: uploadFile ? uploadFile.name : null 
    };
    const validationErrors = validate(validationData);
    setFormErrors(validationErrors);

    // Check if there are validation errors
    if (Object.keys(validationErrors).length > 0) {
      if (validationErrors.selectedModule) {
        setError('Please select a module first');
      } else if (validationErrors.uploadFile) {
        setError('Please select a CSV file to upload');
      }
      scrollToFirstError(validationErrors);
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    setUploadResult(null);
    setFormErrors({}); // Clear validation errors

    try {
      const response = await uploadBulkData(selectedModule, uploadFile);
      setUploadResult(response.data);
      setSuccess(`Successfully imported ${response.data.rows_imported} rows to ${response.data.module}`);
      setUploadFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('bulk-upload-file');
      if (fileInput) fileInput.value = '';
      
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.errors) {
        setUploadResult(errorData);
        setError(`Upload failed: ${errorData.errors.length} validation error(s) found`);
      } else {
        setError('Upload failed: ' + (errorData?.error || err.message));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        setFormErrors({ uploadFile: ['Please select a CSV file'] });
        event.target.value = '';
        return;
      }
      
      // File size validation (limit to 50MB)
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        setFormErrors({ uploadFile: ['File size must be less than 50MB'] });
        event.target.value = '';
        return;
      }
      
      setUploadFile(file);
      setError('');
      setFormErrors({}); // Clear validation errors
      setUploadResult(null);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await getBulkUploadHistory();
      setHistory(response.data.history);
    } catch (err) {
      setError('Failed to load upload history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleHistoryOpen = () => {
    setHistoryOpen(true);
    loadHistory();
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'BULK_IMPORT': return 'success';
      case 'DOWNLOAD': return 'info';
      case 'EXPORT': return 'warning';
      default: return 'default';
    }
  };

  // Check if user is admin
  if (!hasRole('administrator')) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Access denied. Bulk upload functionality is restricted to administrators only.
        </Alert>
      </Box>
    );
  }

  const selectedModuleInfo = modules.find(m => m.id === selectedModule);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Bulk Upload Facility
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Import CSV data in bulk to any module. Download templates or existing database exports to get started.
        <strong> Administrator access only.</strong>
      </Typography>

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

      <Grid container spacing={3}>
        {/* Module Selection */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                1. Select Module
              </Typography>
              
              <ValidatedSelect
                fullWidth
                label="Choose Module *"
                value={selectedModule}
                onChange={(e) => {
                  setSelectedModule(e.target.value);
                  setFormErrors({}); // Clear validation errors when module changes
                }}
                required
                field="selectedModule"
                errors={formErrors}
                sx={{ mb: 2 }}
              >
                {modules.map((module) => (
                  <MenuItem key={module.id} value={module.id}>
                    {module.name}
                  </MenuItem>
                ))}
              </ValidatedSelect>

              {selectedModuleInfo && (
                <Typography variant="body2" color="text.secondary">
                  {selectedModuleInfo.description}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Template Downloads */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                2. Download Template or Data
              </Typography>
              
              <Stack spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={handleTemplateDownload}
                  disabled={!selectedModule}
                  fullWidth
                >
                  Download CSV Template
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={handleDatabaseDownload}
                  disabled={!selectedModule}
                  fullWidth
                >
                  Download Database Export
                </Button>

                <Typography variant="caption" color="text.secondary">
                  Use the template for new data or database export as a starting point for bulk edits.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* File Upload */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                3. Upload CSV File
              </Typography>
              
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={6}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<CloudUpload />}
                    fullWidth
                    disabled={!selectedModule}
                  >
                    {uploadFile ? uploadFile.name : 'Choose CSV File'}
                    <input
                      id="bulk-upload-file"
                      type="file"
                      accept=".csv"
                      hidden
                      onChange={handleFileChange}
                    />
                  </Button>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Button
                    variant="contained"
                    onClick={handleFileUpload}
                    disabled={!selectedModule || !uploadFile || uploading}
                    fullWidth
                  >
                    {uploading ? 'Uploading...' : 'Upload & Import'}
                  </Button>
                </Grid>
              </Grid>

              {uploading && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Processing CSV file and importing data...
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Upload Results */}
        {uploadResult && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Upload Results
                </Typography>
                
                {uploadResult.message && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <strong>{uploadResult.message}</strong>
                    <br />
                    Module: {uploadResult.module}
                    <br />
                    Rows Imported: {uploadResult.rows_imported}
                  </Alert>
                )}

                {uploadResult.errors && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    <strong>Validation Errors Found:</strong>
                    <br />
                    Total Rows: {uploadResult.total_rows}
                    <br />
                    Valid Rows: {uploadResult.valid_rows}
                    <br />
                    Invalid Rows: {uploadResult.invalid_rows}
                    {uploadResult.message && (
                      <>
                        <br />
                        <em>{uploadResult.message}</em>
                      </>
                    )}
                  </Alert>
                )}

                {uploadResult.errors && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Error Details:
                    </Typography>
                    <List dense>
                      {uploadResult.errors.slice(0, 10).map((error, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <Error color="error" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText primary={error} />
                        </ListItem>
                      ))}
                      {uploadResult.errors.length > 10 && (
                        <ListItem>
                          <ListItemText primary={`... and ${uploadResult.errors.length - 10} more errors`} />
                        </ListItem>
                      )}
                    </List>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="outlined"
              startIcon={<History />}
              onClick={handleHistoryOpen}
            >
              View Upload History
            </Button>
          </Stack>
        </Grid>
      </Grid>

      {/* History Dialog */}
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Bulk Upload History</DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <LinearProgress />
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Module</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                      <TableCell>{log.user_id}</TableCell>
                      <TableCell>
                        <Chip 
                          label={log.action} 
                          color={getActionColor(log.action)} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>
                        {log.new_values ? JSON.parse(log.new_values).module : '-'}
                      </TableCell>
                      <TableCell>
                        {log.new_values && (
                          <Typography variant="body2">
                            {JSON.parse(log.new_values).rows_imported && 
                              `${JSON.parse(log.new_values).rows_imported} rows imported`}
                            {JSON.parse(log.new_values).rows_exported && 
                              `${JSON.parse(log.new_values).rows_exported} rows exported`}
                            {JSON.parse(log.new_values).filename && 
                              ` (${JSON.parse(log.new_values).filename})`}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No upload history found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BulkUpload; 