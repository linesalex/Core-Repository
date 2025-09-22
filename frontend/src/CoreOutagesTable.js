import React, { useState, useEffect } from 'react';
import {
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Alert, CircularProgress, Box, Chip, Tabs, Tab, TablePagination,
  Button, Grid, Card, CardContent
} from '@mui/material';
import {
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { getCurrentOutages, getOutageHistory, getOutageStats } from './api';
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
  
  // History state
  const [outageHistory, setOutageHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(25);
  const [historyTotal, setHistoryTotal] = useState(0);
  
  // Stats state
  const [stats, setStats] = useState({});
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Error state
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCurrentOutages();
    loadStats();
  }, []);

  useEffect(() => {
    if (currentTab === 1) {
      loadOutageHistory();
    }
  }, [currentTab, historyPage, historyRowsPerPage]);

  const loadCurrentOutages = async () => {
    try {
      setCurrentLoading(true);
      const response = await getCurrentOutages();
      setCurrentOutages(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load current outages:', err);
      setError('Failed to load current outages: ' + err.message);
    } finally {
      setCurrentLoading(false);
    }
  };

  const loadOutageHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await getOutageHistory(historyPage + 1, historyRowsPerPage);
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
        {currentLoading ? (
          <LoadingIndicator message="Loading current outages..." />
        ) : (
          <>
            {currentOutages.length === 0 ? (
              <Alert severity="success" sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircleIcon sx={{ mr: 1 }} />
                No current outages detected. All circuits have normal latency.
              </Alert>
            ) : (
              <>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <WarningIcon sx={{ mr: 1 }} />
                  The following {currentOutages.length} circuit(s) are currently experiencing outages (Live Latency = 0ms):
                </Alert>
                
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
                      {currentOutages.map((outage) => (
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
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </>
        )}
      </TabPanel>

      {/* Outage History Tab */}
      <TabPanel value={currentTab} index={1}>
        {historyLoading ? (
          <LoadingIndicator message="Loading outage history..." />
        ) : (
          <>
            {outageHistory.length === 0 ? (
              <Alert severity="info">
                No outage history found.
              </Alert>
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Historical record of all circuit outages detected by the live latency monitoring system.
                </Typography>
                
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
                      {outageHistory.map((outage, index) => (
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
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    rowsPerPageOptions={[10, 25, 50, 100]}
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
          </>
        )}
      </TabPanel>
    </Box>
  );
};

export default CoreOutagesTable; 