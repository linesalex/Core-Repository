import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Chip, Alert, Snackbar, Collapse, IconButton, Dialog, DialogTitle, DialogContent, 
  DialogActions, TextField, Tooltip, Grid
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
import { API_BASE_URL } from './config';
import axios from 'axios';
import LoadingIndicator from './components/LoadingIndicator';
import { ValidatedTextField, ValidatedSelect, createValidator, scrollToFirstError } from './components/FormValidation';

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
  
  // Rack dialog states
  const [rackDialogOpen, setRackDialogOpen] = useState(false);
  const [rackDialogMode, setRackDialogMode] = useState('add'); // 'add' or 'edit'
  const [selectedRack, setSelectedRack] = useState(null);
  const [rackFormData, setRackFormData] = useState({
    rack_id: '',
    total_power_kva: '',
    network_infrastructure: '',
    more_info: ''
  });
  const [pricingInfoFile, setPricingInfoFile] = useState(null);
  
  // Client dialog states
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [clientDialogMode, setClientDialogMode] = useState('add'); // 'add' or 'edit'
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientFormData, setClientFormData] = useState({
    client_name: '',
    power_purchased: '',
    ru_purchased: '',
    more_info: ''
  });
  const [clientDesignFile, setClientDesignFile] = useState(null);

  // Validation states
  const [clientErrors, setClientErrors] = useState({});
  const [rackErrors, setRackErrors] = useState({});

  // Validation rules for Client form
  const clientValidationRules = {
    client_name: { type: 'required', message: 'Client Name is required' },
    power_purchased: [
      { type: 'required', message: 'Power Purchased is required' },
      { type: 'number', message: 'Power Purchased must be a valid number' },
      { type: 'min', min: 0, message: 'Power Purchased must be greater than or equal to 0' }
    ],
    ru_purchased: [
      { type: 'required', message: 'RU Purchased is required' },
      { type: 'number', message: 'RU Purchased must be a valid number' },
      { type: 'min', min: 1, message: 'RU Purchased must be at least 1' },
      { type: 'max', max: 30, message: 'RU Purchased cannot exceed 30' }
    ]
  };

  // Validation rules for Rack form
  const rackValidationRules = {
    rack_id: { type: 'required', message: 'Rack ID is required' },
    total_power_kva: [
      { type: 'required', message: 'Total Power is required' },
      { type: 'number', message: 'Total Power must be a valid number' }
    ],
    network_infrastructure: { type: 'required', message: 'Network Infrastructure is required' }
  };

  // Validation functions
  const validateClient = createValidator(clientValidationRules);
  const validateRack = createValidator(rackValidationRules);

  // Normalize text for duplicate checking
  const normalizeText = (text) => {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
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

  const handleMoreInfoView = (item) => {
    setSelectedLocation(item);
    setCurrentMoreInfo(item.more_info || 'No additional information available.');
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
      total_power_kva: '',
      network_infrastructure: '',
      more_info: ''
    });
    setPricingInfoFile(null);
    setRackErrors({}); // Clear validation errors
    setRackDialogOpen(true);
  };

  const handleEditRack = (rack) => {
    setSelectedRack(rack);
    setRackDialogMode('edit');
    setRackFormData({
      rack_id: rack.rack_id,
      total_power_kva: rack.total_power_kva,
      network_infrastructure: rack.network_infrastructure,
      more_info: rack.more_info || ''
    });
    setPricingInfoFile(null);
    setRackErrors({}); // Clear validation errors
    setRackDialogOpen(true);
  };

  const handleRackSave = async () => {
    try {
      // Validate form using validation framework
      const validationErrors = validateRack(rackFormData);
      setRackErrors(validationErrors);

      // Check if there are validation errors
      if (Object.keys(validationErrors).length > 0) {
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
      Object.keys(rackFormData).forEach(key => {
        formData.append(key, rackFormData[key]);
      });
      if (pricingInfoFile) {
        formData.append('pricing_info_file', pricingInfoFile);
      }

      if (rackDialogMode === 'add') {
        await axios.post(
          `${API_BASE_URL}/cnx-colocation/locations/${selectedLocation.id}/racks`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        setSuccess('Rack created successfully');
      } else {
        await axios.put(
          `${API_BASE_URL}/cnx-colocation/racks/${selectedRack.id}`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
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
    setSelectedRack({ id: rackId });
    setClientDialogMode('add');
    setClientFormData({
      client_name: '',
      power_purchased: '',
      ru_purchased: '',
      more_info: ''
    });
    setClientDesignFile(null);
    setClientErrors({}); // Clear validation errors
    setClientDialogOpen(true);
  };

  const handleEditClient = (client) => {
    setSelectedClient(client);
    setClientDialogMode('edit');
    setClientFormData({
      client_name: client.client_name,
      power_purchased: client.power_purchased,
      ru_purchased: client.ru_purchased,
      more_info: client.more_info || ''
    });
    setClientDesignFile(null);
    setClientErrors({}); // Clear validation errors
    setClientDialogOpen(true);
  };

  const handleClientSave = async () => {
    try {
      // Validate form using validation framework
      const validationErrors = validateClient(clientFormData);
      setClientErrors(validationErrors);

      // Check if there are validation errors
      if (Object.keys(validationErrors).length > 0) {
        scrollToFirstError(validationErrors);
        return;
      }

      // RU validation - ensure total doesn't exceed 30
      const ruPurchased = parseInt(clientFormData.ru_purchased);
      const rackId = clientDialogMode === 'add' ? selectedRack.id : selectedClient.rack_id;
      const existingClients = clientData[rackId] || [];
      
      // Calculate current RU allocation
      const currentRU = existingClients.reduce((total, client) => {
        // Exclude current client in edit mode
        if (clientDialogMode === 'edit' && client.id === selectedClient.id) return total;
        return total + parseInt(client.ru_purchased || 0);
      }, 0);
      
      if (currentRU + ruPurchased > 30) {
        setError(`Cannot ${clientDialogMode === 'add' ? 'add' : 'update'} client: Total RU would exceed 30 (currently ${currentRU}/30 allocated, trying to ${clientDialogMode === 'add' ? 'add' : 'change to'} ${ruPurchased} RU)`);
        return;
      }

      // Duplicate prevention - check for existing client names within the same rack
      const normalizedClientName = normalizeText(clientFormData.client_name);
      
      if (clientDialogMode === 'add') {
        const existingClient = existingClients.find(client => 
          normalizeText(client.client_name) === normalizedClientName
        );
        
        if (existingClient) {
          setError(`A client with the name "${clientFormData.client_name}" already exists in this rack. Please use a different client name.`);
          return;
        }
      } else {
        // For edit mode, check duplicates excluding current client
        const existingClient = existingClients.find(client => 
          client.id !== selectedClient.id && 
          normalizeText(client.client_name) === normalizedClientName
        );
        
        if (existingClient) {
          setError(`A client with the name "${clientFormData.client_name}" already exists in this rack. Please use a different client name.`);
          return;
        }
      }

      const formData = new FormData();
      Object.keys(clientFormData).forEach(key => {
        formData.append(key, clientFormData[key]);
      });
      if (clientDesignFile) {
        formData.append('client_design_file', clientDesignFile);
      }

      if (clientDialogMode === 'add') {
        await axios.post(
          `${API_BASE_URL}/cnx-colocation/racks/${selectedRack.id}/clients`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        setSuccess('Client created successfully');
      } else {
        await axios.put(
          `${API_BASE_URL}/cnx-colocation/clients/${selectedClient.id}`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'multipart/form-data'
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

  const handlePricingFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        setError('Pricing info file must be an Excel file (.xlsx)');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('Pricing info file must be smaller than 10MB');
        return;
      }
      setPricingInfoFile(file);
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

  const handleDownloadRackPricing = async (rackId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/cnx-colocation/racks/${rackId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rack_pricing_${rackId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download pricing file: ' + err.message);
    }
  };

  const handleDownloadClientDesign = async (clientId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/cnx-colocation/clients/${clientId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `client_design_${clientId}.pdf`);
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

  const handleDeleteClientDesign = async (clientId) => {
    if (!window.confirm('Are you sure you want to delete this design file?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/cnx-colocation/clients/${clientId}/design-file`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setSuccess('Design file deleted successfully');
      // Reload the specific rack's clients
      const client = clientData[Object.keys(clientData).find(rackId => 
        clientData[rackId]?.find(c => c.id === clientId)
      )]?.find(c => c.id === clientId);
      if (client) {
        await loadClients(client.rack_id);
      }
    } catch (err) {
      setError('Failed to delete design file: ' + err.message);
    }
  };

  const handleClientDesignFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Client design file must be a PDF');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('Client design file must be smaller than 10MB');
        return;
      }
      setClientDesignFile(file);
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
        <Typography variant="h6" component="h2">
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
        <Typography variant="body2" color="text.secondary">
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
              <TableCell><strong>Design</strong></TableCell>
              <TableCell><strong>More Info</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  <Typography variant="body2" color="text.secondary">
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
                      <Typography variant="body1" fontWeight="bold" sx={{ cursor: 'pointer' }}>
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
                      {getDesignFileIndicator(location)}
                    </TableCell>
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
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                  
                  {/* Expandable Section for Racks */}
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={11}>
                      <Collapse in={expandedRows[location.id]} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" gutterBottom component="div">
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
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell width="30px"></TableCell>
                                  <TableCell><strong>Rack ID</strong></TableCell>
                                  <TableCell><strong>Total Power (kVA)</strong></TableCell>
                                  <TableCell><strong>Allocated Power (kVA)</strong></TableCell>
                                  <TableCell><strong>Clients</strong></TableCell>
                                  <TableCell><strong>RU Allocated</strong></TableCell>
                                  <TableCell><strong>Network Infrastructure</strong></TableCell>
                                  <TableCell><strong>Pricing Info</strong></TableCell>
                                  <TableCell><strong>More Info</strong></TableCell>
                                  <TableCell align="center"><strong>Actions</strong></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {rackData[location.id].map((rack) => (
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
                                        <Typography variant="body2" fontWeight="bold">
                                          {rack.rack_id}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>{rack.total_power_kva}</TableCell>
                                      <TableCell>{rack.allocated_power}</TableCell>
                                      <TableCell>{rack.client_count}</TableCell>
                                      <TableCell>{rack.ru_allocated}/30</TableCell>
                                      <TableCell>{rack.network_infrastructure}</TableCell>
                                      <TableCell align="center">
                                        {rack.pricing_info_file ? (
                                          <Button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDownloadRackPricing(rack.id);
                                            }}
                                            color="success"
                                            size="small"
                                            startIcon={<CheckCircleIcon color="success" />}
                                          >
                                            <CloudDownloadIcon fontSize="small" />
                                          </Button>
                                        ) : (
                                          <Tooltip title="No pricing file">
                                            <CancelIcon color="error" />
                                          </Tooltip>
                                        )}
                                      </TableCell>
                                      <TableCell align="center">
                                        <IconButton 
                                          size="small"
                                          onClick={() => handleMoreInfoView({ more_info: rack.more_info, location_code: `Rack ${rack.rack_id}` })}
                                          disabled={!rack.more_info}
                                        >
                                          <InfoIcon color={rack.more_info ? "primary" : "disabled"} />
                                        </IconButton>
                                      </TableCell>
                                      <TableCell align="center">
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
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
                                                    <TableCell><strong>Design</strong></TableCell>
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
                                                      <TableCell align="center">
                                                        {client.design_file ? (
                                                          <Button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleDownloadClientDesign(client.id);
                                                            }}
                                                            color="success"
                                                            size="small"
                                                            startIcon={<CheckCircleIcon color="success" />}
                                                          >
                                                            <CloudDownloadIcon fontSize="small" />
                                                          </Button>
                                                        ) : (
                                                          <Tooltip title="No design file">
                                                            <CancelIcon color="error" />
                                                          </Tooltip>
                                                        )}
                                                      </TableCell>
                                                      <TableCell align="center">
                                                        <IconButton 
                                                          size="small"
                                                          onClick={() => handleMoreInfoView({ more_info: client.more_info, location_code: `Client ${client.client_name}` })}
                                                          disabled={!client.more_info}
                                                        >
                                                          <InfoIcon color={client.more_info ? "primary" : "disabled"} />
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
                                              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
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
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
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
            {/* Design File Upload */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Design File (PDF Only)
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
                    onChange={handleFileChange}
                  />
                </Button>
                {designFile && (
                  <Typography variant="body2" color="success.main">
                    Selected: {designFile.name}
                  </Typography>
                )}
              </Box>
              {selectedLocation?.design_file && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Current: Design file exists
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<CloseIcon />}
                    onClick={() => handleDeleteLocationDesign(selectedLocation.id)}
                  >
                    Remove
                  </Button>
                </Box>
              )}
            </Box>

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
      <Dialog open={moreInfoDialogOpen} onClose={() => setMoreInfoDialogOpen(false)} maxWidth="md" fullWidth>
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
              variant="body1" 
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoreInfoDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Rack Dialog */}
      <Dialog open={rackDialogOpen} onClose={() => setRackDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {rackDialogMode === 'add' ? 'Add New Rack' : `Edit Rack ${selectedRack?.rack_id}`}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
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
                label="Total Power (kVA) *"
                type="number"
                step="0.1"
                value={rackFormData.total_power_kva}
                onChange={(e) => setRackFormData(prev => ({...prev, total_power_kva: e.target.value}))}
                required
                field="total_power_kva"
                errors={rackErrors}
              />
            </Grid>
            <Grid item xs={12}>
              <ValidatedTextField
                fullWidth
                label="Network Infrastructure *"
                value={rackFormData.network_infrastructure}
                onChange={(e) => setRackFormData(prev => ({...prev, network_infrastructure: e.target.value}))}
                required
                field="network_infrastructure"
                errors={rackErrors}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Pricing Info (Excel Only)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<CloudUploadIcon />}
                >
                  Upload Excel
                  <input
                    type="file"
                    hidden
                    accept=".xlsx"
                    onChange={handlePricingFileChange}
                  />
                </Button>
                {pricingInfoFile && (
                  <Typography variant="body2" color="success.main">
                    Selected: {pricingInfoFile.name}
                  </Typography>
                )}
              </Box>
              {selectedRack?.pricing_info_file && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Current: Pricing file exists
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<CloseIcon />}
                    onClick={() => handleDeleteRackPricing(selectedRack.id)}
                  >
                    Remove
                  </Button>
                </Box>
              )}
            </Grid>
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
                label="Power Purchased (kVA) *"
                type="number"
                step="0.1"
                value={clientFormData.power_purchased}
                onChange={(e) => setClientFormData(prev => ({...prev, power_purchased: e.target.value}))}
                required
                field="power_purchased"
                errors={clientErrors}
              />
            </Grid>
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
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Design File (PDF Only)
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
                    onChange={handleClientDesignFileChange}
                  />
                </Button>
                {clientDesignFile && (
                  <Typography variant="body2" color="success.main">
                    Selected: {clientDesignFile.name}
                  </Typography>
                )}
              </Box>
              {selectedClient?.design_file && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Current: Design file exists
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<CloseIcon />}
                    onClick={() => handleDeleteClientDesign(selectedClient.id)}
                  >
                    Remove
                  </Button>
                </Box>
              )}
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