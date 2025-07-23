import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Chip, FormControl, InputLabel, Select, MenuItem, Grid, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, Snackbar,
  Accordion, AccordionSummary, AccordionDetails, Pagination
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import HistoryIcon from '@mui/icons-material/History';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import { API_BASE_URL } from './config';
import axios from 'axios';

const ChangeLogsViewer = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  
  // Filters
  const [filters, setFilters] = useState({
    table_name: '',
    user_id: '',
    limit: 50,
    offset: 0
  });
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });
      
      const response = await axios.get(`${API_BASE_URL}/change-logs?${params.toString()}`);
      setLogs(response.data);
      setTotalPages(Math.ceil(response.data.length / filters.limit));
    } catch (err) {
      setError('Failed to load change logs: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      offset: 0 // Reset to first page when filtering
    }));
    setPage(1);
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    setFilters(prev => ({
      ...prev,
      offset: (newPage - 1) * prev.limit
    }));
  };

  const handleDetailsOpen = (log) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const getActionChip = (action) => {
    const colors = {
      'CREATE': 'success',
      'UPDATE': 'warning',
      'DELETE': 'error',
      'LOGIN': 'info',
      'PASSWORD_CHANGE': 'secondary'
    };
    return <Chip label={action} color={colors[action] || 'default'} size="small" />;
  };

  const getTableName = (tableName) => {
    const nameMap = {
      'network_routes': 'Network Routes',
      'location_reference': 'Locations',
      'carriers': 'Carriers',
      'users': 'Users',
      'dark_fiber_details': 'Dark Fiber',
      'pop_capabilities': 'POP Capabilities',
      'user_activity': 'User Activity'
    };
    return nameMap[tableName] || tableName;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatJsonData = (jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      return JSON.stringify(data, null, 2);
    } catch {
      return jsonString;
    }
  };

  const tableNames = [
    'network_routes',
    'location_reference',
    'carriers',
    'users',
    'dark_fiber_details',
    'pop_capabilities',
    'user_activity'
  ];

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2">
          Change Logs
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadLogs}
        >
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            <FilterListIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Table/Module</InputLabel>
                <Select
                  value={filters.table_name}
                  onChange={(e) => handleFilterChange('table_name', e.target.value)}
                  label="Table/Module"
                >
                  <MenuItem value="">All Modules</MenuItem>
                  {tableNames.map((table) => (
                    <MenuItem key={table} value={table}>
                      {getTableName(table)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Records per page</InputLabel>
                <Select
                  value={filters.limit}
                  onChange={(e) => handleFilterChange('limit', e.target.value)}
                  label="Records per page"
                >
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                  <MenuItem value={200}>200</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Change Logs Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Module</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Record ID</TableCell>
              <TableCell>Summary</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(log.timestamp)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {log.full_name || log.username || 'System'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {getTableName(log.table_name)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {getActionChip(log.action)}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {log.record_id}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {log.changes_summary 
                      ? (log.changes_summary.length > 256 
                          ? `${log.changes_summary.substring(0, 256)}...` 
                          : log.changes_summary)
                      : 'No summary'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={() => handleDetailsOpen(log)}
                    disabled={!log.old_values && !log.new_values}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Pagination
          count={totalPages}
          page={page}
          onChange={handlePageChange}
          color="primary"
        />
      </Box>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Change Details - {selectedLog?.action} on {getTableName(selectedLog?.table_name)}
        </DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Basic Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>User:</strong> {selectedLog.full_name || selectedLog.username || 'System'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Timestamp:</strong> {formatDate(selectedLog.timestamp)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>IP Address:</strong> {selectedLog.ip_address || 'Unknown'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>User Agent:</strong> {selectedLog.user_agent || 'Unknown'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Record Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>Record ID:</strong> {selectedLog.record_id}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Action:</strong> {selectedLog.action}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Summary:</strong> {selectedLog.changes_summary || 'No summary'}
                  </Typography>
                </Grid>
              </Grid>

              {selectedLog.old_values && (
                <Accordion sx={{ mt: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">Old Values</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField
                      fullWidth
                      multiline
                      rows={6}
                      value={formatJsonData(selectedLog.old_values)}
                      InputProps={{
                        readOnly: true,
                        style: { fontFamily: 'monospace', fontSize: '0.8rem' }
                      }}
                    />
                  </AccordionDetails>
                </Accordion>
              )}

              {selectedLog.new_values && (
                <Accordion sx={{ mt: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">New Values</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField
                      fullWidth
                      multiline
                      rows={6}
                      value={formatJsonData(selectedLog.new_values)}
                      InputProps={{
                        readOnly: true,
                        style: { fontFamily: 'monospace', fontSize: '0.8rem' }
                      }}
                    />
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Error Message */}
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
    </Box>
  );
};

export default ChangeLogsViewer; 