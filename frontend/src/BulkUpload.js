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
import SiteValidationDialog from './SiteValidationDialog';

const CARRIER_QUOTE_MODULE_ID = 'carrier_quotes';

const CARRIER_QUOTE_FIELDS = [
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

// After data columns: Field (guide) + Instructions (guide) — never imported.
// With 37 data columns (A–AK), guide is AL = Field, AM = Instructions.
const CARRIER_QUOTE_FIELD_GUIDE_HEADER = 'Field';
const CARRIER_QUOTE_INSTRUCTIONS_HEADER = 'Instructions';
const emptyDataCells = () => CARRIER_QUOTE_FIELDS.map(() => '');
const buildCarrierQuoteInstructionRows = () => {
  const width = CARRIER_QUOTE_FIELDS.length + 2;
  const fieldIdx = CARRIER_QUOTE_FIELDS.length;
  const instrIdx = CARRIER_QUOTE_FIELDS.length + 1;
  const row = (fieldLabel, instruction) => {
    const cells = Array(width).fill('');
    cells[fieldIdx] = fieldLabel;
    cells[instrIdx] = instruction;
    return cells;
  };
  return [
    Array(width).fill(''),
    row(CARRIER_QUOTE_FIELD_GUIDE_HEADER, CARRIER_QUOTE_INSTRUCTIONS_HEADER),
    ...CARRIER_QUOTE_FIELDS.map(r => row(r.label, r.instruction))
  ];
};

const normalizeBuildingType = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'datacenter' || v === 'dc' || v === 'data centre' || v === 'data center') return 'datacenter';
  if (v === 'retail') return 'retail';
  return '';
};

const composeAddress = (loc = {}) => {
  if (loc.address && String(loc.address).trim()) return String(loc.address).trim();
  const line = [loc.street_number, loc.street_name].filter(Boolean).join(' ').trim();
  return [line, loc.city, loc.postal_code, loc.country].filter(Boolean).join(', ');
};

const toSiteValidationInitial = (customLoc) => ({
  location_name: customLoc.name || '',
  street_name: customLoc.street_name || '',
  street_number: customLoc.street_number || '',
  city: customLoc.city || '',
  postal_code: customLoc.postal_code || '',
  country: customLoc.country || '',
  address: composeAddress(customLoc),
  building_type: normalizeBuildingType(customLoc.building_type) || 'retail'
});

const isPopCode = (code) => !!(code && String(code).trim());

const hasCustomLocationData = (loc = {}) => !!(
  loc.name || loc.street_name || loc.street_number || loc.city
  || loc.postal_code || loc.country || loc.address
);

/** Trim Excel header keys so "Carrier Name " still matches */
const normalizeExcelRowKeys = (rowObj) => {
  const out = {};
  Object.keys(rowObj || {}).forEach((k) => {
    out[String(k).replace(/^\uFEFF/, '').trim()] = rowObj[k];
  });
  return out;
};

