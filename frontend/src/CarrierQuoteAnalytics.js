import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Grid, FormControl, InputLabel, Select, MenuItem,
  TextField, Button, CircularProgress, Alert, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Autocomplete, Collapse,
  FormControlLabel, Checkbox, OutlinedInput, Stack
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ClearIcon from '@mui/icons-material/Clear';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, LineChart, Line, Legend
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import { carrierQuoteApi } from './api';

const fmt = (n, digits = 0) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
};

const EMPTY_FILTERS = {
  search: '',
  carriers: [],
  date_from: '',
  date_to: '',
  regions: [],
  service_types: [],
  protections: [],
  bandwidth_unit: '',
  source_currency: '',
  contract_term: '',
  location: '',
  location_a: '',
  location_b: '',
  city_a: '',
  city_b: '',
  country_a: '',
  country_b: '',
  building_pair: '',
  building_type_a: '',
  building_type_b: '',
  cable_system: '',
  transit_countries: '',
  transit_cities: '',
  min_mrc: '',
  max_mrc: '',
  min_nrc: '',
  max_nrc: '',
  min_bandwidth_mbps: '',
  max_bandwidth_mbps: '',
  min_latency: '',
  max_latency: '',
  exclude_expired: false,
  display_currency: 'USD',
  term: '12'
};

const toApiParams = (f) => ({
  search: f.search || undefined,
  carriers: f.carriers || [],
  date_from: f.date_from || undefined,
  date_to: f.date_to || undefined,
  region: f.regions || [],
  service_type: f.service_types || [],
  protection: f.protections || [],
  bandwidth_unit: f.bandwidth_unit || undefined,
  source_currency: f.source_currency || undefined,
  contract_term: f.contract_term || undefined,
  location: f.location || undefined,
  location_a: f.location_a || undefined,
  location_b: f.location_b || undefined,
  city_a: f.city_a || undefined,
  city_b: f.city_b || undefined,
  country_a: f.country_a || undefined,
  country_b: f.country_b || undefined,
  building_pair: f.building_pair || undefined,
  building_type_a: f.building_type_a || undefined,
  building_type_b: f.building_type_b || undefined,
  cable_system: f.cable_system || undefined,
  transit_countries: f.transit_countries || undefined,
  transit_cities: f.transit_cities || undefined,
  min_mrc: f.min_mrc || undefined,
  max_mrc: f.max_mrc || undefined,
  min_nrc: f.min_nrc || undefined,
  max_nrc: f.max_nrc || undefined,
  min_bandwidth_mbps: f.min_bandwidth_mbps || undefined,
  max_bandwidth_mbps: f.max_bandwidth_mbps || undefined,
  min_latency: f.min_latency || undefined,
  max_latency: f.max_latency || undefined,
  exclude_expired: f.exclude_expired || undefined,
  display_currency: f.display_currency || 'USD',
  term: f.term || '12'
});

