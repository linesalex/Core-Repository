import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Grid, MenuItem, Select, InputLabel,
  FormControl, Autocomplete, Tooltip, Divider, InputAdornment, List, ListItem,
  ListItemText, ListItemIcon, ListItemSecondaryAction, IconButton, CircularProgress,
  Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import MapIcon from '@mui/icons-material/Map';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';
import TimelineIcon from '@mui/icons-material/Timeline';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { useAuth } from './AuthContext';
import { carrierQuoteApi } from './api';

// CSV template rows: { label, field, instruction }
// Vertical format: Column A = Field, Column B = Value, Column C = Instructions
const CSV_ROWS = [
  { label: 'Internal Reference (QR)', field: 'quote_reference', instruction: 'Optional - auto-generated if left blank' },
  { label: 'Carrier Name', field: 'carrier_name', instruction: 'Required - will be matched to existing carriers on import' },
  { label: 'Carrier Quote Reference', field: 'carrier_quote_ref', instruction: 'The carrier\'s own reference number' },
  { label: 'Service Type', field: 'service_type', instruction: 'MPLS | Ethernet | Dark Fiber | Wavelength' },
  { label: 'Region', field: 'region', instruction: 'AMERs | APAC | EMEA | INTER' },
  { label: 'Location A POP Code', field: 'location_a_pop_code', instruction: 'Enter POP code (e.g. IPCLON7) OR fill in Name/Address/City/Country below' },
  { label: 'Location A Name', field: '_loc_a_name', instruction: 'Only required if POP code is not provided - a custom location will be created' },
  { label: 'Location A Address', field: '_loc_a_address', instruction: 'Street address for custom location' },
  { label: 'Location A City', field: '_loc_a_city', instruction: 'City for custom location' },
  { label: 'Location A Country', field: '_loc_a_country', instruction: 'Country for custom location' },
  { label: 'Location B POP Code', field: 'location_b_pop_code', instruction: 'Enter POP code (e.g. IPCLON7) OR fill in Name/Address/City/Country below' },
  { label: 'Location B Name', field: '_loc_b_name', instruction: 'Only required if POP code is not provided - a custom location will be created' },
  { label: 'Location B Address', field: '_loc_b_address', instruction: 'Street address for custom location' },
  { label: 'Location B City', field: '_loc_b_city', instruction: 'City for custom location' },
  { label: 'Location B Country', field: '_loc_b_country', instruction: 'Country for custom location' },
  { label: 'Bandwidth Unit', field: 'bandwidth_unit', instruction: 'Mbps | Gbps | Dark Fiber' },
  { label: 'Bandwidth Value', field: 'bandwidth_value', instruction: 'Not required if Bandwidth Unit is Dark Fiber' },
  { label: 'Currency', field: 'currency', instruction: 'e.g. USD, EUR, GBP' },
  { label: 'NRC', field: 'nrc', instruction: 'Non-Recurring Cost' },
  { label: 'MRC', field: 'mrc', instruction: 'Monthly Recurring Cost' },
  { label: 'Contract Term (Months)', field: 'contract_term', instruction: '12 | 24 | 36' },
  { label: 'Expected Latency (ms)', field: 'expected_latency', instruction: 'Round-trip latency in milliseconds' },
  { label: 'Protection', field: 'protection', instruction: 'Unprotected | Protected' },
  { label: 'Cable System', field: 'cable_system', instruction: 'Name of submarine cable system if applicable' },
  { label: 'Quote Date', field: 'quote_date', instruction: 'YYYY-MM-DD' },
  { label: 'Expiry Date', field: 'expiry_date', instruction: 'YYYY-MM-DD' },
  { label: 'MTU', field: 'mtu', instruction: 'Maximum Transmission Unit' },
  { label: 'Notes', field: 'notes', instruction: 'Any additional notes' }
];

