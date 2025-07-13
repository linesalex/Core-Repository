import React, { useState, useEffect } from 'react';
import { Box, CssBaseline, Drawer, List, ListItem, ListItemIcon, ListItemText, AppBar, Toolbar, Typography, Button, Container, Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Collapse, Menu, MenuItem } from '@mui/material';
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
import NetworkRoutesTable from './NetworkRoutesTable';
import NetworkDesignTool from './NetworkDesignTool';
import ExchangeRatesManager from './ExchangeRatesManager';
import LocationDataManager from './LocationDataManager';
import CoreOutagesTable from './CoreOutagesTable';
import { fetchRoutes, searchRoutes, exportRoutesCSV, addRoute, editRoute, deleteRoute, uploadKMZ, fetchRoute, uploadTestResults } from './api';
import SearchExportBar from './SearchExportBar';
import RouteFormDialog from './RouteFormDialog';
import DarkFiberModal from './DarkFiberModal';

const drawerWidth = 280;

function App() {
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
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
  const [locationDataOpen, setLocationDataOpen] = useState(false);

  useEffect(() => {
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
  }, []);

  const handleMoreDetails = (row) => {
    setDetailsRow(row);
    setDetailsOpen(true);
  };

  const handleSearch = (filters) => {
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
    exportRoutesCSV().then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'network_routes.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  };

  const handleAdd = () => {
    setFormMode('add');
    setSelectedRow(null);
    setFormOpen(true);
  };

  const handleEdit = () => {
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
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
      
      // Refresh the data to show updated status
      await refreshData();
      setFormOpen(false);
      setSelectedRow(null);
      
      // Show success notification
      if (uploadedFiles > 0) {
        setError(''); // Clear any previous errors
        // We'll add a success message state
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
    // Refresh the table data when a file is deleted
    refreshData();
  };

  const handleDeleteConfirm = async () => {
    setLoading(true);
    try {
      await deleteRoute(selectedRow.circuit_id);
      await refreshData();
      setSelectedRow(null);
      setDeleteConfirmOpen(false);
    } catch (err) {
      setError('Failed to delete');
    }
    setLoading(false);
  };

  const handleDetailsSave = async (values) => {
    setLoading(true);
    try {
      await editRoute(detailsRow.circuit_id, { ...detailsRow, more_details: values.more_details });
      await refreshData();
      setDetailsOpen(false);
      setDetailsRow(null);
    } catch (err) {
      setError('Failed to save details');
    }
    setLoading(false);
  };

  const handleOpenDarkFiber = (circuitId) => {
    setDarkFiberCircuitId(circuitId);
    setDarkFiberOpen(true);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: 1201 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Network Inventory
          </Typography>
        </Toolbar>
      </AppBar>
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
            {/* Network Routes Repository Tab */}
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
                  <ListItemText primary="View Routes" />
                </ListItem>
                <ListItem button onClick={handleAdd} sx={{ pl: 4 }}>
                  <ListItemIcon><AddIcon /></ListItemIcon>
                  <ListItemText primary="Add Route" />
                </ListItem>
                <ListItem button onClick={handleEdit} disabled={!selectedRow} sx={{ pl: 4 }}>
                  <ListItemIcon><EditIcon /></ListItemIcon>
                  <ListItemText primary="Edit Route" />
                </ListItem>
                <ListItem button onClick={handleDelete} disabled={!selectedRow} sx={{ pl: 4 }}>
                  <ListItemIcon><DeleteIcon /></ListItemIcon>
                  <ListItemText primary="Delete Route" />
                </ListItem>
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

            {/* Network Design & Pricing Tool Tab */}
            <ListItem button onClick={() => setNetworkDesignOpen(!networkDesignOpen)}>
              <ListItemIcon><DesignServicesIcon /></ListItemIcon>
              <ListItemText primary="Network Design & Pricing" />
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
                  <ListItemText primary="Design Tool" />
                </ListItem>
              </List>
            </Collapse>

            {/* Exchange Rates Management Tab */}
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
                  <ListItemText primary="Manage Rates" />
                </ListItem>
              </List>
            </Collapse>

            {/* Location Data Management Tab */}
            <ListItem button onClick={() => setLocationDataOpen(!locationDataOpen)}>
              <ListItemIcon><LocationOnIcon /></ListItemIcon>
              <ListItemText primary="Location Data" />
              {locationDataOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItem>
            <Collapse in={locationDataOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                <ListItem 
                  button 
                  onClick={() => setCurrentTab('location-data')} 
                  sx={{ pl: 4, backgroundColor: currentTab === 'location-data' ? 'rgba(0, 0, 0, 0.04)' : 'transparent' }}
                >
                  <ListItemIcon><LocationOnIcon /></ListItemIcon>
                  <ListItemText primary="Manage Locations" />
                </ListItem>
              </List>
            </Collapse>
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3 }}>
        <Toolbar />
        <Container maxWidth="xl">
          {/* Network Routes Repository Tab */}
          {currentTab === 'network-routes' && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h5" gutterBottom>Network Routes Repository</Typography>
              <SearchExportBar onSearch={handleSearch} onExport={handleExport} />
              {loading ? (
                <div>Loading...</div>
              ) : error ? (
                <div style={{ color: 'red' }}>{error}</div>
              ) : (
                <NetworkRoutesTable
                  rows={rows}
                  onMoreDetails={handleMoreDetails}
                  onSelectRow={setSelectedRow}
                  selectedRow={selectedRow}
                  onOpenDarkFiber={handleOpenDarkFiber}
                />
              )}
              {openDetails && (
                <div>More Details Popup for {selectedRow.circuit_id} (to be implemented)</div>
              )}
            </Paper>
          )}

          {/* Core Outages Tab */}
          {currentTab === 'core-outages' && (
            <CoreOutagesTable />
          )}

          {/* Network Design & Pricing Tool Tab */}
          {currentTab === 'network-design' && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h5" gutterBottom>Network Design & Pricing Tool</Typography>
              <NetworkDesignTool />
            </Paper>
          )}

          {/* Exchange Rates Management Tab */}
          {currentTab === 'exchange-rates' && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h5" gutterBottom>Exchange Rates Management</Typography>
              <ExchangeRatesManager />
            </Paper>
          )}

          {/* Location Data Management Tab */}
          {currentTab === 'location-data' && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h5" gutterBottom>Location Data Management</Typography>
              <LocationDataManager />
            </Paper>
          )}
        </Container>
      </Box>
      <RouteFormDialog
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialValues={formMode === 'edit' ? selectedRow : {}}
        isEdit={formMode === 'edit'}
        onFileDeleted={handleFileDeleted}
      />
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>More Details</DialogTitle>
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
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Route</DialogTitle>
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

export default App; 