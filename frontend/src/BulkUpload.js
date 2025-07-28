import React, { useState, useEffect, useRef } from 'react';
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
  getBulkUploadModules,
  downloadBulkUploadTemplate,
  downloadBulkUploadDatabase,
  uploadBulkData,
  getBulkUploadProgress,
  getBulkUploadHistory
} from './api';

const BulkUpload = ({ onDataRefresh }) => {
  const { hasRole } = useAuth();
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Progress tracking states
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadCompleted, setUploadCompleted] = useState(false); // Track if upload completed successfully
  
  // Use ref to store interval for reliable cleanup
  const progressIntervalRef = useRef(null);
  const timeoutRef = useRef(null);

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

  // Enhanced cleanup function to reset ALL upload state
  const cleanupUploadState = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setUploading(false);
    setUploadProgress(null);
    setUploadResult(null);
    setError('');
    setSuccess('');
    setUploadCompleted(false); // Reset completion flag
  };

  // Cleanup function that preserves success messages and results for user viewing
  const cleanupUploadStateKeepResults = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setUploading(false);
    // Don't clear: setUploadProgress, setUploadResult, setSuccess - let user see results
    setError(''); // Clear errors but keep success
  };

  // Complete reset function for after errors
  const resetAllState = () => {
    cleanupUploadState();
    setFormErrors({});
    setSelectedModule('');
    setUploadFile(null);
    
    // Reset file input
    const fileInput = document.getElementById('bulk-upload-file');
    if (fileInput) fileInput.value = '';
  };

  const handleClearErrors = () => {
    // Targeted reset instead of full page refresh to preserve authentication
    setError('');
    setUploadResult(null);
    setUploadProgress(null);
    setFormErrors({});
    setSuccess('');
    setSelectedModule('');
    setUploadFile(null);
    setUploading(false);
    setUploadCompleted(false); // Reset completion flag
    
    // Clear any active polling and timeouts
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Reset file input
    const fileInput = document.getElementById('bulk-upload-file');
    if (fileInput) fileInput.value = '';
    
    // Reload the modules list to ensure fresh state
    loadModules();
  };

  useEffect(() => {
    loadModules();
  }, []);

  // Cleanup progress polling on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []); // Empty dependency array since we're using ref

  const loadModules = async () => {
    try {
      const moduleList = await getBulkUploadModules();
      setModules(moduleList);
    } catch (err) {
      setError('Failed to load available modules');
    }
  };

  const pollProgress = async (sessionId) => {
    // Don't continue polling if upload already completed successfully
    if (uploadCompleted) {
      console.log('Skipping pollProgress - upload already completed successfully');
      return;
    }
    
    try {
      const response = await getBulkUploadProgress(sessionId);
      const progressData = response.data;
      
      setUploadProgress(progressData);
      
      // Stop polling if upload is completed or failed
      if (progressData.status === 'completed' || progressData.status === 'error') {
        console.log(`Upload status: ${progressData.status}, stopping polling interval`);
        
        // Completely stop the polling interval
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
          console.log('Polling interval cleared');
        }
        
        if (progressData.status === 'completed') {
          console.log('Upload completed successfully, setting completion flag');
          
          // Mark upload as completed to prevent further polling
          setUploadCompleted(true);
          
          // Explicitly clear any previous errors before showing success
          setError('');
          setUploadResult(progressData.result);
          setSuccess(`Successfully imported ${progressData.result.rows_imported} rows to ${progressData.result.module}`);
          setUploadFile(null);
          setUploading(false);
          
          // Reset file input
          const fileInput = document.getElementById('bulk-upload-file');
          if (fileInput) fileInput.value = '';
          
          // Delay data refresh to allow user to see results for 60 seconds
          setTimeout(() => {
            if (onDataRefresh && typeof onDataRefresh === 'function') {
              console.log('Refreshing application data after successful bulk upload (delayed 60 seconds)');
              onDataRefresh();
            }
          }, 60000); // 60 seconds delay
        } else if (progressData.status === 'error') {
          console.log('Upload failed with errors');
          setUploading(false);
          if (progressData.errors && progressData.errors.length > 0) {
            setUploadResult({
              errors: progressData.errors,
              total_rows: progressData.totalRows,
              valid_rows: progressData.validRows,
              invalid_rows: progressData.errorRows
            });
            setError(`Upload failed: ${progressData.errors.length} validation error(s) found. Please review and fix the errors below.`);
          } else {
            setError('Upload failed: ' + progressData.stage);
          }
        }
        
        // Clear progress after 60 seconds to allow user to see results
        setTimeout(() => {
          setUploadProgress(null);
        }, 60000); // Extended from 3 seconds to 60 seconds
      }
    } catch (err) {
      console.error('Failed to poll progress:', err);
      
      // Don't show errors if upload already completed successfully
      if (uploadCompleted) {
        console.log('Ignoring polling error - upload already completed successfully');
        return;
      }
      
      // Stop polling on session not found or other critical errors
      if (err.response?.status === 404 || err.response?.status === 500 || 
          err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        console.log('Stopping progress polling due to error:', err.response?.status || err.code);
        
        // Completely stop the polling interval
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
          console.log('Polling interval cleared due to error');
        }
        
        setUploading(false);
        
        // Only set error if upload hasn't completed successfully
        if (!uploadCompleted) {
          // Set appropriate error message with recovery guidance
          if (err.response?.status === 404) {
            setError('Upload session expired. Please try uploading again.');
          } else {
            setError('Network connection issue during upload. Please check your connection and try again.');
          }
        }
        
        // Clear progress state but keep form intact
        setUploadProgress(null);
      }
      // For other errors (like temporary 503s), continue polling
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

    // Clear any previous state
    setUploading(true);
    setError('');
    setSuccess('');
    setUploadResult(null);
    setUploadProgress(null);
    setFormErrors({});
    setUploadCompleted(false); // Reset completion flag for new upload
    
    // Clear any existing progress polling
    cleanupUploadState();

    try {
      const response = await uploadBulkData(selectedModule, uploadFile);
      const responseData = response.data;
      
      // Check if we got a sessionId for progress tracking
      if (responseData.sessionId) {
        // Start polling for progress
        const interval = setInterval(() => {
          pollProgress(responseData.sessionId);
        }, 1000); // Poll every second
        
        progressIntervalRef.current = interval;
        
        // Safety timeout to prevent infinite polling (10 minutes)
        timeoutRef.current = setTimeout(() => {
          if (progressIntervalRef.current) {
            console.log('Upload timeout reached, stopping progress polling');
            cleanupUploadState();
            setError('Upload timeout reached. Please try again or contact support if the issue persists.');
          }
        }, 10 * 60 * 1000);
        
        // Initial progress state
        setUploadProgress({
          status: 'processing',
          stage: 'Upload started...',
          progress: 10,
          totalRows: 0,
          processedRows: 0,
          validRows: 0,
          errorRows: 0
        });
      } else {
        // Fallback for immediate responses (e.g., validation errors)
        setUploading(false);
        if (responseData.rows_imported) {
          // Mark upload as completed
          setUploadCompleted(true);
          
          // Explicitly clear any previous errors before showing success
          setError('');
          setUploadResult(responseData);
          setSuccess(`Successfully imported ${responseData.rows_imported} rows to ${responseData.module}`);
          setUploadFile(null);
          
          // Reset file input
          const fileInput = document.getElementById('bulk-upload-file');
          if (fileInput) fileInput.value = '';
          
          // Delay data refresh to allow user to see results for 60 seconds
          setTimeout(() => {
            if (onDataRefresh && typeof onDataRefresh === 'function') {
              console.log('Refreshing application data after successful bulk upload (delayed 60 seconds)');
              onDataRefresh();
            }
          }, 60000); // 60 seconds delay
        }
      }
      
    } catch (err) {
      console.error('Upload failed:', err);
      setUploading(false);
      const errorData = err.response?.data;
      
      // Clear any progress polling immediately on error
      cleanupUploadState();
      
      if (errorData?.errors) {
        // Validation errors - display them but keep the form intact for fixing
        setUploadResult(errorData);
        setError(`Upload failed: ${errorData.errors.length} validation error(s) found. Please review and fix the errors below.`);
        console.log('Validation errors:', errorData.errors);
      } else if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        // Network errors - provide clear guidance and allow retry
        setError('Network connection issue. Please check your connection and try again. If the problem persists, try refreshing the page.');
        setUploadResult(null);
      } else if (err.response?.status === 413) {
        // File too large
        setError('File is too large. Please reduce the file size and try again.');
        setUploadResult(null);
      } else if (err.response?.status === 401) {
        // Authentication error
        setError('Session expired. Please refresh the page and log in again.');
        setUploadResult(null);
      } else {
        // Other errors
        setError('Upload failed: ' + (errorData?.error || err.message || 'Unknown error occurred'));
        setUploadResult(null);
      }
      
      // Reset progress state
      setUploadProgress(null);
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
      // Clear all previous state when a new file is selected
      setError('');
      setSuccess('');
      setFormErrors({});
      setUploadResult(null);
      setUploadProgress(null);
      
      // Clear any existing progress polling
      cleanupUploadState();
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
        <Alert 
          severity="error" 
          sx={{ mb: 2 }} 
          onClose={handleClearErrors}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleClearErrors}
              sx={{ ml: 1 }}
            >
              Reset & Retry
            </Button>
          }
        >
          <strong>Upload Failed:</strong> {error}
          {uploadResult?.errors && uploadResult.errors.length > 0 && (
            <Box sx={{ mt: 1, fontSize: '0.875rem', opacity: 0.8 }}>
              💡 <strong>Tip:</strong> All validation errors are now shown below. Fix them in your CSV file and retry the upload.
            </Box>
          )}
          {error.includes('Network connection') && (
            <Box sx={{ mt: 1, fontSize: '0.875rem', opacity: 0.8 }}>
              💡 <strong>Tip:</strong> Click "Reset & Retry" to completely reset the upload state and try again.
            </Box>
          )}
        </Alert>
      )}

      {success && (
        <Alert 
          severity="success" 
          sx={{ mb: 2 }} 
          onClose={() => setSuccess('')}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleClearErrors}
              sx={{ ml: 1 }}
            >
              Reset & Upload More
            </Button>
          }
        >
          <strong>Upload Successful!</strong> {success}
          {uploadResult && (
            <Box sx={{ mt: 1, fontSize: '0.875rem', opacity: 0.8 }}>
              ℹ️ <strong>Note:</strong> Results will remain visible for 60 seconds. The application data will refresh automatically after this time.
            </Box>
          )}
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
                    // Clear all state when module changes
                    setFormErrors({});
                    setError('');
                    setSuccess('');
                    setUploadResult(null);
                    setUploadProgress(null);
                    
                    // Clear any existing progress polling
                    if (progressIntervalRef.current) {
                      clearInterval(progressIntervalRef.current);
                      progressIntervalRef.current = null;
                    }
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

              {(uploading || uploadProgress) && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress 
                    variant={uploadProgress?.progress ? "determinate" : "indeterminate"}
                    value={uploadProgress?.progress || 0}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {uploadProgress?.stage || 'Processing CSV file and importing data...'}
                  </Typography>
                  {uploadProgress && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {uploadProgress.progress}% complete
                      {uploadProgress.totalRows > 0 && (
                        <> • {uploadProgress.processedRows}/{uploadProgress.totalRows} rows processed</>
                      )}
                      {uploadProgress.validRows > 0 && (
                        <> • {uploadProgress.validRows} valid, {uploadProgress.errorRows} errors</>
                      )}
                    </Typography>
                  )}
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