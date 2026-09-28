import React, { useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box,
  FormControlLabel, Checkbox, Divider, Alert, CircularProgress,
  ToggleButtonGroup, ToggleButton, Autocomplete, TextField, Chip,
  Select, MenuItem, InputLabel, FormControl,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DownloadIcon from '@mui/icons-material/Download';
import { customLatencyReportApi } from './api';

const BANDWIDTH_TIER_OPTIONS = [
  { key: '1Gb', label: '1Gb' },
  { key: '10Gb', label: '10Gb' },
];

const initialState = {
  selectedLocations: [],
  locationOptions: [],
  locationSearchLoading: false,
  bandwidthTier: '1Gb',
  mode: 'live', // 'live' | 'expected'
  includeUllSpecial: true,
  preview: null, // { locations, matrix }
  previewLoading: false,
  exporting: false,
  error: ''
};

/**
 * "Custom Latency Report" - a user-driven equivalent of the Home page's
 * fixed latency matrix: pick any locations/datacenters (searched from the
 * full location_reference set, not just the curated matrix locations), a
 * bandwidth tier, Expected-vs-Live mode, and whether to include ULL/Special
 * routes, then preview on-screen and/or export a PDF. Available to all
 * authenticated users.
 */
function CustomLatencyReportDialog({ open, onClose }) {
  const [state, setState] = useState(initialState);
  const searchDebounceRef = useRef(null);

  const hasValidSelection = state.selectedLocations.length >= 2;

  const handleClose = () => {
    if (state.exporting) return;
    setState(initialState);
    onClose();
  };

  const handleLocationSearchInput = (_, query) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query || !query.trim()) {
      setState((prev) => ({ ...prev, locationOptions: [] }));
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setState((prev) => ({ ...prev, locationSearchLoading: true }));
      try {
        const results = await customLatencyReportApi.searchLocations(query.trim());
        setState((prev) => ({ ...prev, locationOptions: results || [], locationSearchLoading: false }));
      } catch {
        setState((prev) => ({ ...prev, locationOptions: [], locationSearchLoading: false }));
      }
    }, 250);
  };

  const buildRequestPayload = () => ({
    locations: state.selectedLocations.map((l) => l.pop_code),
    bandwidthTier: state.bandwidthTier,
    mode: state.mode,
    includeUllSpecial: state.includeUllSpecial
  });

  const handlePreview = async () => {
    if (!hasValidSelection) return;
    setState((prev) => ({ ...prev, previewLoading: true, error: '', preview: null }));
    try {
      const result = await customLatencyReportApi.computeReport(buildRequestPayload());
      setState((prev) => ({ ...prev, preview: result, previewLoading: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        previewLoading: false,
        error: err?.response?.data?.error || 'Failed to generate the report preview.'
      }));
    }
  };

  const handleExportPdf = async () => {
    if (!hasValidSelection) return;
    setState((prev) => ({ ...prev, exporting: true, error: '' }));
    try {
      const response = await customLatencyReportApi.exportReportPDF(buildRequestPayload());
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `ipc-custom-latency-report-${dateStr}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      setState((prev) => ({ ...prev, exporting: false }));
    } catch (err) {
      let message = 'Failed to generate the custom latency report PDF.';
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed?.error) message = parsed.error;
        } catch {
          // Response body wasn't JSON - fall back to the default message.
        }
      } else if (err?.response?.data?.error) {
        message = err.response.data.error;
      }
      setState((prev) => ({ ...prev, exporting: false, error: message }));
    }
  };

  const formatLatency = (val) => {
    if (val === null || val === undefined) return 'N/A';
    return Number(val).toFixed(2);
  };

  const getPreviewCell = (srcPop, dstPop) => {
    if (!state.preview) return null;
    return state.preview.matrix.find((m) => m.source_pop === srcPop && m.destination_pop === dstPop);
  };

  const busy = state.previewLoading || state.exporting;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssessmentIcon color="primary" />
        Custom Latency Report
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose any locations/datacenters, a bandwidth requirement, and whether to include ULL/Special
          routes, then preview or export a PDF latency matrix built to those requirements.
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Locations / Datacenters</Typography>
        <Typography variant="caption" color="text.secondary">
          Search by POP code, datacenter name, or city and select at least two.
        </Typography>
        <Autocomplete
          multiple
          sx={{ mt: 1, mb: 2 }}
          options={state.locationOptions}
          value={state.selectedLocations}
          loading={state.locationSearchLoading}
          filterOptions={(opts) => opts}
          isOptionEqualToValue={(opt, val) => opt.pop_code === val.pop_code}
          getOptionLabel={(opt) => opt.pop_code}
          onInputChange={handleLocationSearchInput}
          onChange={(_, next) => setState((prev) => ({ ...prev, selectedLocations: next, preview: null }))}
          renderOption={(props, option) => (
            <li {...props} key={option.pop_code}>
              <Box>
                <Typography variant="body2">
                  <strong>{option.pop_code}</strong> &middot; {option.region}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {[option.datacenter_name, option.city_name, option.country].filter(Boolean).join(', ')}
                </Typography>
              </Box>
            </li>
          )}
          renderTags={(value, getTagProps) => value.map((option, index) => (
            <Chip {...getTagProps({ index })} key={option.pop_code} label={option.pop_code} size="small" />
          ))}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Type a POP code, datacenter name, or city…"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {state.locationSearchLoading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start', mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="custom-report-bandwidth-label">Bandwidth</InputLabel>
            <Select
              labelId="custom-report-bandwidth-label"
              label="Bandwidth"
              value={state.bandwidthTier}
              onChange={(e) => setState((prev) => ({ ...prev, bandwidthTier: e.target.value, preview: null }))}
            >
              {BANDWIDTH_TIER_OPTIONS.map((opt) => (
                <MenuItem key={opt.key} value={opt.key}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Latency Mode
            </Typography>
            <ToggleButtonGroup
              value={state.mode}
              exclusive
              size="small"
              onChange={(_, next) => {
                if (!next) return;
                setState((prev) => ({ ...prev, mode: next, preview: null }));
              }}
            >
              <ToggleButton value="live">Live</ToggleButton>
              <ToggleButton value="expected">Expected</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <FormControlLabel
            control={(
              <Checkbox
                checked={state.includeUllSpecial}
                onChange={(e) => setState((prev) => ({ ...prev, includeUllSpecial: e.target.checked, preview: null }))}
                size="small"
              />
            )}
            label="Include ULL / Special routes"
          />
        </Box>

        {state.mode === 'expected' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            "Expected" mode shows each route's designed/provisioned baseline latency, ignoring live probe
            data and current live outages - a capacity-planning view. Use "Live" for current real-world
            measured performance.
          </Alert>
        )}

        {!hasValidSelection && (
          <Alert severity="info" sx={{ mb: 2 }}>Select at least two locations to preview or export.</Alert>
        )}
        {state.error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setState((prev) => ({ ...prev, error: '' }))}>
            {state.error}
          </Alert>
        )}

        {state.preview && (
          <>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Preview</Typography>
            <TableContainer sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Source / Dest</TableCell>
                    {state.preview.locations.map((loc) => (
                      <TableCell key={loc.pop_code} align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {loc.city_name}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {state.preview.locations.map((srcLoc) => (
                    <TableRow key={srcLoc.pop_code}>
                      <TableCell sx={{ fontWeight: 'bold' }}>{srcLoc.city_name}</TableCell>
                      {state.preview.locations.map((dstLoc) => {
                        if (srcLoc.pop_code === dstLoc.pop_code) {
                          return <TableCell key={dstLoc.pop_code} align="center" sx={{ backgroundColor: 'action.hover', color: 'text.disabled' }}>—</TableCell>;
                        }
                        const cell = getPreviewCell(srcLoc.pop_code, dstLoc.pop_code);
                        const val = cell ? cell.latency : null;
                        return (
                          <TableCell key={dstLoc.pop_code} align="center" sx={{ color: val === null ? 'text.disabled' : 'primary.main', fontSize: '0.8rem' }}>
                            {formatLatency(val)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>Close</Button>
        <Button
          onClick={handlePreview}
          disabled={!hasValidSelection || busy}
          startIcon={state.previewLoading ? <CircularProgress size={16} /> : null}
        >
          {state.previewLoading ? 'Loading…' : 'Preview'}
        </Button>
        <Button
          variant="contained"
          onClick={handleExportPdf}
          disabled={!hasValidSelection || busy}
          startIcon={state.exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
        >
          {state.exporting ? 'Generating PDF…' : 'Export PDF'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CustomLatencyReportDialog;
