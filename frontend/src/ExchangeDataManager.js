import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip,
  Alert, Snackbar, Tooltip, Grid, FormControl, InputLabel, Select, MenuItem, Collapse,
  FormControlLabel, Switch, Autocomplete, DialogContentText, Tabs, Tab, Badge
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import BusinessIcon from '@mui/icons-material/Business';
import ContactsIcon from '@mui/icons-material/Contacts';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import CheckIcon from '@mui/icons-material/Check';
import axios from 'axios';



const ExchangeDataManager = ({ hasPermission, initialTab = 0 }) => {
  
  // Data states
  const [exchanges, setExchanges] = useState([]);
  const [feeds, setFeeds] = useState({});
  const [contacts, setContacts] = useState({});
  const [overdueContacts, setOverdueContacts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedExchange, setExpandedExchange] = useState(null);
  
  // Dialog states
  const [exchangeDialogOpen, setExchangeDialogOpen] = useState(false);
  const [feedDialogOpen, setFeedDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [moreInfoDialogOpen, setMoreInfoDialogOpen] = useState(false);
  const [isfInfoDialogOpen, setISFInfoDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Dialog modes
  const [exchangeDialogMode, setExchangeDialogMode] = useState('add');
  const [feedDialogMode, setFeedDialogMode] = useState('add');
  const [contactDialogMode, setContactDialogMode] = useState('add');
  
  // Selected items
  const [selectedExchange, setSelectedExchange] = useState(null);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedISFData, setSelectedISFData] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [moreInfoContent, setMoreInfoContent] = useState('');
  
  // Search and filter states
  const [searchText, setSearchText] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterAvailable, setFilterAvailable] = useState('');
  const [feedSearchText, setFeedSearchText] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  
  // Form data
  const [exchangeFormData, setExchangeFormData] = useState({
    exchange_name: '',
    region: 'AMERs',
    salesperson_assigned: '',
    available: true
  });

  const [feedFormData, setFeedFormData] = useState({
    feed_name: '',
    feed_delivery: 'Unicast',
    feed_type: 'Equities',
    isf_enabled: false,
    isf_a: '',
    isf_b: '',
    isf_site_code_a: '',
    isf_site_code_b: '',
    isf_dr_a: '',
    isf_dr_b: '',
    isf_dr_site_code_a: '',
    isf_dr_site_code_b: '',
    dr_type: '',
    order_entry_isf: '',
    unicast_isf: '',
    dr_available: false,
    bandwidth_1ms: '',
    available_now: false,
    quick_quote: false,
    pass_through_fees: '',
    pass_through_currency: 'USD',
    pass_through_fees_info: '',
    more_info: '',
    design_file: null
  });

  const [contactFormData, setContactFormData] = useState({
    contact_name: '',
    job_title: '',
    country: '',
    phone_number: '',
    email: '',
    contact_type: '',
    daily_contact: false,
    more_info: ''
  });

  const regions = ['AMERs', 'APAC', 'EMEA'];

  // Load data on component mount
  useEffect(() => {
    loadExchanges();
    loadCurrencies();
    loadOverdueContacts();
  }, []);

  const loadExchanges = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchText) params.append('search', searchText);
      if (filterRegion) params.append('region', filterRegion);
      if (filterAvailable) params.append('available', filterAvailable);

      const response = await axios.get(`http://localhost:4000/exchanges?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setExchanges(response.data);
    } catch (err) {
      setError('Failed to load exchanges: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrencies = async (showSuccess = false) => {
    try {
      const response = await axios.get('http://localhost:4000/exchange-currencies', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setCurrencies(response.data);
      if (showSuccess) {
        setSuccess('Currency list synchronized with Exchange Rates');
      }
    } catch (err) {
      console.error('Failed to load currencies:', err);
      setError('Failed to load currencies. Please refresh the page.');
    }
  };

  // Refresh currencies manually
  const refreshCurrencies = async () => {
    await loadCurrencies(true);
  };

  const loadFeeds = async (exchangeId) => {
    try {
      const params = new URLSearchParams();
      if (feedSearchText) params.append('search', feedSearchText);

      const response = await axios.get(`http://localhost:4000/exchanges/${exchangeId}/feeds?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setFeeds(prev => ({
        ...prev,
        [exchangeId]: response.data
      }));
    } catch (err) {
      console.error('Failed to load feeds:', err);
    }
  };

  const loadContacts = async (exchangeId) => {
    try {
      const response = await axios.get(`http://localhost:4000/exchanges/${exchangeId}/contacts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setContacts(prev => ({
        ...prev,
        [exchangeId]: response.data
      }));
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  };

  const loadOverdueContacts = async () => {
    try {
      const response = await axios.get('http://localhost:4000/exchanges/overdue-contacts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setOverdueContacts(response.data);
    } catch (err) {
      console.error('Failed to load overdue contacts:', err);
    }
  };

  const handleApproveContact = async (contactId) => {
    try {
      await axios.post(`http://localhost:4000/exchanges/contacts/${contactId}/approve`, {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setSuccess('Contact approved successfully');
      await loadOverdueContacts();
    } catch (err) {
      setError('Failed to approve contact: ' + (err.response?.data?.error || err.message));
    }
  };

  // Handlers
  const handleExchangeRowClick = async (exchange) => {
    if (expandedExchange === exchange.id) {
      setExpandedExchange(null);
    } else {
      setExpandedExchange(exchange.id);
      if (initialTab === 0 && !feeds[exchange.id]) {
        await loadFeeds(exchange.id);
      } else if (initialTab === 1 && !contacts[exchange.id]) {
        await loadContacts(exchange.id);
      }
    }
  };

  // Exchange handlers
  const handleAddExchange = () => {
    setExchangeDialogMode('add');
    setSelectedExchange(null);
    setExchangeFormData({
      exchange_name: '',
      region: 'AMERs',
      available: true
    });
    setExchangeDialogOpen(true);
  };

  const handleEditExchange = (exchange) => {
    setExchangeDialogMode('edit');
    setSelectedExchange(exchange);
    setExchangeFormData({
      exchange_name: exchange.exchange_name,
      region: exchange.region,
      salesperson_assigned: exchange.salesperson_assigned || '',
      available: Boolean(exchange.available)
    });
    setExchangeDialogOpen(true);
  };

  const handleDeleteExchange = (exchange) => {
    setDeleteTarget({ type: 'exchange', item: exchange });
    setDeleteDialogOpen(true);
  };

  const handleExchangeSubmit = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      };

      if (exchangeDialogMode === 'add') {
        if (!exchangeFormData.exchange_name) {
          setError('Exchange name is required');
          return;
        }

        await axios.post('http://localhost:4000/exchanges', exchangeFormData, { headers });
        setSuccess('Exchange created successfully');
      } else {
        await axios.put(`http://localhost:4000/exchanges/${selectedExchange.id}`, exchangeFormData, { headers });
        setSuccess('Exchange updated successfully');
      }

      setExchangeDialogOpen(false);
      await loadExchanges();

    } catch (err) {
      setError('Failed to save exchange: ' + (err.response?.data?.error || err.message));
    }
  };

  // Feed handlers
  const handleAddFeed = async (exchange) => {
    setFeedDialogMode('add');
    setSelectedExchange(exchange);
    setSelectedFeed(null);
    setFeedFormData({
      feed_name: '',
      feed_delivery: 'Unicast',
      feed_type: 'equities',
      isf_enabled: false,
      isf_a: '',
      isf_b: '',
      isf_site_code_a: '',
      isf_site_code_b: '',
      isf_dr_a: '',
      isf_dr_b: '',
      isf_dr_site_code_a: '',
      isf_dr_site_code_b: '',
      dr_type: '',
      order_entry_isf: '',
      unicast_isf: '',
      dr_available: false,
      bandwidth_1ms: '',
      available_now: false,
      quick_quote: false,
      pass_through_fees: '',
      pass_through_currency: 'USD',
      more_info: '',
      design_file: null
    });
    
    // Refresh currencies to ensure sync with Exchange Rates
    await loadCurrencies();
    setFeedDialogOpen(true);
  };

  const handleEditFeed = async (exchange, feed) => {
    setFeedDialogMode('edit');
    setSelectedExchange(exchange);
    setSelectedFeed(feed);
    setFeedFormData({
      feed_name: feed.feed_name || '',
      feed_delivery: feed.feed_delivery || 'Unicast',
      feed_type: feed.feed_type || 'Equities',
      isf_enabled: Boolean(feed.isf_enabled),
      isf_a: feed.isf_a || '',
      isf_b: feed.isf_b || '',
      isf_site_code_a: feed.isf_site_code_a || '',
      isf_site_code_b: feed.isf_site_code_b || '',
      isf_dr_a: feed.isf_dr_a || '',
      isf_dr_b: feed.isf_dr_b || '',
      isf_dr_site_code_a: feed.isf_dr_site_code_a || '',
      isf_dr_site_code_b: feed.isf_dr_site_code_b || '',
      dr_type: feed.dr_type || '',
      order_entry_isf: feed.order_entry_isf || '',
      unicast_isf: feed.unicast_isf || '',
      dr_available: Boolean(feed.dr_available),
      bandwidth_1ms: feed.bandwidth_1ms || '',
      available_now: Boolean(feed.available_now),
      quick_quote: Boolean(feed.quick_quote),
      pass_through_fees: feed.pass_through_fees?.toString() || '',
      pass_through_currency: feed.pass_through_currency || 'USD',
      pass_through_fees_info: feed.pass_through_fees_info || '',
      more_info: feed.more_info || '',
      design_file: null
    });
    
    // Refresh currencies to ensure sync with Exchange Rates
    await loadCurrencies();
    setFeedDialogOpen(true);
  };

  const handleDeleteFeed = (exchange, feed) => {
    setSelectedExchange(exchange);
    setDeleteTarget({ type: 'feed', item: feed });
    setDeleteDialogOpen(true);
  };

  const handleFeedSubmit = async () => {
    try {
      if (!feedFormData.feed_name) {
        setError('Feed name is required');
        return;
      }
      
      if (!feedFormData.feed_delivery) {
        setError('Feed delivery is required');
        return;
      }
      
      if (!feedFormData.feed_type) {
        setError('Feed type is required');
        return;
      }

      // ISF validation: if enabled, at least one field must be filled
      if (feedFormData.isf_enabled) {
        const isfFields = [
          feedFormData.isf_a, feedFormData.isf_b, feedFormData.isf_site_code_a, feedFormData.isf_site_code_b,
          feedFormData.isf_dr_a, feedFormData.isf_dr_b, feedFormData.isf_dr_site_code_a, feedFormData.isf_dr_site_code_b,
          feedFormData.order_entry_isf, feedFormData.unicast_isf
        ];
        const hasISFData = isfFields.some(field => field && field.trim() !== '');
        
        if (!hasISFData) {
          setError('Please enter ISF details or disable ISF');
          return;
        }
      }

      const formData = new FormData();
      Object.keys(feedFormData).forEach(key => {
        if (key === 'design_file' && feedFormData[key]) {
          formData.append('design_file', feedFormData[key]);
        } else if (key !== 'design_file') {
          formData.append(key, feedFormData[key]);
        }
      });

      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      };

      if (feedDialogMode === 'add') {
        await axios.post(`http://localhost:4000/exchanges/${selectedExchange.id}/feeds`, formData, { headers });
        setSuccess('Exchange feed created successfully');
      } else {
        await axios.put(`http://localhost:4000/exchanges/${selectedExchange.id}/feeds/${selectedFeed.id}`, formData, { headers });
        setSuccess('Exchange feed updated successfully');
      }

      setFeedDialogOpen(false);
      await loadFeeds(selectedExchange.id);

    } catch (err) {
      setError('Failed to save feed: ' + (err.response?.data?.error || err.message));
    }
  };

  // Contact handlers
  const handleAddContact = (exchange) => {
    setContactDialogMode('add');
    setSelectedExchange(exchange);
    setSelectedContact(null);
    setContactFormData({
      contact_name: '',
      job_title: '',
      country: '',
      phone_number: '',
      email: '',
      contact_type: '',
      daily_contact: false,
      more_info: ''
    });
    setContactDialogOpen(true);
  };

  const handleEditContact = (exchange, contact) => {
    setContactDialogMode('edit');
    setSelectedExchange(exchange);
    setSelectedContact(contact);
    setContactFormData({
      contact_name: contact.contact_name || '',
      job_title: contact.job_title || '',
      country: contact.country || '',
      phone_number: contact.phone_number || '',
      email: contact.email || '',
      contact_type: contact.contact_type || '',
      daily_contact: Boolean(contact.daily_contact),
      more_info: contact.more_info || ''
    });
    setContactDialogOpen(true);
  };

  const handleDeleteContact = (exchange, contact) => {
    setSelectedExchange(exchange);
    setDeleteTarget({ type: 'contact', item: contact });
    setDeleteDialogOpen(true);
  };

  const handleContactSubmit = async () => {
    try {
      if (!contactFormData.contact_name) {
        setError('Contact name is required');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      };

      if (contactDialogMode === 'add') {
        await axios.post(`http://localhost:4000/exchanges/${selectedExchange.id}/contacts`, contactFormData, { headers });
        setSuccess('Exchange contact created successfully');
      } else {
        await axios.put(`http://localhost:4000/exchanges/${selectedExchange.id}/contacts/${selectedContact.id}`, contactFormData, { headers });
        setSuccess('Exchange contact updated successfully');
      }

      setContactDialogOpen(false);
      await loadContacts(selectedExchange.id);

    } catch (err) {
      setError('Failed to save contact: ' + (err.response?.data?.error || err.message));
    }
  };

  // Delete handler
  const handleConfirmDelete = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      };

      if (deleteTarget.type === 'exchange') {
        await axios.delete(`http://localhost:4000/exchanges/${deleteTarget.item.id}`, { headers });
        setSuccess('Exchange deleted successfully');
        await loadExchanges();
      } else if (deleteTarget.type === 'feed') {
        await axios.delete(`http://localhost:4000/exchanges/${selectedExchange.id}/feeds/${deleteTarget.item.id}`, { headers });
        setSuccess('Exchange feed deleted successfully');
        await loadFeeds(selectedExchange.id);
      } else if (deleteTarget.type === 'contact') {
        await axios.delete(`http://localhost:4000/exchanges/${selectedExchange.id}/contacts/${deleteTarget.item.id}`, { headers });
        setSuccess('Exchange contact deleted successfully');
        await loadContacts(selectedExchange.id);
      }

      setDeleteDialogOpen(false);
      setDeleteTarget(null);

    } catch (err) {
      setError('Failed to delete: ' + (err.response?.data?.error || err.message));
    }
  };

  // Utility functions
  const handleExchangeInputChange = (field, value) => {
    setExchangeFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFeedInputChange = (field, value) => {
    setFeedFormData(prev => ({
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

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are allowed');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setError('File size must be less than 2MB');
        return;
      }
      setFeedFormData(prev => ({
        ...prev,
        design_file: file
      }));
    }
  };

  const handleDownloadDesign = async (exchangeId, feedId) => {
    try {
      const response = await axios.get(`http://localhost:4000/exchanges/${exchangeId}/feeds/${feedId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `exchange_design_${feedId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download design file: ' + err.message);
    }
  };

  const handleMoreInfo = (content) => {
    setMoreInfoContent(content || 'No additional information available.');
    setMoreInfoDialogOpen(true);
  };

  const handleISFInfoOpen = (feed) => {
    setSelectedISFData(feed);
    setISFInfoDialogOpen(true);
  };

  const getStatusChip = (available) => {
    return available ? (
      <CheckCircleIcon sx={{ color: 'green', fontSize: 20 }} />
    ) : (
      <CancelIcon sx={{ color: 'red', fontSize: 20 }} />
    );
  };

  const getRegionChip = (region) => {
    const colors = {
      'AMERs': 'primary',
      'APAC': 'secondary',
      'EMEA': 'info'
    };
    return <Chip label={region} color={colors[region] || 'default'} size="small" />;
  };

  const renderDesignFileCell = (feed, exchangeId) => {
    if (feed.design_file_path) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon sx={{ color: 'green', fontSize: 16 }} />
          <Button
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => handleDownloadDesign(exchangeId, feed.id)}
          >
            Download
          </Button>
        </Box>
      );
    } else {
      return <CancelIcon sx={{ color: 'red', fontSize: 16 }} />;
    }
  };

  // Filter exchanges based on search and filters
  const filteredExchanges = exchanges.filter(exchange => {
    const matchesSearch = !searchText || exchange.exchange_name.toLowerCase().includes(searchText.toLowerCase());
    const matchesRegion = !filterRegion || exchange.region === filterRegion;
    const matchesAvailable = !filterAvailable || (filterAvailable === 'true' ? exchange.available : !exchange.available);
    
    return matchesSearch && matchesRegion && matchesAvailable;
  });

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2">
          Exchange Data
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {hasPermission && hasPermission('exchange_data', 'create') && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddExchange}
            >
              Add Exchange
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadExchanges}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Content based on sidebar navigation */}
      <Box sx={{ width: '100%' }}>
        {/* Search and Filter */}
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              label="Search Exchange"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by exchange name..."
              sx={{ minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Region</InputLabel>
              <Select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                label="Region"
              >
                <MenuItem value="">All Regions</MenuItem>
                {regions.map(region => (
                  <MenuItem key={region} value={region}>{region}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Available</InputLabel>
              <Select
                value={filterAvailable}
                onChange={(e) => setFilterAvailable(e.target.value)}
                label="Available"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Available</MenuItem>
                <MenuItem value="false">Not Available</MenuItem>
              </Select>
            </FormControl>
            {expandedExchange && initialTab === 0 && (
              <TextField
                size="small"
                label="Search Feeds"
                value={feedSearchText}
                onChange={(e) => setFeedSearchText(e.target.value)}
                placeholder="Search by feed name..."
                sx={{ minWidth: 200 }}
              />
            )}
          </Box>

          {/* Tabs only for Exchange Contacts module */}
          {initialTab === 1 && (
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
              <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
                <Tab label="Exchange Contacts" />
                <Tab 
                  label={
                    <Badge badgeContent={overdueContacts.length} color="warning">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningIcon fontSize="small" />
                        Overdue Contacts
                      </Box>
                    </Badge>
                  }
                />
              </Tabs>
            </Box>
          )}
        </Box>

        {/* Exchange Feeds View (initialTab === 0) */}
        {initialTab === 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Region</TableCell>
                  <TableCell>Exchange</TableCell>
                  <TableCell>Salesperson</TableCell>
                  <TableCell>Available</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredExchanges.map((exchange) => (
                  <React.Fragment key={exchange.id}>
                    <TableRow 
                      hover
                      onClick={() => handleExchangeRowClick(exchange)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{getRegionChip(exchange.region)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BusinessIcon />
                          <Typography variant="body1" fontWeight="bold">
                            {exchange.exchange_name}
                          </Typography>
                          {expandedExchange === exchange.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {exchange.salesperson_assigned || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>{getStatusChip(exchange.available)}</TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          {hasPermission && hasPermission('exchange_data', 'edit') && (
                            <>
                              <Tooltip title="Add Feed">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddFeed(exchange);
                                  }}
                                >
                                  <AddIcon />
                                </IconButton>
                              </Tooltip>
                              {hasPermission('exchange_data', 'create') && (
                                <Tooltip title="Edit Exchange">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditExchange(exchange);
                                    }}
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </>
                          )}
                          {hasPermission && hasPermission('exchange_data', 'delete') && (
                            <Tooltip title="Delete Exchange">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteExchange(exchange);
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Feeds Table */}
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
                        <Collapse in={expandedExchange === exchange.id} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1 }}>
                            <Typography variant="h6" gutterBottom component="div">
                              Exchange Feeds
                            </Typography>
                            {feeds[exchange.id] && feeds[exchange.id].length > 0 ? (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Feed Name</TableCell>
                                    <TableCell>Feed Delivery</TableCell>
                                    <TableCell>Feed Type</TableCell>
                                    <TableCell>ISF</TableCell>
                                    <TableCell>DR Available</TableCell>
                                    <TableCell>Bandwidth (1ms)</TableCell>
                                    <TableCell>Available Now</TableCell>
                                    <TableCell>Quick Quote</TableCell>
                                    <TableCell>Pass Through Fees</TableCell>
                                    <TableCell>Design</TableCell>
                                    <TableCell>More Info</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {feeds[exchange.id]
                                    .filter(feed => !feedSearchText || feed.feed_name.toLowerCase().includes(feedSearchText.toLowerCase()))
                                    .map((feed) => (
                                    <TableRow key={feed.id}>
                                      <TableCell>{feed.feed_name}</TableCell>
                                      <TableCell>{feed.feed_delivery || 'Unicast'}</TableCell>
                                      <TableCell>{feed.feed_type || 'Equities'}</TableCell>
                                      <TableCell>
                                        {feed.isf_enabled ? (
                                          <Tooltip title="Click to view ISF details">
                                            <IconButton 
                                              size="small" 
                                              onClick={() => handleISFInfoOpen(feed)}
                                              sx={{ color: 'green' }}
                                            >
                                              <CheckCircleIcon sx={{ fontSize: 20 }} />
                                            </IconButton>
                                          </Tooltip>
                                        ) : (
                                          <Typography variant="body2" color="text.secondary">-</Typography>
                                        )}
                                      </TableCell>
                                      <TableCell>{getStatusChip(feed.dr_available)}</TableCell>
                                      <TableCell>{feed.bandwidth_1ms || '-'}</TableCell>
                                      <TableCell>{getStatusChip(feed.available_now)}</TableCell>
                                      <TableCell>{getStatusChip(feed.quick_quote)}</TableCell>
                                      <TableCell>
                                        {feed.pass_through_fees ? (
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="body2">
                                              {`${feed.pass_through_fees} ${feed.pass_through_currency}`}
                                            </Typography>
                                            {feed.pass_through_fees_info && (
                                              <Tooltip title="Additional fees information available">
                                                <IconButton 
                                                  size="small" 
                                                  onClick={() => handleMoreInfo(feed.pass_through_fees_info)}
                                                  sx={{ p: 0.5 }}
                                                >
                                                  <InfoIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                                                </IconButton>
                                              </Tooltip>
                                            )}
                                          </Box>
                                        ) : '-'}
                                      </TableCell>
                                      <TableCell>{renderDesignFileCell(feed, exchange.id)}</TableCell>
                                      <TableCell>
                                        {feed.more_info ? (
                                          <IconButton size="small" onClick={() => handleMoreInfo(feed.more_info)}>
                                            <InfoIcon />
                                          </IconButton>
                                        ) : '-'}
                                      </TableCell>
                                      <TableCell align="center">
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                          {hasPermission && hasPermission('exchange_data', 'edit') && (
                                            <IconButton
                                              size="small"
                                              onClick={() => handleEditFeed(exchange, feed)}
                                            >
                                              <EditIcon />
                                            </IconButton>
                                          )}
                                          {hasPermission && hasPermission('exchange_data', 'edit') && (
                                            <IconButton
                                              size="small"
                                              onClick={() => handleDeleteFeed(exchange, feed)}
                                            >
                                              <DeleteIcon />
                                            </IconButton>
                                          )}
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No feeds found for this exchange.
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
        )}

        {/* Exchange Contacts View (initialTab === 1) */}
        {initialTab === 1 && (
          <>
            {/* Exchange Contacts Tab */}
            {currentTab === 0 && (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Region</TableCell>
                      <TableCell>Exchange</TableCell>
                      <TableCell>Available</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredExchanges.map((exchange) => (
                      <React.Fragment key={exchange.id}>
                        <TableRow 
                          hover
                          onClick={() => handleExchangeRowClick(exchange)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>{getRegionChip(exchange.region)}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ContactsIcon />
                              <Typography variant="body1" fontWeight="bold">
                                {exchange.exchange_name}
                              </Typography>
                              {expandedExchange === exchange.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </Box>
                          </TableCell>
                          <TableCell>{getStatusChip(exchange.available)}</TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              {hasPermission && hasPermission('exchange_data', 'edit') && (
                                <Tooltip title="Add Contact">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddContact(exchange);
                                    }}
                                  >
                                    <AddIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Contacts Table */}
                        <TableRow>
                          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={4}>
                            <Collapse in={expandedExchange === exchange.id} timeout="auto" unmountOnExit>
                              <Box sx={{ margin: 1 }}>
                                <Typography variant="h6" gutterBottom component="div">
                                  Exchange Contacts
                                </Typography>
                                {contacts[exchange.id] && contacts[exchange.id].length > 0 ? (
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Job Title</TableCell>
                                        <TableCell>Country</TableCell>
                                        <TableCell>Phone Number</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Contact Type</TableCell>
                                        <TableCell>Daily Contact</TableCell>
                                        <TableCell>Last Updated</TableCell>
                                        <TableCell>More Info</TableCell>
                                        <TableCell align="center">Actions</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {contacts[exchange.id].map((contact) => (
                                        <TableRow key={contact.id}>
                                          <TableCell>{contact.contact_name}</TableCell>
                                          <TableCell>{contact.job_title || '-'}</TableCell>
                                          <TableCell>{contact.country || '-'}</TableCell>
                                          <TableCell>{contact.phone_number || '-'}</TableCell>
                                          <TableCell>{contact.email || '-'}</TableCell>
                                          <TableCell>{contact.contact_type || '-'}</TableCell>
                                          <TableCell>{getStatusChip(contact.daily_contact)}</TableCell>
                                          <TableCell>
                                            {contact.last_updated ? 
                                              new Date(contact.last_updated).toLocaleDateString() : 
                                              (contact.created_at ? new Date(contact.created_at).toLocaleDateString() : '-')
                                            }
                                          </TableCell>
                                          <TableCell>
                                            {contact.more_info ? (
                                              <IconButton size="small" onClick={() => handleMoreInfo(contact.more_info)}>
                                                <InfoIcon />
                                              </IconButton>
                                            ) : '-'}
                                          </TableCell>
                                          <TableCell align="center">
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                              {hasPermission && hasPermission('exchange_data', 'edit') && (
                                                <IconButton
                                                  size="small"
                                                  onClick={() => handleEditContact(exchange, contact)}
                                                >
                                                  <EditIcon />
                                                </IconButton>
                                              )}
                                              {hasPermission && hasPermission('exchange_data', 'edit') && (
                                                <IconButton
                                                  size="small"
                                                  onClick={() => handleDeleteContact(exchange, contact)}
                                                >
                                                  <DeleteIcon />
                                                </IconButton>
                                              )}
                                            </Box>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No contacts found for this exchange.
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
            )}

            {/* Overdue Contacts Tab */}
            {currentTab === 1 && (
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Exchange</TableCell>
                      <TableCell>Contact Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Days Overdue</TableCell>
                      <TableCell>Last Updated</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {overdueContacts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                            No overdue contacts found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      overdueContacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell>{contact.exchange_name}</TableCell>
                          <TableCell>{contact.contact_name}</TableCell>
                          <TableCell>{contact.email}</TableCell>
                          <TableCell>{contact.phone || '-'}</TableCell>
                          <TableCell>{contact.role || '-'}</TableCell>
                          <TableCell>
                            <Chip 
                              label={`${contact.days_overdue} days`}
                              color="warning" 
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(contact.last_contact_updated).toLocaleDateString()}
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Mark as updated (approve for another year)">
                              <IconButton 
                                size="small" 
                                onClick={() => handleApproveContact(contact.id)}
                                sx={{ color: 'green' }}
                              >
                                <CheckIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </Box>

      {/* Exchange Dialog */}
      <Dialog open={exchangeDialogOpen} onClose={() => setExchangeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {exchangeDialogMode === 'add' ? 'Add Exchange' : 'Edit Exchange'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Exchange Name *"
                value={exchangeFormData.exchange_name}
                onChange={(e) => handleExchangeInputChange('exchange_name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Salesperson Assigned"
                value={exchangeFormData.salesperson_assigned}
                onChange={(e) => handleExchangeInputChange('salesperson_assigned', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Region</InputLabel>
                <Select
                  value={exchangeFormData.region}
                  onChange={(e) => handleExchangeInputChange('region', e.target.value)}
                  label="Region"
                >
                  {regions.map(region => (
                    <MenuItem key={region} value={region}>{region}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={exchangeFormData.available}
                    onChange={(e) => handleExchangeInputChange('available', e.target.checked)}
                  />
                }
                label="Available"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExchangeDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleExchangeSubmit} variant="contained">
            {exchangeDialogMode === 'add' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feed Dialog */}
      <Dialog open={feedDialogOpen} onClose={() => setFeedDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {feedDialogMode === 'add' ? 'Add Exchange Feed' : 'Edit Exchange Feed'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Feed Name *"
                value={feedFormData.feed_name}
                onChange={(e) => handleFeedInputChange('feed_name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Feed Delivery *</InputLabel>
                <Select
                  value={feedFormData.feed_delivery}
                  onChange={(e) => handleFeedInputChange('feed_delivery', e.target.value)}
                  label="Feed Delivery *"
                >
                  <MenuItem value="Unicast">Unicast</MenuItem>
                  <MenuItem value="Multicast">Multicast</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Feed Type *</InputLabel>
                <Select
                  value={feedFormData.feed_type}
                  onChange={(e) => handleFeedInputChange('feed_type', e.target.value)}
                  label="Feed Type *"
                >
                  <MenuItem value="Equities">Equities</MenuItem>
                  <MenuItem value="Futures">Futures</MenuItem>
                  <MenuItem value="Options">Options</MenuItem>
                  <MenuItem value="Fixed Income">Fixed Income</MenuItem>
                  <MenuItem value="FX">FX</MenuItem>
                  <MenuItem value="Commodities">Commodities</MenuItem>
                  <MenuItem value="Indices">Indices</MenuItem>
                  <MenuItem value="ETFs">ETFs</MenuItem>
                  <MenuItem value="Alternative Data">Alternative Data</MenuItem>
                  <MenuItem value="Reference Data">Reference Data</MenuItem>
                  <MenuItem value="Mixed">Mixed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={feedFormData.isf_enabled}
                    onChange={(e) => handleFeedInputChange('isf_enabled', e.target.checked)}
                  />
                }
                label="ISF Enabled"
              />
            </Grid>
            {feedFormData.isf_enabled && (
              <>
                {/* Multicast ISF Fields */}
                {feedFormData.feed_delivery === 'Multicast' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="ISF A"
                        value={feedFormData.isf_a}
                        onChange={(e) => handleFeedInputChange('isf_a', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Site Code A"
                        value={feedFormData.isf_site_code_a}
                        onChange={(e) => handleFeedInputChange('isf_site_code_a', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="ISF B"
                        value={feedFormData.isf_b}
                        onChange={(e) => handleFeedInputChange('isf_b', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Site Code B"
                        value={feedFormData.isf_site_code_b}
                        onChange={(e) => handleFeedInputChange('isf_site_code_b', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="ISF DR A"
                        value={feedFormData.isf_dr_a}
                        onChange={(e) => handleFeedInputChange('isf_dr_a', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Site Code ISF A"
                        value={feedFormData.isf_dr_site_code_a}
                        onChange={(e) => handleFeedInputChange('isf_dr_site_code_a', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="ISF DR B"
                        value={feedFormData.isf_dr_b}
                        onChange={(e) => handleFeedInputChange('isf_dr_b', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Site Code ISF B"
                        value={feedFormData.isf_dr_site_code_b}
                        onChange={(e) => handleFeedInputChange('isf_dr_site_code_b', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>DR Type (Cold or Live)</InputLabel>
                        <Select
                          value={feedFormData.dr_type}
                          onChange={(e) => handleFeedInputChange('dr_type', e.target.value)}
                          label="DR Type (Cold or Live)"
                        >
                          <MenuItem value="">None</MenuItem>
                          <MenuItem value="Cold">Cold</MenuItem>
                          <MenuItem value="Live">Live</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Order Entry ISF"
                        value={feedFormData.order_entry_isf}
                        onChange={(e) => handleFeedInputChange('order_entry_isf', e.target.value)}
                      />
                    </Grid>
                  </>
                )}

                {/* Unicast ISF Field */}
                {feedFormData.feed_delivery === 'Unicast' && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Unicast ISF"
                      value={feedFormData.unicast_isf}
                      onChange={(e) => handleFeedInputChange('unicast_isf', e.target.value)}
                    />
                  </Grid>
                )}
              </>
            )}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Bandwidth (1ms)"
                value={feedFormData.bandwidth_1ms}
                onChange={(e) => handleFeedInputChange('bandwidth_1ms', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Pass Through Fees"
                type="number"
                value={feedFormData.pass_through_fees}
                onChange={(e) => handleFeedInputChange('pass_through_fees', e.target.value)}
                inputProps={{ min: 0, step: 1 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Autocomplete
                  options={currencies}
                  getOptionLabel={(option) => `${option.currency_code} - ${option.currency_name}`}
                  value={currencies.find(curr => curr.currency_code === feedFormData.pass_through_currency) || null}
                  onChange={(event, newValue) => {
                    handleFeedInputChange('pass_through_currency', newValue ? newValue.currency_code : 'USD');
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Currency" helperText="Synced with Exchange Rates" />
                  )}
                  sx={{ flex: 1 }}
                />
                <Tooltip title="Refresh currencies from Exchange Rates">
                  <IconButton 
                    onClick={refreshCurrencies}
                    sx={{ mt: 1 }}
                    size="small"
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Pass Through Fees - Additional Info"
                multiline
                rows={2}
                value={feedFormData.pass_through_fees_info}
                onChange={(e) => handleFeedInputChange('pass_through_fees_info', e.target.value)}
                helperText="Optional additional information about pass through fees (displayed as popup)"
                placeholder="Enter details about pass through fees, terms, conditions, etc."
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={feedFormData.dr_available}
                    onChange={(e) => handleFeedInputChange('dr_available', e.target.checked)}
                  />
                }
                label="DR Available"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={feedFormData.available_now}
                    onChange={(e) => handleFeedInputChange('available_now', e.target.checked)}
                  />
                }
                label="Available Now"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={feedFormData.quick_quote}
                    onChange={(e) => handleFeedInputChange('quick_quote', e.target.checked)}
                  />
                }
                label="Quick Quote"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<AttachFileIcon />}
                sx={{ height: '56px' }}
              >
                {feedFormData.design_file ? feedFormData.design_file.name : 'Upload PDF Design'}
                <input
                  type="file"
                  hidden
                  accept=".pdf"
                  onChange={handleFileChange}
                />
              </Button>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="More Info"
                multiline
                rows={3}
                value={feedFormData.more_info}
                onChange={(e) => handleFeedInputChange('more_info', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeedDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleFeedSubmit} variant="contained">
            {feedDialogMode === 'add' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onClose={() => setContactDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {contactDialogMode === 'add' ? 'Add Exchange Contact' : 'Edit Exchange Contact'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Name *"
                value={contactFormData.contact_name}
                onChange={(e) => handleContactInputChange('contact_name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Job Title"
                value={contactFormData.job_title}
                onChange={(e) => handleContactInputChange('job_title', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Country"
                value={contactFormData.country}
                onChange={(e) => handleContactInputChange('country', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                value={contactFormData.phone_number}
                onChange={(e) => handleContactInputChange('phone_number', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={contactFormData.email}
                onChange={(e) => handleContactInputChange('email', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact Type"
                value={contactFormData.contact_type}
                onChange={(e) => handleContactInputChange('contact_type', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={contactFormData.daily_contact}
                    onChange={(e) => handleContactInputChange('daily_contact', e.target.checked)}
                  />
                }
                label="Daily Contact"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="More Info"
                multiline
                rows={3}
                value={contactFormData.more_info}
                onChange={(e) => handleContactInputChange('more_info', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleContactSubmit} variant="contained">
            {contactDialogMode === 'add' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* More Info Dialog */}
      <Dialog open={moreInfoDialogOpen} onClose={() => setMoreInfoDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>More Information</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
            {moreInfoContent}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoreInfoDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ISF Info Dialog */}
      <Dialog open={isfInfoDialogOpen} onClose={() => setISFInfoDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>ISF Information</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* ISF A Fields */}
            {selectedISFData?.isf_a && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="ISF A"
                  value={selectedISFData.isf_a}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}
            {selectedISFData?.isf_site_code_a && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Site Code A"
                  value={selectedISFData.isf_site_code_a}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}
            
            {/* ISF B Fields */}
            {selectedISFData?.isf_b && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="ISF B"
                  value={selectedISFData.isf_b}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}
            {selectedISFData?.isf_site_code_b && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Site Code B"
                  value={selectedISFData.isf_site_code_b}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}
            
            {/* ISF DR A Fields */}
            {selectedISFData?.isf_dr_a && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="ISF DR A"
                  value={selectedISFData.isf_dr_a}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}
            {selectedISFData?.isf_dr_site_code_a && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Site Code ISF A"
                  value={selectedISFData.isf_dr_site_code_a}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}
            
            {/* ISF DR B Fields */}
            {selectedISFData?.isf_dr_b && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="ISF DR B"
                  value={selectedISFData.isf_dr_b}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}
            {selectedISFData?.isf_dr_site_code_b && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Site Code ISF B"
                  value={selectedISFData.isf_dr_site_code_b}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}
            
            {/* DR Type */}
            {selectedISFData?.dr_type && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="DR Type"
                  value={selectedISFData.dr_type}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}
            
            {/* Order Entry ISF */}
            {selectedISFData?.order_entry_isf && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Order Entry ISF"
                  value={selectedISFData.order_entry_isf}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}
            
            {/* Unicast ISF */}
            {selectedISFData?.unicast_isf && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Unicast ISF"
                  value={selectedISFData.unicast_isf}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}
            
            {/* No ISF data message */}
            {!selectedISFData?.isf_a && !selectedISFData?.isf_b && !selectedISFData?.isf_site_code_a && 
             !selectedISFData?.isf_site_code_b && !selectedISFData?.isf_dr_a && !selectedISFData?.isf_dr_b &&
             !selectedISFData?.isf_dr_site_code_a && !selectedISFData?.isf_dr_site_code_b && 
             !selectedISFData?.order_entry_isf && !selectedISFData?.unicast_isf && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No ISF information available
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setISFInfoDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this {deleteTarget?.type}? This action cannot be undone.
            {deleteTarget?.type === 'exchange' && ' This will also delete all associated feeds and contacts.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ExchangeDataManager; 