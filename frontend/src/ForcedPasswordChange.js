import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Typography, Alert, Box, Grid
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import { useAuth } from './AuthContext';

const ForcedPasswordChange = ({ open, onClose }) => {
  const { forcedPasswordChange, passwordResetRequired, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);

  // Close dialog when password reset is no longer required or user is logged out
  useEffect(() => {
    if (!passwordResetRequired || !isAuthenticated) {
      // Clear form when closing
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setError(null);
      setSuccess(null);
      onClose();
    }
  }, [passwordResetRequired, isAuthenticated, onClose]);

  const handleChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const validateForm = () => {
    if (!formData.currentPassword) {
      setError('Current password is required');
      return false;
    }
    if (!formData.newPassword) {
      setError('New password is required');
      return false;
    }
    if (formData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return false;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      return false;
    }
    if (formData.newPassword === 'abc123') {
      setError('New password cannot be the default reset password');
      return false;
    }
    if (formData.newPassword === formData.currentPassword) {
      setError('New password must be different from current password');
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await forcedPasswordChange(formData.currentPassword, formData.newPassword);
      
      if (result.success) {
        if (result.logout) {
          // Show success message
          setSuccess(result.message || 'Password changed successfully. You will be logged out now.');
          // Give user time to read the message before logout takes effect
          setTimeout(() => {
            // The logout is handled by the forcedPasswordChange function
            // Dialog will close automatically via useEffect when isAuthenticated becomes false
          }, 2000);
        } else {
          setSuccess('Password changed successfully!');
          // Dialog will close automatically via useEffect when passwordResetRequired becomes false
        }
      } else {
        setError(result.error || 'Failed to change password');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={() => {}} // Prevent closing - user must change password
      maxWidth="sm" 
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockResetIcon color="warning" />
          Password Change Required
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Your password has been reset by an administrator. You must change it before continuing.
        </Alert>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Current Password"
              type="password"
              value={formData.currentPassword}
              onChange={handleChange('currentPassword')}
              fullWidth
              required
              autoComplete="current-password"
              helperText="Enter 'abc123' (your temporary password)"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="New Password"
              type="password"
              value={formData.newPassword}
              onChange={handleChange('newPassword')}
              fullWidth
              required
              autoComplete="new-password"
              helperText="Must be at least 6 characters and different from abc123"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Confirm New Password"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange('confirmPassword')}
              fullWidth
              required
              autoComplete="new-password"
              helperText="Re-enter your new password"
            />
          </Grid>
        </Grid>
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          After changing your password, you will be logged out and need to log in again with your new password.
        </Typography>
      </DialogContent>
      
      <DialogActions>
        <Button 
          type="submit"
          variant="contained" 
          disabled={loading}
          fullWidth
        >
          {loading ? 'Changing Password...' : 'Change Password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForcedPasswordChange; 