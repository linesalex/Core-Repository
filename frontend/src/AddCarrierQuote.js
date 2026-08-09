import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Grid, MenuItem, Select, InputLabel,
  FormControl, Autocomplete, Tooltip, Divider, InputAdornment, List, ListItem,
  ListItemText, ListItemIcon, ListItemSecondaryAction, IconButton, CircularProgress,
  Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import MapIcon from '@mui/icons-material/Map';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { useAuth } from './AuthContext';
import { carrierQuoteApi } from './api';
import SiteValidationDialog from './SiteValidationDialog';

// CSV template rows: { label, field, instruction }
// Horizontal format: header row = field labels, next row = values (Building Type included)
const CSV_ROWS = [
  { label: 'Internal Reference (QR)', field: 'quote_reference', instruction: 'Optional - auto-generated if left blank' },
  { label: 'Carrier Name', field: 'carrier_name', instruction: 'Required - will be matched to existing carriers' },
  { label: 'Carrier Quote Reference', field: 'carrier_quote_ref', instruction: 'The carrier\'s own reference number' },
  { label: 'Service Type', field: 'service_type', instruction: 'MPLS | Ethernet | Dark Fiber | Wavelength' },
  { label: 'Region', field: 'region', instruction: 'AMERs | APAC | EMEA | INTER' },
  { label: 'Location A POP Code', field: 'location_a_pop_code', instruction: 'Enter POP code (e.g. IPCLON7) or leave blank for custom' },
  { label: 'Location A Name', field: '_loc_a_name', instruction: 'Site name — only required if POP code is not provided' },
  { label: 'Location A Street Name', field: '_loc_a_street_name', instruction: 'Street name for custom location' },
  { label: 'Location A Street Number', field: '_loc_a_street_number', instruction: 'Street number for custom location' },
  { label: 'Location A City', field: '_loc_a_city', instruction: 'City for custom location' },
  { label: 'Location A Postal Code', field: '_loc_a_postal_code', instruction: 'Postal / ZIP code for custom location' },
  { label: 'Location A Country', field: '_loc_a_country', instruction: 'Country for custom location (ISO preferred e.g. GB)' },
  { label: 'Location A Building Type', field: '_loc_a_building_type', instruction: 'Datacenter | Retail — required for custom location' },
  { label: 'Location B POP Code', field: 'location_b_pop_code', instruction: 'Enter POP code (e.g. IPCLON7) or leave blank for custom' },
  { label: 'Location B Name', field: '_loc_b_name', instruction: 'Site name — only required if POP code is not provided' },
  { label: 'Location B Street Name', field: '_loc_b_street_name', instruction: 'Street name for custom location' },
  { label: 'Location B Street Number', field: '_loc_b_street_number', instruction: 'Street number for custom location' },
  { label: 'Location B City', field: '_loc_b_city', instruction: 'City for custom location' },
  { label: 'Location B Postal Code', field: '_loc_b_postal_code', instruction: 'Postal / ZIP code for custom location' },
  { label: 'Location B Country', field: '_loc_b_country', instruction: 'Country for custom location (ISO preferred e.g. GB)' },
  { label: 'Location B Building Type', field: '_loc_b_building_type', instruction: 'Datacenter | Retail — required for custom location' },
  { label: 'Bandwidth Unit', field: 'bandwidth_unit', instruction: 'Mbps | Gbps | Dark Fiber' },
  { label: 'Bandwidth Value', field: 'bandwidth_value', instruction: 'Not required if Bandwidth Unit is Dark Fiber' },
  { label: 'Currency', field: 'currency', instruction: 'e.g. USD, EUR, GBP' },
  { label: 'MRC (12 Month)', field: 'mrc_12', instruction: 'Monthly Recurring Cost for 12-month term' },
  { label: 'NRC (12 Month)', field: 'nrc_12', instruction: 'Non-Recurring Cost for 12-month term' },
  { label: 'MRC (24 Month)', field: 'mrc_24', instruction: 'Monthly Recurring Cost for 24-month term' },
  { label: 'NRC (24 Month)', field: 'nrc_24', instruction: 'Non-Recurring Cost for 24-month term' },
  { label: 'MRC (36 Month)', field: 'mrc_36', instruction: 'Monthly Recurring Cost for 36-month term' },
  { label: 'NRC (36 Month)', field: 'nrc_36', instruction: 'Non-Recurring Cost for 36-month term' },
  { label: 'Expected Latency (ms)', field: 'expected_latency', instruction: 'Round-trip latency in milliseconds' },
  { label: 'Protection', field: 'protection', instruction: 'Unprotected | Protected' },
  { label: 'Cable System', field: 'cable_system', instruction: 'Name of submarine cable system if applicable' },
  { label: 'Quote Date', field: 'quote_date', instruction: 'DD/MM/YYYY e.g. 23/02/2026' },
  { label: 'Quote Validity (Days)', field: '_quote_validity_days', instruction: 'Number of days from quote date' },
  { label: 'MTU', field: 'mtu', instruction: 'Maximum Transmission Unit' },
  { label: 'Notes', field: 'notes', instruction: 'Any additional notes' }
];

// Columns AH–AI — Field guide (one row per field); never imported
const CSV_FIELD_GUIDE_HEADER = 'Field';
const CSV_INSTRUCTIONS_HEADER = 'Instructions';
const csvEmptyDataCells = () => CSV_ROWS.map(() => '');
const buildCsvInstructionRows = () => {
  const width = CSV_ROWS.length + 2; // A–AG + AH Field + AI Instructions
  const fieldIdx = CSV_ROWS.length; // AH
  const instrIdx = CSV_ROWS.length + 1; // AI
  const row = (fieldLabel, instruction) => {
    const cells = Array(width).fill('');
    cells[fieldIdx] = fieldLabel;
    cells[instrIdx] = instruction;
    return cells;
  };
  return [
    Array(width).fill(''),
    row(CSV_FIELD_GUIDE_HEADER, CSV_INSTRUCTIONS_HEADER),
    ...CSV_ROWS.map(r => row(r.label, r.instruction))
  ];
};

