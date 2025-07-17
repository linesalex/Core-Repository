import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip,
  Alert, Snackbar, Grid, FormControl, InputLabel, Select, MenuItem, Tooltip, 
  Switch, FormControlLabel, Divider
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useAuth } from './AuthContext';
import axios from 'axios';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [visibilityDialogOpen, setVisibilityDialogOpen] = useState(false);
  
  // Module visibility state
  const [moduleVisibility, setModuleVisibility] = useState({});
  const [availableModules] = useState([
    { key: 'network_routes', label: 'Network Routes' },
    { key: 'network_design', label: 'Network Design & Pricing' },
    { key: 'locations', label: 'Manage Locations' },
    { key: 'carriers', label: 'Manage Carriers' },
    { key: 'exchange_rates', label: 'Exchange Rates' },
    { key: 'exchange_data', label: 'Exchange Data' },
    { key: 'change_logs', label: 'Change Logs' },
    { key: 'user_management', label: 'User Management' }
  ]);
  
  // Form data
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    full_name: '',
    user_role: 'read_only',
    status: 'active'
  });

  const { user: currentUser, isAuthenticated } = useAuth();

  // Load users on component mount, but only if authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      loadUsers();
    }
  }, [isAuthenticated, currentUser]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:4000/users');
      setUsers(response.data);
    } catch (err) {
      setError('Failed to load users: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setDialogMode('add');
    setSelectedUser(null);
    setFormData({
      username: '',
      password: '',
      email: '',
      full_name: '',
      user_role: 'read_only',
      status: 'active'
    });
    setDialogOpen(true);
  };

  const handleEdit = (user) => {
    setDialogMode('edit');
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: '', // Don't show password
      email: user.email || '',
      full_name: user.full_name || '',
      user_role: user.user_role,
      status: user.status
    });
    setDialogOpen(true);
  };

  const handleDelete = (user) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (dialogMode === 'add') {
        if (!formData.username || !formData.password || !formData.user_role) {
          setError('Please fill in all required fields');
          return;
        }

        await axios.post('http://localhost:4000/users', formData);
        setSuccess('User created successfully');
      } else {
        // For edit mode, don't send password if it's empty
        const updateData = {
          email: formData.email,
          full_name: formData.full_name,
          user_role: formData.user_role,
          status: formData.status
        };
        
        await axios.put(`http://localhost:4000/users/${selectedUser.id}`, updateData);
        setSuccess('User updated successfully');
      }

      setDialogOpen(false);
      await loadUsers();

    } catch (err) {
      setError('Failed to save user: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await axios.delete(`http://localhost:4000/users/${selectedUser.id}`);
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

  const handleManageVisibility = async (user) => {
    setSelectedUser(user);
    try {
      const response = await axios.get(`http://localhost:4000/users/${user.id}/module-visibility`);
      setModuleVisibility(response.data);
      setVisibilityDialogOpen(true);
    } catch (err) {
      setError('Failed to load module visibility settings: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleVisibilityChange = (module, isVisible) => {
    setModuleVisibility(prev => ({
      ...prev,
      [module]: isVisible
    }));
  };

  const handleSaveVisibility = async () => {
    try {
      await axios.put(`http://localhost:4000/users/${selectedUser.id}/module-visibility`, moduleVisibility);
      setSuccess('Module visibility updated successfully');
      setVisibilityDialogOpen(false);
    } catch (err) {
      setError('Failed to update module visibility: ' + (err.response?.data?.error || err.message));
    }
  };

  const getRoleChip = (role) => {
    const colors = {
      'administrator': 'error',
      'provisioner': 'warning',
      'read_only': 'info'
    };
    const labels = {
      'administrator': 'Admin',
      'provisioner': 'Provisioner',
      'read_only': 'Read Only'
    };
    return <Chip label={labels[role]} color={colors[role]} size="small" />;
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
        <Typography variant="h6" component="h2">
          User Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
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

      {/* Users Table */}
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
            {users.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>
                  <Typography variant="body1" fontWeight="bold">
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
                  <Tooltip title="Edit">
                    <IconButton 
                      size="small" 
                      onClick={() => handleEdit(user)}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Module Visibility">
                    <IconButton 
                      size="small" 
                      onClick={() => handleManageVisibility(user)}
                      color="primary"
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                  {user.id !== currentUser.id && (
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small" 
                        onClick={() => handleDelete(user)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                              <TextField
                label="Username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                fullWidth
                required
                disabled={dialogMode === 'edit'}
                helperText={dialogMode === 'edit' ? 'Username cannot be changed' : ''}
                autoComplete="username"
              />
              </Grid>
              
              {dialogMode === 'add' && (
                <Grid item xs={12}>
                  <TextField
                    label="Password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    fullWidth
                    required
                    autoComplete="new-password"
                  />
                </Grid>
              )}
            
            <Grid item xs={12}>
              <TextField
                label="Full Name"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.user_role}
                  onChange={(e) => handleInputChange('user_role', e.target.value)}
                  label="Role"
                >
                  <MenuItem value="read_only">Read Only</MenuItem>
                  <MenuItem value="provisioner">Provisioner</MenuItem>
                  <MenuItem value="administrator">Administrator</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
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

      {/* Module Visibility Dialog */}
      <Dialog 
        open={visibilityDialogOpen} 
        onClose={() => setVisibilityDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        disableRestoreFocus
        aria-labelledby="visibility-dialog-title"
      >
        <DialogTitle id="visibility-dialog-title">
          Manage Module Visibility - {selectedUser?.username}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Control which modules are visible to this user. This affects UI visibility only and does not change user permissions.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            {availableModules.map((module) => (
              <Grid item xs={12} sm={6} key={module.key}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={moduleVisibility[module.key] !== false}
                      onChange={(e) => handleVisibilityChange(module.key, e.target.checked)}
                      color="primary"
                    />
                  }
                  label={module.label}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVisibilityDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveVisibility} variant="contained" color="primary">
            Save Changes
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