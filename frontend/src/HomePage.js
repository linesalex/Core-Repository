import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper, Typography, Box, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, CircularProgress, Chip, Button, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, IconButton
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import { latencyMatrixApi, latencyMatrixAdminApi } from './api';

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

const CUSTOMER_NOTE = 'Latency values reflect live production network measurements, not synthetic '
  + 'RFC/ping tests, and represent real-world expected performance between these locations. '
  + 'RFC-based tests typically report lower latency values than production traffic experiences, '
  + 'and are available upon request.  SLA figures will differ and dependant on exact route selected.';

function HomePage({ onRouteClick, isAdmin }) {
  const [matrixData, setMatrixData] = useState({ locations: [], matrix: [], lastComputed: null });
  const [thirtyDayData, setThirtyDayData] = useState({ locations: [], matrix: [], distinctDaysRecorded: 0 });
  const [activeTab, setActiveTab] = useState(0); // 0 = 1Gb, 1 = 10Gb, 2 = 30-Day Low (1Gb)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [resetSuccess, setResetSuccess] = useState(null);

  // Admin "inspect & prune" popup for a single pair's daily-low history
  const [dailyDetailOpen, setDailyDetailOpen] = useState(false);
  const [dailyDetailLoading, setDailyDetailLoading] = useState(false);
  const [dailyDetailError, setDailyDetailError] = useState(null);
  const [dailyDetailRows, setDailyDetailRows] = useState([]);
  const [dailyDetailPair, setDailyDetailPair] = useState(null); // { sourcePop, destinationPop, sourceCity, destinationCity }
  const [deleteRowTarget, setDeleteRowTarget] = useState(null); // record_date pending delete confirmation
  const [deletingRow, setDeletingRow] = useState(false);

  const fetchMatrix = useCallback(async () => {
    try {
      const [liveData, thirtyDay] = await Promise.all([
        latencyMatrixApi.getMatrix(),
        latencyMatrixApi.get30DayLow()
      ]);
      setMatrixData(liveData);
      setThirtyDayData(thirtyDay);
      setError(null);
    } catch (err) {
      setError('Failed to load latency matrix');
      console.error('Matrix fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix();
    const interval = setInterval(fetchMatrix, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchMatrix]);

  const isThirtyDayTab = activeTab === 2;
  const { lastComputed } = matrixData;
  const locations = isThirtyDayTab ? thirtyDayData.locations : matrixData.locations;
  const matrix = isThirtyDayTab ? thirtyDayData.matrix : matrixData.matrix;
  const latencyField = isThirtyDayTab ? 'latency_1g_low' : (activeTab === 0 ? 'latency_1g' : 'latency_10g');
  const routeField = isThirtyDayTab ? null : (activeTab === 0 ? 'route_1g' : 'route_10g');

  const getCell = (srcPop, dstPop) => {
    return matrix.find(m => m.source_pop === srcPop && m.destination_pop === dstPop);
  };

  const handleCellClick = (cell, srcLoc, dstLoc) => {
    if (isThirtyDayTab) {
      // Historical low may not reflect the current live route, so it never
      // opens Route Finder. Admins can instead inspect/prune the underlying
      // daily values behind the figure.
      if (isAdmin && cell) openDailyDetail(cell);
      return;
    }
    if (!cell || cell[latencyField] === null || cell[latencyField] === undefined) return;
    const route = cell[routeField];
    if (!route || !onRouteClick) return;

    onRouteClick({
      source: cell.source_pop,
      destination: cell.destination_pop,
      sourceCity: cell.source_city,
      destinationCity: cell.destination_city,
      totalLatency: cell[latencyField],
      route,
      tier: activeTab === 0 ? '1Gb' : '10Gb'
    });
  };

  const loadDailyDetail = useCallback(async (sourcePop, destinationPop) => {
    setDailyDetailLoading(true);
    setDailyDetailError(null);
    try {
      const { rows } = await latencyMatrixAdminApi.getDailyLowDetail(sourcePop, destinationPop);
      setDailyDetailRows(rows || []);
    } catch (err) {
      setDailyDetailError(err?.response?.data?.error || 'Failed to load daily latency history.');
    } finally {
      setDailyDetailLoading(false);
    }
  }, []);

  const openDailyDetail = (cell) => {
    setDailyDetailPair({
      sourcePop: cell.source_pop,
      destinationPop: cell.destination_pop,
      sourceCity: cell.source_city,
      destinationCity: cell.destination_city
    });
    setDeleteRowTarget(null);
    setDailyDetailError(null);
    setDailyDetailOpen(true);
    loadDailyDetail(cell.source_pop, cell.destination_pop);
  };

  const handleCloseDailyDetail = () => {
    setDailyDetailOpen(false);
    setDailyDetailRows([]);
    setDailyDetailError(null);
    setDailyDetailPair(null);
  };

  const handleConfirmDeleteRow = async () => {
    if (!deleteRowTarget || !dailyDetailPair) return;
    setDeletingRow(true);
    try {
      await latencyMatrixAdminApi.deleteDailyLowRow(dailyDetailPair.sourcePop, dailyDetailPair.destinationPop, deleteRowTarget);
      setDeleteRowTarget(null);
      await loadDailyDetail(dailyDetailPair.sourcePop, dailyDetailPair.destinationPop);
      await fetchMatrix(); // Keep the matrix cell/tooltip in sync with the updated history
    } catch (err) {
      setDailyDetailError(err?.response?.data?.error || "Failed to delete this day's value.");
    } finally {
      setDeletingRow(false);
    }
  };

  const formatLatency = (val) => {
    if (val === null || val === undefined) return 'N/A';
    return `${val.toFixed(2)}`;
  };

  const handleExportPdf = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const response = await latencyMatrixApi.export30DayLowPDF();
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `ipc-live-latency-matrix-last-30-days-${dateStr}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      let message = 'Failed to generate the latency matrix PDF.';
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed?.error) message = parsed.error;
        } catch {
          // Response body wasn't JSON - fall back to the default message.
        }
      }
      setExportError(message);
    } finally {
      setExporting(false);
    }
  };

  const handleResetThirtyDay = async () => {
    setResetting(true);
    setResetError(null);
    try {
      const result = await latencyMatrixAdminApi.reset30DayLow();
      setResetSuccess(result?.message || 'The 30-day low latency table has been cleared.');
      setResetDialogOpen(false);
      await fetchMatrix();
    } catch (err) {
      setResetError(err?.response?.data?.error || 'Failed to reset the 30-day low latency table.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 4, textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom color="primary">
          Welcome to the Network Repository
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
          Please use the left sidebar to view available modules
        </Typography>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h5" gutterBottom>
              Live Latency Matrix
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Minimum latency between key locations, refreshed hourly using live network data.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
            onClick={handleExportPdf}
            disabled={exporting || matrixData.locations.length < 2}
          >
            {exporting ? 'Generating PDF…' : 'Export PDF (Last 30 Days)'}
          </Button>
        </Box>

        {exportError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setExportError(null)}>{exportError}</Alert>
        )}
        {resetError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setResetError(null)}>{resetError}</Alert>
        )}
        {resetSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setResetSuccess(null)}>{resetSuccess}</Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label="1Gb" sx={{ textTransform: 'none' }} />
            <Tab label="10Gb" sx={{ textTransform: 'none' }} />
            <Tab label="30-Day Low (1Gb)" sx={{ textTransform: 'none' }} />
          </Tabs>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" sx={{ py: 3, textAlign: 'center' }}>{error}</Typography>
        ) : locations.length < 2 ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            No locations configured. An administrator can add locations in the Admin &gt; Latency Matrix section.
          </Typography>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: '70vh' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 3,
                        backgroundColor: 'background.paper',
                        fontWeight: 'bold',
                        minWidth: 120
                      }}
                    >
                      Source / Dest
                    </TableCell>
                    {locations.map(loc => (
                      <Tooltip
                        key={loc.pop_code}
                        title={`${loc.pop_code} — ${loc.datacenter_name || 'N/A'}`}
                        arrow
                      >
                        <TableCell
                          align="center"
                          sx={{
                            fontWeight: 'bold',
                            minWidth: 90,
                            whiteSpace: 'nowrap',
                            cursor: 'help'
                          }}
                        >
                          {loc.city_name}
                        </TableCell>
                      </Tooltip>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {locations.map(srcLoc => (
                    <TableRow key={srcLoc.pop_code} hover>
                      <Tooltip
                        title={`${srcLoc.pop_code} — ${srcLoc.datacenter_name || 'N/A'}`}
                        arrow
                        placement="right"
                      >
                        <TableCell
                          sx={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                            backgroundColor: 'background.paper',
                            fontWeight: 'bold',
                            cursor: 'help'
                          }}
                        >
                          {srcLoc.city_name}
                        </TableCell>
                      </Tooltip>
                      {locations.map(dstLoc => {
                        if (srcLoc.pop_code === dstLoc.pop_code) {
                          return (
                            <TableCell key={dstLoc.pop_code} align="center" sx={{ backgroundColor: 'action.hover', color: 'text.disabled' }}>
                              —
                            </TableCell>
                          );
                        }

                        const cell = getCell(srcLoc.pop_code, dstLoc.pop_code);
                        const val = cell ? cell[latencyField] : null;
                        const hasRoute = !isThirtyDayTab && cell && cell[routeField];
                        const hasValue = val !== null && val !== undefined;
                        const isAdminInspectable = isThirtyDayTab && isAdmin && hasValue;
                        const isClickable = hasRoute || isAdminInspectable;

                        const cellContent = (
                          <TableCell
                            key={dstLoc.pop_code}
                            align="center"
                            onClick={() => isClickable && handleCellClick(cell, srcLoc, dstLoc)}
                            sx={{
                              cursor: isClickable ? 'pointer' : 'default',
                              color: hasValue ? 'primary.main' : 'text.disabled',
                              fontWeight: hasValue ? 500 : 400,
                              '&:hover': isClickable ? { backgroundColor: 'action.hover', textDecoration: 'underline' } : {},
                              fontSize: '0.85rem'
                            }}
                          >
                            {formatLatency(val)}
                          </TableCell>
                        );

                        if (isThirtyDayTab && hasValue) {
                          return (
                            <Tooltip
                              key={dstLoc.pop_code}
                              title={`Lowest recorded over the last ${cell.days_recorded} day${cell.days_recorded === 1 ? '' : 's'}${cell.days_excluded_outliers ? ` (${cell.days_excluded_outliers} anomalous reading${cell.days_excluded_outliers === 1 ? '' : 's'} auto-excluded)` : ''}${isAdmin ? ' - click to view/manage daily values' : ''}`}
                              arrow
                            >
                              {cellContent}
                            </Tooltip>
                          );
                        }
                        return cellContent;
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                {isThirtyDayTab ? (
                  <>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Values in ms and are RTD. This is the lowest 1Gb latency measured between each pair of locations at any
                      point in the trailing 30-day window.
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', maxWidth: 720 }}>
                      {CUSTOMER_NOTE}
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Values in ms and is RTD. Click a value to view the route in Route Finder.
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      1Gb latency is fastest available route and includes all ULL / Special routes.
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      10Gb latency is calculated only on routes above 20Gb capacity and will show as N/A if latency delta between 1Gb and 10Gb is above 20% and above 10ms.
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Capacity checks required.
                    </Typography>
                  </>
                )}
              </Box>
              {isThirtyDayTab ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2, flexShrink: 0 }}>
                  <Chip
                    label={
                      thirtyDayData.distinctDaysRecorded >= 30
                        ? 'Based on the last 30 days of data'
                        : `Based on the last ${thirtyDayData.distinctDaysRecorded} day${thirtyDayData.distinctDaysRecorded === 1 ? '' : 's'} of data (30-day window still filling in)`
                    }
                    size="small"
                    variant="outlined"
                  />
                  {isAdmin && (
                    <Tooltip title="Admin: clear all recorded 30-day low latency history and start re-accumulating from scratch">
                      <Button
                        size="small"
                        color="error"
                        variant="text"
                        startIcon={<RestartAltIcon />}
                        onClick={() => setResetDialogOpen(true)}
                      >
                        Reset 30-Day Data
                      </Button>
                    </Tooltip>
                  )}
                </Box>
              ) : lastComputed && (
                <Chip
                  label={`Last updated: ${new Date(lastComputed).toLocaleString()}`}
                  size="small"
                  variant="outlined"
                  sx={{ ml: 2, flexShrink: 0 }}
                />
              )}
            </Box>
          </>
        )}
      </Paper>

      <Dialog open={resetDialogOpen} onClose={() => !resetting && setResetDialogOpen(false)}>
        <DialogTitle>Reset 30-Day Latency Data?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently clear all recorded daily-low latency history for every location pair.
            The 30-Day Low table will read as empty (0 days of data) until it re-accumulates over the
            next 30 days of hourly matrix computations. This cannot be undone. Use this if bad data
            (e.g. from a transient measurement glitch) has produced an unrealistically low value that
            you want removed from the rolling window.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)} disabled={resetting}>Cancel</Button>
          <Button
            onClick={handleResetThirtyDay}
            color="error"
            variant="contained"
            disabled={resetting}
            startIcon={resetting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {resetting ? 'Resetting…' : 'Reset Data'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dailyDetailOpen} onClose={handleCloseDailyDetail} maxWidth="sm" fullWidth>
        <DialogTitle>
          Daily Low Latency Values
          {dailyDetailPair && (
            <Typography variant="body2" color="text.secondary">
              {dailyDetailPair.sourceCity} ({dailyDetailPair.sourcePop}) → {dailyDetailPair.destinationCity} ({dailyDetailPair.destinationPop})
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {dailyDetailError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDailyDetailError(null)}>{dailyDetailError}</Alert>
          )}
          {dailyDetailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : dailyDetailRows.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No daily values recorded for this pair.
            </Typography>
          ) : (
            <>
              {dailyDetailRows.some(r => r.is_excluded_outlier) && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Rows flagged "Auto-excluded" already look like statistical anomalies and are automatically
                  left out of the 30-day figure shown on the matrix - no action needed unless you'd also like
                  to permanently delete them.
                </Alert>
              )}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date (UTC)</TableCell>
                    <TableCell align="right">Lowest 1Gb Latency (ms)</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dailyDetailRows.map(row => (
                    <TableRow key={row.record_date} hover selected={row.is_excluded_outlier}>
                      <TableCell>{row.record_date}</TableCell>
                      <TableCell align="right">{row.lowest_latency_1g}</TableCell>
                      <TableCell align="center">
                        {row.is_excluded_outlier && (
                          <Chip size="small" color="warning" variant="outlined" label="Auto-excluded" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Delete this day's recorded value">
                          <IconButton size="small" color="error" onClick={() => setDeleteRowTarget(row.record_date)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDailyDetail}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteRowTarget} onClose={() => !deletingRow && setDeleteRowTarget(null)}>
        <DialogTitle>Delete this day's value?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently remove the recorded low-latency value for <strong>{deleteRowTarget}</strong> for
            this pair. The 30-day figure will be recalculated from the remaining days. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteRowTarget(null)} disabled={deletingRow}>Cancel</Button>
          <Button
            onClick={handleConfirmDeleteRow}
            color="error"
            variant="contained"
            disabled={deletingRow}
            startIcon={deletingRow ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {deletingRow ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default HomePage;
