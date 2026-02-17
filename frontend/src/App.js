import React, { useState, useEffect, useRef } from 'react';
import {
  Box, CssBaseline, Drawer, List, ListItem, ListItemIcon, ListItemText, AppBar, Toolbar, Typography, Button, Container, Paper, 
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Collapse, Menu, MenuItem, IconButton, Chip, CircularProgress,
  Alert, Divider, Avatar, Grid, Snackbar, Slider, Badge, Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import RouterIcon from '@mui/icons-material/Router';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import WarningIcon from '@mui/icons-material/Warning';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import HistoryIcon from '@mui/icons-material/History';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import DataObjectIcon from '@mui/icons-material/DataObject';
import TableRowsIcon from '@mui/icons-material/TableRows';
import ContactsIcon from '@mui/icons-material/Contacts';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SettingsIcon from '@mui/icons-material/Settings';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CalculateIcon from '@mui/icons-material/Calculate';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ApiIcon from '@mui/icons-material/Api';
import TextFormatIcon from '@mui/icons-material/TextFormat';
import FeedbackIcon from '@mui/icons-material/Feedback';
import NotificationsIcon from '@mui/icons-material/Notifications';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PublicIcon from '@mui/icons-material/Public';
import SearchIcon from '@mui/icons-material/Search';
import LanIcon from '@mui/icons-material/Lan';
import { AuthProvider, useAuth } from './AuthContext';
import { TextSizeProvider, useTextSize } from './TextSizeContext';
import LoginForm from './LoginForm';
import UserRegistration from './UserRegistration';
import NetworkRoutesTable from './NetworkRoutesTable';
import NetworkDesignTool from './NetworkDesignTool';
import AllocatedCostCalculator from './AllocatedCostCalculator';
import ExchangeRatesManager from './ExchangeRatesManager';
import ExchangePricingTool from './ExchangePricingTool';
import LocationDataManager from './LocationDataManager';
import MinimumPricingManager from './MinimumPricingManager';
import PricingLogicManager from './PricingLogicManager';
import PromoPricingManager from './PromoPricingManager';
import CNXColocationManager from './CNXColocationManager';
import ColocationAvailabilityDashboard from './components/ColocationAvailabilityDashboard';
import ColocationPricingTool from './components/ColocationPricingTool';
import UserManagement from './UserManagement';
import ChangeLogsViewer from './ChangeLogsViewer';
import CoreOutagesTable from './CoreOutagesTable';
import CarriersManager from './CarriersManager';
import ExchangeDataManager from './ExchangeDataManager';
import ExtranetDataManager from './ExtranetDataManager';
import ExtranetPricingAdmin from './ExtranetPricingAdmin';
import ExtranetPricingTool from './ExtranetPricingTool';
import FeedbackManager from './FeedbackManager';
import BulkUpload from './BulkUpload';
import LiveLatencyAdminManager from './LiveLatencyAdminManager';
import AnalyticsDashboard from './AnalyticsDashboard';
import SystemSettingsManager from './SystemSettingsManager';
import CarrierQuoteRepository from './CarrierQuoteRepository';
import AddCarrierQuote from './AddCarrierQuote';
import OneDirectoryPricingTool from './OneDirectoryPricingTool';
import OneDirectoryAdmin from './OneDirectoryAdmin';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import PhoneIcon from '@mui/icons-material/Phone';

import { fetchRoutes, fetchRoutesWithKMZ, searchRoutes, exportRoutesCSV, addRoute, editRoute, deleteRoute, uploadKMZ, fetchRoute, uploadTestResults, getLiveLatencyStatus, getRouteTracking, getFeedbackNotificationCount } from './api';
import { API_BASE_URL } from './config';
import SearchExportBar from './SearchExportBar';
import RouteFormDialog from './RouteFormDialog';
import DarkFiberModal from './DarkFiberModal';
import KMZMapViewer from './KMZMapViewer';
import RouteFinder from './RouteFinder';
import RouteChanges from './RouteChanges';
import ForcedPasswordChange from './ForcedPasswordChange';

const drawerWidth = 280;

// Main authenticated application component
function AuthenticatedApp() {
  const { user, logout, isAuthenticated, loading: authLoading, hasModuleAccess, isModuleVisible, hasPermission, hasRole, permissions, modulePermissions, connectionError, passwordResetRequired } = useAuth();
  const { textSizeScale, updateTextSize, resetTextSize } = useTextSize();
  
  // View state for non-authenticated views
  const [currentView, setCurrentView] = useState('login'); // 'login' or 'register'
  
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState(null);
  const [routeTracking, setRouteTracking] = useState(null);
  const [darkFiberOpen, setDarkFiberOpen] = useState(false);
  const [darkFiberCircuitId, setDarkFiberCircuitId] = useState(null);
  const [networkRoutesOpen, setNetworkRoutesOpen] = useState(true);
  
  // KMZ Map Viewer state
  const [routeFinderMapData, setRouteFinderMapData] = useState(null);
  
  // Route Finder state preservation (to maintain search results when navigating to/from KMZ viewer)
  const [routeFinderState, setRouteFinderState] = useState(null);
  
  // New state for tab management
  const [currentTab, setCurrentTab] = useState('welcome');
  const [networkDesignOpen, setNetworkDesignOpen] = useState(false);
  const [exchangeDataOpen, setExchangeDataOpen] = useState(false);
  const [extranetDataOpen, setExtranetDataOpen] = useState(false);
  const [exchangeRatesOpen, setExchangeRatesOpen] = useState(false);
  const [networkDataOpen, setNetworkDataOpen] = useState(false);
  const [cnxColocationOpen, setCnxColocationOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [carrierQuoteOpen, setCarrierQuoteOpen] = useState(false);
  const [editQuoteId, setEditQuoteId] = useState(null);
  
  // User menu state
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  
  // Feedback notification count
  const [notificationCount, setNotificationCount] = useState(0);
  const [feedbackInitialTab, setFeedbackInitialTab] = useState(0);
  
  // Documentation URL from system settings
  const [documentationUrl, setDocumentationUrl] = useState('https://docs.example.com');
  
  // Helper function to ensure URL has protocol
  const ensureProtocol = (url) => {
    if (!url) return 'https://docs.example.com';
    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }
    return `https://${trimmedUrl}`;
  };
  
  // Live latency status
  const [liveLatencyStatus, setLiveLatencyStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  
  // Client-side filtering state for Network Routes (like LocationDataManager pattern)
  const [routeFilters, setRouteFilters] = useState({
    circuit_id: '',
    location: '',
    cable_system: '',
    bandwidth: '',
    is_special: '',
    route_status: 'All',
    regions: []
  });
  const [isServerSideFiltered, setIsServerSideFiltered] = useState(false);
  const [filterResetTrigger, setFilterResetTrigger] = useState(0); // Used to trigger SearchExportBar reset
  
  // Load network routes data - moved before early returns to follow Rules of Hooks
  useEffect(() => {
    // Extra safeguard: ensure token exists before making API calls
    const token = localStorage.getItem('authToken');
    if (isAuthenticated && hasModuleAccess('network_routes') && token) {
      setLoading(true);
      fetchRoutes()
        .then(data => {
          setRows(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Network routes fetch error:', err);
          setError('Failed to fetch data');
          setLoading(false);
        });
    }
  }, [isAuthenticated, hasModuleAccess]);

  // Check live latency status periodically when on network routes tab
  useEffect(() => {
    if (currentTab === 'network-routes' && hasModuleAccess('network_routes')) {
      checkLiveLatencyStatus(); // Initial check
      
      // Set up periodic checking every 5 minutes
      const interval = setInterval(checkLiveLatencyStatus, 5 * 60 * 1000);
      
      return () => clearInterval(interval);
    }
  }, [currentTab, hasModuleAccess]);

  // Clear filters and reload data when navigating away from or back to network routes
  const prevTabRef = useRef(currentTab);
  useEffect(() => {
    const prevTab = prevTabRef.current;
    
    // When navigating away from network routes, clear filters
    if (prevTab === 'network-routes' && currentTab !== 'network-routes') {
      setRouteFilters({
        circuit_id: '',
        location: '',
        cable_system: '',
        bandwidth: '',
        is_special: '',
        route_status: 'All',
        regions: []
      });
      setIsServerSideFiltered(false);
      // Trigger SearchExportBar reset by incrementing the trigger
      setFilterResetTrigger(prev => prev + 1);
    }
    
    // When navigating back to network routes, reload all data
    if (prevTab !== 'network-routes' && currentTab === 'network-routes' && hasModuleAccess('network_routes')) {
      const token = localStorage.getItem('authToken');
      if (token) {
        fetchRoutes()
          .then(data => {
            setRows(data);
            setIsServerSideFiltered(false);
          })
          .catch(err => {
            console.error('Failed to reload network routes:', err);
          });
      }
    }
    
    // When navigating away from KMZ viewer, clear route finder map data
    if (prevTab === 'kmz-viewer' && currentTab !== 'kmz-viewer') {
      setRouteFinderMapData(null);
    }
    
    prevTabRef.current = currentTab;
  }, [currentTab, hasModuleAccess]);

  // Load documentation URL from system settings
  useEffect(() => {
    const loadDocumentationUrl = async () => {
      const token = localStorage.getItem('authToken');
      if (!isAuthenticated || !token) {
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/system-settings/documentation_url`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setDocumentationUrl(data.setting_value || 'https://docs.example.com');
        }
      } catch (err) {
        // Silently fail - keep default URL
      }
    };

    if (isAuthenticated) {
      loadDocumentationUrl();
    }
  }, [isAuthenticated]);

  // Poll feedback notification count every 30 seconds (only when authenticated)
  useEffect(() => {
    const loadNotificationCount = async () => {
      // Only load if authenticated and has token
      const token = localStorage.getItem('authToken');
      if (!isAuthenticated || !token) {
        return;
      }

      try {
        const data = await getFeedbackNotificationCount();
        setNotificationCount(data.count || 0);
      } catch (error) {
        // Silently fail if not authenticated - don't spam console
        if (error.response?.status !== 401 && error.response?.status !== 403) {
          console.error('Failed to load notification count:', error);
        }
      }
    };

    if (isAuthenticated) {
      loadNotificationCount(); // Initial load
      const interval = setInterval(loadNotificationCount, 30000); // Poll every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Reset feedback initial tab when navigating away from feedback
  useEffect(() => {
    if (currentTab !== 'feedback') {
      setFeedbackInitialTab(0);
    }
  }, [currentTab]);

  // Keep users on welcome page - let them choose where to go
  // Removed auto-selection logic to prevent permission errors
  
  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }
  
  // Show appropriate view if not authenticated
  if (!isAuthenticated) {
    if (currentView === 'register') {
      return <UserRegistration onShowLogin={() => setCurrentView('login')} />;
    }
    return <LoginForm onShowRegister={() => setCurrentView('register')} />;
  }

  // Client-side filtering logic (like LocationDataManager pattern)
  // Skip client-side filtering if we already did server-side filtering
  const filteredRows = isServerSideFiltered ? rows : rows.filter(route => {
    const matchesCircuitId = !routeFilters.circuit_id || 
      route.circuit_id.toLowerCase().includes(routeFilters.circuit_id.toLowerCase());
    
    const matchesLocation = !routeFilters.location || 
      route.location_a.toLowerCase().includes(routeFilters.location.toLowerCase()) ||
      route.location_b.toLowerCase().includes(routeFilters.location.toLowerCase());
    
    const matchesCableSystem = !routeFilters.cable_system || 
      (route.cable_system && route.cable_system.toLowerCase().includes(routeFilters.cable_system.toLowerCase()));
    
    const matchesBandwidth = !routeFilters.bandwidth || 
      (route.bandwidth && route.bandwidth.toString() === routeFilters.bandwidth);
    
    // Handle three-state Special/ULL filter: '' (blank/all), '1' (yes), '0' (no)
    const matchesSpecial = !routeFilters.is_special || 
      (routeFilters.is_special === '1' && (route.is_special === 1 || route.is_special === true)) ||
      (routeFilters.is_special === '0' && (route.is_special === 0 || route.is_special === false));
    
    const matchesRegion = !routeFilters.regions || routeFilters.regions.length === 0 || 
      routeFilters.regions.includes(route.region);
    
    // Route status filter - 'All' shows all, otherwise match exact status
    const routeStatus = route.route_status || 'Active';
    const matchesStatus = routeFilters.route_status === 'All' || routeStatus === routeFilters.route_status;
    
    return matchesCircuitId && matchesLocation && matchesCableSystem && matchesBandwidth && matchesSpecial && matchesRegion && matchesStatus;
  });

  const handleMoreDetails = async (row) => {
    setDetailsRow(row);
    setDetailsOpen(true);
    
    // Fetch tracking information
    try {
      const tracking = await getRouteTracking(row.circuit_id);
      setRouteTracking(tracking);
    } catch (err) {
      console.error('Failed to fetch route tracking:', err);
      setRouteTracking(null);
    }
  };

  // Helper function to format date as "Jan 15 2025 2:30PM GMT"
  const formatTrackingDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    try {
      const date = new Date(dateString);
      const options = {
        month: 'short',
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      };
      return date.toLocaleString('en-US', options).replace(',', '') + ' GMT';
    } catch (err) {
      return 'Invalid date';
    }
  };

  const handleSearch = async (filters) => {
    if (!hasPermission('network_routes', 'view')) return;
    
    try {
      // Use API search when there are filters (excluding regions which is client-side only)
      const { regions, ...serverFilters } = filters;
      const hasServerFilters = Object.values(serverFilters).some(value => value && value !== '');
      
      if (hasServerFilters) {
        const data = await searchRoutes(serverFilters);
        setRows(data);
        setIsServerSideFiltered(false); // Still need client-side filtering for regions
        setRouteFilters({
          circuit_id: filters.circuit_id || '',
          location: filters.location_a || filters.location_b || filters.location || '',
          cable_system: filters.cable_system || '',
          bandwidth: filters.bandwidth || '',
          is_special: filters.is_special || '',
          regions: filters.regions || [],
          route_status: filters.route_status || 'All'
        });
      } else {
        // No server-side filters - load all routes and do client-side filtering
        const data = await fetchRoutes();
        setRows(data);
        setIsServerSideFiltered(false); // Use client-side filtering
        setRouteFilters({
          circuit_id: '',
          location: '',
          cable_system: '',
          bandwidth: '',
          is_special: '',
          regions: filters.regions || [],
          route_status: filters.route_status || 'All'
        });
      }
    } catch (error) {
      setError('Failed to search routes: ' + error.message);
    }
  };

  const handleExport = () => {
    if (!hasPermission('network_routes', 'view')) return;
    // Safety check: prevent Sales permission users from exporting CSV
    if (modulePermissions?.network_routes === 'sales') return;
    
    exportRoutesCSV()
      .then(response => {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'network_routes.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(err => {
        setError('Failed to export');
      });
  };

  const handleAdd = () => {
    if (!hasPermission('network_routes', 'create')) return;
    
    setFormMode('add');
    setSelectedRow(null);
    setFormOpen(true);
  };

  const handleEdit = () => {
    if (!hasPermission('network_routes', 'edit')) return;
    
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleDelete = () => {
    if (!hasPermission('network_routes', 'delete')) return;
    
    setDeleteConfirmOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedRow(null);
  };

  const handleFormSubmit = async (values, file, testResultsFiles) => {
    setLoading(true);
    
    try {
      let uploadedFiles = 0;
      if (formMode === 'add') {
        await addRoute(values);
        if (file) await uploadKMZ(values.circuit_id, file);
        if (testResultsFiles && testResultsFiles.length > 0) {
          await uploadTestResults(values.circuit_id, testResultsFiles);
          uploadedFiles = testResultsFiles.length;
        }
      } else if (formMode === 'edit') {
        await editRoute(selectedRow.circuit_id, values);
        if (file) await uploadKMZ(selectedRow.circuit_id, file);
        if (testResultsFiles && testResultsFiles.length > 0) {
          await uploadTestResults(selectedRow.circuit_id, testResultsFiles);
          uploadedFiles = testResultsFiles.length;
        }
      }
      
      await refreshData();
      setFormOpen(false);
      setSelectedRow(null);
      
      if (uploadedFiles > 0) {
        setError('');
        alert(`✅ Successfully uploaded ${uploadedFiles} test results file${uploadedFiles > 1 ? 's' : ''}!`);
      }
    } catch (err) {
      console.error('Form submission error:', err);
      setError('Failed to save data: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  // Check live latency status for error banner
  const checkLiveLatencyStatus = async () => {
    if (currentTab !== 'network-routes') return; // Only check when on network routes tab
    
    setStatusLoading(true);
    try {
      const status = await getLiveLatencyStatus();
      setLiveLatencyStatus(status);
    } catch (error) {
      console.error('Failed to check live latency status:', error);
      setLiveLatencyStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      const data = await fetchRoutes();
      setRows(data);
      setIsServerSideFiltered(false); // Reset to client-side filtering
      
      // Clear all filters
      setRouteFilters({
        circuit_id: '',
        location: '',
        cable_system: '',
        bandwidth: '',
        is_special: '',
        regions: [],
        route_status: 'All'
      });
      
      // Trigger SearchExportBar reset by incrementing the trigger
      setFilterResetTrigger(prev => prev + 1);
      
      // Also refresh live latency status if on network routes tab
      if (currentTab === 'network-routes') {
        checkLiveLatencyStatus();
      }
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  };

  const handleFileDeleted = () => {
    refreshData();
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteRoute(selectedRow.circuit_id);
      await refreshData();
      setDeleteConfirmOpen(false);
    } catch (err) {
      // Check if this is a dark fiber details error
      if (err.response?.status === 400 && err.response?.data?.darkFiberDetails) {
        const darkFiberDetails = err.response.data.darkFiberDetails;
        const detailsList = darkFiberDetails.map(detail => 
          `• ${detail.dwdm_wavelength} (UCN: ${detail.dwdm_ucn || 'None'})`
        ).join('\n');
        
        setError(`Cannot delete network route with existing dark fiber details:\n\n${detailsList}\n\nPlease delete all dark fiber details first.`);
      } else {
        setError('Failed to delete route: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleDetailsSave = async (values) => {
    try {
      await editRoute(detailsRow.circuit_id, values);
      await refreshData();
      setDetailsOpen(false);
    } catch (err) {
      setError('Failed to save details');
    }
  };

  const handleOpenDarkFiber = (circuitId) => {
    setDarkFiberCircuitId(circuitId);
    setDarkFiberOpen(true);
  };


  const handleUserMenuClick = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleNotificationClick = () => {
    // Set initial tab based on user role
    // Tab 0: New Submission
    // Tab 1: My Submissions (for regular users)
    // Tab 2: Admin Dashboard (for admins)
    const targetTab = user?.role === 'administrator' ? 2 : 1;
    setFeedbackInitialTab(targetTab);
    setCurrentTab('feedback');
  };

  const handleLogout = () => {
    logout();
    setUserMenuAnchor(null);
  };

  // Handle View Map from Route Finder
  const handleRouteFinderViewMap = (mapData) => {
    setRouteFinderMapData(mapData);
    setCurrentTab('kmz-viewer');
  };

  // Clear route finder map data when navigating away from KMZ viewer
  const handleKMZViewerClose = () => {
    setRouteFinderMapData(null);
    setCurrentTab('route-finder');
  };

  // Handle navigation to Network Routes from Route Updates (clicking circuit ID)
  const handleNavigateToRoute = (circuitId) => {
    if (circuitId) {
      // Set the circuit_id filter and navigate to network-routes
      setRouteFilters(prev => ({
        ...prev,
        circuit_id: circuitId
      }));
      setFilterResetTrigger(prev => prev + 1); // Trigger SearchExportBar to show the filter
      setCurrentTab('network-routes');
    }
  };

  const renderMainContent = () => {
    switch (currentTab) {
      case 'network-routes':
        return hasModuleAccess('network_routes') ? (
          <Box>
            {/* Live Latency Error Banner */}
            {liveLatencyStatus && liveLatencyStatus.status === 'stale' && (
              <Alert 
                severity="error" 
                sx={{ mb: 2 }}
                action={
                  <Button 
                    color="inherit" 
                    size="small" 
                    onClick={checkLiveLatencyStatus}
                    disabled={statusLoading}
                    startIcon={statusLoading ? <CircularProgress size={16} color="inherit" /> : null}
                  >
                    {statusLoading ? 'Checking...' : 'Refresh Status'}
                  </Button>
                }
              >
                <strong>Live Latency Data Unavailable:</strong> {liveLatencyStatus.message}
              </Alert>
            )}
            
            <NetworkRoutesTable
              rows={filteredRows}
              loading={loading}
              error={error}
              onMoreDetails={handleMoreDetails}
              onSelectRow={setSelectedRow}
              selectedRow={selectedRow}
              onOpenDarkFiber={handleOpenDarkFiber}
              hasPermission={hasPermission}
              userRole={user?.role}
              modulePermission={modulePermissions?.network_routes}
              userId={user?.id}
              onRefreshSuccess={refreshData}
            />
          </Box>
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'network-design':
        return hasModuleAccess('network_design') ? (
          <NetworkDesignTool />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'allocated-cost-calculator':
        return hasModuleAccess('allocated_cost_calculator') ? (
          <AllocatedCostCalculator />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'minimum-pricing':
        return hasModuleAccess('locations') ? (
          <MinimumPricingManager hasPermission={hasPermission} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'pricing-logic':
        return hasRole('administrator') ? (
          <PricingLogicManager hasPermission={hasRole} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'promo-pricing':
        return hasRole('administrator') ? (
          <PromoPricingManager hasPermission={hasRole} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'exchange-rates':
        return hasModuleAccess('exchange_rates') ? (
          <ExchangeRatesManager hasPermission={hasPermission} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
            case 'location-data':
        return hasModuleAccess('locations') ? (
          <LocationDataManager 
            hasPermission={hasPermission} 
            userRole={user?.role}
            modulePermission={modulePermissions?.locations}
          />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'cnx-colocation-inventory':
        return hasModuleAccess('cnx_colocation_inventory') ? (
          <CNXColocationManager hasPermission={hasPermission} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'cnx-colocation-availability':
        return hasModuleAccess('cnx_colocation_availability') ? (
          <ColocationAvailabilityDashboard />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'cnx-colocation-pricing':
        return hasModuleAccess('cnx_colocation_pricing') ? (
          <ColocationPricingTool hasPermission={hasPermission} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'voice-one-directory':
        return hasModuleAccess('voice_one_directory') ? (
          <OneDirectoryPricingTool />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'voice-one-directory-admin':
        return hasModuleAccess('voice_one_directory_admin') ? (
          <OneDirectoryAdmin hasPermission={hasPermission} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'carriers':
        return hasModuleAccess('carriers') ? (
          <CarriersManager hasPermission={hasPermission} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'exchange-feeds':
        return hasModuleAccess('exchange_data') ? (
          <ExchangeDataManager hasPermission={hasPermission} initialTab={0} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'exchange-contacts':
        return hasModuleAccess('exchange_data') ? (
          <ExchangeDataManager hasPermission={hasPermission} initialTab={1} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'exchange-pricing':
        return hasModuleAccess('exchange_data') ? (
          <ExchangePricingTool />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'extranet-providers':
        return (hasModuleAccess('extranet_data') && hasRole('administrator')) ? (
          <ExtranetDataManager hasPermission={hasPermission} initialTab={0} />
        ) : (
          <Alert severity="error">You don't have permission to view this module. Administrator access required.</Alert>
        );
      
      case 'extranet-contacts':
        return (hasModuleAccess('extranet_data') && hasRole('administrator')) ? (
          <ExtranetDataManager hasPermission={hasPermission} initialTab={1} />
        ) : (
          <Alert severity="error">You don't have permission to view this module. Administrator access required.</Alert>
        );
      
      case 'extranet-pricing':
        return hasModuleAccess('extranet_data') ? (
          <ExtranetPricingTool />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'extranet-pricing-admin':
        return (hasModuleAccess('extranet_data') && (hasRole('administrator') || hasPermission('extranet_data', 'edit'))) ? (
          <ExtranetPricingAdmin hasPermission={hasPermission} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'change-logs':
        return hasModuleAccess('change_logs') ? (
          <ChangeLogsViewer />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'live-latency-admin':
        return hasRole('administrator') ? (
          <LiveLatencyAdminManager hasPermission={hasPermission} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'user-management':
        return hasModuleAccess('user_management') ? (
          <UserManagement />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'bulk-upload':
        return hasModuleAccess('user_management') ? (
          <BulkUpload onDataRefresh={refreshData} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'analytics':
        return hasRole('administrator') ? (
          <AnalyticsDashboard />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'system-settings':
        return hasRole('administrator') ? (
          <SystemSettingsManager hasRole={hasRole} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'route-finder':
        return hasModuleAccess('route_finder') ? (
          <RouteFinder 
            onViewMap={handleRouteFinderViewMap}
            savedState={routeFinderState}
            onStateChange={setRouteFinderState}
          />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'kmz-viewer':
        return hasModuleAccess('kmz_viewer') ? (
          <KMZMapViewer 
            onClose={routeFinderMapData ? handleKMZViewerClose : () => setCurrentTab('network-routes')}
            routeFinderData={routeFinderMapData}
          />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'core-outages':
        return hasModuleAccess('network_routes') ? (
          <CoreOutagesTable />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'route-changes':
        return hasModuleAccess('network_routes') ? (
          <RouteChanges onNavigateToRoute={handleNavigateToRoute} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'carrier-quote-repository':
        return hasModuleAccess('carrier_quote_repository') ? (
          <CarrierQuoteRepository 
            onNavigateToAddQuote={(quoteId) => {
              setEditQuoteId(quoteId || null);
              setCurrentTab('add-carrier-quote');
            }}
          />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'add-carrier-quote':
        return hasModuleAccess('carrier_quote_repository') ? (
          <AddCarrierQuote 
            editQuoteId={editQuoteId}
            onNavigateBack={() => {
              setEditQuoteId(null);
              setCurrentTab('carrier-quote-repository');
            }}
          />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'feedback':
        return <FeedbackManager initialTab={feedbackInitialTab} />;
      
      case 'welcome':
      default:
        return (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h4" gutterBottom color="primary">
              Welcome to the Network Repository
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
              Please use the left sidebar to view available modules
            </Typography>
          </Paper>
        );
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      
      {/* App Bar */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Network Inventory
            <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.7 }}>
              v3.4.6
            </Typography>
          </Typography>
          
          {/* User Info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<AccountCircleIcon />}
              label={user?.username}
              variant="outlined"
              color="primary"
              size="small"
            />
            
            {/* Documentation Button */}
            <Tooltip title="Documentation">
              <IconButton
                color="inherit"
                component="a"
                href={ensureProtocol(documentationUrl)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="documentation"
              >
                <MenuBookIcon />
              </IconButton>
            </Tooltip>

            {/* Feedback Notifications */}
            <Tooltip title={notificationCount > 0 ? `${notificationCount} unread feedback item${notificationCount > 1 ? 's' : ''}` : 'No new notifications'}>
              <IconButton
                color="inherit"
                onClick={handleNotificationClick}
                aria-label="feedback notifications"
              >
                <Badge 
                  badgeContent={notificationCount} 
                  color="error"
                  max={99}
                >
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            
            <IconButton
              color="inherit"
              onClick={handleUserMenuClick}
              aria-label="user menu"
            >
              <AccountCircleIcon />
            </IconButton>
          </Box>
          
          {/* User Menu */}
          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={handleUserMenuClose}
            PaperProps={{
              sx: { minWidth: 280 }
            }}
          >
            <MenuItem disabled>
              <Typography variant="body2">
                {user?.full_name || user?.username}
              </Typography>
            </MenuItem>
            <MenuItem disabled>
              <Typography variant="caption" color="text.secondary">
                Role: {user?.role}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem disableRipple>
              <Box sx={{ width: '100%', px: 1, py: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TextFormatIcon fontSize="small" sx={{ mr: 1 }} />
                  <Typography variant="body2">
                    Text Size: {textSizeScale}%
                  </Typography>
                </Box>
                <Slider
                  value={textSizeScale}
                  onChange={(e, value) => updateTextSize(value)}
                  min={80}
                  max={120}
                  step={5}
                  marks={[
                    { value: 80, label: '80%' },
                    { value: 100, label: '100%' },
                    { value: 120, label: '120%' }
                  ]}
                  valueLabelDisplay="auto"
                  size="small"
                  sx={{ mt: 1 }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <Button 
                    size="small" 
                    onClick={resetTextSize}
                    disabled={textSizeScale === 100}
                  >
                    Reset
                  </Button>
                </Box>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {/* Network Routes Repository */}
            {hasModuleAccess('network_routes') && (
              <>
                <ListItem button onClick={() => setNetworkRoutesOpen(!networkRoutesOpen)}>
                  <ListItemIcon><RouterIcon /></ListItemIcon>
                  <ListItemText primary="Network Routes Repository" />
                  {networkRoutesOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItem>
                <Collapse in={networkRoutesOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    <ListItem 
                      button 
                      onClick={() => setCurrentTab('network-routes')} 
                      sx={{ pl: 4, backgroundColor: currentTab === 'network-routes' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><RouterIcon /></ListItemIcon>
                      <ListItemText primary="Network Routes" />
                    </ListItem>
                    
                    {/* Action buttons under Network Routes */}
                    {currentTab === 'network-routes' && hasPermission('network_routes', 'create') && (
                      <ListItem 
                        button 
                        onClick={handleAdd}
                        sx={{ pl: 6 }}
                      >
                        <ListItemIcon><AddIcon /></ListItemIcon>
                        <ListItemText primary="Add Route" />
                      </ListItem>
                    )}
                    {currentTab === 'network-routes' && hasPermission('network_routes', 'edit') && (
                      <ListItem 
                        button 
                        onClick={handleEdit}
                        sx={{ pl: 6 }}
                        disabled={!selectedRow}
                      >
                        <ListItemIcon><EditIcon /></ListItemIcon>
                        <ListItemText primary="Edit Route" />
                      </ListItem>
                    )}
                    {currentTab === 'network-routes' && hasPermission('network_routes', 'delete') && (
                      <ListItem 
                        button 
                        onClick={handleDelete}
                        sx={{ pl: 6 }}
                        disabled={!selectedRow}
                      >
                        <ListItemIcon><DeleteIcon /></ListItemIcon>
                        <ListItemText primary="Delete Route" />
                      </ListItem>
                    )}

                    {/* Route Updates - nested under Network Routes */}
                    <ListItem 
                      button 
                      onClick={() => setCurrentTab('route-changes')} 
                      sx={{ pl: 6, backgroundColor: currentTab === 'route-changes' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><WarningIcon /></ListItemIcon>
                      <ListItemText primary="Route Updates" />
                    </ListItem>

                    {/* CNX Ethernet (Route Finder & Promos) */}
                    {isModuleVisible('route_finder') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('route-finder')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'route-finder' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><SearchIcon /></ListItemIcon>
                        <ListItemText 
                          primary="CNX Ethernet" 
                          secondary="Route Finder & Promos"
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    )}

                    {/* KMZ Viewer */}
                    {isModuleVisible('kmz_viewer') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('kmz-viewer')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'kmz-viewer' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><PublicIcon /></ListItemIcon>
                        <ListItemText primary="KMZ Viewer" />
                      </ListItem>
                    )}
                    
                    {(isModuleVisible('core_outages') && hasModuleAccess('network_routes')) && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('core-outages')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'core-outages' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><WarningIcon /></ListItemIcon>
                        <ListItemText primary="Core Outages" />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </>
            )}

            {/* Network Design Tool */}
            {hasModuleAccess('network_design') && (
              <>
                <ListItem button onClick={() => setNetworkDesignOpen(!networkDesignOpen)}>
                  <ListItemIcon><DesignServicesIcon /></ListItemIcon>
                  <ListItemText primary="CNX Eth Design & Pricing Tool" />
                  {networkDesignOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItem>
                <Collapse in={networkDesignOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    <ListItem 
                      button 
                      onClick={() => setCurrentTab('network-design')} 
                      sx={{ pl: 4, backgroundColor: currentTab === 'network-design' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><DesignServicesIcon /></ListItemIcon>
                      <ListItemText primary="Design & Pricing" />
                    </ListItem>
                    {hasModuleAccess('allocated_cost_calculator') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('allocated-cost-calculator')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'allocated-cost-calculator' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><CalculateIcon /></ListItemIcon>
                        <ListItemText primary="Allocated Cost Calculator" />
                      </ListItem>
                    )}
                    {(isModuleVisible('minimum_pricing') && hasModuleAccess('locations')) && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('minimum-pricing')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'minimum-pricing' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><AttachMoneyIcon /></ListItemIcon>
                        <ListItemText primary="Minimum Pricing" />
                      </ListItem>
                    )}
                    {(isModuleVisible('pricing_logic') && hasRole('administrator') && hasModuleAccess('network_design')) && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('pricing-logic')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'pricing-logic' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><SettingsIcon /></ListItemIcon>
                        <ListItemText primary="Pricing Logic" />
                      </ListItem>
                    )}
                    {(isModuleVisible('promo_pricing') && hasRole('administrator') && hasModuleAccess('network_design')) && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('promo-pricing')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'promo-pricing' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><LocalOfferIcon /></ListItemIcon>
                        <ListItemText primary="Promo Pricing" />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </>
            )}

            {/* Exchange Data */}
            {hasModuleAccess('exchange_data') && (
              <>
                <ListItem button onClick={() => setExchangeDataOpen(!exchangeDataOpen)}>
                  <ListItemIcon><DataObjectIcon /></ListItemIcon>
                  <ListItemText primary="Exchange Data" />
                  {exchangeDataOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItem>
                <Collapse in={exchangeDataOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    <ListItem 
                      button 
                      onClick={() => setCurrentTab('exchange-feeds')} 
                      sx={{ pl: 4, backgroundColor: currentTab === 'exchange-feeds' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><TableRowsIcon /></ListItemIcon>
                      <ListItemText primary="Exchange Feeds" />
                    </ListItem>
                    <ListItem 
                      button 
                      onClick={() => setCurrentTab('exchange-contacts')} 
                      sx={{ pl: 4, backgroundColor: currentTab === 'exchange-contacts' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><ContactsIcon /></ListItemIcon>
                      <ListItemText primary="Exchange Contacts" />
                    </ListItem>
                    <ListItem 
                      button 
                      onClick={() => setCurrentTab('exchange-pricing')} 
                      sx={{ pl: 4, backgroundColor: currentTab === 'exchange-pricing' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><CalculateIcon /></ListItemIcon>
                      <ListItemText primary="Pricing Tool" />
                    </ListItem>
                  </List>
                </Collapse>
              </>
            )}

            {/* Extranet Data */}
            {hasModuleAccess('extranet_data') && (
              <>
                <ListItem button onClick={() => setExtranetDataOpen(!extranetDataOpen)}>
                  <ListItemIcon><LanIcon /></ListItemIcon>
                  <ListItemText primary="Extranet Data" />
                  {extranetDataOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItem>
                <Collapse in={extranetDataOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {/* Extranet Providers - Admin only */}
                    {hasRole('administrator') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('extranet-providers')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'extranet-providers' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><TableRowsIcon /></ListItemIcon>
                        <ListItemText primary="Extranet Providers" />
                      </ListItem>
                    )}
                    {/* Extranet Contacts - Admin only */}
                    {hasRole('administrator') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('extranet-contacts')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'extranet-contacts' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><ContactsIcon /></ListItemIcon>
                        <ListItemText primary="Extranet Contacts" />
                      </ListItem>
                    )}
                    {/* Extranet Pricing Tool - All users with extranet_data access */}
                    <ListItem 
                      button 
                      onClick={() => setCurrentTab('extranet-pricing')} 
                      sx={{ pl: 4, backgroundColor: currentTab === 'extranet-pricing' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><CalculateIcon /></ListItemIcon>
                      <ListItemText primary="Extranet Pricing Tool" />
                    </ListItem>
                    {/* Pricing Admin - Admin or Edit permission */}
                    {(hasRole('administrator') || hasPermission('extranet_data', 'edit')) && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('extranet-pricing-admin')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'extranet-pricing-admin' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><SettingsIcon /></ListItemIcon>
                        <ListItemText primary="Pricing Admin" />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </>
            )}

            {/* Network Data */}
            {(hasModuleAccess('locations') || hasModuleAccess('carriers')) && (
              <>
                <ListItem button onClick={() => setNetworkDataOpen(!networkDataOpen)}>
                  <ListItemIcon><DataObjectIcon /></ListItemIcon>
                  <ListItemText primary="Network Data" />
                  {networkDataOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItem>
                <Collapse in={networkDataOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {hasModuleAccess('locations') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('location-data')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'location-data' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><LocationOnIcon /></ListItemIcon>
                        <ListItemText primary="Manage Locations" />
                      </ListItem>
                    )}
                    {hasModuleAccess('carriers') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('carriers')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'carriers' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><BusinessIcon /></ListItemIcon>
                        <ListItemText primary="Manage Carriers" />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </>
            )}

            {/* CNX Colocation - show parent if user has access to ANY sub-module */}
            {(hasModuleAccess('cnx_colocation_inventory') || hasModuleAccess('cnx_colocation_availability') || hasModuleAccess('cnx_colocation_pricing')) && (
              <>
                <ListItem button onClick={() => setCnxColocationOpen(!cnxColocationOpen)}>
                  <ListItemIcon><BusinessCenterIcon /></ListItemIcon>
                  <ListItemText primary="CNX Colocation" />
                  {cnxColocationOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItem>
                <Collapse in={cnxColocationOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {hasModuleAccess('cnx_colocation_inventory') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('cnx-colocation-inventory')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'cnx-colocation-inventory' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><LocationOnIcon /></ListItemIcon>
                        <ListItemText primary="Colocation Inventory" />
                      </ListItem>
                    )}
                    {hasModuleAccess('cnx_colocation_availability') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('cnx-colocation-availability')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'cnx-colocation-availability' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><DashboardIcon /></ListItemIcon>
                        <ListItemText primary="Availability Dashboard" />
                      </ListItem>
                    )}
                    {hasModuleAccess('cnx_colocation_pricing') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('cnx-colocation-pricing')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'cnx-colocation-pricing' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><CalculateIcon /></ListItemIcon>
                        <ListItemText primary="Pricing Tool" />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </>
            )}

            {/* Voice - show parent if user has access to ANY sub-module */}
            {(hasModuleAccess('voice_one_directory') || hasModuleAccess('voice_one_directory_admin')) && (
              <>
                <ListItem button onClick={() => setVoiceOpen(!voiceOpen)}>
                  <ListItemIcon><PhoneIcon /></ListItemIcon>
                  <ListItemText primary="Voice" />
                  {voiceOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItem>
                <Collapse in={voiceOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {hasModuleAccess('voice_one_directory') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('voice-one-directory')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'voice-one-directory' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><CalculateIcon /></ListItemIcon>
                        <ListItemText primary="One Directory" />
                      </ListItem>
                    )}
                    {hasModuleAccess('voice_one_directory_admin') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('voice-one-directory-admin')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'voice-one-directory-admin' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><AdminPanelSettingsIcon /></ListItemIcon>
                        <ListItemText primary="One Directory Admin" />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </>
            )}

            {/* Exchange Rates */}
            {hasModuleAccess('exchange_rates') && (
              <>
                <ListItem button onClick={() => setExchangeRatesOpen(!exchangeRatesOpen)}>
                  <ListItemIcon><CurrencyExchangeIcon /></ListItemIcon>
                  <ListItemText primary="Exchange Rates" />
                  {exchangeRatesOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItem>
                <Collapse in={exchangeRatesOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    <ListItem 
                      button 
                      onClick={() => setCurrentTab('exchange-rates')} 
                      sx={{ pl: 4, backgroundColor: currentTab === 'exchange-rates' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><CurrencyExchangeIcon /></ListItemIcon>
                      <ListItemText primary="Manage Exchange Rates" />
                    </ListItem>
                  </List>
                </Collapse>
              </>
            )}

            {/* Carrier Quote Repository */}
            {hasModuleAccess('carrier_quote_repository') && (
              <>
                <ListItem button onClick={() => setCarrierQuoteOpen(!carrierQuoteOpen)}>
                  <ListItemIcon><RequestQuoteIcon /></ListItemIcon>
                  <ListItemText primary="Carrier Quote Repository" />
                  {carrierQuoteOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItem>
                <Collapse in={carrierQuoteOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    <ListItem 
                      button 
                      onClick={() => { setEditQuoteId(null); setCurrentTab('add-carrier-quote'); }}
                      sx={{ pl: 4, backgroundColor: currentTab === 'add-carrier-quote' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><NoteAddIcon /></ListItemIcon>
                      <ListItemText primary="Add Quote" />
                    </ListItem>
                    <ListItem 
                      button 
                      onClick={() => setCurrentTab('carrier-quote-repository')} 
                      sx={{ pl: 4, backgroundColor: currentTab === 'carrier-quote-repository' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><RequestQuoteIcon /></ListItemIcon>
                      <ListItemText primary="Quote Repository" />
                    </ListItem>
                  </List>
                </Collapse>
              </>
            )}

            {/* Change Logs */}
            {hasModuleAccess('change_logs') && (
              <ListItem 
                button 
                onClick={() => setCurrentTab('change-logs')} 
                sx={{ backgroundColor: currentTab === 'change-logs' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
              >
                <ListItemIcon><HistoryIcon /></ListItemIcon>
                <ListItemText primary="Change Logs" />
              </ListItem>
            )}

            {/* Admin Section (Administrator Only) */}
            {hasRole('administrator') && (
              <>
                <ListItem button onClick={() => setAdminOpen(!adminOpen)}>
                  <ListItemIcon><AdminPanelSettingsIcon /></ListItemIcon>
                  <ListItemText primary="Admin" />
                  {adminOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItem>
                <Collapse in={adminOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                  <ListItem
                    button
                    onClick={() => setCurrentTab('analytics')}
                    sx={{ pl: 4, backgroundColor: currentTab === 'analytics' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                  >
                    <ListItemIcon><AnalyticsIcon /></ListItemIcon>
                    <ListItemText primary="Analytics" />
                  </ListItem>
                  <ListItem
                    button
                    onClick={() => setCurrentTab('system-settings')}
                    sx={{ pl: 4, backgroundColor: currentTab === 'system-settings' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                  >
                    <ListItemIcon><SettingsIcon /></ListItemIcon>
                    <ListItemText primary="System Settings" />
                  </ListItem>
                  <ListItem
                      button 
                      onClick={() => setCurrentTab('live-latency-admin')} 
                      sx={{ pl: 4, backgroundColor: currentTab === 'live-latency-admin' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><ApiIcon /></ListItemIcon>
                      <ListItemText primary="Live Latency API" />
                    </ListItem>
                    <ListItem 
                      button 
                      onClick={() => setCurrentTab('bulk-upload')} 
                      sx={{ pl: 4, backgroundColor: currentTab === 'bulk-upload' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><CloudUploadIcon /></ListItemIcon>
                      <ListItemText primary="Bulk Upload" />
                    </ListItem>
                    <ListItem 
                      button 
                      onClick={() => setCurrentTab('user-management')} 
                      sx={{ pl: 4, backgroundColor: currentTab === 'user-management' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><PeopleIcon /></ListItemIcon>
                      <ListItemText primary="User Management" />
                    </ListItem>
                  </List>
                </Collapse>
              </>
            )}

            {/* Feedback Module - Available to all users */}
            <Divider sx={{ my: 1 }} />
            <ListItem 
              button 
              onClick={() => {
                setFeedbackInitialTab(0); // Default to "New Submission" tab when clicking menu
                setCurrentTab('feedback');
              }} 
              sx={{ backgroundColor: currentTab === 'feedback' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
            >
              <ListItemIcon><FeedbackIcon /></ListItemIcon>
              <ListItemText primary="Feedback" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        
        {/* Connection Error Alert */}
        {connectionError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Connection Error:</strong> {connectionError}
          </Alert>
        )}
        
        {/* Search Bar for Network Routes */}
        {currentTab === 'network-routes' && hasModuleAccess('network_routes') && (
          <Box sx={{ mb: 2 }}>
            <SearchExportBar 
              onSearch={handleSearch}
              onExport={handleExport}
              onRefresh={refreshData}
              hasPermission={hasPermission}
              resetFilters={filterResetTrigger}
              modulePermission={modulePermissions?.network_routes}
            />
          </Box>
        )}

        <Container maxWidth={false}>
          {renderMainContent()}
        </Container>
      </Box>

      {/* Dialogs */}
      <RouteFormDialog
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialValues={formMode === 'edit' ? selectedRow : {}}
        isEdit={formMode === 'edit'}
        onFileDeleted={handleFileDeleted}
      />

              <Dialog 
          open={detailsOpen} 
          onClose={() => setDetailsOpen(false)} 
          maxWidth="sm" 
          fullWidth
          disableRestoreFocus
          aria-labelledby="details-dialog-title"
        >
          <DialogTitle id="details-dialog-title">More Details</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Route Information</Typography>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Circuit ID"
                value={detailsRow ? detailsRow.circuit_id : ''}
                fullWidth
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Equipment Type"
                value={detailsRow ? detailsRow.equipment_type || 'Nokia' : ''}
                fullWidth
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Region"
                value={detailsRow ? detailsRow.region || 'APAC' : ''}
                fullWidth
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Location A"
                value={detailsRow ? detailsRow.location_a : ''}
                fullWidth
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Location B"
                value={detailsRow ? detailsRow.location_b : ''}
                fullWidth
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Bandwidth"
                value={detailsRow ? detailsRow.bandwidth : ''}
                fullWidth
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Underlying Carrier"
                value={detailsRow ? detailsRow.underlying_carrier : ''}
                fullWidth
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Local Loop Carriers A-End"
                value={detailsRow ? detailsRow.local_loop_carriers_a || 'None' : 'None'}
                fullWidth
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Local Loop Carriers B-End"
                value={detailsRow ? detailsRow.local_loop_carriers_b || 'None' : 'None'}
                fullWidth
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Expected Latency (ms)"
                value={detailsRow ? detailsRow.expected_latency : ''}
                fullWidth
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="MTU"
                value={detailsRow ? detailsRow.mtu : ''}
                fullWidth
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Capacity Usage %"
                value={detailsRow && detailsRow.capacity_usage_percent ? `${detailsRow.capacity_usage_percent}%` : ''}
                fullWidth
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                value={detailsRow ? detailsRow.more_details : ''}
                fullWidth
                multiline
                minRows={2}
                InputProps={{ readOnly: true }}
                size="small"
              />
            </Grid>
            
            {/* Tracking Information */}
            <Grid item xs={12}>
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                <Typography variant="body2" color="text.secondary">
                  {routeTracking && routeTracking.updated_date ? (
                    <>Last Updated: {routeTracking.username || 'Unknown User'} {formatTrackingDate(routeTracking.updated_date)}</>
                  ) : (
                    'Last Updated: Not available'
                  )}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDetailsOpen(false);
            setRouteTracking(null);
          }}>Close</Button>
        </DialogActions>
      </Dialog>

              <Dialog 
          open={deleteConfirmOpen} 
          onClose={() => setDeleteConfirmOpen(false)}
          disableRestoreFocus
          aria-labelledby="delete-route-dialog-title"
        >
          <DialogTitle id="delete-route-dialog-title">Delete Route</DialogTitle>
        <DialogContent>
          Are you sure you want to delete {selectedRow?.circuit_id}?
          <br />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Circuit ID: {selectedRow?.circuit_id}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      <DarkFiberModal
        open={darkFiberOpen}
        onClose={() => setDarkFiberOpen(false)}
        circuitId={darkFiberCircuitId}
      />

      <ForcedPasswordChange 
        open={passwordResetRequired || false}
        onClose={() => {}} // Will close automatically when passwordResetRequired becomes false
      />

      {/* Error Display */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)} sx={{ whiteSpace: 'pre-line' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Main App component with AuthProvider and TextSizeProvider
function App() {
  return (
    <AuthProvider>
      <TextSizeProvider>
        <AuthenticatedApp />
      </TextSizeProvider>
    </AuthProvider>
  );
}

export default App; 