const AggTable = ({ title, rows, currency }) => (
  <Paper sx={{ p: 2, height: '100%' }}>
    <Typography variant="subtitle1" gutterBottom>{title}</Typography>
    <TableContainer sx={{ maxHeight: 320 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Group</TableCell>
            <TableCell align="right">n</TableCell>
            <TableCell align="right">Avg MRC ({currency})</TableCell>
            <TableCell align="right">Avg NRC ({currency})</TableCell>
            <TableCell align="right">Avg $/Mbps</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(rows || []).length === 0 && (
            <TableRow>
              <TableCell colSpan={5} align="center">No data</TableCell>
            </TableRow>
          )}
          {(rows || []).map((r) => (
            <TableRow key={r.key} hover>
              <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.key}</TableCell>
              <TableCell align="right">{r.n}</TableCell>
              <TableCell align="right">{fmt(r.avg_mrc, 0)}</TableCell>
              <TableCell align="right">{fmt(r.avg_nrc, 0)}</TableCell>
              <TableCell align="right">{fmt(r.avg_per_mbps, 2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  </Paper>
);

const CarrierQuoteAnalytics = () => {
  const theme = useTheme();
  const chartTick = theme.palette.text.secondary;
  const chartGrid = theme.palette.divider;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [currencies, setCurrencies] = useState([{ currency_code: 'USD' }]);
  const [carrierOptions, setCarrierOptions] = useState([]);
  const [draft, setDraft] = useState({ ...EMPTY_FILTERS });
  const [applied, setApplied] = useState({ ...EMPTY_FILTERS });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const setDraftField = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (applied.search) n += 1;
    if ((applied.carriers || []).length) n += 1;
    if (applied.date_from) n += 1;
    if (applied.date_to) n += 1;
    if ((applied.regions || []).length) n += 1;
    if ((applied.service_types || []).length) n += 1;
    if ((applied.protections || []).length) n += 1;
    [
      'bandwidth_unit', 'source_currency', 'contract_term', 'location', 'location_a', 'location_b',
      'city_a', 'city_b', 'country_a', 'country_b', 'building_pair', 'building_type_a', 'building_type_b',
      'cable_system', 'transit_countries', 'transit_cities',
      'min_mrc', 'max_mrc', 'min_nrc', 'max_nrc',
      'min_bandwidth_mbps', 'max_bandwidth_mbps', 'min_latency', 'max_latency'
    ].forEach(k => { if (applied[k]) n += 1; });
    if (applied.exclude_expired) n += 1;
    return n;
  }, [applied]);

  const loadReference = useCallback(async () => {
    try {
      const [currencyList, carriers] = await Promise.all([
        carrierQuoteApi.getCurrencies(),
        carrierQuoteApi.getCarriers()
      ]);
      if (currencyList && currencyList.length) setCurrencies(currencyList);
      setCarrierOptions((carriers || []).map(c => c.carrier_name).filter(Boolean));
    } catch (_) { /* keep defaults */ }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await carrierQuoteApi.getAnalytics(toApiParams(applied));
      setData(result);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    loadReference();
  }, [loadReference]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleApply = () => setApplied({ ...draft });
  const handleClear = () => {
    const cleared = { ...EMPTY_FILTERS, display_currency: draft.display_currency || 'USD', term: draft.term || '12' };
    setDraft(cleared);
    setApplied(cleared);
  };

  const currency = data?.display_currency || applied.display_currency || 'USD';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Quote Analytics</Typography>
          <Typography variant="body2" color="text.secondary">
            Pricing averages for go-to-market insight — city pairs, building types, routing, and more.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ClearIcon />} onClick={handleClear} disabled={loading}>
            Clear filters
          </Button>
          <Button startIcon={<RefreshIcon />} onClick={loadAnalytics} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterListIcon fontSize="small" color="action" />
            <Typography variant="subtitle1">Filters</Typography>
            {activeFilterCount > 0 && <Chip size="small" label={`${activeFilterCount} active`} color="primary" />}
          </Box>
          <Button
            size="small"
            endIcon={advancedOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setAdvancedOpen(v => !v)}
          >
            {advancedOpen ? 'Hide advanced' : 'Show advanced'}
          </Button>
        </Box>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <Autocomplete
              multiple
              size="small"
              options={carrierOptions}
              value={draft.carriers}
              onChange={(_, value) => setDraftField('carriers', value)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip size="small" label={option} {...getTagProps({ index })} key={option} />
                ))
              }
              renderInput={(params) => (
                <TextField {...params} label="Carriers" placeholder="Select one or more carriers" />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth size="small" type="date" label="Quote from" InputLabelProps={{ shrink: true }}
              value={draft.date_from}
              onChange={(e) => setDraftField('date_from', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth size="small" type="date" label="Quote to" InputLabelProps={{ shrink: true }}
              value={draft.date_to}
              onChange={(e) => setDraftField('date_to', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Pricing term</InputLabel>
              <Select label="Pricing term" value={draft.term} onChange={(e) => setDraftField('term', e.target.value)}>
                <MenuItem value="12">12 month</MenuItem>
                <MenuItem value="24">24 month</MenuItem>
                <MenuItem value="36">36 month</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Display currency</InputLabel>
              <Select
                label="Display currency"
                value={draft.display_currency}
                onChange={(e) => setDraftField('display_currency', e.target.value)}
              >
                {currencies.map(c => (
                  <MenuItem key={c.currency_code} value={c.currency_code}>{c.currency_code}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Collapse in={advancedOpen}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth size="small" label="Search"
                placeholder="Reference, carrier ref, notes, cable…"
                value={draft.search}
                onChange={(e) => setDraftField('search', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Regions</InputLabel>
                <Select
                  multiple
                  label="Regions"
                  value={draft.regions}
                  onChange={(e) => setDraftField('regions', e.target.value)}
                  input={<OutlinedInput label="Regions" />}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {['AMERs', 'APAC', 'EMEA', 'INTER'].map(r => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Service types</InputLabel>
                <Select
                  multiple
                  label="Service types"
                  value={draft.service_types}
                  onChange={(e) => setDraftField('service_types', e.target.value)}
                  input={<OutlinedInput label="Service types" />}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {['MPLS', 'Ethernet', 'Dark Fiber', 'Wavelength'].map(r => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Protection</InputLabel>
                <Select
                  multiple
                  label="Protection"
                  value={draft.protections}
                  onChange={(e) => setDraftField('protections', e.target.value)}
                  input={<OutlinedInput label="Protection" />}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {['Unprotected', 'Protected', 'Diverse'].map(r => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Bandwidth unit</InputLabel>
                <Select
                  label="Bandwidth unit"
                  value={draft.bandwidth_unit}
                  onChange={(e) => setDraftField('bandwidth_unit', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Mbps">Mbps</MenuItem>
                  <MenuItem value="Gbps">Gbps</MenuItem>
                  <MenuItem value="Dark Fiber">Dark Fiber</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Has term pricing</InputLabel>
                <Select
                  label="Has term pricing"
                  value={draft.contract_term}
                  onChange={(e) => setDraftField('contract_term', e.target.value)}
                >
                  <MenuItem value="">Any</MenuItem>
                  <MenuItem value="12">12 month quoted</MenuItem>
                  <MenuItem value="24">24 month quoted</MenuItem>
                  <MenuItem value="36">36 month quoted</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Source currency</InputLabel>
                <Select
                  label="Source currency"
                  value={draft.source_currency}
                  onChange={(e) => setDraftField('source_currency', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {currencies.map(c => (
                    <MenuItem key={c.currency_code} value={c.currency_code}>{c.currency_code}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Location (either end)" value={draft.location} onChange={(e) => setDraftField('location', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Location A" value={draft.location_a} onChange={(e) => setDraftField('location_a', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Location B" value={draft.location_b} onChange={(e) => setDraftField('location_b', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Building pair</InputLabel>
                <Select
                  label="Building pair"
                  value={draft.building_pair}
                  onChange={(e) => setDraftField('building_pair', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="datacenter-datacenter">DC–DC</MenuItem>
                  <MenuItem value="dc-retail">DC–Retail</MenuItem>
                  <MenuItem value="retail-retail">Retail–Retail</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={3} md={2}>
              <TextField fullWidth size="small" label="City A" value={draft.city_a} onChange={(e) => setDraftField('city_a', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField fullWidth size="small" label="City B" value={draft.city_b} onChange={(e) => setDraftField('city_b', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField fullWidth size="small" label="Country A" value={draft.country_a} onChange={(e) => setDraftField('country_a', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField fullWidth size="small" label="Country B" value={draft.country_b} onChange={(e) => setDraftField('country_b', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>A building</InputLabel>
                <Select label="A building" value={draft.building_type_a} onChange={(e) => setDraftField('building_type_a', e.target.value)}>
                  <MenuItem value="">Any</MenuItem>
                  <MenuItem value="datacenter">Datacenter</MenuItem>
                  <MenuItem value="retail">Retail</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>B building</InputLabel>
                <Select label="B building" value={draft.building_type_b} onChange={(e) => setDraftField('building_type_b', e.target.value)}>
                  <MenuItem value="">Any</MenuItem>
                  <MenuItem value="datacenter">Datacenter</MenuItem>
                  <MenuItem value="retail">Retail</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" label="Cable system" value={draft.cable_system} onChange={(e) => setDraftField('cable_system', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" label="Transit countries" value={draft.transit_countries} onChange={(e) => setDraftField('transit_countries', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" label="Transit cities" value={draft.transit_cities} onChange={(e) => setDraftField('transit_cities', e.target.value)} />
            </Grid>

            <Grid item xs={6} sm={3} md={3}>
              <TextField fullWidth size="small" type="number" label={`Min MRC (${draft.display_currency})`} value={draft.min_mrc} onChange={(e) => setDraftField('min_mrc', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3} md={3}>
              <TextField fullWidth size="small" type="number" label={`Max MRC (${draft.display_currency})`} value={draft.max_mrc} onChange={(e) => setDraftField('max_mrc', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3} md={3}>
              <TextField fullWidth size="small" type="number" label={`Min NRC (${draft.display_currency})`} value={draft.min_nrc} onChange={(e) => setDraftField('min_nrc', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3} md={3}>
              <TextField fullWidth size="small" type="number" label={`Max NRC (${draft.display_currency})`} value={draft.max_nrc} onChange={(e) => setDraftField('max_nrc', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3} md={3}>
              <TextField fullWidth size="small" type="number" label="Min Mbps" value={draft.min_bandwidth_mbps} onChange={(e) => setDraftField('min_bandwidth_mbps', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3} md={3}>
              <TextField fullWidth size="small" type="number" label="Max Mbps" value={draft.max_bandwidth_mbps} onChange={(e) => setDraftField('max_bandwidth_mbps', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3} md={3}>
              <TextField fullWidth size="small" type="number" label="Min latency" value={draft.min_latency} onChange={(e) => setDraftField('min_latency', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3} md={3}>
              <TextField fullWidth size="small" type="number" label="Max latency" value={draft.max_latency} onChange={(e) => setDraftField('max_latency', e.target.value)} />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!draft.exclude_expired}
                    onChange={(e) => setDraftField('exclude_expired', e.target.checked)}
                  />
                }
                label="Exclude expired quotes"
              />
            </Grid>
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button variant="contained" onClick={handleApply} disabled={loading}>
            Apply filters
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && data && (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">Sample size</Typography>
                <Typography variant="h5">{data.sample_size}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">Avg MRC ({currency})</Typography>
                <Typography variant="h5">{fmt(data.overall?.avg_mrc, 0)}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">Avg NRC ({currency})</Typography>
                <Typography variant="h5">{fmt(data.overall?.avg_nrc, 0)}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">Avg $/Mbps</Typography>
                <Typography variant="h5">{fmt(data.overall?.avg_per_mbps, 2)}</Typography>
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>DC vs Retail building pairs</Typography>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.by_building_pair || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="key" stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <YAxis stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        borderColor: theme.palette.divider,
                        color: theme.palette.text.primary
                      }}
                    />
                    <Legend wrapperStyle={{ color: chartTick }} />
                    <Bar dataKey="avg_mrc" name={`Avg MRC (${currency})`} fill="#1976d2" />
                    <Bar dataKey="n" name="Count" fill="#90caf9" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>Term discount curve</Typography>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.term_discount_curve || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="term" stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <YAxis stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        borderColor: theme.palette.divider,
                        color: theme.palette.text.primary
                      }}
                    />
                    <Legend wrapperStyle={{ color: chartTick }} />
                    <Line type="monotone" dataKey="avg_mrc" name={`Avg MRC (${currency})`} stroke="#2e7d32" />
                    <Line type="monotone" dataKey="avg_nrc" name={`Avg NRC (${currency})`} stroke="#ed6c02" />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>Latency vs MRC</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis type="number" dataKey="latency" name="Latency (ms)" stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <YAxis type="number" dataKey="mrc" name={`MRC (${currency})`} stroke={chartTick} tick={{ fill: chartTick, fontSize: 12 }} />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        borderColor: theme.palette.divider,
                        color: theme.palette.text.primary
                      }}
                    />
                    <Scatter data={data.latency_vs_price || []} fill="#7b1fa2" />
                  </ScatterChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>Quote freshness</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  <Chip label={`Total ${data.freshness?.total || 0}`} />
                  <Chip color="warning" label={`Expired ${data.freshness?.expired || 0}`} />
                  <Chip label={`Avg age ${fmt(data.freshness?.avg_age_days, 0)} days`} />
                  <Chip color="error" variant="outlined" label={`>90 days ${data.freshness?.older_than_90 || 0}`} />
                </Box>
                <Typography variant="subtitle2" gutterBottom>Carrier spread on city pairs</Typography>
                <TableContainer sx={{ maxHeight: 200 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>City pair</TableCell>
                        <TableCell align="right">n</TableCell>
                        <TableCell align="right">Min</TableCell>
                        <TableCell align="right">Max</TableCell>
                        <TableCell align="right">Spread</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(data.carrier_spread_by_city_pair || []).slice(0, 10).map(r => (
                        <TableRow key={r.city_pair}>
                          <TableCell>{r.city_pair}</TableCell>
                          <TableCell align="right">{r.n}</TableCell>
                          <TableCell align="right">{fmt(r.min_mrc, 0)}</TableCell>
                          <TableCell align="right">{fmt(r.max_mrc, 0)}</TableCell>
                          <TableCell align="right">{fmt(r.spread, 0)}</TableCell>
                        </TableRow>
                      ))}
                      {(data.carrier_spread_by_city_pair || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center">Need ≥2 quotes on the same city pair</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <AggTable title="By city pair" rows={data.by_city_pair} currency={currency} />
            </Grid>
            <Grid item xs={12} md={6}>
              <AggTable title="By transit countries" rows={data.by_transit_countries} currency={currency} />
            </Grid>
            <Grid item xs={12} md={6}>
              <AggTable title="By location" rows={data.by_location} currency={currency} />
            </Grid>
            <Grid item xs={12} md={6}>
              <AggTable title="By country pair" rows={data.by_country_pair} currency={currency} />
            </Grid>
            <Grid item xs={12} md={6}>
              <AggTable title="By carrier" rows={data.by_carrier} currency={currency} />
            </Grid>
            <Grid item xs={12} md={6}>
              <AggTable title="By bandwidth" rows={data.by_bandwidth} currency={currency} />
            </Grid>
            <Grid item xs={12} md={4}>
              <AggTable title="By service type" rows={data.by_service_type} currency={currency} />
            </Grid>
            <Grid item xs={12} md={4}>
              <AggTable title="By protection" rows={data.by_protection} currency={currency} />
            </Grid>
            <Grid item xs={12} md={4}>
              <AggTable title="By region" rows={data.by_region} currency={currency} />
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default CarrierQuoteAnalytics;
