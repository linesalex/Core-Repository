import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Alert,
  Box,
  Card,
  CardContent,
  Divider,
  Chip,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as AttachMoneyIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { networkDesignApi } from './api';

const PricingLogicManager = ({ hasPermission }) => {
  const [config, setConfig] = useState({
    contractTerms: {
      12: { minMargin: 40, suggestedMargin: 60, nrcCharge: 1000 },
      24: { minMargin: 37.5, suggestedMargin: 55, nrcCharge: 500 },
      36: { minMargin: 35, suggestedMargin: 50, nrcCharge: 0 }
    },
    charges: {
      ullPremiumPercent: 15,
      protectionPathMultiplier: 0.7
    },
    utilizationFactors: {
      primary: 0.9,
      protection: 1.0
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Load current configuration
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await networkDesignApi.getPricingLogicConfig();
      if (response.success) {
        setConfig(response.data);
        setLastUpdated(response.lastUpdated);
      }
    } catch (err) {
      setError('Failed to load pricing configuration: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const response = await networkDesignApi.updatePricingLogicConfig(config);
      if (response.success) {
        setSuccess('Pricing logic configuration updated successfully');
        setLastUpdated(new Date().toISOString());
      }
    } catch (err) {
      setError('Failed to save pricing configuration: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const updateContractTerm = (term, field, value) => {
    setConfig(prev => ({
      ...prev,
      contractTerms: {
        ...prev.contractTerms,
        [term]: {
          ...prev.contractTerms[term],
          [field]: parseFloat(value) || 0
        }
      }
    }));
  };

  const updateCharge = (chargeType, value) => {
    setConfig(prev => ({
      ...prev,
      charges: {
        ...prev.charges,
        [chargeType]: parseFloat(value) || 0
      }
    }));
  };

  const updateUtilizationFactor = (factorType, value) => {
    setConfig(prev => ({
      ...prev,
      utilizationFactors: {
        ...prev.utilizationFactors,
        [factorType]: parseFloat(value) || 0
      }
    }));
  };

  const resetToDefaults = () => {
    setConfig({
      contractTerms: {
        12: { minMargin: 40, suggestedMargin: 60, nrcCharge: 1000 },
        24: { minMargin: 37.5, suggestedMargin: 55, nrcCharge: 500 },
        36: { minMargin: 35, suggestedMargin: 50, nrcCharge: 0 }
      },
      charges: {
        ullPremiumPercent: 15,
        protectionPathMultiplier: 0.7
      },
      utilizationFactors: {
        primary: 0.9,
        protection: 1.0
      }
    });
  };

  if (!hasPermission('administrator')) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          <Typography variant="h6">Access Denied</Typography>
          Pricing logic configuration is restricted to administrators only.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <SettingsIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h4" component="h1">
              Pricing Logic Configuration
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadConfig}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveConfig}
              disabled={saving || loading}
            >
              Save Changes
            </Button>
          </Box>
        </Box>

        {lastUpdated && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Configure the core pricing logic parameters that affect all network design calculations. 
          Changes take effect immediately for new pricing calculations.
        </Typography>

        <Grid container spacing={3}>
          {/* Contract Terms Configuration */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <TrendingUpIcon color="primary" />
                  <Typography variant="h6">Contract Term Pricing Rules</Typography>
                  <Chip label="Core Logic" color="primary" size="small" />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Contract Term</strong></TableCell>
                        <TableCell><strong>Minimum Margin (%)</strong></TableCell>
                        <TableCell><strong>Suggested Margin (%)</strong></TableCell>
                        <TableCell><strong>NRC Charge (USD)</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(config.contractTerms).map(([term, termConfig]) => (
                        <TableRow key={term}>
                          <TableCell>
                            <Chip label={`${term} months`} variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={termConfig.minMargin}
                              onChange={(e) => updateContractTerm(term, 'minMargin', e.target.value)}
                              InputProps={{
                                endAdornment: <InputAdornment position="end">%</InputAdornment>
                              }}
                              size="small"
                              sx={{ width: 120 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={termConfig.suggestedMargin}
                              onChange={(e) => updateContractTerm(term, 'suggestedMargin', e.target.value)}
                              InputProps={{
                                endAdornment: <InputAdornment position="end">%</InputAdornment>
                              }}
                              size="small"
                              sx={{ width: 120 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={termConfig.nrcCharge}
                              onChange={(e) => updateContractTerm(term, 'nrcCharge', e.target.value)}
                              InputProps={{
                                startAdornment: <InputAdornment position="start">$</InputAdornment>
                              }}
                              size="small"
                              sx={{ width: 120 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Additional Charges */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <AttachMoneyIcon color="primary" />
                  <Typography variant="h6">Additional Charges</Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="ULL Premium Percentage"
                      type="number"
                      value={config.charges.ullPremiumPercent}
                      onChange={(e) => updateCharge('ullPremiumPercent', e.target.value)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }}
                      helperText="Additional charge for Ultra Low Latency requirements"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Protection Path Multiplier"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 1 }}
                      value={config.charges.protectionPathMultiplier}
                      onChange={(e) => updateCharge('protectionPathMultiplier', e.target.value)}
                      helperText="Multiplier for secondary/protection path pricing (0.0 - 1.0)"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Utilization Factors */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <SpeedIcon color="primary" />
                  <Typography variant="h6">Utilization Factors</Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Primary Path Utilization"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 1 }}
                      value={config.utilizationFactors.primary}
                      onChange={(e) => updateUtilizationFactor('primary', e.target.value)}
                      helperText="Expected utilization factor for primary paths (0.0 - 1.0)"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Protection Path Utilization"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 1 }}
                      value={config.utilizationFactors.protection}
                      onChange={(e) => updateUtilizationFactor('protection', e.target.value)}
                      helperText="Expected utilization factor for protection paths (0.0 - 1.0)"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Configuration Summary */}
          <Grid item xs={12}>
            <Card sx={{ bgcolor: 'primary.50', border: 1, borderColor: 'primary.200' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <SecurityIcon color="primary" />
                  <Typography variant="h6" color="primary">
                    Configuration Impact
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                  <strong>Real-time Effect:</strong> Changes to this configuration will immediately affect all new pricing calculations.
                  Existing saved calculations will not be modified.
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  <strong>Audit Trail:</strong> All configuration changes are logged and can be viewed in the change logs.
                </Typography>
                <Box mt={2}>
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={resetToDefaults}
                    sx={{ mr: 2 }}
                  >
                    Reset to Defaults
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default PricingLogicManager;