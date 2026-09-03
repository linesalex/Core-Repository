import React, { useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box,
  FormGroup, FormControlLabel, Checkbox, Divider, Alert, CircularProgress,
  ToggleButtonGroup, ToggleButton, Autocomplete, TextField, Chip
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import { searchNetworkMapPops } from './api';

const REGION_OPTIONS = [
  { key: 'AMERs', label: 'AMERs' },
  { key: 'EMEA', label: 'EMEA' },
  { key: 'APAC', label: 'APAC' },
];

const ALL_DETAIL_OPTIONS = [
  { key: 'ucn', label: 'UCN' },
  { key: 'latency', label: 'Expected Latency' },
  { key: 'bandwidth', label: 'Bandwidth' },
  // Carrier names are restricted to administrator users - filtered out of
  // DETAIL_OPTIONS below for everyone else, and enforced again server-side.
  { key: 'carrier', label: 'Carrier', adminOnly: true },
];

const initialRegions = { AMERs: false, EMEA: false, APAC: false };
const getInitialDetails = (isAdmin) => ({ ucn: true, latency: true, bandwidth: true, carrier: isAdmin });

/**
 * Popup for configuring and exporting a PDF network map diagram from the
 * Network Routes table. Two mutually-exclusive export modes:
 *  - "By Region": choose any combination of AMERs/EMEA/APAC - INTER routes
 *    are pulled in automatically wherever they touch a selected region
 *    (unchanged, original behavior).
 *  - "By Specific POPs": search and pick individual POP codes directly,
 *    ignoring region entirely. Any route from a selected POP to a POP that
 *    was NOT picked still appears as an off-page reference (POP code +
 *    address noted, but not drawn as a full node), same as how out-of-region
 *    INTER connections are already handled.
 * Either way, the user picks which detail fields appear on each route label.
 */
function NetworkMapExportDialog({ open, onClose, onExport, userRole }) {
  const isAdmin = userRole === 'administrator';
  // Non-admins never see (or can select) the Carrier detail checkbox.
  const DETAIL_OPTIONS = ALL_DETAIL_OPTIONS.filter((d) => !d.adminOnly || isAdmin);

  const [mode, setMode] = useState('region');
  const [regions, setRegions] = useState(initialRegions);
  const [selectedPops, setSelectedPops] = useState([]);
  const [popOptions, setPopOptions] = useState([]);
  const [popSearchLoading, setPopSearchLoading] = useState(false);
  const [details, setDetails] = useState(getInitialDetails(isAdmin));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const searchDebounceRef = useRef(null);

  const selectedRegionKeys = REGION_OPTIONS.map((r) => r.key).filter((key) => regions[key]);
  const allRegionsChecked = selectedRegionKeys.length === REGION_OPTIONS.length;
  const anyRegionChecked = selectedRegionKeys.length > 0;
  const hasValidSelection = mode === 'pops' ? selectedPops.length > 0 : anyRegionChecked;

  const handleClose = () => {
    if (submitting) return;
    setMode('region');
    setRegions(initialRegions);
    setSelectedPops([]);
    setPopOptions([]);
    setDetails(getInitialDetails(isAdmin));
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
    // Defense in depth: non-admins can never toggle Carrier on, even if
    // this were somehow invoked without the checkbox being rendered.
    if (key === 'carrier' && !isAdmin) return;
    setDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePopSearchInput = (_, query) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query || !query.trim()) {
      setPopOptions([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setPopSearchLoading(true);
      try {
        const results = await searchNetworkMapPops(query.trim());
        setPopOptions(results || []);
      } catch (err) {
        setPopOptions([]);
      } finally {
        setPopSearchLoading(false);
      }
    }, 250);
  };

  const handleExportClick = async () => {
    if (!hasValidSelection || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'pops') {
        await onExport({ mode: 'pops', pops: selectedPops.map((p) => p.location_code), details });
      } else {
        await onExport({ mode: 'region', regions: selectedRegionKeys, details });
      }
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
        </Typography>

        <ToggleButtonGroup
          value={mode}
          exclusive
          size="small"
          onChange={(_, next) => {
            // MUI's exclusive ToggleButtonGroup calls onChange with `null`
            // when clicking the already-selected button - ignore that.
            if (!next) return;
            setError('');
            setMode(next);
          }}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="region">By Region</ToggleButton>
          <ToggleButton value="pops">By Specific POPs</ToggleButton>
        </ToggleButtonGroup>

        {mode === 'region' ? (
          <>
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
          </>
        ) : (
          <>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Specific POPs</Typography>
            <Typography variant="caption" color="text.secondary">
              Search by POP code, datacenter name, or city and select one or more. A route from a
              selected POP to one that isn't picked still shows as an off-page reference (code +
              address noted, but not drawn as a full location) so context isn't lost.
            </Typography>
            <Autocomplete
              multiple
              sx={{ mt: 1, mb: 2 }}
              options={popOptions}
              value={selectedPops}
              loading={popSearchLoading}
              filterOptions={(opts) => opts}
              isOptionEqualToValue={(opt, val) => opt.location_code === val.location_code}
              getOptionLabel={(opt) => opt.location_code}
              onInputChange={handlePopSearchInput}
              onChange={(_, next) => setSelectedPops(next)}
              renderOption={(props, option) => (
                <li {...props} key={option.location_code}>
                  <Box>
                    <Typography variant="body2">
                      <strong>{option.location_code}</strong> &middot; {option.region}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[option.datacenter_name, option.city, option.country].filter(Boolean).join(', ')}
                    </Typography>
                  </Box>
                </li>
              )}
              renderTags={(value, getTagProps) => value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.location_code}
                  label={option.location_code}
                  size="small"
                />
              ))}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Type a POP code, datacenter name, or city…"
                  helperText="Press Enter or pick from the dropdown to confirm each POP - similar codes (e.g. IPCSNG11 vs IPCSNG1) are easy to mix up otherwise."
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {popSearchLoading ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </>
        )}

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

        {!hasValidSelection && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {mode === 'pops' ? 'Select at least one POP to export.' : 'Select at least one region to export.'}
          </Alert>
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
          disabled={!hasValidSelection || submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <MapIcon />}
        >
          {submitting ? 'Generating PDF…' : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default NetworkMapExportDialog;
