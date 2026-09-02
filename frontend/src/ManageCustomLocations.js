import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, FormControl, InputLabel, Select,
  MenuItem, Button, InputAdornment, CircularProgress, Alert,
  Chip, IconButton, Tooltip, Checkbox, Dialog, DialogTitle, DialogContent,
  DialogActions, RadioGroup, Radio, FormControlLabel, List, ListItem, ListItemText
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteIcon from '@mui/icons-material/Delete';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import EditLocationAltIcon from '@mui/icons-material/EditLocationAlt';
import { carrierQuoteApi } from './api';
import SiteValidationDialog from './SiteValidationDialog';

const PAGE_SIZE = 100;

// Bulk data-quality screen for existing Carrier Quote Repository custom
// locations: fix Building Type without touching address, purge locations
// that aren't referenced by any quote, merge duplicates into one canonical
// record, and re-verify an address's geographic location against Nominatim.
const ManageCustomLocations = ({ onViewQuotes }) => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [usageFilter, setUsageFilter] = useState('all');
  const [savingIds, setSavingIds] = useState({});
  const [savedIds, setSavedIds] = useState({});
  const [selected, setSelected] = useState({});

  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeCount, setPurgeCount] = useState(null);
  const [purging, setPurging] = useState(false);

  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState(null);
  const [merging, setMerging] = useState(false);

  const [fixDialogOpen, setFixDialogOpen] = useState(false);
  const [fixInitial, setFixInitial] = useState({});
  const [fixKey, setFixKey] = useState(0);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await carrierQuoteApi.getCustomLocations({
        q: search || undefined,
        building_type: buildingFilter !== 'all' ? buildingFilter : undefined,
        usage: usageFilter !== 'all' ? usageFilter : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE
      });
      setRows(result.locations || []);
      setTotal(result.total || 0);
    } catch (err) {
      console.error('Failed to load custom locations:', err);
      setError('Failed to load custom locations: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }, [search, buildingFilter, usageFilter, page]);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  // Debounce search box -> search term, reset to first page
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleBuildingFilterChange = (value) => {
    setBuildingFilter(value);
    setPage(0);
  };

  const handleUsageFilterChange = (value) => {
    setUsageFilter(value);
    setPage(0);
    setSelected({});
  };

  const handleBuildingTypeChange = async (row, newType) => {
    const previous = row.building_type;
    if (previous === newType) return;

    setRows(prev => prev.map(r => (r.id === row.id ? { ...r, building_type: newType } : r)));
    setSavingIds(prev => ({ ...prev, [row.id]: true }));
    setSavedIds(prev => { const next = { ...prev }; delete next[row.id]; return next; });

    try {
      await carrierQuoteApi.updateCustomLocationBuildingType(row.id, newType);
      setSavedIds(prev => ({ ...prev, [row.id]: true }));
      setTimeout(() => setSavedIds(prev => { const next = { ...prev }; delete next[row.id]; return next; }), 2000);
      if (buildingFilter !== 'all') loadLocations();
    } catch (err) {
      console.error('Failed to update building type:', err);
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, building_type: previous } : r)));
      setError(`Failed to update "${row.location_name}": ` + (err.response?.data?.error || err.message));
    } finally {
      setSavingIds(prev => { const next = { ...prev }; delete next[row.id]; return next; });
    }
  };

  const toggleSelected = (id) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const selectedIds = useMemo(() => Object.keys(selected).map(Number), [selected]);
  const selectedRows = useMemo(() => rows.filter(r => selected[r.id]), [rows, selected]);

  // --- Purge unused ---

  const openPurgeDialog = async () => {
    setError('');
    try {
      const result = await carrierQuoteApi.getCustomLocations({ usage: 'unused', limit: 1, offset: 0 });
      setPurgeCount(result.total || 0);
      setPurgeDialogOpen(true);
    } catch (err) {
      setError('Failed to check unused locations: ' + (err.response?.data?.error || err.message));
    }
  };

  const handlePurgeConfirm = async () => {
    setPurging(true);
    try {
      const result = await carrierQuoteApi.purgeUnusedCustomLocations();
      setPurgeDialogOpen(false);
      setPage(0);
      await loadLocations();
      setError('');
      setPurgeCount(null);
      // Surface the outcome inline rather than a toast, since it can affect the whole list
      if (!result.deleted) {
        setError('No unused locations found to purge.');
      }
    } catch (err) {
      setError('Failed to purge unused locations: ' + (err.response?.data?.error || err.message));
    } finally {
      setPurging(false);
    }
  };

  const handleDeleteOne = async (row) => {
    setError('');
    try {
      await carrierQuoteApi.deleteCustomLocation(row.id);
      setRows(prev => prev.filter(r => r.id !== row.id));
      setTotal(t => Math.max(t - 1, 0));
      setSelected(prev => { const next = { ...prev }; delete next[row.id]; return next; });
    } catch (err) {
      setError(`Failed to delete "${row.location_name}": ` + (err.response?.data?.error || err.message));
    }
  };

  // --- Merge duplicates ---

  const openMergeDialog = () => {
    if (selectedRows.length < 2) return;
    // Default to the location used by the most quotes as the canonical target
    const best = [...selectedRows].sort((a, b) => (b.quote_count || 0) - (a.quote_count || 0))[0];
    setMergeTargetId(best.id);
    setMergeDialogOpen(true);
  };

  const handleMergeConfirm = async () => {
    const sourceIds = selectedRows.filter(r => r.id !== mergeTargetId).map(r => r.id);
    if (!mergeTargetId || sourceIds.length === 0) return;
    setMerging(true);
    setError('');
    try {
      const result = await carrierQuoteApi.mergeCustomLocations(mergeTargetId, sourceIds);
      setMergeDialogOpen(false);
      setSelected({});
      await loadLocations();
      setError(
        result.quotes_repointed
          ? ''
          : `Merged — no quotes referenced the removed location(s) (nothing to repoint).`
      );
    } catch (err) {
      setError('Failed to merge locations: ' + (err.response?.data?.error || err.message));
    } finally {
      setMerging(false);
    }
  };

  // --- Fix address / geographic location ---

  const openFixAddress = (row) => {
    setFixInitial({
      id: row.id,
      location_name: row.location_name || '',
      address: row.address || '',
      city: row.city || '',
      country: row.country || '',
      building_type: row.building_type || 'retail',
      street_name: row.street_name || '',
      street_number: row.street_number || '',
      postal_code: row.postal_code || '',
      latitude: row.latitude,
      longitude: row.longitude
    });
    setFixKey(k => k + 1);
    setFixDialogOpen(true);
  };

  const handleFixConfirm = async (result) => {
    setFixDialogOpen(false);
    setError('');

    // Picking an "Existing match" while fixing an address means this location
    // is actually a duplicate of another custom location — merge instead of
    // just saving, so quote history follows the canonical record.
    if (result && result.reuse_custom && result.id && result.id !== fixInitial.id) {
      try {
        await carrierQuoteApi.mergeCustomLocations(result.id, [fixInitial.id]);
      } catch (err) {
        setError('Failed to merge into selected match: ' + (err.response?.data?.error || err.message));
      }
      await loadLocations();
      return;
    }

    if (result && result.reuse_pop) {
      setError("Converting a custom location to a POP isn't supported from this screen — edit the affected quote(s) directly instead.");
      await loadLocations();
      return;
    }

    await loadLocations();
  };

  const pageStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min((page + 1) * PAGE_SIZE, total);
  const missingCount = useMemo(() => rows.filter(r => !r.building_type).length, [rows]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Custom Locations</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Set <strong>Building Type</strong> without editing the rest of the address, <strong>purge</strong> locations
        never used by a quote, <strong>merge</strong> duplicates to standardize addresses, and <strong>fix</strong> a
        location's geographic pin/address via official verification.
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search name, address, city, country…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ minWidth: 260 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Building type</InputLabel>
            <Select label="Building type" value={buildingFilter} onChange={(e) => handleBuildingFilterChange(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="missing">Missing only</MenuItem>
              <MenuItem value="datacenter">Datacenter</MenuItem>
              <MenuItem value="retail">Retail</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Usage</InputLabel>
            <Select label="Usage" value={usageFilter} onChange={(e) => handleUsageFilterChange(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="unused">Unused only</MenuItem>
              <MenuItem value="used">Used by a quote</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton onClick={loadLocations} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            size="small"
            color="error"
            variant="outlined"
            startIcon={<DeleteSweepIcon />}
            onClick={openPurgeDialog}
          >
            Purge unused now
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CallMergeIcon />}
            disabled={selectedIds.length < 2}
            onClick={openMergeDialog}
          >
            Merge selected ({selectedIds.length})
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {total.toLocaleString()} location{total !== 1 ? 's' : ''}
          {missingCount > 0 ? ` · ${missingCount} on this page missing Building Type` : ''}
        </Typography>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }} />
              <TableCell>Location Name</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>City</TableCell>
              <TableCell>Country</TableCell>
              <TableCell sx={{ width: 200 }}>Building Type</TableCell>
              <TableCell sx={{ width: 130 }}>Usage</TableCell>
              <TableCell sx={{ width: 90 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">No custom locations found</Typography>
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.map((row) => (
              <TableRow key={row.id} hover selected={!!selected[row.id]}>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={!!selected[row.id]} onChange={() => toggleSelected(row.id)} />
                </TableCell>
                <TableCell>{row.location_name}</TableCell>
                <TableCell>{row.address || '—'}</TableCell>
                <TableCell>{row.city || '—'}</TableCell>
                <TableCell>{row.country || '—'}</TableCell>
                <TableCell>
                  <FormControl size="small" fullWidth error={!row.building_type}>
                    <Select
                      value={row.building_type || ''}
                      displayEmpty
                      onChange={(e) => handleBuildingTypeChange(row, e.target.value)}
                      disabled={!!savingIds[row.id]}
                      renderValue={(val) => val
                        ? (val === 'datacenter' ? 'Datacenter' : 'Retail')
                        : <Chip size="small" color="warning" label="Not set" />}
                    >
                      <MenuItem value="datacenter">Datacenter</MenuItem>
                      <MenuItem value="retail">Retail</MenuItem>
                    </Select>
                  </FormControl>
                  {savingIds[row.id] && <CircularProgress size={14} sx={{ ml: 1 }} />}
                  {savedIds[row.id] && <CheckCircleIcon color="success" fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />}
                </TableCell>
                <TableCell>
                  {row.quote_count > 0 ? (
                    <Tooltip title="View these quotes in the Quote Repository">
                      <Chip
                        size="small"
                        color="success"
                        clickable
                        onClick={() => onViewQuotes && onViewQuotes(row)}
                        label={`${row.quote_count} quote${row.quote_count !== 1 ? 's' : ''}`}
                      />
                    </Tooltip>
                  ) : (
                    <Chip size="small" color="default" label="Unused" />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Fix address / geographic location">
                    <IconButton size="small" onClick={() => openFixAddress(row)}>
                      <EditLocationAltIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={row.quote_count > 0 ? 'Cannot delete — used by a quote (merge instead)' : 'Delete unused location'}>
                    <span>
                      <IconButton size="small" disabled={row.quote_count > 0} onClick={() => handleDeleteOne(row)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {total > 0 ? `Showing ${pageStart}–${pageEnd} of ${total}` : ''}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(p - 1, 0))}>
            Previous
          </Button>
          <Button size="small" disabled={pageEnd >= total || loading} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </Box>
      </Box>

      {/* Purge unused confirmation */}
      <Dialog open={purgeDialogOpen} onClose={() => setPurgeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Purge unused custom locations</DialogTitle>
        <DialogContent>
          {purgeCount === null ? (
            <CircularProgress size={20} />
          ) : purgeCount === 0 ? (
            <Typography>No unused locations found — every custom location is referenced by at least one quote.</Typography>
          ) : (
            <Alert severity="warning">
              This will permanently delete <strong>{purgeCount.toLocaleString()}</strong> custom location{purgeCount !== 1 ? 's' : ''} not
              referenced by any quote in the Carrier Quote Repository, across the entire table (not just this page). This cannot be undone.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPurgeDialogOpen(false)} disabled={purging}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handlePurgeConfirm}
            disabled={purging || !purgeCount}
          >
            {purging ? 'Purging…' : `Delete ${purgeCount || ''} location${purgeCount === 1 ? '' : 's'}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Merge duplicates */}
      <Dialog open={mergeDialogOpen} onClose={() => setMergeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Merge duplicate locations</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pick the canonical location to keep. Every quote pointing at the other selected location(s) will be
            repointed to it, and the duplicate(s) will be deleted.
          </Typography>
          <RadioGroup value={mergeTargetId || ''} onChange={(e) => setMergeTargetId(Number(e.target.value))}>
            <List dense>
              {selectedRows.map((row) => (
                <ListItem key={row.id} disablePadding sx={{ mb: 0.5 }}>
                  <FormControlLabel
                    sx={{ width: '100%', m: 0, alignItems: 'flex-start', py: 0.5 }}
                    value={row.id}
                    control={<Radio size="small" sx={{ mt: 0.5 }} />}
                    label={
                      <ListItemText
                        primary={row.location_name}
                        secondary={`${row.address || ''}${row.city ? ', ' + row.city : ''} · ${row.quote_count || 0} quote${row.quote_count !== 1 ? 's' : ''}`}
                      />
                    }
                  />
                </ListItem>
              ))}
            </List>
          </RadioGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeDialogOpen(false)} disabled={merging}>Cancel</Button>
          <Button variant="contained" onClick={handleMergeConfirm} disabled={merging || !mergeTargetId}>
            {merging ? 'Merging…' : 'Merge into selected'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fix address / geographic location — reuses the same Site Validation
          map + Nominatim verification used elsewhere, editing the location in place */}
      <SiteValidationDialog
        key={`fix-address-${fixKey}`}
        open={fixDialogOpen}
        onClose={() => setFixDialogOpen(false)}
        onConfirm={handleFixConfirm}
        initialValues={fixInitial}
        title={`Fix address (${fixInitial.location_name || ''})`}
        confirmLabel="Save corrected address"
      />
    </Box>
  );
};

export default ManageCustomLocations;
