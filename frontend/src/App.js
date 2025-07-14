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
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import HistoryIcon from '@mui/icons-material/History';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import DataObjectIcon from '@mui/icons-material/DataObject';
import { AuthProvider, useAuth } from './AuthContext';
import LoginForm from './LoginForm';
import NetworkRoutesTable from './NetworkRoutesTable';
import NetworkDesignTool from './NetworkDesignTool';
import ExchangeRatesManager from './ExchangeRatesManager';
import LocationDataManager from './LocationDataManager';
import UserManagement from './UserManagement';
import ChangeLogsViewer from './ChangeLogsViewer';
import CoreOutagesTable from './CoreOutagesTable';
import CarriersManager from './CarriersManager';
import { fetchRoutes, searchRoutes, exportRoutesCSV, addRoute, editRoute, deleteRoute, uploadKMZ, fetchRoute, uploadTestResults } from './api';
import SearchExportBar from './SearchExportBar';
import RouteFormDialog from './RouteFormDialog';
import DarkFiberModal from './DarkFiberModal';

const drawerWidth = 280;

// Main authenticated application component
function AuthenticatedApp() {
  const { user, logout, isAuthenticated, loading: authLoading, hasModuleAccess, hasPermission } = useAuth();
  
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
  const [currentTab, setCurrentTab] = useState('network-routes');
  const [networkDesignOpen, setNetworkDesignOpen] = useState(false);
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
      
      case 'exchange-rates':
        return hasModuleAccess('exchange_rates') ? (
          <ExchangeRatesManager />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      case 'location-data':
        return hasModuleAccess('locations') ? (
          <LocationDataManager />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
        
      case 'carriers':
        return hasModuleAccess('carriers') ? (
          <CarriersManager />
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
      
      case 'core-outages':
        return hasModuleAccess('network_routes') ? (
          <CoreOutagesTable />
        ) : (
          <Alert severity="error">You don't have permission to view this module</Alert>
        );
      
      default:
        return (
          <Paper sx={{ p: 2 }}>
            <Typography variant="h5" gutterBottom>Welcome to Network Inventory</Typography>
            <Typography>Select a module from the sidebar to get started.</Typography>
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
          </List>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        
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