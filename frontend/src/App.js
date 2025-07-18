import React, { useState, useEffect } from 'react';
import {
  Box, CssBaseline, Drawer, List, ListItem, ListItemIcon, ListItemText, AppBar, Toolbar, Typography, Button, Container, Paper, 
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Collapse, Menu, MenuItem, IconButton, Chip, CircularProgress,
  Alert, Divider, Avatar
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
import { AuthProvider, useAuth } from './AuthContext';
import LoginForm from './LoginForm';
import NetworkRoutesTable from './NetworkRoutesTable';
import NetworkDesignTool from './NetworkDesignTool';
import ExchangeRatesManager from './ExchangeRatesManager';
import LocationDataManager from './LocationDataManager';
import MinimumPricingManager from './MinimumPricingManager';
import CNXColocationManager from './CNXColocationManager';
import UserManagement from './UserManagement';
import ChangeLogsViewer from './ChangeLogsViewer';
import CoreOutagesTable from './CoreOutagesTable';
import CarriersManager from './CarriersManager';
import ExchangeDataManager from './ExchangeDataManager';
import BulkUpload from './BulkUpload';
import { fetchRoutes, searchRoutes, exportRoutesCSV, addRoute, editRoute, deleteRoute, uploadKMZ, fetchRoute, uploadTestResults } from './api';
import SearchExportBar from './SearchExportBar';
import RouteFormDialog from './RouteFormDialog';
import DarkFiberModal from './DarkFiberModal';

const drawerWidth = 280;

// Main authenticated application component
function AuthenticatedApp() {
  const { user, logout, isAuthenticated, loading: authLoading, hasModuleAccess, hasPermission, permissions, connectionError } = useAuth();
  
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
  const [darkFiberOpen, setDarkFiberOpen] = useState(false);
  const [darkFiberCircuitId, setDarkFiberCircuitId] = useState(null);
  const [networkRoutesOpen, setNetworkRoutesOpen] = useState(true);
  
  // New state for tab management
  const [currentTab, setCurrentTab] = useState('welcome');
  const [networkDesignOpen, setNetworkDesignOpen] = useState(false);
  const [exchangeDataOpen, setExchangeDataOpen] = useState(false);
  const [exchangeRatesOpen, setExchangeRatesOpen] = useState(false);
  const [networkDataOpen, setNetworkDataOpen] = useState(false);
  
  // User menu state
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  
  // Load network routes data - moved before early returns to follow Rules of Hooks
  useEffect(() => {
    if (isAuthenticated && hasModuleAccess('network_routes')) {
      setLoading(true);
      fetchRoutes()
        .then(data => {
          setRows(data);
          setLoading(false);
        })
        .catch(err => {
          setError('Failed to fetch data');
          setLoading(false);
        });
    }
  }, [isAuthenticated, hasModuleAccess]);

  // Auto-select first available module when user logs in
  useEffect(() => {
    if (isAuthenticated && currentTab === 'welcome') {
      // List of modules in order of preference
      const modulePreferences = [
        'network-routes',
        'network-design',
        'minimum-pricing',
        'location-data',
        'cnx-colocation',
        'carriers',
        'exchange-rates',
        'exchange-feeds',
        'exchange-contacts',
        'change-logs',
        'user-management'
      ];
      
      // Find the first module the user has access to
      const firstAvailableModule = modulePreferences.find(module => {
        const moduleMap = {
          'network-routes': 'network_routes',
          'network-design': 'network_design',
          'minimum-pricing': 'locations',
          'location-data': 'locations',
          'cnx-colocation': 'cnx_colocation',
          'carriers': 'carriers',
          'exchange-rates': 'exchange_rates',
          'exchange-feeds': 'exchange_data',
          'exchange-contacts': 'exchange_data',
          'change-logs': 'change_logs',
          'user-management': 'user_management'
        };
        return hasModuleAccess(moduleMap[module]);
      });
      
      // If we found an available module, switch to it
      if (firstAvailableModule) {
        setCurrentTab(firstAvailableModule);
      }
    }
  }, [isAuthenticated, hasModuleAccess, currentTab]);
  
  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }
  
  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <LoginForm />;
  }

  const handleMoreDetails = (row) => {
    setDetailsRow(row);
    setDetailsOpen(true);
  };

  const handleSearch = (filters) => {
    if (!hasPermission('network_routes', 'view')) return;
    
    setLoading(true);
    searchRoutes(filters)
      .then(data => {
        setRows(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to search');
        setLoading(false);
      });
  };

  const handleExport = () => {
    if (!hasPermission('network_routes', 'view')) return;
    
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

  const refreshData = async () => {
    try {
      const data = await fetchRoutes();
      setRows(data);
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
      setError('Failed to delete route');
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

  const handleLogout = () => {
    logout();
    setUserMenuAnchor(null);
  };

  const renderMainContent = () => {
    switch (currentTab) {
      case 'network-routes':
        return hasModuleAccess('network_routes') ? (
          <NetworkRoutesTable
            rows={rows}
            loading={loading}
            error={error}
            onMoreDetails={handleMoreDetails}
            onSelectRow={setSelectedRow}
            selectedRow={selectedRow}
            onOpenDarkFiber={handleOpenDarkFiber}
            hasPermission={hasPermission}
          />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'network-design':
        return hasModuleAccess('network_design') ? (
          <NetworkDesignTool />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'minimum-pricing':
        return hasModuleAccess('locations') ? (
          <MinimumPricingManager hasPermission={hasPermission} />
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
          <LocationDataManager hasPermission={hasPermission} />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'cnx-colocation':
        return hasModuleAccess('cnx_colocation') ? (
          <CNXColocationManager hasPermission={hasPermission} />
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
      
      case 'change-logs':
        return hasModuleAccess('change_logs') ? (
          <ChangeLogsViewer />
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
          <BulkUpload />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'core-outages':
        return hasModuleAccess('network_routes') ? (
          <CoreOutagesTable />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'welcome':
      default:
        return (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom color="primary">
              Welcome to Network Inventory
            </Typography>
            <Typography variant="h6" gutterBottom color="text.secondary">
              Hello, {user?.full_name || user?.username}!
            </Typography>
            <Typography variant="body1" sx={{ mt: 2, mb: 2 }}>
              Select a module from the sidebar to get started with managing your network infrastructure.
            </Typography>
            {Object.keys(permissions || {}).length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                You don't have access to any modules yet. Please contact your administrator to grant you the necessary permissions.
              </Alert>
            )}
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
                    
                    <ListItem 
                      button 
                      onClick={() => setCurrentTab('core-outages')} 
                      sx={{ pl: 4, backgroundColor: currentTab === 'core-outages' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                    >
                      <ListItemIcon><WarningIcon /></ListItemIcon>
                      <ListItemText primary="Core Outages" />
                    </ListItem>
                  </List>
                </Collapse>
              </>
            )}

            {/* Network Design Tool */}
            {hasModuleAccess('network_design') && (
              <>
                <ListItem button onClick={() => setNetworkDesignOpen(!networkDesignOpen)}>
                  <ListItemIcon><DesignServicesIcon /></ListItemIcon>
                  <ListItemText primary="Network Design & Pricing Tool" />
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
                    {hasModuleAccess('locations') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('minimum-pricing')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'minimum-pricing' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><AttachMoneyIcon /></ListItemIcon>
                        <ListItemText primary="Minimum Pricing" />
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
                  </List>
                </Collapse>
              </>
            )}

            {/* Network Data */}
            {(hasModuleAccess('locations') || hasModuleAccess('carriers') || hasModuleAccess('cnx_colocation')) && (
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
                    {hasModuleAccess('cnx_colocation') && (
                      <ListItem 
                        button 
                        onClick={() => setCurrentTab('cnx-colocation')} 
                        sx={{ pl: 4, backgroundColor: currentTab === 'cnx-colocation' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                      >
                        <ListItemIcon><LocationOnIcon /></ListItemIcon>
                        <ListItemText primary="CNX Colocation" />
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

            {/* User Management */}
            {hasModuleAccess('user_management') && (
              <ListItem 
                button 
                onClick={() => setCurrentTab('user-management')} 
                sx={{ backgroundColor: currentTab === 'user-management' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
              >
                <ListItemIcon><PeopleIcon /></ListItemIcon>
                <ListItemText primary="User Management" />
              </ListItem>
            )}

            {/* Bulk Upload (Admin Only) */}
            {hasModuleAccess('user_management') && (
              <ListItem 
                button 
                onClick={() => setCurrentTab('bulk-upload')} 
                sx={{ backgroundColor: currentTab === 'bulk-upload' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
              >
                <ListItemIcon><CloudUploadIcon /></ListItemIcon>
                <ListItemText primary="Bulk Upload" />
              </ListItem>
            )}
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
              hasPermission={hasPermission}
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
          <TextField
            label="Notes"
            value={detailsRow ? detailsRow.more_details : ''}
            fullWidth
            multiline
            minRows={2}
            InputProps={{ readOnly: true, style: { fontSize: '0.7rem', lineHeight: 1.1, minHeight: 48 }} }
            InputLabelProps={{ style: { fontSize: '0.7rem' } }}
            sx={{ fontSize: '0.7rem', minHeight: 48 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
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
    </Box>
  );
}

// Main App component with AuthProvider
function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App; 