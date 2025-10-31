import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, TextField, Button, Grid, MenuItem, Autocomplete, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import { styled } from '@mui/material/styles';

const initialFilters = {
  circuit_id: '',
  location: '', // Will search both location_a and location_b
  cable_system: '',
  bandwidth: '',
  is_special: '', // Default to blank (null) - shows all routes
  regions: [], // Multi-select region filter
};

const REGION_OPTIONS = ['APAC', 'EMEA', 'AMERs', 'INTER'];

const SmallTextField = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-input': {
    fontSize: '0.75rem', // ~12px
    padding: '8.5px 14px', // Ensure consistent padding
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.75rem', // ~12px
  },
  '& .MuiSelect-select': {
    fontSize: '0.75rem', // Match text input font size
    padding: '8.5px 14px', // Same padding as text input
  },
}));

function SearchExportBar({ onSearch, onExport, onRefresh, hasPermission, resetFilters }) {
  const [filters, setFilters] = useState(initialFilters);
  const debounceRef = useRef();
  const prevResetFilters = useRef(resetFilters);

  // Reset filters when resetFilters prop changes
  useEffect(() => {
    // Only trigger if resetFilters actually changed (not on initial mount)
    if (resetFilters !== prevResetFilters.current && resetFilters > 0) {
      setFilters(initialFilters);
      // Also trigger search with empty filters to show all data
      onSearch({
        circuit_id: '',
        location_a: '',
        location_b: '',
        cable_system: '',
        bandwidth: '',
        is_special: '',
        regions: []
      });
    }
    prevResetFilters.current = resetFilters;
  }, [resetFilters, onSearch]);

  // Debounced search function
  const debouncedSearch = useCallback((filtersToSearch) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      // Always call onSearch for client-side filtering (like LocationDataManager)
      // Map 'location' to both location_a and location_b for filtering
      const params = { ...filtersToSearch };
      if (filtersToSearch.location) {
        params.location_a = filtersToSearch.location;
        params.location_b = filtersToSearch.location;
      }
      delete params.location;
      
      onSearch(params);
    }, 300); // 300ms debounce
  }, [onSearch]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newFilters = { ...filters, [name]: type === 'checkbox' ? checked : value };
    setFilters(newFilters);
    
    // Trigger instant search with debounce
    debouncedSearch(newFilters);
  };

  const handleRegionChange = (event, newValue) => {
    const newFilters = { ...filters, regions: newValue };
    setFilters(newFilters);
    
    // Trigger instant search with debounce
    debouncedSearch(newFilters);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <Box sx={{ mb: 2 }}>
      <Grid container spacing={1} alignItems="center">
        <Grid item>
          <SmallTextField
            size="small"
            label="UCN"
            name="circuit_id"
            value={filters.circuit_id}
            onChange={handleChange}
            variant="outlined"
          />
        </Grid>
        <Grid item>
          <SmallTextField
            size="small"
            label="Location"
            name="location"
            value={filters.location}
            onChange={handleChange}
            variant="outlined"
          />
        </Grid>
        <Grid item>
          <SmallTextField
            size="small"
            label="Cable System"
            name="cable_system"
            value={filters.cable_system}
            onChange={handleChange}
            variant="outlined"
          />
        </Grid>
        <Grid item>
          <SmallTextField
            size="small"
            label="Bandwidth"
            name="bandwidth"
            value={filters.bandwidth}
            onChange={handleChange}
            variant="outlined"
          />
        </Grid>
        <Grid item>
          <Autocomplete
            multiple
            size="small"
            options={REGION_OPTIONS}
            value={filters.regions}
            onChange={handleRegionChange}
            renderInput={(params) => (
              <SmallTextField
                {...params}
                label="Region"
                variant="outlined"
                placeholder="All Regions"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  label={option}
                  size="small"
                  {...getTagProps({ index })}
                  sx={{ fontSize: '0.6875rem' }}
                />
              ))
            }
            sx={{ 
              minWidth: 180,
              '& .MuiAutocomplete-input': {
                fontSize: '0.6875rem'
              },
              '& .MuiChip-label': {
                fontSize: '0.6875rem'
              },
              '& .MuiAutocomplete-option': {
                fontSize: '0.6875rem'
              }
            }}
          />
        </Grid>
        <Grid item>
          <SmallTextField
            select
            size="small"
            label="Special/ULL"
            name="is_special"
            value={filters.is_special}
            onChange={handleChange}
            variant="outlined"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="1">Yes</MenuItem>
            <MenuItem value="0">No</MenuItem>
          </SmallTextField>
        </Grid>
        <Grid item>
          <Button variant="outlined" color="primary" startIcon={<RefreshIcon />} onClick={onRefresh}>
            Refresh
          </Button>
        </Grid>
        <Grid item>
          <Button variant="outlined" color="secondary" startIcon={<DownloadIcon />} onClick={onExport}>
            Export CSV
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}

export default SearchExportBar; 