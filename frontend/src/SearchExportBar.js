import React, { useState } from 'react';
import { Box, TextField, Button, Grid, MenuItem } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import { styled } from '@mui/material/styles';

const initialFilters = {
  circuit_id: '',
  location: '', // Will search both location_a and location_b
  cable_system: '',
  bandwidth: '',
  is_special: '',
};

const SmallTextField = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-input': {
    fontSize: '0.75rem', // ~12px
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.75rem', // ~12px
  },
}));

function SearchExportBar({ onSearch, onExport }) {
  const [filters, setFilters] = useState(initialFilters);

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = () => {
    // Map 'location' to both location_a and location_b for backend
    const params = { ...filters };
    if (filters.location) {
      params.location_a = filters.location;
      params.location_b = filters.location;
    }
    delete params.location;
    onSearch(params);
  };

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
          <SmallTextField
            select
            size="small"
            label="Special/ULL"
            name="is_special"
            value={filters.is_special}
            onChange={handleChange}
            variant="outlined"
            style={{ minWidth: 120 }}
          >
            <MenuItem value="">Any</MenuItem>
            <MenuItem value="1">Yes</MenuItem>
            <MenuItem value="0">No</MenuItem>
          </SmallTextField>
        </Grid>
        <Grid item>
          <Button variant="contained" color="primary" startIcon={<SearchIcon />} onClick={handleSearch}>
            Search
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