import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Paper, Typography, TextField, Button, Alert, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Card, CardContent, CardHeader,
  RadioGroup, Radio, FormControlLabel, FormControl, FormLabel, Autocomplete,
  Snackbar, Chip, IconButton, Collapse, Tabs, Tab
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import RouteIcon from '@mui/icons-material/Route';
import EmailIcon from '@mui/icons-material/Email';
import MapIcon from '@mui/icons-material/Map';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import FilterListIcon from '@mui/icons-material/FilterList';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import InfoIcon from '@mui/icons-material/Info';
import LoadingButton from '@mui/lab/LoadingButton';
import { API_BASE_URL } from './config';
import { getPromoRulesForSales, checkPromoMatch } from './api';

const RouteFinder = ({ onViewMap, savedState, onStateChange }) => {
  // Form state - initialize from savedState if available
  const [formData, setFormData] = useState(savedState?.formData || {
    source: '',
    destination: '',
    bandwidth: '',
    mtuRequired: '',
    routeMode: 'standard' // 'fastest' or 'standard' - defaults to standard
  });

  // Data state
  const [locations, setLocations] = useState(savedState?.locations || []);
  const [searchResults, setSearchResults] = useState(savedState?.searchResults || null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedAccordion, setExpandedAccordion] = useState(savedState?.searchResults ? 'results' : 'search');

  // Promo pricing state - restore from savedState if available
  const [promoRules, setPromoRules] = useState([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoLocationFilter, setPromoLocationFilter] = useState('');
  const [primaryPromo, setPrimaryPromo] = useState(savedState?.primaryPromo || null); // Promo for primary path
  const [secondaryPromo, setSecondaryPromo] = useState(savedState?.secondaryPromo || null); // Promo for secondary path
  const [expandedPromoRows, setExpandedPromoRows] = useState({});
  
  // Tab state
  const [currentTab, setCurrentTab] = useState(0);

  // Load locations and promo rules on mount
  useEffect(() => {
    if (!savedState?.locations?.length) {
      loadLocations();
    }
    loadPromoRules();
  }, []);

  // Save state to parent whenever key state changes (including promo pricing)
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        formData,
        searchResults,
        locations,
        primaryPromo,
        secondaryPromo
      });
    }
  }, [formData, searchResults, locations, primaryPromo, secondaryPromo, onStateChange]);

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

  const loadPromoRules = async () => {
    try {
      setPromoLoading(true);
      const result = await getPromoRulesForSales('');
      setPromoRules(result.data || []);
    } catch (err) {
      console.error('Failed to load promo rules:', err);
      // Don't show error - promo pricing is optional feature
    } finally {
      setPromoLoading(false);
    }
  };

  const checkPromoForRoute = async (results) => {
    // Check promo pricing INDEPENDENTLY for each path
    
    // Check Primary Path
    if (results.primaryPath?.route) {
      try {
        const primaryCircuitIds = results.primaryPath.route.map(seg => seg.circuit_id).filter(Boolean);
        
        const primaryResult = await checkPromoMatch(
          formData.source,
          formData.destination,
          formData.bandwidth || 10,
          primaryCircuitIds,
          [] // Empty secondary - checking primary only
        );
        
        if (primaryResult.hasPromo && primaryResult.valid) {
          setPrimaryPromo(primaryResult.prices);
        } else {
          setPrimaryPromo(null);
        }
      } catch (err) {
        console.error('Failed to check primary promo:', err);
        setPrimaryPromo(null);
      }
    } else {
      setPrimaryPromo(null);
    }
    
    // Check Secondary Path (independently)
    if (results.diversePath?.route) {
      try {
        const secondaryCircuitIds = results.diversePath.route.map(seg => seg.circuit_id).filter(Boolean);
        
        const secondaryResult = await checkPromoMatch(
          formData.source,
          formData.destination,
          formData.bandwidth || 10,
          secondaryCircuitIds,
          [] // Empty - checking this path only
        );
        
        if (secondaryResult.hasPromo && secondaryResult.valid) {
          setSecondaryPromo(secondaryResult.prices);
        } else {
          setSecondaryPromo(null);
        }
      } catch (err) {
        console.error('Failed to check secondary promo:', err);
        setSecondaryPromo(null);
      }
    } else {
      setSecondaryPromo(null);
    }
  };

  // Filter promo rules based on location filter
  const filteredPromoRules = promoRules.filter(rule => {
    if (!promoLocationFilter.trim()) return true;
    const filterLower = promoLocationFilter.toLowerCase();
    return (
      rule.source_city?.toLowerCase().includes(filterLower) ||
      rule.destination_city?.toLowerCase().includes(filterLower) ||
      rule.source_locations?.some(loc => loc.toLowerCase().includes(filterLower)) ||
      rule.destination_locations?.some(loc => loc.toLowerCase().includes(filterLower))
    );
  });

  // Format currency helper
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Toggle expanded row for promo locations
  const togglePromoRow = (ruleId) => {
    setExpandedPromoRows(prev => ({
      ...prev,
      [ruleId]: !prev[ruleId]
    }));
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
      
      // Check for matching promo pricing
      await checkPromoForRoute(results);

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
    setPrimaryPromo(null);
    setSecondaryPromo(null);
    setError(null);
    setSuccess(null);
    setExpandedAccordion('search');
  };

  const formatLatency = (latency) => {
    return Math.round(latency * 1000) / 1000; // Round to 3 decimal places
  };

  // Helper function to format bandwidth from Mbps to readable format
  const formatBandwidth = (bandwidth) => {
    if (!bandwidth) return 'N/A';
    
    // Handle "Dark Fiber" text
    if (typeof bandwidth === 'string' && bandwidth.toLowerCase().includes('dark fiber')) {
      return 'Dark Fiber';
    }
    
    // Parse numeric value (stored in Mbps)
    const mbps = parseFloat(bandwidth);
    if (isNaN(mbps)) return bandwidth; // Return as-is if not a number
    
    // Convert to appropriate unit
    if (mbps >= 1000) {
      const gbps = mbps / 1000;
      // Show whole number if it's an integer, otherwise show 1 decimal
      return Number.isInteger(gbps) ? `${gbps} Gbps` : `${gbps.toFixed(1)} Gbps`;
    }
    
    return `${mbps} Mbps`;
  };

  // Helper function to get location display as "Datacenter Name (POP_CODE)"
  const getLocationDisplay = (locationCode) => {
    const location = locations.find(loc => loc.location_code === locationCode);
    if (location && location.datacenter_name) {
      return `${location.datacenter_name} (${locationCode})`;
    }
    return locationCode;
  };

  const handleExport = () => {
    if (!searchResults) return;

    try {
      // Common table styles for HTML email
      const tableStyle = 'border-collapse: collapse; width: 100%; margin-bottom: 20px; font-family: Arial, sans-serif;';
      const thStyle = 'border: 1px solid #ddd; padding: 10px; background-color: #4472C4; color: white; text-align: left; font-weight: bold;';
      const tdStyle = 'border: 1px solid #ddd; padding: 8px; text-align: left;';
      const headerStyle = 'color: #2E5090; margin-top: 20px; margin-bottom: 10px; font-family: Arial, sans-serif;';
      const promoHeaderStyle = 'color: #228B22; margin-top: 15px; margin-bottom: 10px; font-family: Arial, sans-serif;';
      const noPromoStyle = 'color: #666; font-style: italic; margin-bottom: 20px; font-family: Arial, sans-serif;';

      // Helper function to generate route table in HTML
      const generateRouteTable = (pathData, pathType) => {
        if (!pathData || !pathData.route) return '';
        
        let tableHtml = `<h3 style="${headerStyle}">${pathType} Route</h3>`;
        tableHtml += `<table style="${tableStyle}">`;
        tableHtml += `<thead><tr>`;
        tableHtml += `<th style="${thStyle}">Circuit ID</th>`;
        tableHtml += `<th style="${thStyle}">Route Segment</th>`;
        tableHtml += `<th style="${thStyle}">Latency</th>`;
        tableHtml += `<th style="${thStyle}">Cable System</th>`;
        tableHtml += `</tr></thead>`;
        tableHtml += `<tbody>`;
        
        pathData.route.forEach((segment, index) => {
          const rowBg = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
          tableHtml += `<tr style="background-color: ${rowBg};">`;
          tableHtml += `<td style="${tdStyle}">${segment.circuit_id || 'N/A'}</td>`;
          tableHtml += `<td style="${tdStyle}">${segment.from} → ${segment.to}</td>`;
          tableHtml += `<td style="${tdStyle}">${formatLatency(segment.latency)}ms</td>`;
          tableHtml += `<td style="${tdStyle}">${segment.cable_system || 'N/A'}</td>`;
          tableHtml += `</tr>`;
        });
        
        tableHtml += `</tbody></table>`;
        tableHtml += `<p style="font-family: Arial, sans-serif; margin-bottom: 5px;"><strong>Total Latency:</strong> ${formatLatency(pathData.totalLatency)}ms RTD</p>`;
        tableHtml += `<p style="font-family: Arial, sans-serif; margin-bottom: 20px;"><strong>Total Hops:</strong> ${pathData.hops}</p>`;
        
        return tableHtml;
      };

      // Helper function to generate promo pricing table
      const generatePromoPricingTable = (promo, pathType) => {
        if (!promo) return '';
        
        let html = `<h4 style="${promoHeaderStyle}">${pathType} - PROMO PRICING AVAILABLE</h4>`;
        html += `<p style="font-family: Arial, sans-serif; font-size: 13px; color: #555; margin-top: 0; margin-bottom: 10px;"><strong>12 Month Contract - $1,000 NRC Applies to each option</strong></p>`;
        html += `<table style="${tableStyle}">`;
        html += `<thead><tr>`;
        html += `<th style="${thStyle}">Bandwidth</th>`;
        html += `<th style="${thStyle}">Price (USD/month)</th>`;
        html += `</tr></thead>`;
        html += `<tbody>`;
        html += `<tr style="background-color: #ffffff;"><td style="${tdStyle}">10 Mbps</td><td style="${tdStyle}">${formatCurrency(promo.price_10mb)}</td></tr>`;
        html += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}">100 Mbps</td><td style="${tdStyle}">${formatCurrency(promo.price_100mb)}</td></tr>`;
        html += `<tr style="background-color: #ffffff;"><td style="${tdStyle}">1000 Mbps</td><td style="${tdStyle}">${formatCurrency(promo.price_1000mb)}</td></tr>`;
        html += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}">10 Gbps</td><td style="${tdStyle}">${formatCurrency(promo.price_10gb)}</td></tr>`;
        html += `</tbody></table>`;
        
        return html;
      };

      // Build HTML email body
      let emailBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;">`;
      
      // Header information
      emailBody += `<h2 style="color: #2E5090; border-bottom: 2px solid #4472C4; padding-bottom: 10px;">Route Finder Results</h2>`;
      emailBody += `<table style="margin-bottom: 20px; font-family: Arial, sans-serif;">`;
      emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Source Location:</td><td>${getLocationDisplay(formData.source)}</td></tr>`;
      emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Destination Location:</td><td>${getLocationDisplay(formData.destination)}</td></tr>`;
      emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Bandwidth:</td><td>${formData.bandwidth || 'Not specified'} Mbps</td></tr>`;
      emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Route Mode:</td><td>${formData.routeMode === 'fastest' ? 'Fastest Route' : 'Standard Route'}</td></tr>`;
      emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Search Date:</td><td>${new Date().toLocaleString()}</td></tr>`;
      emailBody += `</table>`;

      // Primary Path
      if (searchResults.primaryPath) {
        emailBody += generateRouteTable(searchResults.primaryPath, 'Primary');
      }

      // Primary Path Promo Pricing
      if (primaryPromo) {
        emailBody += generatePromoPricingTable(primaryPromo, 'PRIMARY PATH');
      } else {
        emailBody += `<p style="${noPromoStyle}">PRIMARY PATH - Route not available for automatic promo pricing</p>`;
      }

      // Secondary Path
      if (searchResults.diversePath) {
        emailBody += generateRouteTable(searchResults.diversePath, 'Secondary');
        
        // Secondary Path Promo Pricing
        if (secondaryPromo) {
          emailBody += generatePromoPricingTable(secondaryPromo, 'SECONDARY PATH');
        } else {
          emailBody += `<p style="${noPromoStyle}">SECONDARY PATH - Route not available for automatic promo pricing</p>`;
        }
      } else {
        emailBody += `<p style="${noPromoStyle}">Secondary Route: No diverse path available</p>`;
      }

      emailBody += `<p style="font-family: Arial, sans-serif; color: #666; margin-top: 20px;"><em>Note: Promo pricing is budgetary and subject to capacity confirmation.</em></p>`;

      // Add Promo Pricing Terms and Conditions
      emailBody += `<hr style="margin-top: 30px; margin-bottom: 20px; border: none; border-top: 1px solid #ccc;">`;
      emailBody += `<div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; font-family: Arial, sans-serif;">`;
      emailBody += `<h3 style="color: #333; margin-top: 0;">Ethernet backhaul between IPC fibre / high capacity connected DC's:</h3>`;
      emailBody += `<ul style="color: #444; line-height: 1.6;">`;
      emailBody += `<li>Ethernet Promo BW: 10Mb, 100Mb, 1Gb, 10Gb* [* Subject to capacity checks]</li>`;
      emailBody += `<li>Pricing is for Unprotected Ethernet services with a defined path.</li>`;
      emailBody += `<li>Pricing excludes X/C's, Cloud Provider Port Charges, Exchange Charges and Applicable Taxes</li>`;
      emailBody += `<li>Standard IPC Pricing caveats apply. Please see Pricing Team if unclear</li>`;
      emailBody += `</ul>`;
      
      emailBody += `<h4 style="color: #333; margin-top: 20px;">Term Discounts</h4>`;
      emailBody += `<ul style="color: #444; line-height: 1.6;">`;
      emailBody += `<li>24 Months - 50% NRC Discount - 5% MRC Discount</li>`;
      emailBody += `<li>36 Months - 100% NRC Discount - 10% MRC Discount</li>`;
      emailBody += `</ul>`;
      
      emailBody += `<h4 style="color: #333; margin-top: 20px;">Additional Discount on Displacement Services</h4>`;
      emailBody += `<ul style="color: #444; line-height: 1.6;">`;
      emailBody += `<li>12 Months - NRC Waived - 1 Month FOC</li>`;
      emailBody += `<li>24 Months - NRC Waived - 2 Months FOC</li>`;
      emailBody += `<li>36 Months - NRC Waived - 3 Months FOC</li>`;
      emailBody += `</ul>`;
      emailBody += `</div>`;

      emailBody += `</body></html>`;

      // Generate subject line
      const today = new Date().toLocaleDateString();
      const subject = `Route Finder - ${formData.source} to ${formData.destination} - ${today}`;
      
      // Create .eml file with HTML content
      const timestamp = new Date().toISOString();
      const emailContent = [
        `From: Route Finder <noreply@ipc.com>`,
        `To: `,
        `Subject: ${subject}`,
        `Date: ${timestamp}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
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
        CNX Ethernet
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Route Finder & Promos
      </Typography>

      {/* Tab Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={currentTab} 
          onChange={(e, newValue) => setCurrentTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab 
            label="Route Search" 
            icon={<SearchIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <span>Available Promo Pricing</span>
                <Chip 
                  label={promoRules.length} 
                  size="small" 
                  color="success"
                  sx={{ height: 20 }}
                />
              </Box>
            }
            icon={<LocalOfferIcon />} 
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Tab 0: Route Search */}
      {currentTab === 0 && (
        <>
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
            {/* Export and View Map Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<EmailIcon />}
                onClick={handleExport}
                color="primary"
              >
                Export Results
              </Button>
              {onViewMap && (
                <Button
                  variant="contained"
                  startIcon={<MapIcon />}
                  onClick={() => onViewMap({
                    primaryPath: searchResults.primaryPath,
                    diversePath: searchResults.diversePath,
                    source: formData.source,
                    destination: formData.destination,
                    locations: locations
                  })}
                  color="secondary"
                >
                  View Map
                </Button>
              )}
            </Box>

            {/* Route Lifecycle Notes - Display provisioning route warnings */}
            {searchResults.routeLifecycleNotes?.provisioningRoutesUsed?.length > 0 && (
              <Alert 
                severity="info" 
                sx={{ mb: 2 }}
                icon={<InfoIcon />}
              >
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                  {searchResults.routeLifecycleNotes.message}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {searchResults.routeLifecycleNotes.provisioningRoutesUsed.map((note, idx) => (
                    <Typography component="li" variant="body2" key={idx}>
                      {note.message}
                    </Typography>
                  ))}
                </Box>
              </Alert>
            )}

            <Grid container spacing={3}>
              {/* Primary Path */}
              <Grid item xs={12}>
                <Card sx={{ border: primaryPromo ? 2 : 1, borderColor: primaryPromo ? 'success.main' : 'divider' }}>
                  <CardHeader 
                    title={
                      <Box display="flex" alignItems="center" gap={1}>
                        <span>Primary Path</span>
                        {primaryPromo && (
                          <Chip 
                            icon={<LocalOfferIcon />} 
                            label="Promo Available" 
                            color="success" 
                            size="small" 
                          />
                        )}
                      </Box>
                    }
                    subheader={`${searchResults.primaryPath.path.join(' → ')}`}
                  />
                  <CardContent>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Circuit ID</TableCell>
                            <TableCell>Segment</TableCell>
                            <TableCell>Bandwidth</TableCell>
                            <TableCell>Latency</TableCell>
                            <TableCell>Cable System</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {searchResults.primaryPath.route?.map((segment, index) => (
                            <TableRow key={index}>
                              <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                              <TableCell>{segment.from} → {segment.to}</TableCell>
                              <TableCell>{formatBandwidth(segment.bandwidth)}</TableCell>
                              <TableCell>{formatLatency(segment.latency)}ms</TableCell>
                              <TableCell>{segment.cable_system || 'N/A'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        <strong>Total Latency:</strong> {formatLatency(searchResults.primaryPath.totalLatency)}ms RTD
                      </Typography>
                      <Typography variant="body2">
                        <strong>Total Hops:</strong> {searchResults.primaryPath.hops}
                      </Typography>
                    </Box>
                    
                    {/* Primary Path Promo Pricing */}
                    {primaryPromo ? (
                      <Box sx={{ mt: 3, p: 2, bgcolor: 'success.50', borderRadius: 1, border: 1, borderColor: 'success.200' }}>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <LocalOfferIcon color="success" fontSize="small" />
                          <Typography variant="subtitle2" color="success.dark" fontWeight="bold">
                            Promo Pricing Available
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                          $1,000 NRC applicable for each option - X/Cs Excluded - Full Terms available from Pricing Team
                        </Typography>
                        <Grid container spacing={1}>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary" display="block">10 Mbps</Typography>
                            <Typography variant="body2" color="success.dark" fontWeight="bold">{formatCurrency(primaryPromo.price_10mb)}</Typography>
                          </Grid>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary" display="block">100 Mbps</Typography>
                            <Typography variant="body2" color="success.dark" fontWeight="bold">{formatCurrency(primaryPromo.price_100mb)}</Typography>
                          </Grid>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary" display="block">1000 Mbps</Typography>
                            <Typography variant="body2" color="success.dark" fontWeight="bold">{formatCurrency(primaryPromo.price_1000mb)}</Typography>
                          </Grid>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary" display="block">10 Gbps</Typography>
                            <Typography variant="body2" color="success.dark" fontWeight="bold">{formatCurrency(primaryPromo.price_10gb)}</Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    ) : (
                      <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          <em>Route not available for automatic promo pricing</em>
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Secondary Path */}
              {searchResults.diversePath ? (
                <Grid item xs={12}>
                  <Card sx={{ border: secondaryPromo ? 2 : 1, borderColor: secondaryPromo ? 'success.main' : 'divider' }}>
                    <CardHeader 
                      title={
                        <Box display="flex" alignItems="center" gap={1}>
                          <span>Secondary Path (Diverse)</span>
                          {secondaryPromo && (
                            <Chip 
                              icon={<LocalOfferIcon />} 
                              label="Promo Available" 
                              color="success" 
                              size="small" 
                            />
                          )}
                        </Box>
                      }
                      subheader={`${searchResults.diversePath.path.join(' → ')}`}
                    />
                    <CardContent>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Circuit ID</TableCell>
                              <TableCell>Segment</TableCell>
                              <TableCell>Bandwidth</TableCell>
                              <TableCell>Latency</TableCell>
                              <TableCell>Cable System</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {searchResults.diversePath.route?.map((segment, index) => (
                              <TableRow key={index}>
                                <TableCell>{segment.circuit_id || 'N/A'}</TableCell>
                                <TableCell>{segment.from} → {segment.to}</TableCell>
                                <TableCell>{formatBandwidth(segment.bandwidth)}</TableCell>
                                <TableCell>{formatLatency(segment.latency)}ms</TableCell>
                                <TableCell>{segment.cable_system || 'N/A'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          <strong>Total Latency:</strong> {formatLatency(searchResults.diversePath.totalLatency)}ms RTD
                        </Typography>
                        <Typography variant="body2">
                          <strong>Total Hops:</strong> {searchResults.diversePath.hops}
                        </Typography>
                      </Box>
                      
                      {/* Secondary Path Promo Pricing */}
                      {secondaryPromo ? (
                        <Box sx={{ mt: 3, p: 2, bgcolor: 'success.50', borderRadius: 1, border: 1, borderColor: 'success.200' }}>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <LocalOfferIcon color="success" fontSize="small" />
                            <Typography variant="subtitle2" color="success.dark" fontWeight="bold">
                              Promo Pricing Available
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                            $1,000 NRC applicable for each option - X/Cs Excluded - Full Terms available from Pricing Team
                          </Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={3}>
                              <Typography variant="caption" color="text.secondary" display="block">10 Mbps</Typography>
                              <Typography variant="body2" color="success.dark" fontWeight="bold">{formatCurrency(secondaryPromo.price_10mb)}</Typography>
                            </Grid>
                            <Grid item xs={3}>
                              <Typography variant="caption" color="text.secondary" display="block">100 Mbps</Typography>
                              <Typography variant="body2" color="success.dark" fontWeight="bold">{formatCurrency(secondaryPromo.price_100mb)}</Typography>
                            </Grid>
                            <Grid item xs={3}>
                              <Typography variant="caption" color="text.secondary" display="block">1000 Mbps</Typography>
                              <Typography variant="body2" color="success.dark" fontWeight="bold">{formatCurrency(secondaryPromo.price_1000mb)}</Typography>
                            </Grid>
                            <Grid item xs={3}>
                              <Typography variant="caption" color="text.secondary" display="block">10 Gbps</Typography>
                              <Typography variant="body2" color="success.dark" fontWeight="bold">{formatCurrency(secondaryPromo.price_10gb)}</Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      ) : (
                        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            <em>Route not available for automatic promo pricing</em>
                          </Typography>
                        </Box>
                      )}
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
        </>
      )}

      {/* Tab 1: Available Promo Pricing */}
      {currentTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <LocalOfferIcon sx={{ mr: 1, fontSize: 28 }} color="success" />
            <Typography variant="h6">Available Promo Pricing</Typography>
          </Box>

          {/* Location Filter */}
          <Box sx={{ mb: 3 }}>
            <Autocomplete
              freeSolo
              options={[...new Set(promoRules.flatMap(r => [r.source_city, r.destination_city]).filter(Boolean))]}
              value={promoLocationFilter}
              onInputChange={(event, newValue) => setPromoLocationFilter(newValue || '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Filter by City or Location"
                  placeholder="e.g., Singapore, London, IPCSNG..."
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: <FilterListIcon color="action" sx={{ mr: 1 }} />
                  }}
                  helperText="Filter promo pricing rules by source or destination city/location"
                  size="small"
                />
              )}
              sx={{ maxWidth: 400 }}
            />
          </Box>

          {/* Promo Rules Table */}
          {promoLoading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress size={24} />
            </Box>
          ) : filteredPromoRules.length === 0 ? (
            <Alert severity="info">
              {promoLocationFilter 
                ? `No promo pricing rules found matching "${promoLocationFilter}"` 
                : 'No promo pricing rules available'}
            </Alert>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell width={40}></TableCell>
                    <TableCell><strong>Source City</strong></TableCell>
                    <TableCell><strong>Destination City</strong></TableCell>
                    <TableCell align="right"><strong>10 Mbps</strong></TableCell>
                    <TableCell align="right"><strong>100 Mbps</strong></TableCell>
                    <TableCell align="right"><strong>1000 Mbps</strong></TableCell>
                    <TableCell align="right"><strong>10 Gbps</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPromoRules.map((rule) => (
                    <React.Fragment key={rule.id}>
                      <TableRow hover>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => togglePromoRow(rule.id)}
                          >
                            {expandedPromoRows[rule.id] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {rule.source_city}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {rule.source_locations?.length || 0} location(s)
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {rule.destination_city}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {rule.destination_locations?.length || 0} location(s)
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="success.dark" fontWeight="medium">
                            {formatCurrency(rule.price_10mb)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="success.dark" fontWeight="medium">
                            {formatCurrency(rule.price_100mb)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="success.dark" fontWeight="medium">
                            {formatCurrency(rule.price_1000mb)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="success.dark" fontWeight="medium">
                            {formatCurrency(rule.price_10gb)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                          <Collapse in={expandedPromoRows[rule.id]} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 2, px: 2 }}>
                              <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                  <Typography variant="subtitle2" gutterBottom color="primary">
                                    Source Locations
                                  </Typography>
                                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                                    {rule.source_details?.map((loc, idx) => (
                                      <Chip
                                        key={idx}
                                        label={loc.display}
                                        size="small"
                                        variant="outlined"
                                        color="primary"
                                      />
                                    ))}
                                  </Box>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                  <Typography variant="subtitle2" gutterBottom color="secondary">
                                    Destination Locations
                                  </Typography>
                                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                                    {rule.destination_details?.map((loc, idx) => (
                                      <Chip
                                        key={idx}
                                        label={loc.display}
                                        size="small"
                                        variant="outlined"
                                        color="secondary"
                                      />
                                    ))}
                                  </Box>
                                </Grid>
                              </Grid>
                              {rule.has_required_circuits && (
                                <Alert severity="info" sx={{ mt: 2 }} icon={<RouteIcon />}>
                                  This promo pricing requires specific network routes
                                </Alert>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Info note */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Promo pricing shown is in USD per month. Actual pricing is subject to margin requirements and route availability.
              Go to Route Search tab and search for a route to check if promo pricing applies.
            </Typography>
          </Alert>

          {/* Pricing Caveats */}
          <Paper variant="outlined" sx={{ mt: 3, p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Ethernet backhaul between IPC fibre / high capacity connected DC's:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2, '& li': { mb: 0.5 } }}>
              <Typography component="li" variant="body2">
                Ethernet Promo BW: 10Mb, 100Mb, 1Gb, 10Gb* [* Subject to capacity checks]
              </Typography>
              <Typography component="li" variant="body2">
                Pricing is for Unprotected Ethernet services with a defined path.
              </Typography>
              <Typography component="li" variant="body2">
                Pricing excludes X/C's, Cloud Provider Port Charges, Exchange Charges and Applicable Taxes
              </Typography>
              <Typography component="li" variant="body2">
                Standard IPC Pricing caveats apply. Please see Pricing Team if unclear
              </Typography>
            </Box>

            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2 }} gutterBottom>
              Term Discounts
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2, '& li': { mb: 0.5 } }}>
              <Typography component="li" variant="body2">
                24 Months - 50% NRC Discount - 5% MRC Discount
              </Typography>
              <Typography component="li" variant="body2">
                36 Months - 100% NRC Discount - 10% MRC Discount
              </Typography>
            </Box>

            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2 }} gutterBottom>
              Additional Discount on Displacement Services
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2, '& li': { mb: 0.5 } }}>
              <Typography component="li" variant="body2">
                12 Months - NRC Waived - 1 Month FOC
              </Typography>
              <Typography component="li" variant="body2">
                24 Months - NRC Waived - 2 Months FOC
              </Typography>
              <Typography component="li" variant="body2">
                36 Months - NRC Waived - 3 Months FOC
              </Typography>
            </Box>
          </Paper>
        </Paper>
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

