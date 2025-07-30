import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, TextField, Button, Grid, MenuItem, Checkbox, FormControlLabel } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import { styled } from '@mui/material/styles';

const initialFilters = {
  circuit_id: '',
  location: '', // Will search both location_a and location_b
  cable_system: '',
  bandwidth: '',
  is_special: false, // Default to "No" (false)
};

const SmallTextField = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-input': {
    fontSize: '0.75rem', // ~12px
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.75rem', // ~12px
  },
}));

function SearchExportBar({ onSearch, onExport, onRefresh, hasPermission }) {
  const [filters, setFilters] = useState(initialFilters);
  const debounceRef = useRef();

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
      
      // Convert checkbox value to expected format
      if (typeof params.is_special === 'boolean') {
        params.is_special = params.is_special ? '1' : '0';
      }
      
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
          <FormControlLabel
            control={
              <Checkbox
                name="is_special"
                checked={filters.is_special}
                onChange={handleChange}
                size="small"
              />
            }
            label="Special/ULL"
            sx={{ 
              '& .MuiFormControlLabel-label': { 
                fontSize: '0.75rem' 
              } 
            }}
          />
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