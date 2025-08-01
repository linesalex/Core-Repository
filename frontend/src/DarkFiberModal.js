import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Checkbox, TextField, Typography, Box, Chip, Alert, Snackbar, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { getDarkFiberDetails, addDarkFiberDetail, editDarkFiberDetail, deleteDarkFiberDetail, reserveDarkFiber, releaseDarkFiber } from './api';
import { ValidatedTextField, ValidatedSelect, createValidator, scrollToFirstError } from './components/FormValidation';

const defaultForm = {
  dwdm_wavelength: '',
  dwdm_ucn: '',
  dark_fiber_bandwidth: '',
  equipment: '',
  in_use: false,
  capex_cost_to_light: '',
};

function DarkFiberFormDialog({ open, onClose, onSubmit, initialData, mode }) {
  const [formData, setFormData] = useState(initialData || defaultForm);
  const [validationError, setValidationError] = useState('');
  
  // Validation states
  const [formErrors, setFormErrors] = useState({});

  // Validation rules for Dark Fiber form
  const darkFiberValidationRules = {
    dwdm_wavelength: { type: 'required', message: 'DWDM Wavelength is required' },
    equipment: { type: 'required', message: 'Equipment is required' },
    capex_cost_to_light: [
      { type: 'number', message: 'CAPEX Cost must be a valid number' },
      { type: 'min', min: 0, message: 'CAPEX Cost must be greater than or equal to 0' }
    ]
  };

  // Validation function
  const validate = createValidator(darkFiberValidationRules);

  useEffect(() => {
    if (open) {
      setFormData(initialData || defaultForm);
      setValidationError('');
      setFormErrors({}); // Clear validation errors
    }
  }, [open, initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    
    // Clear validation error when user makes changes
    if (validationError) setValidationError('');
  };

  const handleSubmit = () => {
    // Validate form using validation framework
    const validationErrors = validate(formData);
    setFormErrors(validationErrors);

    // Check if there are validation errors
    if (Object.keys(validationErrors).length > 0) {
      scrollToFirstError(validationErrors);
      return;
    }

    // Custom validation: Bandwidth is required when DWDM UCN has a value
    if (formData.dwdm_ucn && formData.dwdm_ucn.trim() !== '' && (!formData.dark_fiber_bandwidth || formData.dark_fiber_bandwidth.trim() === '')) {
      setValidationError('Bandwidth is required when DWDM UCN is specified');
      return;
    }
    
    setValidationError('');
    setFormErrors({}); // Clear validation errors on success
    onSubmit(formData);
  };

  const bandwidthOptions = ['1Gb', '10Gb', '100Gb', '200Gb', '400Gb', '800Gb'];

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      disableRestoreFocus
      aria-labelledby="dark-fiber-form-dialog-title"
    >
      <DialogTitle id="dark-fiber-form-dialog-title">{mode === 'add' ? 'Add' : 'Edit'} Dark Fiber Detail</DialogTitle>
      <DialogContent>
        {validationError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {validationError}
          </Alert>
        )}
        <ValidatedTextField
          label="DWDM Wavelength *"
          name="dwdm_wavelength"
          value={formData.dwdm_wavelength}
          onChange={handleChange}
          fullWidth
          required
          field="dwdm_wavelength"
          errors={formErrors}
          sx={{ mb: 2 }}
        />
        <ValidatedTextField
          label="DWDM UCN"
          name="dwdm_ucn"
          value={formData.dwdm_ucn}
          onChange={handleChange}
          fullWidth
          field="dwdm_ucn"
          errors={formErrors}
          sx={{ mb: 2 }}
          helperText="Individual circuit ID to distinguish DWDM channels"
        />
        <ValidatedSelect
          fullWidth
          label="DWDM Bandwidth"
          value={formData.dark_fiber_bandwidth}
          onChange={handleChange}
          name="dark_fiber_bandwidth"
          field="dark_fiber_bandwidth"
          errors={formErrors}
          sx={{ mb: 2 }}
        >
          <MenuItem value="">
            <em>Select Bandwidth</em>
          </MenuItem>
          {bandwidthOptions.map(option => (
            <MenuItem key={option} value={option}>{option}</MenuItem>
          ))}
        </ValidatedSelect>
        <ValidatedTextField
          label="Equipment *"
          name="equipment"
          value={formData.equipment}
          onChange={handleChange}
          fullWidth
          required
          field="equipment"
          errors={formErrors}
          sx={{ mb: 2 }}
        />
        <ValidatedTextField
          label="CAPEX Cost to Light"
          name="capex_cost_to_light"
          value={formData.capex_cost_to_light}
          onChange={handleChange}
          type="number"
          fullWidth
          field="capex_cost_to_light"
          errors={formErrors}
          sx={{ mb: 2 }}
          inputProps={{ min: 0, step: 0.01 }}
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
        <Button onClick={handleSubmit} variant="contained">{mode === 'add' ? 'Add' : 'Save'}</Button>
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
      dark_fiber_bandwidth: row.bandwidth || '',
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
    // Map dark_fiber_bandwidth to bandwidth for backend API
    const apiData = {
      ...formData,
      bandwidth: formData.dark_fiber_bandwidth,
      circuit_id: circuitId
    };
    delete apiData.dark_fiber_bandwidth; // Remove the frontend field name
    
    if (formMode === 'add') {
      await addDarkFiberDetail(apiData);
    } else if (formMode === 'edit') {
      await editDarkFiberDetail(editId, apiData);
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
      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="xl" 
        fullWidth
        disableRestoreFocus
        aria-labelledby="dark-fiber-modal-title"
      >
        <DialogTitle id="dark-fiber-modal-title">
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
                  <TableCell>DWDM Bandwidth</TableCell>
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
                    <TableCell>{row.bandwidth || '-'}</TableCell>
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