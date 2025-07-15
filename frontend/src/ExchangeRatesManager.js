import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip,
  Alert, Snackbar, Tooltip, Grid, Card, CardContent
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { exchangeRatesApi } from './api';

const ExchangeRatesManager = ({ hasPermission }) => {
  const [exchangeRates, setExchangeRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [selectedRate, setSelectedRate] = useState(null);
  
  // Form data
  const [formData, setFormData] = useState({
    currency_code: '',
    exchange_rate: '',
    updated_by: 'Administrator'
  });

  // Load exchange rates on component mount
  useEffect(() => {
    loadExchangeRates();
  }, []);

  const loadExchangeRates = async () => {
    try {
      setLoading(true);
      const data = await exchangeRatesApi.getExchangeRates();
      setExchangeRates(data);
    } catch (err) {
      setError('Failed to load exchange rates: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setDialogMode('add');
    setSelectedRate(null);
    setFormData({
      currency_code: '',
      exchange_rate: '',
      updated_by: 'Administrator'
    });
    setDialogOpen(true);
  };

  const handleEdit = (rate) => {
    setDialogMode('edit');
    setSelectedRate(rate);
    setFormData({
      currency_code: rate.currency_code,
      exchange_rate: rate.exchange_rate.toString(),
      updated_by: 'Administrator'
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (!formData.currency_code || !formData.exchange_rate) {
        setError('Please fill in all required fields');
        return;
      }

      const submitData = {
        currency_code: formData.currency_code.toUpperCase(),
        exchange_rate: parseFloat(formData.exchange_rate),
        updated_by: formData.updated_by
      };

      if (dialogMode === 'add') {
        await exchangeRatesApi.addExchangeRate(submitData);
        setSuccess('Exchange rate added successfully');
      } else {
        await exchangeRatesApi.updateExchangeRate(selectedRate.id, submitData);
        setSuccess('Exchange rate updated successfully');
      }

      setDialogOpen(false);
      await loadExchangeRates();

    } catch (err) {
      setError('Failed to save exchange rate: ' + err.message);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getStatusChip = (rate) => {
    const nextUpdate = new Date(rate.next_update_due);
    const now = new Date();
    const daysUntilUpdate = Math.ceil((nextUpdate - now) / (1000 * 60 * 60 * 24));

    if (daysUntilUpdate < 0) {
      return <Chip label="Overdue" color="error" size="small" />;
    } else if (daysUntilUpdate <= 5) {
      return <Chip label="Due Soon" color="warning" size="small" />;
    } else {
      return <Chip label="Current" color="success" size="small" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Common currency codes for quick access
  const commonCurrencies = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'CAD', name: 'Canadian Dollar' }
  ];

  if (loading) {
    return <Box sx={{ p: 2 }}>Loading exchange rates...</Box>;
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2">
          Exchange Rates Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {hasPermission && hasPermission('exchange_rates', 'create') && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
            >
              Add Rate
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadExchangeRates}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">
                {exchangeRates.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Currencies
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {exchangeRates.filter(rate => {
                  const nextUpdate = new Date(rate.next_update_due);
                  const now = new Date();
                  return nextUpdate > now;
                }).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Current Rates
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="warning.main">
                {exchangeRates.filter(rate => {
                  const nextUpdate = new Date(rate.next_update_due);
                  const now = new Date();
                  const daysUntilUpdate = Math.ceil((nextUpdate - now) / (1000 * 60 * 60 * 24));
                  return daysUntilUpdate >= 0 && daysUntilUpdate <= 5;
                }).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Due Soon
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="error.main">
                {exchangeRates.filter(rate => {
                  const nextUpdate = new Date(rate.next_update_due);
                  const now = new Date();
                  return nextUpdate < now;
                }).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Overdue
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Exchange Rates Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Currency Code</TableCell>
              <TableCell align="right">Exchange Rate</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell>Last Updated</TableCell>
              <TableCell>Next Update Due</TableCell>
              <TableCell>Updated By</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {exchangeRates.map((rate) => (
              <TableRow key={rate.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body1" fontWeight="bold">
                      {rate.currency_code}
                    </Typography>
                    {rate.currency_code === 'USD' && (
                      <Chip label="Base" color="primary" size="small" sx={{ ml: 1 }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body1" fontWeight="bold">
                    {rate.exchange_rate.toFixed(4)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  {getStatusChip(rate)}
                </TableCell>
                <TableCell>
                  {formatDate(rate.last_updated)}
                </TableCell>
                <TableCell>
                  {formatDate(rate.next_update_due)}
                </TableCell>
                <TableCell>
                  {rate.updated_by}
                </TableCell>
                <TableCell align="center">
                  {hasPermission && hasPermission('exchange_rates', 'edit') ? (
                    <Tooltip title={rate.currency_code === 'USD' ? 'USD is the base currency and cannot be edited' : 'Edit'}>
                      <span>
                        <IconButton 
                          size="small" 
                          onClick={() => handleEdit(rate)}
                          disabled={rate.currency_code === 'USD'}
                        >
                          <EditIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : (
                    <Typography variant="body2" color="text.secondary">-</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'add' ? 'Add Exchange Rate' : 'Edit Exchange Rate'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {dialogMode === 'add' ? (
              <TextField
                label="Currency Code"
                value={formData.currency_code}
                onChange={(e) => handleInputChange('currency_code', e.target.value.toUpperCase())}
                fullWidth
                required
                inputProps={{ maxLength: 3 }}
                helperText="3-letter currency code (e.g., USD, EUR)"
              />
            ) : (
              <TextField
                label="Currency Code"
                value={formData.currency_code}
                fullWidth
                disabled
              />
            )}

            <TextField
              label="Exchange Rate"
              type="number"
              value={formData.exchange_rate}
              onChange={(e) => handleInputChange('exchange_rate', e.target.value)}
              fullWidth
              required
              inputProps={{ step: 0.0001, min: 0 }}
              helperText="Rate relative to USD (e.g., 0.85 for EUR)"
            />

            <TextField
              label="Updated By"
              value={formData.updated_by}
              onChange={(e) => handleInputChange('updated_by', e.target.value)}
              fullWidth
              required
            />

            {dialogMode === 'add' && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Common Currencies:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {commonCurrencies.map((currency) => (
                    <Chip
                      key={currency.code}
                      label={`${currency.code} - ${currency.name}`}
                      onClick={() => handleInputChange('currency_code', currency.code)}
                      variant="outlined"
                      size="small"
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {dialogMode === 'add' ? 'Add' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default ExchangeRatesManager; 