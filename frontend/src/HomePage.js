import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper, Typography, Box, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, CircularProgress, Chip, Button, Alert
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { latencyMatrixApi } from './api';

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

const CUSTOMER_NOTE = 'Latency values reflect live production network measurements, not synthetic '
  + 'RFC/ping tests, and represent real-world expected performance between these locations. '
  + 'RFC-based tests typically report lower latency values than production traffic experiences, '
  + 'and are available upon request.';

function HomePage({ onRouteClick }) {
  const [matrixData, setMatrixData] = useState({ locations: [], matrix: [], lastComputed: null });
  const [thirtyDayData, setThirtyDayData] = useState({ locations: [], matrix: [], distinctDaysRecorded: 0 });
  const [activeTab, setActiveTab] = useState(0); // 0 = 1Gb, 1 = 10Gb, 2 = 30-Day Low (1Gb)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

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
    if (isThirtyDayTab) return; // Historical low may not reflect the current live route.
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

                        const cellContent = (
                          <TableCell
                            key={dstLoc.pop_code}
                            align="center"
                            onClick={() => hasRoute && handleCellClick(cell, srcLoc, dstLoc)}
                            sx={{
                              cursor: hasRoute ? 'pointer' : 'default',
                              color: hasValue ? 'primary.main' : 'text.disabled',
                              fontWeight: hasValue ? 500 : 400,
                              '&:hover': hasRoute ? { backgroundColor: 'action.hover', textDecoration: 'underline' } : {},
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
                              title={`Lowest recorded over the last ${cell.days_recorded} day${cell.days_recorded === 1 ? '' : 's'}`}
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
                <Chip
                  label={
                    thirtyDayData.distinctDaysRecorded >= 30
                      ? 'Based on the last 30 days of data'
                      : `Based on the last ${thirtyDayData.distinctDaysRecorded} day${thirtyDayData.distinctDaysRecorded === 1 ? '' : 's'} of data (30-day window still filling in)`
                  }
                  size="small"
                  variant="outlined"
                  sx={{ ml: 2, flexShrink: 0 }}
                />
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
    </Box>
  );
}

export default HomePage;
