import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Snackbar, CircularProgress, Chip, Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { latencyMatrixAdminApi } from './api';

function LatencyMatrixAdmin() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ city_name: '', pop_code: '', display_order: 0 });
  const [formError, setFormError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchLocations = useCallback(async () => {
    try {
      const data = await latencyMatrixAdminApi.getLocations();
      setLocations(data);
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to load locations', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleOpenAdd = () => {
    setEditingLocation(null);
    setForm({ city_name: '', pop_code: '', display_order: locations.length });
    setFormError('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (loc) => {
    setEditingLocation(loc);
    setForm({ city_name: loc.city_name, pop_code: loc.pop_code, display_order: loc.display_order || 0 });
    setFormError('');
    setDialogOpen(true);
  };

  const handleOpenDelete = (loc) => {
    setDeleteTarget(loc);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.city_name.trim() || !form.pop_code.trim()) {
      setFormError('City name and POP code are required');
      return;
    }

    try {
      if (editingLocation) {
        await latencyMatrixAdminApi.updateLocation(editingLocation.id, form);
        setSnackbar({ open: true, message: `Updated ${form.city_name}`, severity: 'success' });
      } else {
        await latencyMatrixAdminApi.addLocation(form);
        setSnackbar({ open: true, message: `Added ${form.city_name}`, severity: 'success' });
      }
      setDialogOpen(false);
      fetchLocations();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save';
      setFormError(msg);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await latencyMatrixAdminApi.deleteLocation(deleteTarget.id);
      setSnackbar({ open: true, message: `Deleted ${deleteTarget.city_name}`, severity: 'success' });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchLocations();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to delete location', severity: 'error' });
    }
  };

  const handleRefreshMatrix = async () => {
    setRefreshing(true);
    try {
      await latencyMatrixAdminApi.refreshMatrix();
      setSnackbar({ open: true, message: 'Latency matrix recomputed successfully', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to recompute matrix', severity: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h5">Latency Matrix Locations</Typography>
            <Typography variant="body2" color="text.secondary">
              Configure city locations and their source POP codes for the home page latency matrix.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={refreshing ? <CircularProgress size={18} /> : <RefreshIcon />}
              onClick={handleRefreshMatrix}
              disabled={refreshing}
            >
              {refreshing ? 'Computing...' : 'Refresh Matrix'}
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
              Add Location
            </Button>
          </Box>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Order</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>City Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>POP Code</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Datacenter</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Region</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No locations configured. Click "Add Location" to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                locations.map((loc) => (
                  <TableRow key={loc.id} hover>
                    <TableCell>{loc.display_order}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{loc.city_name}</TableCell>
                    <TableCell>
                      <Chip label={loc.pop_code} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{loc.datacenter_name || '—'}</TableCell>
                    <TableCell>{loc.region || '—'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenEdit(loc)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleOpenDelete(loc)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{formError}</Alert>
          )}
          <TextField
            label="City Name"
            fullWidth
            margin="normal"
            value={form.city_name}
            onChange={(e) => setForm({ ...form, city_name: e.target.value })}
            placeholder="e.g. London"
          />
          <TextField
            label="POP Code"
            fullWidth
            margin="normal"
            value={form.pop_code}
            onChange={(e) => setForm({ ...form, pop_code: e.target.value.toUpperCase() })}
            placeholder="e.g. IPCLON7"
            helperText="Must be a valid POP code from the location reference"
          />
          <TextField
            label="Display Order"
            fullWidth
            margin="normal"
            type="number"
            value={form.display_order}
            onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
            helperText="Lower numbers appear first in the matrix"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {editingLocation ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Location</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove <strong>{deleteTarget?.city_name}</strong> ({deleteTarget?.pop_code}) from the latency matrix?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will also remove all cached matrix data for this location.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default LatencyMatrixAdmin;
