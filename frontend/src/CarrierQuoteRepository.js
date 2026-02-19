import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, TablePagination,
  IconButton, Chip, CircularProgress, Alert, Snackbar, Grid, MenuItem, Select, InputLabel,
  FormControl, Tooltip, Divider, InputAdornment, List, ListItem, ListItemText, ListItemIcon,
  ListItemSecondaryAction, Collapse
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import MapIcon from '@mui/icons-material/Map';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TimelineIcon from '@mui/icons-material/Timeline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useAuth } from './AuthContext';
import { carrierQuoteApi } from './api';

const SERVICE_TYPES = ['MPLS', 'Ethernet', 'Dark Fiber', 'Wavelength'];
const REGIONS = ['AMERs', 'APAC', 'EMEA', 'INTER'];
const BANDWIDTH_UNITS = ['Mbps', 'Gbps', 'Dark Fiber'];
const PROTECTION_TYPES = ['Unprotected', 'Protected'];
const CONTRACT_TERMS = [12, 24, 36];

const CarrierQuoteRepository = ({ onNavigateToAddQuote }) => {
  const { user, modulePermissions } = useAuth();
  const permission = modulePermissions?.carrier_quote_repository;
  const canEdit = permission === 'provisioner' || user?.role === 'administrator';
  const canDelete = permission === 'provisioner' || user?.role === 'administrator';

  // Data state
  const [quotes, setQuotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterServiceType, setFilterServiceType] = useState('');
  const [filterCarrier, setFilterCarrier] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  // Advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterLocationA, setFilterLocationA] = useState('');
  const [filterLocationB, setFilterLocationB] = useState('');
  const [filterProtection, setFilterProtection] = useState('');
  const [filterBandwidthUnit, setFilterBandwidthUnit] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [filterContractTerm, setFilterContractTerm] = useState('');
  const [filterCableSystem, setFilterCableSystem] = useState('');
  const [filterTransitCountries, setFilterTransitCountries] = useState('');
  const [filterTransitCities, setFilterTransitCities] = useState('');
  const [filterMinMrc, setFilterMinMrc] = useState('');
  const [filterMaxMrc, setFilterMaxMrc] = useState('');
  const [filterMinNrc, setFilterMinNrc] = useState('');
  const [filterMaxNrc, setFilterMaxNrc] = useState('');

  // Reference data
  const [currencies, setCurrencies] = useState([]);

  // Table state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [orderBy, setOrderBy] = useState('created_at');
  const [order, setOrder] = useState('desc');

  // View details dialog
  const [viewOpen, setViewOpen] = useState(false);
  const [viewQuote, setViewQuote] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Delete confirm dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // File upload state for view dialog
  const [uploading, setUploading] = useState(false);

  // Load currencies for the filter
  useEffect(() => {
    carrierQuoteApi.getCurrencies().then(data => setCurrencies(data || [])).catch(() => {});
  }, []);

  // Count active filters
  const activeFilterCount = [
    filterRegion, filterServiceType, filterCarrier, filterDateFrom, filterDateTo,
    filterLocation, filterLocationA, filterLocationB, filterProtection, filterBandwidthUnit, filterCurrency,
    filterContractTerm, filterCableSystem, filterTransitCountries, filterTransitCities,
    filterMinMrc, filterMaxMrc, filterMinNrc, filterMaxNrc
  ].filter(Boolean).length;

  // Load quotes
  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        search: searchTerm || undefined,
        carrier: filterCarrier || undefined,
        region: filterRegion || undefined,
        service_type: filterServiceType || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
        location: filterLocation || undefined,
        location_a: filterLocationA || undefined,
        location_b: filterLocationB || undefined,
        protection: filterProtection || undefined,
        bandwidth_unit: filterBandwidthUnit || undefined,
        currency: filterCurrency || undefined,
        contract_term: filterContractTerm || undefined,
        cable_system: filterCableSystem || undefined,
        transit_countries: filterTransitCountries || undefined,
        transit_cities: filterTransitCities || undefined,
        min_mrc: filterMinMrc || undefined,
        max_mrc: filterMaxMrc || undefined,
        min_nrc: filterMinNrc || undefined,
        max_nrc: filterMaxNrc || undefined,
        sort_by: orderBy || undefined,
        sort_order: order || undefined,
        limit: rowsPerPage,
        offset: page * rowsPerPage
      };
      const data = await carrierQuoteApi.getQuotes(params);
      setQuotes(data.quotes || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError('Failed to load quotes: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterCarrier, filterRegion, filterServiceType, filterDateFrom, filterDateTo,
      filterLocation, filterLocationA, filterLocationB, filterProtection, filterBandwidthUnit, filterCurrency,
      filterContractTerm, filterCableSystem, filterTransitCountries, filterTransitCities,
      filterMinMrc, filterMaxMrc, filterMinNrc, filterMaxNrc, orderBy, order, page, rowsPerPage]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  // Handle search
  const handleSearch = () => {
    setPage(0);
    loadQuotes();
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterRegion('');
    setFilterServiceType('');
    setFilterCarrier('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterLocation('');
    setFilterLocationA('');
    setFilterLocationB('');
    setFilterProtection('');
    setFilterBandwidthUnit('');
    setFilterCurrency('');
    setFilterContractTerm('');
    setFilterCableSystem('');
    setFilterTransitCountries('');
    setFilterTransitCities('');
    setFilterMinMrc('');
    setFilterMaxMrc('');
    setFilterMinNrc('');
    setFilterMaxNrc('');
    setPage(0);
  };

  // Handle sort
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
    setPage(0);
  };

  // View quote details
  const handleView = async (quote) => {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const data = await carrierQuoteApi.getQuote(quote.id);
      setViewQuote(data);
    } catch (err) {
      setError('Failed to load quote details');
      setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  // Delete quote
  const handleDelete = (quote) => {
    setDeleteTarget(quote);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await carrierQuoteApi.deleteQuote(deleteTarget.id);
      setSuccess(`Quote ${deleteTarget.quote_reference} deleted`);
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      loadQuotes();
    } catch (err) {
      setError('Failed to delete quote: ' + (err.response?.data?.error || err.message));
    }
  };

  // Handle attachment download
  const handleDownloadAttachment = async (attachment) => {
    try {
      await carrierQuoteApi.downloadAttachment(attachment.id, attachment.file_name);
    } catch (err) {
      setError('Failed to download attachment');
    }
  };

  // Handle attachment delete
  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await carrierQuoteApi.deleteAttachment(attachmentId);
      if (viewQuote) {
        const data = await carrierQuoteApi.getQuote(viewQuote.id);
        setViewQuote(data);
      }
      setSuccess('Attachment deleted');
    } catch (err) {
      setError('Failed to delete attachment');
    }
  };

  // Handle price stage delete
  const handleDeletePriceStage = async (stageId) => {
    if (!viewQuote) return;
    try {
      await carrierQuoteApi.deletePriceStage(viewQuote.id, stageId);
      const data = await carrierQuoteApi.getQuote(viewQuote.id);
      setViewQuote(data);
      setSuccess('Price stage deleted');
    } catch (err) {
      setError('Failed to delete price stage: ' + (err.response?.data?.error || err.message));
    }
  };

  // Upload attachments to existing quote
  const handleUploadToExisting = async (files) => {
    if (!viewQuote || files.length === 0) return;
    setUploading(true);
    try {
      await carrierQuoteApi.uploadAttachments(viewQuote.id, files);
      const data = await carrierQuoteApi.getQuote(viewQuote.id);
      setViewQuote(data);
      setSuccess('Files uploaded successfully');
    } catch (err) {
      setError('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  // Export CSV
  const handleExport = async () => {
    try {
      await carrierQuoteApi.exportCSV({
        search: searchTerm,
        carrier: filterCarrier,
        region: filterRegion,
        service_type: filterServiceType,
        location: filterLocation,
        protection: filterProtection,
        bandwidth_unit: filterBandwidthUnit,
        currency: filterCurrency,
        contract_term: filterContractTerm,
        cable_system: filterCableSystem,
        transit_countries: filterTransitCountries,
        transit_cities: filterTransitCities
      });
    } catch (err) {
      setError('Failed to export CSV');
    }
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Get location display name (with city if available)
  const getLocationDisplay = (quote, side) => {
    const type = quote[`location_${side}_type`];
    const popCode = quote[`location_${side}_pop_code`];
    const customName = quote[`location_${side}_custom_name`];
    const customCity = quote[`location_${side}_custom_city`];
    const popCity = quote[`location_${side}_city`];
    
    if (type === 'custom' && customName) {
      return customCity ? `${customName} (${customCity})` : customName;
    }
    if (popCode) {
      return popCity ? `${popCode} (${popCity})` : popCode;
    }
    return '-';
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" gutterBottom>
        Quote Repository
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Search and browse carrier network bandwidth quotes with historical data
      </Typography>

      {/* Search & Primary Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search quotes, carriers, locations, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>
              }}
            />
          </Grid>
          <Grid item xs={6} md={1.5}>
            <FormControl fullWidth size="small">
              <InputLabel>Region</InputLabel>
              <Select value={filterRegion} onChange={(e) => { setFilterRegion(e.target.value); setPage(0); }} label="Region">
                <MenuItem value="">All</MenuItem>
                {REGIONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={1.5}>
            <FormControl fullWidth size="small">
              <InputLabel>Service</InputLabel>
              <Select value={filterServiceType} onChange={(e) => { setFilterServiceType(e.target.value); setPage(0); }} label="Service">
                <MenuItem value="">All</MenuItem>
                {SERVICE_TYPES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={1.5}>
            <TextField
              fullWidth
              size="small"
              placeholder="Carrier..."
              value={filterCarrier}
              onChange={(e) => setFilterCarrier(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Location A (e.g. London)"
                value={filterLocationA}
                onChange={(e) => setFilterLocationA(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <SwapHorizIcon color="action" sx={{ flexShrink: 0 }} />
              <TextField
                fullWidth
                size="small"
                placeholder="Location B (e.g. Singapore)"
                value={filterLocationB}
                onChange={(e) => setFilterLocationB(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={2}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Tooltip title="Search">
                <IconButton onClick={handleSearch} color="primary" size="small"><SearchIcon /></IconButton>
              </Tooltip>
              <Tooltip title="Refresh">
                <IconButton onClick={loadQuotes} size="small"><RefreshIcon /></IconButton>
              </Tooltip>
              <Button
                size="small"
                variant={showAdvancedFilters ? 'contained' : 'outlined'}
                startIcon={showAdvancedFilters ? <ExpandLessIcon /> : <FilterListIcon />}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                sx={{ minWidth: 'auto', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              >
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Button>
              {activeFilterCount > 0 && (
                <Tooltip title="Clear all filters">
                  <IconButton onClick={handleClearFilters} size="small" color="error"><ClearIcon /></IconButton>
                </Tooltip>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* Advanced Filters - Collapsible */}
        <Collapse in={showAdvancedFilters}>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Advanced Filters</Typography>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={6} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Protection</InputLabel>
                <Select value={filterProtection} onChange={(e) => { setFilterProtection(e.target.value); setPage(0); }} label="Protection">
                  <MenuItem value="">All</MenuItem>
                  {PROTECTION_TYPES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>BW Unit</InputLabel>
                <Select value={filterBandwidthUnit} onChange={(e) => { setFilterBandwidthUnit(e.target.value); setPage(0); }} label="BW Unit">
                  <MenuItem value="">All</MenuItem>
                  {BANDWIDTH_UNITS.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Currency</InputLabel>
                <Select value={filterCurrency} onChange={(e) => { setFilterCurrency(e.target.value); setPage(0); }} label="Currency">
                  <MenuItem value="">All</MenuItem>
                  {currencies.map(c => <MenuItem key={c.currency_code} value={c.currency_code}>{c.currency_code}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Term</InputLabel>
                <Select value={filterContractTerm} onChange={(e) => { setFilterContractTerm(e.target.value); setPage(0); }} label="Term">
                  <MenuItem value="">All</MenuItem>
                  {CONTRACT_TERMS.map(t => <MenuItem key={t} value={t}>{t} months</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Cable System..."
                value={filterCableSystem}
                onChange={(e) => setFilterCableSystem(e.target.value)}
              />
            </Grid>
            <Grid item xs={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Transit Countries..."
                value={filterTransitCountries}
                onChange={(e) => setFilterTransitCountries(e.target.value)}
                helperText="Comma for multiple"
              />
            </Grid>
            <Grid item xs={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Transit Cities..."
                value={filterTransitCities}
                onChange={(e) => setFilterTransitCities(e.target.value)}
                helperText="Comma for multiple"
              />
            </Grid>
            <Grid item xs={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Any Location..."
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                helperText="Matches either side"
              />
            </Grid>
            <Grid item xs={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Quote From"
                value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Quote To"
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
          <Grid container spacing={1.5} alignItems="center" sx={{ mt: 0.5 }}>
            <Grid item xs={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                label="Min MRC"
                type="number"
                value={filterMinMrc}
                onChange={(e) => setFilterMinMrc(e.target.value)}
              />
            </Grid>
            <Grid item xs={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                label="Max MRC"
                type="number"
                value={filterMaxMrc}
                onChange={(e) => setFilterMaxMrc(e.target.value)}
              />
            </Grid>
            <Grid item xs={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                label="Min NRC"
                type="number"
                value={filterMinNrc}
                onChange={(e) => setFilterMinNrc(e.target.value)}
              />
            </Grid>
            <Grid item xs={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                label="Max NRC"
                type="number"
                value={filterMaxNrc}
                onChange={(e) => setFilterMaxNrc(e.target.value)}
              />
            </Grid>
          </Grid>
        </Collapse>

        {/* Action row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => onNavigateToAddQuote && onNavigateToAddQuote()} size="small">
              Add Quote
            </Button>
            <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExport} size="small">
              Export CSV
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
            {total} quote{total !== 1 ? 's' : ''} found
          </Typography>
        </Box>
      </Paper>

      {/* Quotes Table */}
      <TableContainer component={Paper}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {[
                { id: 'quote_reference', label: 'Quote Ref' },
                { id: 'carrier_name', label: 'Carrier' },
                { id: 'service_type', label: 'Service' },
                { id: 'region', label: 'Region' },
                { id: 'location_a_pop_code', label: 'Location A' },
                { id: 'location_b_pop_code', label: 'Location B' },
                { id: 'bandwidth_value', label: 'Bandwidth' },
                { id: 'mrc', label: 'MRC' },
                { id: 'nrc', label: 'NRC' },
                { id: 'currency', label: 'Ccy' },
                { id: 'quote_date', label: 'Quote Date' },
                { id: 'created_at', label: 'Added' }
              ].map(col => (
                <TableCell key={col.id} sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={orderBy === col.id}
                    direction={orderBy === col.id ? order : 'asc'}
                    onClick={() => handleRequestSort(col.id)}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={13} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No quotes found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              quotes.map(quote => (
                <TableRow key={quote.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleView(quote)}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{quote.quote_reference}</Typography>
                  </TableCell>
                  <TableCell>{quote.carrier_name}</TableCell>
                  <TableCell>
                    <Chip label={quote.service_type} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip label={quote.region} size="small" color={
                      quote.region === 'AMERs' ? 'primary' :
                      quote.region === 'APAC' ? 'success' :
                      quote.region === 'EMEA' ? 'warning' : 'info'
                    } variant="outlined" />
                  </TableCell>
                  <TableCell>{getLocationDisplay(quote, 'a')}</TableCell>
                  <TableCell>{getLocationDisplay(quote, 'b')}</TableCell>
                  <TableCell>{quote.bandwidth_unit === 'Dark Fiber' ? 'Dark Fiber' : `${quote.bandwidth_value} ${quote.bandwidth_unit}`}</TableCell>
                  <TableCell>{quote.mrc != null ? quote.mrc.toLocaleString() : '-'}</TableCell>
                  <TableCell>{quote.nrc != null ? quote.nrc.toLocaleString() : '-'}</TableCell>
                  <TableCell>{quote.currency}</TableCell>
                  <TableCell>{formatDate(quote.quote_date)}</TableCell>
                  <TableCell>{formatDate(quote.created_at)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => handleView(quote)}><VisibilityIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      {canEdit && (
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => onNavigateToAddQuote && onNavigateToAddQuote(quote.id)}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDelete(quote)}><DeleteIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>

      {/* View Quote Details Dialog */}
      <Dialog open={viewOpen} onClose={() => { setViewOpen(false); setViewQuote(null); }} maxWidth="md" fullWidth disableRestoreFocus>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Quote Details</Typography>
            {viewQuote && (
              <Chip label={viewQuote.quote_reference} color="primary" variant="outlined" />
            )}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {viewLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : viewQuote ? (
            <Grid container spacing={2}>
              {/* Quote Info */}
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Carrier</Typography>
                <Typography variant="body2">{viewQuote.carrier_name}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Carrier Quote Ref</Typography>
                <Typography variant="body2">{viewQuote.carrier_quote_ref || '-'}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Service Type</Typography>
                <Typography variant="body2"><Chip label={viewQuote.service_type} size="small" variant="outlined" /></Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Region</Typography>
                <Typography variant="body2"><Chip label={viewQuote.region} size="small" variant="outlined" /></Typography>
              </Grid>

              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Location A</Typography>
                <Typography variant="body2">{getLocationDisplay(viewQuote, 'a')}</Typography>
                {viewQuote.location_a_custom_address && (
                  <Typography variant="caption" color="text.secondary">{viewQuote.location_a_custom_address}</Typography>
                )}
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Location B</Typography>
                <Typography variant="body2">{getLocationDisplay(viewQuote, 'b')}</Typography>
                {viewQuote.location_b_custom_address && (
                  <Typography variant="caption" color="text.secondary">{viewQuote.location_b_custom_address}</Typography>
                )}
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Bandwidth</Typography>
                <Typography variant="body2">
                  {viewQuote.bandwidth_unit === 'Dark Fiber' ? 'Dark Fiber' : `${viewQuote.bandwidth_value} ${viewQuote.bandwidth_unit}`}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Protection</Typography>
                <Typography variant="body2">{viewQuote.protection || '-'}</Typography>
              </Grid>

              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">MRC</Typography>
                <Typography variant="body2">{viewQuote.mrc != null ? `${viewQuote.currency} ${viewQuote.mrc.toLocaleString()}` : '-'}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">NRC</Typography>
                <Typography variant="body2">{viewQuote.nrc != null ? `${viewQuote.currency} ${viewQuote.nrc.toLocaleString()}` : '-'}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Contract Term</Typography>
                <Typography variant="body2">{viewQuote.contract_term ? `${viewQuote.contract_term} months` : '-'}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Expected Latency</Typography>
                <Typography variant="body2">{viewQuote.expected_latency ? `${viewQuote.expected_latency} ms` : '-'}</Typography>
              </Grid>

              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Cable System</Typography>
                <Typography variant="body2">{viewQuote.cable_system || '-'}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">MTU</Typography>
                <Typography variant="body2">{viewQuote.mtu || '-'}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Quote Date</Typography>
                <Typography variant="body2">{formatDate(viewQuote.quote_date)}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Expiry Date</Typography>
                <Typography variant="body2">{formatDate(viewQuote.expiry_date)}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Route Distance</Typography>
                <Typography variant="body2">{viewQuote.route_distance_km ? `${viewQuote.route_distance_km} km` : '-'}</Typography>
              </Grid>

              {/* Transit Info */}
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">Transit Cities</Typography>
                <Typography variant="body2">{viewQuote.transit_cities || '-'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">Transit Countries</Typography>
                <Typography variant="body2">{viewQuote.transit_countries || '-'}</Typography>
              </Grid>

              {/* Notes */}
              {viewQuote.notes && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Notes</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{viewQuote.notes}</Typography>
                </Grid>
              )}

              {/* Price Negotiation History */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TimelineIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2">
                    Price Negotiation History ({viewQuote.price_stages?.length || 0})
                  </Typography>
                </Box>
                {viewQuote.price_stages && viewQuote.price_stages.length > 0 ? (
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Stage</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 600 }} align="right">MRC</TableCell>
                          <TableCell sx={{ fontWeight: 600 }} align="right">NRC</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Ccy</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>By</TableCell>
                          {canEdit && <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {viewQuote.price_stages.map((stage, idx) => {
                          const prevStage = idx > 0 ? viewQuote.price_stages[idx - 1] : null;
                          const mrcChange = prevStage && prevStage.mrc && stage.mrc ? stage.mrc - prevStage.mrc : null;
                          const nrcChange = prevStage && prevStage.nrc && stage.nrc ? stage.nrc - prevStage.nrc : null;
                          
                          return (
                            <TableRow key={stage.id} sx={idx === viewQuote.price_stages.length - 1 ? { backgroundColor: 'action.hover' } : {}}>
                              <TableCell>
                                <Chip label={stage.stage_name} size="small" variant="outlined" color={
                                  stage.stage_name === 'Best and Final' ? 'success' :
                                  stage.stage_name === 'Discounted' ? 'info' :
                                  stage.stage_name === 'Counter Offer' ? 'warning' : 'default'
                                } />
                              </TableCell>
                              <TableCell>{formatDate(stage.stage_date)}</TableCell>
                              <TableCell align="right">
                                {stage.mrc != null ? stage.mrc.toLocaleString() : '-'}
                                {mrcChange != null && mrcChange !== 0 && (
                                  <Typography variant="caption" sx={{ ml: 0.5, color: mrcChange < 0 ? 'success.main' : 'error.main' }}>
                                    ({mrcChange > 0 ? '+' : ''}{mrcChange.toLocaleString()})
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">
                                {stage.nrc != null ? stage.nrc.toLocaleString() : '-'}
                                {nrcChange != null && nrcChange !== 0 && (
                                  <Typography variant="caption" sx={{ ml: 0.5, color: nrcChange < 0 ? 'success.main' : 'error.main' }}>
                                    ({nrcChange > 0 ? '+' : ''}{nrcChange.toLocaleString()})
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>{stage.currency}</TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {stage.notes || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">{stage.created_by_name || stage.created_by_username || '-'}</Typography>
                              </TableCell>
                              {canEdit && (
                                <TableCell>
                                  <IconButton size="small" color="error" onClick={() => handleDeletePriceStage(stage.id)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                    No price stages recorded. Use the Add Quote page to track price negotiations.
                  </Typography>
                )}
                {viewQuote.price_stages && viewQuote.price_stages.length > 1 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <TrendingDownIcon fontSize="small" color="success" />
                    <Typography variant="caption" color="text.secondary">
                      {(() => {
                        const first = viewQuote.price_stages[0];
                        const last = viewQuote.price_stages[viewQuote.price_stages.length - 1];
                        if (first.mrc && last.mrc) {
                          const pctChange = ((last.mrc - first.mrc) / first.mrc * 100).toFixed(1);
                          return `MRC: ${first.mrc.toLocaleString()} → ${last.mrc.toLocaleString()} (${pctChange > 0 ? '+' : ''}${pctChange}%)`;
                        }
                        return 'Price change tracking from initial to latest stage';
                      })()}
                    </Typography>
                  </Box>
                )}
              </Grid>

              {/* Attachments */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2">
                    Attachments ({viewQuote.attachments?.length || 0})
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={uploading ? <CircularProgress size={14} /> : <UploadFileIcon />}
                    disabled={uploading}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.accept = '.kmz,.kml,.pdf,.eml,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.msg,.txt,.csv';
                      input.onchange = (e) => handleUploadToExisting(Array.from(e.target.files));
                      input.click();
                    }}
                  >
                    Upload Files
                  </Button>
                </Box>
                {viewQuote.attachments && viewQuote.attachments.length > 0 ? (
                  <List dense>
                    {viewQuote.attachments.map(att => (
                      <ListItem key={att.id}>
                        <ListItemIcon>
                          {['.kmz', '.kml'].includes(att.file_type) ? <MapIcon /> : <InsertDriveFileIcon />}
                        </ListItemIcon>
                        <ListItemText
                          primary={att.file_name}
                          secondary={`${att.file_type} • ${att.file_size ? (att.file_size / 1024).toFixed(1) + ' KB' : ''} • ${formatDate(att.uploaded_at)}`}
                        />
                        <ListItemSecondaryAction>
                          <IconButton size="small" onClick={() => handleDownloadAttachment(att)}>
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                          {canDelete && (
                            <IconButton size="small" color="error" onClick={() => handleDeleteAttachment(att.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No attachments</Typography>
                )}
              </Grid>

              {/* Audit Info */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', gap: 4 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Created By</Typography>
                    <Typography variant="body2">{viewQuote.created_by_name || viewQuote.created_by_username || '-'}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatDate(viewQuote.created_at)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Last Updated By</Typography>
                    <Typography variant="body2">{viewQuote.updated_by_name || viewQuote.updated_by_username || '-'}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatDate(viewQuote.updated_at)}</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          ) : null}
        </DialogContent>
        <DialogActions>
          {viewQuote && canEdit && (
            <Button onClick={() => { setViewOpen(false); onNavigateToAddQuote && onNavigateToAddQuote(viewQuote.id); }} startIcon={<EditIcon />}>
              Edit
            </Button>
          )}
          <Button onClick={() => { setViewOpen(false); setViewQuote(null); }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} disableRestoreFocus>
        <DialogTitle>Delete Quote</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete quote <strong>{deleteTarget?.quote_reference}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will also delete all associated attachments. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>
      </Snackbar>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
      </Snackbar>
    </Box>
  );
};

export default CarrierQuoteRepository;
