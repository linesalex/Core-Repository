import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, Divider, Alert, CircularProgress, Autocomplete, Chip, Switch,
  FormControlLabel, InputAdornment, alpha, Accordion, AccordionSummary, AccordionDetails,
  Snackbar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Tab,
  Pagination, IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CalculateIcon from '@mui/icons-material/Calculate';
import RefreshIcon from '@mui/icons-material/Refresh';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import DiscountIcon from '@mui/icons-material/Discount';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ReceiptIcon from '@mui/icons-material/Receipt';
import DownloadIcon from '@mui/icons-material/Download';
import InfoIcon from '@mui/icons-material/Info';
import HistoryIcon from '@mui/icons-material/History';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import { API_BASE_URL } from './config';
import { useAuth } from './AuthContext';
import axios from 'axios';

// Tab panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const ExtranetPricingTool = () => {
  const { user } = useAuth();
  const isAdmin = user && user.role === 'administrator';
  
  // Tab state
  const [currentTab, setCurrentTab] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    // Provider
    provider_primary_city: null,
    provider_secondary_city: null,
    // Member
    member_primary_city: null,
    member_secondary_city: null,
    member_resiliency: '',
    member_on_off_net: 'On Net',
    member_cloud: false,
    // Parameters
    bandwidth: '',
    traffic_type: 'Live/Standby',
    ipsec_required: false,
    contract_term: 12,
    currency_requested: 'USD',
    // Discount
    discount_requested: false,
    discount_percent: ''
  });

  // Data states
  const [cities, setCities] = useState([]);
  const [bandwidths, setBandwidths] = useState([]);
  const [currencies, setCurrencies] = useState([{ currency_code: 'USD', currency_name: 'US Dollar' }]);
  const [maxDiscount, setMaxDiscount] = useState(15);
  
  // Pricing logs states
  const [pricingLogs, setPricingLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [providerCityFilter, setProviderCityFilter] = useState('');
  const [memberCityFilter, setMemberCityFilter] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 0
  });
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [parametersLocked, setParametersLocked] = useState(false);
  const [expandedAccordion, setExpandedAccordion] = useState('form');

  // Pricing terms for display and export
  const pricingTerms = [
    'Pricing is provided for connectivity between on-net locations with sufficient capacity.',
    'Off-net pricing is strictly budgetary, subject to site survey and official pricing confirmation.',
    'All terms are subject to MSA terms and conditions.',
    'All Pricing is exclusive of any applicable Taxes and Surcharges.',
    'Customer must provide all necessary rack space and power supply.',
    'Any additional 3rd Party costs incurred on order of the service will be chargeable to the customer, including but not limited to cross connects, additional cabling, out of hours charges, etc.',
    'Any additional costs incurred for out of hours work will be chargeable to the customer.',
    'Pricing is for connectivity only and does not include any fees associated with data feeds.'
  ];

  // Resiliency options
  const resiliencyOptions = [
    'Non-Resilient',
    'Single Site Resilient',
    'Split Site Resilient',
    'Dual Site Resilient'
  ];

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Clear secondary location when Non-Resilient or Single Site Resilient is selected
  useEffect(() => {
    if (formData.member_resiliency === 'Non-Resilient' || formData.member_resiliency === 'Single Site Resilient') {
      if (formData.member_secondary_city !== null) {
        setFormData(prev => ({
          ...prev,
          member_secondary_city: null
        }));
      }
    }
  }, [formData.member_resiliency]);

  // Load pricing logs when tab changes to logs (admin only)
  useEffect(() => {
    if (currentTab === 1 && isAdmin) {
      loadPricingLogs();
      loadUsersListForFilter();
    }
  }, [currentTab, pagination.page, pagination.limit, selectedUser, providerCityFilter, memberCityFilter]);

  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      
      const [citiesRes, bandwidthsRes, currenciesRes, parametersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/extranet-pricing/cities`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }),
        axios.get(`${API_BASE_URL}/extranet-pricing/bandwidths`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }),
        axios.get(`${API_BASE_URL}/extranet-pricing/currencies`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }),
        axios.get(`${API_BASE_URL}/extranet-pricing/parameters`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        })
      ]);
      
      setCities(citiesRes.data);
      setBandwidths(bandwidthsRes.data);
      
      const currencyData = currenciesRes.data || [];
      if (!currencyData.some(c => c.currency_code === 'USD')) {
        currencyData.unshift({ currency_code: 'USD', currency_name: 'US Dollar' });
      }
      setCurrencies(currencyData);
      
      if (parametersRes.data.max_user_discount) {
        setMaxDiscount(parseFloat(parametersRes.data.max_user_discount.value) || 15);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError('Failed to load initial data: ' + err.message);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadPricingLogs = async () => {
    if (!isAdmin) return;
    
    try {
      setLogsLoading(true);
      const params = new URLSearchParams({
        limit: pagination.limit,
        offset: (pagination.page - 1) * pagination.limit
      });
      
      if (selectedUser) params.append('user_id', selectedUser);
      if (providerCityFilter) params.append('provider_city', providerCityFilter);
      if (memberCityFilter) params.append('member_city', memberCityFilter);
      
      const response = await axios.get(`${API_BASE_URL}/extranet-pricing/logs?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      
      setPricingLogs(response.data.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages
      }));
    } catch (err) {
      console.error('Error loading pricing logs:', err);
      setError('Failed to load pricing logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const loadUsersListForFilter = async () => {
    if (!isAdmin) return;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/extranet-pricing/users`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      setUsersList(response.data || []);
    } catch (err) {
      console.error('Error loading users list:', err);
    }
  };

  const handleExportLogs = async () => {
    try {
      setSuccess('Preparing export...');
      const response = await fetch(`${API_BASE_URL}/extranet-pricing/logs/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extranet_pricing_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccess('Logs exported successfully');
    } catch (err) {
      setError('Failed to export logs: ' + err.message);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all extranet pricing logs? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/extranet-pricing/logs`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      setPricingLogs([]);
      setPagination(prev => ({ ...prev, total: 0, totalPages: 0 }));
      setSuccess('Pricing logs cleared successfully');
    } catch (err) {
      setError('Failed to clear pricing logs: ' + err.message);
    }
  };

  const clearLogFilters = () => {
    setSelectedUser('');
    setProviderCityFilter('');
    setMemberCityFilter('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleInputChange = (field, value) => {
    if (parametersLocked) return;
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  // Auto-select best bandwidth option when user types
  const handleBandwidthChange = (event, newValue, reason) => {
    if (parametersLocked) return;
    
    if (reason === 'input' || reason === 'clear') {
      // User is typing - just update the value
      handleInputChange('bandwidth', newValue || '');
    } else {
      // User selected from dropdown
      handleInputChange('bandwidth', newValue || '');
    }
  };

  const handleBandwidthBlur = () => {
    if (parametersLocked || !formData.bandwidth) return;
    
    // Try to match the input to a bandwidth option
    const inputValue = formData.bandwidth.trim().toLowerCase();
    if (!inputValue) return;
    
    // Extract numeric value from input
    const numericMatch = inputValue.match(/^(\d+)/);
    if (numericMatch) {
      const numericValue = numericMatch[1];
      
      // Find the best matching bandwidth
      const matchingBandwidth = bandwidths.find(bw => {
        const bwLower = bw.toLowerCase();
        return bwLower === inputValue || 
               bwLower === `${numericValue}mb` || 
               bwLower.startsWith(numericValue);
      });
      
      if (matchingBandwidth) {
        handleInputChange('bandwidth', matchingBandwidth);
      } else if (!inputValue.includes('mb') && !inputValue.includes('gb')) {
        // If user just typed a number, add 'Mb'
        handleInputChange('bandwidth', `${numericValue}Mb`);
      }
    }
  };

  const handleCalculate = async () => {
    if (!formData.provider_primary_city || !formData.member_primary_city) {
      setError('Provider and Member primary locations are required');
      return;
    }
    if (!formData.bandwidth) {
      setError('Bandwidth is required');
      return;
    }
    if (!formData.member_resiliency) {
      setError('Resiliency Type is required');
      return;
    }

    if (formData.discount_requested && formData.discount_percent) {
      const discountValue = parseFloat(formData.discount_percent);
      if (discountValue > maxDiscount) {
        setError(`Discount exceeds maximum allowed. Please reduce your discount request.`);
        return;
      }
    }

    let adjustedBandwidth = formData.bandwidth;
    if (formData.member_on_off_net === 'Off Net') {
      const bandwidthValue = parseFloat(formData.bandwidth.replace(/[^0-9.]/g, ''));
      const bandwidthUnit = formData.bandwidth.toLowerCase();
      let bandwidthMb = bandwidthValue;
      if (bandwidthUnit.includes('kb')) {
        bandwidthMb = bandwidthValue / 1000;
      }
      if (bandwidthMb < 10) {
        adjustedBandwidth = '10Mb';
      }
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/extranet-pricing/calculate`, {
        provider_primary_city: formData.provider_primary_city?.city_name,
        provider_secondary_city: formData.provider_secondary_city?.city_name || null,
        member_primary_city: formData.member_primary_city?.city_name,
        member_secondary_city: formData.member_secondary_city?.city_name || null,
        member_resiliency: formData.member_resiliency,
        member_on_off_net: formData.member_on_off_net,
        member_cloud: formData.member_cloud,
        bandwidth: adjustedBandwidth,
        traffic_type: formData.traffic_type,
        ipsec_required: formData.ipsec_required,
        contract_term: formData.contract_term,
        currency_requested: formData.currency_requested,
        discount_requested: formData.discount_requested,
        discount_percent: formData.discount_requested ? parseFloat(formData.discount_percent) || 0 : 0
      }, {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      setResult({
        ...response.data,
        formSnapshot: {
          ...formData,
          bandwidth: adjustedBandwidth
        }
      });
      setParametersLocked(true);
      setExpandedAccordion('results');
    } catch (err) {
      if (err.response?.data?.poa) {
        setError(err.response.data.error);
      } else {
        setError(err.response?.data?.error || 'Failed to calculate pricing');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setFormData({
      provider_primary_city: null,
      provider_secondary_city: null,
      member_primary_city: null,
      member_secondary_city: null,
      member_resiliency: '',
      member_on_off_net: 'On Net',
      member_cloud: false,
      bandwidth: '',
      traffic_type: 'Live/Standby',
      ipsec_required: false,
      contract_term: 12,
      currency_requested: 'USD',
      discount_requested: false,
      discount_percent: ''
    });
    setResult(null);
    setError('');
    setParametersLocked(false);
    setExpandedAccordion('form');
  };

  const handleExportToFile = () => {
    if (!result) return;

    const snapshot = result.formSnapshot || formData;
    const timestamp = new Date().toLocaleString();
    
    let content = `EXTRANET PRICING QUOTE
Generated: ${timestamp}
================================================

PROVIDER DETAILS
----------------
Primary Location: ${snapshot.provider_primary_city?.city_name || 'N/A'}, ${snapshot.provider_primary_city?.country || ''}
Secondary Location: ${snapshot.provider_secondary_city?.city_name || 'None'}, ${snapshot.provider_secondary_city?.country || ''}

MEMBER DETAILS
--------------
Primary Location: ${snapshot.member_primary_city?.city_name || 'N/A'}, ${snapshot.member_primary_city?.country || ''}
Secondary Location: ${snapshot.member_secondary_city?.city_name || 'None'}, ${snapshot.member_secondary_city?.country || ''}
Resiliency Type: ${snapshot.member_resiliency}
On/Off Net: ${snapshot.member_on_off_net}
Public Cloud: ${snapshot.member_cloud ? 'Yes' : 'No'}

SERVICE PARAMETERS
------------------
Bandwidth: ${result.details?.bandwidth || snapshot.bandwidth}
Traffic Type: ${snapshot.traffic_type}
IPSec Required: ${snapshot.ipsec_required ? 'Yes' : 'No'}
Contract Term: ${snapshot.contract_term} months
Currency: ${snapshot.currency_requested}

`;

    if (snapshot.discount_requested && snapshot.discount_percent) {
      content += `DISCOUNT
--------
Discount Requested: ${snapshot.discount_percent}%

`;
    }

    content += `PRICING RESULT
==============
Monthly Recurring Charge (MRC): ${formatCurrency(result.pricing.mrc, result.pricing.currency)}
Non-Recurring Charge (NRC): ${formatCurrency(result.pricing.nrc, result.pricing.currency)}
`;

    if (result.pricing.ipsec_poa) {
      content += `\nIPSec: Unable to provide pricing for IPSec at this bandwidth - please contact pricing team.\n`;
    } else if (result.pricing.ipsec_surcharge > 0) {
      content += `IPSec Surcharge (included in MRC): ${formatCurrency(result.pricing.ipsec_surcharge, result.pricing.currency)}\n`;
    }

    content += `
CONFIGURATION DETAILS
---------------------
Tier Used: ${result.details.tier_used}
Region: ${result.details.region_used}

`;

    if (result.breakdown) {
      content += `PRICE BREAKDOWN (USD)
--------------------
Rate Card Base: $${roundUpToNearest5(result.breakdown.rate_card_base).toLocaleString()}
After Resiliency: $${roundUpToNearest5(result.breakdown.after_resiliency).toLocaleString()}
After Traffic Type: $${roundUpToNearest5(result.breakdown.adjusted_base).toLocaleString()}
`;
      if (result.breakdown.total_discount > 0) {
        content += `Total Discount: -$${roundUpToNearest5(result.breakdown.total_discount).toLocaleString()}\n`;
      }
      if (result.breakdown.ipsec_surcharge > 0 && !result.pricing.ipsec_poa) {
        content += `IPSec Surcharge: +$${roundUpToNearest5(result.breakdown.ipsec_surcharge).toLocaleString()}\n`;
      }
      content += `Final MRC (USD): $${roundUpToNearest5(result.breakdown.mrc_usd).toLocaleString()}\n`;
    }

    content += `
================================================
TERMS AND CONDITIONS
================================================
`;
    pricingTerms.forEach((term, index) => {
      content += `${index + 1}. ${term}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `Extranet_Quote_${snapshot.provider_primary_city?.city_name || 'Provider'}_${snapshot.member_primary_city?.city_name || 'Member'}_${new Date().toISOString().slice(0, 10)}.txt`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    setSuccess('Quote exported successfully');
  };

  const getTierColor = (tier) => {
    const colors = {
      'Metro': 'primary',
      'Tier 1': 'success',
      'Tier 2': 'warning',
      'Tier 3': 'error'
    };
    return colors[tier] || 'default';
  };

  const getRegionColor = (region) => {
    const colors = {
      'AMERs': 'primary',
      'APAC': 'success',
      'EMEA': 'secondary'
    };
    return colors[region] || 'default';
  };

  // Round up to nearest $5
  const roundUpToNearest5 = (amount) => {
    return Math.ceil(amount / 5) * 5;
  };

  const formatCurrency = (amount, currency) => {
    const roundedAmount = roundUpToNearest5(amount);
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CHF': 'CHF ',
      'AUD': 'A$',
      'CAD': 'C$',
      'SGD': 'S$',
      'HKD': 'HK$'
    };
    const symbol = symbols[currency] || currency + ' ';
    return `${symbol}${roundedAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const isSecondaryLocationDisabled = formData.member_resiliency === 'Non-Resilient' || formData.member_resiliency === 'Single Site Resilient';

  const SectionHeader = ({ icon: Icon, title, color = 'primary' }) => (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5, 
        mb: 2,
        pb: 1.5,
        borderBottom: (theme) => `2px solid ${theme.palette[color].main}`
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: (theme) => alpha(theme.palette[color].main, 0.1),
        }}
      >
        <Icon sx={{ color: `${color}.main`, fontSize: 20 }} />
      </Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9375rem' }}>
        {title}
      </Typography>
    </Box>
  );

  if (initialLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={48} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Loading pricing data...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              boxShadow: (theme) => `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`,
            }}
          >
            <CalculateIcon sx={{ color: '#fff', fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1875rem' }}>
              Extranet Pricing Tool
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Calculate immediate Extranet pricing between providers & members. All pricing is subject to pricing confirmation.
            </Typography>
          </Box>
        </Box>
        {currentTab === 0 && (
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            sx={{ ml: 2 }}
          >
            Refresh
          </Button>
        )}
      </Box>

      {/* Tabs - only show Pricing Logs tab for admins */}
      {isAdmin && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)}>
            <Tab icon={<CalculateIcon />} label="Pricing Calculator" />
            <Tab icon={<HistoryIcon />} label="Pricing Logs" />
          </Tabs>
        </Box>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Pricing Calculator Tab */}
      <TabPanel value={currentTab} index={0}>
        {/* Form Accordion */}
        <Accordion 
          expanded={expandedAccordion === 'form'} 
          onChange={() => setExpandedAccordion(expandedAccordion === 'form' ? '' : 'form')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon />
              <Typography variant="h6" sx={{ fontSize: '1rem' }}>Quote Parameters</Typography>
              {parametersLocked && (
                <Chip label="Locked" size="small" color="warning" sx={{ ml: 1 }} />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* Left Column - Provider & Member */}
              <Grid item xs={12} md={6}>
                {/* Provider Section */}
                <Box sx={{ mb: 3 }}>
                  <SectionHeader icon={BusinessIcon} title="Provider Location" color="primary" />
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Autocomplete
                        options={cities}
                        getOptionLabel={(option) => `${option.city_name}, ${option.country || ''}`}
                        value={formData.provider_primary_city}
                        onChange={(e, value) => handleInputChange('provider_primary_city', value)}
                        disabled={parametersLocked}
                        renderInput={(params) => (
                          <TextField {...params} label="Primary Location *" size="small" />
                        )}
                        renderOption={(props, option) => (
                          <li {...props} key={option.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <LocationOnIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                              <Typography sx={{ flexGrow: 1, fontSize: '0.875rem' }}>{option.city_name}, {option.country}</Typography>
                            </Box>
                          </li>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Autocomplete
                        options={cities}
                        getOptionLabel={(option) => `${option.city_name}, ${option.country || ''}`}
                        value={formData.provider_secondary_city}
                        onChange={(e, value) => handleInputChange('provider_secondary_city', value)}
                        disabled={parametersLocked}
                        renderInput={(params) => (
                          <TextField {...params} label="Secondary Location (Optional)" size="small" />
                        )}
                        renderOption={(props, option) => (
                          <li {...props} key={option.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <LocationOnIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                              <Typography sx={{ flexGrow: 1, fontSize: '0.875rem' }}>{option.city_name}, {option.country}</Typography>
                            </Box>
                          </li>
                        )}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Member Section */}
                <Box sx={{ mb: 3 }}>
                  <SectionHeader icon={PersonIcon} title="Member Location & Details" color="secondary" />
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Autocomplete
                        options={cities}
                        getOptionLabel={(option) => `${option.city_name}, ${option.country || ''}`}
                        value={formData.member_primary_city}
                        onChange={(e, value) => handleInputChange('member_primary_city', value)}
                        disabled={parametersLocked}
                        renderInput={(params) => (
                          <TextField {...params} label="Primary Location *" size="small" />
                        )}
                        renderOption={(props, option) => (
                          <li {...props} key={option.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <LocationOnIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                              <Typography sx={{ flexGrow: 1, fontSize: '0.875rem' }}>{option.city_name}, {option.country}</Typography>
                            </Box>
                          </li>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Autocomplete
                        options={cities}
                        getOptionLabel={(option) => `${option.city_name}, ${option.country || ''}`}
                        value={formData.member_secondary_city}
                        onChange={(e, value) => handleInputChange('member_secondary_city', value)}
                        disabled={parametersLocked || isSecondaryLocationDisabled}
                        renderInput={(params) => (
                          <TextField 
                            {...params} 
                            label="Secondary Location (Optional)" 
                            size="small"
                            helperText={isSecondaryLocationDisabled ? 'Not applicable for selected resiliency type' : ''}
                          />
                        )}
                        renderOption={(props, option) => (
                          <li {...props} key={option.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <LocationOnIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                              <Typography sx={{ flexGrow: 1, fontSize: '0.875rem' }}>{option.city_name}, {option.country}</Typography>
                            </Box>
                          </li>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Resiliency Type *</InputLabel>
                        <Select
                          value={formData.member_resiliency}
                          onChange={(e) => handleInputChange('member_resiliency', e.target.value)}
                          label="Resiliency Type *"
                          disabled={parametersLocked}
                        >
                          {resiliencyOptions.map(option => (
                            <MenuItem key={option} value={option}>{option}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>On/Off Net *</InputLabel>
                        <Select
                          value={formData.member_on_off_net}
                          onChange={(e) => handleInputChange('member_on_off_net', e.target.value)}
                          label="On/Off Net *"
                          disabled={parametersLocked}
                        >
                          <MenuItem value="On Net">On Net</MenuItem>
                          <MenuItem value="Off Net">Off Net</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.member_cloud}
                            onChange={(e) => handleInputChange('member_cloud', e.target.checked)}
                            color="info"
                            disabled={parametersLocked}
                          />
                        }
                        label={
                          <Typography variant="body2">
                            Member located within public cloud (AWS/GCP/Azure)
                          </Typography>
                        }
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

              {/* Right Column - Parameters & Discount */}
              <Grid item xs={12} md={6}>
                {/* Parameters Section */}
                <Box sx={{ mb: 3 }}>
                  <SectionHeader icon={SettingsIcon} title="Service Parameters" color="info" />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Autocomplete
                        freeSolo
                        options={bandwidths}
                        value={formData.bandwidth}
                        onInputChange={handleBandwidthChange}
                        onBlur={handleBandwidthBlur}
                        disabled={parametersLocked}
                        renderInput={(params) => (
                          <TextField 
                            {...params} 
                            label="Bandwidth *" 
                            size="small"
                            placeholder="Type or select"
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Traffic Type *</InputLabel>
                        <Select
                          value={formData.traffic_type}
                          onChange={(e) => handleInputChange('traffic_type', e.target.value)}
                          label="Traffic Type *"
                          disabled={parametersLocked}
                        >
                          <MenuItem value="Live/Standby">Live/Standby</MenuItem>
                          <MenuItem value="Live/Live">Live/Live</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Contract Term *</InputLabel>
                        <Select
                          value={formData.contract_term}
                          onChange={(e) => handleInputChange('contract_term', e.target.value)}
                          label="Contract Term *"
                          disabled={parametersLocked}
                        >
                          <MenuItem value={12}>12 Months</MenuItem>
                          <MenuItem value={24}>24 Months</MenuItem>
                          <MenuItem value={36}>36 Months</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Currency *</InputLabel>
                        <Select
                          value={formData.currency_requested}
                          onChange={(e) => handleInputChange('currency_requested', e.target.value)}
                          label="Currency *"
                          disabled={parametersLocked}
                        >
                          {currencies.map(curr => (
                            <MenuItem key={curr.currency_code} value={curr.currency_code}>
                              {curr.currency_code}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.ipsec_required}
                            onChange={(e) => handleInputChange('ipsec_required', e.target.checked)}
                            color="warning"
                            disabled={parametersLocked}
                          />
                        }
                        label={
                          <Typography variant="body2">
                            IPSec Required
                          </Typography>
                        }
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Discount Section */}
                <Box sx={{ mb: 3 }}>
                  <SectionHeader icon={DiscountIcon} title="Discount Request" color="success" />
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.discount_requested}
                            onChange={(e) => handleInputChange('discount_requested', e.target.checked)}
                            color="success"
                            disabled={parametersLocked}
                          />
                        }
                        label={
                          <Typography variant="body2">
                            Request Discount
                          </Typography>
                        }
                      />
                    </Grid>
                    {formData.discount_requested && (
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Discount Percentage"
                          type="number"
                          value={formData.discount_percent}
                          onChange={(e) => handleInputChange('discount_percent', e.target.value)}
                          disabled={parametersLocked}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">%</InputAdornment>
                          }}
                          error={parseFloat(formData.discount_percent) > maxDiscount}
                        />
                      </Grid>
                    )}
                  </Grid>
                </Box>
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CalculateIcon />}
                    onClick={handleCalculate}
                    disabled={loading || !formData.provider_primary_city || !formData.member_primary_city || !formData.bandwidth || !formData.member_resiliency || parametersLocked}
                    sx={{ 
                      px: 4,
                      background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                      '&:hover': {
                        background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                      }
                    }}
                  >
                    {loading ? 'Calculating...' : 'Calculate Price'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Results Accordion */}
        {result && (
          <Accordion 
            expanded={expandedAccordion === 'results'} 
            onChange={() => setExpandedAccordion(expandedAccordion === 'results' ? '' : 'results')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachMoneyIcon />
                <Typography variant="h6" sx={{ fontSize: '1rem' }}>Pricing Results</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {/* Export Button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportToFile}
                >
                  Export to File
                </Button>
              </Box>

              <Grid container spacing={3}>
                {/* Left Column - Request Summary */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                        Quote Summary
                      </Typography>
                      
                      <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>Provider</Typography>
                      <Box sx={{ mb: 2, pl: 1 }}>
                        <Typography variant="body2">
                          Primary: {result.formSnapshot?.provider_primary_city?.city_name}, {result.formSnapshot?.provider_primary_city?.country}
                        </Typography>
                        {result.formSnapshot?.provider_secondary_city && (
                          <Typography variant="body2">
                            Secondary: {result.formSnapshot.provider_secondary_city.city_name}, {result.formSnapshot.provider_secondary_city.country}
                          </Typography>
                        )}
                      </Box>

                      <Typography variant="subtitle2" color="secondary" sx={{ mb: 1 }}>Member</Typography>
                      <Box sx={{ mb: 2, pl: 1 }}>
                        <Typography variant="body2">
                          Primary: {result.formSnapshot?.member_primary_city?.city_name}, {result.formSnapshot?.member_primary_city?.country}
                        </Typography>
                        {result.formSnapshot?.member_secondary_city && (
                          <Typography variant="body2">
                            Secondary: {result.formSnapshot.member_secondary_city.city_name}, {result.formSnapshot.member_secondary_city.country}
                          </Typography>
                        )}
                        <Typography variant="body2">Resiliency: {result.formSnapshot?.member_resiliency}</Typography>
                        <Typography variant="body2">Network: {result.formSnapshot?.member_on_off_net}</Typography>
                        {result.formSnapshot?.member_cloud && (
                          <Typography variant="body2">Public Cloud: Yes</Typography>
                        )}
                      </Box>

                      <Typography variant="subtitle2" color="info.main" sx={{ mb: 1 }}>Service</Typography>
                      <Box sx={{ pl: 1 }}>
                        <Typography variant="body2">Bandwidth: {result.details?.bandwidth || result.formSnapshot?.bandwidth}</Typography>
                        <Typography variant="body2">Traffic Type: {result.formSnapshot?.traffic_type}</Typography>
                        <Typography variant="body2">Contract Term: {result.formSnapshot?.contract_term} months</Typography>
                        <Typography variant="body2">Currency: {result.formSnapshot?.currency_requested}</Typography>
                        {result.formSnapshot?.ipsec_required && (
                          <Typography variant="body2">IPSec: Required</Typography>
                        )}
                        {result.formSnapshot?.discount_requested && result.formSnapshot?.discount_percent && (
                          <Typography variant="body2">Discount: {result.formSnapshot.discount_percent}%</Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Right Column - Pricing */}
                <Grid item xs={12} md={6}>
                  <Card 
                    elevation={0}
                    sx={{ 
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      overflow: 'hidden',
                      height: '100%'
                    }}
                  >
                    {/* Result Header */}
                    <Box 
                      sx={{ 
                        background: (theme) => `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                        color: '#fff',
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5
                      }}
                    >
                      <AttachMoneyIcon sx={{ fontSize: 28 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Pricing Result
                      </Typography>
                    </Box>
                    
                    <CardContent sx={{ p: 3 }}>
                      {/* Main Pricing */}
                      <Box 
                        sx={{ 
                          textAlign: 'center', 
                          py: 3, 
                          px: 2,
                          background: (theme) => alpha(theme.palette.success.main, 0.08),
                          borderRadius: 2, 
                          mb: 2,
                          border: '1px solid',
                          borderColor: (theme) => alpha(theme.palette.success.main, 0.2)
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                          <TrendingUpIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                            Monthly Recurring Charge (MRC)
                          </Typography>
                        </Box>
                        <Typography 
                          variant="h3" 
                          sx={{ 
                            color: 'success.main', 
                            fontWeight: 700,
                            fontSize: { xs: '2rem', sm: '2.5rem' }
                          }}
                        >
                          {formatCurrency(result.pricing.mrc, result.pricing.currency)}
                        </Typography>
                        {result.pricing.ipsec_poa && (
                          <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              Unable to provide pricing for IPSec at this bandwidth - please contact pricing team.
                            </Typography>
                          </Alert>
                        )}
                        {result.pricing.ipsec_surcharge > 0 && !result.pricing.ipsec_poa && (
                          <Chip 
                            label={`Includes IPSec: ${formatCurrency(result.pricing.ipsec_surcharge, result.pricing.currency)}`}
                            size="small"
                            color="warning"
                            sx={{ mt: 1 }}
                          />
                        )}
                      </Box>

                      <Box 
                        sx={{ 
                          textAlign: 'center', 
                          py: 2.5, 
                          px: 2,
                          background: (theme) => alpha(theme.palette.warning.main, 0.08),
                          borderRadius: 2, 
                          mb: 3,
                          border: '1px solid',
                          borderColor: (theme) => alpha(theme.palette.warning.main, 0.2)
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                          <ReceiptIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                            Non-Recurring Charge (NRC)
                          </Typography>
                        </Box>
                        <Typography 
                          variant="h4" 
                          sx={{ 
                            color: 'warning.dark', 
                            fontWeight: 700,
                            fontSize: { xs: '1.5rem', sm: '1.75rem' }
                          }}
                        >
                          {formatCurrency(result.pricing.nrc, result.pricing.currency)}
                        </Typography>
                      </Box>

                      {/* Details */}
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, fontSize: '0.875rem' }}>
                        Configuration Details
                      </Typography>
                      <Grid container spacing={1.5} sx={{ mb: 2 }}>
                        <Grid item xs={5}>
                          <Typography variant="body2" color="text.secondary">Tier Used:</Typography>
                        </Grid>
                        <Grid item xs={7}>
                          <Chip label={result.details.tier_used} size="small" color={getTierColor(result.details.tier_used)} />
                        </Grid>
                        
                        <Grid item xs={5}>
                          <Typography variant="body2" color="text.secondary">Region:</Typography>
                        </Grid>
                        <Grid item xs={7}>
                          <Chip label={result.details.region_used} size="small" color={getRegionColor(result.details.region_used)} />
                        </Grid>
                        
                        <Grid item xs={5}>
                          <Typography variant="body2" color="text.secondary">Bandwidth:</Typography>
                        </Grid>
                        <Grid item xs={7}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{result.details.bandwidth}</Typography>
                        </Grid>
                      </Grid>

                      {/* Breakdown Summary - Without percentages */}
                      {result.breakdown && (
                        <>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, fontSize: '0.875rem' }}>
                            Price Breakdown (USD)
                          </Typography>
                          <Box 
                            sx={{ 
                              fontSize: '0.8125rem', 
                              color: 'text.secondary',
                              backgroundColor: 'grey.50',
                              borderRadius: 1,
                              p: 1.5
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                              <span>Rate Card Base:</span>
                              <span style={{ fontWeight: 500 }}>${roundUpToNearest5(result.breakdown.rate_card_base).toLocaleString()}</span>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                              <span>After Resiliency:</span>
                              <span style={{ fontWeight: 500 }}>${roundUpToNearest5(result.breakdown.after_resiliency).toLocaleString()}</span>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                              <span>After Traffic Type:</span>
                              <span style={{ fontWeight: 500 }}>${roundUpToNearest5(result.breakdown.adjusted_base).toLocaleString()}</span>
                            </Box>
                            {result.breakdown.total_discount > 0 && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, color: 'success.main' }}>
                                <span>Total Discount:</span>
                                <span style={{ fontWeight: 600 }}>-${roundUpToNearest5(result.breakdown.total_discount).toLocaleString()}</span>
                              </Box>
                            )}
                            {result.pricing.ipsec_poa && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, color: 'info.main' }}>
                                <span>IPSec Surcharge:</span>
                                <Chip label="POA" size="small" color="info" />
                              </Box>
                            )}
                            {result.breakdown.ipsec_surcharge > 0 && !result.pricing.ipsec_poa && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, color: 'warning.main' }}>
                                <span>IPSec Surcharge:</span>
                                <span style={{ fontWeight: 500 }}>+${roundUpToNearest5(result.breakdown.ipsec_surcharge).toLocaleString()}</span>
                              </Box>
                            )}
                            <Divider sx={{ my: 1 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, fontWeight: 'bold', color: 'text.primary' }}>
                              <span>Final MRC (USD):</span>
                              <span>${roundUpToNearest5(result.breakdown.mrc_usd).toLocaleString()}</span>
                            </Box>
                          </Box>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Terms and Conditions */}
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ backgroundColor: 'grey.50' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <InfoIcon color="info" />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          Terms and Conditions
                        </Typography>
                      </Box>
                      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                        {pricingTerms.map((term, index) => (
                          <Typography component="li" variant="body2" key={index} sx={{ mb: 0.5, color: 'text.secondary' }}>
                            {term}
                          </Typography>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Placeholder when no result */}
        {!result && !error && expandedAccordion !== 'form' && (
          <Card 
            elevation={0}
            sx={{ 
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              textAlign: 'center', 
              py: 8,
              px: 3,
              backgroundColor: 'grey.50'
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'grey.200',
                mx: 'auto',
                mb: 2
              }}
            >
              <CalculateIcon sx={{ fontSize: 40, color: 'grey.400' }} />
            </Box>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              Ready to Calculate
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Enter provider and member details, then click Calculate Price
            </Typography>
          </Card>
        )}
      </TabPanel>

      {/* Pricing Logs Tab (Admin Only) */}
      {isAdmin && (
        <TabPanel value={currentTab} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Pricing Logs</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip 
                label={`Showing ${pricingLogs.length} of ${pagination.total} entries (Page ${pagination.page}/${pagination.totalPages || 1})`} 
                color="info" 
                size="small"
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleExportLogs}
                startIcon={<DownloadIcon />}
              >
                Export CSV
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={handleClearLogs}
                startIcon={<DeleteIcon />}
              >
                Clear Logs
              </Button>
            </Box>
          </Box>

          {/* Search and Filter Controls */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    label="User"
                    value={selectedUser}
                    onChange={(e) => { setSelectedUser(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                  >
                    <MenuItem value="">All Users</MenuItem>
                    {usersList.map(u => (
                      <MenuItem key={u.id} value={u.id}>{u.username}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Provider City"
                    value={providerCityFilter}
                    onChange={(e) => { setProviderCityFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                    placeholder="Search provider city..."
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Member City"
                    value={memberCityFilter}
                    onChange={(e) => { setMemberCityFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                    placeholder="Search member city..."
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    onClick={clearLogFilters}
                    startIcon={<FilterListOffIcon />}
                  >
                    Clear Filters
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Logs Table */}
          {logsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'grey.100' }}>
                    <TableCell><strong>Timestamp</strong></TableCell>
                    <TableCell><strong>User</strong></TableCell>
                    <TableCell><strong>Provider City</strong></TableCell>
                    <TableCell><strong>Member City</strong></TableCell>
                    <TableCell><strong>Resiliency</strong></TableCell>
                    <TableCell><strong>Bandwidth</strong></TableCell>
                    <TableCell><strong>Traffic</strong></TableCell>
                    <TableCell><strong>Term</strong></TableCell>
                    <TableCell><strong>IPSec</strong></TableCell>
                    <TableCell><strong>Discount</strong></TableCell>
                    <TableCell align="right"><strong>MRC</strong></TableCell>
                    <TableCell align="right"><strong>NRC</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pricingLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No pricing logs found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pricingLogs.map((log) => (
                      <TableRow key={log.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            {new Date(log.lookup_timestamp).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            {log.username || log.full_name || 'Unknown'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            {log.provider_primary_city}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            {log.member_primary_city}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={log.member_resiliency} 
                            size="small" 
                            sx={{ fontSize: '0.65rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            {log.bandwidth}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            {log.traffic_type}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            {log.contract_term}m
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={log.ipsec_required ? 'Yes' : 'No'} 
                            size="small" 
                            color={log.ipsec_required ? 'warning' : 'default'}
                            sx={{ fontSize: '0.65rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          {log.discount_requested ? (
                            <Chip 
                              label={`${log.discount_percent || 0}%`} 
                              size="small" 
                              color="success"
                              sx={{ fontSize: '0.65rem' }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>-</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                            {log.currency_requested} {roundUpToNearest5(log.final_mrc || 0).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            {log.currency_requested} {roundUpToNearest5(log.final_nrc || 0).toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Pagination */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination 
              count={pagination.totalPages || 1} 
              page={pagination.page} 
              onChange={(e, newPage) => setPagination(prev => ({ ...prev, page: newPage }))} 
              color="primary"
              showFirstButton
              showLastButton
              size="large"
            />
          </Box>
        </TabPanel>
      )}

      {/* Success Snackbar */}
      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ExtranetPricingTool;
