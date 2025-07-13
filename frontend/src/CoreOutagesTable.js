import React, { useState, useEffect } from 'react';
import {
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Alert, CircularProgress, Box, Chip
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import { getCoreOutages } from './api';

const CoreOutagesTable = () => {
  const [outages, setOutages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOutages();
  }, []);

  const loadOutages = async () => {
    try {
      setLoading(true);
      const data = await getCoreOutages();
      setOutages(data);
      setError(null);
    } catch (err) {
      setError('Failed to load core outages: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <WarningIcon sx={{ mr: 1, color: 'error.main' }} />
        <Typography variant="h6" color="error.main">
          Core Outages
        </Typography>
        <Chip 
          label={`${outages.length} affected circuits`} 
          color="error" 
          size="small" 
          sx={{ ml: 2 }} 
        />
      </Box>
      
      {outages.length === 0 ? (
        <Alert severity="success">
          No core outages detected. All circuits have normal latency.
        </Alert>
      ) : (
        <>
          <Alert severity="warning" sx={{ mb: 2 }}>
            The following circuits have zero latency and may be experiencing outages:
          </Alert>
          
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Circuit ID</strong></TableCell>
                  <TableCell><strong>Location A</strong></TableCell>
                  <TableCell><strong>Location B</strong></TableCell>
                  <TableCell><strong>Bandwidth</strong></TableCell>
                  <TableCell><strong>Carrier</strong></TableCell>
                  <TableCell><strong>Cable System</strong></TableCell>
                  <TableCell><strong>Expected Latency</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {outages.map((route) => (
                  <TableRow key={route.circuit_id} sx={{ backgroundColor: 'error.light', opacity: 0.1 }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {route.circuit_id}
                      </Typography>
                    </TableCell>
                    <TableCell>{route.location_a || 'N/A'}</TableCell>
                    <TableCell>{route.location_b || 'N/A'}</TableCell>
                    <TableCell>{route.bandwidth || 'N/A'}</TableCell>
                    <TableCell>{route.underlying_carrier || 'N/A'}</TableCell>
                    <TableCell>{route.cable_system || 'N/A'}</TableCell>
                    <TableCell>
                      {route.expected_latency ? `${route.expected_latency}ms` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label="OUTAGE" 
                        color="error" 
                        size="small" 
                        variant="filled"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Paper>
  );
};

export default CoreOutagesTable; 