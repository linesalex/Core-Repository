import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Alert, CircularProgress, Box, Chip, Tabs, Tab, TablePagination,
  Button, Grid, Card, CardContent, TextField, InputAdornment, IconButton
} from '@mui/material';
import {
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  FileDownload as DownloadIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { getCurrentOutages, getOutageHistory, getOutageStats, exportOutageHistory } from './api';
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
  
  // Stats state
  const [stats, setStats] = useState({});
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Error state
  const [error, setError] = useState(null);

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
    } else {
      loadOutageHistory();
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
      <Typography variant="h4" gutterBottom>
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
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Current Outages
                    </Typography>
                    <Typography variant="h4" color="error.main">
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
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Total Historical
                    </Typography>
                    <Typography variant="h4">
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
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Outages (24h)
                    </Typography>
                    <Typography variant="h4" color="warning.main">
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
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Avg Duration
                    </Typography>
                    <Typography variant="h4" color="info.main">
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
                    <TableCell><strong>Live Latency</strong></TableCell>
                    <TableCell><strong>Down Since</strong></TableCell>
                    <TableCell><strong>Duration</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentOutages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="textSecondary">
                          {currentSearch ? 'No outages found matching your search criteria.' : 'No current outages detected.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentOutages.map((outage) => (
                      <TableRow key={outage.circuit_id} sx={{ backgroundColor: 'error.light', opacity: 0.1 }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {outage.circuit_id}
                          </Typography>
                        </TableCell>
                        <TableCell>{outage.location_a || 'N/A'}</TableCell>
                        <TableCell>{outage.location_b || 'N/A'}</TableCell>
                        <TableCell>{outage.bandwidth ? `${outage.bandwidth} Mbps` : 'N/A'}</TableCell>
                        <TableCell>{outage.underlying_carrier || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip 
                            label="0ms" 
                            color="error" 
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{formatDate(outage.outage_start_time)}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color="error.main" fontWeight="bold">
                            {calculateDownTime(outage.outage_start_time)}
                          </Typography>
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
                    <TableCell><strong>Start Time</strong></TableCell>
                    <TableCell><strong>End Time</strong></TableCell>
                    <TableCell><strong>Duration</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {outageHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
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
                          <Typography variant="body2" fontWeight="bold">
                            {outage.circuit_id}
                          </Typography>
                        </TableCell>
                        <TableCell>{outage.location_a || 'N/A'}</TableCell>
                        <TableCell>{outage.location_b || 'N/A'}</TableCell>
                        <TableCell>{outage.bandwidth ? `${outage.bandwidth} Mbps` : 'N/A'}</TableCell>
                        <TableCell>{outage.underlying_carrier || 'N/A'}</TableCell>
                        <TableCell>{formatDate(outage.outage_start_time)}</TableCell>
                        <TableCell>{formatDate(outage.outage_end_time)}</TableCell>
                        <TableCell>
                          <Chip 
                            label={formatDuration(outage.outage_duration_minutes)} 
                            color="default" 
                            size="small"
                          />
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
    </Box>
  );
};

export default CoreOutagesTable; 