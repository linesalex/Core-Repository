import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CableIcon from '@mui/icons-material/Cable';
import { getCrossConnectsPricing, networkDesignApi, exchangeRatesApi } from './api';

// Cross Connects Pricing - sales-facing view of Manage Locations -> Cross Connect Info.
// Applies the Cross Connect margin (from Pricing Logic Manager) and converts to the
// selected output currency, mirroring the calculation used in CNX Ethernet Route Finder.
const CrossConnectsPricing = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchText, setSearchText] = useState('');
  const [outputCurrency, setOutputCurrency] = useState('USD');
  const [exchangeRates, setExchangeRates] = useState({});
  const [availableCurrencies, setAvailableCurrencies] = useState(['USD']);
  const [margins, setMargins] = useState({ nrcMargin: 10, mrcMargin: 10 });

  useEffect(() => {
    loadPricing();
    loadExchangeRates();
    loadMargins();
  }, []);

  const loadPricing = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getCrossConnectsPricing();
      setRows(data || []);
    } catch (err) {
      console.error('Failed to load cross connects pricing:', err);
      setError('Failed to load cross connects pricing: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadExchangeRates = async () => {
    try {
      const exchangeRatesData = await exchangeRatesApi.getExchangeRates();
      const ratesObj = {};
      const currencyCodes = ['USD'];

      exchangeRatesData.forEach(rate => {
        ratesObj[rate.currency_code] = rate.exchange_rate;
        if (!currencyCodes.includes(rate.currency_code)) {
          currencyCodes.push(rate.currency_code);
        }
      });

      setExchangeRates(ratesObj);
      setAvailableCurrencies(currencyCodes);
    } catch (err) {
      console.error('Failed to load exchange rates:', err);
    }
  };

  const loadMargins = async () => {
    try {
      const response = await networkDesignApi.getPricingLogicConfig();
      if (response.success && response.data.crossConnect) {
        setMargins(response.data.crossConnect);
      }
    } catch (err) {
      console.error('Failed to load pricing logic config:', err);
    }
  };

  // Convert an amount from one currency to another via USD, mirroring Route Finder
  const convertCurrency = (amount, fromCurrency, toCurrency) => {
    if (!amount || fromCurrency === toCurrency) return amount;

    let usdAmount = amount;
    if (fromCurrency !== 'USD' && exchangeRates[fromCurrency]) {
      usdAmount = amount / exchangeRates[fromCurrency];
    }

    if (toCurrency !== 'USD' && exchangeRates[toCurrency]) {
      return usdAmount * exchangeRates[toCurrency];
    }

    return usdAmount;
  };

  const roundUpToNearest10 = (amount) => Math.ceil(amount / 10) * 10;

  // Applies the Cross Connect margin, converts currency, and rounds up to the nearest $10 -
  // same sales-price calculation used in the CNX Ethernet Route Finder cross connect cards.
  const calculateXCPrice = (basePrice, margin, fromCurrency, isCustomerOwned) => {
    if (isCustomerOwned) return 'Customer must provide X/C';
    if (!basePrice) return 'POA';

    const priceWithMargin = basePrice / (1 - margin / 100);
    const convertedPrice = convertCurrency(priceWithMargin, fromCurrency, outputCurrency);
    return roundUpToNearest10(convertedPrice);
  };

  const formatCurrency = (amount) => {
    if (typeof amount === 'string') return amount; // 'POA' or 'Customer must provide X/C'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: outputCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Sales-price rows: raw NRC/MRC costs are never rendered, only the marked-up sell price
  const pricedRows = rows.map(row => {
    const isCustomerOwned = !!row.customer_owned_xc;
    return {
      ...row,
      nrcPrice: calculateXCPrice(row.cross_connect_nrc, margins.nrcMargin, row.cross_connect_nrc_currency, isCustomerOwned),
      mrcPrice: calculateXCPrice(row.cross_connect_mrc, margins.mrcMargin, row.cross_connect_mrc_currency, isCustomerOwned)
    };
  });

  const filteredRows = pricedRows.filter(row => {
    if (!searchText.trim()) return true;
    const term = searchText.toLowerCase();
    return (
      (row.location_code && row.location_code.toLowerCase().includes(term)) ||
      (row.datacenter_name && row.datacenter_name.toLowerCase().includes(term)) ||
      (row.cross_connect_notes && row.cross_connect_notes.toLowerCase().includes(term))
    );
  });

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CableIcon color="primary" />
          <Typography variant="h6" component="h2">
            Cross Connects Pricing
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadPricing}>
          Refresh
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Customer facing cross connect pricing - Any questions, please reach out to the pricing team for clarification.
        This pricing is valid to be provided directly to customers.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="Search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by POP code, datacenter name, or datacenter notes..."
          sx={{ minWidth: 340 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Currency</InputLabel>
          <Select
            value={outputCurrency}
            onChange={(e) => setOutputCurrency(e.target.value)}
            label="Currency"
          >
            {availableCurrencies.map(code => (
              <MenuItem key={code} value={code}>{code}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">
          {filteredRows.length} location{filteredRows.length === 1 ? '' : 's'}
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell><strong>POP Code</strong></TableCell>
                <TableCell><strong>Datacenter Name</strong></TableCell>
                <TableCell><strong>City</strong></TableCell>
                <TableCell><strong>Country</strong></TableCell>
                <TableCell><strong>NRC</strong></TableCell>
                <TableCell><strong>MRC</strong></TableCell>
                <TableCell><strong>Currency</strong></TableCell>
                <TableCell><strong>Mandatory</strong></TableCell>
                <TableCell><strong>Customer-Owned</strong></TableCell>
                <TableCell><strong>Datacenter Notes</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No locations match your search.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map(row => (
                  <TableRow key={row.location_code} hover>
                    <TableCell>{row.location_code}</TableCell>
                    <TableCell>{row.datacenter_name || '-'}</TableCell>
                    <TableCell>{row.city}</TableCell>
                    <TableCell>{row.country}</TableCell>
                    <TableCell>{formatCurrency(row.nrcPrice)}</TableCell>
                    <TableCell>{formatCurrency(row.mrcPrice)}</TableCell>
                    <TableCell>{outputCurrency}</TableCell>
                    <TableCell>
                      {row.cross_connect_mandatory ? (
                        <Chip label="Required" size="small" color="warning" variant="filled" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.customer_owned_xc ? (
                        <Chip label="Customer Owned" size="small" color="secondary" variant="outlined" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 320, verticalAlign: 'top' }}>
                      {row.cross_connect_notes ? (
                        <Typography
                          variant="body2"
                          sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                        >
                          {row.cross_connect_notes}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default CrossConnectsPricing;
