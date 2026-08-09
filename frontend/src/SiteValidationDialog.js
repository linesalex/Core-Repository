import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid,
  TextField, Typography, FormControl, InputLabel, Select, MenuItem,
  Alert, CircularProgress, List, ListItem, ListItemButton, ListItemText,
  Chip, Divider, Link
} from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { carrierQuoteApi } from './api';

// Fix default marker icons (CRA / webpack)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const DEFAULT_CENTER = [20, 0];
const DEFAULT_ZOOM = 2;

const emptyForm = {
  location_name: '',
  street_name: '',
  street_number: '',
  city: '',
  postal_code: '',
  country: '',
  address: '',
  building_type: 'retail',
  latitude: null,
  longitude: null
};

function SiteValidationDialog({
  open,
  onClose,
  onConfirm,
  initialValues = {},
  title = 'Site validation',
  confirmLabel = 'Confirm',
  dialogSx
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const skipReverseRef = useRef(false);

  const [form, setForm] = useState({ ...emptyForm, ...initialValues });
  const [existingId, setExistingId] = useState(initialValues.id || null);
  const [popCode, setPopCode] = useState(initialValues.location_code || null);
  const isFixedPop = !!popCode;
  const [matches, setMatches] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [searching, setSearching] = useState(false);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState('');
  const [attribution] = useState('© OpenStreetMap contributors');
  // A brand-new / edited address must be checked against Nominatim (Search address)
  // or the pin dragged (reverse geocode) before it can be confirmed — unless the
  // user picked one of the Existing matches, or it's an already-verified/POP location.
  const [addressVerified, setAddressVerified] = useState(!!(initialValues.id || initialValues.location_code));

  const ADDRESS_FIELDS = ['street_name', 'street_number', 'city', 'postal_code', 'country', 'address'];
  const setField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (!isFixedPop && ADDRESS_FIELDS.includes(key)) setAddressVerified(false);
  };

  const placeMarker = useCallback((lat, lng, { reverse = false, draggable = true } = {}) => {
    if (!mapInstanceRef.current) return;
    const latLng = L.latLng(lat, lng);
    if (!markerRef.current) {
      markerRef.current = L.marker(latLng, { draggable }).addTo(mapInstanceRef.current);
      markerRef.current.on('dragend', async () => {
        if (!markerRef.current.options.draggable) return;
        const pos = markerRef.current.getLatLng();
        setForm(prev => ({ ...prev, latitude: pos.lat, longitude: pos.lng }));
        if (skipReverseRef.current) {
          skipReverseRef.current = false;
          return;
        }
        try {
          setSearching(true);
          const result = await carrierQuoteApi.reverseLocation({ latitude: pos.lat, longitude: pos.lng });
          if (result.result) {
            const r = result.result;
            setForm(prev => ({
              ...prev,
              street_name: r.street_name || prev.street_name,
              street_number: r.street_number || prev.street_number,
              city: r.city || prev.city,
              postal_code: r.postal_code || prev.postal_code,
              country: r.country || prev.country,
              address: r.address || prev.address,
              latitude: r.latitude ?? pos.lat,
              longitude: r.longitude ?? pos.lng
            }));
            setAddressVerified(true);
          }
        } catch (err) {
          setError(err.response?.data?.error || err.message || 'Reverse geocode failed');
        } finally {
          setSearching(false);
        }
      });
    } else {
      markerRef.current.setLatLng(latLng);
      if (markerRef.current.dragging) {
        if (draggable) markerRef.current.dragging.enable();
        else markerRef.current.dragging.disable();
      }
    }
    mapInstanceRef.current.setView(latLng, Math.max(mapInstanceRef.current.getZoom(), 14));
    setForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
    if (reverse) {
      // trigger reverse via dragend path intentionally skipped; caller handles
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    setForm({ ...emptyForm, ...initialValues });
    setExistingId(initialValues.id || null);
    setPopCode(initialValues.location_code || null);
    setAddressVerified(!!(initialValues.id || initialValues.location_code));
    setMatches([]);
    setWarnings([]);
    setError('');

    // Defer map init until dialog content is painted
    const timer = setTimeout(() => {
      if (!mapRef.current) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }

      mapInstanceRef.current = L.map(mapRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19
      }).addTo(mapInstanceRef.current);

      const lat = initialValues.latitude != null ? Number(initialValues.latitude) : null;
      const lng = initialValues.longitude != null ? Number(initialValues.longitude) : null;
      if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        placeMarker(lat, lng, { draggable: !(initialValues.location_code || initialValues.fixed_pop) });
      }

      setTimeout(() => mapInstanceRef.current && mapInstanceRef.current.invalidateSize(), 100);
    }, 50);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [open]);

  const runMatch = async (values) => {
    setMatching(true);
    try {
      const result = await carrierQuoteApi.matchLocation({ ...values, exclude_id: existingId || undefined });
      setMatches(result.matches || []);
      setWarnings(result.warnings || []);
    } catch (err) {
      // non-blocking
      setMatches([]);
    } finally {
      setMatching(false);
    }
  };

  useEffect(() => {
    if (!open || isFixedPop) return undefined;
    const t = setTimeout(() => {
      if (form.location_name || form.address || form.street_name || form.city) {
        runMatch(form);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [open, isFixedPop, form.location_name, form.address, form.street_name, form.street_number, form.city, form.country, form.postal_code]);

  // Explicit POP lookup only (Enter / Lookup POP) — avoids IPCSNG1 matching before IPCSNG11 is finished
  const handleLookupPop = async () => {
    if (isFixedPop) return;
    const name = String(form.location_name || '').trim();
    if (!name) {
      setError('Enter a POP code in Site name, then press Enter or click Lookup POP');
      return;
    }
    setError('');
    setSearching(true);
    try {
      const loc = await carrierQuoteApi.getPopLocation(name);
      if (!loc || !loc.location_code) {
        setError(`POP "${name}" not found in Manage Locations`);
        return;
      }
      // Exact code preferred — reject prefix collisions (e.g. typed IPCSNG1 when only IPCSNG11 exists is fine via API exact match)
      const lat = loc.latitude != null ? Number(loc.latitude) : null;
      const lng = loc.longitude != null ? Number(loc.longitude) : null;
      setPopCode(loc.location_code);
      setForm(prev => ({
        ...prev,
        location_name: loc.datacenter_name || loc.location_code || prev.location_name,
        address: loc.datacenter_address || '',
        city: loc.city || '',
        country: loc.country || '',
        building_type: 'datacenter',
        street_name: '',
        street_number: '',
        postal_code: '',
        latitude: lat,
        longitude: lng
      }));
      setMatches([]);
      setWarnings([]);
      setAddressVerified(true);
      if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        placeMarker(lat, lng, { draggable: false });
      }
    } catch (err) {
      setError(err.response?.data?.error || `POP "${name}" not found in Manage Locations`);
    } finally {
      setSearching(false);
    }
  };

  const handleClearPop = () => {
    const previousCode = popCode;
    setPopCode(null);
    setExistingId(null);
    setForm({
      ...emptyForm,
      location_name: previousCode || '',
      building_type: 'retail'
    });
    setMatches([]);
    setWarnings([]);
    setAddressVerified(false);
    setError('');
    if (markerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  };

  const handleSearchAgain = async () => {
    if (isFixedPop) return;
    setError('');
    setSearching(true);
    try {
      const result = await carrierQuoteApi.verifyLocation(form);
      const first = (result.results || [])[0];
      if (!first) {
        setError('No matching address found. Adjust fields and try again.');
        return;
      }
      skipReverseRef.current = true;
      setForm(prev => ({
        ...prev,
        street_name: first.street_name || prev.street_name,
        street_number: first.street_number || prev.street_number,
        city: first.city || prev.city,
        postal_code: first.postal_code || prev.postal_code,
        country: first.country || prev.country,
        address: first.address || prev.address,
        latitude: first.latitude,
        longitude: first.longitude
      }));
      setAddressVerified(true);
      if (first.latitude != null && first.longitude != null) {
        placeMarker(first.latitude, first.longitude);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Address search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleUseExisting = (match) => {
    if (match.source === 'pop') {
      onConfirm({
        reuse_pop: true,
        location_code: match.location_code,
        location_name: match.location_name,
        building_type: 'datacenter',
        address: match.address,
        city: match.city,
        country: match.country,
        latitude: match.latitude,
        longitude: match.longitude
      });
      return;
    }
    onConfirm({
      reuse_custom: true,
      id: match.id,
      location_name: match.location_name,
      address: match.address,
      city: match.city,
      country: match.country,
      building_type: match.building_type || 'retail',
      street_name: match.street_name,
      street_number: match.street_number,
      postal_code: match.postal_code,
      latitude: match.latitude,
      longitude: match.longitude,
      already_exists: true
    });
  };

  const handleConfirm = async () => {
    setError('');
    if (isFixedPop && popCode) {
      onConfirm({
        reuse_pop: true,
        location_code: popCode,
        location_name: form.location_name,
        building_type: 'datacenter',
        address: form.address,
        city: form.city,
        country: form.country,
        latitude: form.latitude,
        longitude: form.longitude
      });
      return;
    }
    if (!form.location_name) {
      setError('Site name is required');
      return;
    }
    if (!form.building_type) {
      setError('Building type is required');
      return;
    }
    if (!addressVerified) {
      setError('Click "Search address" to verify this address against the official database before confirming — or select one of the Existing matches.');
      return;
    }
    const payload = {
      location_name: form.location_name,
      street_name: form.street_name,
      street_number: form.street_number,
      city: form.city,
      postal_code: form.postal_code,
      country: form.country,
      address: form.address,
      building_type: form.building_type,
      latitude: form.latitude,
      longitude: form.longitude
    };
    try {
      let saved;
      if (existingId) {
        saved = await carrierQuoteApi.updateCustomLocation(existingId, payload);
        saved = { ...saved, id: existingId, already_exists: true };
      } else {
        saved = await carrierQuoteApi.createCustomLocation(payload);
      }
      onConfirm(saved);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save location');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth disableRestoreFocus sx={dialogSx}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {warnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {warnings.join(' · ')}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Box
              ref={mapRef}
              sx={{ height: 420, width: '100%', borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {attribution}.
              {isFixedPop
                ? ' Managed POP address from Manage Locations (read-only).'
                : ' Drag the pin to refine the location.'}
            </Typography>
          </Grid>

          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle2">Site details</Typography>
              {isFixedPop && (
                <Chip
                  size="small"
                  color="primary"
                  label={`POP ${popCode}`}
                  onDelete={handleClearPop}
                  title="Clear POP and enter a different code"
                />
              )}
            </Box>
            {isFixedPop && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                This datacenter address comes from Manage Locations and cannot be edited here. Use the X on the POP chip to clear and look up a different code.
              </Alert>
            )}
            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <TextField
                  fullWidth size="small" label="Site name *"
                  value={form.location_name}
                  onChange={(e) => setField('location_name', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isFixedPop) {
                      e.preventDefault();
                      handleLookupPop();
                    }
                  }}
                  helperText={isFixedPop ? undefined : 'For a Manage Locations POP: type the full code, then press Enter or Lookup POP'}
                  InputProps={{ readOnly: isFixedPop }}
                />
              </Grid>
              <Grid item xs={8}>
                <TextField
                  fullWidth size="small" label="Street name"
                  value={form.street_name}
                  onChange={(e) => setField('street_name', e.target.value)}
                  InputProps={{ readOnly: isFixedPop }}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth size="small" label="Street number"
                  value={form.street_number}
                  onChange={(e) => setField('street_number', e.target.value)}
                  InputProps={{ readOnly: isFixedPop }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth size="small" label="City"
                  value={form.city}
                  onChange={(e) => setField('city', e.target.value)}
                  InputProps={{ readOnly: isFixedPop }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth size="small" label="Postal code"
                  value={form.postal_code}
                  onChange={(e) => setField('postal_code', e.target.value)}
                  InputProps={{ readOnly: isFixedPop }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth size="small" label="Country"
                  value={form.country}
                  onChange={(e) => setField('country', e.target.value)}
                  helperText={isFixedPop ? undefined : 'ISO code preferred (e.g. KR, GB)'}
                  InputProps={{ readOnly: isFixedPop }}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small" disabled={isFixedPop}>
                  <InputLabel>Building type *</InputLabel>
                  <Select
                    label="Building type *"
                    value={form.building_type || ''}
                    onChange={(e) => setField('building_type', e.target.value)}
                  >
                    <MenuItem value="datacenter">Datacenter</MenuItem>
                    <MenuItem value="retail">Retail</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth size="small" label="Address (display)"
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  InputProps={{ readOnly: isFixedPop }}
                />
              </Grid>
            </Grid>

            {!isFixedPop && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  onClick={handleLookupPop}
                  disabled={searching}
                  sx={{ fontSize: '0.875rem' }}
                >
                  Lookup POP
                </Link>
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  onClick={handleSearchAgain}
                  disabled={searching}
                  sx={{ fontSize: '0.875rem', fontWeight: !addressVerified ? 700 : 400 }}
                >
                  Search address
                </Link>
                {(searching || matching) && <CircularProgress size={16} />}
              </Box>
            )}

            {!isFixedPop && !addressVerified && (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                Click <strong>Search address</strong> (or drag the pin) to verify this address against the official database, or pick one of the Existing matches below, before confirming.
              </Alert>
            )}

            {!isFixedPop && matches.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 1 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Existing matches
                </Typography>
                <List dense sx={{
                  maxHeight: 160,
                  overflow: 'auto',
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1
                }}>
                  {matches.map((m, idx) => (
                    <ListItem key={`${m.source}-${m.id || m.location_code}-${idx}`} disablePadding>
                      <ListItemButton onClick={() => handleUseExisting(m)}>
                        <ListItemText
                          primary={m.location_name || m.location_code}
                          secondary={`${m.source === 'pop' ? 'POP' : 'Custom'} · ${m.address || ''} ${m.city || ''} · score ${Math.round((m.match_score || 0) * 100)}%`}
                          primaryTypographyProps={{ color: 'text.primary' }}
                          secondaryTypographyProps={{ color: 'text.secondary' }}
                        />
                        <Chip
                          size="small"
                          label={m.source === 'pop' ? 'Datacenter' : (m.building_type || '—')}
                          sx={{ ml: 1 }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={searching || (!isFixedPop && !addressVerified)}
          title={(!isFixedPop && !addressVerified) ? 'Search address first to verify against the official database' : undefined}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SiteValidationDialog;
