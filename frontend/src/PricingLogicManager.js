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
  Security as SecurityIcon,
  LocalOffer as LocalOfferIcon,
  Cable as CableIcon
} from '@mui/icons-material';
import { networkDesignApi } from './api';

// Bandwidth tier constants for display
const BANDWIDTH_TIERS = {
  under_100mb: 'Under 100 Mb',
  from_100_to_999mb: '100 to 999 Mb',
  from_1000_to_2999mb: '1000 to 2999 Mb',
  over_3000mb: '3000 Mb Plus'
};

// Remove spinner buttons from number inputs
const numberInputSx = {
  '& input[type=number]': {
    MozAppearance: 'textfield'
  },
  '& input[type=number]::-webkit-outer-spin-button': {
    WebkitAppearance: 'none',
    margin: 0
  },
  '& input[type=number]::-webkit-inner-spin-button': {
    WebkitAppearance: 'none',
    margin: 0
  }
};

const PricingLogicManager = ({ hasPermission }) => {
  const [config, setConfig] = useState({
    contractTerms: {
      12: {
        bandwidthTiers: {
          under_100mb: { minMargin: 50, suggestedMargin: 65 },
          from_100_to_999mb: { minMargin: 40, suggestedMargin: 55 },
          from_1000_to_2999mb: { minMargin: 35, suggestedMargin: 50 },
          over_3000mb: { minMargin: 30, suggestedMargin: 45 }
        },
        nrcCharge: 1000
      },
      24: { discountPercent: 5, nrcCharge: 500 },
      36: { discountPercent: 10, nrcCharge: 0 }
    },
    protectedServiceMargins: {
      12: {
        bandwidthTiers: {
          under_100mb: { minMargin: 60, suggestedMargin: 75 },
          from_100_to_999mb: { minMargin: 50, suggestedMargin: 65 },
          from_1000_to_2999mb: { minMargin: 45, suggestedMargin: 60 },
          over_3000mb: { minMargin: 40, suggestedMargin: 55 }
        }
      },
      24: { discountPercent: 5 },
      36: { discountPercent: 10 }
    },
    charges: {
      // protectionPathMultiplier removed - protected service pricing now based on enforced margins
    },
    utilizationFactors: {
      primaryUnder10000: 0.9,
      primaryOver10000: 0.9,
      protectionUnder10000: 1.0,
      protectionOver10000: 1.0
    },
    promoPricing: {
      minimumMarginPercent: 35,
      protectionMinimumMarginPercent: 40,
      discount24Month: 5,
      discount36Month: 10
    },
    crossConnect: {
      nrcMargin: 10,
      mrcMargin: 10
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

  // Update 12-month bandwidth tier margins
  const updateBandwidthTierMargin = (tier, field, value, isProtected = false) => {
    const sectionKey = isProtected ? 'protectedServiceMargins' : 'contractTerms';
    setConfig(prev => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        12: {
          ...prev[sectionKey][12],
          bandwidthTiers: {
            ...prev[sectionKey][12].bandwidthTiers,
            [tier]: {
              ...prev[sectionKey][12].bandwidthTiers[tier],
              [field]: parseFloat(value) || 0
            }
          }
        }
      }
    }));
  };

  // Update contract term discount percentages (24 and 36 month)
  const updateContractDiscount = (term, value, isProtected = false) => {
    const sectionKey = isProtected ? 'protectedServiceMargins' : 'contractTerms';
    setConfig(prev => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        [term]: {
          ...prev[sectionKey][term],
          discountPercent: parseFloat(value) || 0
        }
      }
    }));
  };

  // Update NRC charge for contract terms
  const updateNrcCharge = (term, value) => {
    setConfig(prev => ({
      ...prev,
      contractTerms: {
        ...prev.contractTerms,
        [term]: {
          ...prev.contractTerms[term],
          nrcCharge: parseFloat(value) || 0
        }
      }
    }));
  };

  // Legacy function - kept for backward compatibility but not used in new UI
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

  // Legacy function - kept for backward compatibility but not used in new UI
  const updateProtectedServiceMargin = (term, field, value) => {
    setConfig(prev => ({
      ...prev,
      protectedServiceMargins: {
        ...prev.protectedServiceMargins,
        [term]: {
          ...prev.protectedServiceMargins[term],
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

  const updatePromoPricing = (settingType, value) => {
    setConfig(prev => ({
      ...prev,
      promoPricing: {
        ...prev.promoPricing,
        [settingType]: parseFloat(value) || 0
      }
    }));
  };

  const updateCrossConnect = (settingType, value) => {
    setConfig(prev => ({
      ...prev,
      crossConnect: {
        ...prev.crossConnect,
        [settingType]: parseFloat(value) || 0
      }
    }));
  };

  const resetToDefaults = () => {
    setConfig({
      contractTerms: {
        12: {
          bandwidthTiers: {
            under_100mb: { minMargin: 50, suggestedMargin: 65 },
            from_100_to_999mb: { minMargin: 40, suggestedMargin: 55 },
            from_1000_to_2999mb: { minMargin: 35, suggestedMargin: 50 },
            over_3000mb: { minMargin: 30, suggestedMargin: 45 }
          },
          nrcCharge: 1000
        },
        24: { discountPercent: 5, nrcCharge: 500 },
        36: { discountPercent: 10, nrcCharge: 0 }
      },
      protectedServiceMargins: {
        12: {
          bandwidthTiers: {
            under_100mb: { minMargin: 60, suggestedMargin: 75 },
            from_100_to_999mb: { minMargin: 50, suggestedMargin: 65 },
            from_1000_to_2999mb: { minMargin: 45, suggestedMargin: 60 },
            over_3000mb: { minMargin: 40, suggestedMargin: 55 }
          }
        },
        24: { discountPercent: 5 },
        36: { discountPercent: 10 }
      },
      charges: {
        // protectionPathMultiplier removed - protected service pricing now based on enforced margins
      },
      utilizationFactors: {
        primaryUnder10000: 0.9,
        primaryOver10000: 0.9,
        protectionUnder10000: 1.0,
        protectionOver10000: 1.0
      },
      promoPricing: {
        minimumMarginPercent: 35,
        protectionMinimumMarginPercent: 40,
        discount24Month: 5,
        discount36Month: 10
      },
      crossConnect: {
        nrcMargin: 10,
        mrcMargin: 10
      }
    });
  };

  if (!hasPermission('administrator')) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          <Typography variant="h6" sx={{ fontSize: '1.1875rem' }}>Access Denied</Typography>
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
            <Typography variant="h4" sx={{ fontSize: '2rem' }} component="h1">
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

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontSize: '0.75rem' }}>
          Configure the core pricing logic parameters that affect all network design calculations, including 
          standard service margins and premium protected service margins for redundant connectivity. 
          Changes take effect immediately for new pricing calculations.
        </Typography>

        <Grid container spacing={3}>
          {/* Base Service Margins (12-Month Contract) - Bandwidth Tiers */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <TrendingUpIcon color="primary" />
                  <Typography variant="h6" sx={{ fontSize: '1.1875rem' }}>Base Service Margins (12-Month Contract)</Typography>
                  <Chip label="Bandwidth-Based" color="primary" size="small" />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.75rem' }}>
                  Configure base margins for 12-month contracts across different bandwidth tiers. 
                  Lower bandwidth requests typically have higher margins, while higher bandwidth requests have lower margins.
                </Typography>
                <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Bandwidth Tier</strong></TableCell>
                        <TableCell><strong>Minimum Margin (%)</strong></TableCell>
                        <TableCell><strong>Suggested Margin (%)</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(BANDWIDTH_TIERS).map(([tierKey, tierLabel]) => {
                        const tierConfig = config.contractTerms[12].bandwidthTiers[tierKey];
                        return (
                          <TableRow key={tierKey}>
                            <TableCell>
                              <Chip label={tierLabel} variant="outlined" size="small" />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                value={tierConfig.minMargin}
                                onChange={(e) => updateBandwidthTierMargin(tierKey, 'minMargin', e.target.value, false)}
                                InputProps={{
                                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                                }}
                                size="small"
                                sx={{ ...numberInputSx, width: 120 }}
                                inputProps={{ min: 0, max: 100, step: 0.1 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                value={tierConfig.suggestedMargin}
                                onChange={(e) => updateBandwidthTierMargin(tierKey, 'suggestedMargin', e.target.value, false)}
                                InputProps={{
                                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                                }}
                                size="small"
                                sx={{ ...numberInputSx, width: 120 }}
                                inputProps={{ min: 0, max: 100, step: 0.1 }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Contract Term Discounts & NRC Charges */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <LocalOfferIcon color="primary" />
                  <Typography variant="h6" sx={{ fontSize: '1.1875rem' }}>Contract Term Discounts & NRC Charges</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.75rem' }}>
                  Configure discounts applied to 12-month base prices for longer contract terms, and set NRC charges for each term.
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" sx={{ fontSize: '1rem', mb: 2 }}>12-Month Contract</Typography>
                        <TextField
                          fullWidth
                          label="NRC Charge"
                          type="number"
                          value={config.contractTerms[12].nrcCharge}
                          onChange={(e) => updateNrcCharge('12', e.target.value)}
                          InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                          }}
                          size="small"
                          sx={numberInputSx}
                          helperText="One-time setup charge"
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" sx={{ fontSize: '1rem', mb: 2 }}>24-Month Contract</Typography>
                        <TextField
                          fullWidth
                          label="Discount Percentage"
                          type="number"
                          value={config.contractTerms[24].discountPercent}
                          onChange={(e) => updateContractDiscount('24', e.target.value, false)}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">%</InputAdornment>
                          }}
                          size="small"
                          sx={{ ...numberInputSx, mb: 2 }}
                          helperText="Discount off 12-month price"
                          inputProps={{ min: 0, max: 100, step: 0.1 }}
                        />
                        <TextField
                          fullWidth
                          label="NRC Charge"
                          type="number"
                          value={config.contractTerms[24].nrcCharge}
                          onChange={(e) => updateNrcCharge('24', e.target.value)}
                          InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                          }}
                          size="small"
                          sx={numberInputSx}
                          helperText="One-time setup charge"
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" sx={{ fontSize: '1rem', mb: 2 }}>36-Month Contract</Typography>
                        <TextField
                          fullWidth
                          label="Discount Percentage"
                          type="number"
                          value={config.contractTerms[36].discountPercent}
                          onChange={(e) => updateContractDiscount('36', e.target.value, false)}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">%</InputAdornment>
                          }}
                          size="small"
                          sx={{ ...numberInputSx, mb: 2 }}
                          helperText="Discount off 12-month price"
                          inputProps={{ min: 0, max: 100, step: 0.1 }}
                        />
                        <TextField
                          fullWidth
                          label="NRC Charge"
                          type="number"
                          value={config.contractTerms[36].nrcCharge}
                          onChange={(e) => updateNrcCharge('36', e.target.value)}
                          InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                          }}
                          size="small"
                          sx={numberInputSx}
                          helperText="One-time setup charge"
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Protected Service Margins (12-Month Contract) - Bandwidth Tiers */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <SecurityIcon color="primary" />
                  <Typography variant="h6" sx={{ fontSize: '1.1875rem' }}>Protected Service Margins (12-Month Contract)</Typography>
                  <Chip label="Bandwidth-Based" color="secondary" size="small" />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.75rem' }}>
                  Configure higher margins for protected services (redundant connectivity) across different bandwidth tiers.
                  These margins should typically be 10-15% higher than standard service margins.
                </Typography>
                <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Bandwidth Tier</strong></TableCell>
                        <TableCell><strong>Minimum Margin (%)</strong></TableCell>
                        <TableCell><strong>Suggested Margin (%)</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(BANDWIDTH_TIERS).map(([tierKey, tierLabel]) => {
                        const tierConfig = config.protectedServiceMargins[12].bandwidthTiers[tierKey];
                        return (
                          <TableRow key={tierKey}>
                            <TableCell>
                              <Chip label={tierLabel} variant="outlined" size="small" color="secondary" />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                value={tierConfig.minMargin}
                                onChange={(e) => updateBandwidthTierMargin(tierKey, 'minMargin', e.target.value, true)}
                                InputProps={{
                                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                                }}
                                size="small"
                                sx={{ ...numberInputSx, width: 120 }}
                                inputProps={{ min: 0, max: 100, step: 0.1 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                value={tierConfig.suggestedMargin}
                                onChange={(e) => updateBandwidthTierMargin(tierKey, 'suggestedMargin', e.target.value, true)}
                                InputProps={{
                                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                                }}
                                size="small"
                                sx={{ ...numberInputSx, width: 120 }}
                                inputProps={{ min: 0, max: 100, step: 0.1 }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Divider sx={{ my: 3 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.75rem' }}>
                  Configure discounts for longer contract terms on protected services:
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="24-Month Discount"
                      type="number"
                      value={config.protectedServiceMargins[24].discountPercent}
                      onChange={(e) => updateContractDiscount('24', e.target.value, true)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }}
                      size="small"
                      sx={numberInputSx}
                      helperText="Discount off 12-month protected service price"
                      inputProps={{ min: 0, max: 100, step: 0.1 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="36-Month Discount"
                      type="number"
                      value={config.protectedServiceMargins[36].discountPercent}
                      onChange={(e) => updateContractDiscount('36', e.target.value, true)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }}
                      size="small"
                      sx={numberInputSx}
                      helperText="Discount off 12-month protected service price"
                      inputProps={{ min: 0, max: 100, step: 0.1 }}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Utilization Factors */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <SpeedIcon color="primary" />
                  <Typography variant="h6" sx={{ fontSize: '1.1875rem' }}>Utilization Factors</Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Primary Path (10000Mbit and below)"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 1 }}
                      value={config.utilizationFactors.primaryUnder10000}
                      onChange={(e) => updateUtilizationFactor('primaryUnder10000', e.target.value)}
                      sx={numberInputSx}
                      helperText="Primary paths for circuits 10000Mbit and below (0.0 - 1.0)"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Primary Path (over 10000Mbit)"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 1 }}
                      value={config.utilizationFactors.primaryOver10000}
                      onChange={(e) => updateUtilizationFactor('primaryOver10000', e.target.value)}
                      sx={numberInputSx}
                      helperText="Primary paths for circuits over 10000Mbit (0.0 - 1.0)"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Protection Path (10000Mbit and below)"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 1 }}
                      value={config.utilizationFactors.protectionUnder10000}
                      onChange={(e) => updateUtilizationFactor('protectionUnder10000', e.target.value)}
                      sx={numberInputSx}
                      helperText="Protection paths for circuits 10000Mbit and below (0.0 - 1.0)"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Protection Path (over 10000Mbit)"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 1 }}
                      value={config.utilizationFactors.protectionOver10000}
                      onChange={(e) => updateUtilizationFactor('protectionOver10000', e.target.value)}
                      sx={numberInputSx}
                      helperText="Protection paths for circuits over 10000Mbit (0.0 - 1.0)"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Promo Pricing Settings */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <LocalOfferIcon color="primary" />
                  <Typography variant="h6" sx={{ fontSize: '1.1875rem' }}>Promo Pricing Settings</Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Minimum Margin Percentage"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 100 }}
                      value={config.promoPricing.minimumMarginPercent}
                      onChange={(e) => updatePromoPricing('minimumMarginPercent', e.target.value)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }}
                      sx={numberInputSx}
                      helperText="Minimum margin required for promo pricing to be used (fallback to regular pricing if not met)"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Protection Minimum Margin Percentage"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 100 }}
                      value={config.promoPricing.protectionMinimumMarginPercent}
                      onChange={(e) => updatePromoPricing('protectionMinimumMarginPercent', e.target.value)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }}
                      sx={numberInputSx}
                      helperText="Minimum margin required on the protection pricing increment (checked against the diverse/secondary route's allocated cost only)"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="24-Month Contract Discount"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 100 }}
                      value={config.promoPricing.discount24Month}
                      onChange={(e) => updatePromoPricing('discount24Month', e.target.value)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }}
                      sx={numberInputSx}
                      helperText="Additional discount from base promo price for 24-month contracts"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="36-Month Contract Discount"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 100 }}
                      value={config.promoPricing.discount36Month}
                      onChange={(e) => updatePromoPricing('discount36Month', e.target.value)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }}
                      sx={numberInputSx}
                      helperText="Additional discount from base promo price for 36-month contracts"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Cross Connect Settings */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <CableIcon color="primary" />
                  <Typography variant="h6" sx={{ fontSize: '1.1875rem' }}>Cross Connect Settings</Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Cross Connect NRC Margin"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 100 }}
                      value={config.crossConnect?.nrcMargin || 10}
                      onChange={(e) => updateCrossConnect('nrcMargin', e.target.value)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }}
                      sx={numberInputSx}
                      helperText="Margin percentage applied to cross connect NRC pricing"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Cross Connect MRC Margin"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 100 }}
                      value={config.crossConnect?.mrcMargin || 10}
                      onChange={(e) => updateCrossConnect('mrcMargin', e.target.value)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      }}
                      sx={numberInputSx}
                      helperText="Margin percentage applied to cross connect MRC pricing"
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
                  <Typography variant="h6" sx={{ fontSize: '1.1875rem' }} color="primary">
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