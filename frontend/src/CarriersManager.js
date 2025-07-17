import React, { useState, useEffect } from 'react';
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
import axios from 'axios';
import { useAuth } from './AuthContext';

const CarriersManager = ({ hasPermission }) => {
  const { user } = useAuth();
  const [carriers, setCarriers] = useState([]);
  const [contacts, setContacts] = useState({});
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

  const loadCarriers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:4000/carriers', {
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
      const response = await axios.get('http://localhost:4000/carriers/overdue-contacts', {
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
      const response = await axios.get(`http://localhost:4000/carriers/${carrierId}/contacts`, {
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
    setContactDialogOpen(true);
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

        await axios.post('http://localhost:4000/carriers', carrierFormData, { headers });
        setSuccess('Carrier created successfully');
      } else {
        await axios.put(`http://localhost:4000/carriers/${selectedCarrier.id}`, carrierFormData, { headers });
        setSuccess('Carrier updated successfully');
      }

      setCarrierDialogOpen(false);
      await loadCarriers();

    } catch (err) {
      setError('Failed to save carrier: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleContactSubmit = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      };

      if (contactDialogMode === 'add') {
        await axios.post(`http://localhost:4000/carriers/${selectedCarrier.id}/contacts`, contactFormData, { headers });
        setSuccess('Contact created successfully');
      } else {
        await axios.put(`http://localhost:4000/carriers/${selectedCarrier.id}/contacts/${selectedContact.id}`, contactFormData, { headers });
        setSuccess('Contact updated successfully');
      }

      setContactDialogOpen(false);
      await loadContacts(selectedCarrier.id);

    } catch (err) {
      setError('Failed to save contact: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCarrierDeleteConfirm = async () => {
    try {
      await axios.delete(`http://localhost:4000/carriers/${selectedCarrier.id}`, {
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
      await axios.delete(`http://localhost:4000/carriers/${selectedCarrier.id}/contacts/${selectedContact.id}`, {
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
      await axios.post(`http://localhost:4000/carriers/${carrierId}/contacts/${contactId}/approve`, {}, {
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
      'AMERs': 'primary',
      'APAC': 'secondary',
      'EMEA': 'info'
    };
    return <Chip label={region} color={colors[region] || 'default'} size="small" />;
  };

  const canViewOverdueContacts = () => {
    return user?.role === 'administrator' || user?.role === 'provisioner';
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
            {carriers.map((carrier) => (
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
                        <Typography variant="body1" fontWeight="bold">
                          {carrier.carrier_name}
                        </Typography>
                        {carrier.previously_known_as && (
                          <Typography variant="caption" color="text.secondary">
                            Previously: {carrier.previously_known_as}
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
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                </TableRow>
                
                {/* Contact Details Dropdown */}
                <TableRow>
                  <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                    <Collapse in={expandedCarrier === carrier.id} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6" component="h3">
                            Contact Details
                          </Typography>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<ContactsIcon />}
                            onClick={() => handleAddContact(carrier)}
                          >
                            Add Contact
                          </Button>
                        </Box>
                        
                        {contacts[carrier.id] && contacts[carrier.id].length > 0 ? (
                          <TableContainer component={Paper} sx={{ mt: 1 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Type</TableCell>
                                  <TableCell>Level</TableCell>
                                  <TableCell>Name</TableCell>
                                  <TableCell>Function</TableCell>
                                  <TableCell>Email</TableCell>
                                  <TableCell>Phone</TableCell>
                                  <TableCell>Last Updated</TableCell>
                                  <TableCell>Notes</TableCell>
                                  <TableCell align="center">Actions</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {contacts[carrier.id].map((contact) => (
                                  <TableRow key={contact.id}>
                                    <TableCell>{contact.contact_type}</TableCell>
                                    <TableCell>{contact.contact_level}</TableCell>
                                    <TableCell>{contact.contact_name}</TableCell>
                                    <TableCell>{contact.contact_function}</TableCell>
                                    <TableCell>{contact.contact_email}</TableCell>
                                    <TableCell>{contact.contact_phone}</TableCell>
                                    <TableCell>
                                      <Typography variant="body2">
                                        {formatLastUpdated(contact.last_updated)}
                                      </Typography>
                                      {contact.last_updated && (
                                        <Typography variant="caption" color="text.secondary">
                                          {Math.floor((new Date() - new Date(contact.last_updated)) / (1000 * 60 * 60 * 24))} days ago
                                        </Typography>
                                      )}
                                    </TableCell>
                                    <TableCell>{contact.notes}</TableCell>
                                    <TableCell align="center">
                                      <Tooltip title="Edit">
                                        <IconButton 
                                          size="small" 
                                          onClick={() => handleEditContact(carrier, contact)}
                                        >
                                          <EditIcon />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Delete">
                                        <IconButton 
                                          size="small" 
                                          onClick={() => handleDeleteContact(carrier, contact)}
                                          color="error"
                                        >
                                          <DeleteIcon />
                                        </IconButton>
                                      </Tooltip>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
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
            <Typography variant="body2" color="text.secondary">
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
                    <TableCell>Contact Function</TableCell>
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
                        <Typography variant="body2" fontWeight="bold">
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
                          <Tooltip title="Approve yearly update">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleApproveContact(contact.carrier_id, contact.id)}
                            >
                              <CheckIcon />
                            </IconButton>
                          </Tooltip>
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
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
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
                label="Previously Known As"
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
              <TextField
                fullWidth
                label="Contact Type"
                value={contactFormData.contact_type}
                onChange={(e) => handleContactInputChange('contact_type', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact Level"
                value={contactFormData.contact_level}
                onChange={(e) => handleContactInputChange('contact_level', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact Name"
                value={contactFormData.contact_name}
                onChange={(e) => handleContactInputChange('contact_name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact Function"
                value={contactFormData.contact_function}
                onChange={(e) => handleContactInputChange('contact_function', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact Email"
                type="email"
                value={contactFormData.contact_email}
                onChange={(e) => handleContactInputChange('contact_email', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact Phone"
                value={contactFormData.contact_phone}
                onChange={(e) => handleContactInputChange('contact_phone', e.target.value)}
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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
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