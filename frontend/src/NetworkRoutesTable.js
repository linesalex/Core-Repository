import React, { useState, useEffect } from 'react';
import { 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button,
  IconButton, Menu, MenuItem, FormControlLabel, Checkbox, Divider, Typography,
  Chip, Box, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Alert, Snackbar, Select, FormControl, InputLabel
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SettingsIcon from '@mui/icons-material/Settings';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import HistoryIcon from '@mui/icons-material/History';
import { downloadTestResults, refreshAllLiveLatency, getLiveLatencyHistory } from './api';
import { API_BASE_URL } from './config';

// All available columns with their configurations
const ALL_COLUMNS = [
  { id: 'location_a', label: 'Location\nA', vertical: true, category: 'routing', defaultVisible: true },
  { id: 'location_b', label: 'Location\nB', vertical: true, category: 'routing', defaultVisible: true },
  { id: 'circuit_id', label: 'UCN', category: 'identity', defaultVisible: true },
  { id: 'expected_latency', label: 'Expected\nLatency\n(ms)', vertical: true, category: 'performance', defaultVisible: true },
  { id: 'live_latency', label: 'Live\nLatency\n(ms)', vertical: true, category: 'performance', defaultVisible: true },
  { id: 'bandwidth', label: 'Bandwidth', category: 'capacity', defaultVisible: true },
  { id: 'underlying_carrier', label: 'Underlying\nCarrier', vertical: true, category: 'carrier', defaultVisible: true },
  { id: 'cable_system', label: 'Cable\nSystem', vertical: true, category: 'infrastructure', defaultVisible: true },
  { id: 'carrier_protected', label: 'Protected', vertical: true, category: 'protection', defaultVisible: true },
  { id: 'carrier_protection_route', label: 'Protection\nRoute', vertical: true, category: 'protection', defaultVisible: true },
  { id: 'is_special', label: 'Special/\nULL', vertical: true, category: 'flags', defaultVisible: true },
  { id: 'kmz_file_path', label: 'KMZ\nFile', align: 'center', vertical: true, category: 'files', defaultVisible: true },
  { id: 'test_results_file', label: 'Test\nResults', align: 'center', vertical: true, category: 'files', defaultVisible: true },
  { id: 'mtu', label: 'MTU\n(bytes)', vertical: true, category: 'technical', defaultVisible: false },
  { id: 'sla_latency', label: 'SLA\nLatency\n(ms)', vertical: true, category: 'performance', defaultVisible: false },
  { id: 'cost', label: 'Cost', category: 'financial', defaultVisible: false },
  { id: 'currency', label: 'Currency', category: 'financial', defaultVisible: false },
  { id: 'repository_type_id', label: 'Repo\nType', vertical: true, category: 'classification', defaultVisible: false },
  { id: 'equipment_type', label: 'Equipment\nType', vertical: true, category: 'technical', defaultVisible: false },
  { id: 'local_loop_carriers_a', label: 'Local Loop\nCarrier A', vertical: true, category: 'carrier', defaultVisible: false },
  { id: 'local_loop_carriers_b', label: 'Local Loop\nCarrier B', vertical: true, category: 'carrier', defaultVisible: false },
  { id: 'test_results_link', label: 'Test Results\nLink', vertical: true, category: 'files', defaultVisible: false },
  { id: 'more_details', label: 'More\nDetails', vertical: true, align: 'center', category: 'actions', defaultVisible: true },
];

// Column categories for organization
const COLUMN_CATEGORIES = {
  identity: 'Identity',
  routing: 'Routing', 
  capacity: 'Capacity',
  performance: 'Performance',
  carrier: 'Carrier Info',
  infrastructure: 'Infrastructure',
  protection: 'Protection',
  technical: 'Technical',
  financial: 'Financial',
  classification: 'Classification',
  files: 'Files & Links',
  flags: 'Flags',
  actions: 'Actions'
};

// Get available columns based on user role
const getAvailableColumns = (userRole) => {
  return ALL_COLUMNS.filter(col => {
    // Hide Repository Type for all users (not required)
    if (col.id === 'repository_type_id') {
      return false;
    }
    
    // Restrict financial columns to admin users only
    if (col.category === 'financial') {
      return userRole === 'administrator';
    }
    
    // All other columns are available to everyone
    return true;
  });
};

// Default visible columns (maintains current view)
const getDefaultColumns = (userRole) => getAvailableColumns(userRole).filter(col => col.defaultVisible);

const textCellStyle = {
  maxWidth: 220,
  maxHeight: 80,
  overflow: 'auto',
  whiteSpace: 'pre-line',
  wordBreak: 'break-word',
  padding: '6px 8px',
};

const SmallTableCell = styled(TableCell)(({ theme }) => ({
  fontSize: '0.75rem', // ~12px, 2pt smaller than default
  padding: '6px 8px',
}));

const SmallTableHeaderCell = styled(TableCell)(({ theme }) => ({
  fontSize: '0.8125rem', // ~13px, 2pt smaller than default header
  fontWeight: 600,
  padding: '6px 8px',
}));

const VerticalHeaderCell = styled(TableCell)(({ theme }) => ({
  fontSize: '0.8125rem',
  fontWeight: 600,
  padding: '6px 4px',
  whiteSpace: 'pre-line',
  textAlign: 'center',
  lineHeight: 1.2,
  minWidth: '60px',
}));

const compactButtonStyle = {
  fontSize: '0.75rem',
  minWidth: 0,
  padding: '2px 8px',
  lineHeight: 1,
  whiteSpace: 'nowrap',
};

const linkStyle = {
  fontSize: '0.75rem',
  color: '#1976d2',
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0,
  margin: 0,
  background: 'none',
  border: 'none',
  lineHeight: 1.5,
  display: 'inline',
};
const darkFiberLinkStyle = {
  ...linkStyle,
  color: '#9c27b0', // MUI secondary.main
};

function NetworkRoutesTable({ rows, onMoreDetails, onSelectRow, selectedRow, onOpenDarkFiber, userRole, userId, onRefreshSuccess }) {
  const [visibleColumns, setVisibleColumns] = useState(getDefaultColumns(userRole));
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Live latency state
  const [refreshing, setRefreshing] = useState(false);
  const [timestampDialog, setTimestampDialog] = useState({ open: false, row: null });
  const [historyDialog, setHistoryDialog] = useState({ open: false, circuit_id: null, data: null, loading: false });
  const [historyDays, setHistoryDays] = useState(30);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Generate user-specific localStorage key
  const getStorageKey = () => {
    return `networkRoutes_columnPreferences_${userId || 'default'}`;
  };

  // Clean up old generic localStorage key on first load (migration)
  useEffect(() => {
    const oldKey = 'networkRoutes_columnPreferences';
    if (localStorage.getItem(oldKey) && userId) {
      console.log('Migrating column preferences to user-specific storage');
      localStorage.removeItem(oldKey); // Clean up old generic key
    }
  }, [userId]);

  // Load column preferences from localStorage on component mount
  useEffect(() => {
    if (!userId) {
      console.log('NetworkRoutesTable: No userId available yet, using default columns');
      return; // Don't load preferences if no user ID
    }
    
    const storageKey = getStorageKey();
    const savedColumns = localStorage.getItem(storageKey);
    console.log(`NetworkRoutesTable: Loading preferences for user ${userId}, key: ${storageKey}`);
    console.log('NetworkRoutesTable: Saved columns from localStorage:', savedColumns);
    
    if (savedColumns) {
      try {
        const columnIds = JSON.parse(savedColumns);
        const availableColumns = getAvailableColumns(userRole);
        const customColumns = availableColumns.filter(col => columnIds.includes(col.id));
        console.log('NetworkRoutesTable: Parsed column IDs:', columnIds);
        console.log('NetworkRoutesTable: Available columns for role:', availableColumns.map(c => c.id));
        console.log('NetworkRoutesTable: Filtered custom columns:', customColumns.map(c => c.id));
        
        if (customColumns.length > 0) {
          console.log('NetworkRoutesTable: Setting custom columns');
          setVisibleColumns(customColumns);
        } else {
          console.log('NetworkRoutesTable: No valid custom columns, using defaults');
          setVisibleColumns(getDefaultColumns(userRole));
        }
      } catch (error) {
        console.error('Failed to load column preferences:', error);
        setVisibleColumns(getDefaultColumns(userRole));
      }
    } else {
      console.log('NetworkRoutesTable: No saved preferences found, using defaults');
      setVisibleColumns(getDefaultColumns(userRole));
    }
  }, [userRole, userId]);

  // Track changes to mark as unsaved (but don't auto-save anymore)
  useEffect(() => {
    if (!userId) return;
    
    // Check if current columns differ from saved columns
    const storageKey = getStorageKey();
    const savedColumns = localStorage.getItem(storageKey);
    if (savedColumns) {
      try {
        const savedColumnIds = JSON.parse(savedColumns);
        const currentColumnIds = visibleColumns.map(col => col.id);
        const hasChanges = JSON.stringify(savedColumnIds) !== JSON.stringify(currentColumnIds);
        setHasUnsavedChanges(hasChanges);
      } catch (error) {
        setHasUnsavedChanges(true);
      }
    } else {
      // No saved preferences, so current state is different from default if it's not default
      const defaultColumns = getDefaultColumns(userRole);
      const isDefault = JSON.stringify(visibleColumns.map(c => c.id)) === JSON.stringify(defaultColumns.map(c => c.id));
      setHasUnsavedChanges(!isDefault);
    }
  }, [visibleColumns, userId, userRole]);

  // Manual save function
  const saveColumnPreferences = () => {
    if (!userId) {
      console.log('NetworkRoutesTable: Cannot save - no userId');
      return;
    }
    
    const columnIds = visibleColumns.map(col => col.id);
    const storageKey = getStorageKey();
    console.log(`NetworkRoutesTable: Manually saving preferences for user ${userId}`);
    console.log('NetworkRoutesTable: Storage key:', storageKey);
    console.log('NetworkRoutesTable: Saving column IDs:', columnIds);
    localStorage.setItem(storageKey, JSON.stringify(columnIds));
    console.log('NetworkRoutesTable: Preferences saved to localStorage');
    setHasUnsavedChanges(false);
  };

  // Column customization handlers
  const handleColumnMenuOpen = (event) => {
    setColumnMenuAnchor(event.currentTarget);
  };

  const handleColumnMenuClose = () => {
    setColumnMenuAnchor(null);
  };

  const handleColumnToggle = (column) => {
    setVisibleColumns(prev => {
      const isVisible = prev.some(col => col.id === column.id);
      if (isVisible) {
        return prev.filter(col => col.id !== column.id);
      } else {
        // Add column in original order, but only from available columns
        const availableColumns = getAvailableColumns(userRole);
        const newColumns = availableColumns.filter(col => 
          prev.some(p => p.id === col.id) || col.id === column.id
        );
        return newColumns;
      }
    });
  };

  const resetToDefault = () => {
    setVisibleColumns(getDefaultColumns(userRole));
    handleColumnMenuClose();
  };

  const isColumnVisible = (columnId) => {
    return visibleColumns.some(col => col.id === columnId);
  };

  const moveColumn = (columnId, direction) => {
    setVisibleColumns(prev => {
      const currentIndex = prev.findIndex(col => col.id === columnId);
      if (currentIndex === -1) return prev;
      
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newColumns = [...prev];
      [newColumns[currentIndex], newColumns[newIndex]] = [newColumns[newIndex], newColumns[currentIndex]];
      return newColumns;
    });
    setHasUnsavedChanges(true);
  };

  // Live latency functions
  const handleRefreshLiveLatency = async () => {
    setRefreshing(true);
    try {
      const result = await refreshAllLiveLatency();
      setSnackbar({
        open: true,
        message: `Live latency refreshed successfully! Updated ${result.updated} circuits.`,
        severity: 'success'
      });
      if (onRefreshSuccess) onRefreshSuccess();
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to refresh live latency: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleLiveLatencyClick = (row) => {
    if (isDataStale(row)) return; // Don't show popup for stale data
    setTimestampDialog({ open: true, row });
  };

  const handleHistoryClick = async (circuit_id) => {
    setHistoryDialog({ open: true, circuit_id, data: null, loading: true });
    try {
      const historyData = await getLiveLatencyHistory(circuit_id, historyDays);
      setHistoryDialog(prev => ({ ...prev, data: historyData, loading: false }));
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to load history: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
      setHistoryDialog({ open: false, circuit_id: null, data: null, loading: false });
    }
  };

  const isDataStale = (row) => {
    if (!row.live_latency_last_updated) return true;
    const lastUpdate = new Date(row.live_latency_last_updated);
    const now = new Date();
    const hoursDiff = (now - lastUpdate) / (1000 * 60 * 60);
    return hoursDiff > 24;
  };

  const getLiveLatencyColor = (row) => {
    if (isDataStale(row)) return '#000000'; // Black for stale/N/A
    if (!row.sla_latency) return '#4caf50'; // Green if no SLA
    return row.live_latency <= row.sla_latency ? '#4caf50' : '#f44336'; // Green if <= SLA, Red if > SLA
  };

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };
  
  const handleDownloadKMZ = async (filename) => {
    try {
      // Use fetch with authorization header
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/download_kmz/${filename}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      // Get the file blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('KMZ download failed:', error);
      alert('Failed to download KMZ file');
    }
  };
  const handleDownloadTestResults = async (circuit_id) => {
    try {
      await downloadTestResults(circuit_id);
    } catch (e) {
      alert('Failed to download test results files');
    }
  };
  return (
    <Box>
      {/* Column Customization Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, px: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {visibleColumns.length} of {getAvailableColumns(userRole).length} columns
          </Typography>
          <Chip 
            size="small" 
            label={`${rows.length} routes`} 
            color="primary" 
            variant="outlined" 
          />
          {hasUnsavedChanges && (
            <Chip 
              size="small" 
              label="Unsaved Changes" 
              color="warning" 
              variant="outlined" 
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasUnsavedChanges && (
            <Button
              onClick={saveColumnPreferences}
              size="small"
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              sx={{ minWidth: 'auto' }}
            >
              Save Layout
            </Button>
          )}
          <Button
            onClick={handleRefreshLiveLatency}
            size="small"
            variant="outlined"
            disabled={refreshing}
            startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
            sx={{ minWidth: 'auto' }}
            title="Refresh Live Latency Data"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Live Latency'}
          </Button>
          <IconButton 
            onClick={handleColumnMenuOpen}
            size="small"
            sx={{ color: 'primary.main' }}
            title="Customize Columns"
          >
            <ViewColumnIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Column Configuration Menu */}
      <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={handleColumnMenuClose}
        PaperProps={{
          sx: { maxHeight: 500, width: 350 }
        }}
      >
        <MenuItem sx={{ backgroundColor: 'action.hover', fontWeight: 'bold' }}>
          <ViewColumnIcon sx={{ mr: 1 }} />
          Customize Table Columns
        </MenuItem>
        <Divider />
        
        {Object.entries(COLUMN_CATEGORIES).map(([categoryKey, categoryLabel]) => {
          const availableColumns = getAvailableColumns(userRole);
          const categoryColumns = availableColumns.filter(col => col.category === categoryKey);
          if (categoryColumns.length === 0) return null;
          
          return (
            <Box key={categoryKey}>
              <MenuItem disabled sx={{ fontWeight: 'bold', fontSize: '0.8rem', py: 0.5 }}>
                {categoryLabel}
              </MenuItem>
              {categoryColumns.map(col => (
                <MenuItem 
                  key={col.id} 
                  onClick={() => handleColumnToggle(col)}
                  sx={{ pl: 3 }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox 
                        checked={isColumnVisible(col.id)}
                        size="small"
                      />
                    }
                    label={col.label.replace(/\n/g, ' ')}
                    sx={{ 
                      margin: 0,
                      fontSize: '0.85rem',
                      '& .MuiFormControlLabel-label': { fontSize: '0.85rem' }
                    }}
                  />
                </MenuItem>
              ))}
            </Box>
          );
        })}
        
        <Divider sx={{ my: 1 }} />
        
        {/* Column Reordering Section */}
        {visibleColumns.length > 1 && (
          <>
            <MenuItem disabled sx={{ fontWeight: 'bold', fontSize: '0.8rem', py: 0.5 }}>
              Reorder Visible Columns
            </MenuItem>
            {visibleColumns.map((col, index) => (
              <MenuItem key={`reorder-${col.id}`} sx={{ pl: 3, py: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    {col.label.replace(/\n/g, ' ')}
                  </Typography>
                  <Box>
                    <IconButton 
                      size="small" 
                      onClick={(e) => { e.stopPropagation(); moveColumn(col.id, 'up'); }}
                      disabled={index === 0}
                      sx={{ p: 0.25 }}
                    >
                      <KeyboardArrowUpIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={(e) => { e.stopPropagation(); moveColumn(col.id, 'down'); }}
                      disabled={index === visibleColumns.length - 1}
                      sx={{ p: 0.25 }}
                    >
                      <KeyboardArrowDownIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </MenuItem>
            ))}
            <Divider sx={{ my: 1 }} />
          </>
        )}
        
        {hasUnsavedChanges && (
          <MenuItem onClick={saveColumnPreferences} sx={{ justifyContent: 'center', color: 'success.main' }}>
            <SaveIcon sx={{ mr: 1, fontSize: 'small' }} />
            Save Current Layout
          </MenuItem>
        )}
        <MenuItem onClick={resetToDefault} sx={{ justifyContent: 'center', color: 'primary.main' }}>
          <SettingsIcon sx={{ mr: 1, fontSize: 'small' }} />
          Reset to Default
        </MenuItem>
      </Menu>

      {/* Table */}
      <TableContainer component={Paper} sx={{ maxHeight: 600, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {visibleColumns.map(col => {
                const HeaderCell = col.vertical ? VerticalHeaderCell : SmallTableHeaderCell;
                return (
                  <HeaderCell 
                    key={col.id} 
                    align={col.align || 'left'}
                    sx={{ 
                      backgroundColor: 'background.paper',
                      zIndex: 1
                    }}
                  >
                    {col.label}
                  </HeaderCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.circuit_id}
                hover
                selected={selectedRow && selectedRow.circuit_id === row.circuit_id}
                onClick={() => onSelectRow && onSelectRow(row)}
                style={{ cursor: onSelectRow ? 'pointer' : 'default' }}
              >
                {visibleColumns.map(col => {
                if (col.id === 'more_details') {
                  return (
                    <SmallTableCell key={col.id} style={{ ...textCellStyle, verticalAlign: 'middle', whiteSpace: 'nowrap' }} align="center">
                      <span
                        style={linkStyle}
                        onClick={e => { e.stopPropagation(); onMoreDetails(row); }}
                        tabIndex={0}
                        role="button"
                        onKeyPress={e => { if (e.key === 'Enter') { e.stopPropagation(); onMoreDetails(row); } }}
                      >
                        More Details
                      </span>
                    </SmallTableCell>
                  );
                }
                if (col.id === 'bandwidth' && row.bandwidth === 'Dark Fiber') {
                  return (
                    <SmallTableCell key={col.id} style={{ ...textCellStyle, verticalAlign: 'middle' }} align="left">
                      <span
                        style={darkFiberLinkStyle}
                        onClick={e => { e.stopPropagation(); onOpenDarkFiber(row.circuit_id); }}
                        tabIndex={0}
                        role="button"
                        onKeyPress={e => { if (e.key === 'Enter') { e.stopPropagation(); onOpenDarkFiber(row.circuit_id); } }}
                      >
                        Dark Fiber Details
                      </span>
                    </SmallTableCell>
                  );
                }
                if (col.id === 'kmz_file_path') {
                  return (
                    <SmallTableCell key={col.id} style={textCellStyle} align={col.align || 'left'}>
                      {row.kmz_file_path ? (
                        <Button onClick={e => { e.stopPropagation(); handleDownloadKMZ(row.kmz_file_path); }} color="success" size="small" startIcon={<CheckCircleIcon color="success" />}>
                          <CloudDownloadIcon fontSize="small" />
                        </Button>
                      ) : (
                        <CancelIcon color="error" />
                      )}
                    </SmallTableCell>
                  );
                }
                if (col.id === 'test_results_file') {
                  return (
                    <SmallTableCell key={col.id} style={textCellStyle} align={col.align || 'left'}>
                      {row.test_results_file ? (
                        <Button onClick={e => { e.stopPropagation(); handleDownloadTestResults(row.circuit_id); }} color="success" size="small" startIcon={<CheckCircleIcon color="success" />}>
                          <CloudDownloadIcon fontSize="small" />
                        </Button>
                      ) : (
                        <CancelIcon color="error" />
                      )}
                    </SmallTableCell>
                  );
                }
                if (col.id === 'live_latency') {
                  const value = isDataStale(row) ? 'N/A' : row.live_latency;
                  const color = getLiveLatencyColor(row);
                  return (
                    <SmallTableCell key={col.id} style={{ ...textCellStyle, verticalAlign: 'middle' }} align={col.align || 'left'}>
                      <span
                        style={{
                          color: color,
                          cursor: isDataStale(row) ? 'default' : 'pointer',
                          textDecoration: isDataStale(row) ? 'none' : 'underline'
                        }}
                        onClick={e => { 
                          e.stopPropagation(); 
                          if (!isDataStale(row)) handleLiveLatencyClick(row); 
                        }}
                        tabIndex={0}
                        role="button"
                        onKeyPress={e => { 
                          if (e.key === 'Enter' && !isDataStale(row)) { 
                            e.stopPropagation(); 
                            handleLiveLatencyClick(row); 
                          } 
                        }}
                      >
                        {value}
                      </span>
                    </SmallTableCell>
                  );
                }
                const textHeavy = [
                  'test_results_link',
                  'cable_system',
                  'underlying_carrier',
                  'location_a',
                  'location_b',
                  'bandwidth',
                  'more_details',
                ];
                return (
                  <SmallTableCell key={col.id} style={textHeavy.includes(col.id) ? textCellStyle : {}} align={col.align || 'left'}>
                    {col.id === 'is_special' ? (row[col.id] ? 'Yes' : 'No') :
                     col.id === 'carrier_protected' ? (row[col.id] ? 'Yes' : 'No') :
                     col.id === 'carrier_protection_route' && row[col.id] ? 
                       (row[col.id].length > 16 ? `${row[col.id].substring(0, 16)}...` : row[col.id]) :
                     row[col.id]}
                  </SmallTableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>

    {/* Timestamp Popup Dialog */}
    <Dialog 
      open={timestampDialog.open} 
      onClose={() => setTimestampDialog({ open: false, row: null })}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Live Latency Information</DialogTitle>
      <DialogContent>
        {timestampDialog.row && (
          <Box>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Circuit:</strong> {timestampDialog.row.circuit_id}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Current Latency:</strong> {timestampDialog.row.live_latency} ms
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>SLA Latency:</strong> {timestampDialog.row.sla_latency ? `${timestampDialog.row.sla_latency} ms` : 'Not set'}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Last Updated:</strong> {formatLastUpdated(timestampDialog.row.live_latency_last_updated)}
            </Typography>
            <Typography variant="body1">
              <strong>Source:</strong> {timestampDialog.row.live_latency_source || 'Unknown'}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setTimestampDialog({ open: false, row: null })}>
          Close
        </Button>
        {timestampDialog.row && (
          <Button 
            onClick={() => {
              handleHistoryClick(timestampDialog.row.circuit_id);
              setTimestampDialog({ open: false, row: null });
            }}
            startIcon={<HistoryIcon />}
          >
            View History
          </Button>
        )}
      </DialogActions>
    </Dialog>

    {/* History Graph Dialog */}
    <Dialog 
      open={historyDialog.open} 
      onClose={() => setHistoryDialog({ open: false, circuit_id: null, data: null, loading: false })}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Live Latency History - {historyDialog.circuit_id}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Period</InputLabel>
            <Select
              value={historyDays}
              label="Time Period"
              onChange={(e) => setHistoryDays(e.target.value)}
            >
              <MenuItem value={7}>Last 7 days</MenuItem>
              <MenuItem value={30}>Last 30 days</MenuItem>
              <MenuItem value={90}>Last 90 days</MenuItem>
            </Select>
          </FormControl>
          <Button 
            size="small" 
            onClick={() => handleHistoryClick(historyDialog.circuit_id)}
            disabled={historyDialog.loading}
          >
            Refresh
          </Button>
        </Box>
        
        {historyDialog.loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : historyDialog.data ? (
          <Box>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Showing {historyDialog.data.count} daily snapshots for the last {historyDays} days
            </Typography>
            {historyDialog.data.history.length > 0 ? (
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Historical Data Preview (Full graph implementation pending):
                </Typography>
                {historyDialog.data.history.slice(-5).map((point, index) => (
                  <Typography key={index} variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {point.snapshot_date}: {point.latency_ms}ms 
                    {point.sla_latency && ` (SLA: ${point.sla_latency}ms)`}
                  </Typography>
                ))}
                {historyDialog.data.history.length > 5 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    ... and {historyDialog.data.history.length - 5} more entries
                  </Typography>
                )}
              </Box>
            ) : (
              <Alert severity="info">
                No historical data available for this circuit.
              </Alert>
            )}
          </Box>
        ) : (
          <Alert severity="error">
            Failed to load historical data.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setHistoryDialog({ open: false, circuit_id: null, data: null, loading: false })}>
          Close
        </Button>
      </DialogActions>
    </Dialog>

    {/* Snackbar for notifications */}
    <Snackbar
      open={snackbar.open}
      autoHideDuration={6000}
      onClose={() => setSnackbar({ ...snackbar, open: false })}
    >
      <Alert 
        onClose={() => setSnackbar({ ...snackbar, open: false })} 
        severity={snackbar.severity}
        sx={{ width: '100%' }}
      >
        {snackbar.message}
      </Alert>
    </Snackbar>

    </Box>
  );
}

export default NetworkRoutesTable; 