import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip,
  Alert, Snackbar, Tooltip, Grid, FormControl, InputLabel, Select, MenuItem, Collapse,
  FormControlLabel, Switch, DialogContentText, Tabs, Tab, Badge
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContactsIcon from '@mui/icons-material/Contacts';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import CheckIcon from '@mui/icons-material/Check';
import { API_BASE_URL } from './config';
import axios from 'axios';
import LoadingIndicator from './components/LoadingIndicator';
import { ValidatedTextField, createValidator, scrollToFirstError } from './components/FormValidation';

const PERMISSION_MODULE = 'market_data_contacts';

const MarketDataContactsManager = ({ hasPermission }) => {
  const [organizations, setOrganizations] = useState([]);
  const [contacts, setContacts] = useState({});
  const [overdueContacts, setOverdueContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedOrg, setExpandedOrg] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);

  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [moreInfoDialogOpen, setMoreInfoDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orgDialogMode, setOrgDialogMode] = useState('add');
  const [contactDialogMode, setContactDialogMode] = useState('add');

  const [selectedOrg, setSelectedOrg] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [moreInfoContent, setMoreInfoContent] = useState('');

  const [searchText, setSearchText] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterAvailable, setFilterAvailable] = useState('');
  const [filterType, setFilterType] = useState('');

  const [orgFormData, setOrgFormData] = useState({
    organization_name: '',
    organization_type: 'exchange',
    region: 'AMERs',
    salesperson_assigned: '',
    available: true
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

  const [contactErrors, setContactErrors] = useState({});
  const [orgErrors, setOrgErrors] = useState({});

  const contactValidationRules = {
    contact_name: { type: 'required', message: 'Contact Name is required' },
    job_title: { type: 'required', message: 'Job Title is required' },
    contact_type: { type: 'required', message: 'Contact Type is required' },
    phone_number: {
      type: 'oneOf',
      fields: ['phone_number', 'email'],
      message: 'Either Phone Number or Email is required'
    },
    email: {
      type: 'oneOf',
      fields: ['phone_number', 'email'],
      message: 'Either Phone Number or Email is required'
    }
  };

  const orgValidationRules = {
    organization_name: { type: 'required', message: 'Organization Name is required' },
    region: { type: 'required', message: 'Region is required' },
    organization_type: { type: 'required', message: 'Type is required' }
  };

  const validateContact = createValidator(contactValidationRules);
  const validateOrg = createValidator(orgValidationRules);
  const regions = ['AMERs', 'APAC', 'EMEA'];

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('authToken')}`
  });

  useEffect(() => {
    loadOrganizations();
    loadOverdueContacts();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchText) params.append('search', searchText);
      if (filterRegion) params.append('region', filterRegion);
      if (filterAvailable) params.append('available', filterAvailable);
      if (filterType) params.append('organization_type', filterType);

      const response = await axios.get(`${API_BASE_URL}/market-data/organizations?${params}`, {
        headers: authHeaders()
      });
      setOrganizations(response.data);
    } catch (err) {
      setError('Failed to load organizations: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async (orgId) => {
    try {
      setContactsLoading((prev) => ({ ...prev, [orgId]: true }));
      const response = await axios.get(`${API_BASE_URL}/market-data/organizations/${orgId}/contacts`, {
        headers: authHeaders()
      });
      setContacts((prev) => ({ ...prev, [orgId]: response.data }));
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setContactsLoading((prev) => ({ ...prev, [orgId]: false }));
    }
  };

  const loadOverdueContacts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/market-data/overdue-contacts`, {
        headers: authHeaders()
      });
      setOverdueContacts(response.data);
    } catch (err) {
      console.error('Failed to load overdue contacts:', err);
    }
  };

  const handleApproveContact = async (contact) => {
    try {
      await axios.post(
        `${API_BASE_URL}/market-data/organizations/${contact.organization_id}/contacts/${contact.id}/approve`,
        {},
        { headers: authHeaders() }
      );
      setSuccess('Contact approved successfully');
      await loadOverdueContacts();
    } catch (err) {
      setError('Failed to approve contact: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleOrgRowClick = async (org) => {
    if (expandedOrg === org.id) {
      setExpandedOrg(null);
    } else {
      setExpandedOrg(org.id);
      if (!contacts[org.id]) {
        await loadContacts(org.id);
      }
    }
  };

  const normalizeText = (text) => {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  };

  const handleAddOrg = () => {
    setOrgDialogMode('add');
    setSelectedOrg(null);
    setOrgFormData({
      organization_name: '',
      organization_type: 'exchange',
      region: 'AMERs',
      salesperson_assigned: '',
      available: true
    });
    setOrgErrors({});
    setOrgDialogOpen(true);
  };

  const handleEditOrg = (org) => {
    setOrgDialogMode('edit');
    setSelectedOrg(org);
    setOrgFormData({
      organization_name: org.organization_name,
      organization_type: org.organization_type,
      region: org.region,
      salesperson_assigned: org.salesperson_assigned || '',
      available: Boolean(org.available)
    });
    setOrgErrors({});
    setOrgDialogOpen(true);
  };

  const handleDeleteOrg = (org) => {
    setDeleteTarget({ type: 'organization', item: org });
    setDeleteDialogOpen(true);
  };

  const handleOrgSubmit = async () => {
    try {
      const errors = validateOrg(orgFormData);
      setOrgErrors(errors);
      if (Object.keys(errors).length > 0) {
        scrollToFirstError(errors);
        return;
      }

      const normalizedName = normalizeText(orgFormData.organization_name);
      const duplicate = organizations.find((org) =>
        (orgDialogMode === 'add' || org.id !== selectedOrg?.id) &&
        normalizeText(org.organization_name) === normalizedName &&
        org.organization_type === orgFormData.organization_type &&
        org.region === orgFormData.region
      );
      if (duplicate) {
        setError(`An organization named "${orgFormData.organization_name}" already exists for that type and region.`);
        return;
      }

      const headers = { ...authHeaders(), 'Content-Type': 'application/json' };
      if (orgDialogMode === 'add') {
        await axios.post(`${API_BASE_URL}/market-data/organizations`, orgFormData, { headers });
        setSuccess('Organization created successfully');
      } else {
        await axios.put(`${API_BASE_URL}/market-data/organizations/${selectedOrg.id}`, orgFormData, { headers });
        setSuccess('Organization updated successfully');
      }

      setOrgDialogOpen(false);
      await loadOrganizations();
    } catch (err) {
      setError('Failed to save organization: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAddContact = (org) => {
    setContactDialogMode('add');
    setSelectedOrg(org);
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
    setContactErrors({});
    setContactDialogOpen(true);
  };

  const handleEditContact = (org, contact) => {
    setContactDialogMode('edit');
    setSelectedOrg(org);
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
    setContactErrors({});
    setContactDialogOpen(true);
  };

  const handleDeleteContact = (org, contact) => {
    setSelectedOrg(org);
    setDeleteTarget({ type: 'contact', item: contact });
    setDeleteDialogOpen(true);
  };

  const handleContactSubmit = async () => {
    try {
      const errors = validateContact(contactFormData);
      setContactErrors(errors);
      if (Object.keys(errors).length > 0) {
        scrollToFirstError(errors);
        return;
      }

      const headers = { ...authHeaders(), 'Content-Type': 'application/json' };
      if (contactDialogMode === 'add') {
        await axios.post(`${API_BASE_URL}/market-data/organizations/${selectedOrg.id}/contacts`, contactFormData, { headers });
        setSuccess('Contact created successfully');
      } else {
        await axios.put(
          `${API_BASE_URL}/market-data/organizations/${selectedOrg.id}/contacts/${selectedContact.id}`,
          contactFormData,
          { headers }
        );
        setSuccess('Contact updated successfully');
      }

      setContactDialogOpen(false);
      setContactErrors({});
      await loadContacts(selectedOrg.id);
      await loadOverdueContacts();
    } catch (err) {
      setError('Failed to save contact: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleConfirmDelete = async () => {
    try {
      const headers = authHeaders();
      if (deleteTarget.type === 'organization') {
        await axios.delete(`${API_BASE_URL}/market-data/organizations/${deleteTarget.item.id}`, { headers });
        setSuccess('Organization deleted successfully');
        setExpandedOrg(null);
        await loadOrganizations();
      } else if (deleteTarget.type === 'contact') {
        await axios.delete(
          `${API_BASE_URL}/market-data/organizations/${selectedOrg.id}/contacts/${deleteTarget.item.id}`,
          { headers }
        );
        setSuccess('Contact deleted successfully');
        await loadContacts(selectedOrg.id);
        await loadOverdueContacts();
      }
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      setError('Failed to delete: ' + (err.response?.data?.error || err.message));
    }
  };

  const formatTrackingDate = (value) => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const getStatusChip = (available) => (
    available ? (
      <CheckCircleIcon sx={{ color: 'green', fontSize: 20 }} />
    ) : (
      <CancelIcon sx={{ color: 'red', fontSize: 20 }} />
    )
  );

  const getRegionChip = (region) => {
    const colors = { AMERs: 'primary', APAC: 'success', EMEA: 'secondary' };
    return <Chip label={region} color={colors[region] || 'default'} size="small" />;
  };

  const getTypeChip = (type) => (
    <Chip
      label={type === 'extranet' ? 'Extranet' : 'Exchange'}
      size="small"
      variant="outlined"
      color={type === 'extranet' ? 'warning' : 'info'}
    />
  );

  const filteredOrganizations = organizations.filter((org) => {
    const matchesSearch = !searchText || org.organization_name.toLowerCase().includes(searchText.toLowerCase());
    const matchesRegion = !filterRegion || org.region === filterRegion;
    const matchesAvailable = !filterAvailable || (filterAvailable === 'true' ? org.available : !org.available);
    const matchesType = !filterType || org.organization_type === filterType;
    return matchesSearch && matchesRegion && matchesAvailable && matchesType;
  });

  if (loading) {
    return <LoadingIndicator message="Loading Market Data & Extranet contacts..." />;
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2">
          Market Data & Extranet Contacts
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {hasPermission && hasPermission(PERMISSION_MODULE, 'create') && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddOrg}>
              Add Organization
            </Button>
          )}
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadOrganizations}>
            Refresh
          </Button>
        </Box>
      </Box>

      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Search Organization"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by name..."
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} label="Type">
              <MenuItem value="">All Types</MenuItem>
              <MenuItem value="exchange">Exchange</MenuItem>
              <MenuItem value="extranet">Extranet</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Region</InputLabel>
            <Select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} label="Region">
              <MenuItem value="">All Regions</MenuItem>
              {regions.map((region) => (
                <MenuItem key={region} value={region}>{region}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Available</InputLabel>
            <Select value={filterAvailable} onChange={(e) => setFilterAvailable(e.target.value)} label="Available">
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Available</MenuItem>
              <MenuItem value="false">Not Available</MenuItem>
            </Select>
          </FormControl>
          <Button size="small" variant="outlined" onClick={loadOrganizations}>Apply Filters</Button>
        </Box>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
          <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
            <Tab label="Contacts" />
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
      </Box>

      {currentTab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Region</TableCell>
                <TableCell>Organization</TableCell>
                <TableCell>Salesperson</TableCell>
                <TableCell>Available</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrganizations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, fontSize: '0.75rem' }}>
                      No organizations found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrganizations.map((org) => (
                  <React.Fragment key={org.id}>
                    <TableRow hover onClick={() => handleOrgRowClick(org)} sx={{ cursor: 'pointer' }}>
                      <TableCell>{getTypeChip(org.organization_type)}</TableCell>
                      <TableCell>{getRegionChip(org.region)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ContactsIcon />
                          <Typography variant="body1" fontWeight="bold" sx={{ fontSize: '0.875rem' }}>
                            {org.organization_name}
                          </Typography>
                          {expandedOrg === org.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {org.salesperson_assigned || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>{getStatusChip(org.available)}</TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          {hasPermission && hasPermission(PERMISSION_MODULE, 'edit') && (
                            <>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddContact(org);
                                }}
                              >
                                Add Contact
                              </Button>
                              <Tooltip title="Edit Organization">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditOrg(org);
                                  }}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {hasPermission && hasPermission(PERMISSION_MODULE, 'delete') && (
                            <Tooltip title="Delete Organization">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteOrg(org);
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                        <Collapse in={expandedOrg === org.id} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1 }}>
                            <Typography variant="h6" gutterBottom component="div">
                              Contacts
                            </Typography>
                            {contactsLoading[org.id] ? (
                              <LoadingIndicator message="Loading contacts..." size={16} sx={{ p: 1 }} />
                            ) : contacts[org.id] && contacts[org.id].length > 0 ? (
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
                                  {contacts[org.id].map((contact) => (
                                    <TableRow key={contact.id}>
                                      <TableCell>{contact.contact_name}</TableCell>
                                      <TableCell>{contact.job_title || '-'}</TableCell>
                                      <TableCell>{contact.country || '-'}</TableCell>
                                      <TableCell>{contact.phone_number || '-'}</TableCell>
                                      <TableCell>{contact.email || '-'}</TableCell>
                                      <TableCell>{contact.contact_type || '-'}</TableCell>
                                      <TableCell>{getStatusChip(contact.daily_contact)}</TableCell>
                                      <TableCell>
                                        <Box>
                                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                            {formatTrackingDate(contact.updated_date || contact.last_updated || contact.created_at)}
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                                            {contact.username || 'Unknown User'}
                                          </Typography>
                                        </Box>
                                      </TableCell>
                                      <TableCell>
                                        {contact.more_info ? (
                                          <IconButton
                                            size="small"
                                            onClick={() => {
                                              setMoreInfoContent(contact.more_info);
                                              setMoreInfoDialogOpen(true);
                                            }}
                                          >
                                            <InfoIcon />
                                          </IconButton>
                                        ) : '-'}
                                      </TableCell>
                                      <TableCell align="center">
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                          {hasPermission && hasPermission(PERMISSION_MODULE, 'edit') && (
                                            <IconButton size="small" onClick={() => handleEditContact(org, contact)}>
                                              <EditIcon />
                                            </IconButton>
                                          )}
                                          {hasPermission && hasPermission(PERMISSION_MODULE, 'edit') && (
                                            <IconButton size="small" onClick={() => handleDeleteContact(org, contact)}>
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
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                No contacts found for this organization.
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
      )}

      {currentTab === 1 && (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Organization</TableCell>
                <TableCell>Contact Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Job Title</TableCell>
                <TableCell>Days Overdue</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overdueContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, fontSize: '0.75rem' }}>
                      No overdue contacts found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                overdueContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>{getTypeChip(contact.organization_type)}</TableCell>
                    <TableCell>{contact.organization_name}</TableCell>
                    <TableCell>{contact.contact_name}</TableCell>
                    <TableCell>{contact.email || '-'}</TableCell>
                    <TableCell>{contact.phone_number || '-'}</TableCell>
                    <TableCell>{contact.job_title || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${Math.floor(contact.days_since_update)} days`}
                        color="warning"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {formatTrackingDate(contact.last_updated || contact.updated_date || contact.created_at)}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Mark as updated (approve for another year)">
                        <IconButton
                          size="small"
                          onClick={() => handleApproveContact(contact)}
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

      <Dialog open={orgDialogOpen} onClose={() => setOrgDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{orgDialogMode === 'add' ? 'Add Organization' : 'Edit Organization'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <ValidatedTextField
                fullWidth
                label="Organization Name *"
                field="organization_name"
                errors={orgErrors}
                required
                value={orgFormData.organization_name}
                onChange={(e) => setOrgFormData((prev) => ({ ...prev, organization_name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={orgFormData.organization_type}
                  label="Type"
                  onChange={(e) => setOrgFormData((prev) => ({ ...prev, organization_type: e.target.value }))}
                >
                  <MenuItem value="exchange">Exchange</MenuItem>
                  <MenuItem value="extranet">Extranet</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Region</InputLabel>
                <Select
                  value={orgFormData.region}
                  label="Region"
                  onChange={(e) => setOrgFormData((prev) => ({ ...prev, region: e.target.value }))}
                >
                  {regions.map((region) => (
                    <MenuItem key={region} value={region}>{region}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Salesperson Assigned"
                value={orgFormData.salesperson_assigned}
                onChange={(e) => setOrgFormData((prev) => ({ ...prev, salesperson_assigned: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={orgFormData.available}
                    onChange={(e) => setOrgFormData((prev) => ({ ...prev, available: e.target.checked }))}
                  />
                }
                label="Available"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrgDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleOrgSubmit} variant="contained">
            {orgDialogMode === 'add' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={contactDialogOpen} onClose={() => setContactDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{contactDialogMode === 'add' ? 'Add Contact' : 'Edit Contact'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="contact_name"
                errors={contactErrors}
                required
                fullWidth
                label="Contact Name"
                value={contactFormData.contact_name}
                onChange={(e) => setContactFormData((prev) => ({ ...prev, contact_name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="job_title"
                errors={contactErrors}
                required
                fullWidth
                label="Job Title"
                value={contactFormData.job_title}
                onChange={(e) => setContactFormData((prev) => ({ ...prev, job_title: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="country"
                errors={contactErrors}
                fullWidth
                label="Country"
                value={contactFormData.country}
                onChange={(e) => setContactFormData((prev) => ({ ...prev, country: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="phone_number"
                errors={contactErrors}
                fullWidth
                label="Phone Number"
                value={contactFormData.phone_number}
                onChange={(e) => setContactFormData((prev) => ({ ...prev, phone_number: e.target.value }))}
                helperText="Required if Email is not provided"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="email"
                errors={contactErrors}
                fullWidth
                label="Email"
                type="email"
                value={contactFormData.email}
                onChange={(e) => setContactFormData((prev) => ({ ...prev, email: e.target.value }))}
                helperText="Required if Phone Number is not provided"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="contact_type"
                errors={contactErrors}
                required
                fullWidth
                label="Contact Type"
                value={contactFormData.contact_type}
                onChange={(e) => setContactFormData((prev) => ({ ...prev, contact_type: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={contactFormData.daily_contact}
                    onChange={(e) => setContactFormData((prev) => ({ ...prev, daily_contact: e.target.checked }))}
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
                onChange={(e) => setContactFormData((prev) => ({ ...prev, more_info: e.target.value }))}
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

      <Dialog open={moreInfoDialogOpen} onClose={() => setMoreInfoDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>More Info</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ whiteSpace: 'pre-wrap' }}>{moreInfoContent}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoreInfoDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget?.type === 'organization'
              ? `Delete organization "${deleteTarget.item.organization_name}" and all of its contacts?`
              : `Delete contact "${deleteTarget?.item?.contact_name}"?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      </Snackbar>
      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess(null)}>
        <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>
      </Snackbar>
    </Box>
  );
};

export default MarketDataContactsManager;
