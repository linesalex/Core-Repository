import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip,
  Alert, Snackbar, Grid, FormControl, InputLabel, Select, MenuItem, Tooltip, 
  Switch, FormControlLabel, Divider, Tabs, Tab
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LockResetIcon from '@mui/icons-material/LockReset';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import InputAdornment from '@mui/material/InputAdornment';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { API_BASE_URL } from './config';
import { ValidatedTextField, ValidatedSelect, createValidator, scrollToFirstError } from './components/FormValidation';
import { getPendingUsers, approveUser, rejectUser, getUserModulePermissions, updateUserModulePermissions, getModulePermissionTemplates, createModulePermissionTemplate, updateModulePermissionTemplate, deleteModulePermissionTemplate, applyTemplateToUser } from './api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [pendingUserForApproval, setPendingUserForApproval] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [approvalModulePermissions, setApprovalModulePermissions] = useState({});
  
  // Template management states
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateDialogMode, setTemplateDialogMode] = useState('add'); // 'add' or 'edit'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);
  const [applyTemplateDialogOpen, setApplyTemplateDialogOpen] = useState(false);
  const [templateToApply, setTemplateToApply] = useState(null);
  const [selectedTemplateInPermissions, setSelectedTemplateInPermissions] = useState('');
  const [selectedTemplateInApproval, setSelectedTemplateInApproval] = useState('');
  const [templateFormData, setTemplateFormData] = useState({
    template_name: '',
    permissions: {}
  });
  
  // Module permissions state
  const [modulePermissions, setModulePermissions] = useState({});
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [availableModules] = useState([
    { key: 'network_routes', label: 'Network Routes Repository' },
    { key: 'network_design', label: 'Network Design & Pricing Tool' },
    { key: 'allocated_cost_calculator', label: 'Allocated Cost Calculator' },
    { key: 'route_finder', label: 'Route Finder' },
    { key: 'kmz_viewer', label: 'KMZ Viewer' },
    { key: 'locations', label: 'Manage Locations' },
    { key: 'carriers', label: 'Manage Carriers' },
    { key: 'cnx_colocation_inventory', label: 'CNX Colocation — Inventory', group: 'CNX Colocation' },
    { key: 'cnx_colocation_availability', label: 'CNX Colocation — Availability', group: 'CNX Colocation' },
    { key: 'cnx_colocation_pricing', label: 'CNX Colocation — Pricing Tool', group: 'CNX Colocation' },
    { key: 'exchange_rates', label: 'Manage Exchange Rates' },
    { key: 'exchange_data', label: 'Exchange Data' },
    { key: 'extranet_data', label: 'Extranet Data' },
    { key: 'change_logs', label: 'Change Logs' },
    { key: 'core_outages', label: 'Core Outages' },
    { key: 'carrier_quote_repository', label: 'Carrier Quote Repository' }
    // Admin-only modules excluded: user_management, bulk_upload, 
    // minimum_pricing, pricing_logic, promo_pricing, live_latency_admin
  ]);
  
  // Form data
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    user_role: 'read_only',
    status: 'active'
  });

  // Validation states
  const [formErrors, setFormErrors] = useState({});

  // Validation rules for User form
  const userValidationRules = {
    username: { type: 'required', message: 'Username is required' },
    user_role: { type: 'required', message: 'Role is required' },
    email: { type: 'email', message: 'Please enter a valid email address' }
  };

  // Validation function
  const validate = createValidator(userValidationRules);

  // Normalize text for duplicate checking
  const normalizeText = (text) => {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  };

  const { user: currentUser, isAuthenticated } = useAuth();

  // Load users on component mount, but only if authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      loadUsers();
      loadPendingUsers();
      loadTemplates();
    }
  }, [isAuthenticated, currentUser]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/users`);
      setUsers(response.data);
    } catch (err) {
      setError('Failed to load users: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadPendingUsers = async () => {
    try {
      const data = await getPendingUsers();
      setPendingUsers(data);
    } catch (err) {
      console.error('Failed to load pending users:', err);
      setPendingUsers([]);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await getModulePermissionTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setTemplates([]);
    }
  };

  const handleAdd = () => {
    setDialogMode('add');
    setSelectedUser(null);
    setFormData({
      username: '',
      email: '',
      full_name: '',
      user_role: 'read_only',
      status: 'active'
    });
    setFormErrors({}); // Clear validation errors
    setDialogOpen(true);
  };

  const handleEdit = (user) => {
    setDialogMode('edit');
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email || '',
      full_name: user.full_name || '',
      user_role: user.user_role,
      status: user.status
    });
    setFormErrors({}); // Clear validation errors
    setDialogOpen(true);
  };

  const handleDelete = (user) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      // Validate form using validation framework
      const validationErrors = validate(formData);
      setFormErrors(validationErrors);

      // Check if there are validation errors
      if (Object.keys(validationErrors).length > 0) {
        scrollToFirstError(validationErrors);
        return;
      }

      if (dialogMode === 'add') {
        // Duplicate prevention - check for existing username (normalized)
        const normalizedUsername = normalizeText(formData.username);
        const existingUser = users.find(user => 
          normalizeText(user.username) === normalizedUsername
        );
        
        if (existingUser) {
          setError(`A user with username "${formData.username}" already exists. Please choose a different username.`);
          return;
        }

        // Send user data without password - backend will set default password
        const userData = {
          username: formData.username,
          email: formData.email,
          full_name: formData.full_name,
          user_role: formData.user_role,
          status: formData.status
        };

        await axios.post(`${API_BASE_URL}/users`, userData);
        setSuccess(`User created successfully. Default password is 'abc123'. User will be required to change password on first login.`);
      } else {
        // For edit mode, check username duplicates excluding current user
        const normalizedUsername = normalizeText(formData.username);
        const existingUser = users.find(user => 
          user.id !== selectedUser.id && 
          normalizeText(user.username) === normalizedUsername
        );
        
        if (existingUser) {
          setError(`A user with username "${formData.username}" already exists. Please choose a different username.`);
          return;
        }

        // For edit mode, don't send password if it's empty
        const updateData = {
          email: formData.email,
          full_name: formData.full_name,
          user_role: formData.user_role,
          status: formData.status
        };
        
        await axios.put(`${API_BASE_URL}/users/${selectedUser.id}`, updateData);
        setSuccess('User updated successfully');
      }

      setDialogOpen(false);
      setFormErrors({}); // Clear validation errors on success
      await loadUsers();

    } catch (err) {
      setError('Failed to save user: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/users/${selectedUser.id}`);
      setSuccess('User deleted successfully');
      setDeleteDialogOpen(false);
      await loadUsers();
    } catch (err) {
      setError('Failed to delete user: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleManagePermissions = async (user) => {
    setSelectedUser(user);
    try {
      const response = await getUserModulePermissions(user.id);
      setIsAdminUser(response.isAdmin);
      setModulePermissions(response.permissions || {});
      setPermissionsDialogOpen(true);
    } catch (err) {
      setError('Failed to load module permissions: ' + (err.response?.data?.error || err.message));
    }
  };

  const handlePermissionChange = (module, permissionLevel) => {
    setModulePermissions(prev => ({
      ...prev,
      [module]: permissionLevel
    }));
  };

  const handleSavePermissions = async () => {
    if (isAdminUser) {
      setError('Cannot modify permissions for administrators - they have full access to all modules');
      return;
    }
    
    try {
      await updateUserModulePermissions(selectedUser.id, modulePermissions);
      setSuccess('Module permissions updated successfully');
      setPermissionsDialogOpen(false);
    } catch (err) {
      setError('Failed to update module permissions: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleResetPassword = (user) => {
    setSelectedUser(user);
    setResetPasswordDialogOpen(true);
  };

  const handleResetPasswordConfirm = async () => {
    try {
      await axios.post(`${API_BASE_URL}/users/${selectedUser.id}/reset-password`, {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setSuccess(`Password reset to 'abc123' for user ${selectedUser.username}. User will be prompted to change password on next login.`);
      setResetPasswordDialogOpen(false);
    } catch (err) {
      setError('Failed to reset password: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleApproveUser = (user, userRole) => {
    setPendingUserForApproval(user);
    setSelectedRole(userRole);
    
    // For administrators: no module permissions needed (full access)
    // For non-admins: set default permissions to empty (no access)
    const defaultPermissions = {};
    if (userRole !== 'administrator') {
      // Non-admin: default to no access for all modules
      availableModules.forEach(module => {
        defaultPermissions[module.key] = ''; // Empty means no access
      });
    }
    setApprovalModulePermissions(defaultPermissions);
    setApprovalDialogOpen(true);
  };

  const handleConfirmApproval = async () => {
    try {
      // Approve the user with their role
      await approveUser(pendingUserForApproval.id, { 
        user_role: selectedRole
      });
      
      // If non-admin, set their module permissions
      if (selectedRole !== 'administrator') {
        await updateUserModulePermissions(pendingUserForApproval.id, approvalModulePermissions);
      }
      
      setSuccess(`User ${pendingUserForApproval.username} approved successfully with role: ${selectedRole}`);
      loadPendingUsers(); // Refresh pending users list
      loadUsers(); // Refresh main users list
      setApprovalDialogOpen(false);
      setPendingUserForApproval(null);
    } catch (err) {
      setError('Failed to approve user: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleApprovalModulePermissionChange = (module, permissionLevel) => {
    setApprovalModulePermissions(prev => ({
      ...prev,
      [module]: permissionLevel
    }));
  };

  const handleRejectUser = async (user) => {
    try {
      await rejectUser(user.id);
      setSuccess(`User registration for ${user.username} has been rejected and removed`);
      loadPendingUsers(); // Refresh pending users list
    } catch (err) {
      setError('Failed to reject user: ' + (err.response?.data?.error || err.message));
    }
  };

  // Template management handlers
  const handleAddTemplate = () => {
    setTemplateDialogMode('add');
    setSelectedTemplate(null);
    const defaultPermissions = {};
    availableModules.forEach(module => {
      defaultPermissions[module.key] = '';
    });
    setTemplateFormData({
      template_name: '',
      permissions: defaultPermissions
    });
    setTemplateDialogOpen(true);
  };

  const handleEditTemplate = (template) => {
    setTemplateDialogMode('edit');
    setSelectedTemplate(template);
    setTemplateFormData({
      template_name: template.template_name,
      permissions: template.permissions
    });
    setTemplateDialogOpen(true);
  };

  const handleDeleteTemplate = (template) => {
    setSelectedTemplate(template);
    setDeleteTemplateDialogOpen(true);
  };

  const handleTemplateSubmit = async () => {
    try {
      if (!templateFormData.template_name.trim()) {
        setError('Template name is required');
        return;
      }

      if (templateDialogMode === 'add') {
        await createModulePermissionTemplate(templateFormData);
        setSuccess('Template created successfully');
      } else {
        await updateModulePermissionTemplate(selectedTemplate.id, templateFormData);
        setSuccess('Template updated successfully');
      }

      setTemplateDialogOpen(false);
      await loadTemplates();
    } catch (err) {
      setError('Failed to save template: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteTemplateConfirm = async () => {
    try {
      await deleteModulePermissionTemplate(selectedTemplate.id);
      setSuccess('Template deleted successfully');
      setDeleteTemplateDialogOpen(false);
      await loadTemplates();
    } catch (err) {
      setError('Failed to delete template: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleTemplatePermissionChange = (module, permissionLevel) => {
    setTemplateFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [module]: permissionLevel
      }
    }));
  };

  const handleApplyTemplateClick = (template) => {
    setTemplateToApply(template);
    setApplyTemplateDialogOpen(true);
  };

  const handleApplyTemplateConfirm = async () => {
    try {
      await applyTemplateToUser(templateToApply.id, selectedUser.id);
      setSuccess(`Template "${templateToApply.template_name}" applied successfully to ${selectedUser.username}`);
      setApplyTemplateDialogOpen(false);
      setTemplateToApply(null);
      
      // Reload permissions in the permissions dialog if it's open
      if (permissionsDialogOpen) {
        const response = await getUserModulePermissions(selectedUser.id);
        setModulePermissions(response.permissions || {});
      }
    } catch (err) {
      setError('Failed to apply template: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleApplyTemplateFromPermissionsDialog = async () => {
    if (!selectedTemplateInPermissions) return;
    
    const template = templates.find(t => t.id === parseInt(selectedTemplateInPermissions));
    if (!template) return;
    
    // Check if user has manual edits by comparing current permissions with empty state
    const hasManualEdits = Object.values(modulePermissions).some(val => val && val !== '');
    
    if (hasManualEdits) {
      // Show warning dialog
      setTemplateToApply(template);
      setApplyTemplateDialogOpen(true);
    } else {
      // Apply directly
      try {
        await applyTemplateToUser(template.id, selectedUser.id);
        setSuccess(`Template "${template.template_name}" applied successfully`);
        const response = await getUserModulePermissions(selectedUser.id);
        setModulePermissions(response.permissions || {});
        setSelectedTemplateInPermissions('');
      } catch (err) {
        setError('Failed to apply template: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleApplyTemplateFromApprovalDialog = async () => {
    if (!selectedTemplateInApproval) return;
    
    const template = templates.find(t => t.id === parseInt(selectedTemplateInApproval));
    if (!template) return;
    
    // Apply template permissions to approval state
    setApprovalModulePermissions(template.permissions);
    setSelectedTemplateInApproval('');
    setSuccess(`Template "${template.template_name}" loaded`);
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const getRoleChip = (role) => {
    const colors = {
      'administrator': 'error',
      'user': 'primary'
    };
    const labels = {
      'administrator': 'Administrator',
      'user': 'User'
    };
    return <Chip label={labels[role] || role} color={colors[role] || 'default'} size="small" />;
  };

  const getStatusChip = (status) => {
    const colors = {
      'active': 'success',
      'inactive': 'error'
    };
    return <Chip label={status} color={colors[status]} size="small" />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} component="h2">
          User Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: 220 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchTerm('')}
                    edge="end"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAdd}
          >
            Add User
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadUsers}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Tabs for Users and Pending Approvals */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={handleTabChange} aria-label="user management tabs">
          <Tab label="Active Users" />
          <Tab 
            label={`Pending Approvals ${pendingUsers.length > 0 ? `(${pendingUsers.length})` : ''}`}
            sx={{ color: pendingUsers.length > 0 ? 'error.main' : 'inherit' }}
          />
          <Tab label="Module Permission Templates" />
        </Tabs>
      </Box>

      {/* Active Users Table */}
      {currentTab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
                <TableCell>Full Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users
                .filter(user => 
                  user.username.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Typography variant="body1" sx={{ fontSize: '0.875rem' }} fontWeight="bold">
                      {user.username}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {user.full_name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {user.email || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {getRoleChip(user.user_role)}
                  </TableCell>
                  <TableCell>
                    {getStatusChip(user.status)}
                  </TableCell>
                  <TableCell>
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell>
                    {formatDate(user.last_login)}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit User">
                      <IconButton onClick={() => handleEdit(user)} size="small">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete User">
                      <IconButton onClick={() => handleDelete(user)} size="small" color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Manage Module Permissions">
                      <IconButton onClick={() => handleManagePermissions(user)} size="small">
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Reset Password">
                      <IconButton onClick={() => handleResetPassword(user)} size="small" color="warning">
                        <LockResetIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pending Approvals Table */}
      {currentTab === 1 && (
        <Box>
          {pendingUsers.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} color="text.secondary">
                No pending user registrations
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary" sx={{ mt: 1 }}>
                New user registration requests will appear here for admin approval
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Full Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Requested Date</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingUsers.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Typography variant="body1" sx={{ fontSize: '0.875rem' }} fontWeight="bold">
                          {user.username}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {user.full_name}
                      </TableCell>
                      <TableCell>
                        {user.email}
                      </TableCell>
                      <TableCell>
                        {formatDate(user.requested_at)}
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={() => handleApproveUser(user, 'user')}
                          sx={{ mr: 1 }}
                        >
                          Approve as User
                        </Button>
                        <Button
                          variant="contained"
                          color="error"
                          size="small"
                          onClick={() => handleApproveUser(user, 'administrator')}
                          sx={{ mr: 1 }}
                        >
                          Approve as Administrator
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => handleRejectUser(user)}
                        >
                          Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Module Permission Templates Table */}
      {currentTab === 2 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary">
              Create reusable permission templates to quickly configure user access to modules
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddTemplate}
            >
              Create Template
            </Button>
          </Box>

          {templates.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} color="text.secondary">
                No permission templates created
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary" sx={{ mt: 1 }}>
                Create templates to standardize module permissions for different user roles
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Template Name</TableCell>
                    <TableCell>Configured Modules</TableCell>
                    <TableCell>Created By</TableCell>
                    <TableCell>Created Date</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map((template) => {
                    const configuredModules = Object.entries(template.permissions)
                      .filter(([key, value]) => value && value !== '')
                      .length;
                    
                    return (
                      <TableRow key={template.id} hover>
                        <TableCell>
                          <Typography variant="body1" sx={{ fontSize: '0.875rem' }} fontWeight="bold">
                            {template.template_name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {configuredModules} / {availableModules.length} modules
                        </TableCell>
                        <TableCell>
                          {template.created_by_username || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          {formatDate(template.created_at)}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Edit Template">
                            <IconButton onClick={() => handleEditTemplate(template)} size="small">
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Template">
                            <IconButton onClick={() => handleDeleteTemplate(template)} size="small" color="error">
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Add/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        disableRestoreFocus
        aria-labelledby="user-dialog-title"
      >
        <DialogTitle id="user-dialog-title">
          {dialogMode === 'add' ? 'Add User' : 'Edit User'}
        </DialogTitle>
        <DialogContent>
          {dialogMode === 'add' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              New users will automatically receive the default password 'abc123' and must change it on first login.
            </Alert>
          )}
          
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <ValidatedTextField
                  label="Username *"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  fullWidth
                  required
                  disabled={dialogMode === 'edit'}
                  helperText={dialogMode === 'edit' ? 'Username cannot be changed' : ''}
                  autoComplete="username"
                  field="username"
                  errors={formErrors}
                />
              </Grid>
              
              {dialogMode === 'edit' && (
                <Grid item xs={12}>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    To reset this user's password, use the Reset Password button in the user table.
                  </Alert>
                </Grid>
              )}
            
            <Grid item xs={12}>
              <ValidatedTextField
                label="Full Name"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                fullWidth
                field="full_name"
                errors={formErrors}
              />
            </Grid>
            
            <Grid item xs={12}>
              <ValidatedTextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                fullWidth
                field="email"
                errors={formErrors}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <ValidatedSelect
                fullWidth
                label="Role *"
                value={formData.user_role}
                onChange={(e) => handleInputChange('user_role', e.target.value)}
                required
                field="user_role"
                errors={formErrors}
              >
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="administrator">Administrator</MenuItem>
              </ValidatedSelect>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <ValidatedSelect
                fullWidth
                label="Status"
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                field="status"
                errors={formErrors}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </ValidatedSelect>
            </Grid>
          </Grid>
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" type="submit">
            {dialogMode === 'add' ? 'Add' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        disableRestoreFocus
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user <strong>{selectedUser?.username}</strong>?
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Module Permissions Dialog */}
      <Dialog 
        open={permissionsDialogOpen} 
        onClose={() => setPermissionsDialogOpen(false)}
        maxWidth="md" 
        fullWidth
        disableRestoreFocus
        aria-labelledby="permissions-dialog-title"
      >
        <DialogTitle id="permissions-dialog-title">
          Manage Module Permissions - {selectedUser?.username}
        </DialogTitle>
        <DialogContent>
          {isAdminUser ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              This user is an administrator and has full access to all modules. 
              Administrators cannot have custom per-module permissions.
            </Alert>
          ) : (
            <>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary" sx={{ mb: 2 }}>
                Configure this user's access level for each module. Modules with no permission will not be visible to the user.
              </Typography>
              
              {/* Template Selection */}
              <Box sx={{ mb: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel shrink>Apply Permission Template</InputLabel>
                  <Select
                    value={selectedTemplateInPermissions}
                    onChange={(e) => setSelectedTemplateInPermissions(e.target.value)}
                    label="Apply Permission Template"
                    displayEmpty
                    notched
                  >
                    <MenuItem value="">-- Select a template --</MenuItem>
                    {templates.map((template) => (
                      <MenuItem key={template.id} value={template.id}>
                        {template.template_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selectedTemplateInPermissions && (
                  <Button 
                    variant="outlined" 
                    size="small" 
                    sx={{ mt: 1 }} 
                    fullWidth
                    onClick={handleApplyTemplateFromPermissionsDialog}
                  >
                    Apply Selected Template
                  </Button>
                )}
              </Box>
              
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {(() => {
                  const modules = availableModules.filter(module => module.key !== 'live_latency_admin');
                  const ungrouped = modules.filter(m => !m.group);
                  const groups = [...new Set(modules.filter(m => m.group).map(m => m.group))];
                  
                  return (
                    <>
                      {ungrouped.map((module) => {
                        const hasSalesOption = ['network_routes', 'locations'].includes(module.key);
                        return (
                          <Grid item xs={12} sm={6} key={module.key}>
                            <FormControl fullWidth size="small">
                              <InputLabel shrink>{module.label}</InputLabel>
                              <Select
                                value={modulePermissions[module.key] || ''}
                                onChange={(e) => handlePermissionChange(module.key, e.target.value)}
                                label={module.label}
                                displayEmpty
                                notched
                                renderValue={(selected) => {
                                  if (!selected || selected === '') return 'No Access';
                                  if (selected === 'sales') return 'Sales';
                                  return selected === 'read_only' ? 'Read-Only' : 'Provisioner';
                                }}
                              >
                                <MenuItem value="">No Access</MenuItem>
                                {hasSalesOption && <MenuItem value="sales">Sales</MenuItem>}
                                <MenuItem value="read_only">Read-Only</MenuItem>
                                <MenuItem value="provisioner">Provisioner</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                        );
                      })}
                      {groups.map(groupName => {
                        const groupModules = modules.filter(m => m.group === groupName);
                        return (
                          <React.Fragment key={groupName}>
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" sx={{ mt: 1, mb: -0.5, fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {groupName}
                              </Typography>
                              <Divider sx={{ mt: 0.5 }} />
                            </Grid>
                            {groupModules.map((module) => (
                              <Grid item xs={12} sm={6} key={module.key}>
                                <FormControl fullWidth size="small">
                                  <InputLabel shrink>{module.label.replace(`${groupName} — `, '')}</InputLabel>
                                  <Select
                                    value={modulePermissions[module.key] || ''}
                                    onChange={(e) => handlePermissionChange(module.key, e.target.value)}
                                    label={module.label.replace(`${groupName} — `, '')}
                                    displayEmpty
                                    notched
                                    renderValue={(selected) => {
                                      if (!selected || selected === '') return 'No Access';
                                      return selected === 'read_only' ? 'Read-Only' : 'Provisioner';
                                    }}
                                  >
                                    <MenuItem value="">No Access</MenuItem>
                                    <MenuItem value="read_only">Read-Only</MenuItem>
                                    <MenuItem value="provisioner">Provisioner</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </>
                  );
                })()}
              </Grid>
              <Alert severity="info" sx={{ mt: 2 }}>
                <strong>Sales:</strong> Limited view access (available for Network Routes & Locations only)<br />
                <strong>Read-Only:</strong> Can view module data only<br />
                <strong>Provisioner:</strong> Can view, create, edit, and delete
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermissionsDialogOpen(false)}>Cancel</Button>
          {!isAdminUser && (
            <Button onClick={handleSavePermissions} variant="contained" color="primary">
              Save Changes
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* User Approval Dialog */}
      <Dialog 
        open={approvalDialogOpen} 
        onClose={() => setApprovalDialogOpen(false)}
        disableRestoreFocus
        aria-labelledby="approval-dialog-title"
        maxWidth="md"
        fullWidth
      >
        <DialogTitle id="approval-dialog-title">
          Approve User: {pendingUserForApproval?.username}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ fontSize: '0.875rem' }} sx={{ mb: 2 }}>
            <strong>Role:</strong> {selectedRole === 'administrator' ? 'Administrator' : 'User'}
          </Typography>
          <Typography variant="body1" sx={{ fontSize: '0.875rem' }} sx={{ mb: 2 }}>
            <strong>Email:</strong> {pendingUserForApproval?.email}
          </Typography>
          <Typography variant="body1" sx={{ fontSize: '0.875rem' }} sx={{ mb: 2 }}>
            <strong>Full Name:</strong> {pendingUserForApproval?.full_name}
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          {selectedRole === 'administrator' ? (
            <Alert severity="info">
              Administrators have full access to all modules automatically. No additional configuration needed.
            </Alert>
          ) : (
            <>
              <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} sx={{ mb: 2 }}>
                Module Permissions
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary" sx={{ mb: 2 }}>
                Configure access levels for each module. Modules with no permission will not be visible to the user.
              </Typography>
              
              {/* Template Selection */}
              <Box sx={{ mb: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel shrink>Load Permission Template</InputLabel>
                  <Select
                    value={selectedTemplateInApproval}
                    onChange={(e) => setSelectedTemplateInApproval(e.target.value)}
                    label="Load Permission Template"
                    displayEmpty
                    notched
                  >
                    <MenuItem value="">-- Select a template --</MenuItem>
                    {templates.map((template) => (
                      <MenuItem key={template.id} value={template.id}>
                        {template.template_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selectedTemplateInApproval && (
                  <Button 
                    variant="outlined" 
                    size="small" 
                    sx={{ mt: 1 }} 
                    fullWidth
                    onClick={handleApplyTemplateFromApprovalDialog}
                  >
                    Load Selected Template
                  </Button>
                )}
              </Box>
              
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                {(() => {
                  const modules = availableModules.filter(module => module.key !== 'live_latency_admin');
                  const ungrouped = modules.filter(m => !m.group);
                  const groups = [...new Set(modules.filter(m => m.group).map(m => m.group))];
                  
                  return (
                    <>
                      {ungrouped.map((module) => {
                        const hasSalesOption = ['network_routes', 'locations'].includes(module.key);
                        return (
                          <Grid item xs={12} sm={6} key={module.key}>
                            <FormControl fullWidth size="small">
                              <InputLabel shrink>{module.label}</InputLabel>
                              <Select
                                value={approvalModulePermissions[module.key] || ''}
                                onChange={(e) => handleApprovalModulePermissionChange(module.key, e.target.value)}
                                label={module.label}
                                displayEmpty
                                notched
                                renderValue={(selected) => {
                                  if (!selected || selected === '') return 'No Access';
                                  if (selected === 'sales') return 'Sales';
                                  return selected === 'read_only' ? 'Read-Only' : 'Provisioner';
                                }}
                              >
                                <MenuItem value="">No Access</MenuItem>
                                {hasSalesOption && <MenuItem value="sales">Sales</MenuItem>}
                                <MenuItem value="read_only">Read-Only</MenuItem>
                                <MenuItem value="provisioner">Provisioner</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                        );
                      })}
                      {groups.map(groupName => {
                        const groupModules = modules.filter(m => m.group === groupName);
                        return (
                          <React.Fragment key={groupName}>
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" sx={{ mt: 1, mb: -0.5, fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {groupName}
                              </Typography>
                              <Divider sx={{ mt: 0.5 }} />
                            </Grid>
                            {groupModules.map((module) => (
                              <Grid item xs={12} sm={6} key={module.key}>
                                <FormControl fullWidth size="small">
                                  <InputLabel shrink>{module.label.replace(`${groupName} — `, '')}</InputLabel>
                                  <Select
                                    value={approvalModulePermissions[module.key] || ''}
                                    onChange={(e) => handleApprovalModulePermissionChange(module.key, e.target.value)}
                                    label={module.label.replace(`${groupName} — `, '')}
                                    displayEmpty
                                    notched
                                    renderValue={(selected) => {
                                      if (!selected || selected === '') return 'No Access';
                                      return selected === 'read_only' ? 'Read-Only' : 'Provisioner';
                                    }}
                                  >
                                    <MenuItem value="">No Access</MenuItem>
                                    <MenuItem value="read_only">Read-Only</MenuItem>
                                    <MenuItem value="provisioner">Provisioner</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </>
                  );
                })()}
              </Grid>
              <Alert severity="info" sx={{ mt: 2 }}>
                <strong>Sales:</strong> Limited view access (available for Network Routes & Locations only)<br />
                <strong>Read-Only:</strong> Can view module data only<br />
                <strong>Provisioner:</strong> Can view, create, edit, and delete
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmApproval} variant="contained" color="primary">
            Approve User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Confirmation Dialog */}
      <Dialog 
        open={resetPasswordDialogOpen} 
        onClose={() => setResetPasswordDialogOpen(false)}
        disableRestoreFocus
        aria-labelledby="reset-password-dialog-title"
      >
        <DialogTitle id="reset-password-dialog-title">Reset Password</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to reset the password for user <strong>{selectedUser?.username}</strong>?
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary" sx={{ mt: 1 }}>
            This will set the password to 'abc123' and the user will be prompted to change it on their next login.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetPasswordDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleResetPasswordConfirm} color="warning" variant="contained">
            Reset Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Add/Edit Dialog */}
      <Dialog 
        open={templateDialogOpen} 
        onClose={() => setTemplateDialogOpen(false)}
        maxWidth="md" 
        fullWidth
        disableRestoreFocus
        aria-labelledby="template-dialog-title"
      >
        <DialogTitle id="template-dialog-title">
          {templateDialogMode === 'add' ? 'Create Permission Template' : 'Edit Permission Template'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary" sx={{ mb: 2 }}>
            Define a reusable set of module permissions that can be applied to users
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Template Name *"
                value={templateFormData.template_name}
                onChange={(e) => setTemplateFormData(prev => ({ ...prev, template_name: e.target.value }))}
                fullWidth
                required
                placeholder="e.g., Sales, Engineering, Finance"
              />
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} sx={{ mb: 2 }}>
                Module Permissions
              </Typography>
              <Grid container spacing={2}>
                {(() => {
                  const modules = availableModules.filter(module => module.key !== 'live_latency_admin');
                  const ungrouped = modules.filter(m => !m.group);
                  const groups = [...new Set(modules.filter(m => m.group).map(m => m.group))];
                  
                  return (
                    <>
                      {ungrouped.map((module) => {
                        const hasSalesOption = ['network_routes', 'locations'].includes(module.key);
                        return (
                          <Grid item xs={12} sm={6} key={module.key}>
                            <FormControl fullWidth size="small">
                              <InputLabel shrink>{module.label}</InputLabel>
                              <Select
                                value={templateFormData.permissions[module.key] || ''}
                                onChange={(e) => handleTemplatePermissionChange(module.key, e.target.value)}
                                label={module.label}
                                displayEmpty
                                notched
                                renderValue={(selected) => {
                                  if (!selected || selected === '') return 'No Access';
                                  if (selected === 'sales') return 'Sales';
                                  return selected === 'read_only' ? 'Read-Only' : 'Provisioner';
                                }}
                              >
                                <MenuItem value="">No Access</MenuItem>
                                {hasSalesOption && <MenuItem value="sales">Sales</MenuItem>}
                                <MenuItem value="read_only">Read-Only</MenuItem>
                                <MenuItem value="provisioner">Provisioner</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                        );
                      })}
                      {groups.map(groupName => {
                        const groupModules = modules.filter(m => m.group === groupName);
                        return (
                          <React.Fragment key={groupName}>
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" sx={{ mt: 1, mb: -0.5, fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {groupName}
                              </Typography>
                              <Divider sx={{ mt: 0.5 }} />
                            </Grid>
                            {groupModules.map((module) => (
                              <Grid item xs={12} sm={6} key={module.key}>
                                <FormControl fullWidth size="small">
                                  <InputLabel shrink>{module.label.replace(`${groupName} — `, '')}</InputLabel>
                                  <Select
                                    value={templateFormData.permissions[module.key] || ''}
                                    onChange={(e) => handleTemplatePermissionChange(module.key, e.target.value)}
                                    label={module.label.replace(`${groupName} — `, '')}
                                    displayEmpty
                                    notched
                                    renderValue={(selected) => {
                                      if (!selected || selected === '') return 'No Access';
                                      return selected === 'read_only' ? 'Read-Only' : 'Provisioner';
                                    }}
                                  >
                                    <MenuItem value="">No Access</MenuItem>
                                    <MenuItem value="read_only">Read-Only</MenuItem>
                                    <MenuItem value="provisioner">Provisioner</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </>
                  );
                })()}
              </Grid>
              <Alert severity="info" sx={{ mt: 2 }}>
                <strong>Sales:</strong> Limited view access (available for Network Routes & Locations only)<br />
                <strong>Read-Only:</strong> Can view module data only<br />
                <strong>Provisioner:</strong> Can view, create, edit, and delete
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleTemplateSubmit} variant="contained" color="primary">
            {templateDialogMode === 'add' ? 'Create Template' : 'Update Template'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Template Confirmation Dialog */}
      <Dialog 
        open={deleteTemplateDialogOpen} 
        onClose={() => setDeleteTemplateDialogOpen(false)}
        disableRestoreFocus
        aria-labelledby="delete-template-dialog-title"
      >
        <DialogTitle id="delete-template-dialog-title">Delete Template</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the template <strong>{selectedTemplate?.template_name}</strong>?
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.75rem' }} color="text.secondary" sx={{ mt: 1 }}>
            This will not affect users who already have permissions configured. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTemplateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteTemplateConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Apply Template Warning Dialog */}
      <Dialog 
        open={applyTemplateDialogOpen} 
        onClose={() => setApplyTemplateDialogOpen(false)}
        disableRestoreFocus
        aria-labelledby="apply-template-dialog-title"
      >
        <DialogTitle id="apply-template-dialog-title">Apply Template</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to apply the template <strong>{templateToApply?.template_name}</strong> to user <strong>{selectedUser?.username}</strong>?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This will overwrite any existing manual permission changes for this user.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyTemplateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleApplyTemplateConfirm} color="primary" variant="contained">
            Apply Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error/Success Messages */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserManagement; 