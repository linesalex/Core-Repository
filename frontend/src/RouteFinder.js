import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Paper, Typography, TextField, Button, Alert, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Card, CardContent, CardHeader,
  RadioGroup, Radio, FormControlLabel, FormControl, FormLabel, Autocomplete,
  Snackbar, Chip, IconButton, Collapse, Tabs, Tab, Select, MenuItem, InputLabel,
  Divider
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
import SecurityIcon from '@mui/icons-material/Security';
import CableIcon from '@mui/icons-material/Cable';
import LoadingButton from '@mui/lab/LoadingButton';
import { API_BASE_URL } from './config';
import { getPromoRulesForSales, checkPromoMatch, calculateProtectedPromo, getCrossConnectInfo, networkDesignApi, exchangeRatesApi, saveRouteFinderSearchLog, findPromoRoute } from './api';

const RouteFinder = ({ onViewMap, savedState, onStateChange, preComputedRoute, onClearPreComputed }) => {
  // Form state - initialize from savedState if available
  const [formData, setFormData] = useState(savedState?.formData || {
    source: '',
    destination: '',
    bandwidth: '',
    mtuRequired: '',
    routeMode: 'standard', // 'fastest' or 'standard' - defaults to standard
    outputCurrency: 'USD'
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
  const [primaryPromo, setPrimaryPromo] = useState(savedState?.primaryPromo || null);
  const [secondaryPromo, setSecondaryPromo] = useState(savedState?.secondaryPromo || null);
  const [protectedPromo, setProtectedPromo] = useState(savedState?.protectedPromo || null);
  const [expandedPromoRows, setExpandedPromoRows] = useState({});

  // "Find Promo Pricing" - actively searches for the best route for which promo
  // pricing is valid at the selected bandwidth (independent of the standard route search)
  const [promoRouteLoading, setPromoRouteLoading] = useState(false);
  const [promoRouteResult, setPromoRouteResult] = useState(savedState?.promoRouteResult || null);
  
  // Cross connect state
  const [crossConnectResults, setCrossConnectResults] = useState(savedState?.crossConnectResults || { source: null, destination: null });
  
  // Currency state
  const [exchangeRates, setExchangeRates] = useState({});
  const [availableCurrencies, setAvailableCurrencies] = useState(['USD']);

  // Tab state
  const [currentTab, setCurrentTab] = useState(0);

  // Pre-computed route display mode (from latency matrix click-through)
  const [displayMode, setDisplayMode] = useState(false);
  const [matrixContext, setMatrixContext] = useState(null); // { tier, sourceCity, destinationCity }

  // The Latency Matrix only labels a pair by tier ('1Gb'/'10Gb'), not an actual
  // requested bandwidth - map that label to the same Mbps value a manual search
  // would use so a matrix click-through runs the identical backend search.
  const MATRIX_TIER_BANDWIDTH_MBPS = { '1Gb': 1000, '10Gb': 10000 };

  // Load locations, promo rules, and exchange rates on mount
  useEffect(() => {
    if (!savedState?.locations?.length) {
      loadLocations();
    }
    loadPromoRules();
    loadExchangeRates();
  }, []);

  // Handle click-through from the Home page Latency Matrix. Runs the exact same
  // backend search a manual Route Finder search would (same bandwidth-derived-
  // from-tier) instead of fabricating a result client-side - this guarantees
  // promo pricing and the diverse/secondary path are always fully and
  // correctly computed, never faked or skipped. Always uses 'fastest' route
  // mode, since the matrix itself is a latency-first view (this also means
  // ULL/Cisco-only routes are included, and protected promo pricing does not
  // apply - same as a manual "fastest" search).
  useEffect(() => {
    if (!preComputedRoute) return;

    const bandwidthMbps = MATRIX_TIER_BANDWIDTH_MBPS[preComputedRoute.tier] || undefined;

    setFormData(prev => ({
      ...prev,
      source: preComputedRoute.source,
      destination: preComputedRoute.destination,
      bandwidth: bandwidthMbps ? String(bandwidthMbps) : prev.bandwidth,
      mtuRequired: '',
      routeMode: 'fastest',
      outputCurrency: prev.outputCurrency || 'USD'
    }));

    setMatrixContext({
      tier: preComputedRoute.tier,
      sourceCity: preComputedRoute.sourceCity,
      destinationCity: preComputedRoute.destinationCity
    });
    setDisplayMode(true);
    setCurrentTab(0);

    performSearch(preComputedRoute.source, preComputedRoute.destination, bandwidthMbps, {
      mtuRequired: 1500,
      routeMode: 'fastest'
    });

    if (onClearPreComputed) onClearPreComputed();
  }, [preComputedRoute]);

  // Save state to parent whenever key state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        formData,
        searchResults,
        locations,
        primaryPromo,
        secondaryPromo,
        protectedPromo,
        crossConnectResults,
        promoRouteResult
      });
    }
  }, [formData, searchResults, locations, primaryPromo, secondaryPromo, protectedPromo, crossConnectResults, promoRouteResult, onStateChange]);

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

  const loadPromoRules = async () => {
    try {
      setPromoLoading(true);
      const result = await getPromoRulesForSales('');
      setPromoRules(result.data || []);
    } catch (err) {
      console.error('Failed to load promo rules:', err);
    } finally {
      setPromoLoading(false);
    }
  };

  // Currency conversion helpers
  const convertFromUSD = (amountUSD, toCurrency) => {
    if (!amountUSD || toCurrency === 'USD') return amountUSD;
    if (exchangeRates[toCurrency]) {
      return amountUSD * exchangeRates[toCurrency];
    }
    return amountUSD;
  };

  const convertCurrency = (amount, fromCurrency, toCurrency) => {
    if (!amount || fromCurrency === toCurrency) return amount;
    
    // Convert to USD first
    let usdAmount = amount;
    if (fromCurrency !== 'USD' && exchangeRates[fromCurrency]) {
      usdAmount = amount / exchangeRates[fromCurrency];
    }
    
    // Convert from USD to target
    if (toCurrency !== 'USD' && exchangeRates[toCurrency]) {
      return usdAmount * exchangeRates[toCurrency];
    }
    
    return usdAmount;
  };

  const roundUpToNearest10 = (amount) => {
    return Math.ceil(amount / 10) * 10;
  };

  // Load cross connect data for source and destination
  const loadCrossConnects = async (sourceCode, destCode) => {
    const results = { source: null, destination: null };
    
    try {
      // Get pricing logic config for margins
      const pricingConfig = await networkDesignApi.getPricingLogicConfig();
      const margins = pricingConfig.data.crossConnect || { nrcMargin: 10, mrcMargin: 10 };

      const calculateXCPrice = (basePrice, margin, fromCurrency, isCustomerOwned) => {
        if (isCustomerOwned) return 'Customer must provide X/C';
        if (!basePrice || basePrice === null) return 'POA';
        
        // Apply margin (not markup)
        const priceWithMargin = basePrice / (1 - margin / 100);
        
        // Convert currency
        const convertedPrice = convertCurrency(priceWithMargin, fromCurrency, formData.outputCurrency);
        
        // Round up to nearest $10
        return roundUpToNearest10(convertedPrice);
      };

      // Fetch source cross connect
      const sourceLocation = locations.find(loc => loc.location_code === sourceCode);
      if (sourceLocation) {
        try {
          const sourceXC = await getCrossConnectInfo(sourceLocation.id);
          const isCustomerOwned = sourceXC.customer_owned_xc;
          const nrcPrice = calculateXCPrice(sourceXC.cross_connect_nrc, margins.nrcMargin, sourceXC.cross_connect_nrc_currency, isCustomerOwned);
          const mrcPrice = calculateXCPrice(sourceXC.cross_connect_mrc, margins.mrcMargin, sourceXC.cross_connect_mrc_currency, isCustomerOwned);
          
          // Only show if NEITHER NRC nor MRC is POA (unless customer owned)
          if (isCustomerOwned || (nrcPrice !== 'POA' && mrcPrice !== 'POA')) {
            results.source = {
              locationCode: sourceXC.location_code,
              datacenterName: sourceXC.datacenter_name,
              nrc: nrcPrice,
              mrc: mrcPrice,
              notes: sourceXC.cross_connect_notes,
              currency: formData.outputCurrency,
              mandatory: sourceXC.cross_connect_mandatory,
              customerOwned: isCustomerOwned
            };
          }
        } catch (err) {
          console.error('Failed to load source cross connect:', err);
        }
      }

      // Fetch destination cross connect
      const destLocation = locations.find(loc => loc.location_code === destCode);
      if (destLocation) {
        try {
          const destXC = await getCrossConnectInfo(destLocation.id);
          const isCustomerOwned = destXC.customer_owned_xc;
          const nrcPrice = calculateXCPrice(destXC.cross_connect_nrc, margins.nrcMargin, destXC.cross_connect_nrc_currency, isCustomerOwned);
          const mrcPrice = calculateXCPrice(destXC.cross_connect_mrc, margins.mrcMargin, destXC.cross_connect_mrc_currency, isCustomerOwned);
          
          // Only show if NEITHER NRC nor MRC is POA (unless customer owned)
          if (isCustomerOwned || (nrcPrice !== 'POA' && mrcPrice !== 'POA')) {
            results.destination = {
              locationCode: destXC.location_code,
              datacenterName: destXC.datacenter_name,
              nrc: nrcPrice,
              mrc: mrcPrice,
              notes: destXC.cross_connect_notes,
              currency: formData.outputCurrency,
              mandatory: destXC.cross_connect_mandatory,
              customerOwned: isCustomerOwned
            };
          }
        } catch (err) {
          console.error('Failed to load destination cross connect:', err);
        }
      }
    } catch (err) {
      console.error('Failed to load pricing config for cross connects:', err);
    }

    setCrossConnectResults(results);
    return results;
  };

  // source/destination/bandwidthMbps are passed explicitly (rather than read
  // from formData) so this can be called immediately after setFormData
  // without hitting a stale-state race - both the manual Search button and the
  // Latency Matrix click-through funnel through this same function.
  const checkPromoForRoute = async (results, source, destination, bandwidthMbps) => {
    let primaryPromoResult = null;
    let secondaryPromoResult = null;
    let primaryMarginDetails = null;
    let secondaryMarginDetails = null;
    let protectedMarginDetails = null;
    let primaryPromoReason = null;
    let secondaryPromoReason = null;
    let protectionPricingPercent = null;

    // Check Primary Path
    if (results.primaryPath?.route) {
      try {
        const primaryCircuitIds = results.primaryPath.route.map(seg => seg.circuit_id).filter(Boolean);
        
        const result = await checkPromoMatch(
          source,
          destination,
          bandwidthMbps || 10,
          primaryCircuitIds,
          []
        );
        
        primaryMarginDetails = result.marginDetails || null;
        if (result.hasPromo && result.valid) {
          primaryPromoResult = result.prices;
          protectionPricingPercent = result.protectionPricingPercent || null;
          setPrimaryPromo(result.prices);
        } else {
          primaryPromoReason = result.reason || (result.hasPromo ? 'margin_not_met' : 'no_promo_rule');
          setPrimaryPromo(null);
        }
      } catch (err) {
        console.error('Failed to check primary promo:', err);
        primaryPromoReason = 'error';
        setPrimaryPromo(null);
      }
    } else {
      primaryPromoReason = 'no_path';
      setPrimaryPromo(null);
    }
    
    // Check Secondary Path (independently)
    if (results.diversePath?.route) {
      try {
        const secondaryCircuitIds = results.diversePath.route.map(seg => seg.circuit_id).filter(Boolean);
        
        const result = await checkPromoMatch(
          source,
          destination,
          bandwidthMbps || 10,
          secondaryCircuitIds,
          []
        );
        
        secondaryMarginDetails = result.marginDetails || null;
        if (result.hasPromo && result.valid) {
          secondaryPromoResult = result.prices;
          setSecondaryPromo(result.prices);
        } else {
          secondaryPromoReason = result.reason || (result.hasPromo ? 'margin_not_met' : 'no_promo_rule');
          setSecondaryPromo(null);
        }
      } catch (err) {
        console.error('Failed to check secondary promo:', err);
        secondaryPromoReason = 'error';
        setSecondaryPromo(null);
      }
    } else {
      secondaryPromoReason = 'no_path';
      setSecondaryPromo(null);
    }

    // Calculate Protected Promo via backend - only when the primary path's matched promo rule
    // has an optional "Protection Pricing %" configured, and a diverse secondary path exists
    // (used purely as the protection route for the margin check).
    // Protected pricing isn't applicable to Cisco/ULL circuits - but "fastest" route mode only
    // *permits* those (it doesn't force them), so eligibility is based on whether the actual
    // resolved path(s) contain one, not on which route mode was selected.
    // Backend calculates primaryPromoPrice x (1 + protectionPct/100) per tier, then validates the
    // margin on just the increment against the protection route's allocated cost.
    const routeUsesCiscoOrUll = (route) => (route || []).some(
      (seg) => seg.equipment_type === 'Cisco' || seg.is_special
    );
    const protectionEligibleRoute = !routeUsesCiscoOrUll(results.primaryPath?.route)
      && !routeUsesCiscoOrUll(results.diversePath?.route);

    let protectedPromoResult = null;
    let protectedMethod = null;
    if (primaryPromoResult && protectionPricingPercent > 0 && results.diversePath?.route && protectionEligibleRoute) {
      try {
        const secondaryCircuitIds = results.diversePath.route.map(seg => seg.circuit_id).filter(Boolean);
        
        const protectedResult = await calculateProtectedPromo(
          source,
          destination,
          bandwidthMbps || 10,
          secondaryCircuitIds,
          primaryPromoResult,
          protectionPricingPercent
        );
        
        protectedMarginDetails = protectedResult.marginDetails || null;
        protectedMethod = protectedResult.method || null;
        
        if (protectedResult.valid && protectedResult.prices) {
          // Check that at least one tier has a valid (non-null) price
          const prices = protectedResult.prices;
          const hasAnyValidTier = prices.price_10mb !== null || prices.price_100mb !== null || 
                                   prices.price_1000mb !== null || prices.price_10gb !== null;
          if (hasAnyValidTier) {
            protectedPromoResult = prices;
            setProtectedPromo(prices);
          } else {
            setProtectedPromo(null);
          }
        } else {
          setProtectedPromo(null);
        }
      } catch (err) {
        console.error('Failed to calculate protected promo:', err);
        setProtectedPromo(null);
      }
    } else {
      setProtectedPromo(null);
    }

    return { 
      primaryPromo: primaryPromoResult, 
      secondaryPromo: secondaryPromoResult, 
      protectedPromo: protectedPromoResult,
      marginAnalysis: {
        primary: {
          prices: primaryPromoResult,
          marginDetails: primaryMarginDetails,
          reason: primaryPromoReason,
          valid: !!primaryPromoResult
        },
        secondary: {
          prices: secondaryPromoResult,
          marginDetails: secondaryMarginDetails,
          reason: secondaryPromoReason,
          valid: !!secondaryPromoResult
        },
        protected: {
          prices: protectedPromoResult,
          marginDetails: protectedMarginDetails,
          method: protectedMethod,
          valid: !!protectedPromoResult
        }
      }
    };
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

  // Format currency helper - uses selected output currency, rounds up to nearest 10
  const formatCurrency = (amount) => {
    if (typeof amount === 'string') return amount; // Handle 'POA' or 'Customer must provide X/C'
    const rounded = roundUpToNearest10(amount || 0);
    const currencyCode = formData.outputCurrency || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(rounded);
  };

  // Format promo price with currency conversion (null = margin not met for this tier)
  const formatPromoPrice = (amountUSD) => {
    if (amountUSD === null || amountUSD === undefined) return 'N/A';
    const converted = convertFromUSD(amountUSD, formData.outputCurrency);
    return formatCurrency(converted);
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

  // Core search + promo-check logic, parameterized so both the manual Search
  // button and the Latency Matrix click-through funnel through the exact same
  // backend call (/route_finder/find_routes) and promo logic - this is what
  // guarantees a matrix click-through and an equivalent manual search always
  // produce identical primary/diverse paths and promo pricing.
  const performSearch = async (source, destination, bandwidthMbps, { mtuRequired = 1500, routeMode = 'standard' } = {}) => {
    setLoading(true);
    setError(null);
    setSearchResults(null);
    setCrossConnectResults({ source: null, destination: null });
    setProtectedPromo(null);
    setPromoRouteResult(null);

    const searchStartTime = Date.now();

    try {
      const token = localStorage.getItem('authToken');

      const searchParams = {
        source,
        destination,
        bandwidth: bandwidthMbps,
        bandwidth_unit: 'Mbps',
        mtu_required: mtuRequired,
        route_mode: routeMode,
        include_ull: routeMode === 'fastest',
        use_cisco_only_routes: routeMode === 'fastest',
        constraints: {
          protection_required: true,
          mtu_required: mtuRequired
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
      
      // Check for matching promo pricing (includes protected promo check)
      const promoResults = await checkPromoForRoute(results, source, destination, bandwidthMbps);
      
      // Auto-load cross connect data
      const xcResults = await loadCrossConnects(source, destination);

      // Save search log to pricing logs (fire-and-forget, don't block UI)
      const executionTime = Date.now() - searchStartTime;
      try {
        await saveRouteFinderSearchLog({
          searchParameters: {
            source,
            destination,
            bandwidth: bandwidthMbps || null,
            routeMode,
            mtuRequired: mtuRequired || null,
            outputCurrency: formData.outputCurrency || 'USD'
          },
          searchResults: results,
          primaryPromo: promoResults?.primaryPromo || null,
          secondaryPromo: promoResults?.secondaryPromo || null,
          protectedPromo: promoResults?.protectedPromo || null,
          marginAnalysis: promoResults?.marginAnalysis || null,
          crossConnectResults: xcResults || { source: null, destination: null },
          executionTime
        });
      } catch (logErr) {
        console.error('Failed to save search log (non-blocking):', logErr);
      }

      return results;
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed: ' + err.message);
      return null;
    } finally {
      setLoading(false);
    }
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

    setMatrixContext(null); // this is a fresh manual search, not a matrix click-through

    await performSearch(
      formData.source,
      formData.destination,
      formData.bandwidth ? parseFloat(formData.bandwidth) : undefined,
      {
        mtuRequired: formData.mtuRequired ? parseFloat(formData.mtuRequired) : 1500,
        routeMode: formData.routeMode
      }
    );
  };

  const handleRefresh = () => {
    setFormData({
      source: '',
      destination: '',
      bandwidth: '',
      mtuRequired: '',
      routeMode: 'standard',
      outputCurrency: formData.outputCurrency
    });
    setSearchResults(null);
    setPrimaryPromo(null);
    setSecondaryPromo(null);
    setProtectedPromo(null);
    setCrossConnectResults({ source: null, destination: null });
    setPromoRouteResult(null);
    setError(null);
    setSuccess(null);
    setExpandedAccordion('search');
    setDisplayMode(false);
    setMatrixContext(null);
  };

  // Actively searches for the best route between the selected source/destination
  // for which promo pricing is valid at the selected bandwidth - rather than just
  // checking whether the default shortest-latency route happens to qualify.
  const handleFindPromoRoute = async () => {
    if (!formData.source || !formData.destination) {
      setError('Please select both source and destination locations');
      return;
    }

    if (!formData.bandwidth) {
      setError('Bandwidth is required to find promo pricing');
      return;
    }

    const bandwidthValue = parseFloat(formData.bandwidth);
    if (bandwidthValue < 10 || bandwidthValue > 10000) {
      setError('Bandwidth must be between 10 and 10000 Mbps');
      return;
    }

    setPromoRouteLoading(true);
    setError(null);
    setPromoRouteResult(null);

    try {
      const result = await findPromoRoute({
        source: formData.source,
        destination: formData.destination,
        bandwidth: bandwidthValue,
        mtu_required: formData.mtuRequired ? parseFloat(formData.mtuRequired) : 1500,
        route_mode: formData.routeMode,
        include_ull: formData.routeMode === 'fastest',
        use_cisco_only_routes: formData.routeMode === 'fastest'
      });

      setPromoRouteResult(result);
      setExpandedAccordion('promoRoute');
    } catch (err) {
      console.error('Find promo route error:', err);
      setError('Failed to find promo pricing route: ' + (err.response?.data?.error || err.message));
    } finally {
      setPromoRouteLoading(false);
    }
  };

  const promoRouteReasonMessages = {
    no_promo_rule: 'No promo pricing rule exists for this source/destination pair.',
    no_price_configured: 'A promo rule exists for this pair, but no price is configured for the selected bandwidth tier.',
    no_valid_route: 'A promo rule exists, but no physical route satisfies its required/excluded circuit constraints.',
    margin_not_met: 'A route satisfying the promo constraints was found, but it does not meet the minimum margin requirement.'
  };

  const formatLatency = (latency) => {
    return Math.round(latency * 1000) / 1000;
  };

  const formatBandwidth = (bandwidth) => {
    if (!bandwidth) return 'N/A';
    
    if (typeof bandwidth === 'string' && bandwidth.toLowerCase().includes('dark fiber')) {
      return 'Dark Fiber';
    }
    
    const mbps = parseFloat(bandwidth);
    if (isNaN(mbps)) return bandwidth;
    
    if (mbps >= 1000) {
      const gbps = mbps / 1000;
      return Number.isInteger(gbps) ? `${gbps} Gbps` : `${gbps.toFixed(1)} Gbps`;
    }
    
    return `${mbps} Mbps`;
  };

  const getLocationDisplay = (locationCode) => {
    const location = locations.find(loc => loc.location_code === locationCode);
    if (location && location.datacenter_name) {
      return `${location.datacenter_name} (${locationCode})`;
    }
    return locationCode;
  };

  // Render cross connect card for a location
  const renderCrossConnectCard = (xcData, locationType) => {
    if (!xcData) return null;

    return (
      <Card variant="outlined" sx={{ border: 1, borderColor: 'info.main' }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <CableIcon color="info" fontSize="small" />
            <Typography variant="subtitle2" fontWeight="bold">
              Cross Connect — {locationType === 'source' ? 'Source' : 'Destination'}: {xcData.datacenterName || xcData.locationCode}
            </Typography>
            {xcData.mandatory ? (
              <Chip label="Required" size="small" color="warning" variant="filled" sx={{ height: 20, fontSize: '0.7rem' }} />
            ) : null}
            {xcData.customerOwned ? (
              <Chip label="Customer Owned" size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
            ) : null}
          </Box>
          
          {xcData.customerOwned ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Customer must provide X/C
            </Typography>
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" display="block">NRC (One-time)</Typography>
                <Typography variant="body2" fontWeight="bold" color="info.main">
                  {typeof xcData.nrc === 'number' ? formatCurrency(xcData.nrc) : xcData.nrc}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" display="block">MRC (Monthly)</Typography>
                <Typography variant="body2" fontWeight="bold" color="info.main">
                  {typeof xcData.mrc === 'number' ? formatCurrency(xcData.mrc) : xcData.mrc}
                </Typography>
              </Grid>
            </Grid>
          )}
          
          {xcData.notes && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
              {xcData.notes}
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  };

  const handleExport = () => {
    if (!searchResults) return;

    try {
      const currencyCode = formData.outputCurrency || 'USD';
      const tableStyle = 'border-collapse: collapse; width: 100%; margin-bottom: 20px; font-family: Arial, sans-serif;';
      const thStyle = 'border: 1px solid #ddd; padding: 10px; background-color: #4472C4; color: white; text-align: left; font-weight: bold;';
      const tdStyle = 'border: 1px solid #ddd; padding: 8px; text-align: left;';
      const headerStyle = 'color: #2E5090; margin-top: 20px; margin-bottom: 10px; font-family: Arial, sans-serif;';
      const promoHeaderStyle = 'color: #228B22; margin-top: 15px; margin-bottom: 10px; font-family: Arial, sans-serif;';
      const noPromoStyle = 'color: #666; font-style: italic; margin-bottom: 20px; font-family: Arial, sans-serif;';
      const xcHeaderStyle = 'color: #0277BD; margin-top: 15px; margin-bottom: 10px; font-family: Arial, sans-serif;';

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

      const generatePromoPricingTable = (promo, pathType) => {
        if (!promo) return '';
        
        let html = `<h4 style="${promoHeaderStyle}">${pathType} - PROMO PRICING AVAILABLE</h4>`;
        html += `<p style="font-family: Arial, sans-serif; font-size: 13px; color: #555; margin-top: 0; margin-bottom: 10px;"><strong>12 Month Contract - $1,000 NRC Applies to each option</strong></p>`;
        html += `<table style="${tableStyle}">`;
        html += `<thead><tr>`;
        html += `<th style="${thStyle}">Bandwidth</th>`;
        html += `<th style="${thStyle}">Price (${currencyCode}/month)</th>`;
        html += `</tr></thead>`;
        html += `<tbody>`;
        html += `<tr style="background-color: #ffffff;"><td style="${tdStyle}">10 Mbps</td><td style="${tdStyle}">${formatPromoPrice(promo.price_10mb)}</td></tr>`;
        html += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}">100 Mbps</td><td style="${tdStyle}">${formatPromoPrice(promo.price_100mb)}</td></tr>`;
        html += `<tr style="background-color: #ffffff;"><td style="${tdStyle}">1000 Mbps</td><td style="${tdStyle}">${formatPromoPrice(promo.price_1000mb)}</td></tr>`;
        html += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}">10 Gbps</td><td style="${tdStyle}">${formatPromoPrice(promo.price_10gb)}</td></tr>`;
        html += `</tbody></table>`;
        
        return html;
      };

      const generateCrossConnectSection = (xcData, locationType) => {
        if (!xcData) return '';
        
        let html = `<h4 style="${xcHeaderStyle}">Cross Connect — ${locationType}: ${xcData.datacenterName || xcData.locationCode}`;
        if (xcData.mandatory) html += ` <span style="color: #ed6c02; font-size: 12px;">[REQUIRED]</span>`;
        html += `</h4>`;
        
        if (xcData.customerOwned) {
          html += `<p style="font-family: Arial, sans-serif; font-style: italic; color: #666;">Customer must provide X/C</p>`;
        } else {
          html += `<table style="${tableStyle}">`;
          html += `<thead><tr>`;
          html += `<th style="${thStyle}">NRC (One-time)</th>`;
          html += `<th style="${thStyle}">MRC (Monthly)</th>`;
          html += `</tr></thead>`;
          html += `<tbody>`;
          html += `<tr><td style="${tdStyle}">${typeof xcData.nrc === 'number' ? formatCurrency(xcData.nrc) : xcData.nrc}</td>`;
          html += `<td style="${tdStyle}">${typeof xcData.mrc === 'number' ? formatCurrency(xcData.mrc) : xcData.mrc}</td></tr>`;
          html += `</tbody></table>`;
        }
        
        if (xcData.notes) {
          html += `<p style="font-family: Arial, sans-serif; font-style: italic; font-size: 12px; color: #666;">${xcData.notes}</p>`;
        }
        
        return html;
      };

      // Build HTML email body
      let emailBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;">`;
      
      emailBody += `<h2 style="color: #2E5090; border-bottom: 2px solid #4472C4; padding-bottom: 10px;">Route Finder Results</h2>`;
      emailBody += `<table style="margin-bottom: 20px; font-family: Arial, sans-serif;">`;
      emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Source Location:</td><td>${getLocationDisplay(formData.source)}</td></tr>`;
      emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Destination Location:</td><td>${getLocationDisplay(formData.destination)}</td></tr>`;
      emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Bandwidth:</td><td>${formData.bandwidth || 'Not specified'} Mbps</td></tr>`;
      emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Route Mode:</td><td>${formData.routeMode === 'fastest' ? 'Fastest Route' : 'Standard Route'}</td></tr>`;
      emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Currency:</td><td>${currencyCode}</td></tr>`;
      emailBody += `<tr><td style="padding: 5px 20px 5px 0; font-weight: bold;">Search Date:</td><td>${new Date().toLocaleString()}</td></tr>`;
      emailBody += `</table>`;

      // Cross Connect Pricing
      if (crossConnectResults.source || crossConnectResults.destination) {
        emailBody += `<hr style="margin-top: 20px; margin-bottom: 20px; border: none; border-top: 1px solid #ccc;">`;
        emailBody += `<h3 style="${headerStyle}">Cross Connect Pricing</h3>`;
        emailBody += generateCrossConnectSection(crossConnectResults.source, 'Source');
        emailBody += generateCrossConnectSection(crossConnectResults.destination, 'Destination');
      }

      // Primary Path
      if (searchResults.primaryPath) {
        emailBody += generateRouteTable(searchResults.primaryPath, 'Primary');
      }

      if (primaryPromo) {
        emailBody += generatePromoPricingTable(primaryPromo, 'PRIMARY PATH');
      } else {
        emailBody += `<p style="${noPromoStyle}">PRIMARY PATH - Route not available for automatic promo pricing</p>`;
      }

      // Secondary Path
      if (searchResults.diversePath) {
        emailBody += generateRouteTable(searchResults.diversePath, 'Secondary');
        
        if (secondaryPromo) {
          emailBody += generatePromoPricingTable(secondaryPromo, 'SECONDARY PATH');
        } else {
          emailBody += `<p style="${noPromoStyle}">SECONDARY PATH - Route not available for automatic promo pricing</p>`;
        }
      } else {
        emailBody += `<p style="${noPromoStyle}">Secondary Route: No diverse path available</p>`;
      }

      // Protected Promo Pricing
      if (protectedPromo) {
        emailBody += `<hr style="margin-top: 20px; margin-bottom: 20px; border: none; border-top: 2px solid #1565C0;">`;
        emailBody += `<h3 style="color: #1565C0; margin-top: 15px; margin-bottom: 10px; font-family: Arial, sans-serif;">PROTECTED SERVICE - PROMO PRICING</h3>`;
        emailBody += `<p style="font-family: Arial, sans-serif; font-size: 13px; color: #555; margin-bottom: 10px;">Protected pricing includes the diverse secondary route, based on the promo's Protection Pricing %. Subject to margin requirements.</p>`;
        emailBody += `<table style="${tableStyle}">`;
        emailBody += `<thead><tr>`;
        emailBody += `<th style="${thStyle}">Bandwidth</th>`;
        emailBody += `<th style="${thStyle}">Protected Price (${currencyCode}/month)</th>`;
        emailBody += `</tr></thead>`;
        emailBody += `<tbody>`;
        emailBody += `<tr style="background-color: #ffffff;"><td style="${tdStyle}">10 Mbps</td><td style="${tdStyle}">${formatPromoPrice(protectedPromo.price_10mb)}</td></tr>`;
        emailBody += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}">100 Mbps</td><td style="${tdStyle}">${formatPromoPrice(protectedPromo.price_100mb)}</td></tr>`;
        emailBody += `<tr style="background-color: #ffffff;"><td style="${tdStyle}">1000 Mbps</td><td style="${tdStyle}">${formatPromoPrice(protectedPromo.price_1000mb)}</td></tr>`;
        emailBody += `<tr style="background-color: #f9f9f9;"><td style="${tdStyle}">10 Gbps</td><td style="${tdStyle}">${formatPromoPrice(protectedPromo.price_10gb)}</td></tr>`;
        emailBody += `</tbody></table>`;
      }

      emailBody += `<p style="font-family: Arial, sans-serif; color: #666; margin-top: 20px;"><em>Note: Promo pricing is budgetary and subject to capacity confirmation.</em></p>`;

      // Terms and Conditions
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

      const today = new Date().toLocaleDateString();
      const subject = `Route Finder - ${formData.source} to ${formData.destination} - ${today}`;
      
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
      
      const blob = new Blob([emailContent], { type: 'message/rfc822' });
      const url = window.URL.createObjectURL(blob);
      
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      
      const fileTimestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const sourceCode = formData.source.replace(/[^a-zA-Z0-9]/g, '_');
      const destCode = formData.destination.replace(/[^a-zA-Z0-9]/g, '_');
      downloadLink.download = `RouteFinder_${sourceCode}_${destCode}_${fileTimestamp}.eml`;
      
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
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

      {/* Latency Matrix Display Mode Banner */}
      {displayMode && matrixContext && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Run New Search
            </Button>
          }
        >
          Full route search for the {matrixContext.tier} pair selected from the latency matrix: {matrixContext.sourceCity} → {matrixContext.destinationCity}
        </Alert>
      )}

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
            <Grid item xs={12} md={4}>
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
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="MTU Required (minimum)"
                type="number"
                value={formData.mtuRequired}
                onChange={(e) => handleInputChange('mtuRequired', e.target.value)}
                helperText="Default: 1500 if not specified - Maximum service MTU is 9000"
              />
            </Grid>

            {/* Currency Selector */}
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Output Currency</InputLabel>
                <Select
                  value={formData.outputCurrency}
                  label="Output Currency"
                  onChange={(e) => handleInputChange('outputCurrency', e.target.value)}
                >
                  {availableCurrencies.map(currency => (
                    <MenuItem key={currency} value={currency}>{currency}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Search Buttons */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} flexWrap="wrap">
                <LoadingButton
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={handleSearch}
                  loading={loading}
                  disabled={!formData.source || !formData.destination}
                >
                  Find Route
                </LoadingButton>
                <LoadingButton
                  variant="outlined"
                  color="success"
                  startIcon={<LocalOfferIcon />}
                  onClick={handleFindPromoRoute}
                  loading={promoRouteLoading}
                  disabled={!formData.source || !formData.destination || !formData.bandwidth}
                >
                  Find Promo Pricing
                </LoadingButton>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Finds the best route between the selected locations for which promo pricing is valid at the specified bandwidth. Requires bandwidth to be set.
              </Typography>
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

            {/* Route Lifecycle Notes */}
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
                          <Typography variant="subtitle2" color="success.main" fontWeight="bold">
                            Promo Pricing Available
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                          $1,000 NRC applicable for each option - X/Cs Excluded - Full Terms available from Pricing Team
                        </Typography>
                        <Grid container spacing={1}>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary" display="block">10 Mbps</Typography>
                            <Typography variant="body2" color="success.main" fontWeight="bold">{formatPromoPrice(primaryPromo.price_10mb)}</Typography>
                          </Grid>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary" display="block">100 Mbps</Typography>
                            <Typography variant="body2" color="success.main" fontWeight="bold">{formatPromoPrice(primaryPromo.price_100mb)}</Typography>
                          </Grid>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary" display="block">1000 Mbps</Typography>
                            <Typography variant="body2" color="success.main" fontWeight="bold">{formatPromoPrice(primaryPromo.price_1000mb)}</Typography>
                          </Grid>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary" display="block">10 Gbps</Typography>
                            <Typography variant="body2" color="success.main" fontWeight="bold">{formatPromoPrice(primaryPromo.price_10gb)}</Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    ) : (
                      <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
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
                            <Typography variant="subtitle2" color="success.main" fontWeight="bold">
                              Promo Pricing Available
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                            $1,000 NRC applicable for each option - X/Cs Excluded - Full Terms available from Pricing Team
                          </Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={3}>
                              <Typography variant="caption" color="text.secondary" display="block">10 Mbps</Typography>
                              <Typography variant="body2" color="success.main" fontWeight="bold">{formatPromoPrice(secondaryPromo.price_10mb)}</Typography>
                            </Grid>
                            <Grid item xs={3}>
                              <Typography variant="caption" color="text.secondary" display="block">100 Mbps</Typography>
                              <Typography variant="body2" color="success.main" fontWeight="bold">{formatPromoPrice(secondaryPromo.price_100mb)}</Typography>
                            </Grid>
                            <Grid item xs={3}>
                              <Typography variant="caption" color="text.secondary" display="block">1000 Mbps</Typography>
                              <Typography variant="body2" color="success.main" fontWeight="bold">{formatPromoPrice(secondaryPromo.price_1000mb)}</Typography>
                            </Grid>
                            <Grid item xs={3}>
                              <Typography variant="caption" color="text.secondary" display="block">10 Gbps</Typography>
                              <Typography variant="body2" color="success.main" fontWeight="bold">{formatPromoPrice(secondaryPromo.price_10gb)}</Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      ) : (
                        <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
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

              {/* Protected Service Promo Pricing - Only when the primary promo rule has a Protection Pricing % configured */}
              {protectedPromo && primaryPromo && (
                <Grid item xs={12}>
                  <Card sx={{ border: 2, borderColor: 'primary.main', bgcolor: 'primary.50' }}>
                    <CardHeader 
                      title={
                        <Box display="flex" alignItems="center" gap={1}>
                          <SecurityIcon color="primary" />
                          <span>Protected Service Pricing</span>
                          <Chip 
                            icon={<LocalOfferIcon />} 
                            label="Promo Protected" 
                            color="primary" 
                            size="small" 
                          />
                        </Box>
                      }
                      subheader="Protected pricing available for this promo — includes the diverse secondary route"
                    />
                    <CardContent>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                        $1,000 NRC applicable for each option - X/Cs Excluded - Full Terms available from Pricing Team
                      </Typography>
                      <Grid container spacing={1}>
                        <Grid item xs={3}>
                          <Typography variant="caption" color="text.secondary" display="block">10 Mbps</Typography>
                          <Typography variant="body2" color="primary.main" fontWeight="bold">{formatPromoPrice(protectedPromo.price_10mb)}</Typography>
                        </Grid>
                        <Grid item xs={3}>
                          <Typography variant="caption" color="text.secondary" display="block">100 Mbps</Typography>
                          <Typography variant="body2" color="primary.main" fontWeight="bold">{formatPromoPrice(protectedPromo.price_100mb)}</Typography>
                        </Grid>
                        <Grid item xs={3}>
                          <Typography variant="caption" color="text.secondary" display="block">1000 Mbps</Typography>
                          <Typography variant="body2" color="primary.main" fontWeight="bold">{formatPromoPrice(protectedPromo.price_1000mb)}</Typography>
                        </Grid>
                        <Grid item xs={3}>
                          <Typography variant="caption" color="text.secondary" display="block">10 Gbps</Typography>
                          <Typography variant="body2" color="primary.main" fontWeight="bold">{formatPromoPrice(protectedPromo.price_10gb)}</Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Cross Connect Pricing - Below all pricing cards */}
              {(crossConnectResults.source || crossConnectResults.destination) && (
                <Grid item xs={12}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CableIcon color="info" fontSize="small" />
                      Cross Connect Pricing
                    </Typography>
                    <Grid container spacing={2}>
                      {crossConnectResults.source && (
                        <Grid item xs={12} md={6}>
                          {renderCrossConnectCard(crossConnectResults.source, 'source')}
                        </Grid>
                      )}
                      {crossConnectResults.destination && (
                        <Grid item xs={12} md={6}>
                          {renderCrossConnectCard(crossConnectResults.destination, 'destination')}
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Find Promo Pricing Results */}
      {promoRouteResult && (
        <Accordion
          expanded={expandedAccordion === 'promoRoute'}
          onChange={() => setExpandedAccordion(expandedAccordion === 'promoRoute' ? '' : 'promoRoute')}
          sx={{ mt: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <LocalOfferIcon sx={{ mr: 1 }} color="success" />
              <Typography variant="h6">Promo Pricing Route</Typography>
              {promoRouteResult.found && (
                <Chip
                  label="Promo Route Found"
                  color="success"
                  size="small"
                  sx={{ ml: 1.5 }}
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {!promoRouteResult.found ? (
              <Alert severity="info">
                {promoRouteReasonMessages[promoRouteResult.reason] || 'No promo-eligible route was found for this bandwidth.'}
              </Alert>
            ) : (
              <Card sx={{ border: 2, borderColor: 'success.main' }}>
                <CardHeader
                  title={
                    <Box display="flex" alignItems="center" gap={1}>
                      <span>Best Promo-Eligible Route</span>
                      <Chip icon={<LocalOfferIcon />} label="Promo Available" color="success" size="small" />
                    </Box>
                  }
                  subheader={promoRouteResult.route.path.join(' → ')}
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
                        {promoRouteResult.route.route?.map((segment, index) => (
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
                      <strong>Total Latency:</strong> {formatLatency(promoRouteResult.route.totalLatency)}ms RTD
                    </Typography>
                    <Typography variant="body2">
                      <strong>Total Hops:</strong> {promoRouteResult.route.hops}
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 3, p: 2, bgcolor: 'success.50', borderRadius: 1, border: 1, borderColor: 'success.200' }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <LocalOfferIcon color="success" fontSize="small" />
                      <Typography variant="subtitle2" color="success.main" fontWeight="bold">
                        Promo Price for {formatBandwidth(formData.bandwidth)}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      $1,000 NRC applicable - X/Cs Excluded - Full Terms available from Pricing Team
                    </Typography>
                    <Typography variant="h6" color="success.main" fontWeight="bold">
                      {formatPromoPrice(promoRouteResult.price)} / month
                    </Typography>
                    {promoRouteResult.usedRequiredCircuit && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        Route includes required circuit {promoRouteResult.usedRequiredCircuit} to qualify for this promo.
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            )}
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
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
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
                          <Typography variant="body2" color="success.main" fontWeight="medium">
                            {formatPromoPrice(rule.price_10mb)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="success.main" fontWeight="medium">
                            {formatPromoPrice(rule.price_100mb)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="success.main" fontWeight="medium">
                            {formatPromoPrice(rule.price_1000mb)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="success.main" fontWeight="medium">
                            {formatPromoPrice(rule.price_10gb)}
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
          <Paper variant="outlined" sx={{ mt: 3, p: 2, bgcolor: 'action.hover' }}>
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