// Simple CSV value escaper
const escapeCsv = (val) => {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

// Parse a single CSV line respecting quoted fields
const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { values.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  values.push(current.trim());
  return values;
};

const SERVICE_TYPES = ['MPLS', 'Ethernet', 'Dark Fiber', 'Wavelength'];
const REGIONS = ['AMERs', 'APAC', 'EMEA', 'INTER'];
const BANDWIDTH_UNITS = ['Mbps', 'Gbps', 'Dark Fiber'];
const CONTRACT_TERMS = [12, 24, 36];
const PROTECTION_TYPES = ['Unprotected', 'Protected'];
const PRICE_STAGE_PRESETS = ['Initial Offer', 'Counter Offer', 'Discounted', 'Best and Final', 'Accepted', 'Rejected'];

const emptyFormData = {
  quote_reference: '',
  carrier_id: null,
  carrier_name: '',
  carrier_quote_ref: '',
  service_type: '',
  region: '',
  location_a_type: 'pop',
  location_a_pop_code: '',
  location_a_custom_id: null,
  location_a_custom_name: '',
  location_b_type: 'pop',
  location_b_pop_code: '',
  location_b_custom_id: null,
  location_b_custom_name: '',
  bandwidth_value: '',
  bandwidth_unit: 'Gbps',
  mrc: '',
  nrc: '',
  currency: 'USD',
  contract_term: '',
  expected_latency: '',
  protection: '',
  cable_system: '',
  quote_date: '',
  expiry_date: '',
  transit_cities: '',
  transit_countries: '',
  mtu: '',
  notes: ''
};

const AddCarrierQuote = ({ onNavigateBack, editQuoteId }) => {
  const { user } = useAuth();
  const isEditMode = !!editQuoteId;

  // Form state
  const [formData, setFormData] = useState({ ...emptyFormData });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Autocomplete data
  const [carriers, setCarriers] = useState([]);
  const [popLocations, setPopLocations] = useState([]);
  const [customLocations, setCustomLocations] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  // File upload state
  const [uploadFiles, setUploadFiles] = useState([]);
  const fileInputRef = useRef(null);

  // KMZ parsing state
  const [kmzParsing, setKmzParsing] = useState(false);
  const kmzInputRef = useRef(null);

  // CSV import state
  const csvInputRef = useRef(null);
  const [csvDragActive, setCsvDragActive] = useState(false);

  // New custom location dialog
  const [customLocDialogOpen, setCustomLocDialogOpen] = useState(false);
  const [customLocTarget, setCustomLocTarget] = useState('a');
  const [newCustomLoc, setNewCustomLoc] = useState({ location_name: '', address: '', city: '', country: '' });

  // Price stage tracking
  const [priceStages, setPriceStages] = useState([]);
  const [priceStageDialogOpen, setPriceStageDialogOpen] = useState(false);
  const [newPriceStage, setNewPriceStage] = useState({
    stage_name: '',
    mrc: '',
    nrc: '',
    currency: '',
    notes: '',
    stage_date: new Date().toISOString().split('T')[0]
  });

  // Load reference data
  const loadReferenceData = useCallback(async () => {
    try {
      const [carrierData, currencyData] = await Promise.all([
        carrierQuoteApi.getCarriers(),
        carrierQuoteApi.getCurrencies()
      ]);
      setCarriers(carrierData || []);
      setCurrencies(currencyData || []);
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  }, []);

  // Load quote data for edit mode
  const loadQuoteForEdit = useCallback(async () => {
    if (!editQuoteId) return;
    setLoading(true);
    try {
      const quote = await carrierQuoteApi.getQuote(editQuoteId);
      setFormData({
        quote_reference: quote.quote_reference || '',
        carrier_id: quote.carrier_id,
        carrier_name: quote.carrier_name || '',
        carrier_quote_ref: quote.carrier_quote_ref || '',
        service_type: quote.service_type || '',
        region: quote.region || '',
        location_a_type: quote.location_a_type || 'pop',
        location_a_pop_code: quote.location_a_pop_code || '',
        location_a_custom_id: quote.location_a_custom_id,
        location_a_custom_name: quote.location_a_custom_name || '',
        location_b_type: quote.location_b_type || 'pop',
        location_b_pop_code: quote.location_b_pop_code || '',
        location_b_custom_id: quote.location_b_custom_id,
        location_b_custom_name: quote.location_b_custom_name || '',
        bandwidth_value: quote.bandwidth_value || '',
        bandwidth_unit: quote.bandwidth_unit || 'Gbps',
        mrc: quote.mrc || '',
        nrc: quote.nrc || '',
        currency: quote.currency || 'USD',
        contract_term: quote.contract_term || '',
        expected_latency: quote.expected_latency || '',
        protection: quote.protection || '',
        cable_system: quote.cable_system || '',
        quote_date: quote.quote_date || '',
        expiry_date: quote.expiry_date || '',
        transit_cities: quote.transit_cities || '',
        transit_countries: quote.transit_countries || '',
        mtu: quote.mtu || '',
        notes: quote.notes || ''
      });
      // Load price stages
      if (quote.price_stages) {
        setPriceStages(quote.price_stages);
      }
    } catch (err) {
      setError('Failed to load quote: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }, [editQuoteId]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    loadQuoteForEdit();
  }, [loadQuoteForEdit]);

  // Search POP locations
  const searchPopLocations = async (query) => {
    if (!query || query.length < 1) return;
    try {
      const data = await carrierQuoteApi.getPopLocations(query);
      setPopLocations(data || []);
    } catch (err) {
      console.error('Failed to search POP locations:', err);
    }
  };

  // Search custom locations
  const searchCustomLocations = async (query) => {
    try {
      const data = await carrierQuoteApi.getCustomLocations(query || '');
      setCustomLocations(data || []);
    } catch (err) {
      console.error('Failed to search custom locations:', err);
    }
  };

  // Check if Dark Fiber is selected (bandwidth value not required)
  const isDarkFiber = formData.bandwidth_unit === 'Dark Fiber';

  // Validate form
  const validateForm = () => {
    const errors = {};
    if (!formData.carrier_name) errors.carrier_name = 'Carrier name is required';
    if (!formData.service_type) errors.service_type = 'Service type is required';
    if (!formData.region) errors.region = 'Region is required';
    if (!isDarkFiber && !formData.bandwidth_value) errors.bandwidth_value = 'Bandwidth is required';
    if (!formData.bandwidth_unit) errors.bandwidth_unit = 'Bandwidth unit is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const submitData = { ...formData };
      // Clean up numeric fields
      if (submitData.bandwidth_value) submitData.bandwidth_value = parseFloat(submitData.bandwidth_value);
      if (submitData.mrc) submitData.mrc = parseFloat(submitData.mrc);
      if (submitData.nrc) submitData.nrc = parseFloat(submitData.nrc);
      if (submitData.expected_latency) submitData.expected_latency = parseFloat(submitData.expected_latency);
      if (submitData.contract_term) submitData.contract_term = parseInt(submitData.contract_term);
      if (submitData.mtu) submitData.mtu = parseInt(submitData.mtu);
      // Clear bandwidth value for Dark Fiber
      if (isDarkFiber) submitData.bandwidth_value = null;

      let quoteId;
      if (isEditMode) {
        await carrierQuoteApi.updateQuote(editQuoteId, submitData);
        quoteId = editQuoteId;
        setSuccess('Quote updated successfully');
      } else {
        const result = await carrierQuoteApi.createQuote(submitData);
        quoteId = result.id;
        setSuccess(`Quote ${result.quote_reference} created successfully`);
      }

      // Upload files if any
      if (uploadFiles.length > 0 && quoteId) {
        try {
          await carrierQuoteApi.uploadAttachments(quoteId, uploadFiles);
        } catch (uploadErr) {
          setError('Quote saved but file upload failed: ' + (uploadErr.response?.data?.error || uploadErr.message));
        }
      }

      // Navigate back after short delay so user sees success message
      setTimeout(() => {
        if (onNavigateBack) onNavigateBack();
      }, 1200);
    } catch (err) {
      setError('Failed to save quote: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Download CSV template (vertical: A = Field, B = Value, C = Instructions)
  const handleDownloadTemplate = () => {
    const rows = [['Field', 'Value', 'Instructions']];
    CSV_ROWS.forEach(r => {
      rows.push([r.label, '', r.instruction]);
    });
    const csv = rows.map(row => row.map(v => escapeCsv(v)).join(',')).join('\n');
    // BOM + UTF-8 ensures Excel opens with correct encoding and characters
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'carrier_quote_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import CSV / TXT file and populate form (vertical format)
  // Normalise a date value from various formats to YYYY-MM-DD for HTML date inputs
  const normaliseDateValue = (val) => {
    if (!val) return val;
    const s = val.trim();
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // Try to parse with Date (handles many formats: MM/DD/YYYY, DD-MMM-YYYY, etc.)
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    // Return original if unparseable
    return s;
  };

  const handleCsvImport = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // Strip BOM if present
        let text = e.target.result;
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          setError('CSV file must have at least a header row and one data row');
          return;
        }

        // Build label -> value map from vertical rows
        const dataMap = {};
        const startIdx = parseCsvLine(lines[0])[0].trim().toLowerCase() === 'field' ? 1 : 0;
        for (let i = startIdx; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          const label = (cols[0] || '').trim();
          const value = (cols[1] || '').trim();
          if (label) dataMap[label] = value;
        }

        // Map to form fields, skip empty values
        const updates = {};
        let fieldsPopulated = 0;
        const dateFields = ['quote_date', 'expiry_date'];
        CSV_ROWS.forEach(row => {
          const val = dataMap[row.label];
          if (val !== undefined && val !== '') {
            if (!row.field.startsWith('_')) {
              updates[row.field] = dateFields.includes(row.field) ? normaliseDateValue(val) : val;
            }
            fieldsPopulated++;
          }
        });

        // Handle Location A: POP code vs custom location
        const locAName = dataMap['Location A Name'] || '';
        const locAAddress = dataMap['Location A Address'] || '';
        const locACity = dataMap['Location A City'] || '';
        const locACountry = dataMap['Location A Country'] || '';
        if (updates.location_a_pop_code) {
          updates.location_a_type = 'pop';
        } else if (locAName) {
          // Create custom location via API
          try {
            const result = await carrierQuoteApi.createCustomLocation({
              location_name: locAName, address: locAAddress, city: locACity, country: locACountry
            });
            updates.location_a_type = 'custom';
            updates.location_a_custom_id = result.id;
            updates.location_a_custom_name = result.location_name;
            updates.location_a_pop_code = result.location_name;
          } catch (locErr) {
            console.warn('Failed to create custom Location A:', locErr);
          }
        }

        // Handle Location B: POP code vs custom location
        const locBName = dataMap['Location B Name'] || '';
        const locBAddress = dataMap['Location B Address'] || '';
        const locBCity = dataMap['Location B City'] || '';
        const locBCountry = dataMap['Location B Country'] || '';
        if (updates.location_b_pop_code) {
          updates.location_b_type = 'pop';
        } else if (locBName) {
          try {
            const result = await carrierQuoteApi.createCustomLocation({
              location_name: locBName, address: locBAddress, city: locBCity, country: locBCountry
            });
            updates.location_b_type = 'custom';
            updates.location_b_custom_id = result.id;
            updates.location_b_custom_name = result.location_name;
            updates.location_b_pop_code = result.location_name;
          } catch (locErr) {
            console.warn('Failed to create custom Location B:', locErr);
          }
        }

        if (fieldsPopulated === 0) {
          setError('No matching data found — ensure field names match the template');
          return;
        }

        // Carrier name fuzzy lookup
        if (updates.carrier_name) {
          try {
            const matches = await carrierQuoteApi.getCarriers(updates.carrier_name);
            if (matches && matches.length > 0) {
              // Find best match: exact first, then starts-with, then first result
              const inputLower = updates.carrier_name.toLowerCase();
              const exact = matches.find(m => m.carrier_name.toLowerCase() === inputLower);
              const startsWith = matches.find(m => m.carrier_name.toLowerCase().startsWith(inputLower));
              const best = exact || startsWith || matches[0];
              updates.carrier_name = best.carrier_name;
              updates.carrier_id = best.id;
              setCarriers(matches);
            }
          } catch (carrierErr) {
            console.warn('Carrier lookup failed:', carrierErr);
          }
        }

        setFormData(prev => ({ ...prev, ...updates }));
        setSuccess(`CSV imported — ${fieldsPopulated} field${fieldsPopulated !== 1 ? 's' : ''} populated. Please review all fields before submitting.`);
      } catch (err) {
        console.error('CSV parse error:', err);
        setError('Failed to parse CSV file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleCsvFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) handleCsvImport(file);
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  // CSV drag-and-drop handlers
  const handleCsvDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setCsvDragActive(true); };
  const handleCsvDragLeave = () => { setCsvDragActive(false); };
  const handleCsvDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCsvDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      handleCsvImport(file);
    } else {
      setError('Please drop a .csv or .txt file');
    }
  };

  // Handle KMZ file parsing
  const handleKmzParse = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log('[KMZ Upload] File selected:', file.name, 'Size:', file.size, 'bytes', 'Type:', file.type);
    setKmzParsing(true);
    try {
      console.log('[KMZ Upload] Sending parse request...');
      const startTime = Date.now();
      const result = await carrierQuoteApi.parseKmz(file);
      console.log(`[KMZ Upload] Parse response received in ${Date.now() - startTime}ms:`, result);
      setFormData(prev => ({
        ...prev,
        transit_cities: result.transit_cities || prev.transit_cities,
        transit_countries: result.transit_countries || prev.transit_countries
      }));
      
      // Add KMZ file to upload list
      setUploadFiles(prev => [...prev, file]);
      setSuccess('KMZ locations updated');
    } catch (err) {
      console.error('[KMZ Upload] Parse error:', err);
      console.error('[KMZ Upload] Error details:', { 
        message: err.message, 
        code: err.code, 
        status: err.response?.status,
        responseData: err.response?.data 
      });
      setError('Failed to parse KMZ: ' + (err.response?.data?.error || err.message));
    } finally {
      setKmzParsing(false);
      if (kmzInputRef.current) kmzInputRef.current.value = '';
    }
  };

  // Handle document file selection
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setUploadFiles(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove file from upload list
  const removeUploadFile = (index) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Drag-and-drop state
  const [kmzDragActive, setKmzDragActive] = useState(false);
  const [fileDragActive, setFileDragActive] = useState(false);

  // KMZ drag-and-drop handlers
  const handleKmzDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setKmzDragActive(true); };
  const handleKmzDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setKmzDragActive(false); };
  const handleKmzDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setKmzDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    console.log('[KMZ Drop] Files dropped:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    const kmzFile = files.find(f => f.name.endsWith('.kmz') || f.name.endsWith('.kml'));
    if (kmzFile) {
      console.log('[KMZ Drop] Found KMZ/KML file:', kmzFile.name, 'Size:', kmzFile.size, 'bytes');
      setKmzParsing(true);
      try {
        console.log('[KMZ Drop] Sending parse request...');
        const startTime = Date.now();
        const result = await carrierQuoteApi.parseKmz(kmzFile);
        console.log(`[KMZ Drop] Parse response received in ${Date.now() - startTime}ms:`, result);
        setFormData(prev => ({
          ...prev,
          transit_cities: result.transit_cities || prev.transit_cities,
          transit_countries: result.transit_countries || prev.transit_countries
        }));
        setUploadFiles(prev => [...prev, kmzFile]);
        setSuccess('KMZ locations updated');
      } catch (err) {
        console.error('[KMZ Drop] Parse error after', Date.now(), 'ms:', err);
        console.error('[KMZ Drop] Error details:', { 
          message: err.message, 
          code: err.code, 
          status: err.response?.status,
          responseData: err.response?.data 
        });
        setError('Failed to parse KMZ: ' + (err.response?.data?.error || err.message));
      } finally {
        setKmzParsing(false);
      }
    } else {
      console.log('[KMZ Drop] No .kmz or .kml file found in dropped files');
      setError('Please drop a .kmz or .kml file');
    }
  };

  // File attachment drag-and-drop handlers
  const handleFileDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setFileDragActive(true); };
  const handleFileDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setFileDragActive(false); };
  const handleFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    const validExtensions = ['.kmz', '.kml', '.pdf', '.eml', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.msg', '.txt', '.csv'];
    const validFiles = files.filter(f => validExtensions.some(ext => f.name.toLowerCase().endsWith(ext)));
    if (validFiles.length > 0) {
      setUploadFiles(prev => [...prev, ...validFiles]);
    }
    if (validFiles.length < files.length) {
      setError(`${files.length - validFiles.length} file(s) skipped - unsupported format`);
    }
  };

  // Add a price stage
  const handleAddPriceStage = async () => {
    if (!newPriceStage.stage_name) {
      setError('Stage name is required');
      return;
    }
    
    if (!editQuoteId) {
      // For new quotes, stage will be added after save
      setError('Please save the quote first, then add price stages');
      return;
    }
    
    try {
      const stageData = {
        ...newPriceStage,
        mrc: newPriceStage.mrc ? parseFloat(newPriceStage.mrc) : null,
        nrc: newPriceStage.nrc ? parseFloat(newPriceStage.nrc) : null,
        currency: newPriceStage.currency || formData.currency || 'USD'
      };
      
      const result = await carrierQuoteApi.addPriceStage(editQuoteId, stageData);
      setPriceStages(prev => [...prev, result]);
      setPriceStageDialogOpen(false);
      setNewPriceStage({
        stage_name: '',
        mrc: '',
        nrc: '',
        currency: '',
        notes: '',
        stage_date: new Date().toISOString().split('T')[0]
      });
      setSuccess('Price stage added');
    } catch (err) {
      setError('Failed to add price stage: ' + (err.response?.data?.error || err.message));
    }
  };

  // Delete a price stage
  const handleDeletePriceStage = async (stageId) => {
    if (!editQuoteId) return;
    try {
      await carrierQuoteApi.deletePriceStage(editQuoteId, stageId);
      setPriceStages(prev => prev.filter(s => s.id !== stageId));
      setSuccess('Price stage deleted');
    } catch (err) {
      setError('Failed to delete price stage: ' + (err.response?.data?.error || err.message));
    }
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Create custom location
  const handleCreateCustomLocation = async () => {
    if (!newCustomLoc.location_name) {
      setError('Location name is required');
      return;
    }

    try {
      const result = await carrierQuoteApi.createCustomLocation(newCustomLoc);
      const target = customLocTarget;
      
      setFormData(prev => ({
        ...prev,
        [`location_${target}_type`]: 'custom',
        [`location_${target}_custom_id`]: result.id,
        [`location_${target}_custom_name`]: result.location_name,
        [`location_${target}_pop_code`]: result.location_name
      }));

      setCustomLocDialogOpen(false);
      setNewCustomLoc({ location_name: '', address: '', city: '', country: '' });
      setSuccess('Custom location created');
      searchCustomLocations('');
    } catch (err) {
      setError('Failed to create custom location: ' + (err.response?.data?.error || err.message));
    }
  };

  // Combined location options for autocomplete (POP + Custom)
  const getLocationOptions = () => {
    const popOptions = popLocations.map(loc => ({
      type: 'pop',
      id: null,
      code: loc.location_code,
      label: `${loc.location_code} - ${loc.datacenter_name || loc.city || ''}`,
      customId: null
    }));
    const customOptions = customLocations.map(loc => ({
      type: 'custom',
      id: loc.id,
      code: loc.location_name,
      label: `${loc.location_name}${loc.address ? ' - ' + loc.address : ''}${loc.city ? ', ' + loc.city : ''}`,
      customId: loc.id
    }));
    return [...popOptions, ...customOptions];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onNavigateBack}
          variant="outlined"
          size="small"
        >
          Back to Repository
        </Button>
        <Typography variant="h5">
          {isEditMode ? 'Edit Carrier Quote' : 'Add Carrier Quote'}
        </Typography>
        {isEditMode && formData.quote_reference && (
          <Chip label={formData.quote_reference} color="primary" variant="outlined" />
        )}
      </Box>

      {/* CSV Template & Import */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadTemplate}
        >
          Download CSV Template
        </Button>
        <Divider orientation="vertical" flexItem />
        <Box
          onDragOver={handleCsvDragOver}
          onDragLeave={handleCsvDragLeave}
          onDrop={handleCsvDrop}
          onClick={() => csvInputRef.current?.click()}
          sx={{
            flex: 1,
            minWidth: 200,
            border: '1.5px dashed',
            borderColor: csvDragActive ? 'primary.main' : 'divider',
            borderRadius: 1,
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            bgcolor: csvDragActive ? 'action.hover' : 'transparent',
            transition: 'all 0.2s ease',
            '&:hover': { borderColor: 'primary.light', bgcolor: 'action.hover' }
          }}
        >
          <FileUploadIcon sx={{ color: csvDragActive ? 'primary.main' : 'text.secondary', fontSize: 20 }} />
          <Typography variant="body2" color="text.secondary">
            Import CSV — drag & drop or click to browse (.csv / .txt)
          </Typography>
        </Box>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: 'none' }}
          onChange={handleCsvFileSelect}
        />
      </Paper>

      {/* Section 1: Carrier & Service */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Carrier & Service</Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Autocomplete
              freeSolo
              size="small"
              options={carriers}
              getOptionLabel={(opt) => {
                if (typeof opt === 'string') return opt;
                return opt.display_name || opt.carrier_name || '';
              }}
              value={formData.carrier_name ? { carrier_name: formData.carrier_name, id: formData.carrier_id, display_name: formData.carrier_name } : null}
              filterOptions={(options, { inputValue }) => {
                return options.filter(opt =>
                  (opt.carrier_name || '').toLowerCase().includes(inputValue.toLowerCase()) ||
                  (opt.display_name || '').toLowerCase().includes(inputValue.toLowerCase())
                );
              }}
              onInputChange={(_, value) => {
                // Strip region suffix if user is typing after selecting
                const cleanValue = value.replace(/\s*\([^)]*\)\s*$/, '');
                setFormData(prev => ({ ...prev, carrier_name: cleanValue }));
                if (cleanValue.length >= 1) {
                  carrierQuoteApi.getCarriers(cleanValue).then(setCarriers).catch(() => {});
                }
              }}
              onChange={(_, value) => {
                if (value && typeof value === 'object') {
                  setFormData(prev => ({ ...prev, carrier_name: value.carrier_name, carrier_id: value.id }));
                } else if (typeof value === 'string') {
                  setFormData(prev => ({ ...prev, carrier_name: value, carrier_id: null }));
                }
              }}
              renderOption={(props, option) => (
                <li {...props} key={option.id || option.carrier_name}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <Typography variant="body2">{option.carrier_name}</Typography>
                    {option.region && (
                      <Chip label={option.region} size="small" variant="outlined" sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} />
                    )}
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Carrier *" error={!!formErrors.carrier_name} helperText={formErrors.carrier_name} />
              )}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small" error={!!formErrors.service_type}>
              <InputLabel>Service Type *</InputLabel>
              <Select value={formData.service_type} onChange={(e) => setFormData(prev => ({ ...prev, service_type: e.target.value }))} label="Service Type *">
                {SERVICE_TYPES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small" error={!!formErrors.region}>
              <InputLabel>Region *</InputLabel>
              <Select value={formData.region} onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))} label="Region *">
                {REGIONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Section 2: Route / Locations */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Route</Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Autocomplete
                freeSolo
                size="small"
                fullWidth
                options={getLocationOptions()}
                getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.label || opt.code || ''}
                groupBy={(opt) => opt.type === 'pop' ? 'POP Locations' : 'Custom Locations'}
                inputValue={formData.location_a_pop_code || formData.location_a_custom_name || ''}
                onInputChange={(_, value) => {
                  setFormData(prev => ({
                    ...prev,
                    location_a_pop_code: value,
                    location_a_type: 'pop',
                    location_a_custom_id: null,
                    location_a_custom_name: ''
                  }));
                  searchPopLocations(value);
                  searchCustomLocations(value);
                }}
                onChange={(_, value) => {
                  if (value && typeof value === 'object') {
                    if (value.type === 'pop') {
                      setFormData(prev => ({
                        ...prev,
                        location_a_type: 'pop',
                        location_a_pop_code: value.code,
                        location_a_custom_id: null,
                        location_a_custom_name: ''
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        location_a_type: 'custom',
                        location_a_pop_code: value.code,
                        location_a_custom_id: value.customId,
                        location_a_custom_name: value.code
                      }));
                    }
                  }
                }}
                renderInput={(params) => <TextField {...params} label="Location A" />}
              />
              <Tooltip title="Add New Custom Location">
                <IconButton size="small" onClick={() => { setCustomLocTarget('a'); setCustomLocDialogOpen(true); }}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Autocomplete
                freeSolo
                size="small"
                fullWidth
                options={getLocationOptions()}
                getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.label || opt.code || ''}
                groupBy={(opt) => opt.type === 'pop' ? 'POP Locations' : 'Custom Locations'}
                inputValue={formData.location_b_pop_code || formData.location_b_custom_name || ''}
                onInputChange={(_, value) => {
                  setFormData(prev => ({
                    ...prev,
                    location_b_pop_code: value,
                    location_b_type: 'pop',
                    location_b_custom_id: null,
                    location_b_custom_name: ''
                  }));
                  searchPopLocations(value);
                  searchCustomLocations(value);
                }}
                onChange={(_, value) => {
                  if (value && typeof value === 'object') {
                    if (value.type === 'pop') {
                      setFormData(prev => ({
                        ...prev,
                        location_b_type: 'pop',
                        location_b_pop_code: value.code,
                        location_b_custom_id: null,
                        location_b_custom_name: ''
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        location_b_type: 'custom',
                        location_b_pop_code: value.code,
                        location_b_custom_id: value.customId,
                        location_b_custom_name: value.code
                      }));
                    }
                  }
                }}
                renderInput={(params) => <TextField {...params} label="Location B" />}
              />
              <Tooltip title="Add New Custom Location">
                <IconButton size="small" onClick={() => { setCustomLocTarget('b'); setCustomLocDialogOpen(true); }}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Section 3: Bandwidth & Pricing */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Bandwidth & Pricing</Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small" error={!!formErrors.bandwidth_unit}>
              <InputLabel>Bandwidth Unit *</InputLabel>
              <Select value={formData.bandwidth_unit} onChange={(e) => setFormData(prev => ({ ...prev, bandwidth_unit: e.target.value }))} label="Bandwidth Unit *">
                {BANDWIDTH_UNITS.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label={isDarkFiber ? 'Bandwidth (N/A)' : 'Bandwidth *'}
              type="number"
              value={isDarkFiber ? '' : formData.bandwidth_value}
              onChange={(e) => setFormData(prev => ({ ...prev, bandwidth_value: e.target.value }))}
              error={!!formErrors.bandwidth_value}
              helperText={isDarkFiber ? 'Not required for Dark Fiber' : formErrors.bandwidth_value}
              disabled={isDarkFiber}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Currency</InputLabel>
              <Select value={formData.currency} onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))} label="Currency">
                {currencies.map(c => <MenuItem key={c.currency_code} value={c.currency_code}>{c.currency_code}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Contract Term</InputLabel>
              <Select value={formData.contract_term} onChange={(e) => setFormData(prev => ({ ...prev, contract_term: e.target.value }))} label="Contract Term">
                <MenuItem value="">N/A</MenuItem>
                {CONTRACT_TERMS.map(t => <MenuItem key={t} value={t}>{t} months</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="MRC"
              type="number"
              value={formData.mrc}
              onChange={(e) => setFormData(prev => ({ ...prev, mrc: e.target.value }))}
              InputProps={{ startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="NRC"
              type="number"
              value={formData.nrc}
              onChange={(e) => setFormData(prev => ({ ...prev, nrc: e.target.value }))}
              InputProps={{ startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Protection</InputLabel>
              <Select value={formData.protection} onChange={(e) => setFormData(prev => ({ ...prev, protection: e.target.value }))} label="Protection">
                {PROTECTION_TYPES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Section 4: Additional Details */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Additional Details</Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Expected Latency (ms)"
              type="number"
              value={formData.expected_latency}
              onChange={(e) => setFormData(prev => ({ ...prev, expected_latency: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Cable System"
              value={formData.cable_system}
              onChange={(e) => setFormData(prev => ({ ...prev, cable_system: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="MTU"
              type="number"
              value={formData.mtu}
              onChange={(e) => setFormData(prev => ({ ...prev, mtu: e.target.value }))}
              helperText="Maximum Transmission Unit (bytes)"
              InputProps={{ inputProps: { min: 0 } }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Quote Date"
              value={formData.quote_date}
              onChange={(e) => setFormData(prev => ({ ...prev, quote_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Expiry Date"
              value={formData.expiry_date}
              onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Section 5: Quote References */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>References</Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Internal Reference (QR)"
              value={formData.quote_reference}
              onChange={(e) => setFormData(prev => ({ ...prev, quote_reference: e.target.value }))}
              helperText={isEditMode ? 'Cannot change reference' : 'Leave blank to auto-generate. Same QR can be used across multiple quotes.'}
              disabled={isEditMode}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Carrier Quote Ref"
              value={formData.carrier_quote_ref}
              onChange={(e) => setFormData(prev => ({ ...prev, carrier_quote_ref: e.target.value }))}
              helperText="The carrier's own reference number for this quote"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Section 6: KMZ Route Data */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>KMZ Route Data</Typography>
        <Box
          onDragOver={handleKmzDragOver}
          onDragLeave={handleKmzDragLeave}
          onDrop={handleKmzDrop}
          onClick={() => !kmzParsing && kmzInputRef.current?.click()}
          sx={{
            border: '2px dashed',
            borderColor: kmzDragActive ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 3,
            mb: 2,
            textAlign: 'center',
            cursor: kmzParsing ? 'wait' : 'pointer',
            bgcolor: kmzDragActive ? 'action.hover' : 'transparent',
            transition: 'all 0.2s ease',
            '&:hover': { borderColor: 'primary.light', bgcolor: 'action.hover' }
          }}
        >
          {kmzParsing ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Parsing KMZ file — detecting transit countries and cities...
              </Typography>
            </Box>
          ) : (
            <>
              <CloudUploadIcon sx={{ fontSize: 36, color: kmzDragActive ? 'primary.main' : 'text.secondary', mb: 0.5 }} />
              <Typography variant="body2" color="text.secondary">
                Drag & drop a KMZ/KML file here, or click to browse
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Transit countries, cities and route distance will be auto-extracted
              </Typography>
            </>
          )}
        </Box>
        <input
          ref={kmzInputRef}
          type="file"
          accept=".kmz,.kml"
          style={{ display: 'none' }}
          onChange={handleKmzParse}
        />
        <Grid container spacing={2.5}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Transit Countries"
              value={formData.transit_countries}
              onChange={(e) => setFormData(prev => ({ ...prev, transit_countries: e.target.value }))}
              multiline
              minRows={1}
              maxRows={3}
              helperText="Auto-populated from KMZ upload, editable. Enter as comma-separated country names e.g. United Kingdom, France, Spain"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Transit Cities"
              value={formData.transit_cities}
              onChange={(e) => setFormData(prev => ({ ...prev, transit_cities: e.target.value }))}
              multiline
              minRows={1}
              maxRows={4}
              helperText="Auto-populated from KMZ upload, editable. Enter as City (Country) e.g. London (United Kingdom), Paris (France)"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Section 7: Notes */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Notes</Typography>
        <TextField
          fullWidth
          size="small"
          label="Notes"
          multiline
          minRows={3}
          maxRows={6}
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
        />
      </Paper>

      {/* Section 8: Price Negotiation History */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Price Negotiation History</Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setNewPriceStage(prev => ({
                ...prev,
                currency: formData.currency || 'USD',
                mrc: formData.mrc || '',
                nrc: formData.nrc || ''
              }));
              setPriceStageDialogOpen(true);
            }}
            disabled={!isEditMode}
          >
            Add Price Stage
          </Button>
        </Box>
        
        {!isEditMode && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            Save the quote first to start tracking price negotiations. Once saved, you can record each stage of the negotiation process.
          </Typography>
        )}
        
        {isEditMode && priceStages.length > 0 && (
          <>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Stage</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">MRC</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">NRC</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Ccy</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>By</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {priceStages.map((stage, idx) => {
                    const prevStage = idx > 0 ? priceStages[idx - 1] : null;
                    const mrcChange = prevStage && prevStage.mrc && stage.mrc ? stage.mrc - prevStage.mrc : null;
                    const nrcChange = prevStage && prevStage.nrc && stage.nrc ? stage.nrc - prevStage.nrc : null;
                    
                    return (
                      <TableRow key={stage.id} sx={idx === priceStages.length - 1 ? { backgroundColor: 'action.hover' } : {}}>
                        <TableCell>
                          <Chip label={stage.stage_name} size="small" variant="outlined" color={
                            stage.stage_name === 'Best and Final' ? 'success' :
                            stage.stage_name === 'Discounted' ? 'info' :
                            stage.stage_name === 'Counter Offer' ? 'warning' :
                            stage.stage_name === 'Accepted' ? 'success' :
                            stage.stage_name === 'Rejected' ? 'error' : 'default'
                          } />
                        </TableCell>
                        <TableCell>{formatDate(stage.stage_date)}</TableCell>
                        <TableCell align="right">
                          {stage.mrc != null ? stage.mrc.toLocaleString() : '-'}
                          {mrcChange != null && mrcChange !== 0 && (
                            <Typography variant="caption" component="span" sx={{ ml: 0.5, color: mrcChange < 0 ? 'success.main' : 'error.main' }}>
                              ({mrcChange > 0 ? '+' : ''}{mrcChange.toLocaleString()})
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {stage.nrc != null ? stage.nrc.toLocaleString() : '-'}
                          {nrcChange != null && nrcChange !== 0 && (
                            <Typography variant="caption" component="span" sx={{ ml: 0.5, color: nrcChange < 0 ? 'success.main' : 'error.main' }}>
                              ({nrcChange > 0 ? '+' : ''}{nrcChange.toLocaleString()})
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{stage.currency}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {stage.notes || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{stage.created_by_name || stage.created_by_username || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => handleDeletePriceStage(stage.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {priceStages.length > 1 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <TrendingDownIcon fontSize="small" color="success" />
                <Typography variant="caption" color="text.secondary">
                  {(() => {
                    const first = priceStages[0];
                    const last = priceStages[priceStages.length - 1];
                    if (first.mrc && last.mrc) {
                      const pctChange = ((last.mrc - first.mrc) / first.mrc * 100).toFixed(1);
                      return `MRC: ${first.mrc.toLocaleString()} → ${last.mrc.toLocaleString()} (${pctChange > 0 ? '+' : ''}${pctChange}%)`;
                    }
                    return 'Price change tracking from initial to latest stage';
                  })()}
                </Typography>
              </Box>
            )}
          </>
        )}
        
        {isEditMode && priceStages.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            No price stages recorded yet. Click "Add Price Stage" to track negotiation steps.
          </Typography>
        )}
      </Paper>

      {/* Section 9: Attachments */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Attachments</Typography>
        <Box
          onDragOver={handleFileDragOver}
          onDragLeave={handleFileDragLeave}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: '2px dashed',
            borderColor: fileDragActive ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 3,
            mb: uploadFiles.length > 0 ? 2 : 0,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: fileDragActive ? 'action.hover' : 'transparent',
            transition: 'all 0.2s ease',
            '&:hover': { borderColor: 'primary.light', bgcolor: 'action.hover' }
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 36, color: fileDragActive ? 'primary.main' : 'text.secondary', mb: 0.5 }} />
          <Typography variant="body2" color="text.secondary">
            Drag & drop files here, or click to browse
          </Typography>
          <Typography variant="caption" color="text.disabled">
            KMZ, PDF, documents, images, emails
          </Typography>
        </Box>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".kmz,.kml,.pdf,.eml,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.msg,.txt,.csv"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        {uploadFiles.length > 0 && (
          <List dense>
            {uploadFiles.map((file, idx) => (
              <ListItem key={idx}>
                <ListItemIcon><InsertDriveFileIcon /></ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={`${(file.size / 1024).toFixed(1)} KB`}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" size="small" onClick={() => removeUploadFile(idx)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Action Buttons */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={onNavigateBack} variant="outlined">
            Cancel
          </Button>
          <Button
            variant="contained"
            size="large"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving...' : isEditMode ? 'Update Quote' : 'Create Quote'}
          </Button>
        </Box>
      </Paper>

      {/* Add Price Stage Dialog */}
      <Dialog open={priceStageDialogOpen} onClose={() => setPriceStageDialogOpen(false)} maxWidth="sm" fullWidth disableRestoreFocus>
        <DialogTitle>Add Price Stage</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <Autocomplete
                freeSolo
                size="small"
                options={PRICE_STAGE_PRESETS}
                value={newPriceStage.stage_name}
                onInputChange={(_, value) => setNewPriceStage(prev => ({ ...prev, stage_name: value }))}
                onChange={(_, value) => setNewPriceStage(prev => ({ ...prev, stage_name: value || '' }))}
                renderInput={(params) => (
                  <TextField {...params} label="Stage Name *" helperText="Select or type a custom stage name" />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Stage Date"
                value={newPriceStage.stage_date}
                onChange={(e) => setNewPriceStage(prev => ({ ...prev, stage_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="MRC"
                type="number"
                value={newPriceStage.mrc}
                onChange={(e) => setNewPriceStage(prev => ({ ...prev, mrc: e.target.value }))}
                InputProps={{ startAdornment: <InputAdornment position="start">{newPriceStage.currency || formData.currency}</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="NRC"
                type="number"
                value={newPriceStage.nrc}
                onChange={(e) => setNewPriceStage(prev => ({ ...prev, nrc: e.target.value }))}
                InputProps={{ startAdornment: <InputAdornment position="start">{newPriceStage.currency || formData.currency}</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Currency</InputLabel>
                <Select
                  value={newPriceStage.currency || formData.currency || 'USD'}
                  onChange={(e) => setNewPriceStage(prev => ({ ...prev, currency: e.target.value }))}
                  label="Currency"
                >
                  {currencies.map(c => <MenuItem key={c.currency_code} value={c.currency_code}>{c.currency_code}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Notes"
                multiline
                minRows={2}
                maxRows={4}
                value={newPriceStage.notes}
                onChange={(e) => setNewPriceStage(prev => ({ ...prev, notes: e.target.value }))}
                helperText="Optional notes about this price change (e.g., reason for discount)"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPriceStageDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddPriceStage} startIcon={<AddIcon />}>Add Stage</Button>
        </DialogActions>
      </Dialog>

      {/* Custom Location Dialog */}
      <Dialog open={customLocDialogOpen} onClose={() => setCustomLocDialogOpen(false)} maxWidth="sm" fullWidth disableRestoreFocus>
        <DialogTitle>Add Custom Location (Location {customLocTarget.toUpperCase()})</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Location Name *"
                value={newCustomLoc.location_name}
                onChange={(e) => setNewCustomLoc(prev => ({ ...prev, location_name: e.target.value }))}
                helperText="e.g., Equinix CH3, ABCLON1, etc."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Address"
                value={newCustomLoc.address}
                onChange={(e) => setNewCustomLoc(prev => ({ ...prev, address: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="City"
                value={newCustomLoc.city}
                onChange={(e) => setNewCustomLoc(prev => ({ ...prev, city: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Country"
                value={newCustomLoc.country}
                onChange={(e) => setNewCustomLoc(prev => ({ ...prev, country: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomLocDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateCustomLocation}>Create Location</Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ width: '100%' }}>{success}</Alert>
      </Snackbar>
      <Snackbar open={!!error} autoHideDuration={10000} onClose={() => setError('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setError('')} sx={{ width: '100%' }}>{error}</Alert>
      </Snackbar>
    </Box>
  );
};

export default AddCarrierQuote;
