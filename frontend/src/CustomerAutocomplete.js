import React, { useEffect, useRef, useState } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { customerApi } from './api';

// Reusable customer picker backed by the shared `customers` master list.
// Users can select an existing customer or type a new name — on blur/select
// the name is resolved (or created) against the master list so callers get
// back a stable customer_id alongside the display name.
//
// Props:
//   value        - current customer name (string)
//   onChange(name, customerId) - called whenever the resolved name/id changes
function CustomerAutocomplete({
  label = 'Customer Name',
  value,
  onChange,
  required = false,
  fullWidth = true,
  size,
  disabled = false,
  helperText,
  error = false
}) {
  const [options, setOptions] = useState([]);
  const [inputValue, setInputValue] = useState(value || '');
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef(null);
  const lastResolvedRef = useRef(value || '');

  useEffect(() => {
    setInputValue(value || '');
    lastResolvedRef.current = value || '';
  }, [value]);

  const search = (query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await customerApi.getCustomers(query);
        setOptions(data || []);
      } catch (err) {
        console.error('Failed to search customers:', err);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const resolveCustomer = async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      lastResolvedRef.current = '';
      onChange('', null);
      return;
    }
    if (trimmed === lastResolvedRef.current) return;

    const exactOption = options.find(o => o.name.toLowerCase() === trimmed.toLowerCase());
    if (exactOption) {
      lastResolvedRef.current = exactOption.name;
      setInputValue(exactOption.name);
      onChange(exactOption.name, exactOption.id);
      return;
    }

    setResolving(true);
    try {
      const result = await customerApi.createCustomer(trimmed);
      lastResolvedRef.current = result.name;
      setInputValue(result.name);
      onChange(result.name, result.id);
    } catch (err) {
      console.error('Failed to resolve customer:', err);
      lastResolvedRef.current = trimmed;
      onChange(trimmed, null);
    } finally {
      setResolving(false);
    }
  };

  return (
    <Autocomplete
      freeSolo
      fullWidth={fullWidth}
      size={size}
      disabled={disabled}
      options={options}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
      isOptionEqualToValue={(option, val) => option.name === (typeof val === 'string' ? val : val?.name)}
      inputValue={inputValue}
      onInputChange={(_, newValue, reason) => {
        setInputValue(newValue);
        if (reason === 'input') search(newValue);
      }}
      onChange={(_, newValue) => {
        if (newValue && typeof newValue === 'object') {
          lastResolvedRef.current = newValue.name;
          setInputValue(newValue.name);
          onChange(newValue.name, newValue.id);
        } else if (typeof newValue === 'string') {
          resolveCustomer(newValue);
        } else {
          lastResolvedRef.current = '';
          onChange('', null);
        }
      }}
      onBlur={() => resolveCustomer(inputValue)}
      noOptionsText="Type to search, or add a new customer"
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {(loading || resolving) ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                {params.InputProps.endAdornment}
              </>
            )
          }}
        />
      )}
    />
  );
}

export default CustomerAutocomplete;
