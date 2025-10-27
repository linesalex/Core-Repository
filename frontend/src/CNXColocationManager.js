import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Chip, Alert, Snackbar, Collapse, IconButton, Dialog, DialogTitle, DialogContent, 
  DialogActions, TextField, Tooltip, Grid, Select, MenuItem, FormControl, InputLabel, FormHelperText
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InfoIcon from '@mui/icons-material/Info';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloseIcon from '@mui/icons-material/Close';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import LinkIcon from '@mui/icons-material/Link';
import { API_BASE_URL } from './config';
import axios from 'axios';
import LoadingIndicator from './components/LoadingIndicator';
import { ValidatedTextField, ValidatedSelect, createValidator, scrollToFirstError } from './components/FormValidation';
import RackElevationDialog from './components/RackElevationDialog';

const CNXColocationManager = ({ hasPermission }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [racksLoading, setRacksLoading] = useState({}); // Track loading state per location
  const [clientsLoading, setClientsLoading] = useState({}); // Track loading state per rack
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [expandedRacks, setExpandedRacks] = useState({});
  const [rackData, setRackData] = useState({});
  const [clientData, setClientData] = useState({});
  
  // Edit dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [moreInfoDialogOpen, setMoreInfoDialogOpen] = useState(false);
  const [designFile, setDesignFile] = useState(null);
  const [moreInfoText, setMoreInfoText] = useState('');
  const [currentMoreInfo, setCurrentMoreInfo] = useState('');
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [currentItem, setCurrentItem] = useState(null);
  
  // Rack dialog states
  const [rackDialogOpen, setRackDialogOpen] = useState(false);
  const [rackDialogMode, setRackDialogMode] = useState('add'); // 'add' or 'edit'
  const [selectedRack, setSelectedRack] = useState(null);
  const [rackFormData, setRackFormData] = useState({
    rack_id: '',
    rack_type: 'shared',
    total_ru: '42',
    ipc_reserved_ru_ranges: '',
    tor_network_infrastructure: 'No',
    exchange_facing_infrastructure: 'No',
    total_power_kva: '',
    network_infrastructure: '',
    more_info: '',
    // Dedicated rack fields
    client_name: '',
    space_power_ucn: '',
    design_sharepoint_link: ''
  });
  const [rackDesignFile, setRackDesignFile] = useState(null);
  
  // Rack Elevation Dialog
  const [elevationDialogOpen, setElevationDialogOpen] = useState(false);
  const [selectedRackForElevation, setSelectedRackForElevation] = useState(null);
  
  // Client dialog states
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [clientDialogMode, setClientDialogMode] = useState('add'); // 'add' or 'edit'
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientFormData, setClientFormData] = useState({
    client_name: '',
    power_purchased: '',
    ru_purchased: '',
    space_power_ucn: '',
    design_sharepoint_link: '',
    more_info: ''
  });

  // Validation states
  const [clientErrors, setClientErrors] = useState({});
  const [rackErrors, setRackErrors] = useState({});

  // Validation rules for Client form (dynamic based on rack type)
  const getClientValidationRules = (rackType) => {
    const baseRules = {
      client_name: { type: 'required', message: 'Client Name is required' },
      power_purchased: [
        { type: 'required', message: 'Power Purchased is required' },
        { type: 'number', message: 'Power Purchased must be a valid number' },
        { type: 'min', min: 0, message: 'Power Purchased must be greater than or equal to 0' }
      ],
      space_power_ucn: { type: 'required', message: 'Space & Power UCN is required' }
    };
    
    if (rackType === 'shared') {
      baseRules.ru_purchased = [
        { type: 'required', message: 'RU Purchased is required for shared racks' },
        { type: 'number', message: 'RU Purchased must be a valid number' },
        { type: 'min', min: 1, message: 'RU Purchased must be at least 1' }
      ];
    }
    
    return baseRules;
  };

  // Validation rules for Rack form (dynamic based on rack type)
  const getRackValidationRules = (rackType) => {
    const baseRules = {
      rack_id: { type: 'required', message: 'Rack ID is required' },
      total_ru: [
        { type: 'required', message: 'Total RU is required' },
        { type: 'number', message: 'Total RU must be a valid number' },
        { type: 'min', min: 1, message: 'Total RU must be at least 1' }
      ],
      total_power_kva: [
        { type: 'required', message: 'Total Power is required' },
        { type: 'number', message: 'Total Power must be a valid number' }
      ]
    };
    
    if (rackType === 'dedicated') {
      baseRules.client_name = { type: 'required', message: 'Client Name is required for dedicated racks' };
      baseRules.space_power_ucn = { type: 'required', message: 'Space & Power UCN is required for dedicated racks' };
    }
    
    return baseRules;
  };

  // Normalize text for duplicate checking
  const normalizeText = (text) => {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  };

  // Convert old INTEGER tor_network_infrastructure values to new TEXT values
  const convertTorNetworkValue = (value) => {
    console.log('🔧 convertTorNetworkValue - Input:', value, 'Type:', typeof value);
    if (value === null || value === undefined) {
      console.log('  → Converting to: No (null/undefined)');
      return 'No';
    }
    if (value === 0 || value === '0' || value === 'No') {
      console.log('  → Converting to: No');
      return 'No';
    }
    if (value === 1 || value === '1') {
      console.log('  → Converting to: Yes - Cisco 3548');
      return 'Yes - Cisco 3548'; // Default to Cisco for old "Yes" values
    }
    console.log('  → Keeping as-is:', value);
    return value; // Return as-is if already a text value
  };

  // Ensure exchange_facing_infrastructure has a valid value
  const ensureExchangeFacingValue = (value) => {
    console.log('🔧 ensureExchangeFacingValue - Input:', value, 'Type:', typeof value);
    if (!value || value === null || value === undefined) {
      console.log('  → Converting to: No');
      return 'No';
    }
    console.log('  → Keeping as-is:', value);
    return value;
  };

  // Load data on component mount
  useEffect(() => {
    loadCNXColocationLocations();
  }, []);

  const loadCNXColocationLocations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/cnx-colocation/locations`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setLocations(response.data);
    } catch (err) {
      setError('Failed to load CNX Colocation locations: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = async (locationId) => {
    const isExpanding = !expandedRows[locationId];
    
    setExpandedRows(prev => ({
      ...prev,
      [locationId]: isExpanding
    }));
    
    // Load racks when expanding
    if (isExpanding && !rackData[locationId]) {
      await loadRacks(locationId);
    }
  };

  const toggleRackExpanded = async (rackId) => {
    const isExpanding = !expandedRacks[rackId];
    
    setExpandedRacks(prev => ({
      ...prev,
      [rackId]: isExpanding
    }));
    
    // Load clients when expanding
    if (isExpanding && !clientData[rackId]) {
      await loadClients(rackId);
    }
  };

  const loadRacks = async (locationId) => {
    try {
      setRacksLoading(prev => ({ ...prev, [locationId]: true }));
      const response = await axios.get(`${API_BASE_URL}/cnx-colocation/locations/${locationId}/racks`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      setRackData(prev => ({
        ...prev,
        [locationId]: response.data
      }));
      
      // Auto-load clients for ALL dedicated racks (needed to show client info inline)
      const dedicatedRacks = response.data.filter(r => r.rack_type === 'dedicated');
      if (dedicatedRacks.length > 0) {
        // Load all dedicated rack clients in parallel
        await Promise.all(
          dedicatedRacks.map(async (rack) => {
            try {
              const clientResponse = await axios.get(`${API_BASE_URL}/cnx-colocation/racks/${rack.id}/clients`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
              });
              
              setClientData(prev => ({
                ...prev,
                [rack.id]: clientResponse.data
              }));
            } catch (clientErr) {
              console.error(`Failed to load clients for rack ${rack.id}:`, clientErr);
            }
          })
        );
      }
    } catch (err) {
      setError('Failed to load racks: ' + err.message);
    } finally {
      setRacksLoading(prev => ({ ...prev, [locationId]: false }));
    }
  };

  const loadClients = async (rackId) => {
    try {
      setClientsLoading(prev => ({ ...prev, [rackId]: true }));
      const response = await axios.get(`${API_BASE_URL}/cnx-colocation/racks/${rackId}/clients`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      setClientData(prev => ({
        ...prev,
        [rackId]: response.data
      }));
    } catch (err) {
      setError('Failed to load clients: ' + err.message);
    } finally {
      setClientsLoading(prev => ({ ...prev, [rackId]: false }));
    }
  };

  const handleEdit = (location) => {
    setSelectedLocation(location);
    setMoreInfoText(location.more_info || '');
    setDesignFile(null);
    setEditDialogOpen(true);
  };

  // Helper function to format date as "Jan 15 2025 2:30PM GMT"
  const formatTrackingDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    try {
      const date = new Date(dateString);
      const options = {
        month: 'short',
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      };
      return date.toLocaleString('en-US', options).replace(',', '') + ' GMT';
    } catch (err) {
      return 'Invalid date';
    }
  };

  const handleMoreInfoView = (item) => {
    setSelectedLocation(item);
    setCurrentMoreInfo(item.more_info || 'No additional information available.');
    setCurrentItem(item);
    setTrackingInfo({
      updated_by: item.updated_by,
      updated_date: item.updated_date,
      username: item.username,
      full_name: item.full_name
    });
    setMoreInfoDialogOpen(true);
  };

  const handleEditSave = async () => {
    try {
      const formData = new FormData();
      formData.append('more_info', moreInfoText);
      if (designFile) {
        formData.append('design_file', designFile);
      }

      await axios.put(
        `${API_BASE_URL}/cnx-colocation/locations/${selectedLocation.id}`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setSuccess('Location updated successfully');
      setEditDialogOpen(false);
      await loadCNXColocationLocations();
    } catch (err) {
      setError('Failed to update location: ' + err.message);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Design file must be a PDF');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('Design file must be smaller than 10MB');
        return;
      }
      setDesignFile(file);
    }
  };

  const getDesignFileIndicator = (location) => {
    if (location.design_file) {
      return (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleDownloadLocationDesign(location.id);
          }}
          color="success"
          size="small"
          startIcon={<CheckCircleIcon color="success" />}
        >
          <CloudDownloadIcon fontSize="small" />
        </Button>
      );
    } else {
      return (
        <Tooltip title="No design file">
          <CancelIcon color="error" />
        </Tooltip>
      );
    }
  };

  // Rack Management Functions
  const handleAddRack = (locationId) => {
    setSelectedLocation({ id: locationId });
    setRackDialogMode('add');
    setRackFormData({
      rack_id: '',
      rack_type: 'shared',
      total_ru: '42',
      ipc_reserved_ru_ranges: '',
      tor_network_infrastructure: 'No',
      exchange_facing_infrastructure: 'No',
      total_power_kva: '',
      network_infrastructure: '',
      more_info: '',
      client_name: '',
      space_power_ucn: '',
      design_sharepoint_link: ''
    });
    setRackDesignFile(null);
    setRackErrors({}); // Clear validation errors
    setRackDialogOpen(true);
  };

  const handleEditRack = (rack) => {
    console.log('📝 handleEditRack - Input rack data:', rack);
    setSelectedRack(rack);
    setRackDialogMode('edit');
    
    const formData = {
      rack_id: rack.rack_id,
      rack_type: rack.rack_type || 'shared',
      total_ru: rack.total_ru?.toString() || '42',
      ipc_reserved_ru_ranges: rack.ipc_reserved_ru_ranges || '',
      tor_network_infrastructure: convertTorNetworkValue(rack.tor_network_infrastructure),
      exchange_facing_infrastructure: ensureExchangeFacingValue(rack.exchange_facing_infrastructure),
      total_power_kva: rack.total_power_kva,
      network_infrastructure: rack.network_infrastructure || '',
      more_info: rack.more_info || '',
      client_name: '',
      space_power_ucn: '',
      design_sharepoint_link: ''
    };
    
    console.log('📝 handleEditRack - Setting form data:', formData);
    setRackFormData(formData);
    setRackDesignFile(null);
    setRackErrors({}); // Clear validation errors
    setRackDialogOpen(true);
  };

  const handleEditDedicatedRack = async (rack, client) => {
    // Load client data if not already loaded
    if (!client && !clientData[rack.id]) {
      await loadClients(rack.id);
      // Get the client after loading
      const loadedClient = clientData[rack.id] && clientData[rack.id].length > 0 ? clientData[rack.id][0] : null;
      client = loadedClient;
    }
    
    setSelectedRack(rack);
    setRackDialogMode('edit');
    setRackFormData({
      rack_id: rack.rack_id,
      rack_type: rack.rack_type || 'dedicated',
      total_ru: rack.total_ru?.toString() || '42',
      ipc_reserved_ru_ranges: rack.ipc_reserved_ru_ranges || '',
      tor_network_infrastructure: convertTorNetworkValue(rack.tor_network_infrastructure),
      exchange_facing_infrastructure: ensureExchangeFacingValue(rack.exchange_facing_infrastructure),
      total_power_kva: rack.total_power_kva,
      network_infrastructure: rack.network_infrastructure || '',
      more_info: rack.more_info || '',
      // Dedicated rack client fields
      client_name: client?.client_name || '',
      space_power_ucn: client?.space_power_ucn || '',
      design_sharepoint_link: client?.design_sharepoint_link || ''
    });
    setRackDesignFile(null);
    setRackErrors({}); // Clear validation errors
    setRackDialogOpen(true);
  };

  const handleRackSave = async () => {
    console.log('💾 handleRackSave - Starting save with data:', rackFormData);
    console.log('💾 Mode:', rackDialogMode);
    try {
      // Validate form using dynamic validation based on rack type
      const validationRules = getRackValidationRules(rackFormData.rack_type);
      const validateRackDynamic = createValidator(validationRules);
      const validationErrors = validateRackDynamic(rackFormData);
      setRackErrors(validationErrors);

      console.log('💾 Validation errors:', validationErrors);

      // Check if there are validation errors
      if (Object.keys(validationErrors).length > 0) {
        console.log('❌ Validation failed, stopping save');
        scrollToFirstError(validationErrors);
        return;
      }

      // Duplicate prevention - check for existing rack IDs within the same location
      const locationId = rackDialogMode === 'add' ? selectedLocation.id : selectedRack.location_id;
      const existingRacks = rackData[locationId] || [];
      const normalizedRackId = normalizeText(rackFormData.rack_id);
      
      if (rackDialogMode === 'add') {
        const existingRack = existingRacks.find(rack => 
          normalizeText(rack.rack_id) === normalizedRackId
        );
        
        if (existingRack) {
          setError(`A rack with ID "${rackFormData.rack_id}" already exists in this location. Please use a different rack ID.`);
          return;
        }
      } else {
        // For edit mode, check duplicates excluding current rack
        const existingRack = existingRacks.find(rack => 
          rack.id !== selectedRack.id && 
          normalizeText(rack.rack_id) === normalizedRackId
        );
        
        if (existingRack) {
          setError(`A rack with ID "${rackFormData.rack_id}" already exists in this location. Please use a different rack ID.`);
          return;
        }
      }

      const formData = new FormData();
      
      // Add all rack form fields
      console.log('💾 Building FormData from rackFormData:', rackFormData);
      Object.keys(rackFormData).forEach(key => {
        if (rackFormData[key] !== null && rackFormData[key] !== '') {
          console.log(`  → Appending ${key}:`, rackFormData[key]);
          formData.append(key, rackFormData[key]);
        } else {
          console.log(`  → Skipping ${key} (null or empty)`);
        }
      });
      
      // Add file uploads
      if (rackDesignFile) {
        console.log('💾 Adding rack design file:', rackDesignFile.name);
        formData.append('rack_design_file', rackDesignFile);
      }

      console.log('💾 FormData ready, sending to backend...');
      if (rackDialogMode === 'add') {
        console.log('💾 POST to:', `${API_BASE_URL}/cnx-colocation/locations/${selectedLocation.id}/racks`);
        const response = await axios.post(
          `${API_BASE_URL}/cnx-colocation/locations/${selectedLocation.id}/racks`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        console.log('✅ Rack created successfully, response:', response.data);
        setSuccess('Rack created successfully');
      } else {
        console.log('💾 PUT to:', `${API_BASE_URL}/cnx-colocation/racks/${selectedRack.id}`);
        const response = await axios.put(
          `${API_BASE_URL}/cnx-colocation/racks/${selectedRack.id}`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        console.log('✅ Rack updated successfully, response:', response.data);
        
        // For dedicated racks, also update the client
        if (rackFormData.rack_type === 'dedicated' && clientData[selectedRack.id] && clientData[selectedRack.id].length > 0) {
          const dedicatedClient = clientData[selectedRack.id][0];
          const clientUpdateData = new FormData();
          clientUpdateData.append('client_name', rackFormData.client_name);
          clientUpdateData.append('space_power_ucn', rackFormData.space_power_ucn);
          clientUpdateData.append('design_sharepoint_link', rackFormData.design_sharepoint_link || '');
          clientUpdateData.append('power_purchased', rackFormData.total_power_kva); // Same as rack power for dedicated
          
          // For dedicated racks, always allocate full RU range
          const totalRu = parseInt(rackFormData.total_ru) || 42;
          const ruRanges = JSON.stringify([{ start: 1, end: totalRu }]);
          clientUpdateData.append('ru_ranges', ruRanges);
          
          try {
            await axios.put(
              `${API_BASE_URL}/cnx-colocation/clients/${dedicatedClient.id}`,
              clientUpdateData,
              {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                  'Content-Type': 'multipart/form-data'
                }
              }
            );
          } catch (clientErr) {
            console.error('Failed to update dedicated client:', clientErr);
            setError('Rack updated but failed to update client info: ' + clientErr.message);
            return;
          }
        }
        
        setSuccess('Rack updated successfully');
      }

      setRackDialogOpen(false);
      setRackErrors({}); // Clear validation errors on success
      
      // Reload racks for the location
      await loadRacks(locationId);
    } catch (err) {
      setError('Failed to save rack: ' + err.message);
    }
  };

  const handleDeleteRack = async (rack) => {
    if (!window.confirm(`Are you sure you want to delete rack ${rack.rack_id}?`)) {
      return;
    }

    try {
              await axios.delete(`${API_BASE_URL}/cnx-colocation/racks/${rack.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setSuccess('Rack deleted successfully');
      await loadRacks(rack.location_id);
    } catch (err) {
      setError('Failed to delete rack: ' + err.message);
    }
  };

  // Client Management Functions
  const handleAddClient = (rackId) => {
    // Find the rack to determine its type
    const rack = rackData[Object.keys(rackData).find(locationId => 
      rackData[locationId]?.find(r => r.id === rackId)
    )]?.find(r => r.id === rackId);
    
    setSelectedRack(rack || { id: rackId });
    setClientDialogMode('add');
    setClientFormData({
      client_name: '',
      power_purchased: '',
      ru_purchased: '',
      space_power_ucn: '',
      design_sharepoint_link: '',
      more_info: ''
    });
    setClientErrors({}); // Clear validation errors
    setClientDialogOpen(true);
  };

  const handleEditClient = (client) => {
    // Find the rack to determine its type
    const rack = rackData[Object.keys(rackData).find(locationId => 
      rackData[locationId]?.find(r => r.id === client.rack_id)
    )]?.find(r => r.id === client.rack_id);
    
    setSelectedClient(client);
    setSelectedRack(rack);
    setClientDialogMode('edit');
    setClientFormData({
      client_name: client.client_name,
      power_purchased: client.power_purchased,
      ru_purchased: client.ru_purchased || '',
      space_power_ucn: client.space_power_ucn || '',
      design_sharepoint_link: client.design_sharepoint_link || '',
      more_info: client.more_info || ''
    });
    setClientErrors({}); // Clear validation errors
    setClientDialogOpen(true);
  };

  const handleClientSave = async () => {
    try {
      // Get rack type for dynamic validation
      const rackType = selectedRack?.rack_type || 'shared';
      
      // Validate form using dynamic validation based on rack type
      const validationRules = getClientValidationRules(rackType);
      const validateClientDynamic = createValidator(validationRules);
      const validationErrors = validateClientDynamic(clientFormData);
      setClientErrors(validationErrors);

      // Check if there are validation errors
      if (Object.keys(validationErrors).length > 0) {
        scrollToFirstError(validationErrors);
        return;
      }

      // Skip RU validation for now - will be handled by backend
      const rackId = clientDialogMode === 'add' ? selectedRack.id : selectedClient.rack_id;

      // Prepare JSON data (no file upload needed)
      const clientData = {};
      Object.keys(clientFormData).forEach(key => {
        if (clientFormData[key] !== null && clientFormData[key] !== '') {
          clientData[key] = clientFormData[key];
        }
      });

      if (clientDialogMode === 'add') {
        await axios.post(
          `${API_BASE_URL}/cnx-colocation/racks/${selectedRack.id}/clients`,
          clientData,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'application/json'
            }
          }
        );
        setSuccess('Client created successfully');
      } else {
        await axios.put(
          `${API_BASE_URL}/cnx-colocation/clients/${selectedClient.id}`,
          clientData,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'application/json'
            }
          }
        );
        setSuccess('Client updated successfully');
      }

      setClientDialogOpen(false);
      setClientErrors({}); // Clear validation errors on success
      
      // Reload clients for the rack and racks for the location
      await loadClients(rackId);
      
      // Also reload racks to update calculations
      const rack = rackData[Object.keys(rackData).find(locationId => 
        rackData[locationId]?.find(r => r.id === rackId)
      )]?.find(r => r.id === rackId);
      if (rack) {
        await loadRacks(rack.location_id);
      }
    } catch (err) {
      setError('Failed to save client: ' + err.message);
    }
  };

  const handleDeleteClient = async (client) => {
    if (!window.confirm(`Are you sure you want to delete client ${client.client_name}?`)) {
      return;
    }

    try {
              await axios.delete(`${API_BASE_URL}/cnx-colocation/clients/${client.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setSuccess('Client deleted successfully');
      await loadClients(client.rack_id);
      
      // Also reload racks to update calculations
      const rack = rackData[Object.keys(rackData).find(locationId => 
        rackData[locationId]?.find(r => r.id === client.rack_id)
      )]?.find(r => r.id === client.rack_id);
      if (rack) {
        await loadRacks(rack.location_id);
      }
    } catch (err) {
      setError('Failed to delete client: ' + err.message);
    }
  };

  const handleRackDesignFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Rack design file must be a PDF');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('Rack design file must be smaller than 10MB');
        return;
      }
      setRackDesignFile(file);
    }
  };

  const handleOpenRackElevation = (rack) => {
    setSelectedRackForElevation(rack.id);
    setElevationDialogOpen(true);
  };

  const handleCloseRackElevation = () => {
    setElevationDialogOpen(false);
    setSelectedRackForElevation(null);
  };

  const handleDeviceChange = async () => {
    // Reload racks to update device counts or other related data
    if (selectedRackForElevation) {
      const rack = rackData[Object.keys(rackData).find(locationId => 
        rackData[locationId]?.find(r => r.id === selectedRackForElevation)
      )]?.find(r => r.id === selectedRackForElevation);
      if (rack) {
        await loadRacks(rack.location_id);
      }
    }
  };

  // Download handlers
  const handleDownloadLocationDesign = async (locationId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/cnx-colocation/locations/${locationId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `location_design_${locationId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download design file: ' + err.message);
    }
  };


  // Delete file handlers
  const handleDeleteLocationDesign = async (locationId) => {
    if (!window.confirm('Are you sure you want to delete this design file?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/cnx-colocation/locations/${locationId}/design-file`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setSuccess('Design file deleted successfully');
      await loadCNXColocationLocations();
    } catch (err) {
      setError('Failed to delete design file: ' + err.message);
    }
  };

  const handleDeleteRackPricing = async (rackId) => {
    if (!window.confirm('Are you sure you want to delete this pricing file?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/cnx-colocation/racks/${rackId}/pricing-file`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setSuccess('Pricing file deleted successfully');
      // Reload the specific location's racks
      const rack = rackData[Object.keys(rackData).find(locationId => 
        rackData[locationId]?.find(r => r.id === rackId)
      )]?.find(r => r.id === rackId);
      if (rack) {
        await loadRacks(rack.location_id);
      }
    } catch (err) {
      setError('Failed to delete pricing file: ' + err.message);
    }
  };



  const getStatusChip = (status) => {
    const colors = {
      'Active': 'success',
      'Under Decommission': 'warning',
      'Under Construction': 'info'
    };
    return <Chip label={status} color={colors[status] || 'default'} size="small" />;
  };

  const getPOPTypeChip = (popType) => {
    const colors = {
      'Tier 1': 'error',
      'Tier 2': 'warning',
      'Tier 3': 'info',
      'Exchange': 'success'
    };
    return <Chip label={popType} color={colors[popType] || 'default'} size="small" />;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <Typography>Loading CNX Colocation locations...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} component="h2">
          CNX Colocation
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadCNXColocationLocations}
        >
          Refresh
        </Button>
      </Box>

      {/* Info Box */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
          Showing all locations where CNX Colocation is enabled in POP Capabilities. 
          Click on a POP Code to view rack details.
        </Typography>
      </Box>

      {/* Locations Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="50px"></TableCell>
              <TableCell><strong>POP Code</strong></TableCell>
              <TableCell><strong>City</strong></TableCell>
              <TableCell><strong>Country</strong></TableCell>
              <TableCell><strong>Address</strong></TableCell>
              <TableCell><strong>Provider</strong></TableCell>
              <TableCell><strong>POP Type</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>More Info</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
                    No locations with CNX Colocation enabled found.
                    <br />
                    Enable CNX Colocation in POP Capabilities for locations to appear here.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              locations.map((location) => (
                <React.Fragment key={location.id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        onClick={() => toggleExpanded(location.id)}
                        sx={{ 
                          transform: expandedRows[location.id] ? 'rotate(0deg)' : 'rotate(-90deg)',
                          transition: 'transform 0.2s'
                        }}
                      >
                        <ExpandMoreIcon />
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body1" fontWeight="bold" sx={{ fontSize: '0.875rem', cursor: 'pointer' }}>
                        {location.location_code}
                      </Typography>
                    </TableCell>
                    <TableCell>{location.city}</TableCell>
                    <TableCell>{location.country}</TableCell>
                    <TableCell>{location.datacenter_address || 'N/A'}</TableCell>
                    <TableCell>{location.provider || 'N/A'}</TableCell>
                    <TableCell>{getPOPTypeChip(location.pop_type)}</TableCell>
                    <TableCell>{getStatusChip(location.status)}</TableCell>
                    <TableCell align="center">
                      <IconButton 
                        size="small"
                        onClick={() => handleMoreInfoView(location)}
                        disabled={!location.more_info}
                      >
                        <InfoIcon color={location.more_info ? "primary" : "disabled"} />
                      </IconButton>
                    </TableCell>
                    <TableCell align="center">
                      {hasPermission && hasPermission('cnx_colocation', 'edit') ? (
                        <Tooltip title="Edit Design & More Info">
                          <IconButton 
                            size="small" 
                            onClick={() => handleEdit(location)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                  
                  {/* Expandable Section for Racks */}
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
                      <Collapse in={expandedRows[location.id]} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} gutterBottom component="div">
                              Racks for {location.location_code}
                            </Typography>
                            {hasPermission && hasPermission('cnx_colocation', 'create') && (
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleAddRack(location.id)}
                                startIcon={<AddIcon />}
                              >
                                Add Rack
                              </Button>
                            )}
                          </Box>
                          
                          {racksLoading[location.id] ? (
                            <LoadingIndicator message="Loading racks..." size={16} />
                          ) : rackData[location.id] && rackData[location.id].length > 0 ? (
                            <>
                              {/* Shared Racks Section */}
                              {rackData[location.id].filter(r => r.rack_type === 'shared').length > 0 && (
                                <Box sx={{ mb: 3 }}>
                                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: 'primary.main' }}>
                                    Shared Racks
                                  </Typography>
                                  <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell width="30px"></TableCell>
                                  <TableCell><strong>Rack ID</strong></TableCell>
                                  <TableCell><strong>Total Power (kW)</strong></TableCell>
                                  <TableCell><strong>Allocated Power (kW)</strong></TableCell>
                                  <TableCell><strong>Clients</strong></TableCell>
                                  <TableCell><strong>RU Allocated</strong></TableCell>
                                  <TableCell><strong>TOR Network</strong></TableCell>
                                  <TableCell><strong>More Info</strong></TableCell>
                                  <TableCell align="center"><strong>Actions</strong></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {rackData[location.id].filter(r => r.rack_type === 'shared').map((rack) => (
                                  <React.Fragment key={rack.id}>
                                    <TableRow hover>
                                      <TableCell>
                                        <IconButton 
                                          size="small" 
                                          onClick={() => toggleRackExpanded(rack.id)}
                                          sx={{ 
                                            transform: expandedRacks[rack.id] ? 'rotate(0deg)' : 'rotate(-90deg)',
                                            transition: 'transform 0.2s'
                                          }}
                                        >
                                          <ExpandMoreIcon />
                                        </IconButton>
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold">
                                          {rack.rack_id}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>{rack.total_power_kva}</TableCell>
                                      <TableCell>{rack.allocated_power}</TableCell>
                                      <TableCell>{rack.client_count}</TableCell>
                                      <TableCell>{rack.ru_allocated}/{rack.total_ru || 42}</TableCell>
                                      <TableCell>{rack.tor_network_infrastructure ? 'Yes' : 'No'}</TableCell>
                                      <TableCell align="center">
                                        <IconButton 
                                          size="small"
                                          onClick={() => handleMoreInfoView({ 
                                            more_info: rack.more_info, 
                                            location_code: `Rack ${rack.rack_id}`,
                                            updated_by: rack.updated_by,
                                            updated_date: rack.updated_date,
                                            username: rack.username,
                                            full_name: rack.full_name
                                          })}
                                        >
                                          <InfoIcon color="primary" />
                                        </IconButton>
                                      </TableCell>
                                      <TableCell align="center">
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                          <Tooltip title="View Rack Elevation">
                                            <IconButton size="small" onClick={() => handleOpenRackElevation(rack)} color="info">
                                              <ViewModuleIcon />
                                            </IconButton>
                                          </Tooltip>
                                          {hasPermission && hasPermission('cnx_colocation', 'edit') && (
                                            <Tooltip title="Edit Rack">
                                              <IconButton size="small" onClick={() => handleEditRack(rack)}>
                                                <EditIcon />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                          {hasPermission && hasPermission('cnx_colocation', 'delete') && (
                                            <Tooltip title="Delete Rack">
                                              <IconButton size="small" onClick={() => handleDeleteRack(rack)} color="error">
                                                <DeleteIcon />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                    
                                    {/* Expandable Section for Clients */}
                                    <TableRow>
                                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
                                        <Collapse in={expandedRacks[rack.id]} timeout="auto" unmountOnExit>
                                          <Box sx={{ margin: 1 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                              <Typography variant="subtitle2" gutterBottom component="div">
                                                Clients for Rack {rack.rack_id}
                                              </Typography>
                                              {hasPermission && hasPermission('cnx_colocation', 'create') && (
                                                <Button
                                                  variant="outlined"
                                                  size="small"
                                                  onClick={() => handleAddClient(rack.id)}
                                                  startIcon={<AddIcon />}
                                                >
                                                  Add Client
                                                </Button>
                                              )}
                                            </Box>
                                            
                                            {clientData[rack.id] && clientData[rack.id].length > 0 ? (
                                              <Table size="small">
                                                <TableHead>
                                                  <TableRow>
                                                    <TableCell><strong>Client Name</strong></TableCell>
                                                    <TableCell><strong>Power Purchased (kVA)</strong></TableCell>
                                                    <TableCell><strong>RU Purchased</strong></TableCell>
                                                    <TableCell><strong>Space & Power UCN</strong></TableCell>
                                                    <TableCell><strong>Design Link</strong></TableCell>
                                                    <TableCell><strong>More Info</strong></TableCell>
                                                    <TableCell align="center"><strong>Actions</strong></TableCell>
                                                  </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                  {clientData[rack.id].map((client) => (
                                                    <TableRow key={client.id} hover>
                                                      <TableCell>{client.client_name}</TableCell>
                                                      <TableCell>{client.power_purchased}</TableCell>
                                                      <TableCell>{client.ru_purchased}</TableCell>
                                                      <TableCell>{client.space_power_ucn}</TableCell>
                                                      <TableCell align="center">
                                                        {client.design_sharepoint_link ? (
                                                          <Tooltip title="Open SharePoint Design">
                                                            <IconButton
                                                              size="small"
                                                              color="primary"
                                                              component="a"
                                                              href={client.design_sharepoint_link.startsWith('http://') || client.design_sharepoint_link.startsWith('https://') 
                                                                ? client.design_sharepoint_link 
                                                                : `https://${client.design_sharepoint_link}`}
                                                              target="_blank"
                                                              rel="noopener noreferrer"
                                                              onClick={(e) => e.stopPropagation()}
                                                            >
                                                              <LinkIcon />
                                                            </IconButton>
                                                          </Tooltip>
                                                        ) : (
                                                          <Tooltip title="No design link">
                                                            <CancelIcon color="disabled" fontSize="small" />
                                                          </Tooltip>
                                                        )}
                                                      </TableCell>
                                                      <TableCell align="center">
                                                        <IconButton 
                                                          size="small"
                                                          onClick={() => handleMoreInfoView({ 
                                                            more_info: client.more_info, 
                                                            location_code: `Client ${client.client_name}`,
                                                            updated_by: client.updated_by,
                                                            updated_date: client.updated_date,
                                                            username: client.username,
                                                            full_name: client.full_name
                                                          })}
                                                        >
                                                          <InfoIcon color="primary" />
                                                        </IconButton>
                                                      </TableCell>
                                                      <TableCell align="center">
                                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                          {hasPermission && hasPermission('cnx_colocation', 'edit') && (
                                                            <Tooltip title="Edit Client">
                                                              <IconButton size="small" onClick={() => handleEditClient(client)}>
                                                                <EditIcon />
                                                              </IconButton>
                                                            </Tooltip>
                                                          )}
                                                          {hasPermission && hasPermission('cnx_colocation', 'delete') && (
                                                            <Tooltip title="Delete Client">
                                                              <IconButton size="small" onClick={() => handleDeleteClient(client)} color="error">
                                                                <DeleteIcon />
                                                              </IconButton>
                                                            </Tooltip>
                                                          )}
                                                        </Box>
                                                      </TableCell>
                                                    </TableRow>
                                                  ))}
                                                </TableBody>
                                              </Table>
                                            ) : clientsLoading[rack.id] ? (
                                              <LoadingIndicator message="Loading clients..." size={16} sx={{ p: 1 }} />
                                            ) : (
                                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', p: 2 }}>
                                                No clients found for this rack.
                                              </Typography>
                                            )}
                                          </Box>
                                        </Collapse>
                                      </TableCell>
                                    </TableRow>
                                  </React.Fragment>
                                ))}
                              </TableBody>
                            </Table>
                                </Box>
                              )}
                              
                              {/* Dedicated Racks Section */}
                              {rackData[location.id].filter(r => r.rack_type === 'dedicated').length > 0 && (
                                <Box sx={{ mb: 3 }}>
                                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: 'secondary.main' }}>
                                    Dedicated Racks
                                  </Typography>
                                  <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell><strong>Rack ID</strong></TableCell>
                                  <TableCell><strong>Total Power (kW)</strong></TableCell>
                                  <TableCell><strong>Client Name</strong></TableCell>
                                  <TableCell><strong>Space & Power UCN</strong></TableCell>
                                  <TableCell><strong>RU Allocated</strong></TableCell>
                                  <TableCell><strong>More Info</strong></TableCell>
                                  <TableCell align="center"><strong>Actions</strong></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {rackData[location.id].filter(r => r.rack_type === 'dedicated').map((rack) => {
                                  // Get the client for this dedicated rack
                                  const dedicatedClient = clientData[rack.id] && clientData[rack.id].length > 0 ? clientData[rack.id][0] : null;
                                  const isLoadingClient = !clientData[rack.id] && clientsLoading[rack.id];
                                  
                                  return (
                                    <TableRow key={rack.id} hover>
                                      <TableCell>
                                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }} fontWeight="bold">
                                          {rack.rack_id}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>{rack.total_power_kva}</TableCell>
                                      <TableCell>
                                        {isLoadingClient ? (
                                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                                            Loading...
                                          </Typography>
                                        ) : (
                                          dedicatedClient?.client_name || '-'
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {isLoadingClient ? (
                                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                                            Loading...
                                          </Typography>
                                        ) : (
                                          dedicatedClient?.space_power_ucn || '-'
                                        )}
                                      </TableCell>
                                      <TableCell>{rack.total_ru || 42}</TableCell>
                                      <TableCell align="center">
                                        <IconButton 
                                          size="small"
                                          onClick={() => handleMoreInfoView({ 
                                            more_info: rack.more_info, 
                                            location_code: `Rack ${rack.rack_id}`,
                                            updated_by: rack.updated_by,
                                            updated_date: rack.updated_date,
                                            username: rack.username,
                                            full_name: rack.full_name
                                          })}
                                          disabled={!rack.more_info}
                                        >
                                          <InfoIcon color={rack.more_info ? "primary" : "disabled"} />
                                        </IconButton>
                                      </TableCell>
                                      <TableCell align="center">
                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                          <Tooltip title="View Rack Elevation">
                                            <IconButton size="small" onClick={() => handleOpenRackElevation(rack)} color="info">
                                              <ViewModuleIcon />
                                            </IconButton>
                                          </Tooltip>
                                          {hasPermission && hasPermission('cnx_colocation', 'edit') && (
                                            <Tooltip title="Edit Rack & Client">
                                              <IconButton size="small" onClick={() => handleEditDedicatedRack(rack, dedicatedClient)}>
                                                <EditIcon />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                          {hasPermission && hasPermission('cnx_colocation', 'delete') && (
                                            <Tooltip title="Delete Rack">
                                              <IconButton size="small" onClick={() => handleDeleteRack(rack)} color="error">
                                                <DeleteIcon />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                                </Box>
                              )}
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', p: 2 }}>
                              No racks found for this location.
                            </Typography>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Edit {selectedLocation?.location_code} - Design & More Info
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* More Info Field */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                More Info
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={8}
                value={moreInfoText}
                onChange={(e) => setMoreInfoText(e.target.value)}
                placeholder="Enter additional information about this location..."
                variant="outlined"
                sx={{ 
                  '& .MuiInputBase-root': {
                    fontSize: '0.9rem',
                    lineHeight: 1.4
                  }
                }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* More Info View Dialog */}
      <Dialog open={moreInfoDialogOpen} onClose={() => {
        setMoreInfoDialogOpen(false);
        setTrackingInfo(null);
        setCurrentItem(null);
      }} maxWidth="md" fullWidth>
        <DialogTitle>
          More Info - {selectedLocation?.location_code}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ 
            mt: 2, 
            p: 2, 
            backgroundColor: 'grey.50', 
            borderRadius: 1,
            maxHeight: 400,
            overflowY: 'auto'
          }}>
            <Typography 
              variant="body1" sx={{ fontSize: '0.875rem' }} 
              sx={{ 
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                fontSize: '0.9rem',
                lineHeight: 1.6
              }}
            >
              {currentMoreInfo}
            </Typography>
          </Box>
          
          {/* Tracking Information */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
            <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
              {trackingInfo && trackingInfo.updated_date ? (
                <>Last Updated: {trackingInfo.username || 'Unknown User'} {formatTrackingDate(trackingInfo.updated_date)}</>
              ) : (
                'Last Updated: Not available'
              )}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setMoreInfoDialogOpen(false);
            setTrackingInfo(null);
            setCurrentItem(null);
          }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Rack Dialog */}
      <Dialog open={rackDialogOpen} onClose={() => setRackDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {rackDialogMode === 'add' ? 'Add New Rack' : `Edit Rack ${selectedRack?.rack_id}`}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Rack Type Selector (only for add mode) */}
            {rackDialogMode === 'add' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Rack Type *</InputLabel>
                  <Select
                    value={rackFormData.rack_type}
                    label="Rack Type *"
                    onChange={(e) => setRackFormData(prev => ({...prev, rack_type: e.target.value}))}
                  >
                    <MenuItem value="shared">Shared</MenuItem>
                    <MenuItem value="dedicated">Dedicated</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            {/* Common Fields */}
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                fullWidth
                label="Rack ID *"
                value={rackFormData.rack_id}
                onChange={(e) => setRackFormData(prev => ({...prev, rack_id: e.target.value}))}
                required
                field="rack_id"
                errors={rackErrors}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                fullWidth
                label="Total RU *"
                type="number"
                value={rackFormData.total_ru}
                onChange={(e) => setRackFormData(prev => ({...prev, total_ru: e.target.value}))}
                required
                field="total_ru"
                errors={rackErrors}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                fullWidth
                label="Total Power (kW) *"
                type="number"
                step="0.1"
                value={rackFormData.total_power_kva}
                onChange={(e) => setRackFormData(prev => ({...prev, total_power_kva: e.target.value}))}
                required
                field="total_power_kva"
                errors={rackErrors}
              />
            </Grid>
            
            {/* Shared Rack Fields */}
            {rackFormData.rack_type === 'shared' && (
              <>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>TOR Network Infrastructure *</InputLabel>
                    <Select
                      value={rackFormData.tor_network_infrastructure}
                      label="TOR Network Infrastructure *"
                      onChange={(e) => setRackFormData(prev => ({...prev, tor_network_infrastructure: e.target.value}))}
                    >
                      <MenuItem value="No">No</MenuItem>
                      <MenuItem value="Yes - Cisco 3548">Yes - Cisco 3548</MenuItem>
                      <MenuItem value="Yes - Extranet">Yes - Extranet</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Exchange Facing Infrastructure *</InputLabel>
                    <Select
                      value={rackFormData.exchange_facing_infrastructure}
                      label="Exchange Facing Infrastructure *"
                      onChange={(e) => setRackFormData(prev => ({...prev, exchange_facing_infrastructure: e.target.value}))}
                    >
                      <MenuItem value="No">No</MenuItem>
                      <MenuItem value="Yes - Cisco 3548">Yes - Cisco 3548</MenuItem>
                      <MenuItem value="Yes - Arista 7130">Yes - Arista 7130</MenuItem>
                      <MenuItem value="Yes - Extranet">Yes - Extranet</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Rack Design File (PDF)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<CloudUploadIcon />}
                    >
                      Upload PDF
                      <input
                        type="file"
                        hidden
                        accept=".pdf"
                        onChange={handleRackDesignFileChange}
                      />
                    </Button>
                    {rackDesignFile && (
                      <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="success.main">
                        Selected: {rackDesignFile.name}
                      </Typography>
                    )}
                  </Box>
                </Grid>
              </>
            )}
            
            {/* Dedicated Rack Fields */}
            {rackFormData.rack_type === 'dedicated' && (
              <>
                <Grid item xs={12}>
                  <ValidatedTextField
                    fullWidth
                    label="Client Name *"
                    value={rackFormData.client_name}
                    onChange={(e) => setRackFormData(prev => ({...prev, client_name: e.target.value}))}
                    required
                    field="client_name"
                    errors={rackErrors}
                  />
                </Grid>
                <Grid item xs={12}>
                  <ValidatedTextField
                    fullWidth
                    label="Space & Power UCN *"
                    value={rackFormData.space_power_ucn}
                    onChange={(e) => setRackFormData(prev => ({...prev, space_power_ucn: e.target.value}))}
                    required
                    field="space_power_ucn"
                    errors={rackErrors}
                  />
                </Grid>
                <Grid item xs={12}>
                  <ValidatedTextField
                    fullWidth
                    label="SharePoint Link for Design"
                    value={rackFormData.design_sharepoint_link}
                    onChange={(e) => setRackFormData(prev => ({...prev, design_sharepoint_link: e.target.value}))}
                    field="design_sharepoint_link"
                    errors={rackErrors}
                  />
                </Grid>
              </>
            )}
            
            <Grid item xs={12}>
              <ValidatedTextField
                fullWidth
                label="More Info"
                multiline
                rows={4}
                value={rackFormData.more_info}
                onChange={(e) => setRackFormData(prev => ({...prev, more_info: e.target.value}))}
                placeholder="Enter additional information about this rack..."
                field="more_info"
                errors={rackErrors}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRackDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRackSave} variant="contained">
            {rackDialogMode === 'add' ? 'Add Rack' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Client Dialog */}
      <Dialog open={clientDialogOpen} onClose={() => setClientDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {clientDialogMode === 'add' ? 'Add New Client' : `Edit Client ${selectedClient?.client_name}`}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <ValidatedTextField
                fullWidth
                label="Client Name *"
                value={clientFormData.client_name}
                onChange={(e) => setClientFormData(prev => ({...prev, client_name: e.target.value}))}
                required
                field="client_name"
                errors={clientErrors}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                fullWidth
                label="Power Purchased (kW) *"
                type="number"
                step="0.1"
                value={clientFormData.power_purchased}
                onChange={(e) => setClientFormData(prev => ({...prev, power_purchased: e.target.value}))}
                required
                field="power_purchased"
                errors={clientErrors}
              />
            </Grid>
            
            {/* RU Purchased for Shared racks */}
            {selectedRack?.rack_type === 'shared' && (
              <Grid item xs={12} sm={6}>
                <ValidatedTextField
                  fullWidth
                  label="RU Purchased *"
                  type="number"
                  value={clientFormData.ru_purchased}
                  onChange={(e) => setClientFormData(prev => ({...prev, ru_purchased: e.target.value}))}
                  required
                  field="ru_purchased"
                  errors={clientErrors}
                />
              </Grid>
            )}
            
            {/* Space & Power UCN - Required for all clients */}
            <Grid item xs={12}>
              <ValidatedTextField
                fullWidth
                label="Space & Power UCN *"
                value={clientFormData.space_power_ucn}
                onChange={(e) => setClientFormData(prev => ({...prev, space_power_ucn: e.target.value}))}
                required
                field="space_power_ucn"
                errors={clientErrors}
              />
            </Grid>
            
            {/* SharePoint Link for Design */}
            <Grid item xs={12}>
              <ValidatedTextField
                fullWidth
                label="SharePoint Link for Design"
                value={clientFormData.design_sharepoint_link}
                onChange={(e) => setClientFormData(prev => ({...prev, design_sharepoint_link: e.target.value}))}
                field="design_sharepoint_link"
                errors={clientErrors}
              />
            </Grid>
            
            <Grid item xs={12}>
              <ValidatedTextField
                fullWidth
                label="More Info"
                multiline
                rows={4}
                value={clientFormData.more_info}
                onChange={(e) => setClientFormData(prev => ({...prev, more_info: e.target.value}))}
                placeholder="Enter additional information about this client..."
                field="more_info"
                errors={clientErrors}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClientDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleClientSave} variant="contained">
            {clientDialogMode === 'add' ? 'Add Client' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rack Elevation Dialog */}
      <RackElevationDialog
        open={elevationDialogOpen}
        onClose={handleCloseRackElevation}
        rackId={selectedRackForElevation}
        onDeviceChange={handleDeviceChange}
      />

      {/* Success/Error Messages */}
      <Snackbar 
        open={!!success} 
        autoHideDuration={6000} 
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>
      
      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CNXColocationManager; 