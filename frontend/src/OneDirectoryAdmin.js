import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, Alert, Snackbar, Grid,
  Card, CardContent, TextField, InputAdornment, Divider
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import PhoneIcon from '@mui/icons-material/Phone';
import TuneIcon from '@mui/icons-material/Tune';
import { API_BASE_URL } from './config';
import axios from 'axios';
import LoadingIndicator from './components/LoadingIndicator';

const OneDirectoryAdmin = ({ hasPermission }) => {
  const [parameters, setParameters] = useState({});
  const [editedParameters, setEditedParameters] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadParameters();
  }, []);

  const loadParameters = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/voice/one-directory/parameters`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      setParameters(response.data);
      setEditedParameters({});
    } catch (err) {
      setError('Failed to load parameters: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const getParameterValue = (key) => {
    if (editedParameters[key] !== undefined) {
      return editedParameters[key];
    }
    const val = parameters[key]?.value;
    return val !== undefined && val !== null ? val : '';
  };

  const handleParameterChange = (key, value) => {
    setEditedParameters(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveParameters = async () => {
    if (Object.keys(editedParameters).length === 0) {
      setError('No changes to save');
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API_BASE_URL}/voice/one-directory/parameters`,
        { parameters: editedParameters },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setSuccess('Parameters updated successfully');
      await loadParameters();
    } catch (err) {
      setError('Failed to save parameters: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingIndicator message="Loading One Directory Admin..." />;
  }

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PhoneIcon color="primary" />
          One Directory Admin
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Configure bandwidth calculation multipliers, resiliency multipliers, contract terms, bundle discounts, and add-on settings for the One Directory pricing tool.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Note:</strong> Rate cards are shared with the Extranet Pricing module and managed in Extranet Pricing Admin.
        </Typography>
      </Paper>

      {/* Save Button */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSaveParameters}
          disabled={Object.keys(editedParameters).length === 0 || saving}
        >
          {saving ? 'Saving...' : `Save Changes (${Object.keys(editedParameters).length})`}
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Bandwidth Calculation Multipliers */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TuneIcon color="primary" />
                Bandwidth Calculation Multipliers
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Used to calculate required bandwidth from directory users count.
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Formula:</strong> Bandwidth = (Directory Users × Avg Calls Per User × Call Bandwidth) × (1 + Growth %)
                </Typography>
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Average Calls Per User"
                    type="number"
                    value={getParameterValue('avg_calls_per_user')}
                    onChange={(e) => handleParameterChange('avg_calls_per_user', e.target.value)}
                    helperText="Average concurrent calls per directory user"
                    sx={{ backgroundColor: editedParameters['avg_calls_per_user'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Call Bandwidth"
                    type="number"
                    value={getParameterValue('call_bandwidth_kbps')}
                    onChange={(e) => handleParameterChange('call_bandwidth_kbps', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">kbps</InputAdornment>
                    }}
                    helperText="Bandwidth required per call"
                    sx={{ backgroundColor: editedParameters['call_bandwidth_kbps'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Growth Percentage"
                    type="number"
                    value={getParameterValue('growth_percentage')}
                    onChange={(e) => handleParameterChange('growth_percentage', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>
                    }}
                    helperText="Growth factor applied to calculated bandwidth (e.g. 20 = ×1.2)"
                    sx={{ backgroundColor: editedParameters['growth_percentage'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Resiliency Multipliers */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon color="primary" />
                Resiliency Multipliers
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Percentage applied to base rate card price based on resiliency type
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Non-Resilient"
                    type="number"
                    value={getParameterValue('resiliency_non_resilient')}
                    onChange={(e) => handleParameterChange('resiliency_non_resilient', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>
                    }}
                    sx={{ backgroundColor: editedParameters['resiliency_non_resilient'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Single Site Resilient"
                    type="number"
                    value={getParameterValue('resiliency_single_site')}
                    onChange={(e) => handleParameterChange('resiliency_single_site', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>
                    }}
                    sx={{ backgroundColor: editedParameters['resiliency_single_site'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* One Control ISF */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon color="success" />
                One Control ISF
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                One Control ISF is mandatory with every basket item. Its MRC is deducted from the One Directory rate card price before discounts are applied.
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  One Control MRC is <strong>not discountable</strong> — bundle discounts do not apply to this service.
                </Typography>
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="One Control MRC (USD)"
                    type="number"
                    value={getParameterValue('one_control_mrc')}
                    onChange={(e) => handleParameterChange('one_control_mrc', e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>
                    }}
                    helperText="Fixed MRC deducted from One Directory rate card"
                    sx={{ backgroundColor: editedParameters['one_control_mrc'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="One Control Bandwidth"
                    value={getParameterValue('one_control_bandwidth')}
                    onChange={(e) => handleParameterChange('one_control_bandwidth', e.target.value)}
                    helperText="Fixed bandwidth (e.g. 5Mb)"
                    sx={{ backgroundColor: editedParameters['one_control_bandwidth'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Off-Net Minimum Total Bandwidth"
                    type="number"
                    value={getParameterValue('off_net_min_bandwidth_mb')}
                    onChange={(e) => handleParameterChange('off_net_min_bandwidth_mb', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">Mb</InputAdornment>
                    }}
                    helperText="Minimum total bandwidth for Off Net (excludes One Control). Directory BW is bumped up if total is below this."
                    sx={{ backgroundColor: editedParameters['off_net_min_bandwidth_mb'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Contract Terms */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon color="warning" />
                Contract Terms
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                NRC charges and MRC discounts by contract term
              </Typography>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>12-Month Contract</Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="NRC (USD)"
                    type="number"
                    value={getParameterValue('nrc_12_month')}
                    onChange={(e) => handleParameterChange('nrc_12_month', e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>
                    }}
                    sx={{ backgroundColor: editedParameters['nrc_12_month'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
                    No discount for 12-month
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>24-Month Contract</Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="NRC (USD)"
                    type="number"
                    value={getParameterValue('nrc_24_month')}
                    onChange={(e) => handleParameterChange('nrc_24_month', e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>
                    }}
                    sx={{ backgroundColor: editedParameters['nrc_24_month'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="MRC Discount"
                    type="number"
                    value={getParameterValue('contract_24_discount')}
                    onChange={(e) => handleParameterChange('contract_24_discount', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>
                    }}
                    sx={{ backgroundColor: editedParameters['contract_24_discount'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>36-Month Contract</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="NRC (USD)"
                    type="number"
                    value={getParameterValue('nrc_36_month')}
                    onChange={(e) => handleParameterChange('nrc_36_month', e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>
                    }}
                    sx={{ backgroundColor: editedParameters['nrc_36_month'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="MRC Discount"
                    type="number"
                    value={getParameterValue('contract_36_discount')}
                    onChange={(e) => handleParameterChange('contract_36_discount', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>
                    }}
                    sx={{ backgroundColor: editedParameters['contract_36_discount'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Bundle Discount Tiers */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon color="secondary" />
                Bundle Discount Tiers
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Maximum MRC discount users can select per bundle size. NRC discount is applied automatically.
              </Typography>

              {/* Tier Range Configuration */}
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Tier Ranges:</strong> Define item count boundaries for each discount tier
                </Typography>
              </Alert>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Tier 1 Upper Bound"
                    type="number"
                    value={getParameterValue('bundle_tier_1_max')}
                    onChange={(e) => handleParameterChange('bundle_tier_1_max', e.target.value)}
                    helperText={`Tier 1: 1 to ${getParameterValue('bundle_tier_1_max') || '3'} items`}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">items</InputAdornment>
                    }}
                    inputProps={{ min: 1 }}
                    sx={{ backgroundColor: editedParameters['bundle_tier_1_max'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Tier 2 Upper Bound"
                    type="number"
                    value={getParameterValue('bundle_tier_2_max')}
                    onChange={(e) => handleParameterChange('bundle_tier_2_max', e.target.value)}
                    helperText={`Tier 2: ${(parseInt(getParameterValue('bundle_tier_1_max')) || 3) + 1} to ${getParameterValue('bundle_tier_2_max') || '5'} items | Tier 3: ${(parseInt(getParameterValue('bundle_tier_2_max')) || 5) + 1}+ items`}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">items</InputAdornment>
                    }}
                    inputProps={{ min: 2 }}
                    sx={{ backgroundColor: editedParameters['bundle_tier_2_max'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Tier 1: 1–{getParameterValue('bundle_tier_1_max') || '3'} Items
              </Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Max MRC Discount"
                    type="number"
                    value={getParameterValue('bundle_discount_mrc_1_3')}
                    onChange={(e) => handleParameterChange('bundle_discount_mrc_1_3', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>
                    }}
                    sx={{ backgroundColor: editedParameters['bundle_discount_mrc_1_3'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Auto NRC Discount"
                    type="number"
                    value={getParameterValue('bundle_discount_nrc_1_3')}
                    onChange={(e) => handleParameterChange('bundle_discount_nrc_1_3', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>
                    }}
                    sx={{ backgroundColor: editedParameters['bundle_discount_nrc_1_3'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Tier 2: {(parseInt(getParameterValue('bundle_tier_1_max')) || 3) + 1}–{getParameterValue('bundle_tier_2_max') || '5'} Items
              </Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Max MRC Discount"
                    type="number"
                    value={getParameterValue('bundle_discount_mrc_4_5')}
                    onChange={(e) => handleParameterChange('bundle_discount_mrc_4_5', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>
                    }}
                    sx={{ backgroundColor: editedParameters['bundle_discount_mrc_4_5'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Auto NRC Discount"
                    type="number"
                    value={getParameterValue('bundle_discount_nrc_4_5')}
                    onChange={(e) => handleParameterChange('bundle_discount_nrc_4_5', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>
                    }}
                    sx={{ backgroundColor: editedParameters['bundle_discount_nrc_4_5'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Tier 3: {(parseInt(getParameterValue('bundle_tier_2_max')) || 5) + 1}+ Items
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Max MRC Discount"
                    type="number"
                    value={getParameterValue('bundle_discount_mrc_6_plus')}
                    onChange={(e) => handleParameterChange('bundle_discount_mrc_6_plus', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>
                    }}
                    sx={{ backgroundColor: editedParameters['bundle_discount_mrc_6_plus'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Auto NRC Discount"
                    type="number"
                    value={getParameterValue('bundle_discount_nrc_6_plus')}
                    onChange={(e) => handleParameterChange('bundle_discount_nrc_6_plus', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>
                    }}
                    sx={{ backgroundColor: editedParameters['bundle_discount_nrc_6_plus'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
              </Grid>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Both MRC and NRC discounts are applied automatically when the basket is completed. Discounts apply to all services except One Control ISF.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* B2B Agility / Safe Connect Config */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon color="info" />
                B2B Agility &amp; Safe Connect
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Independent services with their own rate card pricing. Bandwidth options are configured below.
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="B2B Agility Bandwidth"
                    value={getParameterValue('b2b_agility_bandwidth')}
                    onChange={(e) => handleParameterChange('b2b_agility_bandwidth', e.target.value)}
                    helperText="Fixed bandwidth used when B2B Agility is enabled (e.g. 10Mb)"
                    sx={{ backgroundColor: editedParameters['b2b_agility_bandwidth'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Safe Connect Bandwidth Options (JSON array)"
                    value={getParameterValue('safe_connect_bandwidths')}
                    onChange={(e) => handleParameterChange('safe_connect_bandwidths', e.target.value)}
                    helperText='JSON array of bandwidth options, e.g. ["3Mb","5Mb","10Mb"]'
                    sx={{ backgroundColor: editedParameters['safe_connect_bandwidths'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* ISF Display Names */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon color="primary" />
                ISF Display Names
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Product display names shown to users in the pricing tool. These are labels only and do not affect pricing.
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Directory Service Name"
                    value={getParameterValue('isf_name_directory')}
                    onChange={(e) => handleParameterChange('isf_name_directory', e.target.value)}
                    sx={{ backgroundColor: editedParameters['isf_name_directory'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="One Control Service Name"
                    value={getParameterValue('isf_name_one_control')}
                    onChange={(e) => handleParameterChange('isf_name_one_control', e.target.value)}
                    sx={{ backgroundColor: editedParameters['isf_name_one_control'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="B2B Agility Service Name"
                    value={getParameterValue('isf_name_b2b_agility')}
                    onChange={(e) => handleParameterChange('isf_name_b2b_agility', e.target.value)}
                    sx={{ backgroundColor: editedParameters['isf_name_b2b_agility'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Safe Connect Service Name"
                    value={getParameterValue('isf_name_safe_connect')}
                    onChange={(e) => handleParameterChange('isf_name_safe_connect', e.target.value)}
                    sx={{ backgroundColor: editedParameters['isf_name_safe_connect'] !== undefined ? '#fff3e0' : 'transparent' }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        * Edited fields are highlighted in orange. Click "Save Changes" to apply updates.
      </Typography>

      {/* Snackbar notifications */}
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess(null)}>
        <Alert onClose={() => setSuccess(null)} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default OneDirectoryAdmin;
