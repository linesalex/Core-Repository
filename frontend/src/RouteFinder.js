import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Paper, Typography, TextField, Button, Alert, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Card, CardContent, CardHeader,
  RadioGroup, Radio, FormControlLabel, FormControl, FormLabel, Autocomplete,
  Snackbar
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import RouteIcon from '@mui/icons-material/Route';
import EmailIcon from '@mui/icons-material/Email';
import LoadingButton from '@mui/lab/LoadingButton';
import { API_BASE_URL } from './config';

const RouteFinder = () => {
  // Form state
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    bandwidth: '',
    mtuRequired: '',
    routeMode: 'standard' // 'fastest' or 'standard' - defaults to standard
  });

  // Data state
  const [locations, setLocations] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedAccordion, setExpandedAccordion] = useState('search');

  // Load locations on mount
  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/locations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load locations');
      }

      const data = await response.json();
      setLocations(data);
    } catch (err) {
      console.error('Failed to load locations:', err);
      setError('Failed to load locations: ' + err.message);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSearch = async () => {
    if (!formData.source || !formData.destination) {
      setError('Please select both source and destination locations');
      return;
    }

    // Validate bandwidth range
    const bandwidth = parseFloat(formData.bandwidth);
    if (bandwidth && (bandwidth < 10 || bandwidth > 10000)) {
      setError('Bandwidth must be between 10 and 10000 Mbps');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchResults(null);

    try {
      const token = localStorage.getItem('authToken');
      
      const searchParams = {
        source: formData.source,
        destination: formData.destination,
        bandwidth: formData.bandwidth ? parseFloat(formData.bandwidth) : undefined,
        bandwidth_unit: 'Mbps',
        mtu_required: formData.mtuRequired ? parseFloat(formData.mtuRequired) : 1500,
        route_mode: formData.routeMode,
        // Fastest mode: include everything
        // Standard mode: exclude Cisco and ULL routes
        include_ull: formData.routeMode === 'fastest',
        use_cisco_only_routes: formData.routeMode === 'fastest',
        constraints: {
          protection_required: true, // Always try to find diverse path
          mtu_required: formData.mtuRequired ? parseFloat(formData.mtuRequired) : 1500
        }
      };

      console.log('Route Finder search params:', searchParams);

      const response = await fetch(`${API_BASE_URL}/route_finder/find_routes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchParams)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to find routes');
      }

      const results = await response.json();
      console.log('Route Finder results:', results);
      
      setSearchResults(results);
      setExpandedAccordion('results');

    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setFormData({
      source: '',
      destination: '',
      bandwidth: '',
      mtuRequired: '',
      routeMode: 'standard'
    });
    setSearchResults(null);
    setError(null);
    setSuccess(null);
    setExpandedAccordion('search');
  };

  const formatLatency = (latency) => {
    return Math.round(latency * 1000) / 1000; // Round to 3 decimal places
  };

  const handleExport = () => {
    if (!searchResults) return;

    try {
      let emailBody = '';
      
      // Header information
      emailBody += `Route Finder Results\n`;
      emailBody += `Source Location: ${formData.source}\n`;
      emailBody += `Destination Location: ${formData.destination}\n`;
      emailBody += `Bandwidth: ${formData.bandwidth} Mbps\n`;
      emailBody += `Route Mode: ${formData.routeMode === 'fastest' ? 'Fastest Route' : 'Standard Route'}\n`;
      emailBody += `Search Date: ${new Date().toLocaleString()}\n\n`;

      // Helper function to generate route table
      const generateRouteTable = (pathData, pathType) => {
        if (!pathData || !pathData.route) return '';
        
        let table = `${pathType} Route:\n`;
        table += `Circuit ID\tRoute Segment\tLatency\tCable System\n`;
        table += `${'='.repeat(70)}\n`;
        
        pathData.route.forEach(segment => {
          table += `${segment.circuit_id || 'N/A'}\t${segment.from} → ${segment.to}\t${formatLatency(segment.latency)}ms\t${segment.cable_system || 'N/A'}\n`;
        });
        
        table += `${'='.repeat(70)}\n`;
        table += `Total Latency: ${formatLatency(pathData.totalLatency)}ms\n`;
        table += `Total Hops: ${pathData.hops}\n\n`;
        
        return table;
      };

      // Primary Path
      if (searchResults.primaryPath) {
        emailBody += generateRouteTable(searchResults.primaryPath, 'Primary');
      }

      // Secondary Path
      if (searchResults.diversePath) {
        emailBody += generateRouteTable(searchResults.diversePath, 'Secondary');
      } else {
        emailBody += `Secondary Route: No diverse path available\n\n`;
      }

      // Generate subject line
      const today = new Date().toLocaleDateString();
      const subject = `Route Finder - ${formData.source} to ${formData.destination} - ${today}`;
      
      // Create .eml file
      const timestamp = new Date().toISOString();
      const emailContent = [
        `From: Route Finder <noreply@ipc.com>`,
        `To: `,
        `Subject: ${subject}`,
        `Date: ${timestamp}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=utf-8`,
        `Content-Transfer-Encoding: 8bit`,
        ``,
        emailBody
      ].join('\r\n');
      
      // Create blob as .eml file
      const blob = new Blob([emailContent], { type: 'message/rfc822' });
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      
      // Generate filename with timestamp
      const fileTimestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const sourceCode = formData.source.replace(/[^a-zA-Z0-9]/g, '_');
      const destCode = formData.destination.replace(/[^a-zA-Z0-9]/g, '_');
      downloadLink.download = `RouteFinder_${sourceCode}_${destCode}_${fileTimestamp}.eml`;
      
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      setSuccess('Route results exported successfully');
      
    } catch (error) {
      console.error('Export error:', error);
      setError('Failed to export results: ' + error.message);
    }
  };

  // Get location display label
  const getLocationLabel = (location) => {
    if (!location) return '';
    return `${location.location_code} - ${location.datacenter_name || location.city}`;
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" gutterBottom>
        Route Finder
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Find the fastest or standard routes between locations
      </Typography>

      {/* Search Parameters */}
      <Accordion 
        expanded={expandedAccordion === 'search'} 
        onChange={() => setExpandedAccordion(expandedAccordion === 'search' ? '' : 'search')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SearchIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Search Parameters</Typography>
            </Box>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              sx={{ ml: 2 }}
            >
              Refresh
            </Button>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            {/* Route Mode Selection */}
            <Grid item xs={12}>
              <FormControl component="fieldset">
                <FormLabel component="legend">Route Mode</FormLabel>
                <RadioGroup
                  row
                  value={formData.routeMode}
                  onChange={(e) => handleInputChange('routeMode', e.target.value)}
                >
                  <FormControlLabel 
                    value="fastest" 
                    control={<Radio />} 
                    label="Fastest Route (All routes included)" 
                  />
                  <FormControlLabel 
                    value="standard" 
                    control={<Radio />} 
                    label="Standard Route (Excludes ULL & Special routes)" 
                  />
                </RadioGroup>
              </FormControl>
            </Grid>

            {/* Source and Destination */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={locations}
                getOptionLabel={(option) => getLocationLabel(option)}
                value={locations.find(loc => loc.location_code === formData.source) || null}
                onChange={(event, newValue) => {
                  handleInputChange('source', newValue ? newValue.location_code : '');
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Source Location" fullWidth required />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Autocomplete
                options={locations}
                getOptionLabel={(option) => getLocationLabel(option)}
                value={locations.find(loc => loc.location_code === formData.destination) || null}
                onChange={(event, newValue) => {
                  handleInputChange('destination', newValue ? newValue.location_code : '');
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Destination Location" fullWidth required />
                )}
              />
            </Grid>

            {/* Bandwidth */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Bandwidth (Mbps)"
                type="number"
                value={formData.bandwidth}
                onChange={(e) => handleInputChange('bandwidth', e.target.value)}
                inputProps={{ min: 10, max: 10000, step: 1 }}
                helperText="Enter bandwidth between 10 and 10000 Mbps"
              />
            </Grid>

            {/* MTU Required */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="MTU Required (minimum)"
                type="number"
                value={formData.mtuRequired}
                onChange={(e) => handleInputChange('mtuRequired', e.target.value)}
                helperText="Default: 1500 if not specified - Maximum service MTU is 9000"
              />
            </Grid>

            {/* Search Button */}
            <Grid item xs={12}>
              <LoadingButton
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
                loading={loading}
                disabled={!formData.source || !formData.destination}
              >
                Find Route
              </LoadingButton>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Search Results */}
      {searchResults && (
        <Accordion 
          expanded={expandedAccordion === 'results'} 
          onChange={() => setExpandedAccordion(expandedAccordion === 'results' ? '' : 'results')} 
          sx={{ mt: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <RouteIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Route Results</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {/* Export Button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<EmailIcon />}
                onClick={handleExport}
                color="primary"
              >
                Export Results
              </Button>
            </Box>

            <Grid container spacing={3}>
              {/* Primary Path */}
              <Grid item xs={12}>
                <Card>
                  <CardHeader 
                    title="Primary Path" 
                    subheader={`${searchResults.primaryPath.path.join(' → ')}`}
                  />
                  <CardContent>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Circuit ID</TableCell>
                            <TableCell>Segment</TableCell>
                            <TableCell>Latency</TableCell>
                            <TableCell>Cable System</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {searchResults.primaryPath.route?.map((segment, index) => (
                            <TableRow key={index}>
                              <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                              <TableCell>{segment.from} → {segment.to}</TableCell>
                              <TableCell>{formatLatency(segment.latency)}ms</TableCell>
                              <TableCell>{segment.cable_system || 'N/A'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        <strong>Total Latency:</strong> {formatLatency(searchResults.primaryPath.totalLatency)}ms
                      </Typography>
                      <Typography variant="body2">
                        <strong>Total Hops:</strong> {searchResults.primaryPath.hops}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Secondary Path */}
              {searchResults.diversePath ? (
                <Grid item xs={12}>
                  <Card>
                    <CardHeader 
                      title="Secondary Path (Diverse)" 
                      subheader={`${searchResults.diversePath.path.join(' → ')}`}
                    />
                    <CardContent>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Circuit ID</TableCell>
                              <TableCell>Segment</TableCell>
                              <TableCell>Latency</TableCell>
                              <TableCell>Cable System</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {searchResults.diversePath.route?.map((segment, index) => (
                              <TableRow key={index}>
                                <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                                <TableCell>{segment.from} → {segment.to}</TableCell>
                                <TableCell>{formatLatency(segment.latency)}ms</TableCell>
                                <TableCell>{segment.cable_system || 'N/A'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          <strong>Total Latency:</strong> {formatLatency(searchResults.diversePath.totalLatency)}ms
                        </Typography>
                        <Typography variant="body2">
                          <strong>Total Hops:</strong> {searchResults.diversePath.hops}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ) : (
                <Grid item xs={12}>
                  <Alert severity="info">
                    No diverse secondary path found. The primary path is available but no alternative route exists.
                  </Alert>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Error/Success Messages */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RouteFinder;

