import React, { useState } from 'react';
import { Box, Autocomplete, TextField, IconButton, Tooltip, Chip, FormHelperText } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SiteValidationDialog from './SiteValidationDialog';
import { carrierQuoteApi } from './api';

// Reusable POP + custom location picker with "add / edit & validate location"
// (Site Validation) support — the same location model used by the Carrier
// Quote Repository (Add Carrier Quote).
//
// value shape:  { type: 'pop'|'custom', pop_code, custom_id, custom_name, building_type }
// onChange(value) is called with the shape above whenever the selection changes.
function LocationSiteField({ label, value, onChange, disabled = false }) {
  const [popLocations, setPopLocations] = useState([]);
  const [customLocations, setCustomLocations] = useState([]);
  const [detailsCache, setDetailsCache] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState({});
  const [dialogKey, setDialogKey] = useState(0);
  const [error, setError] = useState('');

  const inputValue = value?.pop_code || value?.custom_name || '';

  const searchPop = async (query) => {
    if (!query) return;
    try {
      const data = await carrierQuoteApi.getPopLocations(query);
      setPopLocations(data || []);
    } catch (err) {
      console.error('Failed to search POP locations:', err);
    }
  };

  const searchCustom = async (query) => {
    try {
      const data = await carrierQuoteApi.getCustomLocations(query || '');
      setCustomLocations(data || []);
    } catch (err) {
      console.error('Failed to search custom locations:', err);
    }
  };

  const getOptions = () => {
    const popOptions = popLocations.map(loc => ({
      type: 'pop',
      code: loc.location_code,
      label: `${loc.location_code} - ${loc.datacenter_name || loc.city || ''}`,
      customId: null,
      building_type: 'datacenter',
      datacenter_name: loc.datacenter_name,
      datacenter_address: loc.datacenter_address,
      city: loc.city,
      country: loc.country,
      latitude: loc.latitude,
      longitude: loc.longitude
    }));
    const customOptions = customLocations.map(loc => ({
      type: 'custom',
      id: loc.id,
      code: loc.location_name,
      label: `${loc.location_name}${loc.address ? ' - ' + loc.address : ''}${loc.city ? ', ' + loc.city : ''}`,
      customId: loc.id,
      building_type: loc.building_type || null
    }));
    return [...popOptions, ...customOptions];
  };

  const openSiteValidation = async () => {
    const cached = detailsCache;
    if (cached && (cached.fixed_pop || cached.id)) {
      setDialogInitial({ ...cached });
    } else if (value?.custom_id) {
      try {
        const loc = await carrierQuoteApi.getCustomLocation(value.custom_id);
        const details = {
          id: loc.id,
          location_name: loc.location_name || '',
          address: loc.address || '',
          city: loc.city || '',
          country: loc.country || '',
          building_type: loc.building_type || 'retail',
          street_name: loc.street_name || '',
          street_number: loc.street_number || '',
          postal_code: loc.postal_code || '',
          latitude: loc.latitude,
          longitude: loc.longitude
        };
        setDetailsCache(details);
        setDialogInitial(details);
      } catch (err) {
        setDialogInitial({ building_type: 'retail' });
        setError('Could not load location details: ' + (err.response?.data?.error || err.message));
      }
    } else if (value?.type === 'pop' && value?.pop_code) {
      try {
        const raw = String(value.pop_code).trim();
        const codeCandidate = (raw.includes(' - ') ? raw.split(' - ')[0] : raw).trim();
        const codeKey = codeCandidate.toUpperCase();
        const fromOptions = popLocations.find(p =>
          String(p.location_code || '').trim().toUpperCase() === codeKey
          || String(p.datacenter_name || '').trim().toUpperCase() === codeKey
        );
        let loc = fromOptions;
        if (!loc) loc = await carrierQuoteApi.getPopLocation(codeCandidate);
        if (!loc || !loc.location_code) throw new Error('POP location not found');
        const details = {
          fixed_pop: true,
          location_code: loc.location_code,
          location_name: loc.datacenter_name || loc.location_code || '',
          address: loc.datacenter_address || '',
          city: loc.city || '',
          country: loc.country || '',
          building_type: 'datacenter',
          street_name: '',
          street_number: '',
          postal_code: '',
          latitude: loc.latitude != null ? Number(loc.latitude) : null,
          longitude: loc.longitude != null ? Number(loc.longitude) : null
        };
        setDetailsCache(details);
        setDialogInitial(details);
      } catch (err) {
        setDialogInitial({ building_type: 'datacenter', location_name: String(value.pop_code).trim() });
        setError('Could not load POP location: ' + (err.response?.data?.error || err.message));
      }
    } else {
      setDialogInitial({ building_type: 'retail' });
    }

    setDialogKey(k => k + 1);
    setDialogOpen(true);
  };

  const handleSiteValidationConfirm = (result) => {
    if (result.reuse_pop) {
      setDetailsCache(null);
      onChange({ type: 'pop', pop_code: result.location_code, custom_id: null, custom_name: '', building_type: 'datacenter' });
      setDialogOpen(false);
      return;
    }

    setDetailsCache({
      id: result.id,
      location_name: result.location_name || '',
      address: result.address || '',
      city: result.city || '',
      country: result.country || '',
      building_type: result.building_type || 'retail',
      street_name: result.street_name || '',
      street_number: result.street_number || '',
      postal_code: result.postal_code || '',
      latitude: result.latitude,
      longitude: result.longitude
    });
    onChange({
      type: 'custom',
      pop_code: result.location_name,
      custom_id: result.id,
      custom_name: result.location_name,
      building_type: result.building_type || 'retail'
    });
    setDialogOpen(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <Autocomplete
          freeSolo
          fullWidth
          disabled={disabled}
          options={getOptions()}
          getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.label || opt.code || '')}
          groupBy={(opt) => (opt.type === 'pop' ? 'POP Locations' : 'Custom Locations')}
          inputValue={inputValue}
          onInputChange={(_, newValue, reason) => {
            if (reason === 'reset') return;
            if (reason === 'clear') {
              setDetailsCache(null);
              onChange({ type: 'pop', pop_code: '', custom_id: null, custom_name: '', building_type: null });
              return;
            }
            setDetailsCache(null);
            onChange({ type: 'pop', pop_code: newValue, custom_id: null, custom_name: '', building_type: null });
            searchPop(newValue);
            searchCustom(newValue);
          }}
          onChange={(_, newValue) => {
            if (!newValue || typeof newValue !== 'object') return;
            if (newValue.type === 'pop') {
              setDetailsCache({
                fixed_pop: true,
                location_code: newValue.code,
                location_name: newValue.datacenter_name || newValue.code,
                address: newValue.datacenter_address || '',
                city: newValue.city || '',
                country: newValue.country || '',
                building_type: 'datacenter',
                latitude: newValue.latitude != null ? Number(newValue.latitude) : null,
                longitude: newValue.longitude != null ? Number(newValue.longitude) : null
              });
              onChange({ type: 'pop', pop_code: newValue.code, custom_id: null, custom_name: '', building_type: 'datacenter' });
            } else {
              setDetailsCache(newValue.customId ? {
                id: newValue.customId,
                location_name: newValue.code,
                building_type: newValue.building_type || 'retail'
              } : null);
              onChange({ type: 'custom', pop_code: newValue.code, custom_id: newValue.customId, custom_name: newValue.code, building_type: newValue.building_type || null });
            }
          }}
          renderInput={(params) => <TextField {...params} label={label} required />}
        />
        <Tooltip title="Add / edit & validate location">
          <span>
            <IconButton size="small" onClick={openSiteValidation} disabled={disabled}>
              <AddIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      {value?.building_type && (
        <Chip
          size="small"
          label={value.building_type === 'datacenter' ? 'Datacenter' : 'Retail'}
          sx={{ mt: 0.75 }}
          color={value.building_type === 'datacenter' ? 'primary' : 'default'}
        />
      )}
      {error && <FormHelperText error>{error}</FormHelperText>}

      <SiteValidationDialog
        key={`site-val-${label}-${dialogKey}`}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleSiteValidationConfirm}
        initialValues={dialogInitial}
        title={`Site validation (${label})`}
      />
    </Box>
  );
}

export default LocationSiteField;
