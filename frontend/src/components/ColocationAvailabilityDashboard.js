import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Grid, Chip, LinearProgress, Collapse, IconButton, Alert, Button, Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import StorageIcon from '@mui/icons-material/Storage';
import BoltIcon from '@mui/icons-material/Bolt';
import PeopleIcon from '@mui/icons-material/People';

import LocationOnIcon from '@mui/icons-material/LocationOn';
import { getColocationAvailability } from '../api';

const ColocationAvailabilityDashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedLocations, setExpandedLocations] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getColocationAvailability();
      setData(result);
    } catch (err) {
      setError('Failed to load availability data: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const toggleLocation = (locationCode) => {
    setExpandedLocations(prev => ({
      ...prev,
      [locationCode]: !prev[locationCode]
    }));
  };

  // Calculate global totals
  const totals = data.reduce((acc, loc) => ({
    totalRacks: acc.totalRacks + loc.total_racks,
    totalRU: acc.totalRU + loc.total_ru_capacity,
    allocatedRU: acc.allocatedRU + loc.allocated_ru,
    ipcReservedRU: acc.ipcReservedRU + (loc.ipc_reserved_ru || 0),
    availableRU: acc.availableRU + Math.max(0, loc.available_ru),
    totalPower: acc.totalPower + loc.total_power_capacity,
    allocatedPower: acc.allocatedPower + loc.allocated_power,
    availablePower: acc.availablePower + Math.max(0, loc.available_power),
    totalClients: acc.totalClients + loc.client_count,
    totalDevices: acc.totalDevices + loc.device_count
  }), {
    totalRacks: 0, totalRU: 0, allocatedRU: 0, ipcReservedRU: 0, availableRU: 0,
    totalPower: 0, allocatedPower: 0, availablePower: 0, totalClients: 0, totalDevices: 0
  });

  const getUtilizationColor = (percent) => {
    if (percent >= 90) return 'error';
    if (percent >= 70) return 'warning';
    return 'success';
  };

  const getUtilizationIcon = (percent) => {
    if (percent >= 90) return <ErrorIcon fontSize="small" color="error" />;
    if (percent >= 70) return <WarningIcon fontSize="small" color="warning" />;
    return <CheckCircleIcon fontSize="small" color="success" />;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Loading availability data...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} component="h2">
          Colocation Availability Dashboard
        </Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <LocationOnIcon color="primary" fontSize="small" />
                <Typography variant="caption" color="text.secondary">Locations</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{data.length}</Typography>
              <Typography variant="caption" color="text.secondary">{totals.totalRacks} total racks</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <StorageIcon color="primary" fontSize="small" />
                <Typography variant="caption" color="text.secondary">Rack Units</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'success.main' }}>
                {totals.availableRU}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                available of {totals.totalRU} total ({totals.allocatedRU} allocated, {totals.ipcReservedRU} IPC reserved)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <BoltIcon color="primary" fontSize="small" />
                <Typography variant="caption" color="text.secondary">Power (kVA)</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'success.main' }}>
                {totals.availablePower.toFixed(1)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                available of {totals.totalPower.toFixed(1)} total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PeopleIcon color="primary" fontSize="small" />
                <Typography variant="caption" color="text.secondary">Clients & Devices</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{totals.totalClients}</Typography>
              <Typography variant="caption" color="text.secondary">{totals.totalDevices} devices across all locations</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Per-Location Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell width="40px"></TableCell>
              <TableCell><strong>Location</strong></TableCell>
              <TableCell><strong>City</strong></TableCell>
              <TableCell><strong>Datacenter Name</strong></TableCell>
              <TableCell align="center"><strong>Racks</strong></TableCell>
              <TableCell align="center"><strong>RU Available</strong></TableCell>
              <TableCell align="center"><strong>RU Utilization</strong></TableCell>
              <TableCell align="center"><strong>Power Available (kVA)</strong></TableCell>
              <TableCell align="center"><strong>Power Utilization</strong></TableCell>
              <TableCell align="center"><strong>Clients</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No colocation locations found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              data.map(location => {
                const ruPercent = location.total_ru_capacity > 0 
                  ? Math.round(((location.allocated_ru + (location.ipc_reserved_ru || 0)) / location.total_ru_capacity) * 100) 
                  : 0;
                const powerPercent = location.total_power_capacity > 0 
                  ? Math.round((location.allocated_power / location.total_power_capacity) * 100) 
                  : 0;
                const isExpanded = expandedLocations[location.location_code];
                
                return (
                  <React.Fragment key={location.location_ref_id}>
                    <TableRow 
                      hover 
                      sx={{ cursor: 'pointer', '& td': { borderBottom: isExpanded ? 'none' : undefined } }}
                      onClick={() => toggleLocation(location.location_code)}
                    >
                      <TableCell>
                        <IconButton size="small">
                          {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">{location.location_code}</Typography>
                      </TableCell>
                      <TableCell>{location.city}</TableCell>
                      <TableCell>{location.datacenter_name || 'N/A'}</TableCell>
                      <TableCell align="center">
                        <Chip label={location.total_racks} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight="bold" color={location.available_ru > 0 ? 'success.main' : 'error.main'}>
                          {Math.max(0, location.available_ru)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                          {getUtilizationIcon(ruPercent)}
                          <Box sx={{ width: 60 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={Math.min(ruPercent, 100)} 
                              color={getUtilizationColor(ruPercent)}
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                          </Box>
                          <Typography variant="caption">{ruPercent}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight="bold" color={location.available_power > 0 ? 'success.main' : 'error.main'}>
                          {Math.max(0, location.available_power).toFixed(1)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                          {getUtilizationIcon(powerPercent)}
                          <Box sx={{ width: 60 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={Math.min(powerPercent, 100)} 
                              color={getUtilizationColor(powerPercent)}
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                          </Box>
                          <Typography variant="caption">{powerPercent}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">{location.client_count}</TableCell>
                    </TableRow>
                    
                    {/* Expanded Rack Details */}
                    <TableRow>
                      <TableCell colSpan={10} sx={{ py: 0, px: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, backgroundColor: 'action.hover' }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
                              <strong>Racks at {location.location_code} - {location.datacenter_name}</strong>
                            </Typography>
                            {location.racks && location.racks.length > 0 ? (
                              <Table size="small" sx={{ backgroundColor: 'background.paper' }}>
                                <TableHead>
                                  <TableRow>
                                    <TableCell><strong>Rack ID</strong></TableCell>
                                    <TableCell><strong>Type</strong></TableCell>
                                    <TableCell align="center"><strong>Total RU</strong></TableCell>
                                    <TableCell align="center"><strong>Allocated RU</strong></TableCell>
                                    <TableCell align="center"><strong>IPC Reserved</strong></TableCell>
                                    <TableCell align="center"><strong>Available RU</strong></TableCell>
                                    <TableCell align="center"><strong>Power (kVA)</strong></TableCell>
                                    <TableCell align="center"><strong>Allocated Power</strong></TableCell>
                                    <TableCell align="center"><strong>Available Power</strong></TableCell>
                                    <TableCell align="center"><strong>Clients</strong></TableCell>
                                    <TableCell><strong>TOR</strong></TableCell>
                                    <TableCell><strong>Exchange</strong></TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {location.racks.map(rack => {
                                    const rackRUPercent = rack.total_ru > 0 
                                      ? Math.round(((rack.allocated_ru + rack.ipc_reserved_ru) / rack.total_ru) * 100) 
                                      : 0;
                                    return (
                                      <TableRow key={rack.id}>
                                        <TableCell>
                                          <Typography variant="body2" fontWeight="bold">{rack.rack_id}</Typography>
                                        </TableCell>
                                        <TableCell>
                                          <Chip 
                                            label={rack.rack_type || 'shared'} 
                                            size="small" 
                                            color={rack.rack_type === 'dedicated' ? 'secondary' : 'primary'}
                                            variant="outlined"
                                          />
                                        </TableCell>
                                        <TableCell align="center">{rack.total_ru || 42}</TableCell>
                                        <TableCell align="center">{rack.allocated_ru}</TableCell>
                                        <TableCell align="center">{rack.ipc_reserved_ru}</TableCell>
                                        <TableCell align="center">
                                          <Tooltip title={`${rackRUPercent}% utilized`}>
                                            <Typography 
                                              variant="body2" 
                                              fontWeight="bold"
                                              color={rack.available_ru > 0 ? 'success.main' : 'error.main'}
                                            >
                                              {Math.max(0, rack.available_ru)}
                                            </Typography>
                                          </Tooltip>
                                        </TableCell>
                                        <TableCell align="center">{rack.total_power_kva}</TableCell>
                                        <TableCell align="center">{rack.allocated_power}</TableCell>
                                        <TableCell align="center">
                                          <Typography 
                                            variant="body2" 
                                            fontWeight="bold"
                                            color={rack.available_power > 0 ? 'success.main' : 'error.main'}
                                          >
                                            {Math.max(0, rack.available_power).toFixed(1)}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="center">{rack.client_count}</TableCell>
                                        <TableCell>
                                          {rack.tor_network_infrastructure && rack.tor_network_infrastructure !== 'No' 
                                            ? rack.tor_network_infrastructure 
                                            : 'No'
                                          }
                                        </TableCell>
                                        <TableCell>
                                          {rack.exchange_facing_infrastructure && rack.exchange_facing_infrastructure !== 'No' 
                                            ? rack.exchange_facing_infrastructure 
                                            : 'No'
                                          }
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            ) : (
                              <Typography variant="body2" color="text.secondary">No racks configured for this location</Typography>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ColocationAvailabilityDashboard;
