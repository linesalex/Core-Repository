import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Button, IconButton, TextField, MenuItem, Select, FormControl, InputLabel,
  Chip, CircularProgress, Alert, Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MapIcon from '@mui/icons-material/Map';
import { useAuth } from './AuthContext';
import { customerRouteApi } from './api';
import CustomerRouteFormDialog from './CustomerRouteFormDialog';
import CustomerRouteKmzHistoryDialog from './CustomerRouteKmzHistoryDialog';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString();
}

function locationLabel(row, prefix) {
  return row[`${prefix}_pop_code`] || '—';
}

function CustomerRoutesTable() {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [selectedRow, setSelectedRow] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [historyRow, setHistoryRow] = useState(null);

  const canCreate = hasPermission('network_routes', 'create');
  const canEdit = hasPermission('network_routes', 'edit');
  const canDelete = hasPermission('network_routes', 'delete');

  const loadRoutes = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await customerRouteApi.getRoutes();
      setRows(data || []);
    } catch (err) {
      console.error('Failed to load customer routes:', err);
      setError('Failed to load customer routes: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (typeFilter !== 'All' && row.route_type !== typeFilter) return false;
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const haystack = `${row.circuit_id} ${row.customer_name} ${row.notes || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, typeFilter]);

  const handleAdd = () => {
    setFormMode('add');
    setSelectedRow(null);
    setFormOpen(true);
  };

  const handleEdit = (row) => {
    setHistoryRow(null);
    setFormMode('edit');
    setSelectedRow(row);
    setFormOpen(true);
  };

  const handleRowClick = (row) => {
    setHistoryRow(row);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await customerRouteApi.deleteRoute(deleteConfirm.circuit_id);
      setDeleteConfirm(null);
      await loadRoutes();
    } catch (err) {
      setError('Failed to delete customer route: ' + (err.response?.data?.error || err.message));
      setDeleteConfirm(null);
    }
  };

  const handleFormSubmit = async (payload, files) => {
    try {
      if (formMode === 'add') {
        await customerRouteApi.createRoute(payload);
        if (files && files.length > 0) {
          await customerRouteApi.uploadKmz(payload.circuit_id, files);
        }
      } else {
        await customerRouteApi.updateRoute(selectedRow.circuit_id, payload);
      }
      setFormOpen(false);
      setSelectedRow(null);
      setError('');
      await loadRoutes();
    } catch (err) {
      throw err;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5">Customer Routes</Typography>
        {canCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Customer Route
          </Button>
        )}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Customer-specific routing information (Customer Service KMZ and Customer Aggregate KMZ), with full KMZ upload history.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Search"
          placeholder="Circuit ID, customer, notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ minWidth: 260 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Type</InputLabel>
          <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)}>
            <MenuItem value="All">All Types</MenuItem>
            <MenuItem value="Service">Customer Service KMZ</MenuItem>
            <MenuItem value="Aggregate">Customer Aggregate KMZ</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>UCN</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Location A</TableCell>
                <TableCell>Location B</TableCell>
                <TableCell align="center">KMZ</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No customer routes found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow
                    key={row.circuit_id}
                    hover
                    onClick={() => handleRowClick(row)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{row.circuit_id}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.route_type}
                        color={row.route_type === 'Aggregate' ? 'primary' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{row.customer_name}</TableCell>
                    <TableCell>{locationLabel(row, 'location_a')}</TableCell>
                    <TableCell>{locationLabel(row, 'location_b')}</TableCell>
                    <TableCell align="center">
                      {row.kmz_count > 0 ? (
                        <Tooltip title={`Latest upload: ${formatDate(row.latest_kmz_uploaded_at)} — click row to view & download`}>
                          <Chip size="small" icon={<MapIcon />} label={row.kmz_count} color="success" variant="outlined" />
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.secondary">None</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.notes}
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      {canEdit && (
                        <IconButton size="small" onClick={() => handleEdit(row)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                      {canDelete && (
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(row)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CustomerRouteFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setSelectedRow(null); }}
        onSubmit={handleFormSubmit}
        initialValues={selectedRow || {}}
        isEdit={formMode === 'edit'}
      />

      <CustomerRouteKmzHistoryDialog
        open={!!historyRow}
        onClose={() => setHistoryRow(null)}
        route={historyRow}
        onEdit={canEdit ? handleEdit : null}
      />

      {deleteConfirm && (
        <Box
          sx={{
            position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <Paper sx={{ p: 3, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <Typography variant="h6" sx={{ mb: 1 }}>Delete Customer Route</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Are you sure you want to delete route <strong>{deleteConfirm.circuit_id}</strong>? This will also permanently delete all {deleteConfirm.kmz_count || 0} uploaded KMZ file(s). This cannot be undone.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
}

export default CustomerRoutesTable;
