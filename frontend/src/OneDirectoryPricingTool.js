import React, { useState, useEffect } from 'react';
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
import SettingsIcon from '@mui/icons-material/Settings';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DownloadIcon from '@mui/icons-material/Download';
import InfoIcon from '@mui/icons-material/Info';
import HistoryIcon from '@mui/icons-material/History';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import CustomerAutocomplete from './CustomerAutocomplete';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import PhoneIcon from '@mui/icons-material/Phone';
import GroupIcon from '@mui/icons-material/Group';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SpeedIcon from '@mui/icons-material/Speed';
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

const OneDirectoryPricingTool = () => {
  const { user } = useAuth();
  const [logsPermissionLevel, setLogsPermissionLevel] = useState('read_only'); // read_only | provisioner | admin

  // Tab state
  const [currentTab, setCurrentTab] = useState(0);

  // Form state
  const [formData, setFormData] = useState(() => {
    const savedCurrency = sessionStorage.getItem('oneDirectoryCurrency');
    return {
      customer_name: '',
      customer_id: null,
      directory_users: '',
      customer_location: null,
      member_resiliency: '',
      member_on_off_net: 'On Net',
      b2b_agility: false,
      safe_connect_required: false,
      safe_connect_bandwidth: '',
      contract_term: 12,
      currency_requested: savedCurrency || 'USD',
      growth_percentage: ''
    };
  });

  // The admin-configured Growth % default, used to pre-fill the quote form and as the
  // value form resets fall back to. Updated once /voice/one-directory/parameters loads.
  const [defaultGrowthPercentage, setDefaultGrowthPercentage] = useState(20);

  // Standalone Bandwidth Calculator tab state
  const [bwCalcUsers, setBwCalcUsers] = useState('');
  const [bwCalcOnOffNet, setBwCalcOnOffNet] = useState('On Net');
  const [bwCalcGrowth, setBwCalcGrowth] = useState('');
  const [bwCalcResult, setBwCalcResult] = useState(null);
  const [bwCalcLoading, setBwCalcLoading] = useState(false);
  const [bwCalcError, setBwCalcError] = useState('');

  // Data states
  const [cities, setCities] = useState([]);
  const [currencies, setCurrencies] = useState([{ currency_code: 'USD', currency_name: 'US Dollar' }]);
  const [safeConnectOptions, setSafeConnectOptions] = useState(['3Mb', '5Mb', '10Mb']);

  // Shopping basket states — restore from sessionStorage on mount
  const [basketItems, setBasketItems] = useState(() => {
    try {
      const saved = sessionStorage.getItem('oneDirectoryBasket');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [bundleResult, setBundleResult] = useState(() => {
    try {
      const saved = sessionStorage.getItem('oneDirectoryBundleResult');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [bundleLoading, setBundleLoading] = useState(false);
  const [expandedBasketItems, setExpandedBasketItems] = useState({});

  const toggleBasketItemExpanded = (itemId) => {
    setExpandedBasketItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // Persist basket to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem('oneDirectoryBasket', JSON.stringify(basketItems));
    } catch { /* ignore quota errors */ }
  }, [basketItems]);

  useEffect(() => {
    try {
      if (bundleResult) {
        sessionStorage.setItem('oneDirectoryBundleResult', JSON.stringify(bundleResult));
      } else {
        sessionStorage.removeItem('oneDirectoryBundleResult');
      }
    } catch { /* ignore */ }
  }, [bundleResult]);

  // Persist currency selection when basket has items
  useEffect(() => {
    if (basketItems.length > 0) {
      sessionStorage.setItem('oneDirectoryCurrency', formData.currency_requested);
    }
  }, [formData.currency_requested, basketItems.length]);

  // Pricing logs states
  const [pricingLogs, setPricingLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [customerNameFilter, setCustomerNameFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [expandedBundles, setExpandedBundles] = useState({});
  const [expandedLogItems, setExpandedLogItems] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 0
  });

  // UI states
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingItemId, setEditingItemId] = useState(null);
  const [expandedAccordion, setExpandedAccordion] = useState(() => {
    try {
      const saved = sessionStorage.getItem('oneDirectoryBasket');
      const items = saved ? JSON.parse(saved) : [];
      return items.length > 0 ? 'basket' : 'form';
    } catch { return 'form'; }
  });

  // Pricing terms for display and export
  const pricingTerms = [
    'Pricing is strictly budgetary, subject to site survey and official pricing confirmation.',
    'All terms are subject to MSA terms and conditions.',
    'All Pricing is exclusive of any applicable Taxes and Surcharges.',
    'Customer must provide all necessary rack space and power supply.',
    'Any additional 3rd Party costs incurred on order of the service will be chargeable to the customer.',
    'Pricing is for connectivity only and does not include any fees associated with data feeds.',
    'Pricing valid for 30 days from issuance.'
  ];

  // Resiliency options
  const resiliencyOptions = [
    'Non-Resilient',
    'Single Site Resilient'
  ];

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load pricing logs when tab changes to logs (admin only)
  useEffect(() => {
    if (currentTab === 1) {
      loadPricingLogs();
      if (logsPermissionLevel !== 'read_only') {
        loadUsersListForFilter();
      }
    }
  }, [currentTab, pagination.page, pagination.limit, selectedUser, customerNameFilter, startDateFilter, endDateFilter, logsPermissionLevel]);

  const loadInitialData = async () => {
    try {
      setInitialLoading(true);

      const authHeader = { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` };

      const [citiesRes, currenciesRes, parametersRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/voice/one-directory/cities`, { headers: authHeader }),
        axios.get(`${API_BASE_URL}/voice/one-directory/currencies`, { headers: authHeader }),
        axios.get(`${API_BASE_URL}/voice/one-directory/parameters`, { headers: authHeader })
      ]);

      if (citiesRes.status === 'fulfilled') {
        setCities(citiesRes.value.data);
      } else {
        console.warn('Could not load cities:', citiesRes.reason?.message);
      }

      if (currenciesRes.status === 'fulfilled') {
        const currencyData = currenciesRes.value.data || [];
        if (!currencyData.some(c => c.currency_code === 'USD')) {
          currencyData.unshift({ currency_code: 'USD', currency_name: 'US Dollar' });
        }
        setCurrencies(currencyData);
      } else {
        console.warn('Could not load currencies:', currenciesRes.reason?.message);
      }

      // Parse safe connect options from parameters
      if (parametersRes.status === 'fulfilled' && parametersRes.value.data?.safe_connect_bandwidths?.value) {
        try {
          const parsed = JSON.parse(parametersRes.value.data.safe_connect_bandwidths.value);
          if (Array.isArray(parsed)) setSafeConnectOptions(parsed);
        } catch (e) { /* use defaults */ }
      } else if (parametersRes.status === 'rejected') {
        console.warn('Could not load parameters:', parametersRes.reason?.message);
      }

      // Pick up the admin-configured Growth % default and pre-fill the quote form with it
      if (parametersRes.status === 'fulfilled' && parametersRes.value.data?.growth_percentage?.value !== undefined) {
        const adminGrowthDefault = parseFloat(parametersRes.value.data.growth_percentage.value);
        if (!isNaN(adminGrowthDefault)) {
          setDefaultGrowthPercentage(adminGrowthDefault);
          setFormData(prev => ({ ...prev, growth_percentage: prev.growth_percentage === '' ? adminGrowthDefault : prev.growth_percentage }));
          setBwCalcGrowth(prev => prev === '' ? adminGrowthDefault : prev);
        }
      }

      const allFailed = [citiesRes, currenciesRes, parametersRes].every(r => r.status === 'rejected');
      if (allFailed) {
        setError('Failed to load pricing data. Please refresh and try again.');
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError('Failed to load initial data: ' + err.message);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadPricingLogs = async () => {
    try {
      setLogsLoading(true);
      const params = new URLSearchParams({
        limit: pagination.limit,
        offset: (pagination.page - 1) * pagination.limit
      });
      if (selectedUser && logsPermissionLevel !== 'read_only') params.append('user_id', selectedUser);
      if (customerNameFilter) params.append('customer_name', customerNameFilter);
      if (startDateFilter) params.append('start_date', startDateFilter);
      if (endDateFilter) params.append('end_date', endDateFilter);

      const response = await axios.get(`${API_BASE_URL}/voice/one-directory/logs?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });

      setPricingLogs(response.data.data || []);
      if (response.data.permission_level) {
        setLogsPermissionLevel(response.data.permission_level);
      }
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
    try {
      const response = await axios.get(`${API_BASE_URL}/extranet-pricing/users`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      setUsersList(response.data || []);
    } catch (err) {
      console.error('Error loading users list:', err);
    }
  };

  // Round up to nearest $5
  const roundUpToNearest5 = (amount) => Math.ceil(amount / 5) * 5;

  const formatCurrency = (amount, currency) => {
    const roundedAmount = roundUpToNearest5(amount);
    const symbols = {
      'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CHF': 'CHF ',
      'AUD': 'A$', 'CAD': 'C$', 'SGD': 'S$', 'HKD': 'HK$'
    };
    const symbol = symbols[currency] || currency + ' ';
    return `${symbol}${roundedAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Exact (non-rounded) currency formatter - used in the Pricing Logs tab for item/service
  // rows so they reconcile precisely; only the top-level bundle total is intentionally
  // rounded up to the nearest $5 as a "nice number" headline figure.
  const formatExactCurrency = (amount, currency) => {
    if (amount == null || isNaN(amount)) return '-';
    const symbols = {
      'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CHF': 'CHF ',
      'AUD': 'A$', 'CAD': 'C$', 'SGD': 'S$', 'HKD': 'HK$'
    };
    const symbol = symbols[currency] || currency + ' ';
    return `${symbol}${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

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

  const handleCalculateAndAddToBasket = async () => {
    if (!formData.customer_location) {
      setError('Please select a customer location');
      return;
    }
    if (!formData.member_resiliency) {
      setError('Please select a resiliency type');
      return;
    }
    if (!formData.directory_users || parseInt(formData.directory_users) <= 0) {
      setError('Please enter number of directory users');
      return;
    }
    if (formData.safe_connect_required && !formData.safe_connect_bandwidth) {
      setError('Please select a Safe Connect bandwidth');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/voice/one-directory/calculate`, {
        directory_users: parseInt(formData.directory_users),
        customer_location: formData.customer_location?.city_name,
        member_resiliency: formData.member_resiliency,
        member_on_off_net: formData.member_on_off_net,
        b2b_agility: formData.b2b_agility,
        safe_connect_bandwidth: formData.safe_connect_required ? formData.safe_connect_bandwidth : null,
        contract_term: formData.contract_term,
        currency_requested: formData.currency_requested,
        growth_percentage: formData.growth_percentage !== '' ? parseFloat(formData.growth_percentage) : undefined
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      const newItem = {
        id: editingItemId || Date.now(),
        formSnapshot: { ...formData },
        result: response.data,
        poa: false
      };

      if (editingItemId) {
        setBasketItems(prev => prev.map(item => item.id === editingItemId ? newItem : item));
        setEditingItemId(null);
        setSuccess('Item updated in basket');
      } else {
        setBasketItems(prev => [...prev, newItem]);
        setSuccess(`Item added to basket (${basketItems.length + 1} items total)`);
      }
      setBundleResult(null);

      // Reset form for next item (keep currency and customer name)
      setFormData(prev => ({
        ...prev,
        directory_users: '',
        customer_location: null,
        member_resiliency: '',
        member_on_off_net: 'On Net',
        b2b_agility: false,
        safe_connect_required: false,
        safe_connect_bandwidth: '',
        growth_percentage: defaultGrowthPercentage
      }));
      setExpandedAccordion('basket');
    } catch (err) {
      if (err.response?.data?.poa) {
        const poaItem = {
          id: editingItemId || Date.now(),
          formSnapshot: { ...formData },
          result: err.response.data,
          poa: true,
          poaMessage: err.response.data.error
        };
        if (editingItemId) {
          setBasketItems(prev => prev.map(item => item.id === editingItemId ? poaItem : item));
          setEditingItemId(null);
          setSuccess('Item updated in basket (POA - Price On Application)');
        } else {
          setBasketItems(prev => [...prev, poaItem]);
          setSuccess('Item added to basket (POA - Price On Application)');
        }
        setBundleResult(null);

        setFormData(prev => ({
          ...prev,
          directory_users: '',
          customer_location: null,
          member_resiliency: '',
          member_on_off_net: 'On Net',
          b2b_agility: false,
          safe_connect_required: false,
          safe_connect_bandwidth: '',
          growth_percentage: defaultGrowthPercentage
        }));
        setExpandedAccordion('basket');
      } else {
        setError(err.response?.data?.error || 'Failed to calculate pricing');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateBandwidth = async () => {
    if (!bwCalcUsers || parseInt(bwCalcUsers) <= 0) {
      setBwCalcError('Please enter number of users');
      return;
    }

    setBwCalcLoading(true);
    setBwCalcError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/voice/one-directory/calculate-bandwidth`, {
        directory_users: parseInt(bwCalcUsers),
        growth_percentage: bwCalcGrowth !== '' ? parseFloat(bwCalcGrowth) : undefined,
        member_on_off_net: bwCalcOnOffNet
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      setBwCalcResult(response.data);
    } catch (err) {
      setBwCalcError(err.response?.data?.error || 'Failed to calculate bandwidth');
      setBwCalcResult(null);
    } finally {
      setBwCalcLoading(false);
    }
  };

  const handleRemoveFromBasket = (itemId) => {
    setBasketItems(prev => prev.filter(item => item.id !== itemId));
    setBundleResult(null);
    if (editingItemId === itemId) {
      setEditingItemId(null);
    }
  };

  const handleEditBasketItem = (item) => {
    // Populate the form with the item's snapshot data
    setFormData({
      ...item.formSnapshot,
      // Ensure customer_location object is restored correctly
      customer_location: item.formSnapshot.customer_location
    });
    setEditingItemId(item.id);
    setBundleResult(null);
    setExpandedAccordion('form');
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setFormData(prev => ({
      ...prev,
      directory_users: '',
      customer_location: null,
      member_resiliency: '',
      member_on_off_net: 'On Net',
      b2b_agility: false,
      safe_connect_required: false,
      safe_connect_bandwidth: '',
      growth_percentage: defaultGrowthPercentage
    }));
  };

  const handleCompleteBasket = async () => {
    if (basketItems.length === 0) {
      setError('Add at least one item to the basket');
      return;
    }

    const numericItems = basketItems.filter(item => !item.poa);
    if (numericItems.length === 0) {
      setError('All items are POA - cannot calculate bundle pricing');
      return;
    }

    setBundleLoading(true);
    setError('');

    try {
      const items = basketItems.map(item => ({
        directory_users: parseInt(item.formSnapshot.directory_users),
        customer_location: item.formSnapshot.customer_location?.city_name,
        member_resiliency: item.formSnapshot.member_resiliency,
        member_on_off_net: item.formSnapshot.member_on_off_net,
        b2b_agility: item.formSnapshot.b2b_agility,
        safe_connect_bandwidth: item.formSnapshot.safe_connect_required ? item.formSnapshot.safe_connect_bandwidth : null,
        contract_term: item.formSnapshot.contract_term,
        growth_percentage: item.formSnapshot.growth_percentage !== '' && item.formSnapshot.growth_percentage !== undefined
          ? parseFloat(item.formSnapshot.growth_percentage)
          : undefined
      }));

      const response = await axios.post(`${API_BASE_URL}/voice/one-directory/calculate-bundle`, {
        items,
        currency_requested: formData.currency_requested,
        customer_name: formData.customer_name || basketItems[0]?.formSnapshot?.customer_name || null,
        customer_id: formData.customer_id || basketItems[0]?.formSnapshot?.customer_id || null
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      setBundleResult(response.data);
      setExpandedAccordion('basket');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to calculate bundle pricing');
    } finally {
      setBundleLoading(false);
    }
  };

  const handleRefresh = () => {
    setFormData({
      customer_name: '',
      customer_id: null,
      directory_users: '',
      customer_location: null,
      member_resiliency: '',
      member_on_off_net: 'On Net',
      b2b_agility: false,
      safe_connect_required: false,
      safe_connect_bandwidth: '',
      contract_term: 12,
      currency_requested: 'USD',
      growth_percentage: defaultGrowthPercentage
    });
    setBasketItems([]);
    setBundleResult(null);
    setEditingItemId(null);
    setError('');
    setExpandedAccordion('form');
    sessionStorage.removeItem('oneDirectoryBasket');
    sessionStorage.removeItem('oneDirectoryBundleResult');
    sessionStorage.removeItem('oneDirectoryCurrency');
  };

  const handleExportToFile = () => {
    if (!bundleResult && basketItems.length === 0) return;

    const currency = formData.currency_requested || 'USD';
    const customerName = formData.customer_name || basketItems[0]?.formSnapshot?.customer_name || '';

    const escapeCsv = (val) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [];

    rows.push(['One Directory Pricing Bundle Quote']);
    rows.push(['Generated', new Date().toLocaleString()]);
    if (customerName) rows.push(['Customer', customerName]);
    rows.push(['Currency', currency]);
    if (bundleResult) {
      rows.push(['Total Items', bundleResult.bundle.item_count]);
      rows.push(['Bundle Total MRC', formatCurrency(bundleResult.bundle.total_mrc, currency)]);
      rows.push(['Bundle Total NRC', formatCurrency(bundleResult.bundle.total_nrc, currency)]);
      if (bundleResult.bundle.has_poa_items) rows.push(['Note', 'Some items are POA (Price On Application)']);
    }
    rows.push([]);

    rows.push([
      'Item #', 'Customer Location', 'Directory Users', 'Resiliency',
      'On/Off Net', 'Contract Term', 'Service (ISF)', 'Bandwidth',
      'Service MRC', 'Item Total MRC', 'Item Total NRC', 'Status'
    ]);

    basketItems.forEach((item, idx) => {
      const snap = item.formSnapshot;
      const bItem = bundleResult?.items?.[idx];
      const services = bItem?.services || item.result?.services || [];
      const pricing = bItem?.pricing || item.result?.pricing;
      const itemMrc = pricing ? formatCurrency(pricing.mrc, pricing.currency || currency) : '';
      const itemNrc = pricing ? formatCurrency(pricing.nrc, pricing.currency || currency) : '';

      const baseFields = [
        idx + 1,
        snap.customer_location?.city_name || 'N/A',
        snap.directory_users,
        snap.member_resiliency,
        snap.member_on_off_net,
        `${snap.contract_term} months`
      ];

      if (item.poa) {
        rows.push([...baseFields, '', '', '', itemMrc, itemNrc, `POA - ${item.poaMessage || 'Price On Application'}`]);
      } else if (services.length > 0) {
        services.forEach((svc, sIdx) => {
          const svcMrc = svc.poa ? 'POA' : formatCurrency(svc.mrc_converted || svc.mrc_usd, currency);
          const rowPrefix = sIdx === 0 ? baseFields : ['', '', '', '', '', ''];
          rows.push([
            ...rowPrefix,
            svc.name,
            svc.bandwidth,
            svcMrc,
            sIdx === 0 ? itemMrc : '',
            sIdx === 0 ? itemNrc : '',
            svc.poa ? 'POA' : 'Priced'
          ]);
        });
      } else {
        const dirBw = typeof item.result?.calculated_bandwidth === 'object'
          ? (item.result.calculated_bandwidth.directory || '-')
          : (item.result?.calculated_bandwidth || '-');
        const fallbackServices = [
          { name: 'One Directory ISF', bandwidth: dirBw },
          { name: 'One Control ISF', bandwidth: '5Mb' },
          ...(snap.b2b_agility ? [{ name: 'B2B Agility ISF', bandwidth: '10Mb' }] : []),
          ...(snap.safe_connect_required ? [{ name: 'Safe Connect ISF', bandwidth: snap.safe_connect_bandwidth }] : [])
        ];
        fallbackServices.forEach((svc, sIdx) => {
          rows.push([
            ...(sIdx === 0 ? baseFields : ['', '', '', '', '', '']),
            svc.name,
            svc.bandwidth,
            '',
            sIdx === 0 ? itemMrc : '',
            sIdx === 0 ? itemNrc : '',
            ''
          ]);
        });
      }
    });

    rows.push([]);
    rows.push(['Terms and Conditions']);
    pricingTerms.forEach((term, index) => { rows.push([`${index + 1}. ${term}`]); });

    const csvContent = rows.map(row => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `one_directory_quote_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportLogs = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/voice/one-directory/logs/export`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `one_directory_logs_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export logs');
    }
  };

  // Re-export a single historical bundle from the Pricing Logs tab, using the same
  // row layout as handleExportToFile (the live basket export) but sourced from the
  // already-fetched log/log.items instead of the (possibly since-cleared) live basket.
  const handleExportBundleLog = (log) => {
    const currency = log.currency || 'USD';
    const items = log.items || [];

    const escapeCsv = (val) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [];

    rows.push(['One Directory Pricing Bundle Quote']);
    rows.push(['Generated', new Date().toLocaleString()]);
    if (log.customer_name) rows.push(['Customer', log.customer_name]);
    rows.push(['Currency', currency]);
    rows.push(['Original Quote Date', new Date(log.timestamp || log.created_at).toLocaleString()]);
    rows.push(['Total Items', log.item_count ?? items.length]);
    rows.push(['Bundle Total MRC', formatCurrency(log.total_mrc || 0, currency)]);
    rows.push(['Bundle Total NRC', formatCurrency(log.total_nrc || 0, currency)]);
    rows.push([]);

    rows.push([
      'Item #', 'Customer Location', 'Directory Users', 'Resiliency',
      'On/Off Net', 'Contract Term', 'Service (ISF)', 'Bandwidth',
      'Service MRC', 'Item Total MRC', 'Item Total NRC', 'Status'
    ]);

    items.forEach((bItem, idx) => {
      const itemCurrency = bItem.currency_requested || currency;
      const services = bItem.services || [];
      const itemMrc = bItem.final_mrc != null ? formatExactCurrency(bItem.final_mrc, itemCurrency) : '';
      const itemNrc = bItem.final_nrc != null ? formatExactCurrency(bItem.final_nrc, itemCurrency) : '';

      const baseFields = [
        idx + 1,
        bItem.customer_location || 'N/A',
        bItem.directory_users,
        bItem.member_resiliency,
        bItem.member_on_off_net,
        `${bItem.contract_term} months`
      ];

      if (services.length > 0) {
        services.forEach((svc, sIdx) => {
          const svcMrc = svc.poa ? 'POA' : (svc.mrc != null ? formatExactCurrency(svc.mrc, itemCurrency) : '');
          const rowPrefix = sIdx === 0 ? baseFields : ['', '', '', '', '', ''];
          rows.push([
            ...rowPrefix,
            svc.name,
            svc.bandwidth,
            svcMrc,
            sIdx === 0 ? itemMrc : '',
            sIdx === 0 ? itemNrc : '',
            svc.poa ? 'POA' : 'Priced'
          ]);
        });
      } else {
        rows.push([...baseFields, '', '', '', itemMrc, itemNrc, 'Priced']);
      }
    });

    rows.push([]);
    rows.push(['Terms and Conditions']);
    pricingTerms.forEach((term, index) => { rows.push([`${index + 1}. ${term}`]); });

    const csvContent = rows.map(row => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `one_directory_bundle_${log.id}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all One Directory pricing logs? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_BASE_URL}/voice/one-directory/logs`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      setSuccess('Pricing logs cleared');
      loadPricingLogs();
    } catch (err) {
      setError('Failed to clear logs');
    }
  };

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
            <PhoneIcon sx={{ color: '#fff', fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1875rem' }}>
              One Directory Pricing Tool
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

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)}>
          <Tab icon={<CalculateIcon />} label="Pricing Calculator" />
          <Tab icon={<HistoryIcon />} label="Pricing Logs" />
          <Tab icon={<SpeedIcon />} label="Bandwidth Calculator" />
        </Tabs>
      </Box>

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
              {editingItemId ? <EditIcon color="warning" /> : <SettingsIcon />}
              <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                {editingItemId ? 'Edit Item' : 'Quote Parameters'}
              </Typography>
              {editingItemId && (
                <Chip label="Editing" size="small" color="warning" sx={{ ml: 1 }} />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* Left Column */}
              <Grid item xs={12} md={6}>
                {/* Customer Name Section */}
                <Box sx={{ mb: 3 }}>
                  <CustomerAutocomplete
                    size="small"
                    label="Customer Name"
                    value={formData.customer_name}
                    onChange={(name, customerId) => setFormData(prev => ({ ...prev, customer_name: name, customer_id: customerId }))}
                  />
                </Box>

                {/* Directory Users Section */}
                <Box sx={{ mb: 3 }}>
                  <SectionHeader icon={GroupIcon} title="Directory Users" color="primary" />
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Number of Directory Users *"
                        type="number"
                        value={formData.directory_users}
                        onChange={(e) => setFormData(prev => ({ ...prev, directory_users: e.target.value }))}
                        inputProps={{ min: 1 }}
                        helperText="Enter the number of directory users to calculate required bandwidth"
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Growth % Override Section */}
                <Box sx={{ mb: 3 }}>
                  <SectionHeader icon={TrendingUpIcon} title="Growth %" color="primary" />
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Growth % Override"
                        type="number"
                        value={formData.growth_percentage}
                        onChange={(e) => setFormData(prev => ({ ...prev, growth_percentage: e.target.value }))}
                        inputProps={{ min: 0, step: 0.1 }}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">%</InputAdornment>
                        }}
                        helperText={`Default = ${defaultGrowthPercentage}%`}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Customer Location Section */}
                <Box sx={{ mb: 3 }}>
                  <SectionHeader icon={LocationOnIcon} title="Customer Location" color="secondary" />
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Autocomplete
                        value={formData.customer_location}
                        onChange={(e, newValue) => setFormData(prev => ({ ...prev, customer_location: newValue }))}
                        options={cities}
                        getOptionLabel={(option) => `${option.city_name}, ${option.country || ''}`}
                        groupBy={(option) => option.region}
                        renderInput={(params) => (
                          <TextField {...params} label="Customer Location *" size="small" />
                        )}
                        renderOption={(props, option) => (
                          <li {...props} key={option.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <LocationOnIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                              <Typography sx={{ flexGrow: 1, fontSize: '0.875rem' }}>{option.city_name}, {option.country}</Typography>
                            </Box>
                          </li>
                        )}
                        isOptionEqualToValue={(option, value) => option.city_name === value?.city_name}
                      />
                    </Grid>
                    {formData.customer_location && (
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Chip label={formData.customer_location.region} size="small" color="primary" variant="outlined" />
                          <Chip label={formData.customer_location.tier} size="small" color="secondary" variant="outlined" />
                          {formData.customer_location.country && (
                            <Chip label={formData.customer_location.country} size="small" variant="outlined" />
                          )}
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              </Grid>

              {/* Right Column */}
              <Grid item xs={12} md={6}>
                {/* Connection Settings Section */}
                <Box sx={{ mb: 3 }}>
                  <SectionHeader icon={SettingsIcon} title="Service Parameters" color="info" />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Resiliency Type *</InputLabel>
                        <Select
                          value={formData.member_resiliency}
                          onChange={(e) => setFormData(prev => ({ ...prev, member_resiliency: e.target.value }))}
                          label="Resiliency Type *"
                        >
                          {resiliencyOptions.map(opt => (
                            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>On/Off Net *</InputLabel>
                        <Select
                          value={formData.member_on_off_net}
                          onChange={(e) => setFormData(prev => ({ ...prev, member_on_off_net: e.target.value }))}
                          label="On/Off Net *"
                        >
                          <MenuItem value="On Net">On Net</MenuItem>
                          <MenuItem value="Off Net">Off Net</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Contract Term *</InputLabel>
                        <Select
                          value={formData.contract_term}
                          onChange={(e) => setFormData(prev => ({ ...prev, contract_term: e.target.value }))}
                          label="Contract Term *"
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
                          onChange={(e) => setFormData(prev => ({ ...prev, currency_requested: e.target.value }))}
                          label="Currency *"
                        >
                          {currencies.map(c => (
                            <MenuItem key={c.currency_code} value={c.currency_code}>
                              {c.currency_code}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.b2b_agility}
                            onChange={(e) => setFormData(prev => ({ ...prev, b2b_agility: e.target.checked }))}
                            color="info"
                          />
                        }
                        label={
                          <Typography variant="body2">
                            B2B Agility Required
                          </Typography>
                        }
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.safe_connect_required}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              safe_connect_required: e.target.checked,
                              safe_connect_bandwidth: e.target.checked ? prev.safe_connect_bandwidth : ''
                            }))}
                            color="warning"
                          />
                        }
                        label={
                          <Typography variant="body2">
                            Safe Connect Required
                          </Typography>
                        }
                      />
                    </Grid>
                    {formData.safe_connect_required && (
                      <Grid item xs={12}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Safe Connect Bandwidth *</InputLabel>
                          <Select
                            value={formData.safe_connect_bandwidth}
                            onChange={(e) => setFormData(prev => ({ ...prev, safe_connect_bandwidth: e.target.value }))}
                            label="Safe Connect Bandwidth *"
                          >
                            {safeConnectOptions.map(opt => (
                              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    )}
                  </Grid>
                </Box>

                {/* Bundle Info */}
                {basketItems.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <SectionHeader icon={ShoppingCartIcon} title="Shopping Basket" color="success" />
                    <Alert severity="info" sx={{ mb: 1 }}>
                      <Typography variant="body2">
                        <strong>{basketItems.length} item(s)</strong> in basket.
                      </Typography>
                    </Alert>
                  </Box>
                )}
              </Grid>

              {/* Edit mode banner */}
              {editingItemId && (
                <Grid item xs={12}>
                  <Alert
                    severity="warning"
                    action={
                      <Button color="inherit" size="small" onClick={handleCancelEdit}>
                        Cancel Edit
                      </Button>
                    }
                  >
                    <Typography variant="body2">
                      <strong>Editing item</strong> — modify the fields below and click "Update Item" to save changes.
                    </Typography>
                  </Alert>
                </Grid>
              )}

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : editingItemId ? <EditIcon /> : <ShoppingCartIcon />}
                    onClick={handleCalculateAndAddToBasket}
                    disabled={loading || !formData.customer_location || !formData.directory_users || !formData.member_resiliency || (bundleResult !== null)}
                    sx={{ 
                      px: 4,
                      background: (theme) => editingItemId
                        ? `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`
                        : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                      '&:hover': {
                        background: (theme) => editingItemId
                          ? `linear-gradient(135deg, ${theme.palette.warning.dark} 0%, ${theme.palette.warning.main} 100%)`
                          : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                      }
                    }}
                  >
                    {loading ? 'Calculating...' : editingItemId ? 'Update Item' : 'Calculate & Add to Basket'}
                  </Button>
                  {editingItemId && (
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                  )}
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
                    <TableRow sx={{ backgroundColor: 'action.hover' }}>
                      <TableCell sx={{ width: 30 }}></TableCell>
                      <TableCell><strong>Customer Location</strong></TableCell>
                      <TableCell><strong>Dir. Users</strong></TableCell>
                      <TableCell><strong>On/Off Net</strong></TableCell>
                      <TableCell><strong>Term</strong></TableCell>
                      <TableCell><strong>Currency</strong></TableCell>
                      <TableCell align="center"><strong>ISFs</strong></TableCell>
                      <TableCell align="right"><strong>Total MRC</strong></TableCell>
                      <TableCell align="right"><strong>Total NRC</strong></TableCell>
                      {!bundleResult && <TableCell sx={{ width: 70 }}></TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {basketItems.map((item, idx) => {
                      const snap = item.formSnapshot;
                      const bItem = bundleResult?.items?.[idx];
                      const services = bItem?.services || item.result?.services || [];
                      const isExpanded = expandedBasketItems[item.id];
                      const isfCount = services.length || (2 + (snap.b2b_agility ? 1 : 0) + (snap.safe_connect_required ? 1 : 0));
                      const currency = bItem?.pricing?.currency || item.result?.pricing?.currency || formData.currency_requested;

                      return (
                        <React.Fragment key={item.id}>
                          {/* Main row - location summary */}
                          <TableRow
                            hover
                            onClick={() => toggleBasketItemExpanded(item.id)}
                            sx={{
                              cursor: 'pointer',
                              '& > *': { borderBottom: isExpanded ? 'none' : undefined },
                              ...(editingItemId === item.id && {
                                backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.08),
                                '&:hover': { backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.12) }
                              })
                            }}
                          >
                            <TableCell sx={{ px: 1 }}>
                              <IconButton size="small" sx={{ p: 0 }}>
                                {isExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                              </IconButton>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                {snap.customer_location?.city_name || '-'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {snap.member_resiliency}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                {snap.directory_users}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={snap.member_on_off_net}
                                size="small"
                                color={snap.member_on_off_net === 'Off Net' ? 'error' : 'default'}
                                sx={{ fontSize: '0.6rem', height: 20 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                {snap.contract_term}m
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                {currency}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip label={isfCount} size="small" color="primary" sx={{ fontSize: '0.7rem', height: 20, minWidth: 28 }} />
                            </TableCell>
                            <TableCell align="right">
                              {item.poa ? (
                                <Chip label="POA" size="small" color="warning" />
                              ) : bItem?.pricing ? (
                                <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'success.main' }}>
                                  {formatCurrency(bItem.pricing.mrc, currency)}
                                </Typography>
                              ) : item.result?.pricing ? (
                                <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                  {formatCurrency(item.result.pricing.mrc, currency)}
                                </Typography>
                              ) : '-'}
                            </TableCell>
                            <TableCell align="right">
                              {item.poa ? '-' : bItem?.pricing ? (
                                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                  {formatCurrency(bItem.pricing.nrc, currency)}
                                </Typography>
                              ) : item.result?.pricing ? (
                                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                  {formatCurrency(item.result.pricing.nrc, currency)}
                                </Typography>
                              ) : '-'}
                            </TableCell>
                            {!bundleResult && (
                              <TableCell>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <Tooltip title="Edit item">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={(e) => { e.stopPropagation(); handleEditBasketItem(item); }}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Remove item">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={(e) => { e.stopPropagation(); handleRemoveFromBasket(item.id); }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                            )}
                          </TableRow>

                          {/* Expanded ISF sub-items row */}
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={bundleResult ? 9 : 10} sx={{ py: 0, px: 1, backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.02) }}>
                                <Box sx={{ pl: 4, pr: 2, py: 1.5 }}>
                                  <Table size="small" sx={{ '& td, & th': { border: 'none', py: 0.5, fontSize: '0.7rem' } }}>
                                    <TableHead>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Service (ISF)</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Bandwidth</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>MRC</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {services.length > 0 ? services.map((svc, sIdx) => (
                                        <TableRow key={sIdx}>
                                          <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                              <Box sx={{
                                                width: 8, height: 8, borderRadius: '50%',
                                                backgroundColor: svc.type === 'one_control' ? 'warning.main' : svc.type === 'directory' ? 'primary.main' : svc.type === 'b2b' ? 'info.main' : 'secondary.main'
                                              }} />
                                              {svc.name}
                                            </Box>
                                          </TableCell>
                                          <TableCell>{svc.bandwidth}</TableCell>
                                          <TableCell align="right">
                                            {svc.poa ? (
                                              <Chip label="POA" size="small" color="warning" sx={{ fontSize: '0.6rem', height: 18 }} />
                                            ) : (
                                              formatCurrency(svc.mrc_converted || svc.mrc_usd, currency)
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      )) : (
                                        <>
                                          <TableRow>
                                            <TableCell>One Directory ISF</TableCell>
                                            <TableCell>
                                              {typeof item.result?.calculated_bandwidth === 'object'
                                                ? (item.result.calculated_bandwidth.directory || '-')
                                                : (item.result?.calculated_bandwidth || '-')}
                                            </TableCell>
                                            <TableCell align="right">—</TableCell>
                                          </TableRow>
                                          <TableRow>
                                            <TableCell>One Control ISF</TableCell>
                                            <TableCell>5Mb</TableCell>
                                            <TableCell align="right">—</TableCell>
                                          </TableRow>
                                          {snap.b2b_agility && (
                                            <TableRow>
                                              <TableCell>B2B Agility ISF</TableCell>
                                              <TableCell>10Mb</TableCell>
                                              <TableCell align="right">—</TableCell>
                                            </TableRow>
                                          )}
                                          {snap.safe_connect_required && (
                                            <TableRow>
                                              <TableCell>Safe Connect ISF</TableCell>
                                              <TableCell>{snap.safe_connect_bandwidth}</TableCell>
                                              <TableCell align="right">—</TableCell>
                                            </TableRow>
                                          )}
                                        </>
                                      )}
                                    </TableBody>
                                  </Table>
                                </Box>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Add Additional Item button */}
              {!bundleResult && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={() => {
                      if (editingItemId) handleCancelEdit();
                      setExpandedAccordion('form');
                    }}
                    sx={{ borderStyle: 'dashed', px: 4, py: 1 }}
                  >
                    Add Additional Item
                  </Button>
                </Box>
              )}

              {/* Complete Basket Button */}
              {!bundleResult && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={bundleLoading ? <CircularProgress size={20} color="inherit" /> : <CalculateIcon />}
                    onClick={handleCompleteBasket}
                    disabled={bundleLoading || basketItems.length === 0}
                    sx={{ px: 4 }}
                  >
                    {bundleLoading ? 'Calculating...' : 'Complete Basket'}
                  </Button>
                </Box>
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
                            mb: 3,
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: (theme) => alpha(theme.palette.success.main, 0.08)
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                            Total Monthly Recurring Cost
                          </Typography>
                          <Typography
                            variant="h3"
                            sx={{
                              fontWeight: 700,
                              color: 'success.main',
                              lineHeight: 1.2,
                              mt: 0.5
                            }}
                          >
                            {formatCurrency(bundleResult.bundle.total_mrc, bundleResult.bundle.currency)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">per month</Typography>
                        </Box>

                        {/* Total NRC */}
                        <Box sx={{ textAlign: 'center', mb: 3, p: 2, borderRadius: 2, backgroundColor: (theme) => alpha(theme.palette.info.main, 0.08) }}>
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                            Total Non-Recurring Cost
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main', lineHeight: 1.2, mt: 0.5 }}>
                            {formatCurrency(bundleResult.bundle.total_nrc, bundleResult.bundle.currency)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">one-time</Typography>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">Items</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" align="right" fontWeight={600}>{bundleResult.bundle.item_count}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">Currency</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" align="right" fontWeight={600}>{bundleResult.bundle.currency}</Typography>
                          </Grid>
                        </Grid>

                        {bundleResult.bundle.has_poa_items && (
                          <Alert severity="warning" sx={{ mt: 2 }}>
                            Some items require Price On Application
                          </Alert>
                        )}
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
                            backgroundColor: 'action.hover',
                            borderRadius: 1,
                            p: 1.5
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                            <span>Items in Bundle:</span>
                            <span style={{ fontWeight: 500 }}>{basketItems.length}</span>
                          </Box>
                          {bundleResult.bundle.exchange_rate && bundleResult.bundle.exchange_rate !== 1 && (
                            <>
                              <Divider sx={{ my: 1 }} />
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                <span>Exchange Rate (USD → {bundleResult.bundle.currency}):</span>
                                <span style={{ fontWeight: 500 }}>{bundleResult.bundle.exchange_rate}</span>
                              </Box>
                            </>
                          )}
                          <Divider sx={{ my: 1 }} />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, fontWeight: 'bold', color: 'text.primary' }}>
                            <span>Final Bundle MRC ({bundleResult.bundle.currency}):</span>
                            <span>{formatCurrency(bundleResult.bundle.total_mrc, bundleResult.bundle.currency)}</span>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, fontWeight: 'bold', color: 'text.primary' }}>
                            <span>Final Bundle NRC ({bundleResult.bundle.currency}):</span>
                            <span>{formatCurrency(bundleResult.bundle.total_nrc, bundleResult.bundle.currency)}</span>
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
                        Export Bundle to CSV
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
                    <Card variant="outlined" sx={{ backgroundColor: 'action.hover' }}>
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
              backgroundColor: 'action.hover'
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
                backgroundColor: 'action.selected',
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
              Enter directory user details, then click "Calculate & Add to Basket" to start building your pricing bundle
            </Typography>
          </Card>
        )}
      </TabPanel>

      {/* Pricing Logs Tab */}
      <TabPanel value={currentTab} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">Pricing Logs</Typography>
            {logsPermissionLevel === 'read_only' && (
              <Chip label="My Logs" size="small" color="default" variant="outlined" sx={{ fontSize: '0.7rem' }} />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip 
              label={`Showing ${pricingLogs.length} of ${pagination.total} entries (Page ${pagination.page}/${pagination.totalPages || 1})`} 
              color="info" 
              size="small"
            />
            {logsPermissionLevel === 'admin' && (
              <>
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
              </>
            )}
          </Box>
        </Box>

        {/* Search and Filter Controls */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              {/* User filter — only for provisioner/admin */}
              {logsPermissionLevel !== 'read_only' && (
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
              )}
              {/* Customer name filter */}
              <Grid item xs={12} md={logsPermissionLevel !== 'read_only' ? 3 : 4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Customer Name"
                  value={customerNameFilter}
                  onChange={(e) => { setCustomerNameFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                  placeholder="Search by customer name"
                />
              </Grid>
              {/* Date range filters */}
              <Grid item xs={6} md={logsPermissionLevel !== 'read_only' ? 2 : 3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Start Date"
                  value={startDateFilter}
                  onChange={(e) => { setStartDateFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6} md={logsPermissionLevel !== 'read_only' ? 2 : 3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="End Date"
                  value={endDateFilter}
                  onChange={(e) => { setEndDateFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setSelectedUser('');
                    setCustomerNameFilter('');
                    setStartDateFilter('');
                    setEndDateFilter('');
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
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
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ width: 30 }}></TableCell>
                    <TableCell><strong>Bundle</strong></TableCell>
                    <TableCell><strong>Customer</strong></TableCell>
                    <TableCell><strong>Timestamp</strong></TableCell>
                    <TableCell><strong>User</strong></TableCell>
                    <TableCell><strong>Items</strong></TableCell>
                    <TableCell><strong>Currency</strong></TableCell>
                    <TableCell align="right"><strong>Total MRC</strong></TableCell>
                    <TableCell align="right"><strong>Total NRC</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pricingLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No pricing logs found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pricingLogs.map((log) => {
                      const isBundleExpanded = expandedBundles[log.id] || false;
                      return (
                        <React.Fragment key={`bundle-${log.id}`}>
                          {/* Level 1: Bundle row */}
                          <TableRow 
                            hover 
                            onClick={() => setExpandedBundles(prev => ({ ...prev, [log.id]: !prev[log.id] }))}
                            sx={{ 
                              cursor: 'pointer',
                              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.04),
                              '&:hover': { backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08) }
                            }}
                          >
                            <TableCell sx={{ width: 30, px: 1 }}>
                              <IconButton size="small" sx={{ p: 0 }}>
                                {isBundleExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                              </IconButton>
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={<ShoppingBasketIcon sx={{ fontSize: '0.85rem !important' }} />}
                                label={`Bundle (${log.item_count} locations)`}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                {log.customer_name || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                {new Date(log.timestamp || log.created_at).toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                {log.username || log.full_name || 'Unknown'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                {log.item_count} location{log.item_count !== 1 ? 's' : ''}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                {log.currency || 'USD'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'primary.main' }}>
                                {log.currency || 'USD'} {roundUpToNearest5(log.total_mrc || 0).toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                {log.currency || 'USD'} {roundUpToNearest5(log.total_nrc || 0).toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Export this bundle to CSV">
                                <IconButton
                                  size="small"
                                  onClick={(e) => { e.stopPropagation(); handleExportBundleLog(log); }}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>

                          {/* Level 2: Expanded location items within bundle */}
                          {isBundleExpanded && log.items?.map((bItem, bIdx) => {
                            const itemKey = `${log.id}-${bIdx}`;
                            const isItemExpanded = expandedLogItems[itemKey] || false;
                            const servicesList = bItem.services || [];
                            return (
                              <React.Fragment key={`bundle-${log.id}-item-${bIdx}`}>
                                <TableRow 
                                  hover
                                  onClick={(e) => { e.stopPropagation(); setExpandedLogItems(prev => ({ ...prev, [itemKey]: !prev[itemKey] })); }}
                                  sx={{ 
                                    backgroundColor: 'action.hover', 
                                    cursor: servicesList.length > 0 ? 'pointer' : 'default',
                                    '&:hover': { backgroundColor: 'action.hover' }
                                  }}
                                >
                                  <TableCell sx={{ width: 30, px: 1, pl: 3 }}>
                                    {servicesList.length > 0 && (
                                      <IconButton size="small" sx={{ p: 0 }}>
                                        {isItemExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                                      </IconButton>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>└</Typography>
                                      <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                        {bItem.customer_location || `Location ${bIdx + 1}`}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell></TableCell>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                      {bItem.directory_users} dir. users
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={bItem.member_on_off_net || 'On Net'} 
                                      size="small" 
                                      variant="outlined"
                                      color={bItem.member_on_off_net === 'Off Net' ? 'warning' : 'default'}
                                      sx={{ fontSize: '0.65rem', height: 20 }} 
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                                      {servicesList.length} ISF{servicesList.length !== 1 ? 's' : ''}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                                      {bItem.contract_term}m
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                                      {formatExactCurrency(bItem.final_mrc, bItem.currency_requested)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                                      {formatExactCurrency(bItem.final_nrc, bItem.currency_requested)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell></TableCell>
                                </TableRow>

                                {/* Level 3: Individual service elements within location */}
                                {isItemExpanded && servicesList.map((svc, sIdx) => (
                                  <TableRow key={`bundle-${log.id}-item-${bIdx}-svc-${sIdx}`} sx={{ backgroundColor: (theme) => alpha(theme.palette.info.main, 0.04) }}>
                                    <TableCell></TableCell>
                                    <TableCell sx={{ pl: 6 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>└</Typography>
                                        <Box sx={{ 
                                          width: 8, height: 8, borderRadius: '50%', 
                                          backgroundColor: svc.name?.toLowerCase().includes('control') ? 'warning.main' 
                                            : svc.name?.toLowerCase().includes('agility') ? 'info.main' 
                                            : svc.name?.toLowerCase().includes('safe') ? 'success.main' 
                                            : 'primary.main',
                                          flexShrink: 0
                                        }} />
                                        <Typography variant="body2" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                                          {svc.name || 'Service'}
                                        </Typography>
                                      </Box>
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                                        {svc.bandwidth || '-'}
                                      </Typography>
                                    </TableCell>
                                    <TableCell colSpan={5}></TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                                        {svc.mrc != null ? formatExactCurrency(svc.mrc, bItem.currency_requested) : '-'}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                                        {svc.nrc != null && svc.nrc > 0 ? formatExactCurrency(svc.nrc, bItem.currency_requested) : '-'}
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                ))}

                                {/* Admin only: Calculation breakdown JSON */}
                                {isItemExpanded && logsPermissionLevel === 'admin' && bItem.calculation_breakdown_json && (
                                  <TableRow key={`bundle-${log.id}-item-${bIdx}-breakdown`} sx={{ backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.06) }}>
                                    <TableCell></TableCell>
                                    <TableCell colSpan={9}>
                                      <Box sx={{ pl: 4 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                          Calculation Breakdown (JSON)
                                        </Typography>
                                        <Box
                                          component="pre"
                                          sx={{
                                            fontSize: '0.65rem',
                                            backgroundColor: 'action.hover',
                                            border: '1px solid',
                                            borderColor: 'divider',
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
                                          {JSON.stringify(bItem.calculation_breakdown_json, null, 2)}
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
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {pagination.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination
                count={pagination.totalPages}
                page={pagination.page}
                onChange={(e, page) => setPagination(p => ({ ...p, page }))}
              />
            </Box>
          )}
      </TabPanel>

      {/* Bandwidth Calculator Tab */}
      <TabPanel value={currentTab} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <SpeedIcon color="primary" />
                  Bandwidth Calculator
                </Typography>

                <TextField
                  fullWidth
                  size="small"
                  label="Number of Users *"
                  type="number"
                  value={bwCalcUsers}
                  onChange={(e) => setBwCalcUsers(e.target.value)}
                  inputProps={{ min: 1 }}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  size="small"
                  label="Growth %"
                  type="number"
                  value={bwCalcGrowth}
                  onChange={(e) => setBwCalcGrowth(e.target.value)}
                  inputProps={{ min: 0, step: 0.1 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  }}
                  helperText={`Default = ${defaultGrowthPercentage}%`}
                  sx={{ mb: 2 }}
                />

                <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                  <InputLabel>On/Off Net</InputLabel>
                  <Select
                    value={bwCalcOnOffNet}
                    onChange={(e) => setBwCalcOnOffNet(e.target.value)}
                    label="On/Off Net"
                  >
                    <MenuItem value="On Net">On Net</MenuItem>
                    <MenuItem value="Off Net">Off Net</MenuItem>
                  </Select>
                </FormControl>

                {bwCalcError && (
                  <Alert severity="error" sx={{ mb: 2 }}>{bwCalcError}</Alert>
                )}

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={bwCalcLoading ? <CircularProgress size={18} color="inherit" /> : <CalculateIcon />}
                  onClick={handleCalculateBandwidth}
                  disabled={bwCalcLoading}
                >
                  {bwCalcLoading ? 'Calculating...' : 'Calculate Bandwidth'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={7}>
            {bwCalcResult ? (
              <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Required Bandwidth
                  </Typography>
                  <Typography variant="h2" color="primary.main" sx={{ fontWeight: 700 }}>
                    {bwCalcResult.recommended_bandwidth}
                  </Typography>
                </Box>
              </Card>
            ) : (
              <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <SpeedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.disabled">
                    Enter the number of users and click "Calculate Bandwidth" to see the result
                  </Typography>
                </Box>
              </Card>
            )}
          </Grid>
        </Grid>
      </TabPanel>

      {/* Error / Success Snackbars */}
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert onClose={() => setError('')} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess('')}>
        <Alert onClose={() => setSuccess('')} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default OneDirectoryPricingTool;