const isPopCode = (code) => !!(code && String(code).trim());

const hasCustomLocationData = (loc = {}) => !!(
  loc.name || loc.street_name || loc.street_number || loc.city
  || loc.postal_code || loc.country || loc.address
);

const composeAddress = (loc = {}) => {
  if (loc.address && String(loc.address).trim()) return String(loc.address).trim();
  const line = [loc.street_number, loc.street_name].filter(Boolean).join(' ').trim();
  return [line, loc.city, loc.postal_code, loc.country].filter(Boolean).join(', ');
};

const toSiteValidationInitial = (loc = {}) => ({
  location_name: loc.name || '',
  street_name: loc.street_name || '',
  street_number: loc.street_number || '',
  city: loc.city || '',
  postal_code: loc.postal_code || '',
  country: loc.country || '',
  address: composeAddress(loc),
  building_type: loc.building_type === 'datacenter' ? 'datacenter' : 'retail'
});

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
const PROTECTION_TYPES = ['Unprotected', 'Protected'];

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
  mrc_12: '',
  nrc_12: '',
  mrc_24: '',
  nrc_24: '',
  mrc_36: '',
  nrc_36: '',
  currency: 'USD',
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

const AddCarrierQuote = ({ onNavigateBack, editQuoteId, duplicateData }) => {
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

  // Quote validity (days) — drives expiry_date calculation
  const [quoteValidityDays, setQuoteValidityDays] = useState('');

  // CSV import state
  const csvInputRef = useRef(null);
  const [csvDragActive, setCsvDragActive] = useState(false);

  // New custom location dialog (Site Validation)
  const [customLocDialogOpen, setCustomLocDialogOpen] = useState(false);
  const [customLocTarget, setCustomLocTarget] = useState('a');
  const [siteValidationInitial, setSiteValidationInitial] = useState({});
  const [siteValidationKey, setSiteValidationKey] = useState(0);
  const [locationBuildingTypes, setLocationBuildingTypes] = useState({ a: null, b: null });
  const [locationDetailsCache, setLocationDetailsCache] = useState({ a: null, b: null });
  // Chains Location B's Site Validation immediately after Location A confirms (single-row CSV import)
  const [csvChainNext, setCsvChainNext] = useState(null);

  // Multi-row CSV bulk-create: dedicated Site Validation queue + processing dialog
  const [csvBulkQueue, setCsvBulkQueue] = useState([]);
  const csvBulkQueueRef = useRef([]);
  const [csvBulkIndex, setCsvBulkIndex] = useState(0);
  const [csvBulkOpen, setCsvBulkOpen] = useState(false);
  const [csvProcessOpen, setCsvProcessOpen] = useState(false);
  const [csvProcessStage, setCsvProcessStage] = useState('');
  const [csvProcessDetail, setCsvProcessDetail] = useState('');
  const pendingCsvRowsRef = useRef([]);
  const csvPreFailedRef = useRef([]);

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
        location_a_pop_code: quote.location_a_type === 'custom'
          ? (quote.location_a_custom_name || quote.location_a_pop_code || '')
          : (quote.location_a_pop_code || ''),
        location_a_custom_id: quote.location_a_custom_id,
        location_a_custom_name: quote.location_a_custom_name || '',
        location_b_type: quote.location_b_type || 'pop',
        location_b_pop_code: quote.location_b_type === 'custom'
          ? (quote.location_b_custom_name || quote.location_b_pop_code || '')
          : (quote.location_b_pop_code || ''),
        location_b_custom_id: quote.location_b_custom_id,
        location_b_custom_name: quote.location_b_custom_name || '',
        bandwidth_value: quote.bandwidth_value || '',
        bandwidth_unit: quote.bandwidth_unit || 'Gbps',
        mrc_12: quote.mrc_12 ?? '',
        nrc_12: quote.nrc_12 ?? '',
        mrc_24: quote.mrc_24 ?? '',
        nrc_24: quote.nrc_24 ?? '',
        mrc_36: quote.mrc_36 ?? '',
        nrc_36: quote.nrc_36 ?? '',
        currency: quote.currency || 'USD',
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

      setLocationBuildingTypes({
        a: quote.location_a_type === 'pop'
          ? (quote.location_a_pop_code ? 'datacenter' : null)
          : (quote.location_a_building_type || null),
        b: quote.location_b_type === 'pop'
          ? (quote.location_b_pop_code ? 'datacenter' : null)
          : (quote.location_b_building_type || null)
      });

      const buildCustomCache = (side) => {
        if (quote[`location_${side}_type`] !== 'custom') return null;
        return {
          id: quote[`location_${side}_custom_id`],
          location_name: quote[`location_${side}_custom_name`] || '',
          address: quote[`location_${side}_custom_address`] || '',
          city: quote[`location_${side}_custom_city`] || '',
          country: quote[`location_${side}_custom_country`] || '',
          building_type: quote[`location_${side}_building_type`] || 'retail',
          street_name: quote[`location_${side}_street_name`] || '',
          street_number: quote[`location_${side}_street_number`] || '',
          postal_code: quote[`location_${side}_postal_code`] || '',
          latitude: quote[`location_${side}_latitude`],
          longitude: quote[`location_${side}_longitude`]
        };
      };

      // Prefetch POP details for edit so + opens with pin/address
      const loadPopCache = async (side) => {
        const code = quote[`location_${side}_pop_code`];
        if (quote[`location_${side}_type`] !== 'pop' || !code) return null;
        try {
          const loc = await carrierQuoteApi.getPopLocation(code);
          return {
            fixed_pop: true,
            location_code: loc.location_code,
            location_name: loc.datacenter_name || loc.location_code || '',
            address: loc.datacenter_address || '',
            city: loc.city || '',
            country: loc.country || '',
            building_type: 'datacenter',
            street_name: '',
            street_number: '',
            postal_code: '',
            latitude: loc.latitude != null ? Number(loc.latitude) : null,
            longitude: loc.longitude != null ? Number(loc.longitude) : null
          };
        } catch (_) {
          return {
            fixed_pop: true,
            location_code: code,
            location_name: quote[`location_${side}_datacenter`] || code,
            address: '',
            city: quote[`location_${side}_city`] || '',
            country: '',
            building_type: 'datacenter',
            latitude: null,
            longitude: null
          };
        }
      };

      const [popA, popB] = await Promise.all([loadPopCache('a'), loadPopCache('b')]);
      setLocationDetailsCache({
        a: buildCustomCache('a') || popA,
        b: buildCustomCache('b') || popB
      });

      // Reverse-calculate validity days from existing dates
      if (quote.quote_date && quote.expiry_date) {
        const qd = new Date(quote.quote_date);
        const ed = new Date(quote.expiry_date);
        if (!isNaN(qd.getTime()) && !isNaN(ed.getTime())) {
          const diffDays = Math.round((ed - qd) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) setQuoteValidityDays(String(diffDays));
        }
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

  // Pre-fill form from duplicate data
  useEffect(() => {
    if (duplicateData && !isEditMode) {
      setFormData(prev => ({
        ...prev,
        ...duplicateData,
        quote_reference: ''
      }));
    }
  }, [duplicateData, isEditMode]);

  // Auto-calculate expiry_date from quote_date + validity days
  useEffect(() => {
    if (formData.quote_date && quoteValidityDays && parseInt(quoteValidityDays, 10) > 0) {
      const d = new Date(formData.quote_date);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + parseInt(quoteValidityDays, 10));
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setFormData(prev => ({ ...prev, expiry_date: `${yyyy}-${mm}-${dd}` }));
      }
    }
  }, [formData.quote_date, quoteValidityDays]);

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
  // mode: 'view' = create & navigate to repository, 'copy' = create & keep form for next entry
  const handleSubmit = async (mode = 'view') => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const submitData = { ...formData };
      if (submitData.bandwidth_value) submitData.bandwidth_value = parseFloat(submitData.bandwidth_value);
      if (submitData.mrc_12) submitData.mrc_12 = parseFloat(submitData.mrc_12);
      if (submitData.nrc_12) submitData.nrc_12 = parseFloat(submitData.nrc_12);
      if (submitData.mrc_24) submitData.mrc_24 = parseFloat(submitData.mrc_24);
      if (submitData.nrc_24) submitData.nrc_24 = parseFloat(submitData.nrc_24);
      if (submitData.mrc_36) submitData.mrc_36 = parseFloat(submitData.mrc_36);
      if (submitData.nrc_36) submitData.nrc_36 = parseFloat(submitData.nrc_36);
      if (submitData.expected_latency) submitData.expected_latency = parseFloat(submitData.expected_latency);
      if (submitData.mtu) submitData.mtu = parseInt(submitData.mtu);
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

      if (uploadFiles.length > 0 && quoteId) {
        try {
          await carrierQuoteApi.uploadAttachments(quoteId, uploadFiles);
        } catch (uploadErr) {
          setError('Quote saved but file upload failed: ' + (uploadErr.response?.data?.error || uploadErr.message));
        }
      }

      if (isEditMode || mode === 'view') {
        setTimeout(() => {
          if (onNavigateBack) onNavigateBack();
        }, 1200);
      } else if (mode === 'copy') {
        // Strip auto-suffix from reference so the next submit gets a new suffix
        const baseRef = (formData.quote_reference || '').replace(/-\d+$/, '');
        setFormData(prev => ({
          ...prev,
          quote_reference: baseRef
        }));
        setUploadFiles([]);
      }
    } catch (err) {
      setError('Failed to save quote: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Download CSV template (horizontal quotes + Field/Instructions in AH–AI)
  const handleDownloadTemplate = () => {
    const headers = [...CSV_ROWS.map(r => r.label), CSV_FIELD_GUIDE_HEADER, CSV_INSTRUCTIONS_HEADER];
    const blankRows = Array.from({ length: 5 }, () => [...csvEmptyDataCells(), '', '']);
    const rows = [headers, ...blankRows, ...buildCsvInstructionRows()];
    const csv = rows.map(row => row.map(v => escapeCsv(v)).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'carrier_quote_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Normalise a date value from various formats to YYYY-MM-DD for HTML date inputs
  const normaliseDateValue = (val) => {
    if (!val) return val;
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
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return s;
  };

  // Pure parse — no API calls, no side effects. Custom (non-POP) locations always
  // go through Site Validation before anything is written to the database.
  const parseCsvRowData = (dataMap) => {
    const updates = {};
    let fieldsPopulated = 0;
    let importedValidityDays = '';
    const dateFields = ['quote_date'];

    CSV_ROWS.forEach(row => {
      const val = dataMap[row.label];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        if (row.field === '_quote_validity_days') {
          importedValidityDays = String(val).trim();
        } else if (!row.field.startsWith('_')) {
          updates[row.field] = dateFields.includes(row.field) ? normaliseDateValue(val) : String(val).trim();
        }
        fieldsPopulated++;
      }
    });

    if (updates.quote_date && importedValidityDays && parseInt(importedValidityDays, 10) > 0) {
      const d = new Date(updates.quote_date);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + parseInt(importedValidityDays, 10));
        updates.expiry_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }

    const buildCustomLoc = (prefix) => {
      const name = dataMap[`Location ${prefix} Name`] || '';
      const street_name = dataMap[`Location ${prefix} Street Name`] || '';
      const street_number = dataMap[`Location ${prefix} Street Number`] || '';
      const city = dataMap[`Location ${prefix} City`] || '';
      const postal_code = dataMap[`Location ${prefix} Postal Code`] || '';
      const country = dataMap[`Location ${prefix} Country`] || '';
      const address = dataMap[`Location ${prefix} Address`] || ''; // legacy free-text column
      const buildingRaw = String(dataMap[`Location ${prefix} Building Type`] || '').trim().toLowerCase();
      const building_type = buildingRaw === 'datacenter' ? 'datacenter' : 'retail';
      if (address) fieldsPopulated++;
      return { name, street_name, street_number, city, postal_code, country, address, building_type };
    };

    const customLocA = buildCustomLoc('A');
    const customLocB = buildCustomLoc('B');

    if (updates.location_a_pop_code) updates.location_a_type = 'pop';
    if (updates.location_b_pop_code) updates.location_b_type = 'pop';

    return { updates, customLocA, customLocB, fieldsPopulated, importedValidityDays };
  };

  const advanceCsvBulkReview = (queue, index, preFailed) => {
    csvBulkQueueRef.current = queue;
    csvPreFailedRef.current = preFailed || csvPreFailedRef.current;
    if (index >= queue.length) {
      setCsvBulkOpen(false);
      setCsvBulkQueue([]);
      csvBulkQueueRef.current = [];
      setCsvBulkIndex(0);
      setCsvProcessStage('Creating quotes');
      setCsvProcessDetail(`Saving ${pendingCsvRowsRef.current.length} quote(s)…`);
      commitCsvBulkRows(pendingCsvRowsRef.current, csvPreFailedRef.current);
      return;
    }
    const item = queue[index];
    setCsvBulkQueue(queue);
    setCsvBulkIndex(index);
    setCsvProcessStage('Address verification');
    setCsvProcessDetail(
      `Address ${index + 1} of ${queue.length}: Row ${item.rowNum} Location ${String(item.side).toUpperCase()} — complete the map dialog to continue.`
    );
    setCsvBulkOpen(true);
  };

  const handleCsvBulkReviewConfirm = (result) => {
    const queue = csvBulkQueueRef.current.length ? csvBulkQueueRef.current : csvBulkQueue;
    const index = csvBulkIndex;
    const item = queue[index];
    if (!item) return;

    if (!result.reuse_pop && !result.id) {
      setError('Address confirm did not return a saved location. Try Confirm again.');
      return;
    }

    pendingCsvRowsRef.current = pendingCsvRowsRef.current.map(row => {
      if (row.rowKey !== item.rowKey) return row;
      const next = { ...row };
      if (item.side === 'a') {
        if (result.reuse_pop) {
          next.resolvedLocA = { type: 'pop', location_code: result.location_code };
          next.updates = { ...next.updates, location_a_pop_code: result.location_code, location_a_type: 'pop' };
        } else {
          next.resolvedLocA = { type: 'custom', id: result.id };
        }
      } else if (result.reuse_pop) {
        next.resolvedLocB = { type: 'pop', location_code: result.location_code };
        next.updates = { ...next.updates, location_b_pop_code: result.location_code, location_b_type: 'pop' };
      } else {
        next.resolvedLocB = { type: 'custom', id: result.id };
      }
      return next;
    });

    advanceCsvBulkReview(queue, index + 1, csvPreFailedRef.current);
  };

  const commitCsvBulkRows = async (rows, preFailed = []) => {
    let created = 0;
    const failures = preFailed.map(f => `Row ${f.rowNum}: ${f.error}`);
    const totalAttempted = rows.length + preFailed.length;

    for (const row of rows) {
      try {
        const payload = { ...emptyFormData, ...row.updates };

        if (row.resolvedLocA) {
          if (row.resolvedLocA.type === 'pop') {
            payload.location_a_type = 'pop';
            payload.location_a_pop_code = row.resolvedLocA.location_code;
          } else {
            payload.location_a_type = 'custom';
            payload.location_a_custom_id = row.resolvedLocA.id;
          }
        } else if (isPopCode(payload.location_a_pop_code)) {
          payload.location_a_type = 'pop';
        }

        if (row.resolvedLocB) {
          if (row.resolvedLocB.type === 'pop') {
            payload.location_b_type = 'pop';
            payload.location_b_pop_code = row.resolvedLocB.location_code;
          } else {
            payload.location_b_type = 'custom';
            payload.location_b_custom_id = row.resolvedLocB.id;
          }
        } else if (isPopCode(payload.location_b_pop_code)) {
          payload.location_b_type = 'pop';
        }

        if (payload.carrier_name) {
          try {
            const matches = await carrierQuoteApi.getCarriers(payload.carrier_name);
            if (matches && matches.length > 0) {
              const inputLower = payload.carrier_name.toLowerCase();
              const exact = matches.find(m => m.carrier_name.toLowerCase() === inputLower);
              const startsWith = matches.find(m => m.carrier_name.toLowerCase().startsWith(inputLower));
              const best = exact || startsWith || matches[0];
              payload.carrier_name = best.carrier_name;
              payload.carrier_id = best.id;
            }
          } catch (_) { /* keep typed name */ }
        }

        ['bandwidth_value', 'mrc_12', 'nrc_12', 'mrc_24', 'nrc_24', 'mrc_36', 'nrc_36', 'expected_latency'].forEach(f => {
          if (payload[f]) payload[f] = parseFloat(payload[f]);
        });
        if (payload.mtu) payload.mtu = parseInt(payload.mtu, 10);
        if (payload.bandwidth_unit === 'Dark Fiber') payload.bandwidth_value = null;

        await carrierQuoteApi.createQuote(payload);
        created++;
      } catch (rowErr) {
        failures.push(`Row ${row.rowNum}: ${rowErr.response?.data?.error || rowErr.message}`);
      }
    }

    setSaving(false);
    setCsvProcessStage('Complete');
    setCsvProcessDetail(`Created ${created} of ${totalAttempted} quotes.`);
    if (created > 0) {
      setSuccess(`Created ${created} of ${totalAttempted} quotes from CSV.`);
    }
    if (failures.length) {
      setError(failures.slice(0, 5).join(' · ') + (failures.length > 5 ? ` (+${failures.length - 5} more)` : ''));
    }
    setTimeout(() => setCsvProcessOpen(false), 1200);
  };

  const handleCsvImport = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let text = e.target.result;
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          setError('CSV file must have at least a header row and one data row');
          return;
        }

        const headerCols = parseCsvLine(lines[0]).map(c => c.trim());
        const firstHeader = (headerCols[0] || '').toLowerCase();
        if (firstHeader === 'field') {
          setError('Vertical CSV templates are no longer supported. Download the new horizontal template (one quote per row).');
          return;
        }
        if (!headerCols.some(h => h === 'Carrier Name' || h === 'Location A POP Code')) {
          setError('Unrecognised CSV headers. Download the template and keep the header row unchanged.');
          return;
        }

        // Collect non-empty data rows (skip blank rows + Field/Instructions guide; ignore AH–AI)
        const dataRows = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCsvLine(lines[i]);
          const dataMap = {};
          let anyReal = false;
          headerCols.forEach((label, idx) => {
            const val = (values[idx] || '').trim();
            if (!label) return;
            if (
              label === CSV_FIELD_GUIDE_HEADER || label === 'Field'
              || label === CSV_INSTRUCTIONS_HEADER || label === 'Instructions'
            ) return;
            dataMap[label] = val;
            if (val) anyReal = true;
          });
          if (anyReal) dataRows.push({ rowNum: i + 1, dataMap });
        }

        if (dataRows.length === 0) {
          setError('No data rows found — fill at least one quote row under the header');
          return;
        }

        // Single row → populate the form for review; custom (non-POP) locations must
        // go through Site Validation before they're attached to the form
        if (dataRows.length === 1) {
          const parsed = parseCsvRowData(dataRows[0].dataMap);
          if (parsed.fieldsPopulated === 0) {
            setError('No matching data found — ensure field names match the template');
            return;
          }
          if (parsed.importedValidityDays) setQuoteValidityDays(parsed.importedValidityDays);

          const updates = parsed.updates;
          if (updates.carrier_name) {
            try {
              const matches = await carrierQuoteApi.getCarriers(updates.carrier_name);
              if (matches && matches.length > 0) {
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
          if (updates.location_a_pop_code) setLocationBuildingTypes(prev => ({ ...prev, a: 'datacenter' }));
          if (updates.location_b_pop_code) setLocationBuildingTypes(prev => ({ ...prev, b: 'datacenter' }));

          const needsA = !updates.location_a_pop_code && hasCustomLocationData(parsed.customLocA);
          const needsB = !updates.location_b_pop_code && hasCustomLocationData(parsed.customLocB);

          if (needsA) {
            setCsvChainNext(needsB ? { side: 'b', initialValues: toSiteValidationInitial(parsed.customLocB) } : null);
            setCustomLocTarget('a');
            setSiteValidationInitial(toSiteValidationInitial(parsed.customLocA));
            setSiteValidationKey(k => k + 1);
            setCustomLocDialogOpen(true);
            setSuccess('CSV imported — verify the Location A address to continue.');
          } else if (needsB) {
            setCsvChainNext(null);
            setCustomLocTarget('b');
            setSiteValidationInitial(toSiteValidationInitial(parsed.customLocB));
            setSiteValidationKey(k => k + 1);
            setCustomLocDialogOpen(true);
            setSuccess('CSV imported — verify the Location B address to continue.');
          } else {
            setSuccess(`CSV imported — ${parsed.fieldsPopulated} field${parsed.fieldsPopulated !== 1 ? 's' : ''} populated. Please review before submitting.`);
          }
          return;
        }

        // Multiple rows → verify every custom (non-POP) address via Site Validation
        // first, then create the quotes. Nothing is written to the database until
        // each custom location has been confirmed.
        setSaving(true);
        setCsvProcessOpen(true);
        setCsvProcessStage('Processing CSV');
        setCsvProcessDetail(`Reading ${dataRows.length} row(s)…`);

        const preFailed = [];
        const validRows = [];
        const reviewQueue = [];

        dataRows.forEach(({ rowNum, dataMap }) => {
          const parsed = parseCsvRowData(dataMap);
          const { updates } = parsed;
          if (!updates.carrier_name || !updates.service_type || !updates.region || !updates.bandwidth_unit) {
            preFailed.push({ rowNum, error: 'Carrier Name, Service Type, Region, and Bandwidth Unit are required' });
            return;
          }
          const rowKey = `csvrow-${rowNum}`;
          const entry = {
            rowKey, rowNum, updates: { ...updates }, resolvedLocA: null, resolvedLocB: null
          };
          if (!updates.location_a_pop_code && hasCustomLocationData(parsed.customLocA)) {
            reviewQueue.push({ rowKey, rowNum, side: 'a', initialValues: toSiteValidationInitial(parsed.customLocA) });
          }
          if (!updates.location_b_pop_code && hasCustomLocationData(parsed.customLocB)) {
            reviewQueue.push({ rowKey, rowNum, side: 'b', initialValues: toSiteValidationInitial(parsed.customLocB) });
          }
          validRows.push(entry);
        });

        pendingCsvRowsRef.current = validRows;

        if (validRows.length === 0) {
          setSaving(false);
          setCsvProcessOpen(false);
          setError(`All ${preFailed.length} row(s) failed validation: ` + preFailed.map(f => `Row ${f.rowNum}: ${f.error}`).join(' · '));
          return;
        }

        if (reviewQueue.length > 0) {
          csvPreFailedRef.current = preFailed;
          advanceCsvBulkReview(reviewQueue, 0, preFailed);
          return;
        }

        setCsvProcessStage('Creating quotes');
        setCsvProcessDetail(`Saving ${validRows.length} quote(s)…`);
        await commitCsvBulkRows(validRows, preFailed);
      } catch (err) {
        console.error('CSV parse error:', err);
        setError('Failed to parse CSV file: ' + err.message);
        setSaving(false);
        setCsvProcessOpen(false);
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

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Confirm site validation / create or reuse custom location
  const handleSiteValidationConfirm = (result) => {
    const target = customLocTarget;

    // If a single-row CSV import queued Location B, open it immediately after A confirms
    const proceedChain = () => {
      if (csvChainNext) {
        const next = csvChainNext;
        setCsvChainNext(null);
        setCustomLocTarget(next.side);
        setSiteValidationInitial(next.initialValues);
        setSiteValidationKey(k => k + 1);
        setCustomLocDialogOpen(true);
      } else {
        setCustomLocDialogOpen(false);
      }
    };

    if (result.reuse_pop) {
      setFormData(prev => ({
        ...prev,
        [`location_${target}_type`]: 'pop',
        [`location_${target}_pop_code`]: result.location_code,
        [`location_${target}_custom_id`]: null,
        [`location_${target}_custom_name`]: ''
      }));
      setLocationBuildingTypes(prev => ({ ...prev, [target]: 'datacenter' }));
      setLocationDetailsCache(prev => ({ ...prev, [target]: null }));
      setSuccess(`Linked to POP ${result.location_code}`);
      proceedChain();
      return;
    }

    setFormData(prev => ({
      ...prev,
      [`location_${target}_type`]: 'custom',
      [`location_${target}_custom_id`]: result.id,
      [`location_${target}_custom_name`]: result.location_name,
      [`location_${target}_pop_code`]: result.location_name
    }));
    setLocationBuildingTypes(prev => ({
      ...prev,
      [target]: result.building_type || 'retail'
    }));
    setLocationDetailsCache(prev => ({
      ...prev,
      [target]: {
        id: result.id,
        location_name: result.location_name || '',
        address: result.address || '',
        city: result.city || '',
        country: result.country || '',
        building_type: result.building_type || 'retail',
        street_name: result.street_name || '',
        street_number: result.street_number || '',
        postal_code: result.postal_code || '',
        latitude: result.latitude,
        longitude: result.longitude
      }
    }));

    setSiteValidationInitial({});
    setSuccess(result.already_exists ? 'Location saved' : 'Custom location created');
    searchCustomLocations('');
    proceedChain();
  };

  const openSiteValidation = async (target) => {
    setCustomLocTarget(target);
    const cached = locationDetailsCache[target];
    const customId = formData[`location_${target}_custom_id`];
    const locType = formData[`location_${target}_type`];
    const popCode = formData[`location_${target}_pop_code`];

    const toPopDetails = (loc) => ({
      fixed_pop: true,
      location_code: loc.location_code,
      location_name: loc.datacenter_name || loc.location_code || '',
      address: loc.datacenter_address || '',
      city: loc.city || '',
      country: loc.country || '',
      building_type: 'datacenter',
      street_name: '',
      street_number: '',
      postal_code: '',
      latitude: loc.latitude != null ? Number(loc.latitude) : null,
      longitude: loc.longitude != null ? Number(loc.longitude) : null
    });

    if (cached && cached.fixed_pop && cached.location_code) {
      setSiteValidationInitial({ ...cached });
    } else if (cached && cached.id) {
      setSiteValidationInitial({ ...cached });
    } else if (customId) {
      try {
        const loc = await carrierQuoteApi.getCustomLocation(customId);
        const details = {
          id: loc.id,
          location_name: loc.location_name || '',
          address: loc.address || '',
          city: loc.city || '',
          country: loc.country || '',
          building_type: loc.building_type || 'retail',
          street_name: loc.street_name || '',
          street_number: loc.street_number || '',
          postal_code: loc.postal_code || '',
          latitude: loc.latitude,
          longitude: loc.longitude
        };
        setLocationDetailsCache(prev => ({ ...prev, [target]: details }));
        setSiteValidationInitial(details);
      } catch (err) {
        setSiteValidationInitial({ building_type: 'retail' });
        setError('Could not load location details: ' + (err.response?.data?.error || err.message));
      }
    } else if (locType === 'pop' && popCode) {
      try {
        // Prefer exact code; also accept "CODE - Name" leftover from older autocomplete behaviour
        const raw = String(popCode).trim();
        const codeCandidate = (raw.includes(' - ') ? raw.split(' - ')[0] : raw).trim();
        const codeKey = codeCandidate.toUpperCase();
        const fromOptions = popLocations.find(p =>
          String(p.location_code || '').trim().toUpperCase() === codeKey
          || String(p.datacenter_name || '').trim().toUpperCase() === codeKey
          || String(p.location_code || '').trim().toUpperCase() === raw.toUpperCase()
        );
        let loc = fromOptions;
        if (!loc) {
          loc = await carrierQuoteApi.getPopLocation(codeCandidate);
        }
        if (!loc || !loc.location_code) {
          throw new Error('POP location not found');
        }
        const details = toPopDetails(loc);
        setFormData(prev => ({
          ...prev,
          [`location_${target}_pop_code`]: loc.location_code,
          [`location_${target}_type`]: 'pop'
        }));
        setLocationDetailsCache(prev => ({ ...prev, [target]: details }));
        setLocationBuildingTypes(prev => ({ ...prev, [target]: 'datacenter' }));
        setSiteValidationInitial(details);
      } catch (err) {
        setSiteValidationInitial({ building_type: 'datacenter', location_name: String(popCode).trim() });
        setError('Could not load POP location: ' + (err.response?.data?.error || err.message));
      }
    } else {
      setSiteValidationInitial({ building_type: 'retail' });
    }

    setSiteValidationKey(k => k + 1);
    setCustomLocDialogOpen(true);
  };

  // Combined location options for autocomplete (POP + Custom)
  const getLocationOptions = () => {
    const popOptions = popLocations.map(loc => ({
      type: 'pop',
      id: null,
      code: loc.location_code,
      label: `${loc.location_code} - ${loc.datacenter_name || loc.city || ''}`,
      customId: null,
      building_type: 'datacenter',
      datacenter_name: loc.datacenter_name,
      datacenter_address: loc.datacenter_address,
      city: loc.city,
      country: loc.country,
      latitude: loc.latitude,
      longitude: loc.longitude
    }));
    const customOptions = customLocations.map(loc => ({
      type: 'custom',
      id: loc.id,
      code: loc.location_name,
      label: `${loc.location_name}${loc.address ? ' - ' + loc.address : ''}${loc.city ? ', ' + loc.city : ''}`,
      customId: loc.id,
      building_type: loc.building_type || null
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
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Autocomplete
                freeSolo
                size="small"
                fullWidth
                options={getLocationOptions()}
                getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.label || opt.code || ''}
                groupBy={(opt) => opt.type === 'pop' ? 'POP Locations' : 'Custom Locations'}
                inputValue={formData.location_a_pop_code || formData.location_a_custom_name || ''}
                onInputChange={(_, value, reason) => {
                  // 'reset' fires after option select — onChange owns the real POP/custom code
                  if (reason === 'reset') return;
                  if (reason === 'clear') {
                    setFormData(prev => ({
                      ...prev,
                      location_a_pop_code: '',
                      location_a_type: 'pop',
                      location_a_custom_id: null,
                      location_a_custom_name: ''
                    }));
                    setLocationBuildingTypes(prev => ({ ...prev, a: null }));
                    setLocationDetailsCache(prev => ({ ...prev, a: null }));
                    return;
                  }
                  setFormData(prev => ({
                    ...prev,
                    location_a_pop_code: value,
                    location_a_type: 'pop',
                    location_a_custom_id: null,
                    location_a_custom_name: ''
                  }));
                  setLocationBuildingTypes(prev => ({ ...prev, a: null }));
                  setLocationDetailsCache(prev => ({ ...prev, a: null }));
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
                      setLocationBuildingTypes(prev => ({ ...prev, a: 'datacenter' }));
                      setLocationDetailsCache(prev => ({
                        ...prev,
                        a: {
                          fixed_pop: true,
                          location_code: value.code,
                          location_name: value.datacenter_name || value.code,
                          address: value.datacenter_address || '',
                          city: value.city || '',
                          country: value.country || '',
                          building_type: 'datacenter',
                          street_name: '',
                          street_number: '',
                          postal_code: '',
                          latitude: value.latitude != null ? Number(value.latitude) : null,
                          longitude: value.longitude != null ? Number(value.longitude) : null
                        }
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        location_a_type: 'custom',
                        location_a_pop_code: value.code,
                        location_a_custom_id: value.customId,
                        location_a_custom_name: value.code
                      }));
                      setLocationBuildingTypes(prev => ({ ...prev, a: value.building_type || null }));
                      setLocationDetailsCache(prev => ({
                        ...prev,
                        a: value.customId ? {
                          id: value.customId,
                          location_name: value.code,
                          building_type: value.building_type || 'retail'
                        } : null
                      }));
                    }
                  }
                }}
                renderInput={(params) => <TextField {...params} label="Location A" />}
              />
              <Tooltip title="Add / edit & validate location">
                <IconButton size="small" onClick={() => openSiteValidation('a')}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            </Box>
            {locationBuildingTypes.a && (
              <Chip
                size="small"
                label={locationBuildingTypes.a === 'datacenter' ? 'Datacenter' : 'Retail'}
                sx={{ mt: 0.75 }}
                color={locationBuildingTypes.a === 'datacenter' ? 'primary' : 'default'}
              />
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Autocomplete
                freeSolo
                size="small"
                fullWidth
                options={getLocationOptions()}
                getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.label || opt.code || ''}
                groupBy={(opt) => opt.type === 'pop' ? 'POP Locations' : 'Custom Locations'}
                inputValue={formData.location_b_pop_code || formData.location_b_custom_name || ''}
                onInputChange={(_, value, reason) => {
                  if (reason === 'reset') return;
                  if (reason === 'clear') {
                    setFormData(prev => ({
                      ...prev,
                      location_b_pop_code: '',
                      location_b_type: 'pop',
                      location_b_custom_id: null,
                      location_b_custom_name: ''
                    }));
                    setLocationBuildingTypes(prev => ({ ...prev, b: null }));
                    setLocationDetailsCache(prev => ({ ...prev, b: null }));
                    return;
                  }
                  setFormData(prev => ({
                    ...prev,
                    location_b_pop_code: value,
                    location_b_type: 'pop',
                    location_b_custom_id: null,
                    location_b_custom_name: ''
                  }));
                  setLocationBuildingTypes(prev => ({ ...prev, b: null }));
                  setLocationDetailsCache(prev => ({ ...prev, b: null }));
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
                      setLocationBuildingTypes(prev => ({ ...prev, b: 'datacenter' }));
                      setLocationDetailsCache(prev => ({
                        ...prev,
                        b: {
                          fixed_pop: true,
                          location_code: value.code,
                          location_name: value.datacenter_name || value.code,
                          address: value.datacenter_address || '',
                          city: value.city || '',
                          country: value.country || '',
                          building_type: 'datacenter',
                          street_name: '',
                          street_number: '',
                          postal_code: '',
                          latitude: value.latitude != null ? Number(value.latitude) : null,
                          longitude: value.longitude != null ? Number(value.longitude) : null
                        }
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        location_b_type: 'custom',
                        location_b_pop_code: value.code,
                        location_b_custom_id: value.customId,
                        location_b_custom_name: value.code
                      }));
                      setLocationBuildingTypes(prev => ({ ...prev, b: value.building_type || null }));
                      setLocationDetailsCache(prev => ({
                        ...prev,
                        b: value.customId ? {
                          id: value.customId,
                          location_name: value.code,
                          building_type: value.building_type || 'retail'
                        } : null
                      }));
                    }
                  }
                }}
                renderInput={(params) => <TextField {...params} label="Location B" />}
              />
              <Tooltip title="Add / edit & validate location">
                <IconButton size="small" onClick={() => openSiteValidation('b')}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            </Box>
            {locationBuildingTypes.b && (
              <Chip
                size="small"
                label={locationBuildingTypes.b === 'datacenter' ? 'Datacenter' : 'Retail'}
                sx={{ mt: 0.75 }}
                color={locationBuildingTypes.b === 'datacenter' ? 'primary' : 'default'}
              />
            )}
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
              <InputLabel>Protection</InputLabel>
              <Select value={formData.protection} onChange={(e) => setFormData(prev => ({ ...prev, protection: e.target.value }))} label="Protection">
                {PROTECTION_TYPES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          {/* Term-based pricing grid */}
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, mt: 1 }}>
              Enter pricing for each contract term quoted by the carrier. Leave blank for terms not offered.
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: 80 }}></TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">12 Months</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">24 Months</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">36 Months</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>MRC</TableCell>
                    {[12, 24, 36].map(t => (
                      <TableCell key={`mrc_${t}`} align="center">
                        <TextField
                          size="small"
                          type="number"
                          value={formData[`mrc_${t}`]}
                          onChange={(e) => setFormData(prev => ({ ...prev, [`mrc_${t}`]: e.target.value }))}
                          InputProps={{ startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment> }}
                          sx={{ maxWidth: 180 }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>NRC</TableCell>
                    {[12, 24, 36].map(t => (
                      <TableCell key={`nrc_${t}`} align="center">
                        <TextField
                          size="small"
                          type="number"
                          value={formData[`nrc_${t}`]}
                          onChange={(e) => setFormData(prev => ({ ...prev, [`nrc_${t}`]: e.target.value }))}
                          InputProps={{ startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment> }}
                          sx={{ maxWidth: 180 }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
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
              type="number"
              label="Quote Validity (Days)"
              value={quoteValidityDays}
              onChange={(e) => setQuoteValidityDays(e.target.value)}
              helperText={formData.quote_date && quoteValidityDays ? `Expires: ${new Date(new Date(formData.quote_date).getTime() + parseInt(quoteValidityDays, 10) * 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Set quote date first'}
              InputProps={{ inputProps: { min: 1 } }}
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

      {/* Section 8: Attachments */}
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
          {isEditMode ? (
            <Button
              variant="contained"
              size="large"
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
              onClick={() => handleSubmit('view')}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Update Quote'}
            </Button>
          ) : (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="outlined"
                size="large"
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                onClick={() => handleSubmit('copy')}
                disabled={saving}
              >
                Create Quote & Copy
              </Button>
              <Button
                variant="contained"
                size="large"
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                onClick={() => handleSubmit('view')}
                disabled={saving}
              >
                Create Quote & View
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Site Validation Dialog */}
      <SiteValidationDialog
        key={`site-val-${customLocTarget}-${siteValidationKey}`}
        open={customLocDialogOpen}
        onClose={() => { setCsvChainNext(null); setCustomLocDialogOpen(false); }}
        onConfirm={handleSiteValidationConfirm}
        initialValues={siteValidationInitial}
        title={`Site validation (Location ${String(customLocTarget).toUpperCase()})`}
      />

      {/* Multi-row CSV import: processing dialog + dedicated Site Validation queue.
          Quotes are only created after every custom address has been confirmed. */}
      <Dialog open={csvProcessOpen} disableEscapeKeyDown maxWidth="sm" fullWidth sx={{ zIndex: 1400 }}>
        <DialogTitle>Processing CSV import</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>{csvProcessStage || 'Working…'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {csvProcessDetail || 'Please wait…'}
          </Typography>
          <LinearProgress
            variant={csvBulkOpen && csvBulkQueue.length ? 'determinate' : 'indeterminate'}
            value={csvBulkQueue.length ? Math.round((csvBulkIndex / Math.max(csvBulkQueue.length, 1)) * 100) : 0}
          />
          {csvBulkOpen && csvBulkQueue.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
              Complete each Site Validation dialog ({csvBulkIndex + 1} of {csvBulkQueue.length}). Quotes are created only after all addresses are confirmed.
            </Typography>
          )}
        </DialogContent>
        {csvBulkOpen && (
          <DialogActions>
            <Button
              color="inherit"
              onClick={() => {
                setCsvBulkOpen(false);
                setCsvProcessOpen(false);
                setSaving(false);
                setError('Address verification cancelled. Quotes were not created.');
                setCsvBulkQueue([]);
                csvBulkQueueRef.current = [];
                setCsvBulkIndex(0);
                pendingCsvRowsRef.current = [];
                csvPreFailedRef.current = [];
              }}
            >
              Cancel import
            </Button>
          </DialogActions>
        )}
      </Dialog>

      <SiteValidationDialog
        key={`csv-bulk-${csvBulkIndex}-${(csvBulkQueue[csvBulkIndex] && csvBulkQueue[csvBulkIndex].rowKey) || 'none'}-${(csvBulkQueue[csvBulkIndex] && csvBulkQueue[csvBulkIndex].side) || ''}`}
        open={csvBulkOpen}
        dialogSx={{ zIndex: 1500 }}
        onClose={() => {
          setCsvBulkOpen(false);
          setCsvProcessOpen(false);
          setSaving(false);
          setError('Address verification cancelled. Quotes were not created.');
          setCsvBulkQueue([]);
          csvBulkQueueRef.current = [];
          setCsvBulkIndex(0);
          pendingCsvRowsRef.current = [];
          csvPreFailedRef.current = [];
        }}
        onConfirm={handleCsvBulkReviewConfirm}
        initialValues={(csvBulkQueue[csvBulkIndex] && csvBulkQueue[csvBulkIndex].initialValues) || { building_type: 'retail' }}
        title={`Address ${csvBulkIndex + 1} of ${Math.max(csvBulkQueue.length, 1)} — verify Row ${(csvBulkQueue[csvBulkIndex] && csvBulkQueue[csvBulkIndex].rowNum) || ''} Location ${String((csvBulkQueue[csvBulkIndex] && csvBulkQueue[csvBulkIndex].side) || '').toUpperCase()}`}
        confirmLabel={csvBulkIndex < csvBulkQueue.length - 1 ? 'Next address' : 'Confirm & create quotes'}
      />

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
