import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, CircularProgress, Alert, Chip, Card, CardContent,
  Divider, IconButton, Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { API_BASE_URL } from './config';

const SmallTableCell = styled(TableCell)(({ theme }) => ({
  fontSize: '0.75rem',
  padding: '8px 12px',
}));

const SmallTableHeaderCell = styled(TableCell)(({ theme }) => ({
  fontSize: '0.8125rem',
  fontWeight: 600,
  padding: '8px 12px',
  backgroundColor: theme.palette.grey[100],
}));

function RouteChanges() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [routeChanges, setRouteChanges] = useState({
    underDirectReplacement: [],
    underDecommission: [],
    newProvisioning: []
  });

  const loadRouteChanges = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/network_routes/route_changes`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load route changes');
      }
      
      const data = await response.json();
      setRouteChanges(data);
    } catch (err) {
      console.error('Error loading route changes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRouteChanges();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const totalChanges = (routeChanges.underDirectReplacement?.length || 0) + 
                       (routeChanges.underDecommission?.length || 0) + 
                       (routeChanges.newProvisioning?.length || 0);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Route Updates
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View all network routes currently in transition (provisioning or decommissioning)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip 
            label={`${totalChanges} route${totalChanges !== 1 ? 's' : ''} in transition`}
            color={totalChanges > 0 ? 'warning' : 'success'}
            variant="outlined"
          />
          <Tooltip title="Refresh">
            <IconButton onClick={loadRouteChanges} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {totalChanges === 0 ? (
        <Alert severity="success" sx={{ mt: 2 }}>
          No routes currently in transition. All routes are active.
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          
          {/* Routes Under Direct Replacement Section - Orange */}
          <Card sx={{ 
            border: '2px solid',
            borderColor: 'warning.main',
            backgroundColor: 'rgba(255, 152, 0, 0.02)'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SwapHorizIcon sx={{ color: 'warning.main' }} />
                <Typography variant="h6" sx={{ color: 'warning.dark' }}>
                  Routes Under Direct Replacement
                </Typography>
                <Chip 
                  label={routeChanges.underDirectReplacement?.length || 0}
                  size="small"
                  sx={{ ml: 1, bgcolor: 'warning.main', color: 'white' }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Routes being decommissioned that have a replacement route specified
              </Typography>
              
              {(!routeChanges.underDirectReplacement || routeChanges.underDirectReplacement.length === 0) ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No routes currently under direct replacement
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <SmallTableHeaderCell>Old Circuit ID</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Old Route</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Carrier</SmallTableHeaderCell>
                        <SmallTableHeaderCell align="center">
                          <SwapHorizIcon fontSize="small" />
                        </SmallTableHeaderCell>
                        <SmallTableHeaderCell>Replacement Circuit ID</SmallTableHeaderCell>
                        <SmallTableHeaderCell>New Route</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Replacement Status</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Decommission Date</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Go-Live Date</SmallTableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {routeChanges.underDirectReplacement.map((route) => (
                        <TableRow 
                          key={route.circuit_id}
                          sx={{ 
                            backgroundColor: 'rgba(255, 152, 0, 0.05)',
                            '&:hover': { backgroundColor: 'rgba(255, 152, 0, 0.1)' }
                          }}
                        >
                          <SmallTableCell>
                            <Typography variant="body2" fontWeight="500" sx={{ color: 'warning.dark' }}>
                              {route.circuit_id}
                            </Typography>
                          </SmallTableCell>
                          <SmallTableCell>
                            {route.location_a} → {route.location_b}
                          </SmallTableCell>
                          <SmallTableCell>{route.underlying_carrier || 'N/A'}</SmallTableCell>
                          <SmallTableCell align="center">
                            <SwapHorizIcon fontSize="small" color="action" />
                          </SmallTableCell>
                          <SmallTableCell>
                            <Typography variant="body2" fontWeight="500" color="success.main">
                              {route.replacement_circuit_id || 'Not specified'}
                            </Typography>
                          </SmallTableCell>
                          <SmallTableCell>
                            {route.replacement_location_a && route.replacement_location_b 
                              ? `${route.replacement_location_a} → ${route.replacement_location_b}`
                              : 'N/A'
                            }
                          </SmallTableCell>
                          <SmallTableCell>
                            {route.replacement_status ? (
                              <Chip 
                                label={route.replacement_status}
                                size="small"
                                color={route.replacement_status === 'Active' ? 'success' : 'warning'}
                                variant={route.replacement_status === 'Active' ? 'filled' : 'outlined'}
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            ) : 'N/A'}
                          </SmallTableCell>
                          <SmallTableCell>
                            {formatDate(route.decommission_date)}
                          </SmallTableCell>
                          <SmallTableCell>
                            {formatDate(route.replacement_go_live_date)}
                          </SmallTableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* Routes Under Decommission Section - Red (without replacement) */}
          <Card sx={{ 
            border: '1px solid',
            borderColor: 'error.light',
            backgroundColor: 'rgba(244, 67, 54, 0.02)'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <WarningIcon color="error" />
                <Typography variant="h6" color="error.main">
                  Routes Under Decommission
                </Typography>
                <Chip 
                  label={routeChanges.underDecommission?.length || 0}
                  size="small"
                  color="error"
                  sx={{ ml: 1 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Routes being decommissioned without a replacement
              </Typography>
              
              {(!routeChanges.underDecommission || routeChanges.underDecommission.length === 0) ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No routes currently under decommission without replacement
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <SmallTableHeaderCell>Circuit ID</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Route</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Carrier</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Cable System</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Bandwidth</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Region</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Decommission Date</SmallTableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {routeChanges.underDecommission.map((route) => (
                        <TableRow 
                          key={route.circuit_id}
                          sx={{ 
                            backgroundColor: 'rgba(244, 67, 54, 0.05)',
                            '&:hover': { backgroundColor: 'rgba(244, 67, 54, 0.1)' }
                          }}
                        >
                          <SmallTableCell>
                            <Typography variant="body2" fontWeight="500" color="error.main">
                              {route.circuit_id}
                            </Typography>
                          </SmallTableCell>
                          <SmallTableCell>
                            {route.location_a} → {route.location_b}
                          </SmallTableCell>
                          <SmallTableCell>{route.underlying_carrier || 'N/A'}</SmallTableCell>
                          <SmallTableCell>{route.cable_system || 'N/A'}</SmallTableCell>
                          <SmallTableCell>{route.bandwidth || 'N/A'}</SmallTableCell>
                          <SmallTableCell>{route.region || 'N/A'}</SmallTableCell>
                          <SmallTableCell>
                            {formatDate(route.decommission_date)}
                          </SmallTableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* New Provisioning Routes Section - Green */}
          <Card sx={{ 
            border: '1px solid',
            borderColor: 'success.light',
            backgroundColor: 'rgba(76, 175, 80, 0.02)'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <NewReleasesIcon color="success" />
                <Typography variant="h6" color="success.main">
                  New Routes in Provisioning
                </Typography>
                <Chip 
                  label={routeChanges.newProvisioning?.length || 0}
                  size="small"
                  color="success"
                  sx={{ ml: 1 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                New routes being commissioned that are not replacing existing routes
              </Typography>
              
              {(!routeChanges.newProvisioning || routeChanges.newProvisioning.length === 0) ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No new routes currently in provisioning
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <SmallTableHeaderCell>Circuit ID</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Route</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Carrier</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Cable System</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Bandwidth</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Region</SmallTableHeaderCell>
                        <SmallTableHeaderCell>Expected Go-Live Date</SmallTableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {routeChanges.newProvisioning.map((route) => (
                        <TableRow 
                          key={route.circuit_id}
                          sx={{ 
                            backgroundColor: 'rgba(76, 175, 80, 0.05)',
                            '&:hover': { backgroundColor: 'rgba(76, 175, 80, 0.1)' }
                          }}
                        >
                          <SmallTableCell>
                            <Typography variant="body2" fontWeight="500" color="success.main">
                              {route.circuit_id}
                            </Typography>
                          </SmallTableCell>
                          <SmallTableCell>
                            {route.location_a} → {route.location_b}
                          </SmallTableCell>
                          <SmallTableCell>{route.underlying_carrier || 'N/A'}</SmallTableCell>
                          <SmallTableCell>{route.cable_system || 'N/A'}</SmallTableCell>
                          <SmallTableCell>{route.bandwidth || 'N/A'}</SmallTableCell>
                          <SmallTableCell>{route.region || 'N/A'}</SmallTableCell>
                          <SmallTableCell>
                            {formatDate(route.expected_go_live_date)}
                          </SmallTableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Info Section */}
      <Box sx={{ mt: 4, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          About Route Changes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          • <strong>Routes Under Direct Replacement</strong> are being replaced by new routes - path-finding automatically uses replacement routes.<br/>
          • <strong>Routes Under Decommission</strong> are being removed without a direct replacement.<br/>
          • <strong>New Routes in Provisioning</strong> are brand new routes being commissioned that expand the network.<br/>
          • Dates shown are informational and subject to change.
        </Typography>
      </Box>
    </Box>
  );
}

export default RouteChanges;
