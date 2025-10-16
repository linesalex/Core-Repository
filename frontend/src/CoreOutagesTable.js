import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Alert, CircularProgress, Box, Chip, Tabs, Tab, TablePagination,
  Button, Grid, Card, CardContent, TextField, InputAdornment, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import {
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  FileDownload as DownloadIcon,
  Clear as ClearIcon,
  Speed as SpeedIcon,
  Edit as EditIcon,
  Note as NoteIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { getCurrentOutages, getOutageHistory, getOutageStats, exportOutageHistory, getLatencyWarnings, updateOutageTicket, updateLatencyWarningTicket } from './api';
import { debounce } from 'lodash';
import LoadingIndicator from './components/LoadingIndicator';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`outages-tabpanel-${index}`}
      aria-labelledby={`outages-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const CoreOutagesTable = () => {
  // Tab state
  const [currentTab, setCurrentTab] = useState(0);
  
  // Current outages state
  const [currentOutages, setCurrentOutages] = useState([]);
  const [currentLoading, setCurrentLoading] = useState(true);
  const [currentSearch, setCurrentSearch] = useState('');
  
  // History state
  const [outageHistory, setOutageHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(20); // Changed to 20 as requested
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  
  // Latency warnings state
  const [latencyWarnings, setLatencyWarnings] = useState([]);
  const [warningsLoading, setWarningsLoading] = useState(true);
  const [warningsSearch, setWarningsSearch] = useState('');
  
  // Stats state
  const [stats, setStats] = useState({});
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Error state
  const [error, setError] = useState(null);
  
  // Ticket/Notes dialog state
  const [ticketDialog, setTicketDialog] = useState({
    open: false,
    circuitId: '',
    currentTicket: '',
    currentNotes: '',
    type: 'outage' // 'outage' or 'warning'
  });

  // Notes popup dialog state (read-only)
  const [notesPopup, setNotesPopup] = useState({
    open: false,
    circuitId: '',
    notes: ''
  });

  // Debounced search functions
  const debouncedCurrentSearch = useCallback(
    debounce((search) => {
      loadCurrentOutages(search);
    }, 300),
    []
  );

  const debouncedHistorySearch = useCallback(
    debounce((search, startDate, endDate) => {
      setHistoryPage(0); // Reset to first page when searching
      loadOutageHistory(search, startDate, endDate);
    }, 300),
    [historyPage, historyRowsPerPage]
  );

  useEffect(() => {
    loadCurrentOutages();
    loadStats();
  }, []);

  useEffect(() => {
    if (currentTab === 1) {
      loadOutageHistory();
    } else if (currentTab === 2) {
      loadLatencyWarnings();
    }
  }, [currentTab, historyPage, historyRowsPerPage]);

  // Search effect for current outages
  useEffect(() => {
    if (currentTab === 0) {
      debouncedCurrentSearch(currentSearch);
    }
  }, [currentSearch, currentTab, debouncedCurrentSearch]);

  // Search effect for history
  useEffect(() => {
    if (currentTab === 1) {
      debouncedHistorySearch(historySearch, historyStartDate, historyEndDate);
    }
  }, [historySearch, historyStartDate, historyEndDate, currentTab, debouncedHistorySearch]);

  // Search effect for latency warnings
  useEffect(() => {
    if (currentTab === 2) {
      debouncedWarningsSearch(warningsSearch);
    }
  }, [warningsSearch, currentTab]);

  const debouncedWarningsSearch = useCallback(
    debounce((search) => {
      loadLatencyWarnings(search);
    }, 300),
    []
  );

  const loadCurrentOutages = async (search = currentSearch) => {
    try {
      setCurrentLoading(true);
      const response = await getCurrentOutages(search);
      setCurrentOutages(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load current outages:', err);
      setError('Failed to load current outages: ' + err.message);
    } finally {
      setCurrentLoading(false);
    }
  };

  const loadOutageHistory = async (search = historySearch, startDate = historyStartDate, endDate = historyEndDate) => {
    try {
      setHistoryLoading(true);
      const response = await getOutageHistory(historyPage + 1, historyRowsPerPage, search, startDate, endDate);
      setOutageHistory(response.data || []);
      setHistoryTotal(response.pagination?.total || 0);
      setError(null);
    } catch (err) {
      console.error('Failed to load outage history:', err);
      setError('Failed to load outage history: ' + err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadLatencyWarnings = async (search = warningsSearch) => {
    try {
      setWarningsLoading(true);
      const response = await getLatencyWarnings(search);
      setLatencyWarnings(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load latency warnings:', err);
      setError('Failed to load latency warnings: ' + err.message);
    } finally {
      setWarningsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const response = await getOutageStats();
      setStats(response.data || {});
    } catch (err) {
      console.error('Failed to load outage stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const handleHistoryPageChange = (event, newPage) => {
    setHistoryPage(newPage);
  };

  const handleHistoryRowsPerPageChange = (event) => {
    setHistoryRowsPerPage(parseInt(event.target.value, 10));
    setHistoryPage(0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const calculateDownTime = (startTime) => {
    if (!startTime) return 'N/A';
    const start = new Date(startTime);
    const now = new Date();
    const diffMinutes = Math.floor((now - start) / (1000 * 60));
    return formatDuration(diffMinutes);
  };

  const handleRefresh = () => {
    if (currentTab === 0) {
      loadCurrentOutages();
      loadStats();
    } else if (currentTab === 1) {
      loadOutageHistory();
    } else if (currentTab === 2) {
      loadLatencyWarnings();
    }
  };

  const handleCurrentSearchChange = (event) => {
    setCurrentSearch(event.target.value);
  };

  const handleCurrentSearchClear = () => {
    setCurrentSearch('');
  };

  const handleHistorySearchChange = (event) => {
    setHistorySearch(event.target.value);
  };

  const handleHistorySearchClear = () => {
    setHistorySearch('');
  };

  const handleStartDateChange = (event) => {
    setHistoryStartDate(event.target.value);
  };

  const handleEndDateChange = (event) => {
    setHistoryEndDate(event.target.value);
  };

  const handleClearFilters = () => {
    setHistorySearch('');
    setHistoryStartDate('');
    setHistoryEndDate('');
  };

  const handleWarningsSearchChange = (event) => {
    setWarningsSearch(event.target.value);
  };

  const handleWarningsSearchClear = () => {
    setWarningsSearch('');
  };

  const handleTicketClick = (circuitId, currentTicket, currentNotes, type) => {
    setTicketDialog({
      open: true,
      circuitId,
      currentTicket: currentTicket || '',
      currentNotes: currentNotes || '',
      type
    });
  };

  const handleTicketDialogClose = () => {
    setTicketDialog({
      open: false,
      circuitId: '',
      currentTicket: '',
      currentNotes: '',
      type: 'outage'
    });
  };

  const handleTicketSave = async () => {
    try {
      const { circuitId, currentTicket, currentNotes, type } = ticketDialog;
      
      if (type === 'outage') {
        await updateOutageTicket(circuitId, currentTicket, currentNotes);
        loadCurrentOutages(); // Refresh current outages
      } else if (type === 'warning') {
        await updateLatencyWarningTicket(circuitId, currentTicket, currentNotes);
        loadLatencyWarnings(); // Refresh warnings
      }
      
      handleTicketDialogClose();
    } catch (err) {
      console.error('Failed to update ticket/notes:', err);
      setError('Failed to update ticket/notes: ' + err.message);
    }
  };

  const handleTicketInputChange = (field, value) => {
    setTicketDialog(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNotesPopupOpen = (circuitId, notes) => {
    setNotesPopup({
      open: true,
      circuitId,
      notes: notes || 'No notes available.'
    });
  };

  const handleNotesPopupClose = () => {
    setNotesPopup({
      open: false,
      circuitId: '',
      notes: ''
    });
  };

  const handleExportHistory = async () => {
    try {
      setExportLoading(true);
      const response = await exportOutageHistory(historySearch, historyStartDate, historyEndDate);
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const currentDate = new Date().toISOString().split('T')[0];
      let filename = `outage_history_${currentDate}`;
      
      if (historySearch) {
        filename += `_search_${historySearch.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
      if (historyStartDate || historyEndDate) {
        filename += `_${historyStartDate || 'all'}_to_${historyEndDate || 'all'}`;
      }
      filename += '.csv';
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export outage history:', err);
      setError('Failed to export outage history: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: '2rem' }}>
        Core Outages Management
      </Typography>
      
      {/* Statistics Cards */}
      {!statsLoading && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <WarningIcon color="error" sx={{ mr: 1 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2" sx={{ fontSize: '0.75rem' }}>
                      Current Outages
                    </Typography>
                    <Typography variant="h4" color="error.main" sx={{ fontSize: '2rem' }}>
                      {stats.currentOutages || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <HistoryIcon color="primary" sx={{ mr: 1 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2" sx={{ fontSize: '0.75rem' }}>
                      Total Historical
                    </Typography>
                    <Typography variant="h4" sx={{ fontSize: '2rem' }}>
                      {stats.totalHistoricalOutages || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <WarningIcon color="warning" sx={{ mr: 1 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2" sx={{ fontSize: '0.75rem' }}>
                      Outages (24h)
                    </Typography>
                    <Typography variant="h4" color="warning.main" sx={{ fontSize: '2rem' }}>
                      {stats.outagesLast24h || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircleIcon color="info" sx={{ mr: 1 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2" sx={{ fontSize: '0.75rem' }}>
                      Avg Duration
                    </Typography>
                    <Typography variant="h4" color="info.main" sx={{ fontSize: '2rem' }}>
                      {formatDuration(Math.round(stats.avgOutageDuration || 0))}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tabs value={currentTab} onChange={handleTabChange}>
            <Tab 
              label={`Current Outages (${currentOutages.length})`} 
              icon={<WarningIcon />}
              iconPosition="start"
            />
            <Tab 
              label="Outage History" 
              icon={<HistoryIcon />}
              iconPosition="start"
            />
            <Tab 
              label={`Latency Warning (${latencyWarnings.length})`} 
              icon={<SpeedIcon />}
              iconPosition="start"
            />
          </Tabs>
          <Button
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            variant="outlined"
            size="small"
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Current Outages Tab */}
      <TabPanel value={currentTab} index={0}>
        {/* Search Bar for Current Outages */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            placeholder="Search current outages by Circuit ID, Location, or Carrier..."
            value={currentSearch}
            onChange={handleCurrentSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: currentSearch && (
                <InputAdornment position="end">
                  <IconButton onClick={handleCurrentSearchClear} size="small">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {currentLoading ? (
          <LoadingIndicator message="Loading current outages..." />
        ) : (
          <>
            {/* Status Alert */}
            {currentOutages.length === 0 ? (
              <Alert severity="success" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CheckCircleIcon sx={{ mr: 1 }} />
                {currentSearch ? 'No current outages found matching your search.' : 'No current outages detected. All circuits have normal latency.'}
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <WarningIcon sx={{ mr: 1 }} />
                {currentSearch ? `Found ${currentOutages.length} current outage(s) matching your search:` : `The following ${currentOutages.length} circuit(s) are currently experiencing outages (Live Latency = 0ms):`}
              </Alert>
            )}
            
            {/* Current Outages Table - Always Visible */}
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Circuit ID</strong></TableCell>
                    <TableCell><strong>Location A</strong></TableCell>
                    <TableCell><strong>Location B</strong></TableCell>
                    <TableCell><strong>Bandwidth</strong></TableCell>
                    <TableCell><strong>Underlying Carrier</strong></TableCell>
                    <TableCell><strong>Cable System</strong></TableCell>
                    <TableCell><strong>Live Latency</strong></TableCell>
                    <TableCell><strong>Down Since</strong></TableCell>
                    <TableCell><strong>Duration</strong></TableCell>
                    <TableCell><strong>Ticket Number</strong></TableCell>
                    <TableCell><strong>Notes</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentOutages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
                          {currentSearch ? 'No outages found matching your search criteria.' : 'No current outages detected.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentOutages.map((outage) => (
                      <TableRow key={outage.circuit_id} sx={{ backgroundColor: 'rgba(255, 235, 238, 0.5)' }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.circuit_id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.location_a || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.location_b || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.bandwidth ? `${outage.bandwidth} Mbps` : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.underlying_carrier || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.cable_system || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label="0ms" 
                            color="error" 
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {formatDate(outage.outage_start_time)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="error.main" fontWeight="bold">
                            {calculateDownTime(outage.outage_start_time)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.ticket_number || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleNotesPopupOpen(outage.circuit_id, outage.notes)}
                            disabled={!outage.notes}
                          >
                            <InfoIcon color={outage.notes ? "primary" : "disabled"} />
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => handleTicketClick(outage.circuit_id, outage.ticket_number, outage.notes, 'outage')}
                            variant="outlined"
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </TabPanel>

      {/* Outage History Tab */}
      <TabPanel value={currentTab} index={1}>
        {/* Search and Filter Controls for History */}
        <Grid container spacing={1} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Search by Circuit ID, Location, or Carrier..."
              value={historySearch}
              onChange={handleHistorySearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: historySearch && (
                  <InputAdornment position="end">
                    <IconButton onClick={handleHistorySearchClear} size="small">
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={2.5}>
            <TextField
              fullWidth
              type="date"
              label="Start Date"
              size="small"
              value={historyStartDate}
              onChange={handleStartDateChange}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
          <Grid item xs={12} md={2.5}>
            <TextField
              fullWidth
              type="date"
              label="End Date"
              size="small"
              value={historyEndDate}
              onChange={handleEndDateChange}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', gap: 0.5, height: '100%', alignItems: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleClearFilters}
                disabled={!historySearch && !historyStartDate && !historyEndDate}
                sx={{ flex: 1 }}
              >
                Clear
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleExportHistory}
                disabled={exportLoading || outageHistory.length === 0}
                startIcon={<DownloadIcon fontSize="small" />}
                sx={{ flex: 1 }}
              >
                {exportLoading ? 'Export...' : 'Export'}
              </Button>
            </Box>
          </Grid>
        </Grid>

        {historyLoading ? (
          <LoadingIndicator message="Loading outage history..." />
        ) : (
          <>
            {/* Status Message */}
            {outageHistory.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                {historySearch || historyStartDate || historyEndDate 
                  ? 'No outage history found matching your filters.' 
                  : 'No outage history found.'}
              </Alert>
            ) : (
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                {historySearch || historyStartDate || historyEndDate 
                  ? `Found ${outageHistory.length} outage records matching your filters (showing page ${historyPage + 1}).`
                  : 'Historical record of all circuit outages detected by the live latency monitoring system.'}
              </Typography>
            )}
            
            {/* Outage History Table - Always Visible */}
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Circuit ID</strong></TableCell>
                    <TableCell><strong>Location A</strong></TableCell>
                    <TableCell><strong>Location B</strong></TableCell>
                    <TableCell><strong>Bandwidth</strong></TableCell>
                    <TableCell><strong>Underlying Carrier</strong></TableCell>
                    <TableCell><strong>Cable System</strong></TableCell>
                    <TableCell><strong>Start Time</strong></TableCell>
                    <TableCell><strong>End Time</strong></TableCell>
                    <TableCell><strong>Duration</strong></TableCell>
                    <TableCell><strong>Ticket Number</strong></TableCell>
                    <TableCell><strong>Notes</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {outageHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="textSecondary">
                          {historySearch || historyStartDate || historyEndDate 
                            ? 'No outage history found matching your filters.' 
                            : 'No outage history records available.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    outageHistory.map((outage, index) => (
                      <TableRow key={`${outage.circuit_id}-${index}`}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.circuit_id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.location_a || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.location_b || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.bandwidth ? `${outage.bandwidth} Mbps` : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.underlying_carrier || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.cable_system || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {formatDate(outage.outage_start_time)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {formatDate(outage.outage_end_time)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={formatDuration(outage.outage_duration_minutes)} 
                            color="default" 
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {outage.ticket_number || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleNotesPopupOpen(outage.circuit_id, outage.notes)}
                            disabled={!outage.notes}
                          >
                            <InfoIcon color={outage.notes ? "primary" : "disabled"} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[10, 20, 50, 100]}
                component="div"
                count={historyTotal}
                rowsPerPage={historyRowsPerPage}
                page={historyPage}
                onPageChange={handleHistoryPageChange}
                onRowsPerPageChange={handleHistoryRowsPerPageChange}
              />
            </TableContainer>
          </>
        )}
      </TabPanel>

      {/* Latency Warning Tab */}
      <TabPanel value={currentTab} index={2}>
        {/* Search Bar for Latency Warnings */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            placeholder="Search latency warnings by Circuit ID, Location, or Carrier..."
            value={warningsSearch}
            onChange={handleWarningsSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: warningsSearch && (
                <InputAdornment position="end">
                  <IconButton onClick={handleWarningsSearchClear} size="small">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {warningsLoading ? (
          <LoadingIndicator message="Loading latency warnings..." />
        ) : (
          <>
            {/* Status Alert */}
            {latencyWarnings.length === 0 ? (
              <Alert severity="success" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CheckCircleIcon sx={{ mr: 1 }} />
                {warningsSearch ? 'No latency warnings found matching your search.' : 'No latency warnings detected. All circuits are performing within expected parameters.'}
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <SpeedIcon sx={{ mr: 1 }} />
                {warningsSearch ? `Found ${latencyWarnings.length} latency warning(s) matching your search:` : `The following ${latencyWarnings.length} circuit(s) are exceeding expected latency by more than 5%:`}
              </Alert>
            )}
            
            {/* Latency Warning Note */}
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2, fontStyle: 'italic', fontSize: '0.75rem' }}>
              Note: This table updates every 15 minutes with circuits where live latency exceeds expected latency by more than 5%.
            </Typography>
            
            {/* Latency Warnings Table - Always Visible */}
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Circuit ID</strong></TableCell>
                    <TableCell><strong>Location A</strong></TableCell>
                    <TableCell><strong>Location B</strong></TableCell>
                    <TableCell><strong>Bandwidth</strong></TableCell>
                    <TableCell><strong>Underlying Carrier</strong></TableCell>
                    <TableCell><strong>Live Latency</strong></TableCell>
                    <TableCell><strong>Expected Latency</strong></TableCell>
                    <TableCell><strong>Percentage Over</strong></TableCell>
                    <TableCell><strong>Ticket Number</strong></TableCell>
                    <TableCell><strong>Notes</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {latencyWarnings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="textSecondary">
                          {warningsSearch ? 'No latency warnings found matching your search criteria.' : 'No latency warnings detected.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    latencyWarnings.map((warning) => (
                      <TableRow key={warning.circuit_id} sx={{ backgroundColor: 'rgba(255, 243, 224, 0.5)' }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {warning.circuit_id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {warning.location_a || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {warning.location_b || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {warning.bandwidth ? `${warning.bandwidth} Mbps` : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {warning.underlying_carrier || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={`${warning.live_latency}ms`} 
                            color="warning" 
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {warning.expected_latency}ms
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={`+${warning.latency_percentage}%`} 
                            color="error" 
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#000', fontSize: '0.75rem' }}>
                            {warning.ticket_number || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleNotesPopupOpen(warning.circuit_id, warning.notes)}
                            disabled={!warning.notes}
                          >
                            <InfoIcon color={warning.notes ? "primary" : "disabled"} />
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => handleTicketClick(warning.circuit_id, warning.ticket_number, warning.notes, 'warning')}
                            variant="outlined"
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </TabPanel>

      {/* Ticket/Notes Dialog */}
      <Dialog open={ticketDialog.open} onClose={handleTicketDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {ticketDialog.type === 'outage' ? 'Edit Outage Ticket & Notes' : 'Edit Latency Warning Ticket & Notes'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
            Circuit ID: <strong>{ticketDialog.circuitId}</strong>
          </Typography>
            
            <TextField
              label="Ticket Number"
              value={ticketDialog.currentTicket}
              onChange={(e) => handleTicketInputChange('currentTicket', e.target.value)}
              placeholder="Enter ticket number (max 32 characters)"
              inputProps={{ maxLength: 32 }}
              fullWidth
              size="small"
            />
            
            <TextField
              label="Notes"
              value={ticketDialog.currentNotes}
              onChange={(e) => handleTicketInputChange('currentNotes', e.target.value)}
              placeholder="Enter notes (max 1024 characters)"
              inputProps={{ maxLength: 1024 }}
              fullWidth
              multiline
              rows={3}
              size="small"
            />
            
            <Typography variant="caption" color="textSecondary">
              These details will be visible in both Current Outages and Outage History tables.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleTicketDialogClose}>Cancel</Button>
          <Button onClick={handleTicketSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Notes Popup Dialog (Read-only) */}
      <Dialog open={notesPopup.open} onClose={handleNotesPopupClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          Notes
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2, fontSize: '0.75rem' }}>
              Circuit ID: <strong>{notesPopup.circuitId}</strong>
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>
              {notesPopup.notes}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleNotesPopupClose} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>

      {/* Note about 24-hour consolidation */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="textSecondary" sx={{ fontStyle: 'italic' }}>
          Note: Outages will remain within Live Outages table for 24 hours post recovery to allow for consolidation of recurring issues.
        </Typography>
      </Box>
    </Box>
  );
};

export default CoreOutagesTable; 