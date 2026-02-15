import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Grid, Paper, Chip, IconButton, Tooltip, TextField, Select, MenuItem,
  FormControl, InputLabel, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Alert, Tabs, Tab, Divider, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import {
  getRackElevation, createDevice, updateDevice, deleteDevice,
  updateClientRURanges, updateRackIPCReserved
} from '../api';

// Client color palette for visual differentiation
const CLIENT_COLORS = [
  '#81c784', '#64b5f6', '#ba68c8', '#ffb74d', '#4dd0e1',
  '#aed581', '#7986cb', '#f06292', '#fff176', '#4db6ac',
  '#90a4ae', '#e57373', '#9575cd', '#ffd54f', '#4fc3f7'
];

const RackElevationDialog = ({ open, onClose, rackId, onDeviceChange }) => {
  const [loading, setLoading] = useState(true);
  const [elevationData, setElevationData] = useState(null);
  const [selectedRU, setSelectedRU] = useState(null);
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [deviceMode, setDeviceMode] = useState('add');
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
  const [activeTab, setActiveTab] = useState(0);
  
  // RU assignment mode state
  const [assignmentMode, setAssignmentMode] = useState(null); // null, 'client', or 'ipc'
  const [selectedClientForAssign, setSelectedClientForAssign] = useState(null);
  const [pendingRURanges, setPendingRURanges] = useState({}); // clientId -> [{start, end}]
  const [pendingIPCRanges, setPendingIPCRanges] = useState([]); // [{start, end}]
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (open && rackId) {
      loadElevationData();
      setActiveTab(0);
      setAssignmentMode(null);
      setHasUnsavedChanges(false);
    }
  }, [open, rackId]);

  const loadElevationData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRackElevation(rackId);
      setElevationData(data);
      
      // Initialize pending ranges from loaded data
      const clientRanges = {};
      data.clients.forEach(client => {
        clientRanges[client.id] = client.ru_ranges || [];
      });
      setPendingRURanges(clientRanges);
      setPendingIPCRanges(data.rack.ipc_reserved_ru_ranges || []);
      setHasUnsavedChanges(false);
    } catch (err) {
      setError('Failed to load rack elevation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Build client color map
  const clientColorMap = useMemo(() => {
    if (!elevationData) return {};
    const map = {};
    elevationData.clients.forEach((client, index) => {
      map[client.id] = CLIENT_COLORS[index % CLIENT_COLORS.length];
    });
    return map;
  }, [elevationData]);

  // Calculate RU occupancy from current state (including pending changes)
  const getRUOccupancy = useCallback(() => {
    if (!elevationData) return {};
    
    const totalRU = elevationData.rack.total_ru || 42;
    const occupancy = {};
    
    for (let i = 1; i <= totalRU; i++) {
      occupancy[i] = { type: 'free', data: null };
    }
    
    // Mark IPC reserved RUs (from pending state)
    pendingIPCRanges.forEach(range => {
      for (let ru = range.start; ru <= range.end; ru++) {
        if (occupancy[ru]) {
          occupancy[ru] = { type: 'ipc_reserved', data: range };
        }
      }
    });
    
    // Mark client allocated RUs (from pending state)
    elevationData.clients.forEach(client => {
      const ranges = pendingRURanges[client.id] || [];
      ranges.forEach(range => {
        for (let ru = range.start; ru <= range.end; ru++) {
          if (occupancy[ru]) {
            occupancy[ru] = { type: 'client', data: client };
          }
        }
      });
    });
    
    // Mark device occupied RUs
    elevationData.devices.forEach(device => {
      for (let ru = device.start_ru; ru < device.start_ru + device.height_ru; ru++) {
        if (occupancy[ru]) {
          const ownerClient = elevationData.clients.find(c => c.id === device.client_id);
          occupancy[ru] = { type: 'device', data: device, client: ownerClient };
        }
      }
    });
    
    return occupancy;
  }, [elevationData, pendingRURanges, pendingIPCRanges]);

  const getRUColor = (occupancyInfo) => {
    switch (occupancyInfo.type) {
      case 'ipc_reserved':
        return '#ffeb3b';
      case 'client':
        return clientColorMap[occupancyInfo.data?.id] || '#81c784';
      case 'device':
        return occupancyInfo.client ? (clientColorMap[occupancyInfo.client.id] || '#64b5f6') : '#64b5f6';
      default:
        return '#f5f5f5';
    }
  };

  // Toggle individual RU in assignment mode
  const toggleRUAssignment = (ruNum, occupancy) => {
    if (!assignmentMode) return;
    
    const occInfo = occupancy[ruNum];
    
    if (assignmentMode === 'ipc') {
      // Toggle IPC reserved for this RU
      const isCurrentlyIPC = occInfo.type === 'ipc_reserved';
      if (isCurrentlyIPC) {
        // Remove from IPC
        const newRanges = removeRUFromRanges(pendingIPCRanges, ruNum);
        setPendingIPCRanges(newRanges);
      } else if (occInfo.type === 'free') {
        // Add to IPC
        const newRanges = addRUToRanges(pendingIPCRanges, ruNum);
        setPendingIPCRanges(newRanges);
      } else {
        return; // Can't assign IPC to occupied RU
      }
      setHasUnsavedChanges(true);
    } else if (assignmentMode === 'client' && selectedClientForAssign) {
      const clientId = selectedClientForAssign;
      const isCurrentlyThisClient = occInfo.type === 'client' && occInfo.data?.id === clientId;
      
      if (isCurrentlyThisClient) {
        // Remove from this client
        const clientRanges = pendingRURanges[clientId] || [];
        const newRanges = removeRUFromRanges(clientRanges, ruNum);
        setPendingRURanges(prev => ({ ...prev, [clientId]: newRanges }));
      } else if (occInfo.type === 'free') {
        // Add to this client
        const clientRanges = pendingRURanges[clientId] || [];
        const newRanges = addRUToRanges(clientRanges, ruNum);
        setPendingRURanges(prev => ({ ...prev, [clientId]: newRanges }));
      } else {
        return; // Can't assign to occupied RU
      }
      setHasUnsavedChanges(true);
    }
  };

  // Utility: Add a single RU to a ranges array, merging adjacent ranges
  const addRUToRanges = (ranges, ru) => {
    const allRUs = new Set();
    ranges.forEach(r => {
      for (let i = r.start; i <= r.end; i++) allRUs.add(i);
    });
    allRUs.add(ru);
    return consolidateRanges(allRUs);
  };

  // Utility: Remove a single RU from a ranges array
  const removeRUFromRanges = (ranges, ru) => {
    const allRUs = new Set();
    ranges.forEach(r => {
      for (let i = r.start; i <= r.end; i++) allRUs.add(i);
    });
    allRUs.delete(ru);
    return consolidateRanges(allRUs);
  };

  // Convert set of RU numbers to consolidated ranges
  const consolidateRanges = (ruSet) => {
    if (ruSet.size === 0) return [];
    const sorted = [...ruSet].sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let end = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push({ start, end });
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push({ start, end });
    return ranges;
  };

  // Save all RU range assignments
  const handleSaveAssignments = async () => {
    try {
      setError(null);
      
      // Save IPC reserved ranges
      await updateRackIPCReserved(rackId, pendingIPCRanges);
      
      // Save each client's RU ranges
      for (const client of elevationData.clients) {
        const ranges = pendingRURanges[client.id] || [];
        await updateClientRURanges(client.id, ranges);
      }
      
      setSuccess('RU assignments saved successfully');
      setHasUnsavedChanges(false);
      await loadElevationData();
      if (onDeviceChange) onDeviceChange();
    } catch (err) {
      setError('Failed to save assignments: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRUClick = (ruNumber, occupancyInfo) => {
    // Tab 0 (Rack Elevation) - view only, no editing
    if (activeTab === 0) {
      setSelectedRU({ ruNumber, occupancyInfo });
      return;
    }
    
    if (assignmentMode) {
      // In assignment mode, toggle the RU
      const occupancy = getRUOccupancy();
      toggleRUAssignment(ruNumber, occupancy);
      return;
    }
    
    setSelectedRU({ ruNumber, occupancyInfo });
    
    // Tab 1 (RU Assignment) - clicking on a client-allocated, IPC reserved, or device RU opens the device form
    if (activeTab === 1 && (occupancyInfo.type === 'client' || occupancyInfo.type === 'ipc_reserved' || occupancyInfo.type === 'device')) {
      if (occupancyInfo.type === 'device') {
        // Edit existing device
        handleEditDevice(occupancyInfo.data);
      } else {
        // Add device to this RU, pre-filling client if it's a client-allocated RU
        setDeviceMode('add');
        setDeviceFormData({
          client_id: occupancyInfo.type === 'client' ? occupancyInfo.data?.id || '' : '',
          name: '',
          model: '',
          serial: '',
          start_ru: ruNumber,
          height_ru: 1,
          position: 'front',
          power_kw: '',
          notes: ''
        });
        setDeviceDialogOpen(true);
      }
    }
  };

  const handleAddDevice = () => {
    setDeviceMode('add');
    setDeviceFormData({
      client_id: elevationData?.clients?.length === 1 ? elevationData.clients[0].id : '',
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

  // Format RU ranges for display
  const formatRanges = (ranges) => {
    if (!ranges || ranges.length === 0) return 'None';
    return ranges.map(r => r.start === r.end ? `U${r.start}` : `U${r.start}-U${r.end}`).join(', ');
  };

  // Count total RUs in ranges
  const countRangeRUs = (ranges) => {
    if (!ranges || ranges.length === 0) return 0;
    return ranges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
  };

  const renderRackElevation = () => {
    if (!elevationData) return null;
    
    const totalRU = elevationData.rack.total_ru || 42;
    const occupancy = getRUOccupancy();
    const ruNumbers = [];
    
    for (let i = totalRU; i >= 1; i--) {
      ruNumbers.push(i);
    }
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 600, overflowY: 'auto', p: 1, border: '2px solid #424242', borderRadius: 1, backgroundColor: '#212121' }}>
        {ruNumbers.map(ruNum => {
          const occupancyInfo = occupancy[ruNum];
          const color = getRUColor(occupancyInfo);
          const isAssigning = assignmentMode !== null;
          const isSelectable = isAssigning && (
            occupancyInfo.type === 'free' || 
            (assignmentMode === 'ipc' && occupancyInfo.type === 'ipc_reserved') ||
            (assignmentMode === 'client' && occupancyInfo.type === 'client' && occupancyInfo.data?.id === selectedClientForAssign)
          );
          
          // For devices that span multiple RUs, show "Customer Name - Device Type" only on the first RU
          let deviceLabel = '';
          if (occupancyInfo.type === 'device') {
            const dev = occupancyInfo.data;
            if (ruNum === dev.start_ru) {
              const clientName = occupancyInfo.client?.client_name || 'Unassigned';
              deviceLabel = `${clientName} - ${dev.name}`;
            }
          }
          
          return (
            <Tooltip
              key={ruNum}
              title={
                occupancyInfo.type === 'client' 
                  ? `Client: ${occupancyInfo.data.client_name}`
                  : occupancyInfo.type === 'device'
                  ? `${occupancyInfo.client?.client_name || 'Unassigned'} - ${occupancyInfo.data.name}${occupancyInfo.data.model ? ` (${occupancyInfo.data.model})` : ''}`
                  : occupancyInfo.type === 'ipc_reserved'
                  ? 'IPC Reserved'
                  : 'Free'
              }
            >
              <Paper
                elevation={0}
                sx={{
                  px: 1.5,
                  py: 0.3,
                  backgroundColor: color,
                  border: selectedRU?.ruNumber === ruNum ? '2px solid #1976d2' : '1px solid rgba(0,0,0,0.15)',
                  cursor: activeTab === 0 
                    ? 'default' 
                    : isAssigning 
                      ? (isSelectable ? 'pointer' : 'not-allowed') 
                      : (activeTab === 1 && (occupancyInfo.type === 'client' || occupancyInfo.type === 'ipc_reserved' || occupancyInfo.type === 'device')) 
                        ? 'pointer' 
                        : 'default',
                  opacity: isAssigning && !isSelectable && occupancyInfo.type !== 'free' ? 0.5 : 1,
                  '&:hover': {
                    opacity: activeTab === 0 ? undefined : (isSelectable || !isAssigning ? 0.85 : undefined),
                    boxShadow: isSelectable ? '0 0 0 2px #1976d2' : 
                      (activeTab === 1 && !isAssigning && (occupancyInfo.type === 'client' || occupancyInfo.type === 'ipc_reserved' || occupancyInfo.type === 'device')) 
                        ? '0 0 0 2px #1976d2' 
                        : undefined
                  },
                  minHeight: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 0.5
                }}
                onClick={() => handleRUClick(ruNum, occupancyInfo)}
              >
                <Typography variant="caption" fontWeight="bold" sx={{ minWidth: 30, color: occupancyInfo.type === 'free' ? '#666' : '#000' }}>
                  U{ruNum}
                </Typography>
                <Typography variant="caption" noWrap sx={{ flex: 1, textAlign: 'center', fontSize: '0.7rem' }}>
                  {occupancyInfo.type === 'device' && deviceLabel}
                  {occupancyInfo.type === 'client' && occupancyInfo.data.client_name}
                  {occupancyInfo.type === 'ipc_reserved' && 'IPC'}
                </Typography>
              </Paper>
            </Tooltip>
          );
        })}
      </Box>
    );
  };

  // Summary stats
  const getRackSummary = () => {
    if (!elevationData) return null;
    const totalRU = elevationData.rack.total_ru || 42;
    const occupancy = getRUOccupancy();
    let free = 0, ipc = 0, clientAlloc = 0, deviceOccupied = 0;
    
    for (let i = 1; i <= totalRU; i++) {
      switch (occupancy[i]?.type) {
        case 'free': free++; break;
        case 'ipc_reserved': ipc++; break;
        case 'client': clientAlloc++; break;
        case 'device': deviceOccupied++; break;
        default: break;
      }
    }
    
    return { totalRU, free, ipc, clientAlloc, deviceOccupied };
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Rack Elevation - {elevationData?.rack.rack_id}
              {elevationData?.rack.rack_type && (
                <Chip 
                  label={elevationData.rack.rack_type} 
                  size="small" 
                  color={elevationData.rack.rack_type === 'dedicated' ? 'secondary' : 'primary'}
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading elevation data...</Typography>
            </Box>
          ) : elevationData ? (
            <>
              <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Tab label="Rack Elevation" />
                <Tab label="RU Assignment" />
                <Tab label="Devices" />
              </Tabs>
              
              {/* TAB 0: Rack Elevation View */}
              {activeTab === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    {/* Rack Info */}
                    <Paper sx={{ p: 2, mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom><strong>Rack Info</strong></Typography>
                      <Typography variant="body2">Type: <strong>{elevationData.rack.rack_type || 'shared'}</strong></Typography>
                      <Typography variant="body2">Total RU: <strong>{elevationData.rack.total_ru || 42}</strong></Typography>
                      <Typography variant="body2">Total Power: <strong>{elevationData.rack.total_power_kva} kVA</strong></Typography>
                      {(() => {
                        const summary = getRackSummary();
                        if (!summary) return null;
                        return (
                          <>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="body2">Free: <strong>{summary.free}</strong></Typography>
                            <Typography variant="body2">IPC Reserved: <strong>{summary.ipc}</strong></Typography>
                            <Typography variant="body2">Client Allocated: <strong>{summary.clientAlloc}</strong></Typography>
                            <Typography variant="body2">Device Occupied: <strong>{summary.deviceOccupied}</strong></Typography>
                          </>
                        );
                      })()}
                    </Paper>
                    
                    {/* Legend */}
                    <Paper sx={{ p: 2, mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom><strong>Legend</strong></Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 16, height: 16, backgroundColor: '#f5f5f5', border: '1px solid #ddd', borderRadius: 0.5 }} />
                          <Typography variant="caption">Free</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 16, height: 16, backgroundColor: '#ffeb3b', border: '1px solid #ddd', borderRadius: 0.5 }} />
                          <Typography variant="caption">IPC Reserved</Typography>
                        </Box>
                        {elevationData.clients.map((client, idx) => (
                          <Box key={client.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 16, height: 16, backgroundColor: clientColorMap[client.id], border: '1px solid #ddd', borderRadius: 0.5 }} />
                            <Typography variant="caption">{client.client_name}</Typography>
                          </Box>
                        ))}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 16, height: 16, backgroundColor: '#64b5f6', border: '1px solid #ddd', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ fontSize: 8, fontWeight: 'bold' }}>D</Typography>
                          </Box>
                          <Typography variant="caption">Device (inherits client color)</Typography>
                        </Box>
                      </Box>
                    </Paper>
                    
                  </Grid>
                  
                  <Grid item xs={12} md={9}>
                    <Typography variant="subtitle2" gutterBottom><strong>Rack Elevation</strong></Typography>
                    {renderRackElevation()}
                  </Grid>
                </Grid>
              )}
              
              {/* TAB 1: RU Assignment */}
              {activeTab === 1 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom><strong>Assignment Mode</strong></Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                        Select a mode then click RUs in the rack to assign/unassign them.
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Button
                          variant={assignmentMode === 'ipc' ? 'contained' : 'outlined'}
                          color="warning"
                          startIcon={<LockIcon />}
                          onClick={() => {
                            setAssignmentMode(assignmentMode === 'ipc' ? null : 'ipc');
                            setSelectedClientForAssign(null);
                          }}
                          size="small"
                          fullWidth
                        >
                          {assignmentMode === 'ipc' ? 'Assigning IPC Reserved' : 'Assign IPC Reserved'}
                        </Button>
                        
                        <Divider sx={{ my: 0.5 }} />
                        <Typography variant="caption" color="text.secondary">Assign RUs to Client:</Typography>
                        
                        {elevationData.clients.map(client => (
                          <Button
                            key={client.id}
                            variant={assignmentMode === 'client' && selectedClientForAssign === client.id ? 'contained' : 'outlined'}
                            startIcon={<PersonIcon />}
                            onClick={() => {
                              if (assignmentMode === 'client' && selectedClientForAssign === client.id) {
                                setAssignmentMode(null);
                                setSelectedClientForAssign(null);
                              } else {
                                setAssignmentMode('client');
                                setSelectedClientForAssign(client.id);
                              }
                            }}
                            size="small"
                            fullWidth
                            sx={{ 
                              borderColor: clientColorMap[client.id],
                              color: assignmentMode === 'client' && selectedClientForAssign === client.id ? '#fff' : clientColorMap[client.id],
                              backgroundColor: assignmentMode === 'client' && selectedClientForAssign === client.id ? clientColorMap[client.id] : 'transparent',
                              '&:hover': {
                                backgroundColor: clientColorMap[client.id],
                                color: '#fff',
                                opacity: 0.9
                              }
                            }}
                          >
                            {client.client_name}
                          </Button>
                        ))}
                      </Box>
                      
                      {hasUnsavedChanges && (
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<SaveIcon />}
                          onClick={handleSaveAssignments}
                          fullWidth
                          sx={{ mt: 2 }}
                        >
                          Save All Assignments
                        </Button>
                      )}
                    </Paper>
                    
                    {/* Current Assignments Summary */}
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom><strong>Current Assignments</strong></Typography>
                      
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">IPC Reserved:</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {formatRanges(pendingIPCRanges)} ({countRangeRUs(pendingIPCRanges)} RUs)
                        </Typography>
                      </Box>
                      
                      {elevationData.clients.map(client => (
                        <Box key={client.id} sx={{ mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 10, height: 10, backgroundColor: clientColorMap[client.id], borderRadius: '50%' }} />
                            <Typography variant="caption" color="text.secondary">{client.client_name}:</Typography>
                          </Box>
                          <Typography variant="body2" fontWeight="bold">
                            {formatRanges(pendingRURanges[client.id])} ({countRangeRUs(pendingRURanges[client.id])} / {client.ru_purchased || 0} purchased)
                          </Typography>
                        </Box>
                      ))}
                    </Paper>
                  </Grid>
                  
                  <Grid item xs={12} md={8}>
                    {assignmentMode ? (
                      <Alert severity="info" sx={{ mb: 1 }}>
                        {assignmentMode === 'ipc' 
                          ? 'Click on free RUs to mark as IPC Reserved, or click IPC reserved RUs to unmark them.'
                          : `Click on free RUs to assign to ${elevationData.clients.find(c => c.id === selectedClientForAssign)?.client_name || 'client'}, or click assigned RUs to unassign.`
                        }
                      </Alert>
                    ) : (
                      <Alert severity="info" sx={{ mb: 1 }}>
                        Click on a client-allocated or IPC reserved RU to add/edit a device in that position.
                      </Alert>
                    )}
                    {renderRackElevation()}
                  </Grid>
                </Grid>
              )}
              
              {/* TAB 2: Devices List */}
              {activeTab === 2 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1"><strong>Devices ({elevationData.devices.length})</strong></Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddDevice} size="small">
                      Add Device
                    </Button>
                  </Box>
                  
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Client</strong></TableCell>
                          <TableCell><strong>Device Type</strong></TableCell>
                          <TableCell><strong>Model</strong></TableCell>
                          <TableCell><strong>Serial</strong></TableCell>
                          <TableCell><strong>RU</strong></TableCell>
                          <TableCell><strong>Height</strong></TableCell>
                          <TableCell><strong>Position</strong></TableCell>
                          <TableCell><strong>Power (W)</strong></TableCell>
                          <TableCell align="center"><strong>Actions</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {elevationData.devices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} align="center">
                              <Typography variant="body2" color="text.secondary">
                                No devices configured
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          elevationData.devices.map(device => {
                            const client = elevationData.clients.find(c => c.id === device.client_id);
                            return (
                              <TableRow key={device.id}>
                                <TableCell>
                                  {client ? (
                                    <Chip 
                                      label={client.client_name} 
                                      size="small" 
                                      sx={{ backgroundColor: clientColorMap[client.id], color: '#000', fontWeight: 'bold' }}
                                    />
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">Unassigned</Typography>
                                  )}
                                </TableCell>
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
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </>
          ) : null}
        </DialogContent>
        
        <DialogActions>
          {hasUnsavedChanges && (
            <Alert severity="warning" sx={{ mr: 'auto', py: 0 }}>
              <Typography variant="caption">You have unsaved RU assignment changes</Typography>
            </Alert>
          )}
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Device Add/Edit Dialog */}
      <Dialog open={deviceDialogOpen} onClose={() => setDeviceDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{deviceMode === 'add' ? 'Add Device' : 'Edit Device'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Client *</InputLabel>
                <Select
                  value={deviceFormData.client_id}
                  label="Client *"
                  onChange={(e) => setDeviceFormData(prev => ({ ...prev, client_id: e.target.value }))}
                >
                  <MenuItem value="">
                    <em>-- Select Client --</em>
                  </MenuItem>
                  {elevationData?.clients?.map(client => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.client_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Device Type *"
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
                helperText={`Valid range: 1 - ${elevationData?.rack.total_ru || 42}`}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Height (RU) *"
                value={deviceFormData.height_ru}
                onChange={(e) => setDeviceFormData(prev => ({ ...prev, height_ru: e.target.value }))}
                inputProps={{ min: 1 }}
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