/** Prefer sheet named Quotes; otherwise first sheet with carrier-quote headers */
const findCarrierQuoteSheetName = (wb) => {
  const byName = wb.SheetNames.find(n => String(n).trim().toLowerCase() === 'quotes');
  if (byName) return byName;
  for (const name of wb.SheetNames) {
    const lower = String(name).trim().toLowerCase();
    if (lower === 'instructions' || lower === 'field guide') continue;
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const header = (rows[0] || []).map(c => String(c || '').replace(/^\uFEFF/, '').trim());
    if (header.includes('Carrier Name') || header.includes('Location A POP Code')) {
      return name;
    }
  }
  return null;
};

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
  const [pendingQuoteRows, setPendingQuoteRows] = useState([]);
  const pendingQuoteRowsRef = useRef([]);
  const [siteReviewQueue, setSiteReviewQueue] = useState([]);
  const siteReviewQueueRef = useRef([]);
  const [siteReviewIndex, setSiteReviewIndex] = useState(0);
  const [siteReviewOpen, setSiteReviewOpen] = useState(false);
  const [bulkProcessOpen, setBulkProcessOpen] = useState(false);
  const [bulkProcessStage, setBulkProcessStage] = useState('');
  const [bulkProcessDetail, setBulkProcessDetail] = useState('');

  const updatePendingQuoteRows = (updater) => {
    setPendingQuoteRows(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pendingQuoteRowsRef.current = next;
      return next;
    });
  };

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

  // Download carrier quote Excel template (horizontal quotes + Field/Instructions in AH–AI)
  const handleCarrierQuoteTemplateDownload = () => {
    const wb = XLSX.utils.book_new();
    const headers = [
      ...CARRIER_QUOTE_FIELDS.map(r => r.label),
      CARRIER_QUOTE_FIELD_GUIDE_HEADER,
      CARRIER_QUOTE_INSTRUCTIONS_HEADER
    ];
    const blankQuoteRows = Array.from({ length: 5 }, () => [...emptyDataCells(), '', '']);
    const guideRows = buildCarrierQuoteInstructionRows();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...blankQuoteRows, ...guideRows]);
    ws['!cols'] = [
      ...CARRIER_QUOTE_FIELDS.map(r => ({ wch: Math.min(28, Math.max(14, r.label.length + 2)) })),
      { wch: 28 },
      { wch: 70 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Quotes');

    const instrWs = XLSX.utils.aoa_to_sheet([
      ['Carrier Quote Bulk Upload Instructions'],
      [''],
      ['1. Use the "Quotes" sheet. Each DATA ROW (rows 2+) is one carrier quote (data columns only).'],
      ['2. After Notes, Field / Instructions columns are a guide only — ignored on upload.'],
      ['3. Do not rename header columns. Add as many quote rows as needed under the header (above the Field / Instructions guide).'],
      ['4. Required fields: Carrier Name, Service Type, Region, Bandwidth Unit.'],
      ['5. Bandwidth Value is required unless Bandwidth Unit is "Dark Fiber".'],
      ['6. Custom locations (no POP): Name + Street Name/Number + City + Postal Code + Country + Building Type. Site Validation opens for every custom endpoint.'],
      ['7. POP-linked endpoints are always treated as Datacenter and skip Site Validation.'],
      ['8. Dates should be entered as DD/MM/YYYY (e.g. 23/02/2026).'],
      ['9. In Site Validation, review matches and Confirm / Next address before quotes are created.'],
      ['10. Save the file and upload via the Bulk Upload facility.']
    ]);
    instrWs['!cols'] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');

    XLSX.writeFile(wb, 'carrier_quote_bulk_template.xlsx');
    setSuccess('Carrier quote template downloaded');
  };

  // Parse horizontal Quotes sheet (or legacy vertical sheet) into quote data
  const parseCarrierQuoteRowObject = (rowObj) => {
    const quoteData = {};
    const dateFields = ['quote_date'];
    let fieldsPopulated = 0;
    let validityDays = '';
    const customLocA = {};
    const customLocB = {};

    const cleaned = normalizeExcelRowKeys(rowObj);
    delete cleaned[CARRIER_QUOTE_FIELD_GUIDE_HEADER];
    delete cleaned[CARRIER_QUOTE_INSTRUCTIONS_HEADER];
    delete cleaned.Field;
    delete cleaned.Instructions;

    CARRIER_QUOTE_FIELDS.forEach(r => {
      const raw = cleaned[r.label];
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
        const strVal = String(raw).trim();
        if (r.field === '_quote_validity_days') {
          validityDays = strVal;
        } else if (r.field.startsWith('_loc_a_')) {
          customLocA[r.field.replace('_loc_a_', '')] = strVal;
        } else if (r.field.startsWith('_loc_b_')) {
          customLocB[r.field.replace('_loc_b_', '')] = strVal;
        } else if (!r.field.startsWith('_')) {
          quoteData[r.field] = dateFields.includes(r.field) ? normaliseDateValue(raw) : strVal;
        }
        fieldsPopulated++;
      }
    });

    // Legacy free-text Address column (older templates)
    const legacyAddrA = cleaned['Location A Address'];
    if (legacyAddrA !== undefined && legacyAddrA !== null && String(legacyAddrA).trim() !== '') {
      customLocA.address = String(legacyAddrA).trim();
      fieldsPopulated++;
    }
    const legacyAddrB = cleaned['Location B Address'];
    if (legacyAddrB !== undefined && legacyAddrB !== null && String(legacyAddrB).trim() !== '') {
      customLocB.address = String(legacyAddrB).trim();
      fieldsPopulated++;
    }

    if (customLocA.building_type) {
      customLocA.building_type = normalizeBuildingType(customLocA.building_type) || customLocA.building_type;
    }
    if (customLocB.building_type) {
      customLocB.building_type = normalizeBuildingType(customLocB.building_type) || customLocB.building_type;
    }

    if (quoteData.quote_date && validityDays && parseInt(validityDays, 10) > 0) {
      const d = new Date(quoteData.quote_date);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + parseInt(validityDays, 10));
        quoteData.expiry_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }

    return { quoteData, customLocA, customLocB, fieldsPopulated };
  };

  // Legacy vertical sheet support (Field / Value columns)
  const parseCarrierQuoteSheetVertical = (ws) => {
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
    const dataMap = {};
    const startIdx = data.length > 0 && String(data[0][0] || '').trim().toLowerCase() === 'field' ? 1 : 0;
    for (let i = startIdx; i < data.length; i++) {
      const row = data[i] || [];
      const label = String(row[0] || '').trim();
      const value = row[1] !== undefined && row[1] !== null ? row[1] : '';
      if (label) dataMap[label] = value;
    }
    return parseCarrierQuoteRowObject(dataMap);
  };

  // Every non-POP custom location must go through Site Validation (user picks match or confirms)
  const queueCustomSiteReview = (row, side, customLoc, reviewQueue) => {
    if (!hasCustomLocationData(customLoc)) return;
    reviewQueue.push({
      rowKey: row.rowKey,
      rowLabel: row.rowLabel,
      side,
      initialValues: toSiteValidationInitial(customLoc)
    });
  };

  const commitCarrierQuoteRows = async (rows) => {
    const results = { total: rows.length, created: 0, failed: 0, details: [] };

    for (let i = 0; i < rows.length; i++) {
      const { rowLabel, quoteData, customLocA, customLocB, resolvedLocA, resolvedLocB } = rows[i];
      try {
        const payload = { ...quoteData };

        if (payload.carrier_name) {
          const matches = await carrierQuoteApi.getCarriers(payload.carrier_name);
          if (matches && matches.length > 0) {
            const inputLower = payload.carrier_name.toLowerCase();
            const exact = matches.find(m => m.carrier_name.toLowerCase() === inputLower);
            const startsWith = matches.find(m => m.carrier_name.toLowerCase().startsWith(inputLower));
            const best = exact || startsWith || matches[0];
            payload.carrier_name = best.carrier_name;
            payload.carrier_id = best.id;
          }
        }

        if (resolvedLocA) {
          if (resolvedLocA.type === 'pop') {
            payload.location_a_type = 'pop';
            payload.location_a_pop_code = resolvedLocA.location_code;
            payload.location_a_custom_id = null;
          } else {
            payload.location_a_type = 'custom';
            payload.location_a_custom_id = resolvedLocA.id;
          }
        } else if (!isPopCode(payload.location_a_pop_code) && hasCustomLocationData(customLocA)) {
          throw new Error('Location A was not address-verified — re-run bulk upload');
        } else if (isPopCode(payload.location_a_pop_code)) {
          payload.location_a_type = 'pop';
        }

        if (resolvedLocB) {
          if (resolvedLocB.type === 'pop') {
            payload.location_b_type = 'pop';
            payload.location_b_pop_code = resolvedLocB.location_code;
            payload.location_b_custom_id = null;
          } else {
            payload.location_b_type = 'custom';
            payload.location_b_custom_id = resolvedLocB.id;
          }
        } else if (!isPopCode(payload.location_b_pop_code) && hasCustomLocationData(customLocB)) {
          throw new Error('Location B was not address-verified — re-run bulk upload');
        } else if (isPopCode(payload.location_b_pop_code)) {
          payload.location_b_type = 'pop';
        }

        ['bandwidth_value', 'mrc_12', 'nrc_12', 'mrc_24', 'nrc_24', 'mrc_36', 'nrc_36', 'expected_latency'].forEach(f => {
          if (payload[f]) payload[f] = parseFloat(payload[f]);
        });
        if (payload.mtu) payload.mtu = parseInt(payload.mtu, 10);
        if (payload.bandwidth_unit === 'Dark Fiber') payload.bandwidth_value = null;

        const result = await carrierQuoteApi.createQuote(payload);
        results.created++;
        results.details.push({ sheet: rowLabel, status: 'success', message: `Created as ${result.quote_reference}` });
      } catch (err) {
        results.failed++;
        results.details.push({ sheet: rowLabel, status: 'error', message: err.response?.data?.error || err.message });
      }
    }

    setCarrierQuoteResults(results);
    setBulkProcessStage('Complete');
    setBulkProcessDetail(`Created ${results.created} of ${results.total} quotes.`);
    if (results.created > 0) {
      setSuccess(`Successfully created ${results.created} of ${results.total} quotes`);
    }
    if (results.failed > 0 && results.created === 0) {
      setError(`All ${results.failed} quotes failed. Check details below.`);
    } else if (results.failed > 0) {
      setError(`${results.failed} of ${results.total} quotes had errors. Check details below.`);
    }
    setUploading(false);
    // Keep process dialog briefly visible then close
    setTimeout(() => setBulkProcessOpen(false), 1200);
  };

  const advanceSiteReview = (queue, index) => {
    const q = queue || [];
    siteReviewQueueRef.current = q;
    if (index >= q.length) {
      setSiteReviewOpen(false);
      setSiteReviewQueue([]);
      siteReviewQueueRef.current = [];
      setSiteReviewIndex(0);
      setBulkProcessStage('Creating quotes');
      setBulkProcessDetail(`Saving ${pendingQuoteRowsRef.current.length} quote(s)…`);
      commitCarrierQuoteRows(pendingQuoteRowsRef.current);
      return;
    }
    const item = q[index];
    setSiteReviewQueue(q);
    setSiteReviewIndex(index);
    setBulkProcessStage('Address verification');
    setBulkProcessDetail(
      `Address ${index + 1} of ${q.length}: ${item.rowLabel} Location ${String(item.side || '').toUpperCase()} — complete the map dialog to continue.`
    );
    setBulkProcessOpen(true);
    setSiteReviewOpen(true);
  };

  const handleSiteReviewConfirm = (result) => {
    const queue = siteReviewQueueRef.current.length ? siteReviewQueueRef.current : siteReviewQueue;
    const index = siteReviewIndex;
    const item = queue[index];
    if (!item) return;

    if (!result.reuse_pop && !result.id) {
      setError('Address confirm did not return a saved location. Try Confirm again.');
      return;
    }

    updatePendingQuoteRows(prev => prev.map(row => {
      if (row.rowKey !== item.rowKey) return row;
      const next = { ...row };
      if (item.side === 'a') {
        if (result.reuse_pop) {
          next.resolvedLocA = { type: 'pop', location_code: result.location_code };
          next.quoteData = { ...next.quoteData, location_a_pop_code: result.location_code };
        } else {
          next.resolvedLocA = { type: 'custom', id: result.id };
          next.customLocA = {
            ...next.customLocA,
            name: result.location_name,
            street_name: result.street_name || '',
            street_number: result.street_number || '',
            postal_code: result.postal_code || '',
            address: result.address || composeAddress(result),
            city: result.city,
            country: result.country,
            building_type: result.building_type,
            latitude: result.latitude,
            longitude: result.longitude
          };
        }
      } else if (result.reuse_pop) {
        next.resolvedLocB = { type: 'pop', location_code: result.location_code };
        next.quoteData = { ...next.quoteData, location_b_pop_code: result.location_code };
      } else {
        next.resolvedLocB = { type: 'custom', id: result.id };
        next.customLocB = {
          ...next.customLocB,
          name: result.location_name,
          street_name: result.street_name || '',
          street_number: result.street_number || '',
          postal_code: result.postal_code || '',
          address: result.address || composeAddress(result),
          city: result.city,
          country: result.country,
          building_type: result.building_type,
          latitude: result.latitude,
          longitude: result.longitude
        };
      }
      return next;
    }));

    advanceSiteReview(queue, index + 1);
  };

  // Handle carrier quote bulk upload (horizontal Quotes sheet preferred)
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
    setPendingQuoteRows([]);
    pendingQuoteRowsRef.current = [];
    setSiteReviewQueue([]);
    siteReviewQueueRef.current = [];
    setSiteReviewOpen(false);
    setBulkProcessOpen(true);
    setBulkProcessStage('Processing bulk upload');
    setBulkProcessDetail('Reading Excel file…');

    try {
      const arrayBuffer = await uploadFile.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });

      const parsedRows = [];
      const quotesSheetName = findCarrierQuoteSheetName(wb);

      setBulkProcessDetail(
        quotesSheetName
          ? `Parsing sheet "${quotesSheetName}"…`
          : 'Looking for quote sheets…'
      );

      if (quotesSheetName) {
        const ws = wb.Sheets[quotesSheetName];
        const jsonRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
        jsonRows.forEach((rowObj, idx) => {
          const parsed = parseCarrierQuoteRowObject(rowObj);
          const { quoteData, customLocA, customLocB } = parsed;
          const isGuideOrEmpty = !quoteData.carrier_name && !quoteData.service_type
            && !quoteData.region && !quoteData.bandwidth_unit
            && !isPopCode(quoteData.location_a_pop_code) && !isPopCode(quoteData.location_b_pop_code)
            && !hasCustomLocationData(customLocA) && !hasCustomLocationData(customLocB);
          if (parsed.fieldsPopulated > 0 && !isGuideOrEmpty) {
            parsedRows.push({
              rowKey: `row-${idx + 2}`,
              rowLabel: `Row ${idx + 2}`,
              ...parsed,
              resolvedLocA: null,
              resolvedLocB: null
            });
          }
        });
      } else {
        const quoteSheets = wb.SheetNames.filter(n => {
          const lower = String(n).toLowerCase();
          return lower !== 'instructions' && lower !== 'field guide';
        });
        quoteSheets.forEach((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const parsed = parseCarrierQuoteSheetVertical(ws);
          if (parsed.fieldsPopulated > 0) {
            parsedRows.push({
              rowKey: sheetName,
              rowLabel: sheetName,
              ...parsed,
              resolvedLocA: null,
              resolvedLocB: null
            });
          }
        });
      }

      if (parsedRows.length === 0) {
        setError('No quote data found. Use a sheet with a header row including Carrier Name (template sheet name: Quotes).');
        setUploading(false);
        setBulkProcessOpen(false);
        return;
      }

      setBulkProcessDetail(`Found ${parsedRows.length} quote row(s). Preparing address verification…`);

      const validRows = [];
      const reviewQueue = [];

      for (const row of parsedRows) {
        const { quoteData, customLocA, customLocB } = row;
        if (!quoteData.carrier_name) {
          validRows.push({ ...row, _preError: 'Carrier Name is required' });
          continue;
        }
        if (!quoteData.service_type || !quoteData.region || !quoteData.bandwidth_unit) {
          validRows.push({
            ...row,
            _preError: 'Service Type, Region, and Bandwidth Unit are required'
          });
          continue;
        }

        // Custom (non-POP) endpoints always go through Site Validation — building type can be set there
        if (!isPopCode(quoteData.location_a_pop_code) && hasCustomLocationData(customLocA)) {
          queueCustomSiteReview(row, 'a', customLocA, reviewQueue);
        }
        if (!isPopCode(quoteData.location_b_pop_code) && hasCustomLocationData(customLocB)) {
          queueCustomSiteReview(row, 'b', customLocB, reviewQueue);
        }

        validRows.push(row);
      }

      const preFailed = validRows.filter(r => r._preError);
      const toCreate = validRows.filter(r => !r._preError);

      if (preFailed.length && toCreate.length === 0 && reviewQueue.length === 0) {
        setCarrierQuoteResults({
          total: preFailed.length,
          created: 0,
          failed: preFailed.length,
          details: preFailed.map(r => ({ sheet: r.rowLabel, status: 'error', message: r._preError }))
        });
        setError(`All ${preFailed.length} quotes failed validation.`);
        setUploading(false);
        setBulkProcessOpen(false);
        return;
      }

      setPendingQuoteRows(toCreate);
      pendingQuoteRowsRef.current = toCreate;

      if (reviewQueue.length > 0) {
        setSuccess(`${toCreate.length} quote(s) ready. Verify ${reviewQueue.length} custom address(es) to finish import.`);
        if (preFailed.length) {
          setCarrierQuoteResults({
            total: preFailed.length,
            created: 0,
            failed: preFailed.length,
            details: preFailed.map(r => ({ sheet: r.rowLabel, status: 'error', message: r._preError }))
          });
        }
        setUploadFile(null);
        const fileInput = document.getElementById('bulk-upload-file');
        if (fileInput) fileInput.value = '';
        // Keep process dialog open; Site Validation opens on top
        advanceSiteReview(reviewQueue, 0);
        return;
      }

      setBulkProcessStage('Creating quotes');
      setBulkProcessDetail(`No custom addresses to verify. Saving ${toCreate.length} quote(s)…`);

      if (preFailed.length) {
        await commitCarrierQuoteRows(toCreate);
        setCarrierQuoteResults(prev => {
          const base = prev || { total: 0, created: 0, failed: 0, details: [] };
          return {
            total: base.total + preFailed.length,
            created: base.created,
            failed: base.failed + preFailed.length,
            details: [
              ...preFailed.map(r => ({ sheet: r.rowLabel, status: 'error', message: r._preError })),
              ...base.details
            ]
          };
        });
      } else {
        await commitCarrierQuoteRows(toCreate);
      }

      setUploadFile(null);
      const fileInput = document.getElementById('bulk-upload-file');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError('Failed to parse Excel file: ' + err.message);
      setBulkProcessOpen(false);
      setUploading(false);
    } finally {
      // Do not force-close process dialog here — address verification / create still in progress
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
                <Box sx={{ mb: 2, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
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

      <Dialog
        open={bulkProcessOpen}
        disableEscapeKeyDown
        maxWidth="sm"
        fullWidth
        sx={{ zIndex: 1400 }}
      >
        <DialogTitle>Processing bulk upload</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>{bulkProcessStage || 'Working…'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {bulkProcessDetail || 'Please wait…'}
          </Typography>
          <LinearProgress
            variant={siteReviewOpen && siteReviewQueue.length ? 'determinate' : 'indeterminate'}
            value={
              siteReviewQueue.length
                ? Math.round((siteReviewIndex / Math.max(siteReviewQueue.length, 1)) * 100)
                : 0
            }
          />
          {siteReviewOpen && siteReviewQueue.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
              Complete each Site Validation dialog ({siteReviewIndex + 1} of {siteReviewQueue.length}). Quotes are created only after all addresses are confirmed.
            </Typography>
          )}
        </DialogContent>
        {siteReviewOpen && (
          <DialogActions>
            <Button
              color="inherit"
              onClick={() => {
                setSiteReviewOpen(false);
                setBulkProcessOpen(false);
                setUploading(false);
                setError('Site validation cancelled. Quotes were not created.');
                setPendingQuoteRows([]);
                pendingQuoteRowsRef.current = [];
                setSiteReviewQueue([]);
                siteReviewQueueRef.current = [];
              }}
            >
              Cancel upload
            </Button>
          </DialogActions>
        )}
      </Dialog>

      <SiteValidationDialog
        key={`site-review-${siteReviewIndex}-${(siteReviewQueue[siteReviewIndex] && siteReviewQueue[siteReviewIndex].rowKey) || 'none'}-${(siteReviewQueue[siteReviewIndex] && siteReviewQueue[siteReviewIndex].side) || ''}`}
        open={siteReviewOpen}
        dialogSx={{ zIndex: 1500 }}
        onClose={() => {
          setSiteReviewOpen(false);
          setBulkProcessOpen(false);
          setUploading(false);
          setError('Site validation cancelled. Quotes were not created.');
          setPendingQuoteRows([]);
          pendingQuoteRowsRef.current = [];
          setSiteReviewQueue([]);
          siteReviewQueueRef.current = [];
        }}
        onConfirm={handleSiteReviewConfirm}
        initialValues={(siteReviewQueue[siteReviewIndex] && siteReviewQueue[siteReviewIndex].initialValues) || { building_type: 'retail' }}
        title={`Address ${siteReviewIndex + 1} of ${Math.max(siteReviewQueue.length, 1)} — verify ${(siteReviewQueue[siteReviewIndex] && siteReviewQueue[siteReviewIndex].rowLabel) || ''} Location ${(siteReviewQueue[siteReviewIndex] && siteReviewQueue[siteReviewIndex].side || '').toUpperCase()}`}
        confirmLabel={siteReviewIndex < siteReviewQueue.length - 1 ? 'Next address' : 'Confirm & create quotes'}
      />
    </Box>
  );
};

export default BulkUpload; 