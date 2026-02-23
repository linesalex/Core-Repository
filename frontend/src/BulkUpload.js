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
import * as XLSX from 'xlsx';
import { useAuth } from './AuthContext';
import { ValidatedSelect, createValidator, scrollToFirstError } from './components/FormValidation';
import {
  getBulkUploadModules,
  downloadBulkUploadTemplate,
  downloadBulkUploadDatabase,
  uploadBulkData,
  getBulkUploadProgress,
  getBulkUploadHistory,
  getCNXRacksList,
  downloadRackDeviceExport
} from './api';
import { carrierQuoteApi } from './api';

const CARRIER_QUOTE_MODULE_ID = 'carrier_quotes';

const CARRIER_QUOTE_FIELDS = [
  { label: 'Internal Reference (QR)', field: 'quote_reference', instruction: 'Optional - auto-generated if left blank' },
  { label: 'Carrier Name', field: 'carrier_name', instruction: 'Required - will be matched to existing carriers' },
  { label: 'Carrier Quote Reference', field: 'carrier_quote_ref', instruction: 'The carrier\'s own reference number' },
  { label: 'Service Type', field: 'service_type', instruction: 'MPLS | Ethernet | Dark Fiber | Wavelength' },
  { label: 'Region', field: 'region', instruction: 'AMERs | APAC | EMEA | INTER' },
  { label: 'Location A POP Code', field: 'location_a_pop_code', instruction: 'Enter POP code (e.g. IPCLON7) OR fill in Name/Address/City/Country below' },
  { label: 'Location A Name', field: '_loc_a_name', instruction: 'Only required if POP code is not provided' },
  { label: 'Location A Address', field: '_loc_a_address', instruction: 'Street address for custom location' },
  { label: 'Location A City', field: '_loc_a_city', instruction: 'City for custom location' },
  { label: 'Location A Country', field: '_loc_a_country', instruction: 'Country for custom location' },
  { label: 'Location B POP Code', field: 'location_b_pop_code', instruction: 'Enter POP code (e.g. IPCLON7) OR fill in Name/Address/City/Country below' },
  { label: 'Location B Name', field: '_loc_b_name', instruction: 'Only required if POP code is not provided' },
  { label: 'Location B Address', field: '_loc_b_address', instruction: 'Street address for custom location' },
  { label: 'Location B City', field: '_loc_b_city', instruction: 'City for custom location' },
  { label: 'Location B Country', field: '_loc_b_country', instruction: 'Country for custom location' },
  { label: 'Bandwidth Unit', field: 'bandwidth_unit', instruction: 'Mbps | Gbps | Dark Fiber' },
  { label: 'Bandwidth Value', field: 'bandwidth_value', instruction: 'Not required if Bandwidth Unit is Dark Fiber' },
  { label: 'Currency', field: 'currency', instruction: 'e.g. USD, EUR, GBP' },
  { label: 'MRC (12 Month)', field: 'mrc_12', instruction: 'Monthly Recurring Cost for 12-month term. Leave blank if not quoted.' },
  { label: 'NRC (12 Month)', field: 'nrc_12', instruction: 'Non-Recurring Cost for 12-month term. Leave blank if not quoted.' },
  { label: 'MRC (24 Month)', field: 'mrc_24', instruction: 'Monthly Recurring Cost for 24-month term. Leave blank if not quoted.' },
  { label: 'NRC (24 Month)', field: 'nrc_24', instruction: 'Non-Recurring Cost for 24-month term. Leave blank if not quoted.' },
  { label: 'MRC (36 Month)', field: 'mrc_36', instruction: 'Monthly Recurring Cost for 36-month term. Leave blank if not quoted.' },
  { label: 'NRC (36 Month)', field: 'nrc_36', instruction: 'Non-Recurring Cost for 36-month term. Leave blank if not quoted.' },
  { label: 'Expected Latency (ms)', field: 'expected_latency', instruction: 'Round-trip latency in milliseconds' },
  { label: 'Protection', field: 'protection', instruction: 'Unprotected | Protected' },
  { label: 'Cable System', field: 'cable_system', instruction: 'Name of submarine cable system if applicable' },
  { label: 'Quote Date', field: 'quote_date', instruction: 'DD/MM/YYYY e.g. 23/02/2026' },
  { label: 'Quote Validity (Days)', field: '_quote_validity_days', instruction: 'Number of days from quote date e.g. 60' },
  { label: 'MTU', field: 'mtu', instruction: 'Maximum Transmission Unit' },
  { label: 'Notes', field: 'notes', instruction: 'Any additional notes' }
];

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
  
  // CNX Rack Devices dropdown states
  const [cnxLocations, setCnxLocations] = useState([]);
  const [selectedCnxLocation, setSelectedCnxLocation] = useState('');
  const [selectedCnxRack, setSelectedCnxRack] = useState('');

  // History dialog state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Carrier quote bulk upload state
  const [carrierQuoteResults, setCarrierQuoteResults] = useState(null);
  const isCarrierQuoteModule = selectedModule === CARRIER_QUOTE_MODULE_ID;

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
    setSelectedCnxLocation('');
    setSelectedCnxRack('');
    
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
    setUploadCompleted(false);
    setSelectedCnxLocation('');
    setSelectedCnxRack('');
    
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
      const carrierQuoteModule = {
        id: CARRIER_QUOTE_MODULE_ID,
        name: 'Carrier Quotes',
        description: 'Bulk import carrier quotes from Excel. Each sheet = one quote. Download the template and duplicate sheets for multiple quotes.'
      };
      const hasCarrierQuote = moduleList.some(m => m.id === CARRIER_QUOTE_MODULE_ID);
      setModules(hasCarrierQuote ? moduleList : [carrierQuoteModule, ...moduleList]);
    } catch (err) {
      setError('Failed to load available modules');
    }
  };

  const loadCNXRacksList = async () => {
    try {
      const response = await getCNXRacksList();
      setCnxLocations(response.data);
    } catch (err) {
      console.error('Failed to load CNX locations:', err);
    }
  };

  // Normalise date values from Excel (may come as serial numbers or various formats)
  const normaliseDateValue = (val) => {
    if (!val) return '';
    if (typeof val === 'number') {
      // Excel serial date number
      const d = XLSX.SSF.parse_date_code(val);
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dmySlash = s.match(/^(\d{1,2})[/](\d{1,2})[/](\d{4})$/);
    if (dmySlash) {
      const day = parseInt(dmySlash[1], 10);
      const month = parseInt(dmySlash[2], 10);
      const year = parseInt(dmySlash[3], 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    const dmyDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmyDash) {
      const day = parseInt(dmyDash[1], 10);
      const month = parseInt(dmyDash[2], 10);
      const year = parseInt(dmyDash[3], 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return s;
  };

  // Download carrier quote Excel template
  const handleCarrierQuoteTemplateDownload = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [['Field', 'Value', 'Instructions']];
    CARRIER_QUOTE_FIELDS.forEach(r => wsData.push([r.label, '', r.instruction]));
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 28 }, { wch: 30 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Quote 1');

    const instrWs = XLSX.utils.aoa_to_sheet([
      ['Carrier Quote Bulk Upload Instructions'],
      [''],
      ['1. Each sheet represents one carrier quote.'],
      ['2. Duplicate the "Quote 1" sheet for each additional quote you want to add.'],
      ['3. Fill in Column B (Value) for each field. Column A (Field) must not be changed.'],
      ['4. Required fields: Carrier Name, Service Type, Region, Bandwidth Unit.'],
      ['5. Bandwidth Value is required unless Bandwidth Unit is "Dark Fiber".'],
      ['6. Dates should be entered as DD/MM/YYYY (e.g. 23/02/2026).'],
      ['7. Save the file and upload via the Bulk Upload facility.'],
      [''],
      ['Duplicate sheet for multi quote entry.']
    ]);
    instrWs['!cols'] = [{ wch: 70 }];
    XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');

    XLSX.writeFile(wb, 'carrier_quote_bulk_template.xlsx');
    setSuccess('Carrier quote template downloaded');
  };

  // Parse a single Excel sheet into quote data
  const parseCarrierQuoteSheet = (ws) => {
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
    const dataMap = {};
    const startIdx = data.length > 0 && String(data[0][0] || '').trim().toLowerCase() === 'field' ? 1 : 0;
    for (let i = startIdx; i < data.length; i++) {
      const row = data[i] || [];
      const label = String(row[0] || '').trim();
      const value = row[1] !== undefined && row[1] !== null ? row[1] : '';
      if (label) dataMap[label] = value;
    }

    const quoteData = {};
    const dateFields = ['quote_date'];
    let fieldsPopulated = 0;
    let validityDays = '';
    const customLocA = {};
    const customLocB = {};

    CARRIER_QUOTE_FIELDS.forEach(r => {
      const val = dataMap[r.label];
      if (val !== undefined && val !== '') {
        const strVal = String(val).trim();
        if (r.field === '_quote_validity_days') {
          validityDays = strVal;
        } else if (r.field.startsWith('_loc_a_')) {
          customLocA[r.field.replace('_loc_a_', '')] = strVal;
        } else if (r.field.startsWith('_loc_b_')) {
          customLocB[r.field.replace('_loc_b_', '')] = strVal;
        } else if (!r.field.startsWith('_')) {
          quoteData[r.field] = dateFields.includes(r.field) ? normaliseDateValue(val) : strVal;
        }
        fieldsPopulated++;
      }
    });

    // Calculate expiry_date from quote_date + validity days
    if (quoteData.quote_date && validityDays && parseInt(validityDays, 10) > 0) {
      const d = new Date(quoteData.quote_date);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + parseInt(validityDays, 10));
        quoteData.expiry_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }

    return { quoteData, customLocA, customLocB, fieldsPopulated };
  };

  // Handle carrier quote bulk upload
  const handleCarrierQuoteBulkUpload = async () => {
    if (!uploadFile) {
      setError('Please select an Excel file');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    setCarrierQuoteResults(null);
    setUploadResult(null);

    try {
      const arrayBuffer = await uploadFile.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });

      const quoteSheets = wb.SheetNames.filter(n => n.toLowerCase() !== 'instructions');
      if (quoteSheets.length === 0) {
        setError('No quote sheets found. Ensure sheets are named (not "Instructions").');
        setUploading(false);
        return;
      }

      const results = { total: quoteSheets.length, created: 0, failed: 0, details: [] };

      for (let i = 0; i < quoteSheets.length; i++) {
        const sheetName = quoteSheets[i];
        const ws = wb.Sheets[sheetName];
        const { quoteData, customLocA, customLocB, fieldsPopulated } = parseCarrierQuoteSheet(ws);

        if (fieldsPopulated === 0) {
          results.failed++;
          results.details.push({ sheet: sheetName, status: 'skipped', message: 'No data found' });
          continue;
        }

        if (!quoteData.carrier_name) {
          results.failed++;
          results.details.push({ sheet: sheetName, status: 'error', message: 'Carrier Name is required' });
          continue;
        }
        if (!quoteData.service_type) {
          results.failed++;
          results.details.push({ sheet: sheetName, status: 'error', message: 'Service Type is required' });
          continue;
        }
        if (!quoteData.region) {
          results.failed++;
          results.details.push({ sheet: sheetName, status: 'error', message: 'Region is required' });
          continue;
        }
        if (!quoteData.bandwidth_unit) {
          results.failed++;
          results.details.push({ sheet: sheetName, status: 'error', message: 'Bandwidth Unit is required' });
          continue;
        }

        try {
          // Carrier name fuzzy lookup
          if (quoteData.carrier_name) {
            const matches = await carrierQuoteApi.getCarriers(quoteData.carrier_name);
            if (matches && matches.length > 0) {
              const inputLower = quoteData.carrier_name.toLowerCase();
              const exact = matches.find(m => m.carrier_name.toLowerCase() === inputLower);
              const startsWith = matches.find(m => m.carrier_name.toLowerCase().startsWith(inputLower));
              const best = exact || startsWith || matches[0];
              quoteData.carrier_name = best.carrier_name;
              quoteData.carrier_id = best.id;
            }
          }

          // Handle Location A custom
          if (!quoteData.location_a_pop_code && customLocA.name) {
            try {
              const loc = await carrierQuoteApi.createCustomLocation({
                location_name: customLocA.name, address: customLocA.address || '',
                city: customLocA.city || '', country: customLocA.country || ''
              });
              quoteData.location_a_type = 'custom';
              quoteData.location_a_custom_id = loc.id;
            } catch (e) { /* use POP fallback */ }
          }

          // Handle Location B custom
          if (!quoteData.location_b_pop_code && customLocB.name) {
            try {
              const loc = await carrierQuoteApi.createCustomLocation({
                location_name: customLocB.name, address: customLocB.address || '',
                city: customLocB.city || '', country: customLocB.country || ''
              });
              quoteData.location_b_type = 'custom';
              quoteData.location_b_custom_id = loc.id;
            } catch (e) { /* use POP fallback */ }
          }

          // Parse numeric fields
          ['bandwidth_value', 'mrc_12', 'nrc_12', 'mrc_24', 'nrc_24', 'mrc_36', 'nrc_36', 'expected_latency'].forEach(f => {
            if (quoteData[f]) quoteData[f] = parseFloat(quoteData[f]);
          });
          if (quoteData.mtu) quoteData.mtu = parseInt(quoteData.mtu, 10);
          if (quoteData.bandwidth_unit === 'Dark Fiber') quoteData.bandwidth_value = null;

          const result = await carrierQuoteApi.createQuote(quoteData);
          results.created++;
          results.details.push({ sheet: sheetName, status: 'success', message: `Created as ${result.quote_reference}` });
        } catch (err) {
          results.failed++;
          results.details.push({ sheet: sheetName, status: 'error', message: err.response?.data?.error || err.message });
        }
      }

      setCarrierQuoteResults(results);
      if (results.created > 0) {
        setSuccess(`Successfully created ${results.created} of ${results.total} quotes`);
      }
      if (results.failed > 0 && results.created === 0) {
        setError(`All ${results.failed} quotes failed. Check details below.`);
      } else if (results.failed > 0) {
        setError(`${results.failed} of ${results.total} quotes had errors. Check details below.`);
      }
      setUploadFile(null);
      const fileInput = document.getElementById('bulk-upload-file');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError('Failed to parse Excel file: ' + err.message);
    } finally {
      setUploading(false);
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

  const handleExcelFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setError('Please select an Excel file (.xlsx or .xls)');
        event.target.value = '';
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        event.target.value = '';
        return;
      }
      setUploadFile(file);
      setError('');
      setSuccess('');
      setFormErrors({});
      setUploadResult(null);
      setCarrierQuoteResults(null);
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
      <Typography variant="h4" sx={{ fontSize: '2rem' }} gutterBottom>
        Bulk Upload Facility
      </Typography>
      
      <Typography variant="body1" sx={{ fontSize: '0.875rem' }} color="text.secondary" sx={{ mb: 3 }}>
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
              <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} gutterBottom>
                1. Select Module
              </Typography>
              
                              <ValidatedSelect
                  fullWidth
                  label="Choose Module *"
                  value={selectedModule}
                  onChange={(e) => {
                    const newModule = e.target.value;
                    setSelectedModule(newModule);
                    setFormErrors({});
                    setError('');
                    setSuccess('');
                    setUploadResult(null);
                    setUploadProgress(null);
                    setCarrierQuoteResults(null);
                    setUploadFile(null);
                    setSelectedCnxLocation('');
                    setSelectedCnxRack('');
                    const fileInput = document.getElementById('bulk-upload-file');
                    if (fileInput) fileInput.value = '';
                    
                    // Load CNX locations if rack devices module selected
                    if (newModule === 'cnx_rack_devices') {
                      loadCNXRacksList();
                    }
                    
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
                <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
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
              <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} gutterBottom>
                2. Download Template or Data
              </Typography>
              
              {selectedModule === 'cnx_rack_devices' && (
                <Box sx={{ mb: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Select Rack for Export
                  </Typography>
                  <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                    <InputLabel>Location</InputLabel>
                    <Select
                      value={selectedCnxLocation}
                      label="Location"
                      onChange={(e) => {
                        setSelectedCnxLocation(e.target.value);
                        setSelectedCnxRack('');
                      }}
                    >
                      {cnxLocations.map((loc) => (
                        <MenuItem key={loc.id} value={loc.id}>
                          {loc.location_code} - {loc.city}, {loc.country}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small">
                    <InputLabel>Rack</InputLabel>
                    <Select
                      value={selectedCnxRack}
                      label="Rack"
                      onChange={(e) => setSelectedCnxRack(e.target.value)}
                      disabled={!selectedCnxLocation}
                    >
                      {(cnxLocations.find(l => l.id === selectedCnxLocation)?.racks || []).map((rack) => (
                        <MenuItem key={rack.id} value={rack.id}>
                          {rack.rack_id} ({rack.rack_type}, {rack.total_ru || 42} RU)
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}
              
              <Stack spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={isCarrierQuoteModule ? handleCarrierQuoteTemplateDownload : handleTemplateDownload}
                  disabled={!selectedModule}
                  fullWidth
                >
                  {isCarrierQuoteModule ? 'Download Excel Template' : 'Download CSV Template'}
                </Button>
                
                {selectedModule === 'cnx_rack_devices' ? (
                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={async () => {
                      if (!selectedCnxRack) {
                        setError('Please select a location and rack first');
                        return;
                      }
                      try {
                        setError('');
                        const loc = cnxLocations.find(l => l.id === selectedCnxLocation);
                        const rack = loc?.racks?.find(r => r.id === selectedCnxRack);
                        await downloadRackDeviceExport(selectedCnxRack, loc?.location_code || '', rack?.rack_id || '');
                        setSuccess('Rack device export downloaded successfully');
                      } catch (err) {
                        setError('Failed to download rack device export: ' + (err.response?.data?.error || err.message));
                      }
                    }}
                    disabled={!selectedCnxRack}
                    fullWidth
                  >
                    Export Rack Devices (Per Rack)
                  </Button>
                ) : isCarrierQuoteModule ? null : (
                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={handleDatabaseDownload}
                    disabled={!selectedModule}
                    fullWidth
                  >
                    Download Database Export
                  </Button>
                )}

                <Typography variant="caption" color="text.secondary">
                  {selectedModule === 'cnx_rack_devices' 
                    ? 'Select a rack above to export its devices with pre-populated RU rows, or use the template for a blank starting point.'
                    : isCarrierQuoteModule
                    ? 'Download the Excel template, duplicate the "Quote 1" sheet for each quote, then upload.'
                    : 'Use the template for new data or database export as a starting point for bulk edits.'
                  }
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* File Upload */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} gutterBottom>
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
                    {uploadFile ? uploadFile.name : (isCarrierQuoteModule ? 'Choose Excel File (.xlsx)' : 'Choose CSV File')}
                    <input
                      id="bulk-upload-file"
                      type="file"
                      accept={isCarrierQuoteModule ? '.xlsx,.xls' : '.csv'}
                      hidden
                      onChange={isCarrierQuoteModule ? handleExcelFileChange : handleFileChange}
                    />
                  </Button>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Button
                    variant="contained"
                    onClick={isCarrierQuoteModule ? handleCarrierQuoteBulkUpload : handleFileUpload}
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
                  <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary" sx={{ mt: 1 }}>
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
                <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} gutterBottom>
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

        {/* Carrier Quote Bulk Upload Results */}
        {carrierQuoteResults && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} gutterBottom>
                  Carrier Quote Bulk Upload Results
                </Typography>
                <Alert severity={carrierQuoteResults.failed === 0 ? 'success' : carrierQuoteResults.created > 0 ? 'warning' : 'error'} sx={{ mb: 2 }}>
                  <strong>{carrierQuoteResults.created}</strong> of <strong>{carrierQuoteResults.total}</strong> quotes created successfully
                  {carrierQuoteResults.failed > 0 && <> &mdash; <strong>{carrierQuoteResults.failed}</strong> failed</>}
                </Alert>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Sheet</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {carrierQuoteResults.details.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell>{d.sheet}</TableCell>
                          <TableCell>
                            <Chip
                              label={d.status}
                              size="small"
                              color={d.status === 'success' ? 'success' : d.status === 'skipped' ? 'default' : 'error'}
                            />
                          </TableCell>
                          <TableCell>{d.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
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
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
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