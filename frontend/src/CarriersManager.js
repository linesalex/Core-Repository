import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip,
  Alert, Snackbar, Tooltip, Grid, FormControl, InputLabel, Select, MenuItem, Collapse,
  Tabs, Tab, Badge
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import BusinessIcon from '@mui/icons-material/Business';
import ContactsIcon from '@mui/icons-material/Contacts';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import axios from 'axios';
import { API_BASE_URL } from './config';
import { useAuth } from './AuthContext';
import LoadingIndicator from './components/LoadingIndicator';
import { ValidatedTextField, ValidatedSelect, createValidator, scrollToFirstError } from './components/FormValidation';

const CarriersManager = ({ hasPermission }) => {
  const { user } = useAuth();
  const [carriers, setCarriers] = useState([]);
  const [contacts, setContacts] = useState({});
  const [contactsLoading, setContactsLoading] = useState({}); // Track loading state per carrier
  const [overdueContacts, setOverdueContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedCarrier, setExpandedCarrier] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);
  
  // Dialog states
  const [carrierDialogOpen, setCarrierDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [carrierDialogMode, setCarrierDialogMode] = useState('add');
  const [contactDialogMode, setContactDialogMode] = useState('add');
  const [moreInfoDialogOpen, setMoreInfoDialogOpen] = useState(false);
  const [moreInfoContent, setMoreInfoContent] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [deleteCarrierDialogOpen, setDeleteCarrierDialogOpen] = useState(false);
  const [deleteContactDialogOpen, setDeleteContactDialogOpen] = useState(false);
  
  // Form data
  const [carrierFormData, setCarrierFormData] = useState({
    carrier_name: '',
    region: 'AMERs',
    status: 'active',
    previously_known_as: ''
  });

  const [contactFormData, setContactFormData] = useState({
    contact_type: '',
    contact_level: '',
    contact_name: '',
    contact_function: '',
    contact_email: '',
    contact_phone: '',
    notes: ''
  });

  // Validation states
  const [contactErrors, setContactErrors] = useState({});

  // Search and filter states
  const [searchText, setSearchText] = useState('');
  const [contactSearchText, setContactSearchText] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const debounceRef = useRef();
  const contactDebounceRef = useRef();

  // Contact sorting states
  const [contactSortField, setContactSortField] = useState('contact_type'); // 'contact_type' or 'contact_level'
  const [contactSortDirection, setContactSortDirection] = useState('asc'); // 'asc' or 'desc'

  // Validation rules for Carrier contact form
  const carrierContactValidationRules = {
    contact_type: { type: 'required', message: 'Contact Type is required' },
    contact_name: { 
      type: 'oneOf', 
      fields: ['contact_name', 'contact_function'], 
      message: 'Either Contact Name or Contact Job Title is required' 
    },
    contact_function: { 
      type: 'oneOf', 
      fields: ['contact_name', 'contact_function'], 
      message: 'Either Contact Name or Contact Job Title is required' 
    },
    contact_email: { 
      type: 'oneOf', 
      fields: ['contact_email', 'contact_phone'], 
      message: 'Either Contact Email or Contact Phone is required' 
    },
    contact_phone: { 
      type: 'oneOf', 
      fields: ['contact_email', 'contact_phone'], 
      message: 'Either Contact Email or Contact Phone is required' 
    }
  };

  const validateCarrierContact = createValidator(carrierContactValidationRules);

  const regions = ['AMERs', 'APAC', 'EMEA'];

  // Load carriers on component mount
  useEffect(() => {
    loadCarriers();
    if (currentTab === 1) {
      loadOverdueContacts();
    }
  }, []);

  // Load overdue contacts when switching to overdue tab
  useEffect(() => {
    if (currentTab === 1) {
      loadOverdueContacts();
    }
  }, [currentTab]);

  // Auto-expand carriers with matching contacts when contact search is active
  useEffect(() => {
    const searchAndExpand = async () => {
      if (!contactSearchText) {
        return;
      }

      // Load contacts for all carriers that don't have contacts loaded yet
      const carriersToLoad = carriers.filter(c => !contacts[c.id]);
      
      for (const carrier of carriersToLoad) {
        await loadContacts(carrier.id);
      }
    };

    searchAndExpand();
  }, [contactSearchText, carriers]);

  // Find carriers that have matching contacts
  const getCarriersWithMatchingContacts = () => {
    if (!contactSearchText) return new Set();
    
    const matchingCarrierIds = new Set();
    const searchLower = contactSearchText.toLowerCase();
    
    Object.entries(contacts).forEach(([carrierId, carrierContacts]) => {
      if (carrierContacts && carrierContacts.some(contact => 
        contact.contact_name && contact.contact_name.toLowerCase().includes(searchLower)
      )) {
        matchingCarrierIds.add(parseInt(carrierId));
      }
    });
    
    return matchingCarrierIds;
  };

  const matchingCarrierIds = getCarriersWithMatchingContacts();

  // Filter contacts based on search
  const filterContacts = (carrierContacts) => {
    if (!contactSearchText || !carrierContacts) return carrierContacts;
    
    const searchLower = contactSearchText.toLowerCase();
    return carrierContacts.filter(contact => 
      contact.contact_name && contact.contact_name.toLowerCase().includes(searchLower)
    );
  };

  // Debounced search function for carriers
  const debouncedSearch = useCallback((searchValue) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      setSearchText(searchValue);
    }, 300); // 300ms debounce
  }, []);

  // Debounced search function for contacts
  const debouncedContactSearch = useCallback((searchValue) => {
    if (contactDebounceRef.current) {
      clearTimeout(contactDebounceRef.current);
    }
    
    contactDebounceRef.current = setTimeout(() => {
      setContactSearchText(searchValue);
    }, 300); // 300ms debounce
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (contactDebounceRef.current) {
        clearTimeout(contactDebounceRef.current);
      }
    };
  }, []);

  // Handle search input change
  const handleSearchChange = (event) => {
    debouncedSearch(event.target.value);
  };

  // Handle contact search input change
  const handleContactSearchChange = (event) => {
    debouncedContactSearch(event.target.value);
  };

  // Level sorting order (logical)
  const levelSortOrder = {
    'General': 0,
    '1st Level': 1,
    '2nd Level': 2,
    '3rd Level': 3,
    '4th Level': 4,
    '5th Level': 5
  };

  // Sort contacts based on current sort field and direction
  const sortContacts = (contactsList) => {
    if (!contactsList) return [];
    
    return [...contactsList].sort((a, b) => {
      // Primary sort by selected field
      let comparison = 0;
      
      if (contactSortField === 'contact_type') {
        const typeA = (a.contact_type || '').toLowerCase();
        const typeB = (b.contact_type || '').toLowerCase();
        comparison = typeA.localeCompare(typeB);
        
        // Secondary sort by level (logical order) when types are equal
        if (comparison === 0) {
          const levelA = levelSortOrder[a.contact_level] ?? 999;
          const levelB = levelSortOrder[b.contact_level] ?? 999;
          comparison = levelA - levelB;
        }
      } else if (contactSortField === 'contact_level') {
        const levelA = levelSortOrder[a.contact_level] ?? 999;
        const levelB = levelSortOrder[b.contact_level] ?? 999;
        comparison = levelA - levelB;
        
        // Secondary sort by type (alphabetical) when levels are equal
        if (comparison === 0) {
          const typeA = (a.contact_type || '').toLowerCase();
          const typeB = (b.contact_type || '').toLowerCase();
          comparison = typeA.localeCompare(typeB);
        }
      }
      
      // Apply direction
      return contactSortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // Handle clicking on sortable column headers
  const handleContactSort = (field) => {
    if (contactSortField === field) {
      // Toggle direction if same field
      setContactSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Switch to new field with ascending order
      setContactSortField(field);
      setContactSortDirection('asc');
    }
  };

  const loadCarriers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/carriers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setCarriers(response.data);
    } catch (err) {
      setError('Failed to load carriers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };



  const loadOverdueContacts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/carriers/overdue-contacts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setOverdueContacts(response.data);
    } catch (err) {
      setError('Failed to load overdue contacts: ' + err.message);
      setOverdueContacts([]);
    }
  };

  const loadContacts = async (carrierId) => {
    try {
      setContactsLoading(prev => ({ ...prev, [carrierId]: true }));
      const response = await axios.get(`${API_BASE_URL}/carriers/${carrierId}/contacts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setContacts(prev => ({
        ...prev,
        [carrierId]: response.data
      }));
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setContactsLoading(prev => ({ ...prev, [carrierId]: false }));
    }
  };

  const handleCarrierRowClick = async (carrier) => {
    if (expandedCarrier === carrier.id) {
      setExpandedCarrier(null);
    } else {
      setExpandedCarrier(carrier.id);
      if (!contacts[carrier.id]) {
        await loadContacts(carrier.id);
      }
    }
  };

  const handleAddCarrier = () => {
    setCarrierDialogMode('add');
    setSelectedCarrier(null);
    setCarrierFormData({
      carrier_name: '',
      region: 'AMERs',
      status: 'active',
      previously_known_as: ''
    });
    setCarrierDialogOpen(true);
  };

  const handleEditCarrier = (carrier) => {
    setCarrierDialogMode('edit');
    setSelectedCarrier(carrier);
    setCarrierFormData({
      carrier_name: carrier.carrier_name,
      region: carrier.region || 'AMERs',
      status: carrier.status || 'active',
      previously_known_as: carrier.previously_known_as || ''
    });
    setCarrierDialogOpen(true);
  };

  const handleDeleteCarrier = (carrier) => {
    setSelectedCarrier(carrier);
    setDeleteCarrierDialogOpen(true);
  };

  const handleAddContact = (carrier) => {
    setContactDialogMode('add');
    setSelectedCarrier(carrier);
    setSelectedContact(null);
    setContactFormData({
      contact_type: '',
      contact_level: '',
      contact_name: '',
      contact_function: '',
      contact_email: '',
      contact_phone: '',
      notes: ''
    });
    setContactErrors({});
    setContactDialogOpen(true);
  };

  const handleEditContact = (carrier, contact) => {
    setContactDialogMode('edit');
    setSelectedCarrier(carrier);
    setSelectedContact(contact);
    setContactFormData({
      contact_type: contact.contact_type || '',
      contact_level: contact.contact_level || '',
      contact_name: contact.contact_name || '',
      contact_function: contact.contact_function || '',
      contact_email: contact.contact_email || '',
      contact_phone: contact.contact_phone || '',
      notes: contact.notes || ''
    });
    setContactErrors({});
    setContactDialogOpen(true);
  };

  const handleMoreInfo = (content) => {
    setMoreInfoContent(content);
    setMoreInfoDialogOpen(true);
  };

  const handleDeleteContact = (carrier, contact) => {
    setSelectedCarrier(carrier);
    setSelectedContact(contact);
    setDeleteContactDialogOpen(true);
  };

  const handleCarrierSubmit = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      };

      if (carrierDialogMode === 'add') {
        if (!carrierFormData.carrier_name) {
          setError('Carrier name is required');
          return;
        }

        await axios.post(`${API_BASE_URL}/carriers`, carrierFormData, { headers });
        setSuccess('Carrier created successfully');
      } else {
        const response = await axios.put(`${API_BASE_URL}/carriers/${selectedCarrier.id}`, carrierFormData, { headers });
        
        // Check if carrier name was changed and cascaded to dependent tables
        if (response.data.cascaded) {
          setSuccess(`Carrier updated successfully. Name changed from "${response.data.oldName}" to "${carrierFormData.carrier_name}" - all dependent records have been automatically updated.`);
        } else {
          setSuccess('Carrier updated successfully');
        }
      }

      setCarrierDialogOpen(false);
      await loadCarriers();

    } catch (err) {
      setError('Failed to save carrier: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleContactSubmit = async () => {
    try {
      // Validate the form
      const errors = validateCarrierContact(contactFormData);
      setContactErrors(errors);
      
      if (Object.keys(errors).length > 0) {
        scrollToFirstError(errors);
        return;
      }

      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      };

      if (contactDialogMode === 'add') {
        await axios.post(`${API_BASE_URL}/carriers/${selectedCarrier.id}/contacts`, contactFormData, { headers });
        setSuccess('Contact created successfully');
      } else {
        await axios.put(`${API_BASE_URL}/carriers/${selectedCarrier.id}/contacts/${selectedContact.id}`, contactFormData, { headers });
        setSuccess('Contact updated successfully');
      }

      setContactDialogOpen(false);
      setContactErrors({});
      await loadContacts(selectedCarrier.id);

    } catch (err) {
      setError('Failed to save contact: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCarrierDeleteConfirm = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/carriers/${selectedCarrier.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setSuccess('Carrier deleted successfully');
      setDeleteCarrierDialogOpen(false);
      await loadCarriers();
    } catch (err) {
      setError('Failed to delete carrier: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleContactDeleteConfirm = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/carriers/${selectedCarrier.id}/contacts/${selectedContact.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setSuccess('Contact deleted successfully');
      setDeleteContactDialogOpen(false);
      await loadContacts(selectedCarrier.id);
      // Refresh overdue contacts if on that tab
      if (currentTab === 1) {
        await loadOverdueContacts();
      }
    } catch (err) {
      setError('Failed to delete contact: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleApproveContact = async (carrierId, contactId) => {
    try {
      await axios.post(`${API_BASE_URL}/carriers/${carrierId}/contacts/${contactId}/approve`, {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setSuccess('Contact yearly update approved successfully');
      await loadOverdueContacts();
    } catch (err) {
      setError('Failed to approve contact: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const handleCarrierInputChange = (field, value) => {
    setCarrierFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleContactInputChange = (field, value) => {
    setContactFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getStatusChip = (status) => {
    const colors = {
      'active': 'success',
      'inactive': 'error'
    };
    return <Chip label={status === 'active' ? 'Active' : 'Inactive'} color={colors[status]} size="small" />;
  };

  const getRegionChip = (region) => {
    const colors = {
      'AMERs': 'primary', // Blue
      'APAC': 'success',  // Green
      'EMEA': 'secondary' // Purple
    };
    return <Chip label={region} color={colors[region] || 'default'} size="small" />;
  };

  const canViewOverdueContacts = () => {
    return user?.role === 'administrator' || user?.role === 'provisioner';
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

  const formatLastUpdated = (lastUpdated) => {
    if (!lastUpdated) return 'Never';
    const date = new Date(lastUpdated);
    return date.toLocaleDateString();
  };

  const getDaysOverdueChip = (daysOverdue) => {
    if (daysOverdue >= 730) { // 2+ years
      return <Chip label={`${Math.floor(daysOverdue / 365)} years overdue`} color="error" size="small" />;
    } else if (daysOverdue >= 365) { // 1+ year
      return <Chip label={`${Math.floor(daysOverdue / 365)} year overdue`} color="warning" size="small" />;
    } else {
      return <Chip label={`${daysOverdue} days overdue`} color="info" size="small" />;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2">
          Manage Carriers
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {hasPermission && hasPermission('carriers', 'create') && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddCarrier}
            >
              Add Carrier
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={currentTab === 0 ? loadCarriers : loadOverdueContacts}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={handleTabChange} aria-label="carrier management tabs">
          <Tab 
            icon={<BusinessIcon />} 
            label="All Carriers" 
            id="carriers-tab-0"
            aria-controls="carriers-tabpanel-0"
          />
          {canViewOverdueContacts() && (
            <Tab 
              icon={
                <Badge badgeContent={overdueContacts.length} color="error">
                  <WarningIcon />
                </Badge>
              } 
              label="Overdue Contacts" 
              id="carriers-tab-1"
              aria-controls="carriers-tabpanel-1"
            />
          )}
        </Tabs>
      </Box>

      {/* All Carriers Tab */}
      {currentTab === 0 && (
        <Box role="tabpanel" id="carriers-tabpanel-0" aria-labelledby="carriers-tab-0">
          {/* Search and Filter */}
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              label="Search Carriers"
              onChange={handleSearchChange}
              placeholder="Search by carrier name or previously known as..."
              sx={{ minWidth: 300 }}
            />
            <TextField
              size="small"
              label="Search Contacts"
              onChange={handleContactSearchChange}
              placeholder="Search by contact name..."
              sx={{ minWidth: 250 }}
              InputProps={{
                startAdornment: <PersonSearchIcon sx={{ mr: 1, color: 'action.active' }} />
              }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Region</InputLabel>
              <Select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                label="Region"
              >
                <MenuItem value="">All Regions</MenuItem>
                <MenuItem value="AMERs">AMERs</MenuItem>
                <MenuItem value="EMEA">EMEA</MenuItem>
                <MenuItem value="APAC">APAC</MenuItem>
              </Select>
            </FormControl>
            {contactSearchText && (
              <Chip
                label={`Found in ${matchingCarrierIds.size} carrier${matchingCarrierIds.size !== 1 ? 's' : ''}`}
                color="info"
                size="small"
                onDelete={() => {
                  setContactSearchText('');
                  // Clear the search input field
                  const contactSearchInput = document.querySelector('input[placeholder="Search by contact name..."]');
                  if (contactSearchInput) contactSearchInput.value = '';
                }}
              />
            )}
          </Box>
          <TableContainer component={Paper}>
            <Table>
          <TableHead>
            <TableRow>
              <TableCell>Region</TableCell>
              <TableCell>Carrier</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {carriers.filter(carrier => {
              const matchesCarrierSearch = !searchText || 
                carrier.carrier_name.toLowerCase().includes(searchText.toLowerCase()) ||
                (carrier.previously_known_as && carrier.previously_known_as.toLowerCase().includes(searchText.toLowerCase()));
              const matchesRegion = !regionFilter || carrier.region === regionFilter;
              const matchesContactSearch = !contactSearchText || matchingCarrierIds.has(carrier.id);
              return matchesCarrierSearch && matchesRegion && matchesContactSearch;
            }).map((carrier) => (
              <React.Fragment key={carrier.id}>
                <TableRow 
                  hover
                  onClick={() => handleCarrierRowClick(carrier)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{getRegionChip(carrier.region)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BusinessIcon />
                      <Box>
                        <Typography variant="body1" fontWeight="bold" sx={{ fontSize: '0.875rem' }}>
                          {carrier.carrier_name}
                        </Typography>
                        {carrier.previously_known_as && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                            AKA: {carrier.previously_known_as}
                          </Typography>
                        )}
                      </Box>
                      {expandedCarrier === carrier.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </Box>
                  </TableCell>
                  <TableCell>{getStatusChip(carrier.status)}</TableCell>
                  <TableCell align="center">
                    {hasPermission && hasPermission('carriers', 'edit') && (
                      <Tooltip title="Edit">
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCarrier(carrier);
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {hasPermission && hasPermission('carriers', 'delete') && (
                      <Tooltip title="Delete">
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCarrier(carrier);
                          }}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {(!hasPermission || (!hasPermission('carriers', 'edit') && !hasPermission('carriers', 'delete'))) && (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>-</Typography>
                    )}
                  </TableCell>
                </TableRow>
                
                {/* Contact Details Dropdown */}
                <TableRow>
                  <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                    <Collapse in={expandedCarrier === carrier.id || (contactSearchText && matchingCarrierIds.has(carrier.id))} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 2, backgroundColor: 'action.hover' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6" component="h3">
                            Contact Details
                          </Typography>
                          {hasPermission && hasPermission('carriers', 'create') && (
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<ContactsIcon />}
                              onClick={() => handleAddContact(carrier)}
                            >
                              Add Contact
                            </Button>
                          )}
                        </Box>
                        
                        {contactsLoading[carrier.id] ? (
                          <LoadingIndicator message="Loading contacts..." size={16} sx={{ p: 1 }} />
                        ) : contacts[carrier.id] && contacts[carrier.id].length > 0 ? (
                          <TableContainer component={Paper} sx={{ mt: 1 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell 
                                    onClick={() => handleContactSort('contact_type')}
                                    sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { backgroundColor: 'action.hover' } }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      Type
                                      {contactSortField === 'contact_type' && (
                                        contactSortDirection === 'asc' 
                                          ? <ArrowUpwardIcon sx={{ fontSize: 16 }} /> 
                                          : <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                                      )}
                                    </Box>
                                  </TableCell>
                                  <TableCell 
                                    onClick={() => handleContactSort('contact_level')}
                                    sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { backgroundColor: 'action.hover' } }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      Level
                                      {contactSortField === 'contact_level' && (
                                        contactSortDirection === 'asc' 
                                          ? <ArrowUpwardIcon sx={{ fontSize: 16 }} /> 
                                          : <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                                      )}
                                    </Box>
                                  </TableCell>
                                  <TableCell>Name</TableCell>
                                  <TableCell>Job Title</TableCell>
                                  <TableCell>Email</TableCell>
                                  <TableCell>Phone</TableCell>
                                  <TableCell>Last Updated</TableCell>
                                  <TableCell>Notes</TableCell>
                                  <TableCell align="center">Actions</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {sortContacts(filterContacts(contacts[carrier.id])).map((contact) => (
                                  <TableRow 
                                    key={contact.id}
                                    sx={contactSearchText && contact.contact_name?.toLowerCase().includes(contactSearchText.toLowerCase()) 
                                      ? { backgroundColor: 'rgba(25, 118, 210, 0.08)', borderLeft: '3px solid #1976d2' } 
                                      : {}
                                    }
                                  >
                                    <TableCell>{contact.contact_type}</TableCell>
                                    <TableCell>{contact.contact_level}</TableCell>
                                    <TableCell>
                                      {contactSearchText && contact.contact_name?.toLowerCase().includes(contactSearchText.toLowerCase()) ? (
                                        <Typography component="span" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                          {contact.contact_name}
                                        </Typography>
                                      ) : (
                                        contact.contact_name
                                      )}
                                    </TableCell>
                                    <TableCell>{contact.contact_function}</TableCell>
                                    <TableCell>{contact.contact_email}</TableCell>
                                    <TableCell>{contact.contact_phone}</TableCell>
                                    <TableCell>
                                      <Box>
                                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                          {contact.last_updated ? formatTrackingDate(contact.last_updated) : 'Unknown'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                                          {contact.username || 'Unknown User'}
                                        </Typography>
                                      </Box>
                                    </TableCell>
                                    <TableCell>
                                      {contact.notes ? (
                                        <Tooltip title="View Notes">
                                          <IconButton size="small" onClick={() => handleMoreInfo(contact.notes)}>
                                            <InfoIcon />
                                          </IconButton>
                                        </Tooltip>
                                      ) : '-'}
                                    </TableCell>
                                    <TableCell align="center">
                                      {hasPermission && hasPermission('carriers', 'edit') && (
                                        <Tooltip title="Edit">
                                          <IconButton 
                                            size="small" 
                                            onClick={() => handleEditContact(carrier, contact)}
                                          >
                                            <EditIcon />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                      {hasPermission && hasPermission('carriers', 'delete') && (
                                        <Tooltip title="Delete">
                                          <IconButton 
                                            size="small" 
                                            onClick={() => handleDeleteContact(carrier, contact)}
                                            color="error"
                                          >
                                            <DeleteIcon />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                      {(!hasPermission || (!hasPermission('carriers', 'edit') && !hasPermission('carriers', 'delete'))) && (
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>-</Typography>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                            No contacts found for this carrier.
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
      </TableContainer>
        </Box>
      )}

      {/* Overdue Contacts Tab */}
      {currentTab === 1 && canViewOverdueContacts() && (
        <Box role="tabpanel" id="carriers-tabpanel-1" aria-labelledby="carriers-tab-1">
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              Contacts that haven't been updated in 365+ days. Approve contacts after verifying their information is current.
            </Typography>
          </Box>
          
          {overdueContacts.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Carrier</TableCell>
                    <TableCell>Region</TableCell>
                    <TableCell>Contact Name</TableCell>
                    <TableCell>Contact Job Title</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Last Updated</TableCell>
                    <TableCell>Days Overdue</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overdueContacts.map((contact) => (
                    <TableRow key={`${contact.carrier_id}-${contact.id}`} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.75rem' }}>
                          {contact.carrier_name}
                        </Typography>
                      </TableCell>
                      <TableCell>{getRegionChip(contact.region)}</TableCell>
                      <TableCell>{contact.contact_name}</TableCell>
                      <TableCell>{contact.contact_function || '-'}</TableCell>
                      <TableCell>{contact.contact_email || '-'}</TableCell>
                      <TableCell>{contact.contact_phone || '-'}</TableCell>
                      <TableCell>{formatLastUpdated(contact.last_updated)}</TableCell>
                      <TableCell>{getDaysOverdueChip(contact.days_since_update)}</TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          {hasPermission && hasPermission('carriers', 'edit') && (
                            <Tooltip title="Approve yearly update">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleApproveContact(contact.carrier_id, contact.id)}
                              >
                                <CheckIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          {hasPermission && hasPermission('carriers', 'delete') && (
                            <Tooltip title="Delete contact">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setSelectedCarrier({ id: contact.carrier_id, carrier_name: contact.carrier_name });
                                  setSelectedContact(contact);
                                  setDeleteContactDialogOpen(true);
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          {(!hasPermission || (!hasPermission('carriers', 'edit') && !hasPermission('carriers', 'delete'))) && (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>-</Typography>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                No overdue contacts found. All carrier contacts are up to date!
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Add/Edit Carrier Dialog */}
      <Dialog open={carrierDialogOpen} onClose={() => setCarrierDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {carrierDialogMode === 'add' ? 'Add New Carrier' : 'Edit Carrier'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Carrier Name *"
                value={carrierFormData.carrier_name}
                onChange={(e) => handleCarrierInputChange('carrier_name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Region</InputLabel>
                <Select
                  value={carrierFormData.region}
                  onChange={(e) => handleCarrierInputChange('region', e.target.value)}
                  label="Region"
                >
                  {regions.map(region => (
                    <MenuItem key={region} value={region}>{region}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={carrierFormData.status}
                  onChange={(e) => handleCarrierInputChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Also Known As"
                value={carrierFormData.previously_known_as}
                onChange={(e) => handleCarrierInputChange('previously_known_as', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCarrierDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCarrierSubmit} variant="contained">
            {carrierDialogMode === 'add' ? 'Add' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit Contact Dialog */}
      <Dialog open={contactDialogOpen} onClose={() => setContactDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {contactDialogMode === 'add' ? 'Add New Contact' : 'Edit Contact'} - {selectedCarrier?.carrier_name}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <ValidatedSelect
                field="contact_type"
                errors={contactErrors}
                required
                fullWidth
                label="Contact Type"
                name="contact_type"
                value={contactFormData.contact_type}
                onChange={(e) => handleContactInputChange('contact_type', e.target.value)}
              >
                <MenuItem value="Primary Support Contact">Primary Support Contact</MenuItem>
                <MenuItem value="Primary Order Contact">Primary Order Contact</MenuItem>
                <MenuItem value="Billing Contact">Billing Contact</MenuItem>
                <MenuItem value="Primary Legal Contact">Primary Legal Contact</MenuItem>
                <MenuItem value="Account Manager">Account Manager</MenuItem>
                <MenuItem value="Service Manager">Service Manager</MenuItem>
                <MenuItem value="Support - Peer to Peer Escalation">Support - Peer to Peer Escalation</MenuItem>
                <MenuItem value="Delivery - Peer to Peer Escalation">Delivery - Peer to Peer Escalation</MenuItem>
                <MenuItem value="Service Management - Peer to Peer Escalation">Service Management - Peer to Peer Escalation</MenuItem>
                <MenuItem value="Account Management - Peer to Peer Escalation">Account Management - Peer to Peer Escalation</MenuItem>
                <MenuItem value="Cease Contact">Cease Contact</MenuItem>
              </ValidatedSelect>
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedSelect
                field="contact_level"
                errors={contactErrors}
                fullWidth
                label="Contact Level"
                name="contact_level"
                value={contactFormData.contact_level}
                onChange={(e) => handleContactInputChange('contact_level', e.target.value)}
              >
                <MenuItem value="General">General</MenuItem>
                <MenuItem value="1st Level">1st Level</MenuItem>
                <MenuItem value="2nd Level">2nd Level</MenuItem>
                <MenuItem value="3rd Level">3rd Level</MenuItem>
                <MenuItem value="4th Level">4th Level</MenuItem>
                <MenuItem value="5th Level">5th Level</MenuItem>
              </ValidatedSelect>
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="contact_name"
                errors={contactErrors}
                fullWidth
                label="Contact Name"
                name="contact_name"
                value={contactFormData.contact_name}
                onChange={(e) => handleContactInputChange('contact_name', e.target.value)}
                helperText="Required if Job Title is not provided"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="contact_function"
                errors={contactErrors}
                fullWidth
                label="Contact Job Title"
                name="contact_function"
                value={contactFormData.contact_function}
                onChange={(e) => handleContactInputChange('contact_function', e.target.value)}
                helperText="Required if Contact Name is not provided"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="contact_email"
                errors={contactErrors}
                fullWidth
                label="Contact Email"
                type="email"
                name="contact_email"
                value={contactFormData.contact_email}
                onChange={(e) => handleContactInputChange('contact_email', e.target.value)}
                helperText="Required if Contact Phone is not provided"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="contact_phone"
                errors={contactErrors}
                fullWidth
                label="Contact Phone"
                name="contact_phone"
                value={contactFormData.contact_phone}
                onChange={(e) => handleContactInputChange('contact_phone', e.target.value)}
                helperText="Required if Contact Email is not provided"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={contactFormData.notes}
                onChange={(e) => handleContactInputChange('notes', e.target.value)}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleContactSubmit} variant="contained">
            {contactDialogMode === 'add' ? 'Add' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Carrier Confirmation Dialog */}
      <Dialog open={deleteCarrierDialogOpen} onClose={() => setDeleteCarrierDialogOpen(false)}>
        <DialogTitle>Delete Carrier</DialogTitle>
        <DialogContent>
          Are you sure you want to delete carrier {selectedCarrier?.carrier_name}?
          <br />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '0.75rem' }}>
            This will also delete all associated contacts.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteCarrierDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCarrierDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Contact Confirmation Dialog */}
      <Dialog open={deleteContactDialogOpen} onClose={() => setDeleteContactDialogOpen(false)}>
        <DialogTitle>Delete Contact</DialogTitle>
        <DialogContent>
          Are you sure you want to delete contact {selectedContact?.contact_name}?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteContactDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleContactDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* More Info Dialog */}
      <Dialog open={moreInfoDialogOpen} onClose={() => setMoreInfoDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Notes</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {moreInfoContent}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoreInfoDialogOpen(false)}>Close</Button>
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

export default CarriersManager; 