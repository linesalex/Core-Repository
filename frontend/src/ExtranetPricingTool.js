import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, Divider, Alert, CircularProgress, Autocomplete, Chip, Switch,
  FormControlLabel, InputAdornment, alpha, Accordion, AccordionSummary, AccordionDetails,
  Snackbar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Tab,
  Pagination, IconButton, Badge, Tooltip
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
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import ReplayIcon from '@mui/icons-material/Replay';
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
  const { user, modulePermissions } = useAuth();
  const isAdmin = user && user.role === 'administrator';
  const extranetPermission = isAdmin ? 'admin' : (modulePermissions?.['extranet_data'] || null);
  const canViewLogs = extranetPermission !== null; // Any extranet_data permission can view logs
  const canViewAllLogs = isAdmin || extranetPermission === 'provisioner'; // Provisioner + Admin see all
  const canManageLogs = isAdmin; // Only admins can clear logs and see calculation data
  
  // Tab state
  const [currentTab, setCurrentTab] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    // Provider
    provider_primary_city: null,
    provider_secondary_city: null,
    provider_region: '',
    // Provider/Product selection
    selected_provider: null,
    selected_product: null,
    isf: '',
    provider_name: '',
    product_name: '',
    // Member
    customer_name: '',
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
    currency_requested: 'USD'
  });

  // Data states
  const [cities, setCities] = useState([]);
  const [bandwidths, setBandwidths] = useState([]);
  const [currencies, setCurrencies] = useState([{ currency_code: 'USD', currency_name: 'US Dollar' }]);
  const [bundleTiers, setBundleTiers] = useState({ tier_1_max: 3, tier_2_max: 5 });
  
  // Provider/product selection states
  const [availableProviders, setAvailableProviders] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  
  // Shopping basket states
  const [basketItems, setBasketItems] = useState([]);
  const [bundleDiscounts, setBundleDiscounts] = useState({
    mrc: { '1_3': 0, '4_5': 0, '6_plus': 0 },
    nrc: { '1_3': 0, '4_5': 0, '6_plus': 0 }
  });
  const [bundleResult, setBundleResult] = useState(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [selectedBundleDiscount, setSelectedBundleDiscount] = useState('');
  
  // Pricing logs states
  const [pricingLogs, setPricingLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [providerCityFilter, setProviderCityFilter] = useState('');
  const [memberCityFilter, setMemberCityFilter] = useState('');
  const [customerNameFilter, setCustomerNameFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [expandedBundles, setExpandedBundles] = useState({});
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

  // Provider region options
  const providerRegionOptions = ['AMERs', 'APAC', 'EMEA'];

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

  // Load pricing logs when tab changes to logs
  useEffect(() => {
    if (currentTab === 1 && canViewLogs) {
      loadPricingLogs();
      if (canViewAllLogs) {
        loadUsersListForFilter();
      }
    }
  }, [currentTab, pagination.page, pagination.limit, selectedUser, providerCityFilter, memberCityFilter, customerNameFilter, startDateFilter, endDateFilter]);

  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      
      const [citiesRes, bandwidthsRes, currenciesRes, parametersRes, bundleDiscountsRes] = await Promise.all([
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
        }),
        axios.get(`${API_BASE_URL}/extranet-pricing/bundle-discounts`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }).catch(() => ({ data: null }))
      ]);
      
      setCities(citiesRes.data);
      setBandwidths(bandwidthsRes.data);
      
      const currencyData = currenciesRes.data || [];
      if (!currencyData.some(c => c.currency_code === 'USD')) {
        currencyData.unshift({ currency_code: 'USD', currency_name: 'US Dollar' });
      }
      setCurrencies(currencyData);
      
      if (bundleDiscountsRes.data) {
        setBundleDiscounts(bundleDiscountsRes.data);
        if (bundleDiscountsRes.data.tiers) {
          setBundleTiers(bundleDiscountsRes.data.tiers);
        }
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError('Failed to load initial data: ' + err.message);
    } finally {
      setInitialLoading(false);
    }
  };

  // Load providers when region changes
  const loadProviders = useCallback(async (region) => {
    if (!region) {
      setAvailableProviders([]);
      return;
    }
    try {
      setProvidersLoading(true);
      const response = await axios.get(`${API_BASE_URL}/extranet-pricing/providers/${region}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      setAvailableProviders(response.data || []);
    } catch (err) {
      console.error('Failed to load providers:', err);
      setAvailableProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  // Load products when provider changes
  const loadProducts = useCallback(async (providerId) => {
    if (!providerId) {
      setAvailableProducts([]);
      return;
    }
    try {
      setProductsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/extranet-pricing/products/${providerId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      setAvailableProducts(response.data || []);
    } catch (err) {
      console.error('Failed to load products:', err);
      setAvailableProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  // Resolve datacenter code to pricing city
  const resolveDatacenter = useCallback(async (code) => {
    if (!code) return null;
    try {
      const response = await axios.get(`${API_BASE_URL}/extranet-pricing/resolve-datacenter/${code}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      return response.data;
    } catch (err) {
      console.error('Failed to resolve datacenter:', err);
      return null;
    }
  }, []);

  const loadPricingLogs = async () => {
    if (!canViewLogs) return;
    
    try {
      setLogsLoading(true);
      const params = new URLSearchParams({
        limit: pagination.limit,
        offset: (pagination.page - 1) * pagination.limit
      });
      
      if (selectedUser && canViewAllLogs) params.append('user_id', selectedUser);
      if (providerCityFilter) params.append('provider_city', providerCityFilter);
      if (memberCityFilter) params.append('member_city', memberCityFilter);
      if (customerNameFilter) params.append('customer_name', customerNameFilter);
      if (startDateFilter) params.append('start_date', startDateFilter);
      if (endDateFilter) params.append('end_date', endDateFilter);
      
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
    if (!canViewAllLogs) return;
    
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
    setCustomerNameFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const toggleBundleExpand = (bundleId) => {
    setExpandedBundles(prev => ({ ...prev, [bundleId]: !prev[bundleId] }));
  };

  // Helper to parse calculation_breakdown JSON safely
  const parseBreakdown = (raw) => {
    if (!raw) return null;
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return { raw }; }
  };

  const handleInputChange = (field, value) => {
    if (parametersLocked && field !== 'provider_region' && field !== 'selected_provider' && field !== 'selected_product') return;
    // Lock contract_term, currency, and customer_name after first basket item
    if (basketItems.length > 0 && (field === 'contract_term' || field === 'currency_requested' || field === 'customer_name')) return;
    
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-populate provider_region when provider_primary_city changes
      if (field === 'provider_primary_city' && value && value.region) {
        updated.provider_region = value.region;
      } else if (field === 'provider_primary_city' && !value) {
        updated.provider_region = '';
      }
      
      // When provider_region changes, clear provider/product selection and load new providers
      if (field === 'provider_region') {
        updated.selected_provider = null;
        updated.selected_product = null;
        updated.isf = '';
        updated.provider_name = '';
        updated.product_name = '';
        loadProviders(value);
        setAvailableProducts([]);
      }
      
      // When provider changes, clear product and load products
      if (field === 'selected_provider') {
        updated.selected_product = null;
        updated.isf = '';
        updated.product_name = '';
        if (value) {
          updated.provider_name = value.provider_name;
          loadProducts(value.id);
        } else {
          updated.provider_name = '';
          setAvailableProducts([]);
        }
      }
      
      // When product changes, auto-populate locations, bandwidth, ISF
      if (field === 'selected_product') {
        if (value) {
          updated.isf = value.isf || '';
          updated.product_name = value.product_name || '';
          
          // Auto-populate suggested bandwidth (user can still change it)
          if (value.suggested_bandwidth) {
            updated.bandwidth = `${value.suggested_bandwidth}Mb`;
          }
          
          // Auto-populate primary datacenter location
          if (value.primary_datacenter && value.primary_pricing_city) {
            // Use the admin-set pricing city
            const matchingCity = cities.find(c => c.city_name.toLowerCase() === value.primary_pricing_city.toLowerCase());
            if (matchingCity) {
              updated.provider_primary_city = matchingCity;
              if (matchingCity.region) updated.provider_region = matchingCity.region;
            }
          } else if (value.primary_datacenter) {
            // Try to resolve via datacenter code
            resolveDatacenter(value.primary_datacenter).then(result => {
              if (result && result.resolved) {
                const matchingCity = cities.find(c => c.id === result.pricing_city.id);
                if (matchingCity) {
                  setFormData(prev => ({
                    ...prev,
                    provider_primary_city: matchingCity,
                    provider_region: matchingCity.region || prev.provider_region
                  }));
                }
              }
            });
          }
          
          // Auto-populate secondary datacenter location (first secondary)
          if (value.secondary_datacenters) {
            const secondaryDcs = value.secondary_datacenters.split(',').map(dc => dc.trim()).filter(dc => dc);
            if (secondaryDcs.length > 0) {
              resolveDatacenter(secondaryDcs[0]).then(result => {
                if (result && result.resolved) {
                  const matchingCity = cities.find(c => c.id === result.pricing_city.id);
                  if (matchingCity) {
                    setFormData(prev => ({ ...prev, provider_secondary_city: matchingCity }));
                  }
                }
              });
            }
          }
        } else {
          updated.isf = '';
          updated.product_name = '';
        }
      }
      
      return updated;
    });
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
    
    // Extract numeric value (including decimals) and optional unit from input
    const numericMatch = inputValue.match(/^(\d+\.?\d*)\s*(kb|mb|gb)?$/i);
    if (numericMatch) {
      const numericValue = numericMatch[1];
      const unit = numericMatch[2] ? numericMatch[2].toLowerCase() : null;
      
      // Priority 1: Exact match (case-insensitive)
      const exactMatch = bandwidths.find(bw => bw.toLowerCase() === inputValue);
      if (exactMatch) {
        handleInputChange('bandwidth', exactMatch);
        return;
      }
      
      // Priority 2: Match numeric + explicit unit (e.g. "1" + "mb" = "1mb")
      if (unit) {
        const withUnit = `${numericValue}${unit}`;
        const unitMatch = bandwidths.find(bw => bw.toLowerCase() === withUnit);
        if (unitMatch) {
          handleInputChange('bandwidth', unitMatch);
          return;
        }
      }
      
      // Priority 3: If user typed just a number with no unit, try matching with 'mb' suffix
      if (!unit) {
        const mbMatch = bandwidths.find(bw => bw.toLowerCase() === `${numericValue}mb`);
        if (mbMatch) {
          handleInputChange('bandwidth', mbMatch);
          return;
        }
        // Fallback: append 'Mb' to the number so it can be sent to the backend
        handleInputChange('bandwidth', `${numericValue}Mb`);
      }
    }
  };

  const handleCalculateAndAddToBasket = async () => {
    if (!formData.provider_primary_city || !formData.member_primary_city) {
      setError('Provider and Member primary locations are required');
      return;
    }
    if (!formData.provider_region) {
      setError('Provider Region is required');
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

    try {
      const response = await axios.post(`${API_BASE_URL}/extranet-pricing/calculate`, {
        provider_primary_city: formData.provider_primary_city?.city_name,
        provider_secondary_city: formData.provider_secondary_city?.city_name || null,
        provider_region: formData.provider_region,
        customer_name: formData.customer_name || null,
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
        discount_requested: false,
        discount_percent: 0,
        isf: formData.isf || null,
        provider_name: formData.provider_name || null,
        product_name: formData.product_name || null,
        skip_log: true  // Don't log individual basket items — bundle endpoint logs them
      }, {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      // Add to basket
      const newItem = {
        id: Date.now(),
        formSnapshot: { ...formData, bandwidth: adjustedBandwidth },
        result: response.data,
        poa: false
      };
      
      setBasketItems(prev => [...prev, newItem]);
      setBundleResult(null);
      setSelectedBundleDiscount('');
      setSuccess(`Item added to basket (${basketItems.length + 1} items total)`);
      
      // Reset form for next item (keep contract_term, currency, provider_region)
      setFormData(prev => ({
        ...prev,
        provider_primary_city: null,
        provider_secondary_city: null,
        selected_provider: null,
        selected_product: null,
        isf: '',
        provider_name: '',
        product_name: '',
        member_primary_city: null,
        member_secondary_city: null,
        member_resiliency: '',
        member_on_off_net: 'On Net',
        member_cloud: false,
        bandwidth: '',
        traffic_type: 'Live/Standby',
        ipsec_required: false
      }));
      setParametersLocked(false);
      setExpandedAccordion('basket');
    } catch (err) {
      if (err.response?.data?.poa) {
        // Still add POA items to basket
        const poaItem = {
          id: Date.now(),
          formSnapshot: { ...formData, bandwidth: adjustedBandwidth },
          result: null,
          poa: true,
          poaMessage: err.response.data.error
        };
        setBasketItems(prev => [...prev, poaItem]);
        setBundleResult(null);
        setSelectedBundleDiscount('');
        setSuccess('Item added to basket (POA - Price On Application)');
        
        // Reset form
        setFormData(prev => ({
          ...prev,
          provider_primary_city: null,
          provider_secondary_city: null,
          selected_provider: null,
          selected_product: null,
          isf: '',
          provider_name: '',
          product_name: '',
          member_primary_city: null,
          member_secondary_city: null,
          member_resiliency: '',
          member_on_off_net: 'On Net',
          member_cloud: false,
          bandwidth: '',
          traffic_type: 'Live/Standby',
          ipsec_required: false
        }));
        setParametersLocked(false);
        setExpandedAccordion('basket');
      } else {
        setError(err.response?.data?.error || 'Failed to calculate pricing');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromBasket = (itemId) => {
    setBasketItems(prev => prev.filter(item => item.id !== itemId));
    setBundleResult(null);
    setSelectedBundleDiscount('');
  };

  // Get max discount available based on basket size (uses configurable tier boundaries)
  const getMaxBundleDiscount = () => {
    const count = basketItems.length;
    const t1Max = bundleTiers.tier_1_max || 3;
    const t2Max = bundleTiers.tier_2_max || 5;
    if (count > t2Max) return bundleDiscounts.mrc['6_plus'];
    if (count > t1Max) return bundleDiscounts.mrc['4_5'];
    return bundleDiscounts.mrc['1_3'];
  };

  // Complete basket with bundle discount
  const handleCompleteBasket = async () => {
    if (basketItems.length === 0) {
      setError('Add at least one item to the basket');
      return;
    }
    
    const numericItems = basketItems.filter(item => !item.poa);
    if (numericItems.length === 0) {
      setError('All items are POA - cannot apply bundle discount');
      return;
    }

    setBundleLoading(true);
    setError('');

    try {
      const items = basketItems.map(item => ({
        provider_primary_city: item.formSnapshot.provider_primary_city?.city_name,
        provider_secondary_city: item.formSnapshot.provider_secondary_city?.city_name || null,
        member_primary_city: item.formSnapshot.member_primary_city?.city_name,
        member_secondary_city: item.formSnapshot.member_secondary_city?.city_name || null,
        member_resiliency: item.formSnapshot.member_resiliency,
        member_on_off_net: item.formSnapshot.member_on_off_net,
        member_cloud: item.formSnapshot.member_cloud,
        bandwidth: item.formSnapshot.bandwidth,
        traffic_type: item.formSnapshot.traffic_type,
        ipsec_required: item.formSnapshot.ipsec_required,
        provider_region: item.formSnapshot.provider_region,
        isf: item.formSnapshot.isf || null,
        provider_name: item.formSnapshot.provider_name || null,
        product_name: item.formSnapshot.product_name || null
      }));

      // Use customer_name from formData or from the first basket item's snapshot
      const customerName = formData.customer_name || basketItems[0]?.formSnapshot?.customer_name || '';

      const response = await axios.post(`${API_BASE_URL}/extranet-pricing/calculate-bundle`, {
        items,
        contract_term: formData.contract_term,
        currency_requested: formData.currency_requested,
        discount_percent: parseFloat(selectedBundleDiscount) || 0,
        customer_name: customerName || null
      }, {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      setBundleResult(response.data);
      setExpandedAccordion('basket');
      setParametersLocked(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to calculate bundle pricing');
    } finally {
      setBundleLoading(false);
    }
  };

  // Reload a bundle from pricing logs back into the basket for re-pricing with a different discount
  const handleReloadBasket = (bundleLog) => {
    if (!bundleLog || !bundleLog.items || bundleLog.items.length === 0) {
      setError('No items found in this bundle to reload');
      return;
    }

    // Helper to find a city object from the loaded cities list by name
    const findCity = (cityName) => {
      if (!cityName) return null;
      const found = cities.find(c => c.city_name.toLowerCase() === cityName.toLowerCase());
      // If exact match found, use it; otherwise create a minimal object so the basket can display it
      return found || { city_name: cityName, country: '', region: '', tier: '' };
    };

    // Reconstruct basket items from the bundle's log items
    const reconstructedItems = bundleLog.items.map((item, idx) => {
      // Parse calculation_breakdown for provider_region info
      let breakdown = {};
      try {
        breakdown = item.calculation_breakdown ? JSON.parse(item.calculation_breakdown) : {};
      } catch (e) { /* ignore parse errors */ }

      const formSnapshot = {
        provider_primary_city: findCity(item.provider_primary_city),
        provider_secondary_city: item.provider_secondary_city ? findCity(item.provider_secondary_city) : null,
        provider_region: breakdown.provider_rate_card || '',
        selected_provider: null,
        selected_product: null,
        isf: item.isf_code || '',
        provider_name: item.provider_name || '',
        product_name: item.product_name || '',
        customer_name: bundleLog.customer_name || '',
        member_primary_city: findCity(item.member_primary_city),
        member_secondary_city: item.member_secondary_city ? findCity(item.member_secondary_city) : null,
        member_resiliency: item.member_resiliency || '',
        member_on_off_net: item.member_on_off_net || 'On Net',
        member_cloud: item.member_cloud === 1 || item.member_cloud === true,
        bandwidth: item.bandwidth || '',
        traffic_type: item.traffic_type || 'Live/Standby',
        ipsec_required: item.ipsec_required === 1 || item.ipsec_required === true,
        contract_term: item.contract_term || bundleLog.contract_term || 12,
        currency_requested: item.currency_requested || bundleLog.currency || 'USD'
      };

      return {
        id: Date.now() + idx,
        formSnapshot,
        result: null, // Will be recalculated when bundle is completed
        poa: false
      };
    });

    // Set basket items and form parameters
    setBasketItems(reconstructedItems);
    setBundleResult(null);
    setSelectedBundleDiscount('');
    setFormData(prev => ({
      ...prev,
      customer_name: bundleLog.customer_name || prev.customer_name,
      contract_term: bundleLog.contract_term || prev.contract_term,
      currency_requested: bundleLog.currency || prev.currency_requested
    }));
    setParametersLocked(false);
    setCurrentTab(0);
    setExpandedAccordion('basket');
    setSuccess(`Basket reloaded with ${reconstructedItems.length} items from bundle — select a discount % and complete`);
  };

  const handleRefresh = () => {
    setFormData({
      provider_primary_city: null,
      provider_secondary_city: null,
      provider_region: '',
      selected_provider: null,
      selected_product: null,
      isf: '',
      provider_name: '',
      product_name: '',
      customer_name: '',
      member_primary_city: null,
      member_secondary_city: null,
      member_resiliency: '',
      member_on_off_net: 'On Net',
      member_cloud: false,
      bandwidth: '',
      traffic_type: 'Live/Standby',
      ipsec_required: false,
      contract_term: 12,
      currency_requested: 'USD'
    });
    setResult(null);
    setBasketItems([]);
    setBundleResult(null);
    setSelectedBundleDiscount('');
    setAvailableProviders([]);
    setAvailableProducts([]);
    setError('');
    setParametersLocked(false);
    setExpandedAccordion('form');
  };

  const handleExportToFile = () => {
    if (!bundleResult && basketItems.length === 0) return;

    const timestamp = new Date().toLocaleString();
    const currency = formData.currency_requested || 'USD';
    
    const customerName = formData.customer_name || basketItems[0]?.formSnapshot?.customer_name || '';
    let content = `EXTRANET PRICING BUNDLE QUOTE\nGenerated: ${timestamp}\n${customerName ? `Customer: ${customerName}\n` : ''}Contract Term: ${formData.contract_term} months\nCurrency: ${currency}\n================================================\n\n`;

    if (bundleResult) {
      content += `BUNDLE SUMMARY\n--------------\nItems in Bundle: ${bundleResult.bundle.item_count}\nMRC Discount Applied: ${bundleResult.bundle_pricing.mrc_discount_percent}%\nTotal MRC: ${formatCurrency(bundleResult.bundle_pricing.total_mrc, currency)}\nTotal NRC: ${formatCurrency(bundleResult.bundle_pricing.total_nrc, currency)}\n`;
      if (bundleResult.bundle.has_poa_items) content += '⚠ Some items are POA (Price On Application)\n';
      content += '\n================================================\n\n';
    }

    basketItems.forEach((item, idx) => {
      const snap = item.formSnapshot;
      content += `ITEM ${idx + 1}\n--------\n`;
      content += `Provider: ${snap.provider_name || 'Manual Entry'}\nProduct: ${snap.product_name || 'N/A'}\nISF: ${snap.isf || 'N/A'}\n`;
      content += `Provider Primary: ${snap.provider_primary_city?.city_name || 'N/A'}, ${snap.provider_primary_city?.country || ''}\n`;
      content += `Provider Secondary: ${snap.provider_secondary_city?.city_name || 'None'}\n`;
      content += `Member Primary: ${snap.member_primary_city?.city_name || 'N/A'}, ${snap.member_primary_city?.country || ''}\n`;
      content += `Member Secondary: ${snap.member_secondary_city?.city_name || 'None'}\n`;
      content += `Resiliency: ${snap.member_resiliency}\nOn/Off Net: ${snap.member_on_off_net}\nCloud: ${snap.member_cloud ? 'Yes' : 'No'}\n`;
      content += `Bandwidth: ${snap.bandwidth}\nTraffic Type: ${snap.traffic_type}\nIPSec: ${snap.ipsec_required ? 'Yes' : 'No'}\n`;
      
      if (item.poa) {
        content += `Status: POA - ${item.poaMessage || 'Price On Application'}\n`;
      } else if (item.result?.pricing) {
        content += `Pre-Discount MRC: ${formatCurrency(item.result.pricing.mrc, item.result.pricing.currency)}\nPre-Discount NRC: ${formatCurrency(item.result.pricing.nrc, item.result.pricing.currency)}\n`;
      }
      
      if (bundleResult?.items?.[idx]?.pricing) {
        const bItem = bundleResult.items[idx];
        content += `Bundle MRC: ${formatCurrency(bItem.pricing.mrc, bItem.pricing.currency)}\nBundle NRC: ${formatCurrency(bItem.pricing.nrc, bItem.pricing.currency)}\n`;
      }
      content += '\n';
    });

    content += `================================================\nTERMS AND CONDITIONS\n================================================\n`;
    pricingTerms.forEach((term, index) => { content += `${index + 1}. ${term}\n`; });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Extranet_Bundle_Quote_${basketItems.length}items_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setSuccess('Bundle quote exported successfully');
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

      {/* Tabs - show Pricing Logs tab for all users with extranet_data access */}
      {canViewLogs && (
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
                    {/* Provider Region at TOP */}
                    <Grid item xs={12}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Provider Region *</InputLabel>
                        <Select
                          value={formData.provider_region}
                          onChange={(e) => handleInputChange('provider_region', e.target.value)}
                          label="Provider Region *"
                        >
                          {providerRegionOptions.map(region => (
                            <MenuItem key={region} value={region}>{region}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    {/* Provider Selection (optional) */}
                    {formData.provider_region && (
                      <Grid item xs={12}>
                        <Autocomplete
                          options={availableProviders}
                          getOptionLabel={(option) => option.provider_name || ''}
                          value={formData.selected_provider}
                          onChange={(e, value) => handleInputChange('selected_provider', value)}
                          disabled={parametersLocked}
                          loading={providersLoading}
                          renderInput={(params) => (
                            <TextField 
                              {...params} 
                              label="Extranet Provider (Optional)" 
                              size="small"
                              placeholder="Select or leave blank for manual entry"
                              InputProps={{
                                ...params.InputProps,
                                startAdornment: (
                                  <>
                                    <InputAdornment position="start"><StorefrontIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>
                                    {params.InputProps.startAdornment}
                                  </>
                                )
                              }}
                            />
                          )}
                        />
                      </Grid>
                    )}

                    {/* Product Selection (optional, shown after provider) */}
                    {formData.selected_provider && (
                      <Grid item xs={12}>
                        <Autocomplete
                          options={availableProducts}
                          getOptionLabel={(option) => `${option.product_name}${option.isf ? ` (ISF: ${option.isf})` : ''}`}
                          value={formData.selected_product}
                          onChange={(e, value) => handleInputChange('selected_product', value)}
                          disabled={parametersLocked}
                          loading={productsLoading}
                          renderInput={(params) => (
                            <TextField 
                              {...params} 
                              label="Product (Optional)" 
                              size="small"
                              placeholder="Select a product to auto-populate locations"
                            />
                          )}
                          renderOption={(props, option) => (
                            <li {...props} key={option.id}>
                              <Box sx={{ width: '100%' }}>
                                <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>{option.product_name}</Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                  {option.isf && <Chip label={`ISF: ${option.isf}`} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />}
                                  {option.suggested_bandwidth && <Chip label={`${option.suggested_bandwidth}Mb`} size="small" color="info" variant="outlined" sx={{ fontSize: '0.65rem' }} />}
                                  {option.primary_datacenter && <Chip label={option.primary_datacenter} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />}
                                </Box>
                              </Box>
                            </li>
                          )}
                        />
                      </Grid>
                    )}

                    {/* ISF display (if product selected) */}
                    {formData.isf && (
                      <Grid item xs={12}>
                        <Alert severity="info" sx={{ py: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>ISF: {formData.isf}</Typography>
                        </Alert>
                      </Grid>
                    )}

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
                      {formData.selected_product && (
                        <Typography variant="caption" color="text.secondary">
                          Auto-populated from product. You can override manually.
                        </Typography>
                      )}
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
                      <TextField
                        fullWidth
                        size="small"
                        label="Member Customer Name"
                        value={formData.customer_name}
                        onChange={(e) => handleInputChange('customer_name', e.target.value)}
                        disabled={parametersLocked || basketItems.length > 0}
                        placeholder="Enter customer name"
                        helperText={basketItems.length > 0 ? 'Locked — shared across all basket items' : ''}
                      />
                    </Grid>
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
                        autoHighlight={false}
                        autoSelect={false}
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
                      <Tooltip title={basketItems.length > 0 ? 'Locked - all basket items share the same contract term' : ''}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Contract Term *</InputLabel>
                          <Select
                            value={formData.contract_term}
                            onChange={(e) => handleInputChange('contract_term', e.target.value)}
                            label="Contract Term *"
                            disabled={parametersLocked || basketItems.length > 0}
                          >
                            <MenuItem value={12}>12 Months</MenuItem>
                            <MenuItem value={24}>24 Months</MenuItem>
                            <MenuItem value={36}>36 Months</MenuItem>
                          </Select>
                        </FormControl>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Tooltip title={basketItems.length > 0 ? 'Locked - all basket items share the same currency' : ''}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Currency *</InputLabel>
                          <Select
                            value={formData.currency_requested}
                            onChange={(e) => handleInputChange('currency_requested', e.target.value)}
                            label="Currency *"
                            disabled={parametersLocked || basketItems.length > 0}
                          >
                            {currencies.map(curr => (
                              <MenuItem key={curr.currency_code} value={curr.currency_code}>
                                {curr.currency_code}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Tooltip>
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

                {/* Bundle Info */}
                {basketItems.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <SectionHeader icon={ShoppingCartIcon} title="Shopping Basket" color="success" />
                    <Alert severity="info" sx={{ mb: 1 }}>
                      <Typography variant="body2">
                        <strong>{basketItems.length} item(s)</strong> in basket. Contract term and currency are locked to the first item's values.
                        Discount will be applied when basket is completed.
                      </Typography>
                    </Alert>
                    <Typography variant="caption" color="text.secondary">
                      Max MRC discount available: <strong>{getMaxBundleDiscount()}%</strong> (based on {basketItems.length} item{basketItems.length !== 1 ? 's' : ''} — Tier {basketItems.length > (bundleTiers.tier_2_max || 5) ? '3' : basketItems.length > (bundleTiers.tier_1_max || 3) ? '2' : '1'}: {basketItems.length > (bundleTiers.tier_2_max || 5) ? `${(bundleTiers.tier_2_max || 5) + 1}+` : basketItems.length > (bundleTiers.tier_1_max || 3) ? `${(bundleTiers.tier_1_max || 3) + 1}–${bundleTiers.tier_2_max || 5}` : `1–${bundleTiers.tier_1_max || 3}`} items)
                    </Typography>
                  </Box>
                )}
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <AddShoppingCartIcon />}
                    onClick={handleCalculateAndAddToBasket}
                    disabled={loading || !formData.provider_primary_city || !formData.member_primary_city || !formData.bandwidth || !formData.member_resiliency || !formData.provider_region || (bundleResult !== null)}
                    sx={{ 
                      px: 4,
                      background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                      '&:hover': {
                        background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                      }
                    }}
                  >
                    {loading ? 'Calculating...' : 'Calculate & Add to Basket'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Shopping Basket Accordion */}
        {basketItems.length > 0 && (
          <Accordion 
            expanded={expandedAccordion === 'basket'} 
            onChange={() => setExpandedAccordion(expandedAccordion === 'basket' ? '' : 'basket')}
            sx={{ mb: 2 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Badge badgeContent={basketItems.length} color="primary">
                  <ShoppingCartIcon />
                </Badge>
                <Typography variant="h6" sx={{ fontSize: '1rem', ml: 1 }}>
                  Shopping Basket ({basketItems.length} item{basketItems.length !== 1 ? 's' : ''})
                </Typography>
                {bundleResult && <Chip label="Completed" size="small" color="success" sx={{ ml: 1 }} />}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {/* Basket Items Table */}
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'grey.100' }}>
                      <TableCell><strong>#</strong></TableCell>
                      <TableCell><strong>Provider</strong></TableCell>
                      <TableCell><strong>Product / ISF</strong></TableCell>
                      <TableCell><strong>Provider City</strong></TableCell>
                      <TableCell><strong>Member City</strong></TableCell>
                      <TableCell><strong>BW</strong></TableCell>
                      <TableCell><strong>Resiliency</strong></TableCell>
                      <TableCell align="right"><strong>MRC</strong></TableCell>
                      <TableCell align="right"><strong>NRC</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      {!bundleResult && <TableCell></TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {basketItems.map((item, idx) => {
                      const snap = item.formSnapshot;
                      const bItem = bundleResult?.items?.[idx];
                      return (
                        <TableRow key={item.id} hover>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {snap.provider_name || 'Manual'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {snap.product_name || '-'}
                            </Typography>
                            {snap.isf && (
                              <Chip label={`ISF: ${snap.isf}`} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {snap.provider_primary_city?.city_name || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {snap.member_primary_city?.city_name || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{snap.bandwidth}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={snap.member_resiliency} size="small" sx={{ fontSize: '0.6rem' }} />
                          </TableCell>
                          <TableCell align="right">
                            {item.poa ? (
                              <Chip label="POA" size="small" color="warning" />
                            ) : bItem?.pricing ? (
                              <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'success.main' }}>
                                {formatCurrency(bItem.pricing.mrc, bItem.pricing.currency)}
                              </Typography>
                            ) : item.result?.pricing ? (
                              <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                {formatCurrency(item.result.pricing.mrc, item.result.pricing.currency)}
                              </Typography>
                            ) : '-'}
                          </TableCell>
                          <TableCell align="right">
                            {item.poa ? '-' : bItem?.pricing ? (
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                {formatCurrency(bItem.pricing.nrc, bItem.pricing.currency)}
                              </Typography>
                            ) : item.result?.pricing ? (
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                {formatCurrency(item.result.pricing.nrc, item.result.pricing.currency)}
                              </Typography>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {item.poa ? (
                              <Chip label="POA" size="small" color="warning" />
                            ) : bundleResult ? (
                              <Chip label="Priced" size="small" color="success" />
                            ) : (
                              <Chip label="Pending" size="small" color="info" />
                            )}
                          </TableCell>
                          {!bundleResult && (
                            <TableCell>
                              <IconButton size="small" color="error" onClick={() => handleRemoveFromBasket(item.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Add Additional Connection button (only before completing) */}
              {!bundleResult && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={() => {
                      setExpandedAccordion('form');
                      setParametersLocked(false);
                    }}
                    sx={{ borderStyle: 'dashed', px: 4, py: 1 }}
                  >
                    Add Additional Connection
                  </Button>
                </Box>
              )}

              {/* Bundle Discount Selection (only before completing) */}
              {!bundleResult && (
                <Card variant="outlined" sx={{ p: 2, mb: 2, backgroundColor: (theme) => alpha(theme.palette.success.main, 0.04) }}>
                  <SectionHeader icon={DiscountIcon} title="Apply Bundle Discount" color="success" />
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Items: <strong>{basketItems.length}</strong> | Max MRC Discount: <strong>{getMaxBundleDiscount()}%</strong>
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>MRC Discount %</InputLabel>
                        <Select
                          value={selectedBundleDiscount}
                          onChange={(e) => setSelectedBundleDiscount(e.target.value)}
                          label="MRC Discount %"
                        >
                          <MenuItem value="">No Discount</MenuItem>
                          {Array.from({ length: Math.floor(getMaxBundleDiscount() / 5) + 1 }, (_, i) => i * 5).filter(v => v > 0 && v <= getMaxBundleDiscount()).map(pct => (
                            <MenuItem key={pct} value={pct}>{pct}%</MenuItem>
                          ))}
                          {!Array.from({ length: Math.floor(getMaxBundleDiscount() / 5) + 1 }, (_, i) => i * 5).includes(getMaxBundleDiscount()) && (
                            <MenuItem value={getMaxBundleDiscount()}>{getMaxBundleDiscount()}%</MenuItem>
                          )}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Button
                        variant="contained"
                        color="success"
                        fullWidth
                        startIcon={bundleLoading ? <CircularProgress size={20} color="inherit" /> : <CalculateIcon />}
                        onClick={handleCompleteBasket}
                        disabled={bundleLoading || basketItems.length === 0}
                        sx={{ height: 40 }}
                      >
                        {bundleLoading ? 'Calculating...' : 'Complete Basket & Apply Discount'}
                      </Button>
                    </Grid>
                  </Grid>
                </Card>
              )}

              {/* Bundle Totals (after completing) */}
              {bundleResult && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card 
                      sx={{ 
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        overflow: 'hidden',
                        height: '100%'
                      }}
                    >
                      {/* Bundle Result Header */}
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
                          Bundle Pricing
                        </Typography>
                      </Box>
                      
                      <CardContent sx={{ p: 3 }}>
                        {/* Total MRC */}
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
                              Total Monthly Recurring Charge (MRC)
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
                            {formatCurrency(bundleResult.bundle_pricing.total_mrc, bundleResult.bundle_pricing.currency)}
                          </Typography>
                          {bundleResult.bundle_pricing.mrc_discount_percent > 0 && (
                            <Chip
                              label={`${bundleResult.bundle_pricing.mrc_discount_percent}% bundle discount applied`}
                              size="small"
                              color="success"
                              sx={{ mt: 1 }}
                            />
                          )}
                        </Box>

                        {/* Total NRC */}
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
                              Total Non-Recurring Charge (NRC)
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
                            {formatCurrency(bundleResult.bundle_pricing.total_nrc, bundleResult.bundle_pricing.currency)}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Right Column - Bundle Breakdown */}
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                          Bundle Breakdown (USD)
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
                            <span>Items in Bundle:</span>
                            <span style={{ fontWeight: 500 }}>{basketItems.length}</span>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                            <span>MRC Before Discount:</span>
                            <span style={{ fontWeight: 500 }}>${(bundleResult.breakdown?.total_mrc_usd_before_discount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </Box>
                          {bundleResult.breakdown?.mrc_bundle_discount_applied_usd > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, color: 'success.main' }}>
                              <span>MRC Discount ({bundleResult.bundle_pricing.mrc_discount_percent}%):</span>
                              <span style={{ fontWeight: 600 }}>-${(bundleResult.breakdown.mrc_bundle_discount_applied_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </Box>
                          )}
                          {bundleResult.bundle_pricing.exchange_rate !== 1 && (
                            <>
                              <Divider sx={{ my: 1 }} />
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                <span>Exchange Rate (USD → {bundleResult.bundle_pricing.currency}):</span>
                                <span style={{ fontWeight: 500 }}>{bundleResult.bundle_pricing.exchange_rate}</span>
                              </Box>
                            </>
                          )}
                          <Divider sx={{ my: 1 }} />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, fontWeight: 'bold', color: 'text.primary' }}>
                            <span>Final Bundle MRC ({bundleResult.bundle_pricing.currency}):</span>
                            <span>{formatCurrency(bundleResult.bundle_pricing.total_mrc, bundleResult.bundle_pricing.currency)}</span>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, fontWeight: 'bold', color: 'text.primary' }}>
                            <span>Final Bundle NRC ({bundleResult.bundle_pricing.currency}):</span>
                            <span>{formatCurrency(bundleResult.bundle_pricing.total_nrc, bundleResult.bundle_pricing.currency)}</span>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Export and New Basket Buttons */}
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                      <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleExportToFile}
                      >
                        Export Bundle to File
                      </Button>
                      <Button
                        variant="outlined"
                        color="warning"
                        startIcon={<RefreshIcon />}
                        onClick={handleRefresh}
                      >
                        New Basket
                      </Button>
                    </Box>
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
              )}
            </AccordionDetails>
          </Accordion>
        )}

        {/* Placeholder when basket is empty */}
        {basketItems.length === 0 && !error && expandedAccordion !== 'form' && (
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
              <ShoppingCartIcon sx={{ fontSize: 40, color: 'grey.400' }} />
            </Box>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              Your Basket is Empty
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Enter provider and member details, then click "Calculate & Add to Basket" to start building your pricing bundle
            </Typography>
          </Card>
        )}
      </TabPanel>

      {/* Pricing Logs Tab */}
      {canViewLogs && (
        <TabPanel value={currentTab} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">Pricing Logs</Typography>
              {!canViewAllLogs && (
                <Chip label="Your Logs Only" size="small" color="warning" variant="outlined" />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip 
                label={`Showing ${pricingLogs.length} of ${pagination.total} entries (Page ${pagination.page}/${pagination.totalPages || 1})`} 
                color="info" 
                size="small"
              />
              {canViewAllLogs && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleExportLogs}
                  startIcon={<DownloadIcon />}
                >
                  Export CSV
                </Button>
              )}
              {canManageLogs && (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={handleClearLogs}
                  startIcon={<DeleteIcon />}
                >
                  Clear Logs
                </Button>
              )}
            </Box>
          </Box>

          {/* Search and Filter Controls */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                {canViewAllLogs && (
                  <Grid item xs={12} sm={6} md={3}>
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
                )}
                
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Customer Name"
                    value={customerNameFilter}
                    onChange={(e) => { setCustomerNameFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                    placeholder="Search customer..."
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
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
                
                <Grid item xs={12} sm={6} md={3}>
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
                
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Start Date"
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => { setStartDateFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="End Date"
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => { setEndDateFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
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
                    <TableCell sx={{ width: 30 }}></TableCell>
                    <TableCell><strong>Type</strong></TableCell>
                    <TableCell><strong>Timestamp</strong></TableCell>
                    <TableCell><strong>User</strong></TableCell>
                    <TableCell><strong>Customer</strong></TableCell>
                    <TableCell><strong>Provider City</strong></TableCell>
                    <TableCell><strong>Member City</strong></TableCell>
                    <TableCell><strong>Resiliency</strong></TableCell>
                    <TableCell><strong>Bandwidth</strong></TableCell>
                    <TableCell><strong>Term</strong></TableCell>
                    <TableCell><strong>Discount</strong></TableCell>
                    <TableCell align="right"><strong>MRC</strong></TableCell>
                    <TableCell align="right"><strong>NRC</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pricingLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No pricing logs found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pricingLogs.map((log) => {
                      if (log.log_type === 'bundle') {
                        // Bundle row (expandable)
                        const isExpanded = expandedBundles[log.id] || false;
                        return (
                          <React.Fragment key={`bundle-${log.id}`}>
                            <TableRow 
                              hover 
                              onClick={() => toggleBundleExpand(log.id)}
                              sx={{ 
                                cursor: 'pointer',
                                backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.04),
                                '&:hover': { backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08) }
                              }}
                            >
                              <TableCell sx={{ width: 30, px: 1 }}>
                                <IconButton size="small" sx={{ p: 0 }}>
                                  {isExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                                </IconButton>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  icon={<ShoppingBasketIcon sx={{ fontSize: '0.85rem !important' }} />}
                                  label={`Bundle (${log.item_count} items)`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem' }}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                  {new Date(log.created_at).toLocaleString()}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                  {log.username || log.full_name || 'Unknown'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                  {log.customer_name || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell colSpan={2}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem', fontStyle: 'italic' }}>
                                  {log.item_count} connections — click to expand
                                </Typography>
                              </TableCell>
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                  {log.contract_term}m
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {log.mrc_discount_percent > 0 ? (
                                  <Chip 
                                    label={`${log.mrc_discount_percent}%`} 
                                    size="small" 
                                    color="success"
                                    sx={{ fontSize: '0.65rem' }}
                                  />
                                ) : (
                                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>-</Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'primary.main' }}>
                                  {log.currency || 'USD'} {roundUpToNearest5(log.total_mrc || 0).toLocaleString()}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                  {log.currency || 'USD'} {roundUpToNearest5(log.total_nrc || 0).toLocaleString()}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Tooltip title="Reload basket — re-price with a different discount">
                                  <IconButton 
                                    size="small" 
                                    color="primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReloadBasket(log);
                                    }}
                                    sx={{ p: 0.5 }}
                                  >
                                    <ReplayIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                            {/* Expanded bundle items */}
                            {isExpanded && log.items && log.items.map((item, idx) => {
                              const itemBreakdown = canManageLogs ? parseBreakdown(item.calculation_breakdown) : null;
                              return (
                                <React.Fragment key={`bundle-${log.id}-item-${item.id || idx}`}>
                                  <TableRow 
                                    sx={{ backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.02) }}
                                  >
                                    <TableCell></TableCell>
                                    <TableCell>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Box sx={{ width: 16, borderLeft: '2px solid', borderBottom: '2px solid', borderColor: 'divider', height: 12, ml: 1 }} />
                                        <Typography variant="body2" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                          Item {idx + 1}
                                        </Typography>
                                        {item.provider_name && (
                                          <Chip label={item.provider_name} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                                        )}
                                      </Box>
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                        {new Date(item.lookup_timestamp).toLocaleString()}
                                      </Typography>
                                    </TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                    <TableCell>
                                      <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                                        {item.provider_primary_city}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                                        {item.member_primary_city}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Chip label={item.member_resiliency} size="small" sx={{ fontSize: '0.6rem', height: 18 }} />
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                                        {item.bandwidth}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                                        {item.contract_term}m
                                      </Typography>
                                    </TableCell>
                                    <TableCell></TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                                        {item.currency_requested} {roundUpToNearest5(item.final_mrc || 0).toLocaleString()}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                                        {item.currency_requested} {roundUpToNearest5(item.final_nrc || 0).toLocaleString()}
                                      </Typography>
                                    </TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                  {/* Admin only: Inline calculation breakdown JSON */}
                                  {canManageLogs && itemBreakdown && (
                                    <TableRow sx={{ backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.06) }}>
                                      <TableCell></TableCell>
                                      <TableCell colSpan={13}>
                                        <Box sx={{ pl: 4 }}>
                                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                            Calculation Breakdown (JSON)
                                          </Typography>
                                          <Box
                                            component="pre"
                                            sx={{
                                              fontSize: '0.65rem',
                                              backgroundColor: 'grey.100',
                                              border: '1px solid',
                                              borderColor: 'grey.300',
                                              borderRadius: 1,
                                              p: 1.5,
                                              m: 0,
                                              maxHeight: 300,
                                              overflow: 'auto',
                                              whiteSpace: 'pre-wrap',
                                              wordBreak: 'break-word',
                                              fontFamily: 'monospace'
                                            }}
                                          >
                                            {JSON.stringify(itemBreakdown, null, 2)}
                                          </Box>
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      }
                      
                      // Individual log row
                      const individualBreakdown = canManageLogs ? parseBreakdown(log.calculation_breakdown) : null;
                      const isIndividualExpanded = canManageLogs && expandedBundles[`ind-${log.id}`];
                      return (
                        <React.Fragment key={`log-${log.id}`}>
                          <TableRow 
                            hover
                            onClick={canManageLogs ? () => setExpandedBundles(prev => ({ ...prev, [`ind-${log.id}`]: !prev[`ind-${log.id}`] })) : undefined}
                            sx={{ cursor: canManageLogs ? 'pointer' : 'default' }}
                          >
                            <TableCell sx={{ width: 30, px: 1 }}>
                              {canManageLogs && individualBreakdown && (
                                <IconButton size="small" sx={{ p: 0 }}>
                                  {isIndividualExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                                </IconButton>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label="Individual"
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.65rem' }}
                              />
                            </TableCell>
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
                                {log.customer_name || '-'}
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
                                {log.contract_term}m
                              </Typography>
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
                            <TableCell></TableCell>
                          </TableRow>
                          {/* Admin only: Inline calculation breakdown JSON */}
                          {isIndividualExpanded && individualBreakdown && (
                            <TableRow sx={{ backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.06) }}>
                              <TableCell></TableCell>
                              <TableCell colSpan={13}>
                                <Box sx={{ pl: 2 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                    Calculation Breakdown (JSON)
                                  </Typography>
                                  <Box
                                    component="pre"
                                    sx={{
                                      fontSize: '0.65rem',
                                      backgroundColor: 'grey.100',
                                      border: '1px solid',
                                      borderColor: 'grey.300',
                                      borderRadius: 1,
                                      p: 1.5,
                                      m: 0,
                                      maxHeight: 300,
                                      overflow: 'auto',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                      fontFamily: 'monospace'
                                    }}
                                  >
                                    {JSON.stringify(individualBreakdown, null, 2)}
                                  </Box>
                                </Box>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
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
