import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Checkbox, TextField, Typography, Box, Chip, Alert, Snackbar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { getDarkFiberDetails, addDarkFiberDetail, editDarkFiberDetail, deleteDarkFiberDetail, reserveDarkFiber, releaseDarkFiber } from './api';

const defaultForm = {
  dwdm_wavelength: '',
  dwdm_ucn: '',
  equipment: '',
  in_use: false,
  capex_cost_to_light: '',
};

function DarkFiberFormDialog({ open, onClose, onSubmit, initialData, mode }) {
  const [formData, setFormData] = useState(initialData || defaultForm);
  useEffect(() => {
    if (open) setFormData(initialData || defaultForm);
  }, [open, initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'add' ? 'Add' : 'Edit'} Dark Fiber Detail</DialogTitle>
      <DialogContent>
        <TextField
          label="DWDM Wavelength"
          name="dwdm_wavelength"
          value={formData.dwdm_wavelength}
          onChange={handleChange}
          fullWidth
          sx={{ mb: 2 }}
        />
        <TextField
          label="DWDM UCN"
          name="dwdm_ucn"
          value={formData.dwdm_ucn}
          onChange={handleChange}
          fullWidth
          sx={{ mb: 2 }}
          helperText="Individual circuit ID to distinguish DWDM channels"
        />
        <TextField
          label="Equipment"
          name="equipment"
          value={formData.equipment}
          onChange={handleChange}
          fullWidth
          sx={{ mb: 2 }}
        />
        <TextField
          label="CAPEX Cost to Light"
          name="capex_cost_to_light"
          value={formData.capex_cost_to_light}
          onChange={handleChange}
          type="number"
          fullWidth
          sx={{ mb: 2 }}
        />
        <div>
          <Checkbox
            name="in_use"
            checked={!!formData.in_use}
            onChange={handleChange}
          /> In Use
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSubmit(formData)} variant="contained">{mode === 'add' ? 'Add' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function DarkFiberModal({ open, onClose, circuitId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [editId, setEditId] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [reservationSnackbar, setReservationSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchRows = async () => {
    setLoading(true);
    const data = await getDarkFiberDetails(circuitId);
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    if (open && circuitId) fetchRows();
  }, [open, circuitId]);

  const handleAdd = () => {
    setFormMode('add');
    setEditRow(null);
    setFormOpen(true);
    setEditId(null);
  };

  const handleEdit = (row) => {
    setFormMode('edit');
    setEditRow({
      dwdm_wavelength: row.dwdm_wavelength || '',
      dwdm_ucn: row.dwdm_ucn || '',
      equipment: row.equipment || '',
      in_use: !!row.in_use,
      capex_cost_to_light: row.capex_cost_to_light || '',
    });
    setEditId(row.id);
    setFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this dark fiber detail?')) {
      await deleteDarkFiberDetail(id);
      fetchRows();
    }
  };

  const handleReserve = async (id, dwdm_ucn) => {
    const reservedBy = prompt('Enter your name/identifier for the reservation:');
    if (reservedBy) {
      try {
        const response = await reserveDarkFiber(id, reservedBy);
        setReservationSnackbar({
          open: true,
          message: `DWDM UCN ${dwdm_ucn} reserved successfully for 60 days! Expires: ${new Date(response.expires_at).toLocaleDateString()}`,
          severity: 'success'
        });
        fetchRows();
      } catch (error) {
        setReservationSnackbar({
          open: true,
          message: `Failed to reserve DWDM UCN ${dwdm_ucn}: ${error.message}`,
          severity: 'error'
        });
      }
    }
  };

  const handleRelease = async (id, dwdm_ucn) => {
    if (window.confirm('Are you sure you want to release this reservation?')) {
      try {
        await releaseDarkFiber(id);
        setReservationSnackbar({
          open: true,
          message: `DWDM UCN ${dwdm_ucn} reservation released successfully!`,
          severity: 'success'
        });
        fetchRows();
      } catch (error) {
        setReservationSnackbar({
          open: true,
          message: `Failed to release reservation: ${error.message}`,
          severity: 'error'
        });
      }
    }
  };

  const handleFormSubmit = async (formData) => {
    if (formMode === 'add') {
      await addDarkFiberDetail({ ...formData, circuit_id: circuitId });
    } else if (formMode === 'edit') {
      await editDarkFiberDetail(editId, formData);
    }
    setFormOpen(false);
    fetchRows();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Box>
            <Box component="span" sx={{ display: 'block', fontSize: '1.25rem', fontWeight: 500 }}>
              Dark Fiber Details for {circuitId}
            </Box>
            <Box component="span" sx={{ display: 'block', fontSize: '0.875rem', color: 'text.secondary', mt: 0.5 }}>
              Manage DWDM channels and reservations
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography>Loading...</Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>DWDM Wavelength</TableCell>
                  <TableCell>DWDM UCN</TableCell>
                  <TableCell>Equipment</TableCell>
                  <TableCell>In Use</TableCell>
                  <TableCell>Reserved</TableCell>
                  <TableCell>Reserved By</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell>CAPEX Cost</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.id}>
                    <TableCell>{row.dwdm_wavelength}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {row.dwdm_ucn}
                        {row.is_reserved && (
                          <Chip
                            label={isExpired(row.reservation_expires_at) ? 'EXPIRED' : 'RESERVED'}
                            color={isExpired(row.reservation_expires_at) ? 'error' : 'warning'}
                            size="small"
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{row.equipment}</TableCell>
                    <TableCell>
                      <Checkbox checked={!!row.in_use} disabled />
                    </TableCell>
                    <TableCell>
                      <Checkbox checked={!!row.is_reserved} disabled />
                    </TableCell>
                    <TableCell>{row.reserved_by}</TableCell>
                    <TableCell>
                      {row.reservation_expires_at && (
                        <Typography 
                          variant="body2" 
                          color={isExpired(row.reservation_expires_at) ? 'error' : 'text.primary'}
                        >
                          {formatDate(row.reservation_expires_at)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{row.capex_cost_to_light}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton onClick={() => handleEdit(row)} size="small">
                          <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handleDelete(row.id)} size="small">
                          <DeleteIcon />
                        </IconButton>
                        {row.is_reserved && !isExpired(row.reservation_expires_at) ? (
                          <IconButton 
                            onClick={() => handleRelease(row.id, row.dwdm_ucn)} 
                            size="small"
                            color="warning"
                            title="Release reservation"
                          >
                            <BookmarkIcon />
                          </IconButton>
                        ) : (
                          <IconButton 
                            onClick={() => handleReserve(row.id, row.dwdm_ucn)} 
                            size="small"
                            color="primary"
                            title="Reserve for 60 days"
                          >
                            <BookmarkBorderIcon />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Button startIcon={<AddIcon />} onClick={handleAdd} sx={{ mt: 2 }}>
            Add Dark Fiber Detail
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit Form Dialog */}
      <DarkFiberFormDialog
        key={formMode + (editId || 'add')}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={formMode === 'edit' ? editRow : defaultForm}
        mode={formMode}
      />

      {/* Reservation Notification */}
      <Snackbar
        open={reservationSnackbar.open}
        autoHideDuration={6000}
        onClose={() => setReservationSnackbar({ ...reservationSnackbar, open: false })}
      >
        <Alert
          onClose={() => setReservationSnackbar({ ...reservationSnackbar, open: false })}
          severity={reservationSnackbar.severity}
          sx={{ width: '100%' }}
        >
          {reservationSnackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default DarkFiberModal; 