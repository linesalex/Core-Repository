import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box,
  FormGroup, FormControlLabel, Checkbox, Divider, Alert, CircularProgress
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';

const REGION_OPTIONS = [
  { key: 'AMERs', label: 'AMERs' },
  { key: 'EMEA', label: 'EMEA' },
  { key: 'APAC', label: 'APAC' },
];

const DETAIL_OPTIONS = [
  { key: 'ucn', label: 'UCN' },
  { key: 'latency', label: 'Expected Latency' },
  { key: 'bandwidth', label: 'Bandwidth' },
  { key: 'carrier', label: 'Carrier' },
];

const initialRegions = { AMERs: false, EMEA: false, APAC: false };
const initialDetails = { ucn: true, latency: true, bandwidth: true, carrier: true };

/**
 * Popup for configuring and exporting a PDF network map diagram from the
 * Network Routes table. Lets the user choose which region(s) to include
 * (any combination of AMERs/EMEA/APAC - INTER routes are pulled in
 * automatically wherever they touch a selected region) and which detail
 * fields should appear on each route label.
 */
function NetworkMapExportDialog({ open, onClose, onExport }) {
  const [regions, setRegions] = useState(initialRegions);
  const [details, setDetails] = useState(initialDetails);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedRegionKeys = REGION_OPTIONS.map((r) => r.key).filter((key) => regions[key]);
  const allRegionsChecked = selectedRegionKeys.length === REGION_OPTIONS.length;
  const anyRegionChecked = selectedRegionKeys.length > 0;

  const handleClose = () => {
    if (submitting) return;
    setRegions(initialRegions);
    setDetails(initialDetails);
    setError('');
    onClose();
  };

  const toggleRegion = (key) => {
    setRegions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllRegions = () => {
    const nextValue = !allRegionsChecked;
    const next = {};
    REGION_OPTIONS.forEach((r) => { next[r.key] = nextValue; });
    setRegions(next);
  };

  const toggleDetail = (key) => {
    setDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportClick = async () => {
    if (!anyRegionChecked || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await onExport(selectedRegionKeys, details);
      handleClose();
    } catch (err) {
      setError(err?.message || 'Failed to generate the network map PDF. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <MapIcon color="primary" />
        Export Network Map
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Generate a PDF network map diagram from the current network routes and location data.
          Choose which region(s) to include and how much detail to show on each route.
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Regions</Typography>
        <Typography variant="caption" color="text.secondary">
          INTER routes are automatically included wherever either end touches a selected region.
        </Typography>
        <FormGroup sx={{ mt: 0.5, mb: 2 }}>
          <FormControlLabel
            control={(
              <Checkbox
                checked={allRegionsChecked}
                indeterminate={anyRegionChecked && !allRegionsChecked}
                onChange={toggleAllRegions}
                size="small"
              />
            )}
            label={<strong>All Regions</strong>}
          />
          <Box sx={{ pl: 3 }}>
            {REGION_OPTIONS.map((region) => (
              <FormControlLabel
                key={region.key}
                control={(
                  <Checkbox
                    checked={!!regions[region.key]}
                    onChange={() => toggleRegion(region.key)}
                    size="small"
                  />
                )}
                label={region.label}
              />
            ))}
          </Box>
        </FormGroup>

        <Divider sx={{ mb: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Detail to Include on Each Route</Typography>
        <FormGroup row sx={{ mt: 0.5 }}>
          {DETAIL_OPTIONS.map((detail) => (
            <FormControlLabel
              key={detail.key}
              control={(
                <Checkbox
                  checked={!!details[detail.key]}
                  onChange={() => toggleDetail(detail.key)}
                  size="small"
                />
              )}
              label={detail.label}
              sx={{ minWidth: 180 }}
            />
          ))}
        </FormGroup>

        {!anyRegionChecked && (
          <Alert severity="info" sx={{ mt: 2 }}>Select at least one region to export.</Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleExportClick}
          disabled={!anyRegionChecked || submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <MapIcon />}
        >
          {submitting ? 'Generating PDF…' : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default NetworkMapExportDialog;
