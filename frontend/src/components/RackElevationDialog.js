import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Grid, Paper, Chip, IconButton, Tooltip, TextField, Select, MenuItem,
  FormControl, InputLabel, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getRackElevation, createDevice, updateDevice, deleteDevice } from '../api';

const RackElevationDialog = ({ open, onClose, rackId, onDeviceChange }) => {
  const [loading, setLoading] = useState(true);
  const [elevationData, setElevationData] = useState(null);
  const [selectedRU, setSelectedRU] = useState(null);
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [deviceMode, setDeviceMode] = useState('add'); // 'add' or 'edit'
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceFormData, setDeviceFormData] = useState({
    client_id: '',
    name: '',
    model: '',
    serial: '',
    start_ru: '',
    height_ru: 1,
    position: 'front',
    power_kw: '',
    notes: ''
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (open && rackId) {
      loadElevationData();
    }
  }, [open, rackId]);

  const loadElevationData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRackElevation(rackId);
      setElevationData(data);
    } catch (err) {
      setError('Failed to load rack elevation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate which RUs are occupied by which client or device
  const getRUOccupancy = () => {
    if (!elevationData) return {};
    
    const totalRU = elevationData.rack.total_ru || 30;
    const occupancy = {};
    
    // Initialize all RUs as free
    for (let i = 1; i <= totalRU; i++) {
      occupancy[i] = { type: 'free', data: null };
    }
    
    // Mark IPC reserved RUs
    if (elevationData.rack.ipc_reserved_ru_ranges) {
      elevationData.rack.ipc_reserved_ru_ranges.forEach(range => {
        for (let ru = range.start; ru <= range.end; ru++) {
          if (occupancy[ru]) {
            occupancy[ru] = { type: 'ipc_reserved', data: range };
          }
        }
      });
    }
    
    // Mark client allocated RUs
    elevationData.clients.forEach(client => {
      if (client.ru_ranges) {
        client.ru_ranges.forEach(range => {
          for (let ru = range.start; ru <= range.end; ru++) {
            if (occupancy[ru]) {
              occupancy[ru] = { type: 'client', data: client };
            }
          }
        });
      }
    });
    
    // Mark device occupied RUs
    elevationData.devices.forEach(device => {
      for (let ru = device.start_ru; ru < device.start_ru + device.height_ru; ru++) {
        if (occupancy[ru]) {
          occupancy[ru] = { type: 'device', data: device };
        }
      }
    });
    
    return occupancy;
  };

  const getRUColor = (occupancyInfo) => {
    switch (occupancyInfo.type) {
      case 'ipc_reserved':
        return '#ffeb3b'; // Yellow for IPC reserved
      case 'client':
        return '#81c784'; // Green for client allocated
      case 'device':
        return '#64b5f6'; // Blue for device occupied
      default:
        return '#f5f5f5'; // Light gray for free
    }
  };

  const handleRUClick = (ruNumber, occupancyInfo) => {
    setSelectedRU({ ruNumber, occupancyInfo });
    
    // If clicking on a device, open edit mode
    if (occupancyInfo.type === 'device') {
      handleEditDevice(occupancyInfo.data);
    }
  };

  const handleAddDevice = () => {
    setDeviceMode('add');
    setDeviceFormData({
      client_id: '',
      name: '',
      model: '',
      serial: '',
      start_ru: selectedRU?.ruNumber || '',
      height_ru: 1,
      position: 'front',
      power_kw: '',
      notes: ''
    });
    setDeviceDialogOpen(true);
  };

  const handleEditDevice = (device) => {
    setDeviceMode('edit');
    setSelectedDevice(device);
    setDeviceFormData({
      client_id: device.client_id || '',
      name: device.name,
      model: device.model || '',
      serial: device.serial || '',
      start_ru: device.start_ru,
      height_ru: device.height_ru,
      position: device.position,
      power_kw: device.power_kw || '',
      notes: device.notes || ''
    });
    setDeviceDialogOpen(true);
  };

  const handleDeviceSave = async () => {
    try {
      setError(null);
      
      if (deviceMode === 'add') {
        await createDevice(rackId, deviceFormData);
        setSuccess('Device created successfully');
      } else {
        await updateDevice(selectedDevice.id, deviceFormData);
        setSuccess('Device updated successfully');
      }
      
      setDeviceDialogOpen(false);
      await loadElevationData();
      if (onDeviceChange) onDeviceChange();
    } catch (err) {
      setError('Failed to save device: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeviceDelete = async (deviceId) => {
    if (!window.confirm('Are you sure you want to delete this device?')) return;
    
    try {
      await deleteDevice(deviceId);
      setSuccess('Device deleted successfully');
      await loadElevationData();
      if (onDeviceChange) onDeviceChange();
    } catch (err) {
      setError('Failed to delete device: ' + (err.response?.data?.error || err.message));
    }
  };

  const renderRackElevation = () => {
    if (!elevationData) return null;
    
    const totalRU = elevationData.rack.total_ru || 30;
    const occupancy = getRUOccupancy();
    const ruNumbers = [];
    
    // Build array from top to bottom (highest RU to lowest)
    for (let i = totalRU; i >= 1; i--) {
      ruNumbers.push(i);
    }
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 600, overflowY: 'auto', p: 2 }}>
        {ruNumbers.map(ruNum => {
          const occupancyInfo = occupancy[ruNum];
          const color = getRUColor(occupancyInfo);
          
          return (
            <Tooltip
              key={ruNum}
              title={
                occupancyInfo.type === 'client' 
                  ? `Client: ${occupancyInfo.data.client_name}`
                  : occupancyInfo.type === 'device'
                  ? `Device: ${occupancyInfo.data.name} (${occupancyInfo.data.model || 'N/A'})`
                  : occupancyInfo.type === 'ipc_reserved'
                  ? 'IPC Reserved'
                  : 'Free'
              }
            >
              <Paper
                sx={{
                  p: 1,
                  backgroundColor: color,
                  border: selectedRU?.ruNumber === ruNum ? '3px solid #1976d2' : '1px solid #ddd',
                  cursor: 'pointer',
                  '&:hover': {
                    opacity: 0.8
                  },
                  minHeight: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onClick={() => handleRUClick(ruNum, occupancyInfo)}
              >
                <Typography variant="body2" fontWeight="bold">
                  U{ruNum}
                </Typography>
                <Typography variant="caption">
                  {occupancyInfo.type === 'device' && occupancyInfo.data.name}
                  {occupancyInfo.type === 'client' && `Client: ${occupancyInfo.data.client_name}`}
                  {occupancyInfo.type === 'ipc_reserved' && 'IPC Reserved'}
                  {occupancyInfo.type === 'free' && 'Free'}
                </Typography>
              </Paper>
            </Tooltip>
          );
        })}
      </Box>
    );
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Rack Elevation - {elevationData?.rack.rack_id}
            </Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading elevation data...</Typography>
            </Box>
          ) : elevationData ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom><strong>Rack Info</strong></Typography>
                  <Typography variant="body2">Type: {elevationData.rack.rack_type || 'shared'}</Typography>
                  <Typography variant="body2">Total RU: {elevationData.rack.total_ru || 30}</Typography>
                  <Typography variant="body2">Total Power: {elevationData.rack.total_power_kva} kVA</Typography>
                </Paper>
                
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom><strong>Legend</strong></Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 20, height: 20, backgroundColor: '#f5f5f5', border: '1px solid #ddd' }} />
                      <Typography variant="body2">Free</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 20, height: 20, backgroundColor: '#ffeb3b', border: '1px solid #ddd' }} />
                      <Typography variant="body2">IPC Reserved</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 20, height: 20, backgroundColor: '#81c784', border: '1px solid #ddd' }} />
                      <Typography variant="body2">Client Allocated</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 20, height: 20, backgroundColor: '#64b5f6', border: '1px solid #ddd' }} />
                      <Typography variant="body2">Device Occupied</Typography>
                    </Box>
                  </Box>
                </Paper>
                
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddDevice}
                  fullWidth
                >
                  Add Device
                </Button>
              </Grid>
              
              <Grid item xs={12} md={8}>
                <Typography variant="subtitle1" gutterBottom><strong>Rack Elevation</strong></Typography>
                {renderRackElevation()}
              </Grid>
              
              {/* Devices List */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}><strong>Devices</strong></Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Name</strong></TableCell>
                        <TableCell><strong>Model</strong></TableCell>
                        <TableCell><strong>Serial</strong></TableCell>
                        <TableCell><strong>RU</strong></TableCell>
                        <TableCell><strong>Height</strong></TableCell>
                        <TableCell><strong>Position</strong></TableCell>
                        <TableCell><strong>Power (kW)</strong></TableCell>
                        <TableCell align="center"><strong>Actions</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {elevationData.devices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center">
                            <Typography variant="body2" color="text.secondary">
                              No devices configured
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        elevationData.devices.map(device => (
                          <TableRow key={device.id}>
                            <TableCell>{device.name}</TableCell>
                            <TableCell>{device.model || 'N/A'}</TableCell>
                            <TableCell>{device.serial || 'N/A'}</TableCell>
                            <TableCell>U{device.start_ru}</TableCell>
                            <TableCell>{device.height_ru}U</TableCell>
                            <TableCell>{device.position}</TableCell>
                            <TableCell>{device.power_kw || 'N/A'}</TableCell>
                            <TableCell align="center">
                              <IconButton size="small" onClick={() => handleEditDevice(device)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" onClick={() => handleDeviceDelete(device.id)} color="error">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          ) : null}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Device Add/Edit Dialog */}
      <Dialog open={deviceDialogOpen} onClose={() => setDeviceDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{deviceMode === 'add' ? 'Add Device' : 'Edit Device'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Device Name *"
                value={deviceFormData.name}
                onChange={(e) => setDeviceFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Model"
                value={deviceFormData.model}
                onChange={(e) => setDeviceFormData(prev => ({ ...prev, model: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Serial Number"
                value={deviceFormData.serial}
                onChange={(e) => setDeviceFormData(prev => ({ ...prev, serial: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Start RU *"
                value={deviceFormData.start_ru}
                onChange={(e) => setDeviceFormData(prev => ({ ...prev, start_ru: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Height (RU) *"
                value={deviceFormData.height_ru}
                onChange={(e) => setDeviceFormData(prev => ({ ...prev, height_ru: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Position</InputLabel>
                <Select
                  value={deviceFormData.position}
                  label="Position"
                  onChange={(e) => setDeviceFormData(prev => ({ ...prev, position: e.target.value }))}
                >
                  <MenuItem value="front">Front</MenuItem>
                  <MenuItem value="rear">Rear</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                step="1"
                label="Power (W)"
                value={deviceFormData.power_kw}
                onChange={(e) => setDeviceFormData(prev => ({ ...prev, power_kw: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={deviceFormData.notes}
                onChange={(e) => setDeviceFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeviceDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeviceSave} variant="contained">
            {deviceMode === 'add' ? 'Add Device' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RackElevationDialog;

